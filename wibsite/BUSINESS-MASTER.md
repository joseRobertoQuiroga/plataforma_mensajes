# Wibsite Business — BUSINESS-MASTER: Métricas, Planes y Lógica de Agente

> **Versión:** 1.0 — Julio 2026
> **Propósito:** Definir los KPIs de negocio, la estrategia de monetización (4 planes), y la arquitectura del "switcher" de contexto que adapta el comportamiento del agente según el tipo de negocio del cliente.
> **Filosofía:** No ahogar en métricas. 5-6 KPIs centrales + KPIs específicos por flujo visibles al navegar a cada módulo.

---

## Índice

1. [Estrategia de Monetización — 4 Planes](#1-estrategia-de-monetización--4-planes)
2. [KPIs Centrales de Negocio](#2-kpis-centrales-de-negocio)
3. [KPIs por Flujo (Visibles en Cada Módulo)](#3-kpis-por-flujo-visibles-en-cada-módulo)
4. [Arquitectura del Switcher de Contexto](#4-arquitectura-del-switcher-de-contexto)
5. [Tipos de Negocio y sus Flujos](#5-tipos-de-negocio-y-sus-flujos)
6. [Métricas de Salud del Agente](#6-métricas-de-salud-del-agente)
7. [Proyección Financiera por Plan](#7-proyección-financiera-por-plan)
8. [Definición de Éxito por Fase del Roadmap](#8-definición-de-éxito-por-fase-del-roadmap)

---

## 1. Estrategia de Monetización — 4 Planes

### 1.1 Resumen de Planes

| Característica | 🆓 Demo | 🔵 Blue | 🟣 ProMax | 🏢 Enterprise |
|---------------|---------|---------|-----------|---------------|
| **Precio** | Gratis | $29/mes | $79/mes | $2,500 - $10,000 (licencia única) |
| **Usuarios** | 1 | 3 | 10 | Ilimitados |
| **Sucursales** | 1 | 2 | 5 | Ilimitadas |
| **Leads/mes** | 100 | 1,000 | 10,000 | Ilimitados |
| **Conversaciones/mes** | 500 | 5,000 | 50,000 | Ilimitadas |
| **Campañas/mes** | 2 | 20 | 100 | Ilimitadas |
| **Contextos de agente** | 1 (fijo) | 2 | 10 | Ilimitados |
| **Knowledge Base** | ❌ | 10 docs, 50MB | 100 docs, 500MB | Ilimitado |
| **Voz y llamadas** | ❌ | ❌ | ✅ 100 min/mes | ✅ Ilimitado |
| **Multi-agente** | ❌ | ❌ | ✅ (3 agentes) | ✅ Ilimitado |
| **RAG** | ❌ | ❌ | ✅ | ✅ |
| **API externas** | ❌ | ❌ | ✅ (3 APIs) | ✅ Ilimitado |
| **Analytics** | ❌ | Básico | Avanzado | Completo |
| **Soporte** | Comunidad | Email 48h | Chat 24h | Dedicado 24/7 |
| **On-premise / Código** | ❌ | ❌ | ❌ | ✅ Licencia perpetua + código fuente |
| **White-label** | ❌ | ❌ | ❌ | ✅ Marca propia |
| **SLA** | Sin SLA | 99.5% | 99.9% | 99.99% |

### 1.2 Plan Demo (Gratis)

```
Propósito: Onboarding, prueba de concepto, validación de fit.
Duración: 14 días (renovable una vez)
Limitaciones clave:
  - 1 solo agente con contexto fijo (no modificable)
  - Sin personalización de productos/personalidad
  - Sin voz, sin RAG, sin APIs externas
  - Marca de agua "Wibsite Demo" en todas las vistas
  - Sin posibilidad de exportar datos

Flujo de conversión a plan pago:
  1. Día 7 → Email: "Tu prueba termina en 7 días. ¿Listo para más?"
  2. Día 12 → Email + notificación en app: "Tu demo expira en 2 días"
  3. Día 14 → Bloqueo: panel de login muestra "Tu demo ha expirado. Elige un plan."
  4. Datos se mantienen 30 días después de expiración (por si reactiva)

Costo estimado para Wibsite por tenant Demo: ~$0.50/mes (LLM + infra)
```

### 1.3 Plan Blue ($29/mes)

```
Propósito: PYME individual, negocio pequeño, profesional independiente.
Target: Pastelerías, pequeños comercios, freelancers, servicios profesionales.

Lo que incluye:
  - 3 usuarios (dueño + 2 agentes/vendedores)
  - 2 sucursales (ej: local principal + tienda online)
  - Contexto de agente configurable (tipo de negocio, productos, personalidad)
  - Sistema de campañas básico (hasta 20 campañas/mes)
  - Scoring rule-based
  - Dashboard básico con KPIs principales
  - Soporte por email (respuesta en 48h)

Límites diseñados para:
  - ~30-50 leads nuevos/mes (1-2 conversaciones/día)
  - ~5,000 mensajes/mes (~160/día, ~1 conversación cada 9 min en horario laboral)
  - Almacenamiento suficiente para negocio pequeño

Costo estimado para Wibsite: ~$3/mes (LLM + infra + soporte)
Margen bruto: ~90%
```

### 1.4 Plan ProMax ($79/mes)

```
Propósito: PYME en crecimiento, negocio mediano, múltiples líneas de producto.
Target: Tiendas de electrodomésticos, empresas de servicios con varias sucursales,
        gimnasios con múltiples sedes, clínicas.

Lo que incluye:
  - 10 usuarios (admins + agentes + supervisores)
  - 5 sucursales
  - Contexto de agente avanzado (productos, servicios, políticas, descuentos)
  - Knowledge Base con RAG (100 docs, 500MB)
  - Voz y llamadas (100 min/mes)
  - Multi-agente (3 agentes especializados: ventas, soporte, post-venta)
  - APIs externas (3 integraciones: stock, precios, CRM propio)
  - Analytics avanzado con forecasting
  - Chat de soporte 24h
  - Prioridad en procesamiento (cola preferente)

Diferenciador clave:
  - El switcher de contexto adapta el agente a múltiples líneas de negocio
  - Ejemplo: un negocio que vende electrodomésticos + ofrece servicio técnico
    puede tener un agente de ventas para productos y otro de soporte para reparaciones

Costo estimado para Wibsite: ~$12/mes (LLM + infra + voz + soporte)
Margen bruto: ~85%
```

### 1.5 Plan Enterprise (Licencia: $2,500 - $10,000 + $500-2,000/mes mantenimiento)

```
Propósito: Empresa grande, múltiples sucursales, datos sensibles, cumplimiento regulatorio.
Target: Bancos, clínicas grandes, cadenas retail, gobierno, manufactura.

Modalidad híbrida:
  - Pago único de licencia ($2,500 - $10,000 según módulos)
  - Mantenimiento mensual ($500 - $2,000) que incluye:
    - Actualizaciones de seguridad
    - Nuevas features (según roadmap)
    - Soporte dedicado 24/7 con SLA 99.99%
    - Hosting de infraestructura Wibsite (opcional)

Lo que incluye:
  - TODO: sin límites de usuarios, sucursales, leads, conversaciones
  - Código fuente completo (licencia de uso, no reventa)
  - Despliegue en servidores propios del cliente
  - White-label (marca del cliente, no "Wibsite")
  - Personalización de flujos por el equipo de Wibsite (hasta 20h/mes incluidas)
  - On-premise: sin dependencia de cloud de Wibsite
  - LDAP/SSO integrado con su proveedor de identidad corporativo

Casos de uso:
  - Banco con 200 agentes de call center
  - Clínica con 15 sucursales y datos sensibles de pacientes
  - Retail con 50 tiendas y miles de leads/día

Costo para Wibsite: ~Variable según tenant ($50-500/mes en infra)
Margen bruto: ~70-90% según personalización
```

---

## 2. KPIs Centrales de Negocio

> Solo 6 KPIs. Si quieres más detalle, navega al módulo específico.

### KPI-1: Tasa de Conversión de Leads (Pipeline)

```
Lead nuevo → Lead calificado → Oportunidad → Propuesta → Cerrado

Fórmula: leads_cerrados / leads_nuevos * 100 (en período)

Meta: > 15% Rate de conversión global
      > 30% De lead calificado a cerrado

Dónde verlo: Dashboard principal (helper SPA)
Frecuencia: Diario
Alerta si: < 5% en 7 días consecutivos

Sub-KPIs (visibles al navegar al módulo CRM):
  - Tasa de conversión por campaña
  - Tasa de conversión por canal
  - Tiempo promedio de lead a cierre
  - Valor promedio de venta por lead
```

### KPI-2: Efectividad de Campañas

```
Fórmula compuesta:
  (delivery_rate * 0.3) + (read_rate * 0.3) + (reply_rate * 0.4)

Donde:
  delivery_rate = delivered / sent
  read_rate = read / delivered
  reply_rate = replied / read

Meta: Score compuesto > 60

Dónde verlo: Módulo Campañas
Frecuencia: Por campaña
Alerta si: Score < 30 en cualquier campaña

Sub-KPIs (visibles al navegar al módulo Campañas):
  - Tasa de entrega por canal
  - Mejor hora de envío (según histórico)
  - ROI por campaña (ventas generadas / costo de campaña)
  - Tasa de opt-out por campaña
```

### KPI-3: Eficiencia del Agente IA

```
Fórmula:
  auto_resolution_rate = conversaciones_resueltas_sin_humano / total_conversaciones * 100

Meta: > 70% de conversaciones resueltas sin intervención humana
      Tiempo promedio de primera respuesta < 30 segundos

Dónde verlo: Módulo Inbox / Dashboard IA
Frecuencia: Diario
Alerta si: < 50% o tiempo de respuesta > 60s

Sub-KPIs (visibles al navegar al módulo IA Studio):
  - Precisión de clasificación por intención
  - Score de satisfacción del lead (positivo/neutral/negativo)
  - Temas más frecuentes (word cloud de intents)
  - Tasa de escalamiento por agente (qualifier vs sales vs support)
```

### KPI-4: Costo de Operación por Lead

```
Fórmula:
  costo_por_lead = (costo_llm + costo_infra + costo_voz) / leads_procesados

Meta: < $0.01 por lead procesado
      Costo LLM < 60% del costo total

Dónde verlo: Módulo Configuración > Facturación
Frecuencia: Semanal
Alerta si: > $0.05/lead (indica abuso o ineficiencia)

Sub-KPIs:
  - Tokens LLM consumidos por tipo de interacción
  - Costo por minuto de llamada
  - Costo por mensaje de campaña
  - Cuota de API externas consumida
```

### KPI-5: Salud del Pipeline

```
Fórmula:
  pipeline_health = sum(score_oportunidades) / max_score_posible

Donde cada oportunidad tiene score 0-100 según:
  - Probabilidad de cierre (Dify prediction)
  - Tiempo en etapa actual
  - Última actividad
  - Interacciones recientes

Meta: > 60/100

Dónde verlo: Módulo CRM > Pipeline
Frecuencia: Tiempo real
Alerta si: < 30 (pipeline se está muriendo)

Sub-KPIs:
  - Leads nuevos vs leads perdidos (tasa semanal)
  - Tasa de reactivación de leads fríos
  - Valor total del pipeline en USD
  - Leads por etapa del pipeline
```

### KPI-6: Satisfacción del Cliente

```
Fórmula compuesta:
  CSAT = avg(
    sentiment_análisis_ia,      # 40% peso
    tasa_de_recompra,           # 25% peso
    tiempo_de_actividad,        # 20% peso
    tasa_de_referidos           # 15% peso
  )

Meta: > 70/100

Dónde verlo: Dashboard principal
Frecuencia: Mensual
Alerta si: < 40 (cliente insatisfecho, riesgo de churn)

Sub-KPIs:
  - NPS (Net Promoter Score) calculado de encuestas post-conversación
  - Tasa de churn de leads (leads que dejan de responder)
  - Tiempo de vida del lead (desde primer contacto hasta último)
  - Reclamaciones o escalamientos por mes
```

---

## 3. KPIs por Flujo (Visibles en Cada Módulo)

Cuando navegas a un módulo específico, ves sus KPIs detallados. Así no saturas el dashboard central.

```
MÓDULO INBOX (Chatwoot)
├── Conversaciones activas ahora
├── Tiempo promedio de primera respuesta (hoy)
├── Leads esperando respuesta humana
├── Score de sentimiento de las últimas 24h
└── Tasa de auto-resolución del agente IA

MÓDULO CRM (Twenty)
├── Leads nuevos (hoy / esta semana / este mes)
├── Leads por etapa del pipeline
├── Tasa de conversión lead → oportunidad
├── Valor total de oportunidades abiertas
└── Tiempo promedio en cada etapa

MÓDULO IA STUDIO (Dify)
├── Ejecuciones de workflow (hoy)
├── Tasa de éxito de clasificación
├── Tiempo promedio de procesamiento por mensaje
├── Tokens consumidos hoy
└── Costo estimado de IA hoy

MÓDULO CAMPAÑAS (Helper Dashboard)
├── Campañas activas ahora
├── Tasa de entrega general
├── Tasa de respuesta general
├── Leads generados por campañas
└── Costo por campaña

MÓDULO LLAMADAS (Voice)
├── Llamadas activas ahora
├── Llamadas hoy
├── Duración promedio de llamada
├── Tasa de éxito (lead calificado post-llamada)
└── Costo de llamadas hoy

MÓDULO CONFIGURACIÓN
├── Usuarios activos / límite del plan
├── Leads este mes / límite del plan
├── Conversaciones este mes / límite del plan
├── Almacenamiento usado
└── Próxima fecha de facturación
```

---

## 4. Arquitectura del Switcher de Contexto

### 4.1 El Problema

Cada negocio es diferente:
- Una **pastelería** necesita: tomar pedidos personalizados, confirmar sabores, coordinar entregas, ofrecer novedades semanales
- Una **tienda de electrodomésticos** necesita: mostrar productos con precio y stock, comparar modelos, ofrecer descuentos por campaña, coordinar entregas
- Un **servicio de desarrollo** necesita: entender alcance del proyecto, cotizar horas, coordinar entregas parciales, ventas cruzadas de servicios complementarios

El agente no puede tener un comportamiento fijo. Debe **adaptarse al contexto del negocio** automáticamente cuando el dueño configura su tienda.

### 4.2 Arquitectura del Switcher

```
                    ┌──────────────────────────────────────────┐
                    │         BUSINESS CONFIG EDITOR           │
                    │   (Configuración visual del agente)      │
                    │                                          │
                    │  Tipo de negocio: [electrodomésticos]    │
                    │  Productos: [TV Samsung 65" → $899]    │
                    │  Políticas: [warranty: 1 año]           │
                    │  Flujo preferido: [venta directa]       │
                    └──────────────────┬───────────────────────┘
                                       │
                                       ▼
┌──────────────────────────────────────────────────────────────────┐
│                   CONTEXT ADAPTER (Sub-Agente)                    │
│                                                                  │
│  Lee: business_config → tipo_negocio → industria → flujos       │
│                                                                  │
│  Determina:                                                      │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │  Si tipo = "productos_físicos" (electrodomésticos,       │    │
│  │  pastelería, ropa):                                      │    │
│  │    → Activar flujo: mostrar_producto → precio → stock    │    │
│  │    → Activar función: CONSULTAR_STOCK, CONSULTAR_PRECIO │    │
│  │    → Prompt: "Eres vendedor de productos. Muestra       │    │
│  │       precios claros, sugiere alternativas."             │    │
│  │                                                          │    │
│  │  Si tipo = "servicios" (desarrollo, consultoría,         │    │
│  │  gimnasio):                                              │    │
│  │    → Activar flujo: descubrir_ necesidad → cotizar      │    │
│  │    → Activar función: CALCULAR_COTIZACION, AGENDAR_CITA │    │
│  │    → Prompt: "Eres asesor de servicios. Escucha las     │    │
│  │       necesidades del cliente primero."                  │    │
│  │                                                          │    │
│  │  Si tipo = "mixto" (productos + servicio técnico):      │    │
│  │    → Activar flujo: clasificar_intencion → ventas o     │    │
│  │      soporte según lo que el lead necesite               │    │
│  │    → Activar agente dual: Sales Agent + Support Agent    │    │
│  │    → Prompt: "Eres un agente versátil. Detecta si el    │    │
│  │       lead quiere comprar o necesita ayuda técnica."     │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                  │
│  Output: { adapted_prompt, active_flows, enabled_functions,     │
│            suggested_agent_type, product_catalog_context,       │
│            conversation_start_state }                            │
└──────────────────────────┬───────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│                    AGENTE PRINCIPAL (Dify)                       │
│                                                                  │
│  Recibe: message del lead + adapted_prompt + context             │
│                                                                  │
│  Flujo de respuesta adaptado según:                              │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │  Ejemplo PASTELERÍA:                                     │    │
│  │  Lead: "Quiero una torta para el sábado"                 │    │
│  │  Agente: "¡Claro! ¿De qué sabor la prefieres? Tenemos    │    │
│  │           chocolate, vainilla, fresa y tres leches.       │    │
│  │           ¿Para cuántas personas?"                        │    │
│  │                                                          │    │
│  │  Ejemplo ELECTRODOMÉSTICOS:                              │    │
│  │  Lead: "Quiero una torta para el sábado"                 │    │
│  │  Agente: "Creo que hubo una confusión. Soy de            │    │
│  │           TecnoShop, vendemos electrodomésticos.          │    │
│  │           ¿Buscas algún producto en especial?"            │    │
│  └──────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────┘
```

### 4.3 Tipos de Negocio y Configuración del Switcher

```json
{
  "business_type": "productos_fisicos",
  "subtypes": {
    "electrodomesticos": {
      "flows": ["catalogar_producto", "comparar_modelos", "verificar_stock", "aplicar_descuento"],
      "functions": ["CONSULTAR_STOCK", "CONSULTAR_PRECIO", "CALCULAR_ENVIO"],
      "prompt_style": "informativo_detallado",
      "state_machine": "venta_directa",
      "examples": [
        "cliente: ¿Tienen el TV Samsung de 65?",
        "agente: Sí, tenemos el modelo Q80B a $899. ¿Te interesa ver las especificaciones?"
      ]
    },
    "pasteleria": {
      "flows": ["tomar_pedido_personalizado", "sugerir_sabores", "confirmar_entrega", "ofrecer_novedades"],
      "functions": ["CALCULAR_PRECIO_PEDIDO", "VERIFICAR_DISPONIBILIDAD", "AGENDAR_ENTREGA"],
      "prompt_style": "amigable_personalizado",
      "state_machine": "pedido_personalizado",
      "examples": [
        "cliente: Quiero una torta para el sábado",
        "agente: ¡Claro! ¿De qué sabor la prefieres? Tenemos chocolate, vainilla, fresa y tres leches. ¿Para cuántas personas?"
      ]
    }
  }
}
```

### 4.4 Machine States por Tipo de Negocio

```
PRODUCTOS FÍSICOS (venta directa):
saludo → mostrar_productos → aclarar_dudas → confirmar_compra → coordinar_entrega → post_venta

SERVICIOS (consultoría):
saludo → descubrir_necesidad → presentar_servicios → cotizar → negociar → cerrar → seguimiento

PEDIDOS PERSONALIZADOS (pastelería, manufactura):
saludo → tomar_pedido → confirmar_especificaciones → cotizar → coordinar_entrega → post_venta

MIXTO (productos + servicio técnico):
saludo → clasificar_intencion → [venta_directa | soporte_técnico] según lo que necesite

SUSCRIPCIÓN (gimnasios, membresías):
saludo → presentar_planes → período_prueba → afiliación → retención → renovación
```

### 4.5 Implementación del Switcher

```javascript
// helper-node/src/context-switcher.js
const BUSINESS_TYPES = {
  productos_fisicos: {
    label: 'Productos Físicos',
    flows: ['catalog', 'compare', 'stock', 'discount', 'delivery'],
    stateMachine: 'direct_sale',
    promptTemplate: `Eres un vendedor especializado en {business_name}.
Vendemos los siguientes productos: {products}.

REGLAS:
- Siempre muestra el precio cuando menciones un producto.
- Si preguntan por stock, verifica disponibilidad.
- Puedes ofrecer descuentos solo si están autorizados (máximo {max_discount}%).
- Si no tienes un producto, sugiere la alternativa más cercana.
- Coordina entregas: {delivery_policy}.`,
  },

  servicios: {
    label: 'Servicios',
    flows: ['discover_need', 'present_services', 'quote', 'negotiate', 'onboard'],
    stateMachine: 'consulting',
    promptTemplate: `Eres un asesor de servicios de {business_name}.
Ofrecemos: {services}.

REGLAS:
- PRIMERO: entiende qué necesita el cliente antes de ofrecer nada.
- Haz preguntas para descubrir el alcance.
- Las cotizaciones son personalizadas según alcance.
- Puedes mencionar precios de referencia pero no cotizar sin antes entender la necesidad.
- Si el cliente ya es cliente, puedes ofrecer servicios complementarios.`,
  },

  mixto: {
    label: 'Productos + Servicios',
    flows: ['classify_intent', 'sales_or_support'],
    stateMachine: 'dual',
    promptTemplate: `Eres un agente versátil de {business_name}.
Vendemos productos: {products}.
Ofrecemos servicios: {services}.

REGLAS:
- PRIMERO: detecta si el lead quiere COMPRAR un producto o necesita AYUDA/SERVICIO.
- Si quiere comprar: actúa como vendedor, muestra precios y stock.
- Si necesita ayuda: actúa como soporte, resuelve el problema o escala.
- Si no está claro: pregunta "¿Buscas comprar algo o necesitas ayuda con algún servicio?"`,
  },

  suscripcion: {
    label: 'Suscripción / Membresía',
    flows: ['present_plans', 'trial', 'signup', 'retention', 'renewal'],
    stateMachine: 'subscription',
    promptTemplate: `Eres un asesor de membresías de {business_name}.
Planes disponibles: {subscription_plans}

REGLAS:
- Presenta los planes empezando por el más popular.
- Si preguntan por precios, muestra la tabla comparativa.
- Puedes ofrecer período de prueba de {trial_days} días.
- Si el cliente quiere cancelar, averigua el motivo primero y ofrece retención.`,
  },
};

function adaptAgentForBusiness(businessConfig) {
  const type = BUSINESS_TYPES[businessConfig.type] || BUSINESS_TYPES.productos_fisicos;

  const adapted = {
    flows: type.flows,
    stateMachine: type.stateMachine,
    systemPrompt: type.promptTemplate
      .replace('{business_name}', businessConfig.business_name || 'Mi Negocio')
      .replace('{products}', formatProducts(businessConfig.products))
      .replace('{services}', formatServices(businessConfig.services))
      .replace('{max_discount}', businessConfig.policies?.max_discount || '10')
      .replace('{delivery_policy}', businessConfig.policies?.delivery || 'Coordinamos según disponibilidad')
      .replace('{subscription_plans}', formatSubscriptionPlans(businessConfig.subscription_plans))
      .replace('{trial_days}', businessConfig.trial_days?.toString() || '7'),
    enabledFunctions: getFunctionsForType(type.flows, businessConfig),
    suggestedAgent: type.stateMachine === 'dual' ? 'sales_support' : 'sales',
  };

  return adapted;
}

function getFunctionsForType(flows, config) {
  const functions = [];
  if (flows.includes('stock')) functions.push('CONSULTAR_STOCK');
  if (flows.includes('compare')) functions.push('COMPARAR_PRODUCTOS');
  if (flows.includes('quote') || flows.includes('negotiate')) functions.push('CALCULAR_COTIZACION');
  if (flows.includes('delivery')) functions.push('CALCULAR_ENVIO');
  if (config.external_apis) {
    for (const api of config.external_apis) {
      functions.push({ name: api.name, url: api.url, method: api.method });
    }
  }
  return functions;
}
```

---

## 5. Tipos de Negocio y sus Flujos

### 5.1 Matriz de Comportamiento por Industria

| Industria | Tipo | Flujo Principal | State Machine | Tono | Funciones Especiales |
|-----------|------|----------------|---------------|------|---------------------|
| **Electrodomésticos** | productos_fisicos | catalogar → comparar → comprar → entregar | direct_sale | Informativo detallado | Stock, Precios, Envío |
| **Pastelería** | productos_fisicos | tomar_pedido → confirmar → coordinar → entregar | pedido_personalizado | Amigable cálido | Precio por pedido, Disponibilidad |
| **Gimnasio** | suscripcion | presentar_planes → prueba → afiliar → retener | subscription | Motivacional | Planes, Horarios, Promos |
| **Desarrollo Software** | servicios | descubrir → cotizar → negociar → onboard | consulting | Profesional consultivo | Cotización, Alcance, Plazos |
| **Clínica/Dental** | servicios + suscripcion | agendar → diagnosticar → tratar → seguir | consulting + subscription | Empático formal | Agenda, Historial, Recetas |
| **Tienda de Ropa** | productos_fisicos | mostrar → recomendar → vender → enviar | direct_sale | Casual amigable | Tallas, Colores, Envío |
| **Restaurante** | servicios + productos_fisicos | menu → tomar_pedido → entregar → fidelizar | pedido_personalizado | Cálido rápido | Menú, Delivery, Reservas |
| **Servicios Jurídicos** | servicios | consulta → diagnóstico → propuesta → contratar | consulting | Formal preciso | Especialidades, Honorarios |
| **Ferretería/Construcción** | productos_fisicos | buscar → especificar → cotizar → entregar | direct_sale | Técnico directo | Stock, Medidas, Precios x mayor |
| **Mixto (Producto + Soporte)** | mixto | clasificar → [venta o soporte] | dual | Versátil adaptable | Stock + Soporte técnico |

### 5.2 Ejemplo: Pastelería "Delicias" vs Electrodomésticos "TecnoShop"

```
PASTELERÍA "DELICIAS"
────────────────────
Config:
  type: productos_fisicos
  subtype: pasteleria
  products: [{ name: "Torta Chocolate", price: "$25", variants: ["mediana", "grande"] }]
  policies: { delivery: "Entregas martes a sábado 9am-6pm", custom_orders: true }

Lead: "Hola, quiero encargar una torta para el cumpleaños de mi hija"

Flujo:
  1. Agente detecta: pedido_personalizado
  2. Pregunta: "¡Feliz cumpleaños! ¿De qué sabor la prefieres? 🎂"
  3. Lead: "De chocolate, con relleno de fresa"
  4. Agente: "Perfecto. ¿Para cuántas personas? Tenemos:
     - Mediana (8-10 porciones): $25
     - Grande (15-20 porciones): $40"
  5. Lead: "La grande"
  6. Agente: "Genial. ¿Para qué día la necesitas?"
  ... → cotiza → coordina entrega → confirma

ELECTRODOMÉSTICOS "TECNOSHOP"
─────────────────────────────
Config:
  type: productos_fisicos
  subtype: electrodomesticos
  products: [{ name: "TV Samsung 65\" QLED", price: "$899", stock: 12 }]
  policies: { warranty: "1 año", delivery: "Gratis en compras >$200" }

Lead: "Hola, quiero encargar una torta para el cumpleaños de mi hija"

Flujo:
  1. Agente detecta: venta_directa (pero el mensaje no coincide con productos)
  2. Responde: "Creo que hubo una confusión 😅. En TecnoShop vendemos
     electrodomésticos y tecnología. ¿Buscas algún producto en especial?
     Tenemos TVs, laptops, refrigeradores y más."
  3. Lead: "Ah, disculpa. Sí, busco un TV"
  4. Agente: "¡Claro! ¿Qué tamaño buscas? Tenemos desde 32\" hasta 85\"."
  ... → muestra productos → compara → cierra venta
```

---

## 6. Métricas de Salud del Agente

### 6.1 Quadrant de Salud del Agente

```
                        ALTA AUTO-RESOLUCIÓN
                              │
                              │
       🟢 SALUDABLE           │           🟡 SOBRE-INGENIERÍA
       (70-90% auto-resuelve)  │           (>90% auto-resuelve, >5s resp.)
       Bajo costo/lead        │           Alto costo/lead, lento
       Buenos CSAT            │           Leads frustrados por demora
                              │
    ───────────────┼───────────────────────
       BAJO COSTO  │                        ALTO COSTO
    ───────────────┼───────────────────────
                              │
       🟡 SUB-UTILIZADO       │           🔴 EN RIESGO
       (<50% auto-resuelve)   │           (<50% auto-resuelve, >5s resp.)
       Bajo costo/lead        │           Alto costo/lead
       Mal CSAT               │           Mal CSAT, leads se van
       (mucho escalamiento    │           (agente caro y malo)
        humano innecesario)   │
                              │
                        BAJA AUTO-RESOLUCIÓN
```

### 6.2 Métricas de Salud (Visibles en Dashboard de Agente)

| Métrica | Fórmula | Rango Saludable | Alerta | Acción Correctiva |
|---------|---------|----------------|--------|-------------------|
| **Auto-resolución** | conv_sin_humano / total * 100 | 70-90% | < 50% | Revisar prompts, añadir KB, mejorar training |
| **Tiempo de respuesta** | AVG(ms primera respuesta) | < 2s inbound, < 5s IA | > 5s IA, > 30s inbound | Escalar helper, optimizar Dify, cache |
| **Precisión de intención** | clasificación_correcta / total * 100 | > 85% | < 70% | Revisar workflow Dify, añadir ejemplos |
| **Tasa de escalamiento** | escalados_a_humano / total * 100 | 10-30% | > 40% | Mejorar prompts, añadir más flujos automáticos |
| **Costo por conversación** | costo_llm_total / conversaciones | < $0.005 | > $0.02 | Optimizar prompts, reducir tokens, cambiar modelo |
| **Satisfacción del lead** | sentiment_positivo / total * 100 | > 75% | < 50% | Revisar tono del agente, añadir empatía |
| **Tokens por conversación** | total_tokens / conversaciones | < 2000 | > 5000 | Acortar prompts, limitar historial |
| **Tasa de re-contacto** | leads_que_vuelven / total * 100 | > 20% | < 10% | Mejorar nurturing, seguimiento automático |

---

## 7. Proyección Financiera por Plan

### 7.1 Costos Estructura por Tenant

| Componente | Costo/mes por tenant | Notas |
|-----------|---------------------|-------|
| **Infraestructura compartida** (PostgreSQL, Redis, Nginx, monitoreo) | $0.50 - $2.00 | Se divide entre todos los tenants |
| **Helper Node** (instancia) | $0.50 - $1.00 | 1 instancia por cada ~50 tenants activos |
| **Chatwoot** (instancia) | $0.50 - $1.00 | 1 instancia por cada ~100 tenants |
| **n8n** (instancia) | $0.50 - $1.00 | 1 instancia por cada ~100 tenants |
| **Dify** (instancia) | $1.00 - $3.00 | 1 instancia por cada ~50 tenants |
| **Weaviate** (instancia) | $0.50 - $1.00 | 1 instancia por cada ~100 tenants |
| **Costo LLM por lead** | $0.001 - $0.005 | Varía según plan y uso |
| **Costo TTS/Voz** | $0.01 - $0.05/min | Solo ProMax |
| **Almacenamiento** | $0.01 - $0.10/GB | Varía según plan |
| **Soporte** | $0.50 - $5.00 | Varía según plan |
| **Total Demo** (1 tenant) | ~$5/mes | Gasto real, subsidio |
| **Total Blue** (50 tenants compartiendo) | ~$3/mes | Rentable desde el primer tenant |
| **Total ProMax** (20 tenants compartiendo) | ~$12/mes | Margen alto |
| **Total Enterprise** | ~$50-500/mes | Variable según personalización |

### 7.2 Punto de Equilibrio

```
Costos fijos mensuales (infra compartida): ~$150/mes
  - VPS/Cloud: $50-100
  - Monitoreo (Grafana Cloud free): $0
  - Dominios, SSL: $5
  - Backup storage: $20
  - Otros: $25

Costos variables por tenant:
  - Demo: $5/mes (subsidiado)
  - Blue: $3/mes
  - ProMax: $12/mes
  - Enterprise: $50-500/mes

Punto de equilibrio:
  - Solo Blue: 50 tenants → $1,450 - $150 = $1,300/mes
  - Mezcla típica (20 Blue + 5 ProMax + 1 Enterprise): 
    $580 + $395 + $2,500 = $3,475 - $150 - ($60 + $60 + $200) = $3,005/mes
  - Rentabilidad desde el mes 1 si se consiguen 5 clientes de pago
```

---

## 8. Definición de Éxito por Fase del Roadmap

| Fase | Éxito Técnico | Éxito de Negocio | KPI Objetivo |
|------|---------------|------------------|--------------|
| **F0 - Fundación** | Infraestructura estable, 11 servicios OK | — | — |
| **F1 - WhatsApp + IA + Twenty** | Flujo inbound funcional, campañas reales | 1 lead/día procesado, precisión > 80% | KPI-3 > 70% auto-resolución |
| **F2 - Frappe ERP** | Sincronización Twenty ↔ Frappe | Ventas automatizadas | KPI-1 > 10% conversión |
| **F3 - Lumi Sales Copilot** | Panel de insights en Twenty | Vendedores usan el copiloto > 5h/día | KPI-5 > 60 pipeline health |
| **F4 - IA Avanzada** | RAG + state machine + function calling + multi-idioma | Precisión > 90%, multi-idioma funcional | KPI-3 > 85% auto-resolución, KPI-4 < $0.005/lead |
| **F5 - Producción** | SSL, monitoreo, backups, CI/CD | 0 outages, backup restaurable | Uptime > 99.9% |
| **F6 - Analytics** | Dashboards BI, forecasting | Clientes usan analytics para decisiones | KPI-6 > 75 CSAT |
| **F7 - Multi-Tenant** | 50+ tenants activos, onboarding automático | Reducción de CAC, NPS > 50 | 50 tenants de pago, churn < 5%/mes |

---

> **Resumen de la Estrategia de Negocio:** 4 planes escalonados (Demo → Blue → ProMax → Enterprise) que cubren desde el pastelero individual hasta la corporación multi-sucursal. 6 KPIs centrales para no ahogar en datos (cada módulo muestra los suyos cuando navegas). Un switcher de contexto que automáticamente adapta el agente a la industria del cliente (pastelería, electrodomésticos, servicios) sin que el usuario tenga que configurar nada más que su catálogo. Las métricas de salud del agente permiten detectar cuándo algo anda mal antes de que el cliente se queje.
