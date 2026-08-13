const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const STORE_PATH = path.join(__dirname, '..', '..', 'helper-node', 'wibsite-store.json');

async function main() {
  console.log('=== JSON to PostgreSQL Migration Tool ===\n');

  if (!fs.existsSync(STORE_PATH)) {
    console.error('ERROR: JSON store not found at', STORE_PATH);
    process.exit(1);
  }

  const store = JSON.parse(fs.readFileSync(STORE_PATH, 'utf-8'));
  console.log(`Loaded JSON store with:`);
  console.log(`  Campaigns:  ${(store.campaigns || []).length}`);
  console.log(`  Leads:      ${(store.leads || []).length}`);
  console.log(`  Scores:     ${(store.scores || []).length}`);
  console.log(`  Opt-Outs:   ${(store.optOuts || []).length}`);
  console.log(`  Channels:   ${(store.channels || []).length}`);
  console.log(`  Deliveries: ${(store.deliveries || []).length}\n`);

  const pool = new Pool({
    host: process.env.PG_HOST || 'postgres',
    port: parseInt(process.env.PG_PORT || '5432'),
    user: process.env.PG_USER || 'wibsite',
    password: process.env.PG_PASSWORD || 'wibsite_pass',
    database: process.env.PG_DATABASE || 'wibsite',
    max: 5
  });

  const counts = { campaigns: 0, leads: 0, scores: 0, optouts: 0, channels: 0 };

  try {
    await pool.query('BEGIN');

    // Migrate campaigns
    for (const c of (store.campaigns || [])) {
      const result = await pool.query(
        `INSERT INTO campaigns (id, name, description, channel, message_template, template_name, audience_filter, status, scheduled_at, started_at, completed_at, sent_count, delivered_count, read_count, replied_count, failed_count, opt_out_count, created_by, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
         ON CONFLICT (id) DO NOTHING`,
        [c.id, c.name, c.description, c.channel || 'whatsapp', c.message_template, c.template_name,
         JSON.stringify(c.audience_filter || {}), c.status || 'draft', c.scheduled_at, c.started_at,
         c.completed_at, c.sent_count || 0, c.delivered_count || 0, c.read_count || 0,
         c.replied_count || 0, c.failed_count || 0, c.opt_out_count || 0, c.created_by,
         c.created_at || new Date(), c.updated_at || new Date()]
      );
      if (result.rowCount > 0) counts.campaigns++;
    }

    // Migrate leads
    for (const l of (store.leads || [])) {
      const result = await pool.query(
        `INSERT INTO campaign_leads (id, campaign_id, name, phone, email, facebook_id, tiktok_id, custom_fields, status, message_id, channel_message_id, error_message, sent_at, delivered_at, read_at, replied_at, score, score_data, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
         ON CONFLICT (id) DO NOTHING`,
        [l.id, l.campaign_id, l.name, l.phone, l.email, l.facebook_id, l.tiktok_id,
         JSON.stringify(l.custom_fields || {}), l.status || 'pending', l.message_id, l.channel_message_id,
         l.error_message, l.sent_at, l.delivered_at, l.read_at, l.replied_at, l.score || 0,
         JSON.stringify(l.score_data || {}), l.created_at || new Date(), l.updated_at || new Date()]
      );
      if (result.rowCount > 0) counts.leads++;
    }

    // Migrate scores
    for (const s of (store.scores || [])) {
      const result = await pool.query(
        `INSERT INTO lead_scores (id, lead_id, campaign_id, score, score_factors, score_model, classified_at, expires_at, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (id) DO NOTHING`,
        [s.id, s.lead_id, s.campaign_id, s.score || 0, JSON.stringify(s.score_factors || {}),
         s.score_model || 'rule-based', s.classified_at || new Date(), s.expires_at, s.notes]
      );
      if (result.rowCount > 0) counts.scores++;
    }

    // Migrate opt-outs
    for (const o of (store.optOuts || [])) {
      const result = await pool.query(
        `INSERT INTO opt_outs (id, phone, email, facebook_id, tiktok_id, channel, reason, source, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (id) DO NOTHING`,
        [o.id, o.phone, o.email, o.facebook_id, o.tiktok_id, o.channel, o.reason, o.source || 'api', o.created_at || new Date()]
      );
      if (result.rowCount > 0) counts.optouts++;
    }

    // Migrate channels
    for (const ch of (store.channels || [])) {
      const result = await pool.query(
        `INSERT INTO channel_status (id, channel, status, status_message, last_checked_at, error_count, last_error_at, rate_limit_remaining, rate_limit_reset_at, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT (channel) DO NOTHING`,
        [ch.id, ch.channel, ch.status || 'disconnected', ch.status_message, ch.last_checked_at || new Date(),
         ch.error_count || 0, ch.last_error_at, ch.rate_limit_remaining, ch.rate_limit_reset_at,
         ch.created_at || new Date(), ch.updated_at || new Date()]
      );
      if (result.rowCount > 0) counts.channels++;
    }

    await pool.query('COMMIT');

    console.log('=== Migration Results ===');
    console.log(`  Campaigns inserted:  ${counts.campaigns}`);
    console.log(`  Leads inserted:      ${counts.leads}`);
    console.log(`  Scores inserted:     ${counts.scores}`);
    console.log(`  Opt-Outs inserted:   ${counts.optouts}`);
    console.log(`  Channels inserted:   ${counts.channels}`);
    console.log(`\nTotal records migrated: ${Object.values(counts).reduce((a, b) => a + b, 0)}`);

    // Verify counts
    console.log('\n=== Verification ===');
    for (const [table, label] of [['campaigns', 'Campaigns'], ['campaign_leads', 'Leads'],
      ['lead_scores', 'Scores'], ['opt_outs', 'Opt-Outs'], ['channel_status', 'Channels']]) {
      const result = await pool.query(`SELECT COUNT(*)::int as count FROM ${table}`);
      console.log(`  ${label} in PG: ${result.rows[0].count}`);
    }

  } catch (e) {
    await pool.query('ROLLBACK');
    console.error('Migration failed:', e.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
