/** Small transport interface so the backend can be swapped later. */

import type { ClientMsg, ServerMsg } from './protocol.ts';

export type TransportStatus = 'idle' | 'connecting' | 'open' | 'closed' | 'error';

export interface MpTransport {
  readonly status: TransportStatus;
  connect(url: string): void;
  send(msg: ClientMsg): void;
  close(): void;
  onMessage: ((msg: ServerMsg) => void) | null;
  onStatus: ((status: TransportStatus, detail?: string) => void) | null;
}

export function defaultMpUrl(): string {
  const env = (import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_MP_URL;
  if (env && env.trim()) return env.trim().replace(/\/$/, '');
  // Local wrangler default
  return 'ws://127.0.0.1:8787';
}
