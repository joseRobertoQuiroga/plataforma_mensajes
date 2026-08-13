const axios = require('axios');

const TWENTY_URL = process.env.TWENTY_URL || 'http://localhost:3001';
const TWENTY_API_KEY = process.env.TWENTY_API_KEY || '';
const OBJECT_TYPE = 'people';

const FIELDS = [
  { name: 'leadSituation', type: 'TEXT', label: 'Situacion del lead' },
  { name: 'leadPain', type: 'TEXT', label: 'Dolor/necesidad principal' },
  { name: 'leadImpact', type: 'TEXT', label: 'Impacto del problema' },
  { name: 'leadCriticalEvent', type: 'DATE', label: 'Evento critico/fecha limite' },
  { name: 'leadDecisionRole', type: 'SELECT', label: 'Rol en la decision', options: ['user', 'champion', 'economic_buyer', 'decision_maker', 'influencer'] },
  { name: 'leadMetrics', type: 'TEXT', label: 'Metricas de valor' },
  { name: 'leadEconomicBuyer', type: 'TEXT', label: 'Comprador economico' },
  { name: 'leadDecisionCriteria', type: 'TEXT', label: 'Criterios de decision' },
  { name: 'leadProcess', type: 'TEXT', label: 'Proceso de compra' },
  { name: 'leadFitScore', type: 'NUMBER', label: 'Score de fit' },
  { name: 'leadQualificationStage', type: 'SELECT', label: 'Etapa de calificacion', options: ['leads', 'new', 'contacted', 'working', 'spiced_in_progress', 'meddic_qualified', 'proposal', 'lost', 'won'] },
  { name: 'leadContactType', type: 'SELECT', label: 'Tipo de contacto', options: ['enterprise', 'wholesale', 'b2c'] },
  { name: 'leadConversationMode', type: 'SELECT', label: 'Modo conversacion', options: ['ai', 'human', 'return_to_ai'] }
];

async function createField(field) {
  try {
    const payload = {
      objectType: OBJECT_TYPE,
      name: field.name,
      type: field.type,
      label: field.label,
      description: field.description || ''
    };
    if (field.options) {
      payload.options = field.options.map(o => ({ value: o, label: o }));
    }
    const response = await axios.post(`${TWENTY_URL}/rest/metadata/fields`, payload, {
      headers: { 'Authorization': `Bearer ${TWENTY_API_KEY}`, 'Content-Type': 'application/json' }
    });
    console.log(`  ✅ Created: ${field.name} (${field.label})`);
    return response.data;
  } catch (e) {
    if (e.response?.status === 409) {
      console.log(`  ⚠️ Already exists: ${field.name}`);
    } else {
      console.log(`  ❌ Failed: ${field.name} - ${e.response?.data?.message || e.message}`);
    }
    return null;
  }
}

async function verifyFields() {
  try {
    const response = await axios.get(`${TWENTY_URL}/rest/metadata/fields?objectType=${OBJECT_TYPE}`, {
      headers: { 'Authorization': `Bearer ${TWENTY_API_KEY}` }
    });
    const existingFields = response.data?.data || response.data || [];
    const fieldNames = new Set(existingFields.map(f => f.name));
    console.log('\n=== Verification ===');
    let allCreated = true;
    for (const field of FIELDS) {
      if (fieldNames.has(field.name)) {
        console.log(`  ✅ ${field.name}`);
      } else {
        console.log(`  ❌ ${field.name} - MISSING`);
        allCreated = false;
      }
    }
    console.log(`\nTotal: ${FIELDS.length} fields, ${allCreated ? 'ALL CREATED ✅' : 'SOME MISSING ❌'}`);
    return allCreated;
  } catch (e) {
    console.error('Verification failed:', e.message);
    return false;
  }
}

async function main() {
  console.log('=== Twenty CRM - SPICED/MEDDIC Fields Setup ===\n');
  if (!TWENTY_API_KEY) {
    console.error('ERROR: TWENTY_API_KEY not set');
    process.exit(1);
  }
  console.log(`Creating ${FIELDS.length} fields in ${OBJECT_TYPE}...\n`);
  for (const field of FIELDS) {
    await createField(field);
  }
  await verifyFields();
}

main();
