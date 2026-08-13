# 🛡️ Wibsite — Guía del Superusuario & Control Center

Esta guía establece el funcionamiento, monitoreo y la gestión del **Centro de Control (Control Center)** de la plataforma Wibsite, unificando la administración de incidentes, trazabilidad, seguridad y rendimiento a través de herramientas especializadas (Prometheus, Grafana, GlitchTip) desde una interfaz centralizada.

---

## 1. El Control Center (`/hub/control-center.html`)

El **Control Center** es la interfaz central (Frontend/Dashboard unificado) desarrollada específicamente para administradores del sistema y superusuarios. En lugar de revisar múltiples aplicaciones, el Control Center agrupa métricas y acciones operativas críticas.

**Acceso:** 
1. Navega a `http://localhost:3100/hub/control-center.html` (o `http://[tu-dominio]/hub/control-center.html`).
2. Ingresa la `HELPER_API_KEY` (configurada en el `.env` del *helper-node*) cuando sea requerida.

### Funcionalidades del Control Center:

- **Dashboard Principal (SLI & Health):** Muestra de inmediato la tasa de errores, latencia p95, dependencias críticas conectadas (PostgreSQL, Redis, Weaviate, LLM) y el Uptime del sistema.
- **Incidentes:** Un visor detallado de fallos. Agrupa errores por _fingerprint_ (módulo, tipo y ruta). Permite inspeccionar el `error_stack`, ver dependencias afectadas y **marcar el incidente como Resuelto**, introduciendo notas de resolución.
- **Eventos de Seguridad:** Registra de forma proactiva bloqueos (Brute Force, Inyección de Prompts) con IP, ruta, método y severidad.
- **Fallbacks (Alta Disponibilidad):** Monitoreo de cuándo el sistema entra en modo de degradación (ej. Redis falla -> memoria, PostgreSQL falla -> JSON, Weaviate falla -> memoria local).
- **Audit Trail & Traceability:** Búsqueda cruzada usando el `requestId`. Permite pegar un ID de trazabilidad para recuperar tanto el log paso-a-paso como cualquier incidente generado en esa petición.
- **Pruebas (Smoke Tests):** Panel para ejecutar validaciones en un solo clic sobre la salud real de todos los componentes antes o después de un despliegue.

---

## 2. Herramientas Integradas

El Control Center se alimenta de la robusta arquitectura subyacente. Sin embargo, para auditorías granulares, las herramientas originales están conectadas y unificadas.

### 📈 Grafana (`http://localhost:3004`)
Grafana es el motor visual de monitoreo de infraestructura y aplicación.
- **Dashboard: "Wibsite Helper — API & Monitoring":** Preconfigurado automáticamente. Muestra tráfico por endpoint, uso de memoria/CPU por contenedor (vía cAdvisor/Node Exporter), percentiles de latencia y un recuento vivo de bloqueos de seguridad y fallbacks.
- **Cuándo usarlo:** Cuando notes una anomalía de rendimiento (latencia alta) en el Control Center y desees visualizar tendencias a lo largo de las horas/días.

### 🔥 Prometheus (`http://localhost:9090`)
Prometheus recoge (`scrape`) métricas de todos los servicios.
- **Alertmanager (`http://localhost:9093`):** Gestiona las alertas (Ej. `HelperErrorRateHigh`, `HelperDown`, `SecurityBlocksSpike`). Si una alerta salta (firing), se envía un Webhook al Control Center para quedar registrada en la vista **Alertas Prometheus**.

### 🐛 GlitchTip (`http://localhost:8282`)
GlitchTip es el sistema experto de captura de excepciones en el código (compatible con SDK de Sentry).
- **Integración:** El *helper-node* se conecta a GlitchTip mediante `GLITCHTIP_DSN`.
- **Cuándo usarlo:** Para depurar el _stack trace_ profundo a nivel de código fuente, asignación a desarrolladores, integración con repositorios (GitHub/GitLab) y alertas por correo al equipo Dev. El Control Center notifica el error general y GlitchTip asiste en la corrección de código.

---

## 3. Trazabilidad y Gestión de Errores

Wibsite utiliza una **Trazabilidad Global (Trace ID)**:

1. **Request ID (`req.id`):** Cada solicitud que ingresa al *helper* recibe un UUID.
2. **Contexto Multi-Tenant:** La solicitud reconoce inmediatamente al usuario (`userId`), al tenant (`tenantId`) y al módulo (ej. `campaigns`, `scoring`).
3. **Flujo y Fallo:** Si hay un error, el servicio de `errorTracker` guarda un incidente en PostgreSQL.
4. **Fingerprint:** El `errorTracker` genera una huella única. Si el mismo error sucede 50 veces, en lugar de generar 50 tickets, agrupa el error e incrementa su contador (Occurrence Count).

### Flujo de Soporte del Superusuario:

1. **Monitoreo Reactivo:** Ingresas al Control Center > **Dashboard**. Notas que los _Incidentes Abiertos_ están en rojo.
2. **Investigación:** Vas a la pestaña **Incidentes**. Encuentras un error Crítico en el módulo de `knowledge-base`.
3. **Inspección Profunda:** Haces clic en **Ver**. Revisas el `requestId`. Copias ese ID y vas a la pestaña **Rastrear Request** para ver los logs exactos (paso a paso) que llevaron a la falla.
4. **Resolución:** Tras identificar que era un problema de red (ya solucionado), vuelves al incidente, agregas la nota "Problema de Weaviate restablecido" y haces clic en **Marcar como Resuelto**. El contador de métricas vuelve a verde.

---

## 4. Control de Seguridad Preventivo

El módulo de seguridad audita de forma preventiva.
- **Tipos de Eventos:** `rate_limit_exceeded` (intentos excesivos por IP), `injection_blocked` (intento de manipular el LLM), `unauthorized_access`.
- **Acción Autónoma:** El helper bloquea la solicitud y la registra.
- **Tu rol:** Observar la vista de **Eventos de Seguridad** en el Control Center. Si una IP (`ip_address`) reitera ataques, puedes proceder a un bloqueo de nivel firewall si es necesario.

---

## 5. Prevención y Control de Tests

(Para conocer los estándares técnicos de Testing unitario e integración, dirígete al archivo [ESTANDAR-TESTING-MONITOREO.md](./ESTANDAR-TESTING-MONITOREO.md)).

Desde el perfil del superusuario, el control preventivo se efectúa mediante los **Smoke Tests** en el Control Center:
1. En la pestaña **Pruebas & Smoke Tests**, puedes validar de manera segura si las integraciones críticas (Base de datos, LLM Auth, Redis, Weaviate) están disponibles y saludables.
2. Esta acción es fundamental **antes y después** de desplegar un nuevo contenedor, garantizando que todo el entorno se reinició con éxito.

Con estas herramientas, obtienes un **Observabilidad de 360 grados**, asegurando un mantenimiento ágil y una detección de fallos proactiva, tal como se requirió para el control de la aplicación Wibsite Business.
