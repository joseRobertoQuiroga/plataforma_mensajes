# 2. Monitorización y Control

Este documento aborda las herramientas de observabilidad, el manejo y control de flujos de datos en la arquitectura backend, la visualización de logs en tiempo real y el checklist técnico para desarrolladores y SysAdmins (QA Técnico).

---

## 1. Módulos de Monitorización y Control

El sistema incluye una pila completa de observabilidad y control de errores automatizada.

- **Prometheus & Grafana:** Métricas del sistema y consumo de recursos. (Disponible en `http://localhost:8080/grafana`)
- **GlitchTip (Sentry Open Source):** Rastreo de errores (Error Tracking). Captura excepciones del Helper Node y APIs (Puerto `8282`).
- **cAdvisor:** Métricas a nivel de contenedor Docker (CPU, Memoria, Red).

---

## 2. Dónde ver los Logs y Procesos en Tiempo Real

Para monitorear el flujo de datos del sistema, la lógica de los agentes y errores técnicos en vivo, debes utilizar la **Terminal** mediante los comandos de Docker Compose.

Ubicación en terminal: `c:\proyectos\plataforma_mensajes\wibsite`

### Ver logs generales (Todos los servicios mezclados)
`docker compose logs -f`

### Seguimiento específico por contenedor (Recomendado)
Para ver un flujo específico, puedes observar solo el contenedor responsable:

1. **Flujos de API, Webhooks y Sincronización:**
   `docker compose logs -f helper`
   *(Aquí verás peticiones entrantes de Meta, envíos a Twenty CRM, errores de validación de Excel, etc.)*

2. **Lógica de los Workflows y Envío Masivo:**
   `docker compose logs -f n8n`
   *(Verás las ejecuciones programadas y la respuesta de los nodos)*

3. **Lógica de Agente IA (Respuestas, RAG, y Tools):**
   `docker compose logs -f dify-api` y `docker compose logs -f dify-worker`

4. **Errores de Proxy y Acceso (Peticiones bloqueadas, CORS):**
   `docker compose logs -f nginx`

5. **Base de datos (Consultas y Errores SQL):**
   `docker compose logs -f postgres`

> **Tip de Terminal:** El flag `-f` significa "follow" (seguir). La terminal se quedará abierta mostrando nuevos logs. Para salir, presiona `Ctrl + C`.

---

## 3. Manejo, Control y Almacenamiento de Datos

### ¿Cómo comprobar el manejo correcto de la información?
El flujo de datos de Wibsite tiene como principio no perder información y mantener la sincronización constante. Para validar que la data se guarda y fluye bien:

1. **Revisión en el Helper (Caché y API):**
   - El Helper actúa como fuente de la verdad para envíos rápidos. Revisa los logs del helper al recibir un webhook.
2. **Revisión Permanente en PostgreSQL (`wibsite-postgres`):**
   - Asegúrate de que los esquemas (Twenty, Chatwoot, n8n, Dify) están guardando datos.
   - En Twenty, la tabla de `people` debe reflejar la actualización upsert (teléfono como llave principal) para evitar registros huérfanos.
3. **Logs de Workflows (n8n):**
   - Dentro de la UI de n8n, ir a la pestaña **Executions**. Ahí puedes ver el JSON exacto de cada payload entrante (Lead) y saliente (Twilio/WhatsApp) para corroborar que no haya truncamiento de variables.
4. **Vector Store (Weaviate):**
   - Para el contexto del agente, el conocimiento RAG se almacena aquí. Las respuestas fuera de contexto en Dify indican un problema de sincronización con Weaviate.

---

## 4. Checklist de Pruebas y Validaciones (Developer & QA Técnico)

### Pruebas de Infraestructura y Redes
- [ ] **Contenedores y Dependencias:** Todos los servicios `healthy` mediante `docker compose ps`.
- [ ] **SSO / OIDC (Authelia):** Verificar que el acceso a Grafana, MinIO y los endpoints administrativos requieren autenticación exitosa (redirección 302).
- [ ] **Aislamiento Multi-Tenant (Si aplica a Fase actual):** Validar que las consultas SQL en PostgreSQL tienen el filtro de `tenant_id` aplicado correctamente.

### Pruebas de Flujos de Datos (Backend)
- [ ] **Recepción de Webhooks:** Enviar un POST a `/webhooks/whatsapp` simulado y validar en `docker compose logs helper` que se parsea correctamente (200 OK).
- [ ] **Sincronización Bilateral:** 
  - Actualizar un score de lead en Helper y comprobar que se sincroniza a Twenty API en menos de 5 segundos.
  - Verificar que campos JSON complejos (historial de interacciones) se guardan bien en Twenty (campo TEXT).
- [ ] **Manejo de Errores (GlitchTip):**
  - Provocar un fallo intencional (ej. API Key de Meta inválida) y comprobar que el error llega a GlitchTip en `localhost:8282`.
- [ ] **Persistencia tras Reinicio:**
  - Crear datos de prueba.
  - Detener y borrar contenedores: `docker compose down`.
  - Levantar nuevamente `docker compose up -d` y verificar que Volúmenes Docker conservan todo (Redis cache, DB postgres, storage de MinIO/Dify).

### Pruebas de Rendimiento de Monitoreo
- [ ] **Prometheus:** Validar que los targets (cAdvisor) están activos en `localhost:9090/targets`.
- [ ] **Grafana Dashboards:** Comprobar que los tableros reciben métricas vivas de CPU/RAM de los contenedores clave (Postgres, Dify, Weaviate).
