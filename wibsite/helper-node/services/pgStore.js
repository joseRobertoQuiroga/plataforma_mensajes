const { Pool } = require('pg');

let pool = null;

function initPgStore(pgPool) {
  pool = pgPool;
}

async function query(text, params) {
  if (!pool) return { rows: [], rowCount: 0 };
  try {
    return await pool.query(text, params);
  } catch (e) {
    console.error('PG store query error:', e.message);
    throw e;
  }
}

const CampaignStore = {
  async findAll(filters = {}) {
    let sql = 'SELECT * FROM campaigns WHERE 1=1';
    const params = [];
    if (filters.status) { sql += ` AND status = $${params.length + 1}`; params.push(filters.status); }
    if (filters.channel) { sql += ` AND channel = $${params.length + 1}`; params.push(filters.channel); }
    sql += ' ORDER BY created_at DESC';
    if (filters.limit) { sql += ` LIMIT $${params.length + 1}`; params.push(filters.limit); }
    if (filters.offset) { sql += ` OFFSET $${params.length + 1}`; params.push(filters.offset); }
    const result = await query(sql, params);
    return result.rows;
  },

  async findById(id) {
    const result = await query('SELECT * FROM campaigns WHERE id = $1', [id]);
    return result.rows[0] || null;
  },

  async create(data) {
    const result = await query(
      `INSERT INTO campaigns (id, name, description, channel, message_template, template_name, audience_filter, status, scheduled_at, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [data.id, data.name, data.description, data.channel || 'whatsapp', data.message_template,
       data.template_name, JSON.stringify(data.audience_filter || {}),
       data.status || 'draft', data.scheduled_at || null, data.created_by || null]
    );
    return result.rows[0];
  },

  async update(id, data) {
    const fields = [];
    const params = [];
    let idx = 1;
    for (const [key, value] of Object.entries(data)) {
      if (key === 'id') continue;
      fields.push(`${key} = $${idx++}`);
      params.push(value);
    }
    params.push(id);
    const result = await query(
      `UPDATE campaigns SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`, params
    );
    return result.rows[0] || null;
  },

  async delete(id) {
    await query('DELETE FROM campaigns WHERE id = $1', [id]);
  },

  async findPending(scheduledBefore) {
    const result = await query(
      `SELECT * FROM campaigns WHERE status = 'scheduled' AND scheduled_at <= $1 ORDER BY scheduled_at ASC`,
      [scheduledBefore || new Date().toISOString()]
    );
    return result.rows;
  }
};

const LeadStore = {
  async findByCampaign(campaignId, filters = {}) {
    let sql = 'SELECT * FROM campaign_leads WHERE campaign_id = $1';
    const params = [campaignId];
    if (filters.status) { sql += ` AND status = $${params.length + 1}`; params.push(filters.status); }
    sql += ' ORDER BY created_at DESC';
    const result = await query(sql, params);
    return result.rows;
  },

  async findAll(filters = {}) {
    let sql = 'SELECT * FROM campaign_leads WHERE 1=1';
    const params = [];
    if (filters.limit) { sql += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`; params.push(filters.limit); }
    else sql += ' ORDER BY created_at DESC';
    const result = await query(sql, params);
    return result.rows;
  },

  async findById(id) {
    const result = await query('SELECT * FROM campaign_leads WHERE id = $1', [id]);
    return result.rows[0] || null;
  },

  async create(campaignId, data) {
    if (!campaignId) return null;
    const campaignCheck = await query('SELECT 1 FROM campaigns WHERE id = $1', [campaignId]);
    if (!campaignCheck.rows.length) return null;
    const result = await query(
      `INSERT INTO campaign_leads (id, campaign_id, company_id, name, phone, email, facebook_id, tiktok_id, custom_fields, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [data.id, campaignId, data.company_id || null, data.name, data.phone, data.email, data.facebook_id,
       data.tiktok_id, JSON.stringify(data.custom_fields || {}), data.status || 'pending']
    );
    return result.rows[0];
  },

  async update(id, data) {
    const fields = [];
    const params = [];
    let idx = 1;
    for (const [key, value] of Object.entries(data)) {
      if (key === 'id') continue;
      fields.push(`${key} = $${idx++}`);
      params.push(value);
    }
    params.push(id);
    const result = await query(
      `UPDATE campaign_leads SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`, params
    );
    return result.rows[0] || null;
  },

  async bulkCreate(campaignId, leads) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const created = [];
      for (const lead of leads) {
        const result = await client.query(
          `INSERT INTO campaign_leads (campaign_id, company_id, name, phone, email, custom_fields, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT DO NOTHING RETURNING *`,
          [campaignId, lead.company_id || null, lead.name, lead.phone, lead.email,
           JSON.stringify(lead.custom_fields || {}), lead.status || 'pending']
        );
        if (result.rows[0]) created.push(result.rows[0]);
      }
      await client.query('COMMIT');
      return created;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  },

  async countByCampaign(campaignId) {
    const result = await query(
      'SELECT status, COUNT(*)::int FROM campaign_leads WHERE campaign_id = $1 GROUP BY status',
      [campaignId]
    );
    return result.rows;
  }
};

const ScoreStore = {
  async create(data) {
    if (!data.lead_id) return null;
    const leadCheck = await query('SELECT campaign_id FROM campaign_leads WHERE id = $1', [data.lead_id]);
    if (!leadCheck.rows.length) return null;
    const campaignId = data.campaign_id || leadCheck.rows[0].campaign_id;
    const result = await query(
      `INSERT INTO lead_scores (lead_id, campaign_id, score, score_factors, score_model, notes)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [data.lead_id, campaignId, data.score,
       JSON.stringify(data.score_factors || {}), data.score_model || 'rule-based', data.notes || null]
    );
    return result.rows[0];
  },

  async findByLead(leadId) {
    const result = await query(
      'SELECT * FROM lead_scores WHERE lead_id = $1 ORDER BY classified_at DESC', [leadId]
    );
    return result.rows;
  },

  async findAll(filters = {}) {
    let sql = 'SELECT * FROM lead_scores';
    const params = [];
    if (filters.limit) { sql += ` ORDER BY classified_at DESC LIMIT $${params.length + 1}`; params.push(filters.limit); }
    else sql += ' ORDER BY classified_at DESC';
    const result = await query(sql, params);
    return result.rows;
  }
};

const OptOutStore = {
  async create(data) {
    const result = await query(
      `INSERT INTO opt_outs (phone, email, facebook_id, tiktok_id, channel, reason, source)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [data.phone, data.email, data.facebook_id, data.tiktok_id,
       data.channel, data.reason, data.source || 'api']
    );
    return result.rows[0];
  },

  async check(phone, channel) {
    const result = await query(
      'SELECT * FROM opt_outs WHERE phone = $1 AND ($2 IS NULL OR channel = $2)',
      [phone, channel]
    );
    return result.rows;
  },

  async findAll(filters = {}) {
    let sql = 'SELECT * FROM opt_outs';
    const params = [];
    if (filters.limit) { sql += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`; params.push(filters.limit); }
    else sql += ' ORDER BY created_at DESC';
    const result = await query(sql, params);
    return result.rows;
  }
};

const ChannelStore = {
  async findAll() {
    const result = await query('SELECT * FROM channel_status ORDER BY channel');
    return result.rows;
  },

  async update(channel, data) {
    const result = await query(
      `UPDATE channel_status SET status = $2, status_message = $3, last_checked_at = NOW(), error_count = $4
       WHERE channel = $1 RETURNING *`,
      [channel, data.status, data.status_message, data.error_count || 0]
    );
    return result.rows[0];
  }
};

const CompanyStore = {
  async findAll(filters = {}) {
    let sql = 'SELECT * FROM companies';
    const params = [];
    if (filters.limit) { sql += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`; params.push(filters.limit); }
    else sql += ' ORDER BY created_at DESC';
    const result = await query(sql, params);
    return result.rows;
  },

  async findById(id) {
    const result = await query('SELECT * FROM companies WHERE id = $1', [id]);
    return result.rows[0] || null;
  },

  async create(data) {
    const result = await query(
      `INSERT INTO companies (id, name, domain, industry)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [data.id, data.name, data.domain, data.industry]
    );
    return result.rows[0];
  },

  async update(id, data) {
    const fields = [];
    const params = [];
    let idx = 1;
    for (const [key, value] of Object.entries(data)) {
      if (key === 'id') continue;
      fields.push(`${key} = $${idx++}`);
      params.push(value);
    }
    params.push(id);
    const result = await query(
      `UPDATE companies SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`, params
    );
    return result.rows[0] || null;
  }
};

module.exports = {
  initPgStore, CampaignStore, LeadStore, ScoreStore, OptOutStore, ChannelStore, CompanyStore
};
