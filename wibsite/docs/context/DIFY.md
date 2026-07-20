# Contexto: Dify

## Propósito
Dify es la plataforma de orquestación de IA. Alberga workflows de clasificación de leads, generación de contenido y agentes conversationales.

## Versión
1.15.x — Sistema **solo plugins** (no hay providers built-in auto-registrados).

## Componentes
- **dify-api**: API principal (puerto 5001)
- **dify-web**: UI web (puerto 3003)
- **dify-worker**: Procesamiento asíncrono
- **plugin-daemon**: Gestión de plugins de modelos (puerto 5002, imagen 0.6.3-local)

## Autenticación (Console API)
- `POST /console/api/login` con email + password en Base64
- Response: cookies `access_token` + `csrf_token`
- Requests requieren: cookies + header `X-CSRF-TOKEN`

## Autenticación (Public API)
- API Key por app (ej: `app-IohwPPX3HDWA46TQLEcGBZq0`)
- Header: `Authorization: Bearer {api_key}`

## Plugin System
- **Plugin instalado**: `langgenius/openai_api_compatible:0.0.55`
- **Provider visible**: `langgenius/openai_api_compatible/openai_api_compatible`
- **Soporta**: llm, rerank, text-embedding, speech2text, tts
- **Instalación**: `POST /console/api/workspaces/current/plugin/install/marketplace`
- **Identifier format**: `{org}/{name}:{version}@{hash}`
- **Marketplace URL**: `https://marketplace.dify.ai/api`
- **Plugin-daemon auth**: Header `X-Api-Key` con valor de `PLUGIN_DAEMON_KEY`

## Claves Compartidas
- `PLUGIN_DAEMON_KEY`: Secreto compartido entre Dify API y plugin-daemon
- `INNER_API_KEY_FOR_PLUGIN`: Secreto compartido para comunicación interna

## Workflows

### WhatsApp Lead Classifier (FUNCIONAL ✅)
- **App ID**: `c7fdaa3c-d911-4cef-ae62-54bf206f2f78`
- **API Key**: `app-IohwPPX3HDWA46TQLEcGBZq0`
- **Modelo**: `openai/gpt-4o-mini` (vía OpenRouter)
- **Endpoint**: `POST /v1/workflows/run` (blocking mode)
- **Output**: `data.outputs.response_text` (JSON string con todos los campos)

### Nodos del Workflow (8 nodos LLM)
1. **Start** — Inputs: `message`, `conversation_history`, `contact_name`, `platform`
2. **detect_language** (LLM) — Detecta idioma del mensaje
3. **classify_intent** (LLM) — Clasifica intención (product_inquiry, purchase_intent, etc.)
4. **extract_contact_data** (LLM) — Extrae datos estructurados (name, email, phone, etc.)
5. **calculate_score** (LLM) — Calcula score basado en intención + datos extraídos
6. **generate_response** (LLM) — Genera respuesta sugerida
7. **assemble_result** (LLM) — Arma JSON final con todos los campos
8. **End** — Output único `response_text` con JSON completo

### Historia
- Originalmente tenía Code nodes Python (`calculate_score`, `assemble_result`)
- Los Code nodes fallaban: sintaxis `{{#node_id.text#}}` no se reemplazaba
- **ADR-018**: Reemplazados por LLM nodes que generan el mismo JSON
- **ADR-021**: Output simplificado a un solo campo `final_result`

## Datos del Admin
- **Email**: joserobertoquirogasalvador@gmail.com
- **Password**: Admin@123

## OpenRouter Configuration
OpenRouter reemplaza xAI Grok como provider LLM. Configurado vía `configure-openrouter.js`:
- **API Key**: `sk-or-v1-...` en `.env` como `OPENROUTER_API_KEY`
- **Endpoint**: `https://openrouter.ai/api/v1`
- **Plugin**: `langgenius/openai_api_compatible` (ya instalado)
- **Modelos registrados**: `openai/gpt-4o-mini`, `openai/gpt-4o`, `anthropic/claude-3.5-sonnet`, `google/gemini-2.0-flash`, `meta-llama/llama-3.3-70b-instruct`, `mistralai/mistral-large`, `cohere/command-r7b`
- **Modelo default**: `openai/gpt-4o-mini` (rápido, económico ~$0.000004/llamada)

## Estado Actual
- ✅ Servicios funcionando (api, web, worker, plugin-daemon, sandbox)
- ✅ Plugin openai_api_compatible instalado
- ✅ Provider visible con modelos compatibles
- ✅ Marketplace redirect funcional
- ✅ OpenRouter configurado y funcional (modelo default: `openai/gpt-4o-mini`)
- ✅ **Workflow "WhatsApp Lead Classifier" FUNCIONAL** (8 nodos LLM)
- ✅ Pruebas exitosas: WARM 73/100 (product_inquiry), HOT 88/100 (meeting_request)
- ✅ Dify Sandbox corriendo en puerto 8194 (no utilizado actualmente — Code nodes reemplazados)
- ✅ LLM scoring endpoint en helper-node (`POST /api/scoring/evaluate-llm`)
- ✅ Chat completion test endpoint (`POST /api/llm/chat`)
