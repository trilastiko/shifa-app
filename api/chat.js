const WINDOW_MS = 60_000;
const MAX_CLIENT_REQUESTS = 5;
const MAX_INSTANCE_REQUESTS = 30;
const clients = new Map();
let windowStarted = Date.now();
let instanceRequests = 0;

// This bounds abuse within one warm instance. Configure a durable edge limiter too.
function admitClient(req) {
  const now = Date.now();
  if (now - windowStarted >= WINDOW_MS) {
    clients.clear();
    instanceRequests = 0;
    windowStarted = now;
  }
  const client = req.headers['x-vercel-forwarded-for'] || req.socket?.remoteAddress || 'shared';
  const key = String(client).slice(0, 200);
  const count = clients.get(key) || 0;
  if (count >= MAX_CLIENT_REQUESTS || instanceRequests >= MAX_INSTANCE_REQUESTS) return false;
  clients.set(key, count + 1);
  instanceRequests += 1;
  return true;
}

function allowedOrigins() {
  const configured = process.env.CHAT_ALLOWED_ORIGINS;
  if (configured) return configured.split(',').map(value => value.trim()).filter(Boolean);
  return process.env.NODE_ENV === 'production'
    ? ['https://shifa.sab.id']
    : ['https://shifa.sab.id', 'http://localhost:5173', 'http://localhost:3000'];
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Vary', 'Origin');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  const origin = req.headers.origin;
  if (!origin || !allowedOrigins().includes(origin)) {
    return res.status(403).json({ error: 'Origin not allowed' });
  }
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '')) {
    return res.status(415).json({ error: 'JSON body required' });
  }
  let body = req.body;
  try {
    if (typeof body === 'string') body = JSON.parse(body);
    if (Buffer.byteLength(JSON.stringify(body) || '') > 32_768) {
      return res.status(413).json({ error: 'Request too large' });
    }
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' });
  }
  if (!body || body.model !== 'claude-haiku-4-5-20251001' ||
      !Number.isInteger(body.max_tokens) || body.max_tokens < 1 || body.max_tokens > 4000 ||
      typeof body.system !== 'string' || body.system.length > 20_000 ||
      !Array.isArray(body.messages) || body.messages.length < 1 || body.messages.length > 10 ||
      body.messages.some(message => !message || !['user', 'assistant'].includes(message.role) ||
        typeof message.content !== 'string' || !message.content.trim() || message.content.length > 10_000)) {
    return res.status(400).json({ error: 'Invalid chat request' });
  }
  if (!admitClient(req)) {
    res.setHeader('Retry-After', '60');
    return res.status(429).json({ error: 'Too many requests. Please try again later.' });
  }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'Chat temporarily unavailable' });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      // Forward only the supported fields; clients cannot enable tools, streaming or other models.
      body: JSON.stringify({
        model: body.model,
        max_tokens: body.max_tokens,
        system: body.system,
        messages: body.messages.map(({ role, content }) => ({ role, content })),
      }),
    });
    if (!response.ok) return res.status(502).json({ error: 'Chat provider unavailable' });
    return res.status(200).json(await response.json());
  } catch {
    return res.status(controller.signal.aborted ? 504 : 502).json({ error: 'Chat temporarily unavailable' });
  } finally {
    clearTimeout(timeout);
  }
}
