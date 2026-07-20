# Tareas Funcionales por Objetivo del Sistema

## Objetivo General
Plataforma SaaS de mensajería omnicanal con IA 24/7 que permite gestionar campañas, leads, scoring, CRM y automatizaciones desde un solo lugar, multi-cuenta y multi-usuario.

---

## 1. Gestión de Campañas Multi-Canal

### 1.1 Creación y Configuración
- [x] Crear campaña con nombre, canal, template, filtro de audiencia
- [x] Definir canal destino: WhatsApp, Messenger, TikTok, SMS, Email
- [x] Seleccionar plantilla de mensaje predefinida
- [x] Configurar filtro de audiencia (segmento, score mínimo)
- [x] Programar envío futuro (scheduled_at)
- [ ] Editar campaña existente (cambiar template, audiencia)

### 1.2 Ciclo de Vida
- [x] Estado borrador (draft)
- [x] Estado programado (scheduled) — con fecha definida
- [x] Estado enviando (sending) — en progreso
- [x] Estado completado (completed) — finalizado
- [x] Estado pausado (paused) — detenido temporalmente
- [x] Estado fallido (failed) — error durante envío
- [ ] Transiciones: draft → scheduled → sending → (paused → sending) → completed
- [ ] Verificar que campañas programadas se activan automáticamente

### 1.3 Monitoreo de Campaña
- [x] Ver estadísticas en tiempo real: sent, delivered, read, replied, failed
- [x] Ver progreso en Dashboard (cards + barra)
- [ ] Ver detalles de cada delivery por lead
- [ ] Exportar reporte de campaña

---

## 2. Importación y Gestión de Leads

### 2.1 Carga de Leads
- [x] Crear leads individuales vía API
- [x] Importación masiva desde Excel (.xlsx, .xls)
- [x] Importación desde CSV
- [x] Detección automática de columnas (phone, name, email)
- [x] Validación: requiere phone o email por fila
- [x] Detección de duplicados dentro de la misma campaña
- [x] Reporte detallado: creados, errores, duplicados
- [x] Campos no mapeados → custom_fields automáticos
- [ ] Importación con acentos y caracteres UTF-8
- [ ] Importación de >1000 leads sin timeout
- [ ] Importación desde API externa (webhook)

### 2.2 Gestión de Leads
- [x] Listar leads por campaña
- [x] Filtrar por estado (pending, sent, delivered, replied, failed, opted_out)
- [x] Ver score individual
- [x] Ver historial de scores
- [ ] Editar lead individual (cambiar nombre, teléfono, email)
- [ ] Eliminar lead individual
- [ ] Mover lead entre campañas
- [ ] Búsqueda por nombre/teléfono/email

### 2.3 Webhook WhatsApp (Leads Entrantes)
- [x] Receptor de webhook Meta WhatsApp
- [x] Crea lead automáticamente cuando usuario escribe
- [x] Crea delivery (inbound) para cada mensaje
- [ ] Asignar lead a campaña activa automáticamente
- [ ] Notificar en Dashboard cuando llega lead nuevo

---

## 3. Scoring de Leads

### 3.1 Scoring por Reglas (Rule-Based)
- [x] Evaluación individual de lead
- [x] Evaluación masiva de todos los leads
- [x] 5 factores ponderados configurables
- [x] 8 reglas condicionales configurables
- [x] Categorización: hot (70+), warm (40-69), cold (0-39)
- [x] Historial de scores almacenado
- [x] Actualización de score en lead
- [x] Reglas:
  - +20 si ha respondido
  - +10 si ha abierto
  - +15 si ha hecho click
  - +10 si tiene phone y email
  - +5 si tiene 2+ campos custom
  - +15 si contacto reciente (<7 días)
  - +8 si contacto medio (8-30 días)
  - -100 si ha hecho opt-out

### 3.2 Scoring con IA (LLM via OpenRouter)
- [x] Endpoint `/api/scoring/evaluate-llm`
- [x] Usa GPT-4o Mini para análisis contextual
- [x] Prompt con datos del lead, entregas, campaña
- [x] Retorna score (0-100), categoría, razonamiento
- [x] Almacena resultado en historial de scores
- [ ] Comparar precisión entre rule-based vs LLM
- [ ] Configurar threshold para usar LLM vs rule-based
- [ ] Cache de resultados LLM para evitar llamadas repetidas

### 3.3 Visualización de Scores
- [x] Barras de progreso con colores por rango
- [x] Categoría hot/warm/cold visible
- [x] Top leads por score
- [ ] Gráfico de distribución de scores
- [ ] Timeline de score por lead (evolución)

---

## 4. Sincronización con Twenty CRM

### 4.1 Conexión
- [x] API Key JWT configurada
- [x] Health check del servicio
- [x] Autenticación REST API funcional
- [x] Endpoints: People, Companies, Opportunities

### 4.2 Sincronización de Leads
- [x] Sync individual (upsert por teléfono)
- [x] Sync masivo de todos los leads
- [x] Normalización de teléfonos (prefijo +)
- [x] Campos custom mapeados:
  - painPoints → Problemas del lead
  - interests → Intereses del contacto
  - leadOrigin → Origen del lead
  - leadScoreHistory → Historial de scores (JSON)
  - leadLastScore → Score actual
  - leadCustomData → Datos adicionales (JSON)
- [x] Actualización de registros existentes
- [x] Guarda twenty_id en lead local (para re-sync)

### 4.3 Bidireccionalidad (Futuro)
- [ ] Escuchar cambios en Twenty CRM → actualizar helper
- [ ] Sincronizar oportunidades desde Twenty a campañas
- [ ] Webhook de Twenty CRM hacia helper

---

## 5. Automatización con n8n

### 5.1 Workflow: Inbound WhatsApp → IA → CRM
- [ ] Webhook HTTP recibe mensaje entrante
- [ ] Llama a helper (POST /webhooks/whatsapp-inbound)
- [ ] Clasifica con Dify (LLM): intención, idioma, score
- [ ] Crea/Actualiza persona en Twenty CRM
- [ ] Responde al usuario vía WhatsApp
- [ ] Registra delivery con tracking

### 5.2 Workflow: Campaign Broadcast
- [ ] Trigger: Schedule o manual
- [ ] Obtiene leads de campaña activa vía helper API
- [ ] Envía mensajes vía Meta WhatsApp API
- [ ] Tracking de estado de cada envío
- [ ] Reporte de resultados

### 5.3 Workflow: Opt-Out Processing
- [ ] Detecta palabra "stop" en mensaje entrante
- [ ] Registra opt-out en helper
- [ ] Actualiza lead como opted_out
- [ ] Notifica al administrador
- [ ] Detiene envíos futuros al contacto

---

## 6. Clasificación con IA (Dify)

### 6.1 Workflow: WhatsApp Lead Classifier
- [ ] 6 nodos en workflow:
  1. detect_language — detecta idioma del mensaje
  2. classify_intent — clasifica intención (venta, soporte, info, queja)
  3. extract_contact_data — extrae nombre, email, teléfono
  4. calculate_score — calcula score del lead
  5. generate_response — genera respuesta contextual
  6. assemble_result — ensambla resultado final
- [ ] Publicar workflow en Dify
- [ ] Probar con mensajes de ejemplo
- [ ] Integrar con n8n vía API de Dify

### 6.2 Agente Conversacional 24/7
- [ ] Crear agente en Dify con contexto de negocio
- [ ] Conectar a WhatsApp vía webhook
- [ ] Responder preguntas frecuentes automáticamente
- [ ] Escalar a humano cuando sea necesario
- [ ] Historial de conversaciones

### 6.3 RAG (Retrieval Augmented Generation)
- [ ] Configurar Weaviate como vector store
- [ ] Subir documentos de conocimiento del negocio
- [ ] Conectar a Dify para búsqueda semántica
- [ ] QA automático sobre documentos

---

## 7. Gestión de Opt-Out (Cumplimiento)

### 7.1 Registro
- [x] Registrar opt-out por teléfono
- [x] Registrar opt-out por email
- [x] Especificar canal origen
- [x] Especificar razón y fuente
- [x] Detección automática desde webhook (mensaje "stop")

### 7.2 Verificación
- [x] Endpoint público: GET /api/opt-outs/check?phone=XXX
- [x] Marca leads relacionados como opted_out
- [ ] Bloquear envío a leads opted_out automáticamente
- [ ] Reporte de opt-outs por campaña

---

## 8. Plantillas de Mensajes

### 8.1 Gestión
- [x] 11 plantillas predefinidas (5 canales)
- [x] Crear plantilla personalizada
- [x] Eliminar plantilla
- [x] Filtrar por canal
- [x] Variables reemplazables {{name}}, {{business}}, etc.
- [x] Preview con valores de prueba

### 8.2 Catálogo de Plantillas
| Canal | Plantillas |
|-------|-----------|
| WhatsApp | Bienvenida, Promoción, Seguimiento |
| Messenger | Bienvenida, Oferta |
| TikTok | Promoción DM, Seguimiento |
| SMS | Notificación, Promoción |
| Email | Newsletter, Seguimiento post-demo |

### 8.3 Validación
- [x] Contador de caracteres
- [ ] Validar límite SMS (160 chars)
- [ ] Validar caracteres no soportados por canal

---

## 9. Dashboard y Monitoreo

### 9.1 Resumen Global
- [x] Total campañas, activas, completadas
- [x] Total leads, leads con scoring
- [x] Total deliveries, entregas hoy
- [x] Top lead por score
- [x] Estado de todos los canales

### 9.2 LEDs de Canal
- [x] WhatsApp: connected / disconnected / pending / error
- [x] Messenger: connected / disconnected / pending / error
- [x] TikTok: connected / disconnected / pending / error
- [x] SMS: connected / disconnected / pending / error
- [x] Email: connected / disconnected / pending / error

### 9.3 Métricas en Tiempo Real
- [x] Auto-refresh cada 15 segundos
- [x] Barra de entregas por estado
- [ ] Gráfico de tendencia de leads
- [ ] Gráfico de entregas por hora/día
- [ ] Tasa de conversión (replied / sent)

---

## 10. Integración con Meta/WhatsApp

### 10.1 Configuración
- [x] App creada en Meta Developers
- [x] Webhook verify token configurado
- [x] Número de teléfono verificado (+591 75210458)
- [x] Webhook GET responde correctamente
- [ ] Token permanente (actualmente temporales)
- [ ] Webhook registrado en Meta (requiere URL pública)

### 10.2 Envío de Mensajes
- [x] Envío de texto plano (probado con token temporal)
- [ ] Envío de templates aprobados
- [ ] Envío con botones/CTA
- [ ] Envío de imágenes/documentos
- [ ] Manejo de rate limits (1 msg/seg aprox)
- [ ] Manejo de ventana 24h (customer-initiated)

### 10.3 Recepción de Mensajes
- [x] Webhook POST recibe mensajes entrantes
- [x] Crea lead automáticamente
- [x] Reenvía a n8n
- [ ] Respuesta automática vía IA
- [ ] Manejo de mensajes multimedia (imagen, audio, video)

---

## 11. Seguridad y Multi-Tenant

### 11.1 Seguridad
- [x] API Keys para cada servicio
- [x] JWT para Twenty CRM
- [x] Secrets en .env (no hardcodeados)
- [x] PostgreSQL con contraseña
- [x] Nginx como único punto de entrada
- [ ] HTTPS/TLS configurado
- [ ] Rate limiting en API
- [ ] Validación de webhooks Meta (firma HMAC)

### 11.2 Multi-Tenant (Futuro)
- [ ] Separación de datos por cuenta/cliente
- [ ] Migración de JSON Store a PostgreSQL con tenant_id
- [ ] Portal de administración multi-cuenta
- [ ] Facturación por uso
- [ ] Roles y permisos (admin, agent, viewer)

---

## 12. Estado por Objetivo

| # | Objetivo | Estado | Prioridad |
|---|----------|--------|-----------|
| 1 | Gestión de Campañas | ✅ 80% | Alta |
| 2 | Importación Leads | ✅ 85% | Alta |
| 3 | Scoring Rule-Based | ✅ 90% | Alta |
| 4 | Scoring con IA | 🟡 50% | Media |
| 5 | Twenty CRM Sync | ✅ 85% | Alta |
| 6 | n8n Automatización | 🟡 40% | Alta |
| 7 | Dify Workflow IA | 🔴 10% | Alta |
| 8 | Opt-Out Management | ✅ 70% | Media |
| 9 | Plantillas | ✅ 85% | Media |
| 10 | Dashboard | ✅ 80% | Alta |
| 11 | WhatsApp Integration | 🟡 35% | Alta |
| 12 | Seguridad Multi-Tenant | 🔴 15% | Futura |

### Leyenda
- ✅ Funcional (completo o casi completo)
- 🟡 Parcial (funcional pero incompleto)
- 🔴 Bloqueado (no funcional o no iniciado)

### Próximos Pasos Prioritarios
1. Publicar workflow Dify (WhatsApp Lead Classifier)
2. Obtener token permanente de Meta WhatsApp
3. Activar workflows n8n
4. Registrar webhook en Meta Developers
5. Probar flujo completo: WhatsApp → Dify → n8n → Twenty → Response
