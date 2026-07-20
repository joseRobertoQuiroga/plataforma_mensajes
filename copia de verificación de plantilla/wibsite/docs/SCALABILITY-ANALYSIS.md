# Análisis de Escalabilidad — Wibsite Business v2.1.1

> Evaluación de la arquitectura actual, propuesta de Gateway/SSO y
> alternativas para escalar de vertical a horizontal multi-tenant.

---

## 1. Estado Actual: Escalabilidad Vertical

```
┌─────────────────────────────────────────────────┐
│               SINGLE HOST (1 máquina)            │
│                                                   │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ │
│  │ nginx │ │helper│ │ n8n  │ │dify  │ │chat  │ │
│  │:8080 │ │:3100 │ │:5679 │ │:5001 │ │:3002 │ │
│  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘ │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ │
│  │twenty│ │PG    │ │redis │ │weav  │ │plugin│ │
│  │:3001 │ │:5432 │ │:6379 │ │:8080 │ │:5002 │ │
│  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘ │
│                                                   │
│  Límites: CPU, RAM, disco del host               │
│  1 réplica por servicio = sin HA                 │
└─────────────────────────────────────────────────┘
```

### Síntomas de límite vertical
- Si n8n procesa 1000 workflows/min, consume CPU que Dify necesita
- Si helper-node usa mucha RAM para scoring batch, Chatwoot se ralentiza
- Caída de un servicio = caída de todos (no hay replicación)
- Para escalar: migrar a máquina más grande (costo exponencial)

---

## 2. Propuesta: Gateway + Escalabilidad Horizontal

```
                        ┌──────────────┐
                        │  Load        │
                        │  Balancer    │
                        │  (HW/Cloud)  │
                        └──────┬───────┘
                               │
                    ┌──────────┴──────────┐
                    │                     │
             ┌──────▼──────┐     ┌───────▼───────┐
             │  API GATEWAY │     │  API GATEWAY  │
             │  (réplica 1) │     │  (réplica 2)  │
             │  JWT + Rate  │     │  JWT + Rate   │
             │  + Audit     │     │  + Audit      │
             └──────┬──────┘     └───────┬───────┘
                    │                     │
    ┌───────────────┼─────────────────────┼───────────────┐
    │               │                     │               │
┌───▼────┐   ┌─────▼────┐   ┌─────▼────┐   ┌─────▼────┐  │
│Helper  │   │ Helper   │   │  n8n     │   │  Dify    │  │
│:3100-1 │   │ :3100-2  │   │ :5679-1  │   │ :5001-1  │  │
│(leads) │   │(scoring) │   │(worker1) │   │(worker1) │  │
└───┬────┘   └─────┬────┘   └─────┬────┘   └─────┬────┘  │
    │              │              │              │       │
    └──────────────┴──────────────┴──────────────┘       │
                         │                               │
                   ┌─────▼─────┐                   ┌─────▼─────┐
                   │ PostgreSQL│                   │  Redis    │
                   │ (cluster) │                   │ (cluster) │
                   └───────────┘                   └───────────┘
```

---

## 3. Comparación de Soluciones para Gateway/SSO

| Solución | Tipo | SSO | Multi-tenant | Rate Limit | Audit | Complejidad |
|----------|------|-----|--------------|------------|-------|-------------|
| **Helper extendido** | Propio | ✅ JWT | ✅ org_id | ✅ Simple | ✅ Básico | 🟢 Baja |
| **Kong Gateway** | Contenedor | ✅ Plugin | ✅ Plugin | ✅ Nativo | ✅ Nativo | 🟡 Media |
| **OAuth2 Proxy** | Contenedor | ✅ Google/GitHub | ❌ No | ❌ No | ❌ No | 🟢 Baja |
| **Keycloak** | Contenedor | ✅ SAML/OIDC | ✅ Realms | ✅ Extensión | ✅ Nativo | 🔴 Alta |
| **Nginx + Lua** | Script | ❌ Manual | ❌ Manual | ✅ lua-resty | ❌ Manual | 🔴 Alta |
| **Traefik + forwardAuth** | Contenedor | ✅ Middleware | ✅ Etiquetas | ✅ RateLimit | ❌ No | 🟡 Media |

### Recomendación: Helper extendido (fase inicial) → Kong (fase producción)

**Helper extendido** es la mejor opción para **ahora** porque:
- Misma base de código — no agrega otro contenedor
- Acceso directo al JSON store / PostgreSQL
- JWT + rate limiting + audit en <500 líneas de código
- Flexible para cambios rápidos

**Kong Gateway** es la mejor opción para **producción SaaS** porque:
- Rate limiting nativo (por IP, por key, por tenant)
- Plugin ecosystem (JWT, OAuth2, ACL, IP restriction)
- Alto rendimiento (OpenResty, miles de req/s)
- Separación de concerns (Gateway no tiene lógica de negocio)

### El Gateway NO es la única solución

| Alternativa | Pros | Contras |
|-------------|------|---------|
| **API Gateway** | Control central, seguridad, audit | Punto único de falla (HA lo resuelve) |
| **Service Mesh (Istio/Linkerd)** | Sidecar por servicio, mTLS | Complejidad alta, overhead |
| **Auth0/Firebase Auth** | SSO externalizado, MFA | Costo recurrente, dependencia cloud |
| **VPN + IP Whitelist** | Simple, sin código | No escala multi-cuenta |

---

## 4. Gateway Helper: Arquitectura Propuesta (Implementación Inmediata)

```
helper-node/
├── index.js                    # App principal (existente)
├── middlewares/
│   ├── auth.js                 # JWT verification (NUEVO)
│   ├── rateLimit.js            # In-memory rate limiter (NUEVO)
│   └── audit.js                # Request logger (NUEVO)
├── routes/
│   ├── auth.js                 # /api/auth/register, /login, /refresh (NUEVO)
│   ├── admin.js                # User management (NUEVO)
│   ├── campaigns.js            # Refactor de rutas existentes
│   ├── leads.js                # Refactor de rutas existentes
│   ├── scoring.js              # Refactor de rutas existentes
│   └── templates.js            # Refactor de rutas existentes
└── public/
    └── index.html              # Dashboard (existente)
```

### Middleware `auth.js` — Funcionamiento

```javascript
// 1. Extraer JWT del header Authorization
const token = req.headers.authorization?.split(' ')[1];
// 2. Verificar firma + expiry
const decoded = jwt.verify(token, AUTH_SECRET);
// 3. Adjuntar usuario al request
req.user = decoded;
// 4. Propagar a servicios downstream
//    (X-User-Id, X-Org-Id en headers)
next();
```

### Post-migración: Flujo SSO completo

```
1. POST /api/auth/register
   → Crea user + organization en PostgreSQL
   → Retorna JWT

2. POST /api/auth/login
   → Verifica credentials
   → Retorna JWT (access 15min + refresh 7d)

3. Todas las rutas protegidas:
   Authorization: Bearer <jwt>
   → Gateway valida en middleware

4. Al acceder a otros módulos (Dify, n8n):
   → Gateway genera SSO token o propaga JWT
   → Cada módulo confía en el Gateway
```

---

## 5. Multi-Tenant: Datos por Organización

### Modelo Actual (sin tenant)

```
campaigns: [ { id, name, ... } ]        ← todos los usuarios ven todo
leads:     [ { id, campaign_id, ... } ]  ← sin aislamiento
```

### Modelo Multi-Tenant (con organization_id)

```sql
campaigns (organization_id UUID NOT NULL)
leads     (organization_id UUID NOT NULL)
deliveries(organization_id UUID NOT NULL)
scores    (organization_id UUID NOT NULL)
```

**En JSON store**: agregar `org_id` a cada registro. `getStore()` filtra por `org_id` del JWT.
**En PostgreSQL**: `organization_id FK + RLS` ya implementado en schema Lumi.

---

## 6. Resumen de Decisión

| Aspecto | Decisión | Justificación |
|---------|----------|---------------|
| **Gateway** | Helper extendido (fase 1) → Kong (producción) | Menor complejidad ahora, migración directa después |
| **Auth** | JWT (HS256) + refresh tokens | Simple, stateless, sin dependencias externas |
| **Multi-tenant** | `org_id` en toda entidad + filtro store | Consistente con schema Lumi PostgreSQL |
| **Rate Limit** | In-memory con Map<userId, count[]> | Suficiente para <1000 usuarios. Redis si escala |
| **Escalado** | Gateway stateless → N réplicas detrás de balanceador | Sin estado = escalado horizontal trivial |

**Próximo paso**: Implementar `middlewares/auth.js` + `routes/auth.js` en helper-node (estimado ~4h).
