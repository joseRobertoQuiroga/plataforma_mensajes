const crypto = require('crypto');

const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS = 60;
const LLM_MAX_REQUESTS = 10;

const ipBuckets = new Map();
const llmBuckets = new Map();

const cleanupTimer = setInterval(() => {
  const cutoff = Date.now() - WINDOW_MS;
  for (const [key, bucket] of ipBuckets) {
    bucket.timestamps = bucket.timestamps.filter(t => t > cutoff);
    if (bucket.timestamps.length === 0) ipBuckets.delete(key);
  }
  for (const [key, bucket] of llmBuckets) {
    bucket.timestamps = bucket.timestamps.filter(t => t > cutoff);
    if (bucket.timestamps.length === 0) llmBuckets.delete(key);
  }
}, 30000);
if (cleanupTimer.unref) cleanupTimer.unref();

function getClientIP(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || req.socket?.remoteAddress || 'unknown';
}

function rateLimiter(req, res, next) {
  const clientIP = getClientIP(req);
  // Health checks y telemetría interna: nunca compiten por el presupuesto público
  if (req.path === '/health' || req.path === '/metrics' || req.path === '/api/sli/metrics' || req.path === '/api/internal/ui-results') return next();
  const isLLM = req.path.startsWith('/api/llm/') || req.path.startsWith('/api/scoring/evaluate-llm');
  const maxReqs = isLLM ? LLM_MAX_REQUESTS : MAX_REQUESTS;
  const buckets = isLLM ? llmBuckets : ipBuckets;

  let bucket = buckets.get(clientIP);
  if (!bucket) {
    bucket = { timestamps: [] };
    buckets.set(clientIP, bucket);
  }

  const now = Date.now();
  bucket.timestamps = bucket.timestamps.filter(t => t > now - WINDOW_MS);

  if (bucket.timestamps.length >= maxReqs) {
    const retryAfter = Math.ceil((bucket.timestamps[0] + WINDOW_MS - now) / 1000);
    res.set('Retry-After', String(retryAfter));
    return res.status(429).json({
      error: 'Too many requests',
      retry_after: retryAfter,
      limit: maxReqs,
      window_seconds: WINDOW_MS / 1000,
    });
  }

  bucket.timestamps.push(now);
  next();
}

module.exports = { rateLimiter };
