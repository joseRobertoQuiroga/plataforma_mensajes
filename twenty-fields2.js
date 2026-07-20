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
    const r = http.request('http://localhost:3001' + path, { method, headers }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        resolve({ status: res.statusCode, body: data, parsed: data ? JSON.parse(data) : null });
      });
    });
    r.on('error', e => resolve({ status: 0, body: e.message, parsed: null }));
    if (body) r.write(body);
    r.end();
  });
}

(async () => {
  const objId = '1f4a4676-3311-49ca-b072-6a73eff834b7';

  // Use globally unique names with prefix
  const fields = [
    { name: 'leadScoreHistory', label: 'Lead Score History', type: 'TEXT', description: 'Score history JSON', icon: 'IconChartLine', isActive: true },
    { name: 'leadLastScore', label: 'Lead Last Score', type: 'NUMBER', description: 'Last computed score 0-100', icon: 'IconNumber', isActive: true },
    { name: 'leadOrigin', label: 'Lead Origin', type: 'TEXT', description: 'Lead origin source (web, facebook, referral)', icon: 'IconSource', isActive: true },
    { name: 'leadCustomData', label: 'Lead Custom Data', type: 'TEXT', description: 'Additional custom fields JSON', icon: 'IconSettings', isActive: true },
  ];

  for (const f of fields) {
    const r = await req('POST', '/rest/metadata/fields', JSON.stringify({ objectMetadataId: objId, ...f }));
    if (r.status === 201) {
      console.log('OK ' + f.name + ' -> ' + r.parsed.id);
    } else if (r.status === 409) {
      console.log('EXISTS ' + f.name);
    } else {
      console.log('FAIL ' + f.name + ': ' + (r.parsed ? r.parsed.message : r.body));
    }
  }
  console.log('Done');
})();
