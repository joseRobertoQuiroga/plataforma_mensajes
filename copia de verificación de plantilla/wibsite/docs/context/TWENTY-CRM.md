# Contexto: Twenty CRM

## Propósito
Twenty CRM es el sistema de gestión de relaciones con clientes. Almacena leads, contactos, y empresas. Se integra con helper-node para sync de leads y con n8n para workflows de inbound message.

## Configuración
- **Puerto**: 3001 (mapeado a 3000 interno)
- **Base de datos**: PostgreSQL, database `twenty`
- **URL REST API**: http://twenty-server:3000/rest/ (traduce a GraphQL internamente)
- **URL GraphQL**: http://twenty-server:3000/graphql

## Secretos (generados en .env)
- ACCESS_TOKEN_SECRET, LOGIN_TOKEN_SECRET, REFRESH_TOKEN_SECRET, FILE_TOKEN_SECRET
- ENCRYPTION_KEY

## API Key (configurada)
- **Estado**: ✅ Configurada y funcional
- **Tipo**: JWT generado desde Settings > API > Create API Key en Twenty UI
- **Ubicación**: `.env` como `TWENTY_API_KEY`, usada por helper-node
- **Verificación**: `GET /api/twenty/health` → `{connected: true, hasApiKey: true}`
- **Formato respuesta REST**: GraphQL-wrapped — `response.data.data.createPerson`, `response.data.data.updatePerson`, `response.data.data.people`

## Custom Fields (10 campos en people)
Creados vía `POST /rest/metadata/fields` con object `people`:
- `painPoints` (TEXT) — Puntos de dolor del lead
- `interests` (TEXT) — Intereses del lead
- `scoreHistory` (TEXT) — Historial de scores (JSON string)
- `lastScore` (NUMBER) — Último score calculado
- `leadSource` (TEXT) — Fuente/origen del lead
- `customFields` (TEXT) — Datos personalizados extra (JSON string)
- `leadScoreHistory` (TEXT) — Alternativa con prefijo (evita conflicto namespace)
- `leadLastScore` (NUMBER) — Alternativa con prefijo
- `leadOrigin` (TEXT) — Origen del lead con prefijo
- `leadCustomData` (TEXT) — Datos custom con prefijo

**⚠️ Twenty usa namespace GLOBAL** para nombres de campo. `scoreHistory` puede conflictuar con otros objetos. Solución: prefijar con `lead` los nombres comunes. `painPoints` e `interests` se mantienen sin prefijo.

## Integraciones
- **Helper-node sync**: `POST /api/twenty/sync` — upsert individual por teléfono. Normaliza teléfonos con `+`. Guarda `contact_id` (Twenty ID) en lead local.
- **Helper-node sync-all**: `POST /api/twenty/sync-all` — batch sync de todos los leads. 12/12 sincronizados exitosamente.
- n8n: Crear/actualizar leads desde workflows de inbound message (pendiente — requiere Meta)
- n8n: Consultar contactos para campañas broadcast

## Estado Actual
- ✅ Servicio funcionando
- ✅ API key JWT configurada y funcional
- ✅ 10 campos custom creados en people (painPoints, interests, scoreHistory, lastScore, leadSource, customFields, leadScoreHistory, leadLastScore, leadOrigin, leadCustomData)
- ✅ Sync endpoints funcionales (individual + batch)
- ✅ Normalización de teléfonos (+ prefix)
- ❌ Configuración inicial de workspace: pendiente (requiere UI manual si se resetea)
