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
- `whatsapp-lead-classifier.yml`: Clasificador de leads WhatsApp
  - Usa modelo `gpt-4o-mini` (pendiente de migrar a xAI Grok)
  - Pendiente de importar a Dify

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
- ✅ Servicios funcionando
- ✅ Plugin openai_api_compatible instalado
- ✅ Provider visible con modelos compatibles
- ✅ Marketplace redirect funcional
- ✅ **OpenRouter configurado** — reemplaza xAI Grok
- ✅ LLM scoring endpoint en helper-node (`POST /api/scoring/evaluate-llm`)
- ✅ Chat completion test endpoint (`POST /api/llm/chat`)
- ⬜ Workflow lead classifier: pendiente de importar/migrar a OpenRouter
