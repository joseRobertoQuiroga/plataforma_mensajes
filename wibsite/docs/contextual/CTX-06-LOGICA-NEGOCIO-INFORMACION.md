# CTX-06 — Lógica de Negocio y Manejo de la Información del Negocio

> **Versión:** 1.0 | **Fecha:** Julio 2026 | **Tipo:** Contextual (QUÉ/POR QUÉ)
> **Fuentes consolidadas:** `BUSINESS-MASTER.md` (planes, KPIs, métricas de salud, proyección financiera), `DATA-MASTER.md` (principios, clasificación, retención, KPIs de datos), `esquema-config-plantilla.md` (confidencialidad), `SECURITY-MASTER.md` §13 (cumplimiento).
> **Ejecución técnica:** RAG-G8, G18 en [`../maestro/MAESTRO-FUNCIONALIDADES-CORE.md`](../maestro/MAESTRO-FUNCIONALIDADES-CORE.md) | [TEC-01 §4](../tecnica/TEC-01-ARQUITECTURA-INFRAESTRUCTURA.md)

---

## 1. Modelo de negocio: 4 planes SaaS (BUS §1)

| | **Demo** (gratis) | **Blue** ($29/mes) | **ProMax** ($79/mes) | **Enterprise** ($2.5k-10k licencia + $500-2k/mes) |
|---|---|---|---|---|
| Usuarios / Sucursales | 1 / 1 | 3 / 2 | 10 / 5 | Ilimitado |
| Leads / Conversaciones mes | 100 / 500 | 1.000 / 5.000 | 10.000 / 50.000 | Ilimitado |
| Campañas mes | 2 | 20 | 100 | Ilimitado |
| Contextos (tipos de negocio) | 1 fijo | 2 | 10 | Ilimitado |
| Knowledge Base | — | 10 docs / 50MB | 100 docs / 500MB + RAG | Ilimitado |
| Voz / Multi-agente / APIs | — / — / — | — / — / — | 100 min / 3 agentes / 3 APIs | Todo |
| Scoring | — | Rule-based | + IA | + IA |
| Soporte / SLA | — | Email 48h / 99.5% | Chat 24h / 99.9% | Dedicado 24/7 / 99.99% |
| Particularidades | Marca de agua, sin exportación, 14 días renovable 1 vez, datos retenidos 30d | Target PYME individual | Switcher de contexto multi-línea | Licencia perpetua + código fuente, on-premise, white-label, LDAP/SSO |
| Costo / Margen estimado | ~$0.50/mes* | ~$3/mes · ~90% | ~$12/mes · ~85% | ~$50-500/mes · 70-90% |

\* *Inconsistencia detectada en la fuente: BUS §1 dice ~$0.50/mes por tenant Demo y §7 dice ~$5/mes. Resolver en próxima revisión de BUSINESS-MASTER (ver TEC-04 §5).*

**Flujo de conversión Demo→pago:** email día 7 → email+notificación día 12 → bloqueo día 14 → datos retenidos 30 días.
**Punto de equilibrio (BUS §7):** costos fijos ~$150/mes → rentable desde el mes 1 con 5 clientes de pago (mezcla típica 20 Blue + 5 ProMax + 1 Enterprise ≈ $3.005/mes neto).

## 2. KPIs centrales del negocio (BUS §2) — filosofía "no ahogar en métricas"

| KPI | Fórmula | Meta | Alerta |
|---|---|---|---|
| **KPI-1** Conversión de leads | `cerrados / nuevos × 100` (pipeline: nuevo→calificado→oportunidad→propuesta→cerrado) | >15% global; >30% de calificado a cerrado | <5% por 7 días |
| **KPI-2** Efectividad de campañas | `delivery×0.3 + read×0.3 + reply×0.4` | >60 | <30 |
| **KPI-3** Eficiencia del agente IA | Auto-resolution rate + tiempo 1ª respuesta | >70% sin humano; <30s | <50% o >60s |
| **KPI-4** Costo operación por lead | `(llm + infra + voz) / leads` | <$0.01; LLM <60% del costo | >$0.05 |
| **KPI-5** Salud del pipeline | Score 0-100 por oportunidad (probabilidad, tiempo en etapa, actividad, interacciones) | >60 | <30 |
| **KPI-6** Satisfacción (CSAT) | Sentiment IA 40% + recompra 25% + uptime 20% + referidos 15% | >70 | <40 (riesgo churn) |

KPIs específicos por módulo (Inbox, CRM, IA Studio, Campañas, Llamadas, Configuración vs límites del plan) viven en BUS §3 — se muestran al navegar cada módulo, no en el dashboard principal.

## 3. Métricas de salud del agente (BUS §6)

**Cuadrante 2×2** (auto-resolución vs costo): SALUDABLE (70-90% auto-resuelve) / SOBRE-INGENIERÍA (>90% y >5s) / SUB-UTILIZADO (<50%, bajo costo) / EN RIESGO (<50%, alto costo).

| Métrica | Rango saludable | Alerta |
|---|---|---|
| Auto-resolución | 70-90% | <50% |
| Tiempo de respuesta | <2s inbound, <5s IA | — |
| Precisión de intención | >85% | <70% |
| Escalamiento a humano | 10-30% | >40% |
| Costo/conversación | <$0.005 | >$0.02 |
| Satisfacción del lead | >75% | <50% |
| Tokens/conversación | <2000 | >5000 |
| Re-contacto | >20% | <10% |

## 4. Manejo de la información del negocio: clasificación y confidencialidad

### 4.1 Clasificación de datos de la plataforma (DATA §6 — 4 niveles)
| Nivel | Qué incluye | Tratamiento |
|---|---|---|
| Público | Contenido de marketing, plantillas genéricas | Sin restricción |
| Interno | Métricas agregadas, logs de sistema | Solo personal |
| Confidencial (PII) | Nombres, teléfonos, mensajes de leads | Auth + RLS + HTTPS + cifrado en reposo |
| Restringido | Secrets, API keys, contraseñas | Acceso mínimo, nunca en logs |

**Decisiones explícitas de nivel (DATA):** NO cifrado por columna, NO TDE en PostgreSQL, Redis sin cifrado (datos temporales sin PII completa), red Docker interna sin cifrado — "seguridad sensata, no blindaje bancario".

### 4.2 Confidencialidad en la conversación del agente (esquema de plantilla)
Paralela pero distinta: es la clasificación **de cara al lead**, aplicada por el núcleo como regla de lectura de estado:

| Etiqueta | Significado | Ejemplo (consultora) |
|---|---|---|
| `public` | Se puede decir al cliente tal cual | Nombre, tipo de servicio, urgencia |
| `assisted` | Se usa transformado; nunca se expone el valor crudo | `budget_signal` → ajusta tono, no se cita el monto; `scope_complexity_notes` → ubica rango, no se expone desglose |
| `internal` | Nunca entra al contexto de respuesta; solo cálculo interno/handoff | `internal_cost_structure`, `final_price` |

### 4.3 PII fuera de los logs
Filtro de 5 patrones (teléfonos→`[PHONE]`, emails→`[EMAIL]`, nombres→`[NAME]`, IPs→`[IP]`, keys→`[KEY]`) con whitelist de campos técnicos — diseñado en DATA §6 (`helper-node/src/pii-filter.js`), ejecutar en F5.

## 5. Ciclo de vida de la información del negocio (lead al centro)

```
INGESTA → Meta webhook → helper → sanitiza → identifica tenant (phone_number_id)
   → Redis {tenant}:conv:{id} (volátil, TTL 7d) + INSERT async messages
CLASIFICACIÓN → n8n → Dify → {intent, score, captured_data, suggested_response}
   → actualiza Redis (state, lastIntentScore) + INSERT lead_scores
SYNC CRM → Twenty (upsert: datos + painPoints + score history) → leads.contact_id
SEGUIMIENTO → temperatura/cadencia (CTX-04 §4) → sync por evento al CRM
ANALYTICS → agregación cada 30 min → daily_metrics → dashboards
```

Responsabilidad por tipo de dato (DATA §2): leads → PostgreSQL primario + Twenty sync + Redis cache 5min · conversaciones activas → Redis 7d + historial PG · KB → Weaviate + filesystem · métricas → Prometheus · sesiones → Redis 8h.

## 6. Retención y archivado (DATA §7 + SEC §13)

| Dato | Política |
|---|---|
| Conversaciones (Redis) | 7 días (TTL) |
| Mensajes (PG) | 2 años → `messages_archive` (partición mensual) |
| Leads fríos (score<30, 90d sin contacto) | → `cold_expired` |
| Leads calificados | 2 años |
| Audit logs | 1 año (purge) |
| Multimedia | 90 días (delete, solo metadatos) |
| Grabaciones de voz | 30 días |
| Facturación | 5 años |
| Métricas | 90 días → downsample 1h |
| Opt-out | Eliminación/bloqueo inmediato (cumplimiento) |

**Cumplimiento (SEC §13):** Ley 164 (Bolivia), LGPD, GDPR, Meta ToS; checklist ARCO; opt-out documentado también **como política de negocio**, no solo como feature (CTX-01 §5.3).

## 7. Información para el negocio: Data Warehouse y BI (DATA §8-9)

- **Modelo estrella:** hechos `daily_metrics` (20 columnas: leads, mensajes in/out, campañas sent/delivered/read/replied, llamadas, tokens LLM, costo, tiempos, scores hot/warm/cold) + dimensiones tenants/dates/channels.
- Vista materializada `mv_daily_kpi` (30 días, refresh horario).
- **10 KPIs de datos** con umbrales: entrega >90%, lectura <30% alerta, respuesta <5%, conversión lead→calificado <10%, tiempo respuesta >60s, precisión IA <80%, costo IA >$0.01/lead, escalamiento >30%, **leads huérfanos >0**, crecimiento BD >10%/semana.
- Estos KPIs de datos **alimentan** los KPIs de negocio (§2) y los dashboards Grafana (CTX-01 §6).

## 8. Multi-tenant: la información separada por cliente (principio rector)

- Toda tabla de negocio lleva `tenant_id`; RLS es la norma (DATA principio 5).
- Jerarquía PLATFORM → TENANT → BRANCH → USER (OPS §1): leads, campañas y conversaciones viven en nivel **branch**; config de agente y suscripción en nivel **tenant**.
- Aislamiento por servicio: PG (schema+RLS), Redis (prefijos `{tenant}:{branch}:{key}`), Weaviate (clase por tenant), Chatwoot (cuenta), Dify (workspace), n8n (proyecto), Twenty (workspace), archivos (`storage/{tenant}/{branch}/{type}/`).
- **Estado real:** el helper actual opera con tenant `default` implícito en JSON store; la migración es objetivo CTX01-O2.

## 9. Objetivos y criterios de cumplimiento (seguimiento)

| # | Objetivo contextual | Criterio medible | Estado | Seguimiento |
|---|---|---|---|---|
| CTX06-O1 | Planes y límites definidos | 4 planes con límites en tabla `platform_tenants` (plan_id, límites denormalizados) | Diseñado (DDL en OPS §2) | TEC-03 OT-09 |
| CTX06-O2 | KPIs medibles | KPI-1..6 calculables desde `daily_metrics`; primero: KPI-3 (>50% auto-resolución en MVP) y KPI-4 (<$0.01) | Pendiente | F1.19, F1.20 |
| CTX06-O3 | Confidencialidad ejecutada por el núcleo | 0 datos `internal` en respuestas al cliente (test automatizable); `assisted` solo transformados | Diseñado | RAG-G15-02 |
| CTX06-O4 | PII fuera de logs | Filtro activo; 0 teléfonos/emails en logs de producción | Pendiente (F5) | SEC F5, RAG-G9-04 |
| CTX06-O5 | Retención aplicada | Script `archive.sql` corriendo mensual; políticas de §6 activas | Pendiente | TEC-03 OT-05 |
| CTX06-O6 | Aislamiento por tenant | `tenant_id` en todas las tablas de negocio + RLS verificado con 2 tenants de prueba | Pendiente | TEC-03 OT-02 |
| CTX06-O7 | Resolución de inconsistencia de costos Demo | BUSINESS-MASTER corregido ($0.50 vs $5) | Abierto | TEC-04 §5 |

---

## Referencias cruzadas

- → [CTX-01 Infraestructura](CTX-01-INFRAESTRUCTURA.md) (mínimo razonable vs maduro en datos/seguridad)
- → [CTX-04 Lógica de vendedor](CTX-04-LOGICA-VENDEDOR.md) (usa las etiquetas de confidencialidad)
- → [CTX-05 Plantillas](CTX-05-ABSTRACCION-AGENTE-PLANTILLAS-NEGOCIOS.md) (dónde se declaran las etiquetas)
- → [CTX-07 Consolidación](CTX-07-CONSOLIDACION-NEGOCIO-INFRAESTRUCTURA.md) (costo por tenant)
- → [TEC-01 §4](../tecnica/TEC-01-ARQUITECTURA-INFRAESTRUCTURA.md) (dónde vive cada dato hoy)
