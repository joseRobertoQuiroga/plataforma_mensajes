# CTX-03 — Abstracción del CRM (Twenty) y del ERP (Frappe/ERPNext)

> **Versión:** 1.0 | **Fecha:** Julio 2026 | **Tipo:** Contextual (QUÉ/POR QUÉ)
> **Fuentes consolidadas:** `Organizar_Estructurar/Documento sin título.docx` (arquitectura Dify↔Twenty, parametrización SPICED/MEDDIC, triage), `docs/context/TWENTY-CRM.md`, ADR-012 (`docs/MEMORY.md`), `Avances/ROADMAP.md` (Fase 2), `FASES-CRUZADAS.md` (F2), `docs/DATABASE-VALIDATION.md`, `logica-agente-vendedor.md` §5.
> **Ejecución técnica:** [TEC-02](../tecnica/TEC-02-FUNCIONES-IMPLEMENTACION.md) §G7 | RAG-G7, RAG-G17 en [`../maestro/MAESTRO-FUNCIONALIDADES-CORE.md`](../maestro/MAESTRO-FUNCIONALIDADES-CORE.md)

---

## 1. Principio de abstracción: el agente no "habla CRM", habla "estado del lead"

La idea central (del docx de metodologías): la plataforma convierte un CRM convencional en un **sistema autónomo de ventas** separando tres responsabilidades:

| Capa | Sistema | Responsabilidad |
|---|---|---|
| Interfaz de conversación | WhatsApp (vía Meta/Twilio) + Chatwoot | El canal por donde habla el cliente |
| Cerebro orquestador | Dify (workflows/agentes) | Trae contexto del contacto, evalúa estado, decide metodología, responde o alerta al humano |
| Persistencia de datos y estado | Twenty CRM (hoy) → + Frappe/ERPNext (F2) | Historial, campos parametrizados por metodología, score, estado de la oportunidad |

```
[ WhatsApp (UI) ]  ◄──webhook / API──►  [ Dify (agentes) ]  ◄──REST/GraphQL──►  [ Twenty CRM (estado) ]
                                                                              │
                                                              F2: oportunidad ganada ──► [ Frappe/ERPNext (venta/factura) ]
```

**Regla de diseño:** el agente nunca escribe "a ver qué campo toca" — escribe contra un **modelo de datos comercial parametrizado** (§3) y un **estado de calificación explícito** (`qualification_stage`). El CRM es un *registro vivo*, no un destino de volcado.

## 2. Rol de Twenty CRM en la arquitectura actual

- **Persistencia del lead:** objeto `people` con datos de contacto + campos custom.
- **Campos custom implementados (10, ADR-012):** `painPoints`, `interests`, `leadSource`, `customFields` + 6 con prefijo `lead` (`leadScoreHistory`, `leadLastScore`, `leadOrigin`, `leadCustomData`…) — el prefijo `lead` existe porque Twenty usa **namespace global** de nombres de campo (riesgo de colisión ya documentado).
- **Sincronización implementada:** helper → Twenty (upsert por teléfono/email, normalización con `+`, sync individual y batch, guarda `contact_id`). Estado: 12/12 leads sincronizados. RAG-G7-01.
- **Deuda conocida:** sync unidireccional (helper→Twenty); falta escuchar cambios desde Twenty (webhook Twenty→helper), sync de oportunidades, y el riesgo de `contact_id` desincronizado (DATABASE-VALIDATION P6).

## 3. Modelo de datos comercial parametrizado (diseño objetivo)

Del docx: para que Twenty "ordene y califique" oportunidades según metodología, se definen **custom fields por bloque metodológico** en los objetos Contact y Opportunity:

| Bloque | Campos | Tipo |
|---|---|---|
| SPICED | `spiced_situation`, `spiced_pain` | Text |
| | `spiced_impact_value` | Number/Currency |
| | `spiced_critical_event` | Date/Text |
| MEDDIC | `meddic_economic_buyer`, `meddic_champion` | Contact Relation/Text |
| | `meddic_decision_criteria_met` | Boolean |
| Scoring & Control | `lead_fit_score` | Number (0-100) |
| | `qualification_stage` | Select: `Cold / SPICED_In_Progress / MEDDIC_Qualified / Ready_To_Close` |

**Matriz de estados → metodología activa** (el orquestador lee `stage` + `qualification_score` para decidir el modo):

| Estado en CRM | Metodología activa | Objetivo del agente | Trigger de cambio |
|---|---|---|---|
| Lead / Frío | Insight Selling (PIPC) | Generar interés con dolor de industria, lograr respuesta | Responde con interés o confirma dolor |
| Discovery | SPICED | Extraer Situation, Pain, Impact, Critical Event, Decision | Impact ($) y Critical Event completos |
| Oportunidad / Demo | MEDDIC | Calificar viabilidad, identificar Economic Buyer y Champion | Economic Buyer validado + criterios aceptados |
| Cliente ganado | Bowtie / Health Score | Monitorear satisfación, detectar cross-sell | Achieved Impact cumplido o Health Score alto |

Detalle de las metodologías en [CTX-04 §8](CTX-04-LOGICA-VENDEDOR.md).

## 4. Triage y pipelines diferenciados (Fase 0 de calificación)

Antes de cualquier metodología, el sistema hace **Triage/Perfilamiento dinámico** (1-2 preguntas de bajo impacto: ¿empresa o persona? ¿qué tipo de solución busca?) que enruta a:

| Ruta | Ejemplos | Campos clave Fase 0 | Metodología | Pipeline en Twenty |
|---|---|---|---|---|
| B2B Enterprise | Software B2B, consultorías | Empresa, cargo, tamaño, herramienta actual | SPICED + MEDDIC completo | Pipeline A: Ventas Corporativas |
| B2B Mayorista | Ropa al por mayor, insumos | Tipo de negocio, volumen (MOQ), frecuencia, zona | SPICED Light (volumen/margen/entrega) | Pipeline B: Ventas Mayoristas |
| B2C | Retail, servicios personales | Necesidad, preferencia, presupuesto/dirección | Venta transaccional (cierre rápido, sin MEDDIC) | Pipeline C: Ventas Minoristas |

**Campos dinámicos por tipo de registro (`ContactType`):** Empresa → Tax ID, Company Size, Economic Buyer, MEDDIC Score activos; Mayorista → MOQ Target, Business Type, Shipping Region activos. En Dify, un nodo IF/ELSE carga el prompt del agente según `ContactType`.

**Caso multi-contacto (edge case 4 del docx):** si escribe otra persona de la misma empresa (otro WhatsApp), el sistema valida dominio de correo/nombre de empresa existente y **vincula el contacto al objeto Company existente** — historial unificado, no lead duplicado.

## 5. Abstracción del ERP: Frappe/ERPNext (Fase 2, planificada)

**Principio:** el CRM gestiona la *relación y la oportunidad*; el ERP gestiona la *transacción y la operación* (pedidos, facturas, entregas). La frontera es el **cierre de la venta**.

| Aspecto | Planteamiento | Fuente |
|---|---|---|
| Alcance F2 | Setup Frappe (3d), sync leads Twenty→Frappe (2d), sync pedidos/ventas (3d), facturación (2d), workflows n8n para Frappe (2d) | `Avances/ROADMAP.md` F2 |
| Verificación E2E | Lead en Twenty → factura automática en Frappe | `FASES-CRUZADAS.md` F2.1-F2.4 |
| Modelo ERP | Órdenes/facturas con su propio modelo de datos; plan Enterprise como licencia perpetua + código fuente (BUS §1) | FASES-CRUZADAS F2.2, BUSINESS-MASTER |
| Orquestación | n8n como puente Twenty↔Frappe (mismo patrón que los workflows 01/02) | ROADMAP F2 |
| Billing SaaS (distinto del ERP del cliente) | `subscriptions`/`billing_events` con Stripe viven en el schema Lumi de la **plataforma**, no en el ERP del tenant | DATA §2, CTX-06 |

**Regla de abstracción ERP ↔ agente:** el agente **nunca confirma precio final ni stock desde el LLM** (guardrail anti-alucinación, edge case 2 del docx): precios/inventario se resuelven con *lookup determinista* a la base de datos de productos/ERP vía API (patrón RAG/lookup), nunca de memoria del modelo. Esto conecta con la zona roja de autonomía (CTX-04 §3) y con ROAD 7.2.

## 6. Integración con el estado consolidado del lead

De `logica-agente-vendedor.md` §5: el estado consolidado del lead (etapa, temperatura, historial de objeciones) **es lo que se sincroniza al CRM en cada actualización** — el handoff no es un mensaje suelto sino un registro vivo que el humano sigue desde antes del cierre. Consecuencias de diseño:

1. **Una sola línea de tiempo:** cada interacción de seguimiento actualiza el mismo registro (no hilos separados).
2. **Sync por eventos:** el client-config define `sync_on: ["temperature_change", "handoff"]` (ver `client-config-acme-dev-studio.json`) — el sync es por evento significativo, no por mensaje.
3. **Devolución al bot (edge case 5):** campo `Modo_Conversación (IA/Humano)` en el CRM; cuando el vendedor termina, cambia a `Devolver_a_IA` y Dify reengancha con mensaje automático.

## 7. Handoff: del CRM al humano (resumen contextual)

El paquete de handoff (detalle completo en CTX-04 §7) se materializa como **nota interna/briefing en Twenty** con: score y motivo, pain/impact (SPICED), economic buyer (MEDDIC), objeciones registradas, próxima acción sugerida (una sola). Formato de referencia del docx:

```
📌 NUEVO LEAD QUALIFIED (Score: 75/100)
• Cliente: Empresa X (Rubro Logistics)
• Pain (SPICED): Demora de 4 días en despachos
• Impact (SPICED): Pérdida estimada de $8,000/mes
• Economic Buyer: Juan Pérez (Director de Operaciones)
➡️ Acción sugerida: Proponer reunión de 15 min
```

## 8. Objetivos y criterios de cumplimiento (seguimiento)

| # | Objetivo contextual | Criterio medible | Estado | Seguimiento |
|---|---|---|---|---|
| CTX03-O1 | CRM como registro vivo del lead | Sync por evento (`temperature_change`, `handoff`) funcionando; una línea de tiempo por lead | Parcial (sync básico OK) | RAG-G7-01, TEC-02 §G7 |
| CTX03-O2 | Campos metodológicos en CRM | Bloques SPICED/MEDDIC/scoring creados en `people`/Opportunity según §3 | Pendiente (hoy 10 campos genéricos) | TEC-03 OT-06 |
| CTX03-O3 | Pipelines por tipo de cliente | 3 pipelines (Corporativo/Mayorista/Minorista) + campos dinámicos por `ContactType` | Pendiente | TEC-03 OT-06 |
| CTX03-O4 | Bidireccionalidad Twenty↔helper | Webhook Twenty→helper operativo; `Modo_Conversación` implementado | Pendiente | TEC-03 OT-06, RAG-G7-03 |
| CTX03-O5 | Abstracción ERP | Lead cerrado en Twenty genera factura automática en Frappe (verificación F2) | 🔴 Fase 2 no iniciada | TEC-03 OT-07, RAG-G17-01 |
| CTX03-O6 | Lookup determinista de precios | El agente jamás cotiza de memoria: 100% de cotizaciones vía API/lookup | Diseñado (guardrail) | ROAD 7.2, CTX-04 §9 |

---

## Referencias cruzadas

- → [CTX-04 Lógica de vendedor](CTX-04-LOGICA-VENDEDOR.md) (metodologías SPICED/MEDDIC/PIPC/Bowtie, handoff, edge cases)
- → [CTX-05 Plantillas](CTX-05-ABSTRACCION-AGENTE-PLANTILLAS-NEGOCIOS.md) (`crm_connector` en meta de plantilla)
- → [CTX-06 Manejo de información](CTX-06-LOGICA-NEGOCIO-INFORMACION.md) (ciclo de vida del dato del lead)
- → [TEC-02 §G7](../tecnica/TEC-02-FUNCIONES-IMPLEMENTACION.md) (implementación real del sync)
- → ADR-012 (custom fields, namespace global) en `docs/MEMORY.md`
