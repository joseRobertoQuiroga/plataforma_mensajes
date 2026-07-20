const http = require('http');
const fs = require('fs');

const envContent = fs.readFileSync('C:/proyectos/plataforma_mensajes/wibsite/.env', 'utf8');
const match = envContent.match(/TWENTY_API_KEY=(.+)/);
const twentyKey = match[1].trim();

function req(method, path, body) {
  return new Promise((resolve, reject) => {
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + twentyKey,
      'Content-Length': body ? Buffer.byteLength(body) : 0
    };
    const req = http.request('http://localhost:3001' + path, { method, headers }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        resolve({ status: res.statusCode, body: data, parsed: data ? JSON.parse(data) : null });
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

(async () => {
  // Full error response for scoreHistory
  const r = await req('POST', '/rest/metadata/fields', JSON.stringify({
    objectMetadataId: '1f4a4676-3311-49ca-b072-6a73eff834b7',
    name: 'scoreHistory',
    label: 'Score History',
    type: 'TEXT',
    description: 'Score history JSON',
    icon: 'IconChartLine',
    isActive: true
  }));
  console.log('Status:', r.status);
  if (r.parsed) {
    console.log(JSON.stringify(r.parsed, null, 2));
  } else {
    console.log('Body:', r.body);
  }
})();
