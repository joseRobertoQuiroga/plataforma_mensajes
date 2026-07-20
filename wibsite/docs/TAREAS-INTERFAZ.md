# Tareas de Interfaz y Flujos — Validación Visual

## Convención
- [ ] Pendiente de probar/construir
- [x] Verificado funcionando
- [!] Funciona con limitaciones

---

## 1. Hub Central

### 1.1 Página Principal
- [x] `http://localhost:8080/hub/` renderiza mosaico con tarjetas
- [x] Cada tarjeta tiene: icono, nombre, descripción, credenciales, puerto
- [x] LEDs de estado: verde (online), rojo (offline), amarillo (pendiente)
- [x] Barra superior muestra estado general del sistema
- [ ] LEDs reflejan estado **real** en tiempo real (actualmente estáticos)
- [ ] Click en tarjeta abre plataforma en nueva pestaña

### 1.2 Redirecciones
- [x] `http://localhost:8080/` → 302 → `/hub/`
- [x] `http://localhost:8080/hub/` → 200

### 1.3 Acceso a Plataformas
- [x] `/n8n/` → n8n Web UI
- [x] `/crm/` → Twenty CRM
- [x] `/chatwoot/` → Chatwoot
- [x] `/admin/` → Dashboard SPA Helper
- [x] `/api/health` → Health JSON
- [ ] `/dify/` → Dify Web (retorna 404 vía nginx, usar `:3003` directo)

---

## 2. Dashboard SPA (Helper)

### 2.1 Tab Dashboard (Resumen)
- [x] Cards: total campañas, leads, deliveries, entregas hoy
- [x] LEDs de canales: 5 canales con indicador visual
- [x] Barra de entregas: sent / delivered / read / replied / failed
- [x] Última actualización con timestamp
- [x] Auto-refresh cada 15 segundos
- [!] Botones rápidos funcionan pero no muestran spinner de carga

### 2.2 Tab Campañas
- [x] Tabla con todas las campañas
- [x] Columnas: nombre, canal, estado, mensajes enviados, fecha
- [x] Botón "Nueva Campaña" → crea campaña vía API
- [x] Botón "Importar Leads" → modal de subida Excel
- [x] Badges de estado: draft (gris), scheduled (azul), sending (verde), completed, paused, failed
- [x] Acciones por campaña: ▶ Iniciar, ⏸ Pausar, ✏ Editar, 🗑 Eliminar
- [ ] Verificar que acciones cambian estado visiblemente en la tabla
- [ ] Verificar que el progreso se actualiza sin recargar página

### 2.3 Importar Leads (Modal)
- [x] Drag & drop + selector de archivos
- [x] Soporta .xlsx, .xls, .csv
- [x] Previsualización de datos parseados antes de confirmar
- [x] Detección automática de columnas (phone, name, email)
- [x] Reporte de resultados: creados, errores, duplicados
- [x] Campos no mapeados van a custom_fields automáticos
- [ ] Verificar con archivo UTF-8 con caracteres especiales (ñ, tildes)
- [ ] Verificar con archivo >1000 filas

### 2.4 Tab Leads
- [x] Tabla con todos los leads
- [x] Columnas: nombre, teléfono, email, score, estado, campaña
- [x] Barras de progreso con colores por rango de score
- [x] Filtro por campaña y estado
- [x] Score categorizado: hot (rojo), warm (amarillo), cold (gris)
- [ ] Verificar que leads se actualizan después de scoring

### 2.5 Tab Plantillas
- [x] Filtro por canal (WhatsApp, Messenger, TikTok, SMS, Email)
- [x] 11 plantillas predefinidas
- [x] Preview con variables reemplazables ({{name}}, {{business}}, etc.)
- [x] Crear nueva plantilla (name, channel, body, variables)
- [x] Eliminar plantilla
- [ ] Verificar que plantillas se persisten entre reinicios de helper

### 2.6 Tab Canales
- [x] Detalle por canal: estado, mensaje de estado, último check
- [x] LEDs con color según estado
- [x] Contador de errores
- [ ] Verificar que estado se actualiza al hacer PATCH /api/channels/:channel

### 2.7 Acciones Rápidas (Botones)
- [x] ☁ Sync CRM → Sincroniza todos los leads a Twenty
- [x] 📊 Score All → Evalúa scoring de todos los leads
- [x] 🌱 Seed → Genera datos de prueba
- [x] 🗑 Clear → Limpia todos los datos
- [x] ⟳ Refresh → Recarga todos los datos
- [ ] Verificar que botón Sync CRM muestra resultado en pantalla
- [ ] Verificar que botón Score All muestra distribución hot/warm/cold

---

## 3. n8n Web UI

### 3.1 Login y Navegación
- [x] `http://localhost:8080/n8n/` carga la UI
- [x] Login con admin@wibsite.com / Wibsite2024!
- [ ] Verificar que dashboard principal muestra workflows
- [ ] Verificar que la UI es responsiva

### 3.2 Workflows
- [ ] Abrir workflow "01 - Inbound WhatsApp → Dify → Twenty CRM"
- [ ] Ver nodos: Webhook → HTTP Request (helper) → Dify → Twenty → Respond
- [ ] Activar workflow (toggle "Active")
- [ ] Abrir workflow "02 - Campaign Broadcast WhatsApp"
- [ ] Ver nodos: Schedule Trigger → Get Leads → Send Messages → Track
- [ ] Activar workflow

### 3.3 Ejecuciones
- [ ] Workflow "01" se ejecuta al recibir POST a /webhook/whatsapp-inbound
- [ ] Workflow "02" se ejecuta manualmente (botón "Execute Workflow")
- [ ] Ver logs de ejecución: green checkmarks en cada nodo
- [ ] Ver datos de entrada/salida en cada nodo

---

## 4. Twenty CRM UI

### 4.1 Login y Navegación
- [x] `http://localhost:8080/crm/` carga la UI
- [x] Login con admin@wibsite.com / Admin@123
- [ ] Verificar que el workspace predeterminado carga

### 4.2 Personas (People)
- [ ] Ir a People → ver lista de contactos sincronizados
- [ ] Campos custom visibles: painPoints, interests, leadOrigin, leadLastScore
- [ ] Verificar que teléfonos tienen prefijo +
- [ ] Verificar que emails están correctos

### 4.3 Sincronización desde Dashboard
- [x] Botón ☁ Sync CRM en Dashboard → crea/actualiza personas
- [ ] Refrescar Twenty UI después de sync → ver nuevos contactos
- [ ] Re-sync: verificar que se actualizan campos (no duplica)

---

## 5. Dify Web UI

### 5.1 Login
- [ ] `http://localhost:3003` (directo) carga login de Dify
- [ ] Login con joserobertoquirogasalvador@gmail.com / Admin@123
- [ ] Verificar que el workspace "Wibsite" aparece

### 5.2 Studio - WhatsApp Lead Classifier
- [ ] Ir a "Studio" → buscar app "WhatsApp Lead Classifier"
- [ ] Abrir workflow → ver grafo vacío (pendiente de construir)
- [ ] Construir workflow con 6 nodos:
  1. Start (trigger)
  2. LLM Node: detect_language
  3. LLM Node: classify_intent
  4. LLM Node: extract_contact_data
  5. Code Node: calculate_score
  6. LLM Node: generate_response
  7. End (output: JSON con score, category, response)
- [ ] Probar workflow con mensaje de ejemplo
- [ ] Publicar workflow (botón "Publish")

### 5.3 Modelos y Proveedores
- [ ] Ir a Settings → Model Provider
- [ ] Verificar plugin "OpenAI API Compatible" instalado
- [ ] Verificar modelos: gpt-4o-mini, gpt-4o, llama-3.3-70b, mistral-large
- [ ] Probar conexión con OpenRouter

---

## 6. Chatwoot Web UI

### 6.1 Login
- [x] `http://localhost:8080/chatwoot/` carga la UI
- [x] Login con admin@wibsite.com / Admin@123
- [ ] Verificar que el dashboard de Chatwoot carga correctamente

### 6.2 Inbox Configuración
- [ ] Settings → Inboxes → "Add Inbox"
- [ ] Seleccionar canal WhatsApp
- [ ] Configurar con datos Meta:
  - Phone Number ID: 1287367854450926
  - Business Account ID: 1024953670257131
  - Access Token: (permanente de Meta Business)
  - Webhook Verify Token: wibsite_verify_2026
- [ ] Verificar que webhook "connected" aparece

### 6.3 Conversaciones
- [ ] Ver inbox de WhatsApp en Chatwoot
- [ ] Responder a un mensaje desde Chatwoot
- [ ] Verificar que la respuesta llega al usuario

---

## 7. Flujos End-to-End (Visuales)

### 7.1 Flujo de Datos de Prueba
```
Dashboard (Seed) → Ver campañas aparecen en tabla
                  → Ver leads aparecen en tabla
                  → Ver canales con LEDs
                  → Ver resumen en cards
```

### 7.2 Flujo de Scoring
```
Dashboard (Score All) → Spinner / loading state
                      → Resultado: X hot, Y warm, Z cold
                      → Leads actualizan su score
                      → Barras de progreso cambian de color
```

### 7.3 Flujo de CRM Sync
```
Dashboard (Sync CRM) → Loading state
                     → Resultado: X synced, Y errors
                     → Twenty UI → People → ver contactos nuevos
```

### 7.4 Flujo de Importación Excel
```
Tab Campañas → Seleccionar campaña → Click "Importar Leads"
             → Modal: drag .xlsx file
             → Preview: ver columnas detectadas
             → Confirmar → Reporte: X creados, Y duplicados, Z errores
             → Tab Leads: ver nuevos leads importados
```

### 7.5 Flujo de Template
```
Tab Plantillas → Filtrar por WhatsApp
               → Click "welcome-whatsapp"
               → Click Preview → reemplazar {{name}}, {{business}}
               → Ver body renderizado
               → Click "Nueva" → crear template custom
               → Verificar aparece en lista
```

### 7.6 Flujo de Webhook WhatsApp (Simulado)
```
Powershell: Invoke-WebRequest a POST /webhooks/whatsapp
  → Helper crea lead
  → Dashboard: ver nuevo lead en tabla
  → Dashboard: ver delivery en stats
```

---

## 8. Resumen Visual del Sistema

### Mapa de Navegación
```
http://localhost:8080/
  └── /hub/ → Mosaico de plataformas
       ├── /admin/ → Dashboard SPA (Helper)
       │    ├── Tab Dashboard → Resumen + LEDs + Botones rápidos
       │    ├── Tab Campañas → CRUD + Importar Excel
       │    ├── Tab Leads → Scores + Estados + Filtros
       │    ├── Tab Plantillas → 11 templates + Preview + Crear
       │    └── Tab Canales → Estado + LEDs + Errores
       ├── /n8n/ → Workflows + Ejecuciones
       ├── /crm/ → Twenty CRM (People + Companies)
       ├── /chatwoot/ → Inbox omnicanal
       └── /dify/ → (fallback a :3003 directo)
            └── Studio → Workflows IA
```

### Pantallas Principales (qué verificar en cada una)
| Pantalla | Elemento Clave | Qué Verificar |
|----------|---------------|---------------|
| Hub | LEDs de estado | Color correcto según servicio |
| Dashboard | Cards resumen | Números actualizados |
| Dashboard | LEDs canales | WhatsApp verde si configurado |
| Campañas | Tabla | Columnas correctas, badges de estado |
| Campañas | Importar | Modal se abre, preview funciona |
| Leads | Scores | Barras de colores, categorías |
| Plantillas | Preview | Variables reemplazadas correctamente |
| n8n | Workflows | Activos, ejecutan sin error |
| Twenty CRM | People | Contactos sincronizados con campos custom |
| Chatwoot | Inbox | Conversaciones visibles |
