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
  // 1. Create a person
  const createPayload = {
    name: { firstName: 'PATCH', lastName: 'Test ' + Date.now() },
    phones: { primaryPhoneNumber: '+52155999000' + Math.floor(Math.random() * 100) },
    leadOrigin: 'api_test',
    leadLastScore: 50
  };
  const create = await req('POST', '/rest/people', JSON.stringify(createPayload));
  const personId = create.parsed?.data?.createPerson?.id;
  console.log('Created:', personId);

  // 2. Update the person
  if (personId) {
    const updatePayload = {
      name: { firstName: 'Updated', lastName: 'Name' },
      leadLastScore: 95,
      leadScoreHistory: JSON.stringify({ previous: 50, updated: 95 })
    };
    const update = await req('PATCH', '/rest/people/' + personId, JSON.stringify(updatePayload));
    console.log('Update status:', update.status);
    console.log('Update response:', JSON.stringify(update.parsed).substring(0, 300));
  }
})();
