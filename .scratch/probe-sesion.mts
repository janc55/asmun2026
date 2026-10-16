// Prueba de la renovación automática de sesión con el cliente REAL (apps/web/src/lib/api.ts).
import http from 'node:http';

let refreshCalls = 0;
let expiredEvents = 0;
const VALID_REFRESH = 'refresh-valido';
const NEW_ACCESS = 'access-nuevo';
const NEW_REFRESH = 'refresh-nuevo';

const backend = http.createServer((req, res) => {
  const url = req.url ?? '';
  const auth = req.headers.authorization ?? '';
  const chunks: Buffer[] = [];
  req.on('data', (c) => chunks.push(c as Buffer));
  req.on('end', () => {
    const body = Buffer.concat(chunks).toString('utf8');

    if (url.endsWith('/auth/refresh')) {
      refreshCalls += 1;
      let token = '';
      try {
        token = JSON.parse(body).refreshToken;
      } catch {
        token = '';
      }
      console.log(`[backend] POST /auth/refresh (llamada #${refreshCalls}) refreshToken=${token}`);
      if (token !== VALID_REFRESH) {
        res.writeHead(401, { 'content-type': 'application/json' });
        res.end('{"code":"INVALID_REFRESH_TOKEN","message":"El refresh token es inválido o ha expirado"}');
        return;
      }
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ accessToken: NEW_ACCESS, refreshToken: NEW_REFRESH }));
      return;
    }

    // Cualquier otro endpoint exige el token nuevo.
    if (auth !== `Bearer ${NEW_ACCESS}`) {
      res.writeHead(401, { 'content-type': 'application/json' });
      res.end('{"code":"UNAUTHORIZED","message":"Token vencido"}');
      return;
    }
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, endpoint: url }));
  });
});

await new Promise<void>((r) => backend.listen(0, () => r()));
const port = (backend.address() as any).port;

// Entorno "navegador": window (EventTarget) + localStorage en memoria.
const store = new Map<string, string>();
const windowStub = new EventTarget();
(globalThis as any).window = windowStub;
(globalThis as any).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};
windowStub.addEventListener('asmun:session-expired', () => {
  expiredEvents += 1;
  console.log('[frontend] evento asmun:session-expired -> volver al login');
});

const realFetch = globalThis.fetch;
(globalThis as any).fetch = (input: any, init?: any) =>
  realFetch(typeof input === 'string' && input.startsWith('/') ? `http://127.0.0.1:${port}${input}` : input, init);

const { api, AUTH_TOKEN_KEYS, SESSION_EXPIRED_EVENT } = await import('../apps/web/src/lib/api.ts');
void SESSION_EXPIRED_EVENT;

const setSession = (access: string, refresh: string) => {
  store.set(AUTH_TOKEN_KEYS.access, access);
  store.set(AUTH_TOKEN_KEYS.refresh, refresh);
};
const session = () => ({ access: store.get(AUTH_TOKEN_KEYS.access) ?? null, refresh: store.get(AUTH_TOKEN_KEYS.refresh) ?? null });

console.log('\n=== 1) Token vencido -> renueva y reintenta ===');
setSession('access-viejo', VALID_REFRESH);
refreshCalls = 0;
try {
  const data: any = await api.get('/participants?page=1');
  console.log('[frontend] respuesta:', JSON.stringify(data));
} catch (e: any) {
  console.log('[frontend] ERROR:', e?.message);
}
console.log('[frontend] sesión guardada:', JSON.stringify(session()));
console.log(`[resultado] llamadas a /auth/refresh=${refreshCalls} · acceso OK=${session().access === NEW_ACCESS}`);

console.log('\n=== 2) Tres peticiones simultáneas con el token vencido ===');
setSession('access-viejo', VALID_REFRESH);
refreshCalls = 0;
const results = await Promise.allSettled([api.get('/participants'), api.get('/committees'), api.get('/scans')]);
console.log('[frontend] resultados:', results.map((r) => r.status).join(', '));
console.log(`[resultado] llamadas a /auth/refresh=${refreshCalls} (debe ser 1)`);

console.log('\n=== 3) Refresh token inválido -> cierra sesión ===');
setSession('access-viejo', 'refresh-malo');
refreshCalls = 0;
expiredEvents = 0;
try {
  await api.get('/participants');
  console.log('[frontend] NO debió llegar aquí');
} catch (e: any) {
  console.log('[frontend] error mostrado:', JSON.stringify(e?.message), '· code:', e?.code);
}
console.log('[frontend] sesión guardada:', JSON.stringify(session()));
console.log(`[resultado] llamadas a /auth/refresh=${refreshCalls} · eventos expirados=${expiredEvents} (debe ser 1) · tokens borrados=${session().access === null && session().refresh === null}`);

console.log('\n=== 4) Login con credenciales malas: no debe intentar renovar ===');
setSession('access-viejo', VALID_REFRESH);
refreshCalls = 0;
try {
  await api.post('/auth/login', { username: 'x', password: 'y' });
} catch (e: any) {
  console.log('[frontend] error mostrado:', JSON.stringify(e?.message));
}
console.log(`[resultado] llamadas a /auth/refresh=${refreshCalls} (debe ser 0)`);

backend.close();
