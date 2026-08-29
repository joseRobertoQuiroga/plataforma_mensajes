# Consideraciones y Requisitos Omnicanal (Meta, TikTok y Telegram) con Soporte Multimodal

Con base en el contexto y arquitectura de la **Plataforma de Mensajes (Wibsite)** (específicamente la configuración de Chatwoot, n8n, Helper Node y la base de datos PostgreSQL), la plataforma funciona como un ecosistema omnicanal multimodal. A continuación se detallan los servicios, configuraciones, permisos y consideraciones operativas que se necesitan de Meta (Facebook/WhatsApp/Instagram), TikTok y Telegram para habilitar la recepción y envío de texto y archivos (audio, imágenes, documentos, etc.).

---

## 1. Servicios y Productos Requeridos

### A. WhatsApp Business API (Cloud API)
Canal principal (flujos de inbound, campañas y scoring).
- **Uso en la plataforma:** Atención y triage vía Dify + Twenty CRM, envío masivo automatizado (n8n), inbox omnicanal.
- **Configuración requerida:** Producto "WhatsApp" en la App de Meta en el portal de Facebook Developers.

### B. Facebook Messenger API (Graph API v21)
- **Uso en la plataforma:** Canal de atención automatizada y recepción de leads.
- **Configuración requerida:** Producto "Messenger" en la App de Meta vinculado a Páginas de Facebook.

### C. Instagram Graph API (Direct Messages y Comentarios)
- **Uso en la plataforma:** Atención de mensajes directos (DMs) e interacciones mediante comentarios.
- **Configuración requerida:** Vinculación obligatoria de una cuenta de Instagram Profesional (Business o Creator) con una Página de Facebook y habilitación de "Acceso a mensajes" en la app móvil.

### D. TikTok API (Direct Messages y Comentarios)
- **Uso en la plataforma:** Recepción de DMs y clasificación de comentarios entrantes al Helper Node.
- **Configuración requerida:** Aplicación en **TikTok for Developers**. Para acceso comercial a DMs, requiere una cuenta "TikTok for Business" y aprobación explícita (a veces mediada por partners agregadores).

### E. Telegram Bot API
Mencionado como parte clave del ecosistema de adaptadores y recepción de audios/fotos.
- **Uso en la plataforma:** Canal de comunicación directo y notificaciones internas/externas de leads.
- **Configuración requerida:** Creación de un Bot oficial a través del usuario **BotFather** en la misma app de Telegram.

---

## 2. Requisitos de Configuración y Variables de Entorno (`.env`)

Los servicios (Helper Node, n8n, Chatwoot) necesitarán las siguientes variables:

### Credenciales de Meta (Facebook/WhatsApp/Instagram)
* `META_APP_ID` / `META_APP_SECRET`: Identificadores de la aplicación pública en Meta.
* `META_APP_ACCESS_TOKEN` / `System User Token`: Token permanente para envíos proactivos de IA y extracción de archivos adjuntos (multimedia).
* `WHATSAPP_PHONE_NUMBER_ID` / `WHATSAPP_BUSINESS_ACCOUNT_ID`: Identificadores WABA.
* `MESSENGER_PAGE_TOKEN`: Token de acceso para manejar Messenger e Instagram.
* `META_WEBHOOK_VERIFY_TOKEN`: Cadena secreta (hash) para validación de origen en webhooks entrantes.

### Credenciales de TikTok
* `TIKTOK_APP_ID` / `TIKTOK_APP_SECRET`: Identificadores de la App en TikTok.
* `TIKTOK_ACCESS_TOKEN`: Token OAuth para actuar (responder DMs o comentarios).
* `TIKTOK_WEBHOOK_SECRET`: Token para firmar/validar los webhooks recibidos.

### Credenciales de Telegram
* `TELEGRAM_BOT_TOKEN`: Token de autenticación único provisto por BotFather (formato `123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11`).

---

## 3. Webhooks (Rutas a Configurar en los Portales)

Las plataformas exigen que el backend esté expuesto (HTTPS válido) para recibir los eventos multimodales en tiempo real.

1. **Webhook de Meta (WhatsApp, Messenger, Instagram):** 
   - `https://<dominio>/webhooks/whatsapp` y `https://<dominio>/webhooks/messenger`
   - Campos: `messages`, `messaging_postbacks`, `message_deliveries`, `instagram_manage_messages`, `instagram_manage_comments`.
2. **Webhook de TikTok (Comentarios y Mensajes):** 
   - `https://<dominio>/webhooks/tiktok-comments`
   - Eventos: `im.message.receive` y `video.comment.create`.
3. **Webhook de Telegram:** 
   - `https://<dominio>/webhooks/telegram`
   - Se configura mediante una petición HTTP directa: `https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook?url=...`

> **Nota de desarrollo:** Durante el trabajo en local, se debe usar un túnel (como **ngrok**) para exponer `http://localhost:3100` y usar la URL segura (`https`) en Meta, TikTok y Telegram.

---

## 4. Permisos y Scopes Requeridos (App Review)

Para operar en producción, se requiere validación y aprobación de las plataformas:

* **Meta:** `whatsapp_business_messaging`, `pages_messaging`, `instagram_manage_messages`, `instagram_manage_comments`.
* **TikTok:** `im.message.send`, `im.message.receive`, `comment.list`, `comment.create`, `comment.reply`.
* **Telegram:** Telegram es abierto y **no requiere App Review**. El Bot puede recibir archivos, texto y comandos desde el momento de su creación.

---

## 5. Consideraciones para el Manejo Multimodal (Audio, Imagen, Video y Documentos)

Dado que la plataforma maneja la información de forma **multimodal** (procesando audios como texto, analizando imágenes de clientes y enviando catálogos o notas de voz generadas por IA), existen implicaciones técnicas estrictas sobre cómo estas 4 APIs interactúan con la capa de datos:

### A. Recepción de Archivos Multimodales (Inbound)
* **Telegram (`file_id`):** Telegram envía un `file_id` en el webhook (audio, fotos, docs). El Helper Node debe usar el método `getFile` para obtener una ruta y luego descargar físicamente el archivo (`api.telegram.org/file/bot<token>/<ruta>`).
* **Meta y TikTok (Webhooks con URLs Efímeras):** Al igual que Telegram, no se envía el archivo físico. Envían un identificador (`media_id`) o una URL protegida.
* **Descarga Segura Obligatoria:** Para que Dify o Twenty "vean" el archivo, el Helper Node de Wibsite debe descargarlo al instante, usando el `META_APP_ACCESS_TOKEN` en Meta o las llamadas específicas en Telegram/TikTok. Si se tarda en descargar, las URLs o IDs suelen caducar por seguridad.
* **Procesamiento de Notas de Voz (STT):** Los audios entrantes (WhatsApp PTT, Telegram Voice) deben pasarse por un servicio de **Speech-to-Text** (como Whisper o el adaptador STT en OpenRouter) y el texto resultante se inyecta como entrada (prompt) a Dify para ser clasificado.
* **Análisis de Imágenes (Vision):** Las fotografías (comprobantes, soporte técnico) deben descargarse y pasarse en Base64 o URL pública al LLM (GPT-4o, Claude 3.5) para extraer contexto antes de mandarlo al CRM.

### B. Almacenamiento Intermedio Persistente (MinIO / S3)
* **Caducidad de los enlaces nativos:** Como los enlaces originales de las plataformas expiran rápido y son privados, el Helper Node es un puente: **descarga y sube el archivo a MinIO** (solución de almacenamiento del `docker-compose.yml`).
* **Acceso de Chatwoot y Twenty:** MinIO genera una URL local, unificada y persistente, permitiendo que agentes humanos en Chatwoot o el perfil del lead en Twenty CRM tengan acceso permanente a las imágenes o audios generados a partir del canal.

### C. Envío de Multimedia generado por IA (Outbound)
* **Envío mediante URL vs. Upload API:** Para mandar un PDF, foto o audio desde Wibsite hacia WhatsApp/TikTok, Meta permite dos vías: indicar una URL pública o subir el binario obteniendo a cambio un `media_id`. Telegram permite subir el archivo directamente en `multipart/form-data` o mandar una URL pública. Si MinIO está configurado internamente y no expone archivos públicamente al exterior, **el Helper Node estará forzado a usar las APIs de Subida (Upload API o multipart form) en lugar de links directos**.
* **Notas de Voz Generadas (TTS):** Si el agente de IA decide responder a un audio enviando otra nota de voz, la respuesta en texto de Dify debe ser convertida por un servicio de **Text-to-Speech (TTS)**. El archivo `.ogg` resultante se sube a Telegram (como `voice`) o Meta (como `ptt` o `audio`) para ser reproducido nativamente en la aplicación del cliente final.
* **Plantillas Multimodales (WhatsApp):** Para las campañas enviadas vía `02-campaign-broadcast.json`, las plantillas preaprobadas por Meta admiten "Headers" (Imagen, Video o PDF). El webhook deberá inyectar enlaces públicos válidos (de MinIO o un CDN público) hacia Meta al despachar la lista de distribución.

---

## 6. Consideraciones Estratégicas Finales

1. **Ventana de 24 Horas:** En Meta (WhatsApp, Messenger, Instagram DMs), el bot multimodal solo puede mandar respuestas libres en las 24 horas siguientes al mensaje del usuario. TikTok DMs posee restricciones similares. Telegram no tiene esta restricción de 24 horas; los bots pueden interactuar con el usuario meses después sin costo extra, ideal para retargeting a costo cero.
2. **Webhooks y Tiempos de Respuesta (Timeouts):** Meta, TikTok y Telegram esperan que el Webhook responda rápido (`200 OK`). Como la inferencia de un pipeline multimodal (Descarga -> Audio a Texto -> Dify LLM -> Texto a Audio) tarda decenas de segundos, el Helper Node **debe** devolver el `200 OK` instantáneamente (asíncrono) o las plataformas bloquearán los webhooks por creer que el servidor está caído.
