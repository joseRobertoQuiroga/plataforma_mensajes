# Estándar de pruebas, monitoreo y control — Wibsite Business

## 1. Propósito

Este estándar define cómo validar, monitorear y controlar el sistema para que el proyecto sea confiable, trazable y operable en producción y en desarrollo.

## 2. Alcance

Se aplica a todos los módulos críticos del proyecto:
- helper-node
- campañas y leads
- scoring
- conversaciones
- seguridad y autenticación
- integraciones externas: Twenty, n8n, Dify, Meta, Chatwoot
- infraestructura y observabilidad

## 3. Niveles de prueba obligatorios

### 3.1 Pruebas unitarias
- Validan lógica aislada y reglas de negocio.
- Deben cubrir módulos clave como:
  - tenant context
  - lead profile
  - agent config
  - rate limiter
  - seguridad y sanitización
  - conversation state

### 3.2 Pruebas de integración
- Validan la interacción entre rutas, middleware, módulos internos y almacenamiento.
- Deben cubrir al menos:
  - campañas
  - dashboard
  - scoring
  - templates
  - opt-out
  - knowledge base
  - conversaciones

### 3.3 Pruebas de flujo
- Validan la continuidad del negocio desde el punto de vista del usuario o del proceso.
- Deben cubrir:
  - crear campaña
  - cargar leads
  - evaluar scoring
  - procesar webhook
  - transicionar conversación

### 3.4 Pruebas de regresión
- Deben correr en cada release o cambio importante.
- Se aplican sobre los flujos críticos del negocio.

### 3.5 Pruebas de contrato
- Validan que las APIs y contratos de integración no cambien sin aviso.
- Son clave para helper ↔ Twenty, helper ↔ n8n, helper ↔ Dify y helper ↔ Meta.

### 3.6 Pruebas de humo
- Corren tras cada deploy o cambio relevante.
- Verifican que lo esencial del sistema siga respondiendo.

### 3.7 Mutation testing
- Se recomienda para validar que los tests realmente detectan fallos y no solo dan cobertura superficial.

## 4. Estandar de monitoreo

### 4.1 Métricas obligatorias
- latencia por endpoint
- tasa de errores por módulo
- requests por minuto
- uso de recursos por servicio
- tiempo de respuesta de dependencias externas
- tasa de fallbacks (tenant, RAG, storage)

### 4.2 Health checks obligatorios
- /health
- /api/sli/metrics
- /metrics
- health checks de dependencias externas

### 4.3 Alertas mínimas
- error rate elevado
- latencia anómala
- dependencia externa caída
- fallback activado
- flujo crítico fallando repetidamente

## 5. Seguimiento y control operativo

### 5.1 Reglas de seguimiento
- Todo error debe registrarse con:
  - timestamp
  - módulo
  - acción
  - tenant o contexto
  - severidad
  - dependencia afectada
  - detalle del fallo

### 5.2 Ubicaciones de observación
- Prometheus para métricas
- Grafana para dashboards
- GlitchTip para errores
- Health endpoints del helper
- Logs del helper y de servicios externos

### 5.3 Flujo de operación
1. Se detecta el fallo.
2. Se registra el error con contexto.
3. Se clasifica por módulo y severidad.
4. Se asigna owner o responsable.
5. Se corrige y se valida con pruebas.
6. Se cierra el incidente con evidencia verificada.

## 6. Módulos de monitoreo y su relación con objetivos del proyecto

### 6.1 Helper API
- Función: centralizar flujos de negocio y comunicaciones.
- Relación con objetivos: permite orquestar campañas, leads, scoring, conversaciones y seguridad.
- Monitoreo: latencia, errores, fallbacks, health status y métricas SLI.

### 6.2 Campañas y leads
- Función: gestionar campañas, cargas masivas, seguimiento y estado de leads.
- Relación con objetivos: sostener el motor comercial del sistema.
- Monitoreo: creación, inicio, pausa, completado, errores de carga y tracking.

### 6.3 Scoring y decisiones
- Función: priorizar leads y tomar decisiones.
- Relación con objetivos: mejorar conversión y eficiencia comercial.
- Monitoreo: rate de evaluación, errores, reglas inválidas y resultados anómalos.

### 6.4 Conversaciones y seguridad
- Función: proteger y controlar interacciones con el agente.
- Relación con objetivos: asegurar calidad y seguridad del canal conversacional.
- Monitoreo: bloqueos, transiciones inválidas, intentos de inyección y rendimiento del flujo.

### 6.5 Integraciones externas
- Función: conectar el sistema con Twenty, n8n, Dify, Meta y Chatwoot.
- Relación con objetivos: permitir automatización y sincronización real.
- Monitoreo: disponibilidad, timeouts, fallos de contrato y latencia.

### 6.6 Infraestructura y observabilidad
- Función: sostener el funcionamiento general del entorno.
- Relación con objetivos: asegurar estabilidad y capacidad de respuesta ante incidentes.
- Monitoreo: consumo de CPU/RAM, estado de containers, conectividad y logs.

## 7. Indicadores de éxito

- 0 fallos críticos en smoke test tras deploy
- 100% de flujos esenciales cubiertos por pruebas de integración
- alertas activadas correctamente para fallos relevantes
- tiempos de respuesta dentro de los umbrales definidos
- capacidad de rastrear cualquier incidente desde el módulo hasta el servicio afectado
