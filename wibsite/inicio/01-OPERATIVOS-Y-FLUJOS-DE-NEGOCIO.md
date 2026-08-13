# 1. Operativos y Flujos de Negocio

Este documento detalla los comandos de inicio, ubicaciones (URLs), navegación del sistema, y la lógica de negocio central (vendedor IA, metodologías y plantillas) para la Plataforma Wibsite. También incluye el checklist de validación funcional y de interfaz para usuarios y QA.

---

## 1. Comandos, Ubicaciones y Procesos de Inicio

El sistema está orquestado mediante Docker Compose en la raíz del proyecto.

### Comandos Principales (Terminal)
Ubicación en terminal: `c:\proyectos\plataforma_mensajes\wibsite`

- **Levantar todos los contenedores y servicios en segundo plano:**
  `docker compose up -d`
- **Detener todos los servicios:**
  `docker compose down`
- **Reconstruir y levantar (si hay cambios en Dockerfiles como Helper):**
  `docker compose up -d --build`
- **Verificar estado de los contenedores:**
  `docker compose ps`

### Mapeo de URLs y Navegación

Toda la navegación está centralizada a través del proxy inverso **Nginx**, expuesto en el puerto `8080`.

| Módulo | URL Interna (Nginx proxy) | Descripción / Función Principal |
|--------|--------------------------|---------------------------------|
| **Hub Central** | `http://localhost:8080/hub/` | Página de entrada/índice. Redirecciona al resto de los servicios. |
| **Dashboard (Helper)** | `http://localhost:8080/admin/` | Interfaz de administración principal. Gesti&oacute;n de Leads, Campañas, y Scoring. |
| **Twenty CRM** | `http://localhost:8080/crm/` | CRM para seguimiento de personas, oportunidades y empresas. Almacena data enriquecida. |
| **n8n (Workflows)** | `http://localhost:8080/n8n/` | Motor de automatización. Recibe webhooks, orquesta lógicas programadas y lanza mensajes masivos. |
| **Dify (AI Agent)** | `http://localhost:8080/dify/` | Motor de Inteligencia Artificial. Maneja la lógica LLM, conocimiento (RAG) y workflows AI. |
| **Chatwoot** | `http://localhost:8080/chatwoot/` | Bandeja de entrada omnicanal. Intervención humana (Handoff) y gestión de tickets. |

---

## 2. Lógica de Negocio y Control del Agente

La lógica de negocio se procesa principalmente entre **Helper Node**, **Dify** y **n8n**. 

### Control de Creatividad y Operatividad del Agente
El agente de Dify posee un **switcher de contexto** que le permite cambiar su comportamiento dependiendo del cliente y del rubro.
- **Temperatura y Autonomía:** El agente tiene una arquitectura de autonomía de 3 colores (Verde: resuelve automático, Amarillo: requiere confirmación, Rojo: escalar a humano/handoff). La temperatura del LLM se ajusta según el estado de la venta.
- **Objeciones y Restricciones:** Se controla a través de "guardrails" de Dify y el `Helper API`, forzando al agente a adherirse a las reglas establecidas en el esquema JSON de la plantilla.

### Metodologías de Ventas (Control y Entrenamiento)
El agente ha sido instanciado con un entrenamiento basado en 7 metodologías de seguimiento de ventas para asegurar que controle la interacción:
1. **SPICED (Situation, Pain, Impact, Critical Event, Decision):** Extrae el dolor real del lead para calificarlo.
2. **MEDDIC:** Asegura que el lead es un tomador de decisiones calificado antes de escalar (Metrics, Economic Buyer, Decision Criteria...).
3. **PIPC (Pitch, Interest, Pain, Close):** Para flujos transaccionales rápidos.
4. **Bowtie:** Para ciclos de vida continuos (SaaS), enfocado en upselling post-venta.
5. **KAM (Key Account Management):** Para cuentas B2B (Enterprise), enfoque relacional.
6. **QBR / Health Score:** Validaciones periódicas con el cliente (retención).
7. **ABS (Account Based Sales):** Disparador para personalizar multi-campañas según el "Account" específico.

### Lógica de Plantillas Implementadas
La arquitectura soporta capas núcleo, plantillas por rubro y configuración por cliente.
1. **Desarrollador de Software Freelance / Consultora:** 
   - **Venta:** Consultiva B2B. El enfoque no es dar un precio fijo inmediato, sino mapear requisitos, entender el alcance y agendar una llamada.
   - **Precios:** Maneja rangos (tarifas por hora o por milestone).
   - **Seguimiento:** Cadencias largas (8 intentos), objeciones sobre "costo" o "tiempos".
2. **Gestión de Eventos:** 
   - **Venta:** Transaccional y de alto volumen (B2C o B2B rápido).
   - **Precios:** Paquetes definidos, precios fijos y descuentos por volumen.
   - **Seguimiento:** Cadencias cortas y agresivas cerca de la fecha del evento, con urgencia (FOMO).

---

## 3. Checklist de Pruebas y Validación de Usuario (QA y Frontend)

### Interfaz, Configuración y Operatividad (Lógica de Negocio)

- [ ] **Configuración de Plantilla del Cliente:** Verificar que el archivo JSON del cliente en Dify sobreescribe correctamente la plantilla del rubro sin alterar el núcleo.
- [ ] **Importación Masiva (Excel/CSV):** 
  - [ ] Validar carga en `Dashboard > Campañas > Importar`.
  - [ ] Comprobar detección de columnas y reporte de errores/duplicados.
- [ ] **Creación y Ejecución de Campañas:**
  - [ ] Crear campaña nueva.
  - [ ] Asignar template (verificando reemplazo de variables).
  - [ ] Lanzar campaña y comprobar estado (Sending -> Completed).
- [ ] **Evaluación de Leads (Scoring Engine):**
  - [ ] Ejecutar "Score All" y validar que los leads se agrupan en Hot/Warm/Cold según su interacción.
  - [ ] Comprobar que opt-out resta puntaje masivo y frena envíos.
- [ ] **Sincronización con Twenty CRM (Flujo de Datos):**
  - [ ] Pulsar "Sync CRM" en Dashboard.
  - [ ] Verificar en la UI de Twenty que los campos personalizados (`painPoints`, `interests`, `scoreHistory`) se llenan correctamente.
- [ ] **Intervención Humana (Handoff a Chatwoot):**
  - [ ] Simular que el agente detecta "Rojo" o "Enojo" del cliente.
  - [ ] Comprobar que se pausa la IA y se notifica en Chatwoot. 
- [ ] **Flujos Multi-Campaña Personalizada:**
  - [ ] Verificar que leads con score 'Cold' son inyectados en campañas de re-engagement por n8n.
  - [ ] Validar que cada tipo de lead recibe el follow-up acorde a la metodología (Ej: MEDDIC para enterprise, PIPC para transaccional).
