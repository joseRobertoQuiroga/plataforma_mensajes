# Guía: Cómo escalar un ecosistema multi-módulo open source sin quemar el presupuesto en servidores

> Aplicado al caso Wibsite Business (Chatwoot + Dify + n8n + Twenty CRM/Frappe + Helper Node)
> Julio 2026

---

## 1. Diagnóstico de tu situación actual

Antes de ir a las soluciones, vale la pena nombrar exactamente dónde estás parado, porque eso determina qué ruta te conviene tomar primero.

Según tu propia documentación (`SCALABILITY-ANALYSIS.md`, `MEMORY.md` ADR-016), hoy tenés:

- **Escalabilidad vertical pura**: 10 servicios en un solo host, sin réplicas, sin balanceo de carga.
- **Cero identidad federada**: 6 de 11 servicios tienen su propio login (Dify, n8n, Chatwoot, Twenty, etc.). Cada uno maneja sesión, cookies y tokens de forma aislada.
- **Sin aislamiento multi-tenant real**: el Helper Node usa un JSON store plano sin `organization_id`, sin FKs, sin RLS. Ya identificaste esto vos mismo como riesgo alto en `DATABASE-VALIDATION.md`.
- **Sin gateway**: cada servicio es públicamente accesible vía Nginx, sin capa de autenticación centralizada, rate limiting ni auditoría (ADR-016 ya lo marca como pendiente).

Esto no es un error de diseño — es exactamente donde **debería** estar un producto en fase de validación (Fase 0.5). El error sería saltar directo a Kubernetes + service mesh antes de tener el problema real (usuarios pagando) sobre la mesa. Por eso las 3 rutas que te doy más abajo están pensadas como **escalera**, no como "elegí una y ya".

---

## 2. Los dos problemas son en realidad el mismo problema

Esto es clave y quizás no lo tenías tan explícito: **identidad federada** y **escalabilidad de costos** se resuelven con la misma pieza arquitectónica: un **Gateway/Proxy inteligente** delante de tus módulos.

- Si el gateway resuelve *quién sos* (auth), también puede resolver *cuánto podés pedir* (rate limiting), *a dónde te enruto* (multi-tenant routing) y *qué cacheo* (reducción de carga en los servicios de atrás).
- Las grandes empresas no tienen "un sistema de auth" y por separado "un sistema de escalado". Tienen **una capa de borde (edge layer)** que hace ambas cosas a la vez.

Esto es justo lo que tu ADR-016 ya intuyó. Vamos a formalizarlo.

---

## 3. Cómo lo resuelven las grandes empresas (marco conceptual)

### 3.1 Identidad: Federación, no multiplicación

Netflix, Spotify, Salesforce, Atlassian — ninguno le pide a sus microservicios internos que autentiquen usuarios por su cuenta. Usan:

- **Un Identity Provider (IdP) central** que habla el protocolo estándar **OIDC/OAuth2** (no un login custom por servicio).
- **Cada servicio downstream confía en el IdP**, no valida credenciales — solo valida la *firma* de un token (JWT) que el IdP ya emitió. Esto se llama **"passport" en lugar de "check-in point"**: valido tu pasaporte, no te vuelvo a interrogar en cada frontera.
- Herramientas reales: **Keycloak**, **Auth0**, **Okta**, o soluciones más livianas como **Authelia** / **oauth2-proxy** que se paran *delante* de Nginx como "guardia de la puerta" sin tocar el código interno de cada módulo.

La ventaja clave: **la mayoría de tus módulos open source (Chatwoot, n8n, Dify, Twenty) ya soportan OIDC/SAML nativamente o casi**. No necesitás reescribirlos — necesitás *apuntarlos* a un IdP común.

### 3.2 Costos: no escalar todo, escalar lo que se usa

El error más caro que cometen equipos chicos es tratar todos los servicios como si necesitaran la misma capacidad todo el tiempo. Las grandes empresas segmentan por **patrón de carga**:

| Patrón de carga | Ejemplo en tu stack | Estrategia de las grandes empresas |
|---|---|---|
| Constante y liviano | Twenty CRM, Helper API | Contenedores pequeños, siempre arriba |
| Picos esporádicos | Envío de campañas masivas (n8n) | **Scale-to-zero** / workers efímeros (serverless, jobs) |
| Intensivo en cómputo | Clasificación IA (Dify + LLM) | Delegar a APIs externas (OpenRouter) en vez de hostear el modelo — vos ya hiciste esto bien con ADR-015 |
| Alto volumen de I/O | Chatwoot (mensajería) | Colas de mensajes (Kafka/RabbitMQ/Redis Streams) para desacoplar recepción de procesamiento |

Prácticas concretas que usan (Google, Netflix, Shopify, Stripe):

1. **Connection pooling de base de datos** (PgBouncer): 1000 usuarios no significan 1000 conexiones a Postgres — significan 1000 requests reutilizando ~20 conexiones reales.
2. **Cache en capas**: CDN (contenido estático) → Redis (queries frecuentes) → DB (última instancia). Cada capa que cachea es carga que la DB nunca ve.
3. **Autoscaling horizontal reactivo**: no "más CPU a la misma máquina", sino "más réplicas del contenedor que está saturado" — y que se apaguen solas cuando baja la demanda.
4. **Arquitectura orientada a eventos**: en vez de que el servicio A llame síncronamente al B (y B tenga que estar siempre listo para responder rápido), A publica un evento y B lo procesa cuando puede. Esto es lo que ya estás insinuando en tu `DATA-FLOW.md` con n8n como orquestador — falta institucionalizarlo con una cola real.
5. **Multi-tenancy por "pool" en vez de "silo"**: en vez de una base de datos completa por cliente (carísimo), una sola base de datos compartida con aislamiento lógico vía `organization_id` + Row Level Security (RLS). Vos ya tenés el schema Lumi diseñado así — es el patrón correcto, solo falta migrarlo desde el JSON store.

Esto último tiene nombre formal: es el **"SaaS Tenancy Model"** de AWS (Silo / Pool / Bridge). El modelo **Pool** (compartido con RLS) es el que usan la mayoría de SaaS B2B medianos porque balancea costo y aislamiento razonablemente bien — es literalmente lo que ya diseñaste en tu schema Lumi de PostgreSQL.

---

## 4. Tres rutas, ordenadas de mayor a menor dificultad técnica

Cada ruta resuelve **ambos problemas a la vez** (identidad + costo), con distinto nivel de inversión.

---

### 🔴 Ruta A — "Enterprise-grade": Kubernetes + Service Mesh + IdP dedicado

**Qué es:**
- Orquestación con **Kubernetes** (K8s) en vez de Docker Compose.
- **Keycloak** (o Auth0) como IdP central con OIDC, federando login para Dify, n8n, Chatwoot, Twenty, Helper.
- **Kong Gateway** o **Istio/Linkerd (service mesh)** como capa de entrada: JWT validation, rate limiting, mTLS entre servicios, circuit breakers.
- **Horizontal Pod Autoscaler (HPA)**: cada servicio escala réplicas según CPU/RAM/requests en tiempo real.
- Base de datos gestionada con **read replicas** + **PgBouncer** para pooling.
- Colas de eventos con **Kafka** o **RabbitMQ** para desacoplar Chatwoot ↔ n8n ↔ Dify.

**Por qué lo hacen así las grandes empresas:**
Es el patrón de Netflix, Spotify, Airbnb. Permite escalar servicios de forma independiente (si Chatwoot recibe 10x tráfico, solo ese pod escala, no toda la plataforma), tolerar fallos de un nodo sin caerse entero, y desplegar sin downtime.

**Cómo aplicarlo a Wibsite:**
- Cada uno de tus 10 servicios pasa a ser un Deployment de K8s con su propio HPA.
- Keycloak reemplaza los logins individuales de Dify/n8n/Chatwoot/Twenty (todos soportan SSO vía OIDC/SAML con configuración, no con reescritura de código).
- Kong al frente maneja JWT + rate limit + logging centralizado — reemplaza lo que hoy planeas construir "a mano" en el Helper Node (ADR-016 fase Kong, que vos mismo ya identificaste).

**Dificultad técnica:** Muy alta. Requiere experiencia en K8s, service mesh, gestión de secretos (Vault), CI/CD para múltiples clusters.
**Costo de infraestructura:** Puede ser *más caro al inicio* (nodos K8s, control plane, posible costo gestionado tipo EKS/GKE) pero **más barato por usuario a partir de cierta escala** (cientos/miles de usuarios), porque el autoscaling evita pagar capacidad ociosa.
**Cuándo conviene:** Cuando ya tenés clientes pagando y necesitás SLA serios (uptime, multi-región). Prematuro para tu fase actual (Fase 0.5, validación).

---

### 🟡 Ruta B — "Camino pragmático": Gateway propio + SSO liviano + Compose reforzado

Esta es, en mi lectura, **la ruta que ya estabas diseñando intuitivamente con tu ADR-016** — y es la que te recomendaría empezar a construir ahora mismo, porque no tira nada de lo que ya hiciste.

**Qué es:**
- Mantener **Docker Compose** (o pasar a **Docker Swarm**, que es Compose con clustering básico — mucho menor curva de aprendizaje que K8s).
- Un **reverse-proxy con SSO integrado** delante de Nginx: **Authelia** o **oauth2-proxy**. Estos son contenedores livianos que interceptan el tráfico *antes* de llegar a Dify/n8n/Chatwoot/Twenty y exigen un solo login. No tenés que tocar el código de ningún módulo — se configuran a nivel de Nginx (`auth_request` directive).
- El **Helper Node extendido** (como ya lo planeaste) actúa como gateway de *tu propia API* (campañas, scoring, sync) con JWT propio — separado del SSO de UI que maneja Authelia.
- **PgBouncer** delante de PostgreSQL (connection pooling) — una sola línea de config, gran impacto en concurrencia.
- **Redis como cache** de lecturas frecuentes (dashboard summary, scoring rules) — ya tenés Redis corriendo, solo falta usarlo como cache y no solo como queue de Chatwoot/n8n.
- Migrar el JSON store del Helper a **PostgreSQL con schema Lumi** (que ya diseñaste) con `organization_id` + RLS — esto te da multi-tenant real sin necesitar Kubernetes.
- Autoscaling manual/simple: réplicas fijas de los servicios con más carga (ej. 2 instancias de Helper detrás de Nginx con `least_conn`), sin necesidad de HPA automático.

**Por qué esto también es "como lo hacen las grandes empresas":**
Es exactamente la etapa por la que pasaron Shopify, Basecamp, y la mayoría de SaaS B2B *antes* de llegar a Kubernetes. El patrón "reverse-proxy con auth centralizada + Postgres con RLS + cache Redis" sostiene sin drama a miles de usuarios concurrentes si el resto del código es razonable. No necesitás mesh ni orquestador complejo para servir a cientos de clientes B2B (que es tu mercado objetivo, PyMEs bolivianas — no vas a tener millones de usuarios simultáneos).

**Cómo aplicarlo a Wibsite (orden sugerido):**
1. Migrar Helper Node de JSON store → PostgreSQL Lumi con `organization_id` + RLS (ya tenés el schema).
2. Meter Authelia/oauth2-proxy delante de Nginx → un solo login para Dify, n8n, Chatwoot, Twenty.
3. Activar PgBouncer.
4. Empezar a usar Redis como cache real (no solo colas).
5. Recién ahí, si el tráfico lo justifica, evaluar 2-3 réplicas de Helper Node detrás de Nginx con balanceo.

**Dificultad técnica:** Media. Todo esto lo podés hacer con Docker Compose, sin aprender K8s.
**Costo de infraestructura:** Bajo — sigue siendo 1-2 hosts, quizás un poco más de RAM para Redis/PgBouncer.
**Cuándo conviene:** Ahora. Es el paso natural desde tu Fase 0.5 actual, y no es "trabajo desperdiciado" si más adelante escalás a Ruta A — Keycloak/Kong pueden reemplazar a Authelia/oauth2-proxy sin rehacer el resto.

---

### 🟢 Ruta C — "Mínimo viable": SSO de borde + escalado vertical + cache básico

**Qué es:**
- Solo la pieza de **Authelia/oauth2-proxy** delante de Nginx para resolver el dolor de "loguearme en cada módulo", sin tocar nada más.
- Escalado **vertical**: más CPU/RAM al mismo host cuando haga falta (lo que ya hacés).
- Cache básico de Nginx (`proxy_cache`) para respuestas estáticas o poco cambiantes.
- Sin multi-tenant todavía (seguís con 1 instancia = 1 cliente, o clientes compartiendo sin aislamiento fuerte).

**Por qué las empresas chicas empiezan así:**
Es literalmente el MVP de infraestructura. Empresas como Basecamp en sus primeros años, o cualquier SaaS boliviano/latam en etapa temprana, resuelven "un solo login" con este patrón porque cuesta una tarde de trabajo y resuelve el 80% del dolor inmediato (que es justo tu queja principal: "tengo que loguearme en cada módulo").

**Cómo aplicarlo a Wibsite:**
- Instalás oauth2-proxy o Authelia como un contenedor más en tu `docker-compose.yml`.
- Configurás Nginx para que cada `location` (`/dify/`, `/n8n/`, `/crm/`, `/chatwoot/`) pase primero por `auth_request` hacia Authelia.
- Un solo formulario de login te abre todo.

**Dificultad técnica:** Baja. Se resuelve en 1-2 días.
**Costo de infraestructura:** Prácticamente cero (un contenedor liviano más).
**Cuándo conviene:** Si necesitás resolver el dolor de SSO *ya*, sin comprometerte todavía a rediseñar el store de datos o meter PgBouncer/RLS. Es compatible con migrar a Ruta B después sin tirar trabajo.

---

## 5. Tabla comparativa rápida

| | Ruta A (K8s) | Ruta B (Gateway propio) | Ruta C (SSO mínimo) |
|---|---|---|---|
| Dificultad técnica | Muy alta | Media | Baja |
| Tiempo estimado | Semanas/meses | 1-3 semanas | 1-2 días |
| Costo infra inicial | Medio-alto | Bajo | Casi nulo |
| Resuelve SSO | ✅ (Keycloak) | ✅ (Authelia/oauth2-proxy) | ✅ (Authelia/oauth2-proxy) |
| Resuelve multi-tenant real | ✅ | ✅ (con migración a Postgres Lumi) | ❌ |
| Autoscaling automático | ✅ | ❌ (manual) | ❌ |
| Apto para tu fase actual (0.5) | ❌ Prematuro | ✅ **Recomendado** | ✅ Como parche rápido |
| Tira trabajo previo si migrás después | No | No | No |

---

## 6. Recomendación concreta para tu caso

Dado que estás en Fase 0.5 (validación, sin credenciales Meta ni LLM productivo todavía), la jugada de mayor retorno es:

1. **Ahora**: Ruta C (Authelia/oauth2-proxy delante de Nginx) — resuelve tu queja inmediata de logins múltiples en una tarde.
2. **En paralelo, cuando tengas ancho de banda**: avanzar Ruta B — migrar el Helper Node al schema PostgreSQL Lumi con `organization_id` + RLS (esto es más importante que el gateway en sí, porque es la base de tu futuro multi-tenant/multi-cliente).
3. **Recién cuando tengas clientes reales pagando y el host único empiece a mostrar síntomas** (los que vos mismo listaste en `SCALABILITY-ANALYSIS.md`: CPU compitiendo entre n8n y Dify, caídas en cascada) — ahí evaluar Ruta A, y probablemente no Kubernetes completo sino un paso intermedio como Docker Swarm o Nomad antes de saltar a K8s.

Esto respeta algo importante: **no hay empresa grande que haya empezado con la arquitectura que tiene hoy**. Netflix no nació con microservicios — migró cuando el monolito se volvió el cuello de botella real, no antes. Tu ventaja es que ya identificaste los problemas correctos (ADR-016, DATABASE-VALIDATION.md) — el trabajo que sigue es secuenciarlos bien, no resolverlos todos de una.

---

## 7. Temas adicionales para investigar (si querés profundizar)

- **AWS SaaS Lens / Tenant Isolation Strategies** — el documento de referencia de AWS sobre Silo/Pool/Bridge, aplicable aunque no uses AWS.
- **The Twelve-Factor App** — principios de diseño que hacen que un sistema sea fácil de escalar horizontalmente (ya los estás siguiendo parcialmente con variables de entorno).
- **Backends for Frontends (BFF) pattern** — útil si en el futuro tenés distintos frontends (dashboard web, app móvil) consumiendo los mismos módulos.
- **Circuit Breaker pattern** (Hystrix/resilience4j) — para que si Dify se cae, no tumbe a n8n ni al Helper.
