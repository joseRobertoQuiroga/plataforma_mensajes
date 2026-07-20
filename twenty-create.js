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
  // Try minimal person creation
  const payload = {
    name: { firstName: 'Test', lastName: 'User' },
    phones: { primaryPhoneNumber: '+5215500000001' },
    emails: { primaryEmail: 'test@example.com' },
    painPoints: 'test pain point',
    interests: 'test interest',
    leadOrigin: 'web',
    leadLastScore: 85,
    leadScoreHistory: '{}',
    leadCustomData: '{}'
  };
  
  const r = await req('POST', '/rest/people', JSON.stringify(payload));
  console.log('Status:', r.status);
  if (r.parsed) {
    if (r.parsed.errors || r.parsed.error) {
      console.log('Error:', JSON.stringify(r.parsed, null, 2));
    } else {
      console.log('Success:', JSON.stringify(r.parsed, null, 2).substring(0, 500));
    }
  } else {
    console.log('Body:', r.body);
  }
})();
