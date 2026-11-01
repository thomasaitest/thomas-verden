import { decodeServer, encode, type ClientMsg, type ServerMsg } from './protocol.ts';
import type { MpTransport, TransportStatus } from './transport.ts';

export class WsTransport implements MpTransport {
  status: TransportStatus = 'idle';
  onMessage: ((msg: ServerMsg) => void) | null = null;
  onStatus: ((status: TransportStatus, detail?: string) => void) | null = null;
  private ws: WebSocket | null = null;

  connect(url: string): void {
    this.close();
    this.setStatus('connecting');
    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch (e) {
      this.setStatus('error', 'Klarte ikke å koble til.');
      return;
    }
    this.ws = ws;
    ws.addEventListener('open', () => {
      if (this.ws === ws) this.setStatus('open');
    });
    ws.addEventListener('message', (ev) => {
      if (typeof ev.data !== 'string') return;
      const msg = decodeServer(ev.data);
      if (msg) this.onMessage?.(msg);
    });
    ws.addEventListener('close', () => {
      if (this.ws === ws) {
        this.ws = null;
        this.setStatus('closed');
      }
    });
    ws.addEventListener('error', () => {
      if (this.ws === ws) this.setStatus('error', 'Fikk ikke kontakt med serveren. Spill alene i mellomtiden.');
    });
  }

  send(msg: ClientMsg): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(encode(msg));
  }

  close(): void {
    const ws = this.ws;
    this.ws = null;
    if (ws && ws.readyState < 2) {
      try {
        ws.close();
      } catch {
        /* ignore */
      }
    }
    if (this.status !== 'idle' && this.status !== 'closed') this.setStatus('closed');
  }

  private setStatus(s: TransportStatus, detail?: string) {
    this.status = s;
    this.onStatus?.(s, detail);
  }
}
