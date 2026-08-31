const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const { normalizePhone, normalizeEmail } = require('../middleware/sanitizer');

const DB_PATH = process.env.STORE_PATH || path.join(__dirname, '..', 'wibsite-store.json');

async function run() {
  console.log('--- Iniciando Job de Normalización de Datos (K9) ---');
  let changes = 0;

  // 1. Normalizar JSON Store
  if (fs.existsSync(DB_PATH)) {
    console.log(`\n-> Analizando JSON Store: ${DB_PATH}`);
    try {
      const store = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
      if (store.leads && Array.isArray(store.leads)) {
        let jsonChanges = 0;
        store.leads.forEach(lead => {
          let updated = false;
          if (lead.phone) {
            const norm = normalizePhone(lead.phone);
            if (norm !== lead.phone) {
              lead.phone = norm;
              updated = true;
            }
          }
          if (lead.email) {
            const norm = normalizeEmail(lead.email);
            if (norm !== lead.email) {
              lead.email = norm;
              updated = true;
            }
          }
          if (updated) jsonChanges++;
        });
        if (jsonChanges > 0) {
          fs.writeFileSync(DB_PATH, JSON.stringify(store, null, 2), 'utf-8');
          console.log(`JSON Store: ${jsonChanges} leads normalizados.`);
          changes += jsonChanges;
        } else {
          console.log('JSON Store: Ya estaba normalizado o sin leads.');
        }
      }
    } catch (e) {
      console.error('Error al normalizar JSON:', e.message);
    }
  }

  // 2. Normalizar PostgreSQL
  if (process.env.DATABASE_URL) {
    console.log(`\n-> Analizando Postgres DB...`);
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    try {
      const res = await pool.query('SELECT id, phone, email FROM leads');
      let pgChanges = 0;
      for (const row of res.rows) {
        let updated = false;
        let newPhone = row.phone;
        let newEmail = row.email;
        if (row.phone) {
          newPhone = normalizePhone(row.phone);
          if (newPhone !== row.phone) updated = true;
        }
        if (row.email) {
          newEmail = normalizeEmail(row.email);
          if (newEmail !== row.email) updated = true;
        }
        if (updated) {
          await pool.query('UPDATE leads SET phone = $1, email = $2 WHERE id = $3', [newPhone, newEmail, row.id]);
          pgChanges++;
        }
      }
      console.log(`Postgres DB: ${pgChanges} leads normalizados.`);
      changes += pgChanges;
    } catch (e) {
      console.error('Error al normalizar Postgres:', e.message);
    } finally {
      await pool.end();
    }
  } else {
    console.log('\n-> DATABASE_URL no definida, saltando Postgres.');
  }

  console.log(`\n--- Proceso Completado. Total cambios efectivos: ${changes} ---`);
}

run().catch(console.error);
