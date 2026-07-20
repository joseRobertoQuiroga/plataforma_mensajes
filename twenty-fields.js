const http = require('http');
const fs = require('fs');

const envContent = fs.readFileSync('C:/proyectos/plataforma_mensajes/wibsite/.env', 'utf8');
const match = envContent.match(/TWENTY_API_KEY=(.+)/);
const twentyKey = match[1].trim();

const headers = {
  'Content-Type': 'application/json',
  'Authorization': 'Bearer ' + twentyKey
};

// Object ID for people
const objId = '1f4a4676-3311-49ca-b072-6a73eff834b7';

// Create fields one by one
const fields = [
  { name: 'scoreHistory', label: 'Score History', type: 'TEXT', description: 'Score history JSON', icon: 'IconChartLine', isActive: true },
  { name: 'lastScore', label: 'Last Score', type: 'NUMBER', description: 'Last computed score 0-100', icon: 'IconNumber', isActive: true },
  { name: 'leadSource', label: 'Lead Source', type: 'TEXT', description: 'Lead origin source', icon: 'IconSource', isActive: true },
  { name: 'customFields', label: 'Custom Fields', type: 'TEXT', description: 'Additional custom fields JSON', icon: 'IconSettings', isActive: true },
];

function createField(field, idx) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ objectMetadataId: objId, ...field });
    const req = http.request('http://localhost:3001/rest/metadata/fields', {
      method: 'POST',
      headers: { ...headers, 'Content-Length': Buffer.byteLength(body) }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        console.log(`Field ${field.name}: HTTP ${res.statusCode}`);
        if (res.statusCode === 201) {
          const parsed = JSON.parse(data);
          console.log(`  Created: ${parsed.id}`);
        } else if (res.statusCode === 409) {
          console.log('  Already exists');
        } else {
          console.log(`  Response: ${data.substring(0, 200)}`);
        }
        resolve();
      });
    });
    req.on('error', e => { console.log(`Error: ${e.message}`); resolve(); });
    req.write(body);
    req.end();
  });
}

(async () => {
  for (let i = 0; i < fields.length; i++) {
    await createField(fields[i], i);
    await new Promise(r => setTimeout(r, 1000));
  }
  console.log('Done');
})();
