# Wibsite Business — Memoria del Proyecto (ADR)

## ADR-001: Uso de JSON File Store en helper-node
**Fecha**: 2026-07-09  
**Contexto**: Necesitábamos un almacenamiento simple para campañas y tracking sin agregar otra base de datos al stack.  
**Decisión**: Usar archivo JSON (`wibsite-store.json`) como store del helper-node.  
**Consecuencias**: Simple, portable, pero no escalable a alto volumen. Para producción se migrará a PostgreSQL.  
**Alternativas consideradas**: SQLite, Redis, PostgreSQL directo.

## ADR-002: Plugin-daemon v0.6.3-local con marketplace público
**Fecha**: 2026-07-09  
**Contexto**: Dify 1.15.x requiere plugin-daemon para todos los modelos. El marketplace privado no respondía.  
**Decisión**: Usar `dify-plugin-daemon:0.6.3-local` con `NEXT_PUBLIC_MARKETPLACE_API_PREFIX=https://marketplace.dify.ai/api` para redirigir al marketplace oficial.  
**Consecuencias**: Los plugins se instalan desde marketplace público. No podemos tener plugins privados sin un marketplace propio.  
**Prueba**: Plugin `openai_api_compatible` instalado exitosamente vía `POST /console/api/workspaces/current/plugin/install/marketplace`.

## ADR-003: n8n como orquestador de flujos
**Fecha**: 2026-07-09  
**Contexto**: Necesitábamos un orquestador visual para conectar Chatwoot → Dify → Twenty CRM.  
**Decisión**: n8n con autenticación por cookie (`emailOrLdapLoginId`), workflows importados desde archivos JSON.  
**Consecuencias**: Flujos visuales fáciles de mantener. Dependencia de n8n para la comunicación entre servicios.  
**Credenciales**: admin@wibsite.com / Admin@123

## ADR-004: Provider openai_api_compatible para modelos externos
**Fecha**: 2026-07-09  
**Contexto**: Dify 1.15.x no tiene providers built-in. Necesitábamos conectar modelos externos (xAI Grok, OpenAI, etc.).  
**Decisión**: Usar plugin `langgenius/openai_api_compatible` como provider universal para modelos compatibles con API OpenAI.  
**Consecuencias**: Cualquier LLM con API compatible con OpenAI puede conectarse. La validación del modelo hace una llamada real a la API.  
**Instalación**: `POST /console/api/workspaces/current/plugin/install/marketplace` con `{"plugin_unique_identifiers": ["langgenius/openai_api_compatible:0.0.55@d64be9924f2edf13fd5329fc03fdfc0d0e0e36e0aef5321c4942f0845de8c030"]}`

## ADR-005: Formato de plugin_unique_identifier
**Fecha**: 2026-07-09  
**Contexto**: La instalación de plugins requiere un identificador único. El formato no estaba documentado claramente.  
**Decisión**: El formato es `{org}/{name}:{version}@{hash}` (ej: `langgenius/openai_api_compatible:0.0.55@d64be...`).  
**Consecuencias**: El hash se obtiene del marketplace API. La versión es requerida. Sin hash falla con error "checksum failed".  
**Fuente**: Descubierto por prueba y error con la API de marketplace.

## ADR-006: Autenticación Dify Console API
**Fecha**: 2026-07-09  
**Contexto**: Dify 1.15.x usa autenticación por cookie + CSRF token, no API keys tradicionales.  
**Decisión**: Login requiere email + password en Base64, respuesta incluye `access_token` (cookie) y `csrf_token` (cookie + header X-CSRF-TOKEN).  
**Consecuencias**: Las requests a `/console/api/*` requieren ambas cookies y el header. Las requests a `/api/*` (públicas) usan API key de la app.

## ADR-007: Migración a PostgreSQL para helper-node
**Fecha**: 2026-07-10  
**Contexto**: El JSON file store (`wibsite-store.json`) no escala, no soporta consultas complejas, y puede corromperse con escrituras concurrentes.  
**Decisión**: Migrar a PostgreSQL con tabla `wibsite` y pool de conexiones, manteniendo JSON file store como fallback automático si PostgreSQL no está disponible.  
**Consecuencias**: El helper puede operar sin PostgreSQL (útil durante desarrollo). En producción se requiere PostgreSQL.  
**Schema**: campaigns, campaign_leads, lead_scores, channel_status, opt_outs, workflow_logs.

## ADR-008: Monitoreo con SPA estática (sin framework)
**Fecha**: 2026-07-10  
**Contexto**: Se necesita una interfaz de monitoreo de campañas con indicadores LED sin agregar otro servicio.  
**Decisión**: SPA en HTML/JS puro servido por helper-node desde `public/index.html`. Actualización vía `setInterval` a `/api/dashboard/summary`.  
**Consecuencias**: Sin dependencias externas. La UI se sirve directamente desde el helper. Limitado a monitoreo (no reemplaza una app completa).  
**Alternativas consideradas**: React SPA (mucho overhead), servicio separado (complejidad innecesaria).

## ADR-009: Endpoints versionados /api/ para nueva API
**Fecha**: 2026-07-10  
**Contexto**: helper-node v1 usaba endpoints sin prefijo (`/campaigns`, `/health`). La v2 introduce muchos endpoints nuevos.  
**Decisión**: Nuevos endpoints bajo `/api/*` (ej: `/api/campaigns`, `/api/channels`). Los endpoints legacy (`/campaigns`, `/webhooks/whatsapp`, `/health`) se mantienen sin cambios para no romper n8n workflows.  
**Consecuencias**: n8n workflows existentes siguen funcionando. La nueva API tiene naming consistente.

## ADR-010: Excel/CSV Upload con multer + xlsx
**Fecha**: 2026-07-10  
**Contexto**: Necesitábamos carga masiva de leads desde archivos Excel/CSV para campañas.  
**Decisión**: Usar `multer` para file upload y `xlsx` para parseo. Detección automática de columnas (phone, name, email — case-insensitive). Columnas no mapeadas van a `custom_fields` JSON. Duplicados detectados por campaña.  
**Consecuencias**: Soporta .xlsx, .xls, .csv. No requiere SQL directo. Reporte de created/errors/duplicates devuelto al cliente.  
**Prueba**: Archivo 5 filas → 5 creadas, 0 errores.

## ADR-011: Message Templates System
**Fecha**: 2026-07-10  
**Contexto**: Se necesita un sistema de plantillas de mensajes reutilizables para campañas multi-canal.  
**Decisión**: 11 plantillas pre-seedeadas por canal (WhatsApp, Messenger, TikTok, SMS, Email) con categorías (welcome, promotion, followup, notification, newsletter). Endpoints CRUD + preview.  
**Consecuencias**: Plantillas almacenadas en PostgreSQL con fallback a memoria (seed data). Preview reemplaza `{{name}}` y `{{phone}}`.  
**Alternativas**: Dify templates (demasiado complejo), n8n templates (no portable).

## ADR-012: Twenty CRM Custom Fields vía REST API
**Fecha**: 2026-07-10  
**Contexto**: Twenty CRM necesita campos custom para almacenar datos de scoring, pain points e intereses de leads.  
**Decisión**: Crear campos vía `POST /rest/metadata/fields` en objeto `people`. Twenty usa namespace GLOBAL para field names — `scoreHistory` conflicta con otros objetos. Solución: prefijar campos conflictivos con `lead` (`leadScoreHistory`, `leadLastScore`, `leadOrigin`, `leadCustomData`). `painPoints` e `interests` se mantienen sin prefijo por ser suficientemente únicos.  
**Consecuencias**: 10 campos creados en `people`. Si se agregan más objetos en Twenty que usen `painPoints` o `interests`, habrá conflicto.  
**Prueba**: Verificado con GET /rest/metadata/fields?object=people.

## ADR-013: Rule-Based Scoring Engine (sin LLM)
**Fecha**: 2026-07-10  
**Contexto**: Sin créditos de IA (xAI sin fondos), necesitábamos scoring de leads funcional.  
**Decisión**: Scoring con 5 factores ponderados (engagement 35%, recency 25%, channel affinity 15%, profile completeness 15%, interest match 10%) + 8 reglas condicionales (+20 reply, +10 open, +15 click, -100 opt-out, etc.). Umbrales configurables vía API.  
**Consecuencias**: Scoring funcional sin LLM. Configurable dinámicamente. Reemplazable por IA cuando haya créditos.  
**Prueba**: Lead con engagement=30, recency=100, channel=80, completeness=100, interest=60 → score 100 (hot) con 4 reglas aplicadas.

## ADR-014: Nginx Runtime DNS Resolution para Chatwoot
**Fecha**: 2026-07-10  
**Contexto**: Chatwoot entraba en reinicio continuo, causando que nginx fallara al arrancar con `host not found` en `proxy_pass`.  
**Decisión**: Agregar `resolver 127.0.0.11 valid=10s` a nivel server y usar `set $chatwoot_upstream "chatwoot:3000"` + `proxy_pass $chatwoot_upstream` (variable-based).  
**Consecuencias**: Nginx arranca aunque Chatwoot esté caído. La resolución DNS se hace en runtime cada 10s. Cuando Chatwoot se recupere, nginx lo detectará automáticamente.  
**Alternativas**: depends_on en docker-compose (no resuelve reinicio), healthcheck (no evita error de host).

## ADR-015: OpenRouter como Provider LLM (reemplazo de xAI Grok)
**Fecha**: 2026-07-10  
**Contexto**: xAI Grok sin créditos — no se podían probar funcionalidades que requieren LLM.  
**Decisión**: Usar OpenRouter (`https://openrouter.ai/api/v1`) con API key `sk-or-v1-...`. Configurado en Dify vía plugin `openai_api_compatible` y en helper-node vía axios directo. Modelo default: `openai/gpt-4o-mini` ($0.000004/llamada).  
**Consecuencias**: LLM funcional inmediatamente. Cualquier modelo disponible en OpenRouter puede usarse (GPT-4o, Claude, Gemini, Llama, etc.). El helper-node tiene endpoints directos para chat y scoring LLM.  
**Prueba**: `POST /api/llm/chat` responde correctamente. `POST /api/scoring/evaluate-llm` clasificó lead como "cold" con razonamiento válido.

## ADR-016: Gateway Unificado con Autenticación Central (Propuesta)
**Fecha**: 2026-07-10  
**Contexto**: Helper node no tiene ninguna capa de autenticación. Todos los endpoints son públicos: campañas CRUD, scoring, Twenty sync (expone API key de Twenty), LLM proxy (consume créditos OpenRouter), seed (borra datos). 6 de 11 servicios tienen su propio sistema de login — el usuario debe autenticarse en cada uno. Para escalar a multi-tenant y multi-cuenta se requiere autenticación centralizada.  
**Decisión Propuesta**: Implementar API Gateway con:
  - **Auth Service**: registro único, login JWT (access + refresh token), roles y permisos por organización
  - **Rate Limiter**: 100 req/min por usuario, 10 req/min en rutas críticas (/seed, /sync-all)
  - **Webhook Guard**: verificación HMAC/Signature en webhooks entrantes (Meta, TikTok)
  - **Proxy Router**: enrutamiento a helper/dify/n8n/chatwoot con headers de usuario autenticado (X-User-Id, X-Org-Id)
  - **Audit Logger**: registro de toda llamada API (usuario, ruta, timestamp, duración)
  - **RLS Propagation**: envía `app.current_org` a servicios PostgreSQL para Row Level Security
**Ubicación**: Extender helper-node con middleware JWT + rutas auth y admin, o contenedor Kong independiente.  
**Consecuencias**: Single sign-on para todos los módulos. Protege recursos críticos (LLM, Twenty, seed). Escalable horizontalmente (múltiples réplicas del gateway + balanceador). Requiere migración de JSON store a PostgreSQL con tenant_id.  
**Alternativas consideradas**: Kong Gateway (más robusto pero más overhead), oAuth2 Proxy (simple pero limita control), Keycloak (pesado, ideal para SaaS grande).

## ADR-017: Corrección de Bugs Críticos Post-Auditoría
**Fecha**: 2026-07-10  
**Contexto**: Auditoría de código encontró 2 bugs críticos y 1 de alta gravedad luego de la implementación inicial v2.1.0.  
**Decisión**: Corrección inmediata:
  1. **`existing` is not defined** (Crítico): `POST /api/twenty/sync` línea 783 referenciaba variable `existing` que fue renombrada a `existingPerson` en refactorización. Causaba 500 en cada sync exitoso.
  2. **Seed race condition** (Crítico): `POST /api/seed` mutaba arrays directamente (`store.leads.push()` sin lock) y llamaba `saveStore()` directo. Reemplazado por `updateStore()` para escritura atómica.
  3. **Duplicate campaign names** (Alto): ambos endpoints de creación permitían nombres duplicados. Agregado check con 409 Conflict.
**Consecuencias**: JSON store tiene escritura atómica protegida por lock en todas las rutas de mutación.  
**Verificación**: `node --check` pasa sin errores. Prueba de sintaxis OK.
