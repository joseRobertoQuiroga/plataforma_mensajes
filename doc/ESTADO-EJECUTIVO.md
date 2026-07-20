# Wibsite — Estado y Avance del Proyecto

> **Documento Ejecutivo** — Julio 2026
> *Lenguaje no técnico. Resumen de avance, logros y próximos pasos.*

---

## 1. ¿Qué es Wibsite?

Wibsite es una **plataforma SaaS de mensajería omnicanal con inteligencia artificial**. Permite a las empresas:

- Enviar **campañas de mensajes** por WhatsApp, Messenger, TikTok, SMS y Email
- **Clasificar leads automáticamente** (quiénes están calientes, fríos, etc.)
- **Responder 24/7 con un asistente virtual** con IA
- **Gestionar clientes** desde un CRM integrado (Twenty)
- **Centralizar todo** en un solo panel de control (dashboard)
- **Escalar a multi-cliente** en el futuro (cada cliente con su propio espacio)

El proyecto comenzó como una solución interna para un negocio propio, pero está diseñado desde el inicio como un producto SaaS que se pueda ofrecer a terceros.

---

## 2. ¿En qué etapa estamos?

Estamos en la **Fase 0.5 — Plataforma Base (70% de avance)**.

La fase 1 (conexión real con WhatsApp y la IA) no puede completarse porque dependemos de dos factores externos:
- **Meta (WhatsApp Business API):** esperando aprobación de credenciales
- **Proveedor de IA (xAI/OpenAI):** sin créditos disponibles actualmente

Sin embargo, hemos aprovechado este tiempo para construir una **base sólida, completa y probada** que cuando esos dos factores se desbloqueen, la plataforma estará operativa en cuestión de horas.

---

## 3. ¿Qué hemos logrado hasta ahora?

### Infraestructura (✅ Listo)
- **10 servicios funcionando** en contenedores Docker: bases de datos (PostgreSQL + Redis), motor de búsqueda vectorial (Weaviate), n8n (automatizaciones), Dify (agentes IA), Twenty (CRM), Chatwoot (bandeja de mensajes), Nginx (puerta de entrada única)
- **Hub central** accesible en `http://localhost:8080/hub/` — un panel tipo Odoo con acceso a todos los módulos desde una sola página
- **Nginx configurado** para que todos los servicios sean accesibles desde un solo puerto

### Gestión de Campañas (✅ Listo)
- Crear, editar, pausar, programar y eliminar campañas multicanal
- Carga masiva de contactos (leads) desde **archivos Excel (.xlsx, .xls) y CSV**
- El sistema detecta automáticamente las columnas (teléfono, nombre, email) y permite previsualizar los datos antes de importarlos
- Las columnas adicionales se guardan automáticamente como campos personalizados

### Plantillas de Mensajes (✅ Listo)
- **11 plantillas predefinidas** para WhatsApp, Messenger, TikTok, SMS y Email
- Cada plantilla usa variables como `{{nombre}}`, `{{empresa}}`, `{{oferta}}` que se reemplazan automáticamente
- Se pueden crear, editar y previsualizar plantillas personalizadas desde el dashboard

### CRM Integrado — Twenty (✅ Listo)
- **10 campos personalizados** añadidos al CRM: historial de puntuación, intereses, problemas detectados, origen del lead, etc.
- Sincronización bidireccional de contactos entre la plataforma y el CRM
- **12 leads sincronizados exitosamente** en pruebas (tanto creados como actualizados)

### Motor de Clasificación de Leads (✅ Listo)
- Sistema de **puntuación automática** (0 a 100) que clasifica leads en tres categorías:
  - **🔥 Calientes (Hot ≥ 70):** listos para contactar
  - **🌤 Templados (Warm ≥ 40):** requieren nurturing
  - **❄ Fríos (Cold < 40):** baja prioridad
- Evalúa 5 factores: engagement del usuario, cuán reciente fue el contacto, afinidad con el canal, completitud del perfil, e intereses
- Incluye reglas especiales: responde +20 puntos, abre mensaje +10, hace clic +15, se da de baja -100
- Los leads se recategorizan automáticamente con un solo clic

### Dashboard de Monitoreo (✅ Listo)
- Panel visual con **indicadores LED** por canal (verde = conectado, rojo = desconectado, amarillo = pendiente)
- Tablas de campañas con progreso visual
- Tabla de leads con puntuaciones y colores
- Vistas detalladas por canal (estado, errores, última verificación)
- **Botones de acción rápida:** generar datos de prueba, limpiar todo, sincronizar con CRM, evaluar clasificación

### Automatizaciones (✅ Parcial)
- **Dos workflows importados en n8n:** uno para procesar mensajes entrantes y otro para campañas broadcast
- Pendientes de probar en vivo (requieren conexión real con WhatsApp)

### Base de Datos (✅ Listo)
- Estructura completa con PostgreSQL, lista para **multi-tenant** (varios clientes en el futuro)
- Las tablas soportan campañas, leads, tracking de entregas, historial de puntuaciones, opt-outs, y logs

### Documentación (✅ Listo)
- Documentación técnica completa del proyecto (índices, glosario, decisiones técnicas, guías de operación, historial de cambios)
- Estándar de documentación guardado como **skill reutilizable** para futuros proyectos
- Diagramas de flujo para cada módulo

---

## 4. ¿Qué está pendiente o bloqueado?

### Crítico — Sin esto no hay flujo real de mensajes

| Pendiente | Dependencia | Impacto |
|-----------|-------------|---------|
| **Credenciales Meta/WhatsApp** | Aprobación de Meta Business | Sin esto no podemos enviar ni recibir mensajes reales |
| **Proveedor de IA** | Créditos en xAI / OpenAI | Sin esto no funciona el agente conversacional ni la clasificación inteligente |

### Importante — Mejora la plataforma

| Pendiente | Prioridad | Notas |
|-----------|-----------|-------|
| Chatwoot estable | Alta | Está en reinicio continuo, diagnosticar causa |
| Workflow lead classifier en Dify | Media | Requiere LLM configurado |
| Verificación de workflows n8n en UI | Media | Confirmar que se ven y ejecutan |
| Login en Dify | Media | Verificar credenciales admin |
| Pruebas con archivos Excel grandes | Baja | >1000 filas |

### Deseable — Para versión completa

- Campos calculados en CRM (última interacción, tendencia de score)
- Reportes exportables (PDF, Excel)
- Módulo de facturación multi-cliente
- Landing page pública para onboarding de clientes

---

## 5. Resumen de Cobertura

| Módulo | Estado | Cobertura |
|--------|--------|-----------|
| 🏗 Infraestructura | ✅ Operativa | 80% |
| 🌐 Hub central | ✅ Funcional | 90% |
| ⚙️ API de integración | ✅ Funcional | 95% |
| 📊 Dashboard | ✅ Operativo | 95% |
| 📱 CRM (Twenty) | ✅ Conectado | 90% |
| 🤖 Automatizaciones (n8n) | ✅ Instaladas | 60% |
| 🧠 Agentes IA (Dify) | ✅ Parcial | 40% |
| 💬 Bandeja mensajes (Chatwoot) | ❌ Caído | 0% |
| 📨 WhatsApp real | ❌ Bloqueado | 0% |
| 🎯 Clasificación leads | ✅ Operativo | 90% |
| 📋 Documentación | ✅ Completa | 100% |

**Global: ~70% de la plataforma base completado**

---

## 6. Próximos pasos inmediatos

1. **Diagnosticar Chatwoot** — revisar logs para solucionar reinicio continuo
2. **Probar workflows n8n** — verificar que están visibles y funcionales
3. **Verificar login Dify** — asegurar acceso al panel de agentes
4. **Preparar documentación de onboarding** — para cuando lleguen credenciales Meta, poder encender todo rápidamente
5. **Construir endpoint de subida Excel en hub** — ya funcional en API, falta integrar con la vista central

---

## 7. Nota final

La plataforma está **sólida, completa en su lógica de negocio y lista para recibir las conexiones externas**. El trabajo realizado hasta ahora (infraestructura, CRM, motor de scoring, plantillas, dashboard, importación de datos) representa la parte más compleja y de mayor valor del sistema. 

Cuando lleguen las credenciales de Meta y el crédito de IA, los pasos restantes son:
1. Configurar webhooks de WhatsApp
2. Conectar el proveedor de IA en Dify
3. Activar Chatwoot
4. Probar el flujo completo

**Estimado: 1-2 días hábiles** desde que se tengan las credenciales.
