import { isAllowedOrigin } from './ai.mjs';
export function voiceMiddleware(env, fetcher = fetch) {
  const buckets = new Map();
  return async (req, res, next) => {
    const path = req.url?.split('?')[0];
    if (!['/api/voice/status', '/api/voice/speak', '/api/voice/transcribe'].includes(path)) return next();
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'application/json');
    const fail = (status, error) => { res.statusCode = status; res.end(JSON.stringify({error})); };
    if (!isAllowedOrigin(req.headers.origin, req.headers.host, env.ALLOWED_ORIGINS || 'capacitor://localhost')) return fail(403, 'Origin not allowed');
    if (req.headers.origin) res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
    res.setHeader('Vary', 'Origin');
    if (req.method === 'OPTIONS') { res.setHeader('Access-Control-Allow-Methods', 'POST, GET'); res.setHeader('Access-Control-Allow-Headers', 'Content-Type'); res.statusCode = 204; return res.end(); }
    if (path.endsWith('/status') && req.method === 'GET') return res.end(JSON.stringify({configured: !!env.ELEVENLABS_API_KEY}));
    if (req.method !== 'POST') return fail(405, 'Use POST');
    if (!env.ELEVENLABS_API_KEY) return fail(503, 'ElevenLabs is not connected yet. Sign in and configure a server API key.');
    const ip = req.socket?.remoteAddress || 'local';
    const now = Date.now();
    for (const [key, value] of buckets) if (now - value.start > 60000) buckets.delete(key);
    const bucket = buckets.get(ip) || { start: now, count: 0 };
    buckets.set(ip, bucket);
    if (++bucket.count > 20) return fail(429, 'Too many voice requests. Try again shortly.');
    try {
      let raw = ''; for await (const chunk of req) { raw += chunk; if (raw.length > 8_000_000) return fail(413, 'Recording too long. Keep it under 30 seconds.'); }
      const body = JSON.parse(raw);
      const headers = {'xi-api-key': env.ELEVENLABS_API_KEY};
      let response;
      if (path.endsWith('/speak')) {
        if (typeof body.text !== 'string' || !body.text.trim() || body.text.length > 1600) return fail(400, 'Invalid voice text');
        response = await fetcher(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(env.ELEVENLABS_VOICE_ID || 'JBFqnCBsd6RMkjVDRZzb')}`, {method:'POST', headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({text:body.text,model_id:'eleven_flash_v2_5'}),signal:AbortSignal.timeout(25000)});
      } else {
        if (typeof body.audio !== 'string' || !/^audio\/(webm|mp4|ogg|wav)(;.*)?$/.test(body.type)) return fail(400, 'Invalid recording');
        const form = new FormData(); form.append('model_id','scribe_v1'); form.append('file', new Blob([Buffer.from(body.audio,'base64')],{type:body.type}),body.type.includes('mp4')?'recording.m4a':'recording.webm');
        response = await fetcher('https://api.elevenlabs.io/v1/speech-to-text',{method:'POST',headers,body:form,signal:AbortSignal.timeout(25000)});
      }
      if (!response.ok) return fail(502, `ElevenLabs could not complete the request (${response.status}). Check your API permissions and credits.`);
      if (path.endsWith('/speak')) { res.setHeader('Content-Type','audio/mpeg'); return res.end(Buffer.from(await response.arrayBuffer())); }
      const data = await response.json(); res.end(JSON.stringify({text:data.text || ''}));
    } catch { fail(502, 'Voice request failed. Try again or type your reply.'); }
  };
}
