/**
 * Reporter Playwright → SOAC (helper /api/internal/ui-results)
 * Publica el resultado de cada spec como evento e2e_ui (audit PG + ES).
 */
const fs = require('fs');
const path = require('path');
const http = require('http');

class SoacReporter {
  constructor(options) {
    this.baseUrl = (options && options.baseUrl) || process.env.HELPER_URL || 'http://localhost:3100';
    this.apiKey = (options && options.apiKey) || process.env.HELPER_API_KEY || '';
  }

  onTestEnd(test, result) {
    const spec = test.titlePath().join(' › ');
    const durationMs = result.duration;
    const traceUrl = this._artifactUrl(result, test, '.zip');
    const videoUrl = this._artifactUrl(result, test, '.webm');

    // Playwright reporta "skipped" con status 'skipped' — se preserva
    const status = result.status === 'skipped' ? 'skipped' : (result.status === 'passed' ? 'passed' : 'failed');

    const consoleErrors = [];
    const networkErrors = [];
    if (result.errors && result.errors.length && status === 'failed') {
      for (const err of result.errors) {
        const msg = String(err && err.message || err || '');
        if (msg) consoleErrors.push(msg.slice(0, 300));
      }
    }

    const payload = {
      spec,
      result: status,
      duration_ms: durationMs,
      project: (test.titlePath()[0] || 'chromium'),
      trace_url: traceUrl,
      video_url: videoUrl,
      console_errors: consoleErrors,
      network_errors: networkErrors,
    };
    this._post(payload);
  }

  _artifactUrl(result, test, ext) {
    try {
      const artifactsDir = path.join(process.cwd(), 'test-results');
      if (!fs.existsSync(artifactsDir)) return null;
      const files = fs.readdirSync(artifactsDir);
      const match = files.find((f) => f.includes(test.title.replace(/[^a-zA-Z0-9]+/g, '-')) && f.endsWith(ext));
      return match ? `test-results/${match}` : null;
    } catch (e) {
      return null;
    }
  }

  _post(payload) {
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
      }, (res) => { res.resume(); });
      req.on('error', () => {});
      req.end(body);
    } catch (e) { /* best-effort */ }
  }
}

module.exports = SoacReporter;
