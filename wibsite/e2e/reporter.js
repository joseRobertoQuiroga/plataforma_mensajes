/**
 * Reporter Playwright → SOAC (helper /api/internal/ui-results)
 * Publica el resultado de cada spec como evento e2e_ui (audit PG + ES).
 *
 * Resiliencia: los envíos se encolan y se reintentan con backoff exponencial
 * (el helper tiene rate limit; los eventos de telemetría no deben perderse
 * aunque haya picos de 429). La cola usa un deadline deslizante: se extiende
 * con cada evento nuevo o envío exitoso, y el proceso se mantiene vivo hasta
 * que la cola queda vacía.
 *
 * IMPORTANTE: no ejecutar `npx playwright test --reporter=...` — el flag
 * sobreescribe el array de reporters del config y desactiva este reporter.
 */
const http = require('http');

const RETRY_MS = [2000, 5000, 10000, 20000, 40000];
const IDLE_TIMEOUT_MS = 120000; // sin actividad nueva, abandonar cola residual

class SoacReporter {
  constructor(options) {
    this.baseUrl = (options && options.baseUrl) || process.env.HELPER_URL || 'http://localhost:3100';
    this.apiKey = (options && options.apiKey) || process.env.HELPER_API_KEY || '';
    this.queue = [];
    this.flushing = false;
    this.finished = false;
    this.flushInterval = null;
    this.idleDeadline = 0;
  }

  onTestEnd(test, result) {
    const spec = test.titlePath().join(' › ');
    const durationMs = result.duration;
    const traceUrl = this._artifactUrl(result, test, '.zip');
    const videoUrl = this._artifactUrl(result, test, '.webm');

    const status = result.status === 'skipped' ? 'skipped' : (result.status === 'passed' ? 'passed' : 'failed');

    const consoleErrors = [];
    if (result.errors && result.errors.length && status === 'failed') {
      for (const err of result.errors) {
        const msg = String(err && err.message || err || '');
        if (msg) consoleErrors.push(msg.slice(0, 300));
      }
    }

    this.queue.push({
      spec,
      result: status,
      duration_ms: durationMs,
      project: (test.titlePath()[0] || 'chromium'),
      trace_url: traceUrl,
      video_url: videoUrl,
      console_errors: consoleErrors,
      network_errors: [],
      attempts: 0,
      nextAttemptAt: 0,
    });
    this.idleDeadline = Date.now() + IDLE_TIMEOUT_MS;
    this._startFlushLoop();
  }

  onEnd() {
    this.finished = true;
  }

  onExit() {
    // Best-effort: intentar vaciar la cola antes de salir (corto y sin bloquear)
    const deadline = Date.now() + 8000;
    while (this.queue.length && Date.now() < deadline) {
      try {
        const payload = this.queue.shift();
        this._postSync(payload);
      } catch (e) { break; }
    }
  }

  _startFlushLoop() {
    if (this.flushInterval) return;
    this.flushInterval = setInterval(() => {
      const queueEmpty = this.queue.length === 0;
      if (queueEmpty && this.finished) {
        clearInterval(this.flushInterval);
        this.flushInterval = null;
        return;
      }
      if (Date.now() > this.idleDeadline) {
        clearInterval(this.flushInterval);
        this.flushInterval = null;
        return;
      }
      this._flushOne();
    }, 400);
  }

  _flushOne() {
    if (this.flushing || !this.queue.length) return;
    const payload = this.queue[0];
    const now = Date.now();
    if (now < payload.nextAttemptAt) return;

    this.flushing = true;
    payload.attempts += 1;

    this._post(payload, (err, status) => {
      if (!err && status >= 200 && status < 300) {
        this.queue.shift();
        this.idleDeadline = Date.now() + IDLE_TIMEOUT_MS; // actividad: extender deadline
      } else if (status === 429) {
        const backoff = RETRY_MS[Math.min(payload.attempts - 1, RETRY_MS.length - 1)];
        payload.nextAttemptAt = now + backoff;
        this.idleDeadline = Date.now() + IDLE_TIMEOUT_MS;
      } else if (payload.attempts >= RETRY_MS.length) {
        this.queue.shift(); // rendirse: no bloquear la cola para siempre
      } else {
        const backoff = RETRY_MS[Math.min(payload.attempts - 1, RETRY_MS.length - 1)];
        payload.nextAttemptAt = now + backoff;
      }
      this.flushing = false;
    });
  }

  _post(payload, cb) {
    if (!this.apiKey) { cb(null, 200); return; }
    try {
      const u = new URL(this.baseUrl);
      const body = JSON.stringify(payload);
      const req = http.request({
        hostname: u.hostname,
        port: u.port || 3100,
        path: '/api/internal/ui-results',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
          'x-api-key': this.apiKey,
        },
        timeout: 10000,
      }, (res) => { res.resume(); cb(null, res.statusCode); });
      req.on('error', (e) => cb(e));
      req.on('timeout', () => { req.destroy(); cb(new Error('timeout')); });
      req.end(body);
    } catch (e) { cb(e); }
  }

  _postSync(payload) {
    if (!this.apiKey) return;
    try {
      const u = new URL(this.baseUrl);
      const body = JSON.stringify(payload);
      const req = http.request({
        hostname: u.hostname,
        port: u.port || 3100,
        path: '/api/internal/ui-results',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
          'x-api-key': this.apiKey,
        },
        timeout: 3000,
      }, (res) => { res.resume(); });
      req.on('error', () => {});
      req.on('timeout', () => req.destroy());
      req.end(body);
    } catch (e) { /* best-effort */ }
  }

  _artifactUrl(result, test, ext) {
    try {
      const fs = require('fs');
      const path = require('path');
      const artifactsDir = path.join(process.cwd(), 'test-results');
      if (!fs.existsSync(artifactsDir)) return null;
      const files = fs.readdirSync(artifactsDir);
      const match = files.find((f) => f.includes(test.title.replace(/[^a-zA-Z0-9]+/g, '-')) && f.endsWith(ext));
      return match ? `test-results/${match}` : null;
    } catch (e) {
      return null;
    }
  }
}

module.exports = SoacReporter;
