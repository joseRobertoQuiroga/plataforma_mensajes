# API Endpoints Reference (RAG-optimized)

## Helper Node (http://helper:3100)
### Legacy Endpoints (v1 - backward compat)
| Method | Path | Purpose |
|--------|------|---------|
| GET | /health | Health check (reports db type) |
| POST | /campaigns | Create campaign (legacy) |
| GET | /campaigns | List all campaigns |
| GET | /campaigns/pending | Get campaigns pending execution |
| POST | /campaigns/:id/schedule | Schedule campaign |
| POST | /campaigns/:id/complete | Mark campaign completed |
| POST | /campaigns/track | Track delivery status |
| GET | /campaigns/:id/stats | Campaign stats with deliveries |
| GET | /webhooks/whatsapp | Meta webhook verification |
| POST | /webhooks/whatsapp | Meta webhook notifications |
| POST | /opt-outs | Register opt-out |
| GET | /opt-outs/check | Check if phone opted out |

### New API v2 (/api/*)
| Method | Path | Purpose |
|--------|------|---------|
| GET | /api/dashboard/summary | Dashboard summary (campaigns, deliveries, leads, channels) |
| POST | /api/campaigns | Create multi-channel campaign |
| GET | /api/campaigns | List campaigns (filter: status, channel, limit, offset) |
| GET | /api/campaigns/pending | Get campaigns pending execution (scheduled) |
| GET | /api/campaigns/:id | Get campaign by ID |
| PATCH | /api/campaigns/:id | Update campaign fields |
| POST | /api/campaigns/:id/schedule | Schedule campaign |
| POST | /api/campaigns/:id/start | Start campaign (→ sending) |
| POST | /api/campaigns/:id/pause | Pause campaign |
| POST | /api/campaigns/:id/complete | Complete campaign |
| DELETE | /api/campaigns/:id | Delete campaign |
| POST | /api/campaigns/:id/leads | Add leads to campaign |
| GET | /api/campaigns/:id/leads | List leads in campaign (filter: status) |
| POST | /api/campaigns/track | Track delivery status per contact |
| GET | /api/campaigns/:id/stats | Campaign detailed stats with deliveries |
| POST | /api/leads/score | Record lead score (0-100 with factors) |
| GET | /api/leads/:id/scores | Score history for a lead |
| GET | /api/leads/top | Top leads by score (filter: min_score, limit) |
| GET | /api/channels | List all channel statuses (LED indicators) |
| PATCH | /api/channels/:channel | Update channel status |
| POST | /api/opt-outs | Register opt-out (phone/email/channel) |
| GET | /api/opt-outs/check | Check if phone/email opted out |
| GET | /api/twenty/health | Check Twenty CRM connection status |
| POST | /api/twenty/sync | Sync individual lead to Twenty (upsert by phone) |
| POST | /api/twenty/sync-all | Sync all leads to Twenty (batch) |
| POST | /api/chatwoot/normalize | Normalize Chatwoot webhook payload |

### Upload & Templates
| Method | Path | Purpose |
|--------|------|---------|
| POST | /api/campaigns/:id/leads/upload | Upload Excel/CSV leads file (multipart, field: file). Auto-detect phone/name/email. Extra columns → custom_fields |
| GET | /api/templates | List message templates (filter: channel, category) |
| POST | /api/templates | Create new template |
| DELETE | /api/templates/:id | Delete template |
| POST | /api/templates/preview | Preview template (replaces {{name}}, {{phone}}) |

### Scoring
| Method | Path | Purpose |
|--------|------|---------|
| GET | /api/scoring/rules | Get scoring config (weights, thresholds, rules) |
| PUT | /api/scoring/rules | Update scoring config |
| POST | /api/scoring/evaluate | Evaluate score for a lead (body: {lead_id}) |
| POST | /api/scoring/evaluate-all | Evaluate scores for all leads |

### Conversation State (MVP-02)
| Method | Path | Purpose |
|--------|------|---------|
| POST | /api/conversations/:tenantId/:conversationId | Create conversation state (body: {metadata?}) |
| GET | /api/conversations/:tenantId/:conversationId | Get conversation current state |
| PUT | /api/conversations/:tenantId/:conversationId/state | Transition state (body: {state, reason?}) |
| GET | /api/conversations/states | List all valid states, transitions, labels |
| GET | /api/conversations/:tenantId | List active conversations for tenant |
| DELETE | /api/conversations/:tenantId/:conversationId | Delete conversation state |

### Lead Profile (MVP-03)
| Method | Path | Purpose |
|--------|------|---------|
| GET | /api/leads/:id/profile | Full lead profile: delivery stats, score history, tags, next action |

### Agent Config (MVP-04)
| Method | Path | Purpose |
|--------|------|---------|
| GET | /api/agent/config | Get agent config (business name, products, personality, etc.) |
| PUT | /api/agent/config | Update agent config (body: {business_name?, business_type?, products?, etc.}) |
| GET | /api/agent/config/system-prompt | Generate system prompt from current config |
| GET | /api/agent/business-types | List all 10 business types with labels and keywords |
| GET | /api/agent/personalities | List all 5 personality types with instructions |

### Knowledge Base / RAG (MVP-05)
| Method | Path | Purpose |
|--------|------|---------|
| GET | /api/knowledge-base/health | Check Weaviate availability and fallback mode |
| GET | /api/knowledge-base/documents | List knowledge documents for tenant |
| POST | /api/knowledge-base/documents | Add document (body: {title, content, source?, tags?}) |
| POST | /api/knowledge-base/query | Query knowledge base (body: {query, limit?}) |
| DELETE | /api/knowledge-base/documents/:id | Delete document |

### SLI/SLO Monitoring
| Method | Path | Purpose |
|--------|------|---------|
| GET | /api/sli/metrics | Detailed SLI metrics: uptime, error rate, avg latency, today's stats |

### OpenRouter LLM
| Method | Path | Purpose |
|--------|------|---------|
| GET | /api/llm/health | Check LLM configuration status |
| POST | /api/llm/chat | Chat completion test (body: {messages, model?, temperature?, max_tokens?}). Supports sanitizer auto-block. |
| POST | /api/scoring/evaluate-llm | LLM-based lead scoring via OpenRouter (body: {lead_id}) |

### Seed Data
| Method | Path | Purpose |
|--------|------|---------|
| POST | /api/seed | Populate: 3 campaigns, 12 leads, 12 deliveries, 12 scores, 5 channels |
| DELETE | /api/seed | Clear all seed data |

## Dify Console API (http://dify-api:5001/console/api/)
Requires cookie auth (access_token + csrf_token + X-CSRF-TOKEN header)

| Method | Path | Purpose |
|--------|------|---------|
| POST | /login | Login (body: email, password Base64) |
| GET | /init | Check if Dify is initialized |
| GET | /apps | List apps |
| POST | /apps | Create app |
| POST | /apps/:id/api-keys | Generate API key |
| POST | /workspaces/current/plugin/install/marketplace | Install marketplace plugin |
| GET | /workspaces/current/plugin/providers | List model providers |
| GET | /workspaces/current/model-providers | List model providers + models |

## Dify Public API (http://dify-api:5001/api/)
Requires Bearer token (app API key)

| Method | Path | Purpose |
|--------|------|---------|
| POST | /workflows/run | Execute workflow |
| POST | /workflows/logs | Get workflow logs |
| GET | /info | App info |
| POST | /messages/:id/feedbacks | Submit feedback |

## n8n REST API (http://n8n:5678/rest/)
Requires n8n-auth cookie from login

| Method | Path | Purpose |
|--------|------|---------|
| POST | /login | Login (emailOrLdapLoginId, password) |
| POST | /owner/setup | Create owner account |
| GET | /workflows | List workflows |
| POST | /workflows | Import workflow |
| DELETE | /workflows/:id | Delete workflow |
| POST | /workflows/:id/activate | Activate workflow |
| POST | /credentials | Create credential |
| GET | /credentials | List credentials |

## Chatwoot API (http://chatwoot:3000/api/v1/)
Requires api_access_token header

| Method | Path | Purpose |
|--------|------|---------|
| POST | /accounts/:id/webhooks | Create webhook |
| GET | /accounts/:id/webhooks | List webhooks |
| POST | /accounts/:id/inboxes | Create inbox |
| POST | /accounts/:id/conversations/:id/messages | Send message |
| POST | /profile/reset_access_token | Regenerate API key |

## Twenty CRM (http://twenty-server:3000)
GraphQL endpoint: POST /graphql (requires Bearer token)

## xAI API (https://api.x.ai/v1)
| Method | Path | Purpose |
|--------|------|---------|
| POST | /chat/completions | Chat completions |
| GET | /models | List available models |

## Plugin Daemon (http://plugin-daemon:5002)
Requires X-Api-Key header with PLUGIN_DAEMON_KEY

| Method | Path | Purpose |
|--------|------|---------|
| GET | /api/plugins | List plugins |
| POST | /api/plugins/install | Install plugin from file |
| POST | /api/plugins/uninstall | Uninstall plugin |
