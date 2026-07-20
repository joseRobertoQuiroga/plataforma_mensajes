-- Wibsite Business — Campaign Management Schema
-- Migration for PostgreSQL (run via helper-node or manually)
-- Creates tables for multi-channel campaigns, leads, scoring, and tracking

-- ─── Campaigns ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    channel VARCHAR(50) NOT NULL DEFAULT 'whatsapp',
        -- 'whatsapp', 'messenger', 'tiktok', 'sms', 'email'
    message_template TEXT,
    template_name VARCHAR(255),
    audience_filter JSONB DEFAULT '{}',
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
        -- 'draft', 'scheduled', 'sending', 'active', 'paused', 'completed', 'cancelled', 'failed'
    scheduled_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    sent_count INT DEFAULT 0,
    delivered_count INT DEFAULT 0,
    read_count INT DEFAULT 0,
    replied_count INT DEFAULT 0,
    failed_count INT DEFAULT 0,
    opt_out_count INT DEFAULT 0,
    created_by VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Campaign Leads (destinatarios) ─────────────────────
CREATE TABLE IF NOT EXISTS campaign_leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    contact_id VARCHAR(255),
    -- Lead info (denormalized from CRM for snapshot consistency)
    name VARCHAR(255),
    phone VARCHAR(50),
    email VARCHAR(255),
    facebook_id VARCHAR(255),
    tiktok_id VARCHAR(255),
    custom_fields JSONB DEFAULT '{}',
    -- Delivery tracking
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
        -- 'pending', 'queued', 'sent', 'delivered', 'read', 'replied', 'failed', 'opted_out'
    message_id VARCHAR(255),
    channel_message_id VARCHAR(255),
    error_message TEXT,
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ,
    replied_at TIMESTAMPTZ,
    -- Scoring
    score INT DEFAULT 0,
        -- Lead score 0-100 calculated by AI
    score_data JSONB DEFAULT '{}',
        -- { interest_level, intent, budget_range, urgency, ... }
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Lead Scoring History ──────────────────────────────
CREATE TABLE IF NOT EXISTS lead_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES campaign_leads(id) ON DELETE CASCADE,
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    score INT NOT NULL DEFAULT 0,
    score_factors JSONB DEFAULT '{}',
        -- { message_response, engagement_time, click_through, intent_signals, ... }
    score_model VARCHAR(50) DEFAULT 'rule-based',
        -- 'rule-based', 'ai-weighted', 'hybrid'
    classified_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    notes TEXT
);

-- ─── Channel Status (LED indicators) ────────────────────
CREATE TABLE IF NOT EXISTS channel_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel VARCHAR(50) NOT NULL UNIQUE,
        -- 'whatsapp', 'messenger', 'tiktok', 'sms', 'email'
    status VARCHAR(20) NOT NULL DEFAULT 'disconnected',
        -- 'connected', 'disconnected', 'error', 'limited', 'pending'
    status_message TEXT,
    last_checked_at TIMESTAMPTZ DEFAULT NOW(),
    error_count INT DEFAULT 0,
    last_error_at TIMESTAMPTZ,
    rate_limit_remaining INT,
    rate_limit_reset_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Opt-Out Registry ──────────────────────────────────
CREATE TABLE IF NOT EXISTS opt_outs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone VARCHAR(50),
    email VARCHAR(255),
    facebook_id VARCHAR(255),
    tiktok_id VARCHAR(255),
    channel VARCHAR(50),
    reason TEXT,
    source VARCHAR(50),
        -- 'user_reply', 'api', 'admin'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Workflow Logs ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS workflow_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_name VARCHAR(255),
    source VARCHAR(50),
        -- 'n8n', 'dify', 'helper', 'chatwoot'
    event_type VARCHAR(50),
        -- 'inbound_message', 'campaign_sent', 'lead_updated', 'error', 'webhook_received'
    payload JSONB DEFAULT '{}',
    status VARCHAR(20) DEFAULT 'success',
        -- 'success', 'error', 'warning'
    error_details TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Indexes ───────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_campaign_status ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaign_scheduled ON campaigns(scheduled_at) WHERE status = 'scheduled';
CREATE INDEX IF NOT EXISTS idx_campaign_leads_campaign ON campaign_leads(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_leads_status ON campaign_leads(status);
CREATE INDEX IF NOT EXISTS idx_campaign_leads_phone ON campaign_leads(phone);
CREATE INDEX IF NOT EXISTS idx_lead_scores_lead ON lead_scores(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_scores_score ON lead_scores(score);
CREATE INDEX IF NOT EXISTS idx_opt_outs_phone ON opt_outs(phone);
CREATE INDEX IF NOT EXISTS idx_workflow_logs_source ON workflow_logs(source, created_at DESC);

-- ─── Seed channel_status with default channels ─────────
INSERT INTO channel_status (channel, status) VALUES
    ('whatsapp', 'pending'),
    ('messenger', 'disconnected'),
    ('tiktok', 'disconnected'),
    ('sms', 'disconnected'),
    ('email', 'disconnected')
ON CONFLICT (channel) DO NOTHING;

-- ─── Updated_at trigger ────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_campaigns_updated_at') THEN
        CREATE TRIGGER update_campaigns_updated_at
            BEFORE UPDATE ON campaigns
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_campaign_leads_updated_at') THEN
        CREATE TRIGGER update_campaign_leads_updated_at
            BEFORE UPDATE ON campaign_leads
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_channel_status_updated_at') THEN
        CREATE TRIGGER update_channel_status_updated_at
            BEFORE UPDATE ON channel_status
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END;
$$;
