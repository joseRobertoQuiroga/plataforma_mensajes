-- Wibsite Business — Conversation Summaries Schema (F-14 Checkpointer)
-- Memoria larga por conversación: resumen acumulado por turno, TTL 7d gestionado por checkpointer/diario

CREATE TABLE IF NOT EXISTS conversation_summaries (
    id BIGSERIAL PRIMARY KEY,
    tenant_id VARCHAR(100) NOT NULL DEFAULT 'default',
    conversation_id VARCHAR(255) NOT NULL,
    template_id VARCHAR(100),
    machine_state VARCHAR(50) NOT NULL DEFAULT 'greeting',
    commercial_state VARCHAR(50),
    score NUMERIC(5,2),
    autonomy_zone VARCHAR(10) DEFAULT 'green',
    lead_extract JSONB DEFAULT '{}',
    topics TEXT[] DEFAULT '{}',
    objections_log JSONB DEFAULT '[]',
    turn_count INT NOT NULL DEFAULT 0,
    summary TEXT,
    version INT NOT NULL DEFAULT 1,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_conversation_summaries UNIQUE (tenant_id, conversation_id)
);

CREATE INDEX IF NOT EXISTS idx_conversation_summaries_tenant_updated ON conversation_summaries(tenant_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversation_summaries_tenant_state ON conversation_summaries(tenant_id, machine_state);