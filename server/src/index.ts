import { RoomDurableObject } from './roomDo.ts';
import { cleanCode, isValidCode } from '../../src/mp/codes.ts';

export { RoomDurableObject };

export interface Env {
  ROOMS: DurableObjectNamespace;
}

const ALLOWED_ORIGINS = new Set([
  'https://thomasaitest.github.io',
  'http://localhost:4740',
  'http://127.0.0.1:4740',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
]);

function corsHeaders(origin: string | null): HeadersInit {
  const allow = origin && ALLOWED_ORIGINS.has(origin) ? origin : 'https://thomasaitest.github.io';
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
  };
}

function originAllowed(request: Request): boolean {
  const origin = request.headers.get('Origin');
  if (!origin) return false;
  return ALLOWED_ORIGINS.has(origin);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin');
    const cors = corsHeaders(origin);

    if (request.method === 'OPTIONS') {
      if (origin && !ALLOWED_ORIGINS.has(origin)) {
        return new Response(null, { status: 403 });
      }
      return new Response(null, { status: 204, headers: cors });
    }

    const url = new URL(request.url);

    if (url.pathname === '/' || url.pathname === '/health') {
      return Response.json({ ok: true, service: 'thomas-verden-mp', v: 1 }, { headers: cors });
    }

    // GET /room/:code → WebSocket upgrade to that room's Durable Object
    const m = url.pathname.match(/^\/room\/([A-Za-z0-9]+)$/);
    if (m) {
      // Browsers always send Origin on WebSocket; reject unknown/missing for every /room hit.
      if (!originAllowed(request)) {
        return Response.json({ error: 'Origin ikke tillatt.' }, { status: 403, headers: cors });
      }
      const code = cleanCode(m[1]!);
      if (!isValidCode(code)) {
        return Response.json({ error: 'Ugyldig romkode.' }, { status: 400, headers: cors });
      }
      const id = env.ROOMS.idFromName(`room:${code}`);
      const stub = env.ROOMS.get(id);
      const headers = new Headers(request.headers);
      headers.set('X-Room-Code', code);
      return stub.fetch(new Request('https://room/ws', { headers }));
    }

    return Response.json({ error: 'Not found' }, { status: 404, headers: cors });
  },
};
