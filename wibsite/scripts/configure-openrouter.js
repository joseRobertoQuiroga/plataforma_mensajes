// Configura OpenRouter como provider de modelos en Dify
// vía plugin langgenius/openai_api_compatible
// Uso: node configure-openrouter.js [--validate-only]

const http = require('http');
const BASE = 'http://localhost:5001';
const ADMIN_EMAIL = 'joserobertoquirogasalvador@gmail.com';
const ADMIN_PASSWORD = 'Admin@123';
const OPENROUTER_KEY = 'sk-or-v1-YOUR_OPENROUTER_API_KEY';
const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1';
const PROVIDER = 'langgenius/openai_api_compatible/openai_api_compatible';

function api(method, path, body, cookieJar) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : '';
    const options = {
      hostname: 'localhost', port: 5001, path, method,
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
    };
    if (cookieJar) {
      options.headers['Cookie'] = Object.entries(cookieJar).map(([k, v]) => `${k}=${v}`).join('; ');
      if (cookieJar.csrf_token) options.headers['X-CSRF-TOKEN'] = cookieJar.csrf_token;
    }
    const req = http.request(options, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        const setCookies = res.headers['set-cookie'] || [];
        const cookies = { ...(cookieJar || {}) };
        for (const sc of setCookies) {
          const parts = sc.split(';')[0].split('=');
          if (parts.length === 2) cookies[parts[0]] = parts[1];
        }
        try { resolve({ status: res.statusCode, body: JSON.parse(d), cookies }); }
        catch (e) { resolve({ status: res.statusCode, body: d, cookies }); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function main() {
  console.log('=== OpenRouter → Dify Configuration ===\n');

  // 1. Login
  const passB64 = Buffer.from(ADMIN_PASSWORD).toString('base64');
  const login = await api('POST', '/console/api/login', { email: ADMIN_EMAIL, password: passB64 });
  if (login.status !== 200) {
    console.error('❌ Login failed:', login.status, JSON.stringify(login.body));
    process.exit(1);
  }
  console.log('✅ Dify login OK');

  const jar = login.cookies;

  // 2. Validate OpenRouter credentials
  const models = [
    'openai/gpt-4o-mini',
    'openai/gpt-4o',
    'openai/gpt-4o-mini-search-preview',
    'anthropic/claude-3.5-sonnet',
    'google/gemini-2.0-flash',
    'meta-llama/llama-3.3-70b-instruct',
    'mistralai/mistral-large',
    'cohere/command-r7b',
  ];

  const credentials = {
    endpoint_url: OPENROUTER_ENDPOINT,
    api_key: OPENROUTER_KEY,
    mode: 'chat',
    context_size: '128000',
    max_tokens_to_sample: '16384',
    vision_support: 'support',
    function_calling_type: 'tool_call',
    compatibility_mode: 'strict',
    stream_function_calling: 'supported',
  };

  console.log('\n📡 Validating OpenRouter credentials...');
  const validate = await api('POST', `/console/api/workspaces/current/model-providers/${encodeURIComponent(PROVIDER)}/credentials/validate`,
    { credentials }, jar);
  console.log(`Validate: status=${validate.status}, result=${JSON.stringify(validate.body).substring(0, 200)}`);

  // 3. Save provider credentials
  console.log('\n💾 Saving provider credentials...');
  const saveProv = await api('POST', `/console/api/workspaces/current/model-providers/${encodeURIComponent(PROVIDER)}/credentials`,
    { credentials }, jar);
  console.log(`Save provider: status=${saveProv.status}, body=${JSON.stringify(saveProv.body).substring(0, 200)}`);

  // 4. Register models
  console.log('\n📦 Registering models...');
  for (const model of models) {
    const payload = {
      model,
      model_type: 'llm',
      credentials: {
        ...credentials,
        context_size: model.includes('claude') ? '200000' : '128000',
        max_tokens_to_sample: model.includes('claude') ? '8192' : '16384',
      }
    };

    // Validate
    const v = await api('POST', `/console/api/workspaces/current/model-providers/${encodeURIComponent(PROVIDER)}/models/credentials/validate`,
      payload, jar);
    if (v.body?.result === 'success') {
      const c = await api('POST', `/console/api/workspaces/current/model-providers/${encodeURIComponent(PROVIDER)}/models/credentials`,
        payload, jar);
      console.log(`  ✅ ${model} (validate=${v.status}, create=${c.status})`);
    } else {
      console.log(`  ⬜ ${model} — ${v.body?.error || 'no soportado'} (${v.status})`);
    }
  }

  // 5. Verify
  console.log('\n📋 Verifying installed models...');
  const providers = await api('GET', '/console/api/workspaces/current/model-providers', null, jar);
  const data = providers.body;
  if (Array.isArray(data)) {
    for (const p of data) {
      if (p.provider === PROVIDER || p.provider?.includes('openai_api_compatible')) {
        console.log(`Provider: ${p.provider}, models: ${p.models?.length || 0}`);
        if (p.models) p.models.forEach(m => console.log(`  - ${m.model} (${m.model_type})`));
      }
    }
  } else {
    console.log('Providers response:', JSON.stringify(data).substring(0, 300));
  }

  console.log('\n✅ Configuración completada');
  console.log('Ahora puedes usar OpenRouter en workflows Dify.');
}

main().catch(console.error);
