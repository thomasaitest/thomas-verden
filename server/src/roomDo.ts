import { createRoom, handleConnect, handleDisconnect, handleRawMessage, type Outbound, type RoomState } from '../../src/mp/roomLogic.ts';
import { encode } from '../../src/mp/protocol.ts';

/**
 * One Durable Object per invite code. WebSocket hibernation keeps free-tier costs low.
 * No player names are written to storage or logs.
 */
export class RoomDurableObject {
  private room: RoomState | null = null;
  private sockets = new Map<WebSocket, string>();
  private seq = 0;

  constructor(
    private readonly ctx: DurableObjectState,
    _env: unknown,
  ) {
    for (const ws of this.ctx.getWebSockets()) {
      const key = (ws.deserializeAttachment() as { key?: string } | null)?.key;
      if (key) this.sockets.set(ws, key);
    }
  }

  private ensureRoom(code: string): RoomState {
    if (!this.room) this.room = createRoom(code);
    return this.room;
  }

  async fetch(request: Request): Promise<Response> {
    const code = request.headers.get('X-Room-Code') || '?????';
    if (request.headers.get('Upgrade') !== 'websocket') {
      return Response.json({ error: 'Expected WebSocket' }, { status: 426 });
    }

    const room = this.ensureRoom(code);
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    const key = `p${++this.seq}-${Math.random().toString(36).slice(2, 8)}`;

    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ key });
    this.sockets.set(server, key);

    const out = handleConnect(room, key);
    this.dispatch(out);

    if (out.some((o) => o.msg.t === 'error')) {
      try {
        server.close(1013, 'full');
      } catch {
        /* ignore */
      }
    }

    return new Response(null, { status: 101, webSocket: client });
  }

  webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): void {
    const key = this.sockets.get(ws);
    if (!key || !this.room) return;
    if (typeof message !== 'string') {
      this.safeSend(ws, encode({ t: 'error', code: 'bad_msg', message: 'Ugyldig melding.' }));
      return;
    }
    const out = handleRawMessage(this.room, key, message);
    this.dispatch(out);
  }

  webSocketClose(ws: WebSocket): void {
    this.drop(ws);
  }

  webSocketError(ws: WebSocket): void {
    this.drop(ws);
  }

  private drop(ws: WebSocket) {
    const key = this.sockets.get(ws);
    this.sockets.delete(ws);
    if (!key || !this.room) return;
    const out = handleDisconnect(this.room, key);
    this.dispatch(out);
  }

  private dispatch(out: Outbound[]) {
    for (const o of out) {
      const raw = encode(o.msg);
      if (o.to === 'all') {
        for (const ws of this.sockets.keys()) this.safeSend(ws, raw);
      } else if (o.to === 'others') {
        // "others" relative to the sender key embedded in state/left messages:
        // left/state use the seat id; find sender by matching outbound context.
        // We approximate: broadcast to everyone except the message subject when present.
        const subject =
          o.msg.t === 'state' || o.msg.t === 'left' || o.msg.t === 'joined'
            ? o.msg.t === 'joined'
              ? o.msg.player.id
              : o.msg.id
            : null;
        for (const [ws, key] of this.sockets) {
          if (subject && key === subject) continue;
          this.safeSend(ws, raw);
        }
      } else {
        for (const [ws, key] of this.sockets) {
          if (key === o.to) this.safeSend(ws, raw);
        }
      }
    }
  }

  private safeSend(ws: WebSocket, raw: string) {
    try {
      ws.send(raw);
    } catch {
      /* closed */
    }
  }
}
