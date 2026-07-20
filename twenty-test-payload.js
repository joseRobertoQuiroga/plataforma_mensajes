const http = require('http');
const fs = require('fs');

const envContent = fs.readFileSync('C:/proyectos/plataforma_mensajes/wibsite/.env', 'utf8');
const match = envContent.match(/TWENTY_API_KEY=(.+)/);
const twentyKey = match[1].trim();

function req(method, path, body) {
  return new Promise((resolve) => {
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + twentyKey,
      'Content-Length': body ? Buffer.byteLength(body) : 0
    };
    const r = http.request('http://localhost:3001' + path, { method, headers }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data, parsed: data ? JSON.parse(data) : null }));
    });
    r.on('error', e => resolve({ status: 0, body: e.message, parsed: null }));
    if (body) r.write(body);
    r.end();
  });
}

(async () => {
  // Simulate the exact payload the sync-all endpoint sends
  const payload = {
    name: { firstName: 'Pedro', lastName: 'González' },
    emails: { primaryEmail: 'pedro.gonzález@example.com' },
    phones: { primaryPhoneNumber: '5215510000005' },
    painPoints: 'poco tráfico',
    interests: 'SEO',
    leadOrigin: 'web',
    leadScoreHistory: '{"engagement":42,"recency":7,"channel_affinity":3}',
    leadLastScore: 95,
    leadCustomData: '{"interest":"SEO","pain_point":"poco tráfico","segment":"premium","source":"referral"}'
  };

  console.log('Payload:', JSON.stringify(payload, null, 2));
  console.log();
  
  const r = await req('POST', '/rest/people', JSON.stringify(payload));
  console.log('Status:', r.status);
  if (r.parsed) {
    if (r.parsed.errors || r.parsed.error) {
      console.log('Error:', JSON.stringify(r.parsed, null, 2));
    } else {
      console.log('Success:', JSON.stringify(r.parsed, null, 2).substring(0, 500));
    }
  } else {
    console.log('Raw:', r.body?.substring(0, 500));
  }
})();
