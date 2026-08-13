const http = require('http');

const DIFY_URL = process.env.DIFY_URL || 'http://localhost:5001';
const DIFY_API_KEY = process.env.DIFY_API_KEY || 'app-IohwPPX3HDWA46TQLEcGBZq0';

async function post(url, data) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data);
    const req = http.request(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DIFY_API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      },
      timeout: 30000
    }, (res) => {
      let resp = '';
      res.on('data', chunk => resp += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(resp) }); }
        catch { resolve({ status: res.statusCode, data: resp }); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  console.log('=== Dify Workflow Verifier ===\n');

  const testPayload = {
    inputs: {
      message: 'Hola, quiero informacion de sus servicios de desarrollo',
      conversation_history: '[]',
      contact_name: 'Test User',
      platform: 'whatsapp'
    },
    response_mode: 'blocking',
    user: 'verify-script'
  };

  console.log('Enviando mensaje de prueba al workflow...');
  console.log('Payload:', JSON.stringify(testPayload).substring(0, 100) + '...\n');

  try {
    const result = await post(`${DIFY_URL}/v1/workflows/run`, testPayload);

    if (result.status === 200) {
      console.log('Status: 200 OK');
      console.log('Workflow ID:', result.data.workflow_run_id);
      console.log('Status:', result.data.data?.status);

      const outputs = result.data.data?.outputs;
      if (outputs) {
        console.log('\nOutputs:');
        console.log('  response_text:', outputs.response_text?.substring(0, 100) || 'N/A');
        console.log('  intent_score:', outputs.intent_score || 'N/A');
        console.log('  intent_label:', outputs.intent_label || 'N/A');
        console.log('  captured_data:', JSON.stringify(outputs.captured_data || {}).substring(0, 100));
        console.log('\nWorkflow publicado y funcionando correctamente.');
      } else if (result.data.data?.error) {
        console.log('\nWorkflow error:', result.data.data.error);
        console.log('El workflow necesita ser publicado desde Dify Studio.');
      } else {
        console.log('\nRespuesta del workflow:', JSON.stringify(result.data.data || {}).substring(0, 200));
      }
    } else {
      console.log('Status:', result.status);
      console.log('Respuesta:', JSON.stringify(result.data).substring(0, 200));
      console.log('\nEl workflow no esta publicado o la API key no es valida.');
      console.log('Asegurate de publicar el workflow en Dify Studio y usar el API key correcto.');
    }
  } catch (e) {
    console.log('Error:', e.message);
    console.log('\nPasos manuales requeridos:');
    console.log('1. Abrir http://localhost:3003');
    console.log('2. Login: joserobertoquirogasalvador@gmail.com / Admin@123');
    console.log('3. Ir a Studio > WhatsApp Lead Classifier');
    console.log('4. Click Publish');
    console.log('5. Copiar API Key de API Access');
    console.log('6. Actualizar DIFY_API_KEY en .env');
  }
}

main();
