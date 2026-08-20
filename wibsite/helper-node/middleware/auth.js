const crypto = require('crypto');

const HELPER_API_KEY = process.env.HELPER_API_KEY;
const META_APP_SECRET = process.env.META_APP_SECRET;
const CHATWOOT_SECRET_KEY = process.env.CHATWOOT_SECRET_KEY;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;

const PUBLIC_ROUTES = [
  { path: '/health', method: 'GET' },
  { path: '/metrics', method: 'GET' },
  { path: '/api/sli/metrics', method: 'GET' },
  { path: '/webhooks/whatsapp', method: 'GET' },
  { path: '/webhooks/whatsapp', method: 'POST' },
  { path: '/api/llm/health', method: 'GET' },
  // Twilio Bridge (protección vía X-Twilio-Signature; Twilio no envía X-API-Key)
  { path: '/webhooks/twilio-inbound', method: 'POST' },
  { path: '/webhooks/twilio-status', method: 'POST' },
  // Multicanal (protección vía tokens de verificación/firma de cada plataforma)
  { path: '/webhooks/telegram', method: 'GET' },
  { path: '/webhooks/telegram', method: 'POST' },
  { path: '/webhooks/messenger', method: 'GET' },
  { path: '/webhooks/messenger', method: 'POST' },
  { path: '/webhooks/email-inbound', method: 'POST' },
  { path: '/webhooks/tiktok-comments', method: 'POST' },
];

function isPublicRoute(req) {
  return PUBLIC_ROUTES.some(r => r.path === req.path && r.method === req.method);
}

function authMiddleware(req, res, next) {
  if (isPublicRoute(req)) return next();

  const apiKey = req.headers['x-api-key'];
  if (!apiKey) return res.status(401).json({ error: 'API key required. Use X-API-Key header.' });
  if (HELPER_API_KEY) {
    const a = Buffer.from(String(apiKey));
    const b = Buffer.from(HELPER_API_KEY);
    const valid = a.length === b.length && crypto.timingSafeEqual(a, b);
    if (!valid) return res.status(403).json({ error: 'Invalid API key' });
  }
  next();
}

function verifyMetaWebhookSignature(req, res, next) {
  if (req.path !== '/webhooks/whatsapp' || req.method !== 'POST') return next();
  if (!META_APP_SECRET) return next();

  const signature = req.headers['x-hub-signature-256'];
  if (!signature) return res.status(403).json({ error: 'Missing Meta webhook signature' });

  const body = JSON.stringify(req.body);
  const expectedSig = 'sha256=' + crypto.createHmac('sha256', META_APP_SECRET).update(body).digest('hex');

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
    return res.status(403).json({ error: 'Invalid webhook signature' });
  }
  next();
}

function verifyChatwootWebhookSignature(req, res, next) {
  if (req.path !== '/webhooks/chatwoot-outbound' && req.path !== '/api/chatwoot/normalize') return next();
  if (!CHATWOOT_SECRET_KEY) return next();

  const signature = req.headers['x-chatwoot-signature'] || req.headers['x-hub-signature-256'];
  if (!signature) return res.status(403).json({ error: 'Missing Chatwoot webhook signature' });

  const body = JSON.stringify(req.body);
  const expectedSig = 'sha256=' + crypto.createHmac('sha256', CHATWOOT_SECRET_KEY).update(body).digest('hex');

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
    return res.status(403).json({ error: 'Invalid webhook signature' });
  }
  next();
}

function verifyTwilioWebhookSignature(req, res, next) {
  const twilioPaths = ['/webhooks/twilio-inbound', '/webhooks/twilio-status'];
  if (!twilioPaths.includes(req.path) || req.method !== 'POST') return next();
  if (!TWILIO_AUTH_TOKEN) return next();

  const signature = req.headers['x-twilio-signature'];
  if (!signature) return res.status(403).json({ error: 'Missing Twilio webhook signature' });

  const proto = req.headers['x-forwarded-proto'] || req.protocol;
  const fullUrl = `${proto}://${req.get('host')}${req.originalUrl}`;
  const expected = crypto.createHmac('sha1', TWILIO_AUTH_TOKEN).update(fullUrl).digest('base64');

  try {
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
      return res.status(403).json({ error: 'Invalid Twilio webhook signature' });
    }
  } catch (e) {
    return res.status(403).json({ error: 'Invalid Twilio webhook signature' });
  }
  next();
}

module.exports = { authMiddleware, verifyMetaWebhookSignature, verifyChatwootWebhookSignature, verifyTwilioWebhookSignature };
