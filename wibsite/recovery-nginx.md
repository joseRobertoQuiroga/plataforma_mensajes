# Manual de Recuperación y Configuración — Nginx & Servicios Wibsite (v3)

Este documento contiene el diagnóstico, la configuración de referencia y los pasos necesarios para restaurar el entorno de proxy reverso y la comunicación entre los distintos módulos de la plataforma Wibsite en caso de fallos.

---

## 📋 Resumen del Diagnóstico de la Arquitectura Dedicada (v3)

Para solucionar de manera definitiva los problemas de bucles de redirección (`ERR_TOO_MANY_REDIRECTS`) y las redirecciones no deseadas hacia el Hub, se rediseñó la arquitectura de puertos para aislar Dify:

1. **Aislamiento de Dify en el Puerto 3003:** Anteriormente se intentaba enrutar Dify bajo el subpath `http://localhost:8080/dify/` en Nginx. Esto causaba un bucle infinito ya que Next.js (dify-web) intentaba remover la barra final (`/apps/` -> `/apps`) y Nginx intentaba forzarla. Ahora Dify corre en la raíz de su propio puerto dedicado `3003`.
2. **Redirecciones Post-Login Corregidas:** Al autenticarse, Dify redirige al usuario a `/` (la raíz). En la configuración anterior, la raíz del puerto `8080` redirigía al Hub, sacando al usuario de Dify. Ahora la raíz del puerto `3003` se resuelve de forma interna y correcta dentro del propio módulo de Dify.
3. **Liberación del Espacio de Nombres en Puerto 8080:** Se eliminaron las más de 12 rutas interceptadas que Dify contaminaba en la raíz de Nginx (como `/apps`, `/datasets`, `/auth`, `/signin`, etc.), permitiendo que el puerto principal `8080` esté libre de colisiones.
4. **Redirección de Compatibilidad:** Nginx en el puerto `8080` posee una regla de redirección `301` para enrutar cualquier intento de acceso al subpath antiguo `/dify/` hacia `http://localhost:3003/`.

---

## 🛠️ Configuración de Referencia

### 1. Nginx (`nginx.conf`)
Ubicación: [nginx.conf](file:///c:/proyectos/plataforma_mensajes/wibsite/nginx.conf)

```nginx
# Wibsite — Nginx Reverse Proxy v3
# Solución definitiva: Dify en puerto propio 3003, Hub en 8080

# Servidor Principal (Port 80 -> Host 8080)
server {
    listen 80;
    server_name localhost;
    absolute_redirect off;
    client_max_body_size 50M;
    resolver 127.0.0.11 valid=5s;

    # HUB — Portal de control unificado
    location /hub/ {
        alias /usr/share/nginx/html/hub/;
        index index.html;
        try_files $uri $uri/ /hub/index.html;
    }

    # Raíz → Hub siempre
    location = / {
        return 301 /hub/;
    }

    # Redirección de compatibilidad para Dify antiguo
    location /dify/ {
        return 301 http://localhost:3003/;
    }

    # WEBHOOKS PÚBLICOS
    location /webhooks/ {
        proxy_pass         http://helper:3100;
        proxy_set_header   Host              $http_host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }

    location /webhook/ {
        proxy_pass         http://n8n:5678;
        proxy_set_header   Host              $http_host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }

    location /opt-outs/ {
        proxy_pass         http://helper:3100;
        proxy_set_header   Host              $http_host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
    }

    # HEALTH CHECKS
    location = /health {
        proxy_pass       http://helper:3100/health;
        proxy_set_header Host $http_host;
    }

    location = /api/health {
        proxy_pass       http://helper:3100/health;
        proxy_set_header Host $http_host;
    }

    # HELPER API — Campañas, Leads, Admin dashboard
    location /api/ {
        proxy_pass         http://helper:3100;
        proxy_set_header   Host              $http_host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }

    location /admin/ {
        rewrite            ^/admin/(.*) /$1 break;
        proxy_pass         http://helper:3100;
        proxy_set_header   Host              $http_host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade           $http_upgrade;
        proxy_set_header   Connection        "upgrade";
    }

    location = /campaigns {
        proxy_pass         http://helper:3100;
        proxy_set_header   Host              $http_host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
    }

    location /campaigns/ {
        proxy_pass         http://helper:3100;
        proxy_set_header   Host              $http_host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
    }

    # N8N — Automatización (N8N_PATH=/n8n/)
    location /n8n/ {
        rewrite            ^/n8n/(.*) /$1 break;
        proxy_pass         http://n8n:5678;
        proxy_set_header   Host              $http_host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade           $http_upgrade;
        proxy_set_header   Connection        "upgrade";
    }

    location /static/ {
        proxy_pass         http://n8n:5678;
        proxy_set_header   Host              $http_host;
    }

    location /rest/ {
        proxy_pass         http://n8n:5678;
        proxy_set_header   Host              $http_host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade           $http_upgrade;
        proxy_set_header   Connection        "upgrade";
    }

    location /webhook-test/ {
        proxy_pass         http://n8n:5678;
        proxy_set_header   Host              $http_host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
    }

    location /webhook-waiting/ {
        proxy_pass         http://n8n:5678;
        proxy_set_header   Host              $http_host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
    }

    # CHATWOOT (Health Check)
    location /chatwoot/ {
        proxy_pass         http://chatwoot:3000/;
        proxy_set_header   Host              $http_host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }

    # TWENTY CRM (Health Check)
    location /crm/ {
        proxy_pass         http://twenty-server:3000/;
        proxy_set_header   Host              $http_host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }
}

# Servidor Dedicado Dify (Port 3003 -> Host 3003)
server {
    listen 3003;
    server_name localhost;
    client_max_body_size 50M;
    resolver 127.0.0.11 valid=5s;

    # Dify Console API
    location /console/ {
        proxy_pass         http://dify-api:5001/console/;
        proxy_set_header   Host              $http_host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_set_header   X-Forwarded-Host  $http_host;
    }

    # Dify Public API
    location /api/ {
        proxy_pass         http://dify-api:5001/api/;
        proxy_set_header   Host              $http_host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_set_header   X-Forwarded-Host  $http_host;
    }

    # Archivos adjuntos de Dify
    location /files/ {
        proxy_pass         http://dify-api:5001/files/;
        proxy_set_header   Host              $http_host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }

    # Plugin Daemon — UI de gestión de plugins
    location /plugins/ {
        proxy_pass         http://plugin-daemon:5002;
        proxy_set_header   Host              $http_host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_set_header   Dify-Hook-Url     http://localhost:3003/;
    }

    # Marketplace Proxy — evita CORS cuando el browser llama a marketplace.dify.ai
    location /marketplace/ {
        if ($request_method = 'OPTIONS') {
            add_header Access-Control-Allow-Origin  "http://localhost:3003" always;
            add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
            add_header Access-Control-Allow-Headers "Content-Type, Authorization, X-Requested-With" always;
            add_header Access-Control-Max-Age       1728000;
            add_header Content-Length               0;
            return 204;
        }
        rewrite            ^/marketplace/(.*) /$1 break;
        proxy_pass         https://marketplace.dify.ai;
        proxy_ssl_server_name on;
        proxy_set_header   Host              marketplace.dify.ai;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_hide_header  Access-Control-Allow-Origin;
        add_header         Access-Control-Allow-Origin      "http://localhost:3003" always;
        add_header         Access-Control-Allow-Credentials "true" always;
        add_header         Access-Control-Allow-Methods     "GET, POST, PUT, DELETE, OPTIONS" always;
        add_header         Access-Control-Allow-Headers     "Content-Type, Authorization, X-Requested-With" always;
    }

    # Dify Web Frontend (Next.js)
    location / {
        proxy_pass         http://dify-web:3000/;
        proxy_set_header   Host              $http_host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Host  $http_host;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade           $http_upgrade;
        proxy_set_header   Connection        "upgrade";
    }
}
```

---

## 🐳 Variables de Entorno en `docker-compose.yml`

### 1. Variables de `dify-api`
```yaml
# Permitir CORS desde el propio Nginx en puerto 3003
CONSOLE_CORS_ALLOW_ORIGINS: http://localhost:3003
CORS_ALLOWED_ORIGINS: "http://localhost:3003"
```

### 2. Variables de `dify-web`
* `dify-web` ya no mapea puertos directamente al host, es decir, se eliminó la sección `ports: - 3003:3000` ya que Nginx en el puerto 3003 actúa como proxy único.
```yaml
CONSOLE_API_URL: http://dify-api:5001
APP_API_URL: http://dify-api:5001

# Endpoint inyectado en el cliente para la API pública y el proxy del Marketplace
entrypoint: ["/bin/sh", "-c", "export NEXT_PUBLIC_API_PREFIX=/console/api; export NEXT_PUBLIC_PUBLIC_API_PREFIX=/api; export NEXT_PUBLIC_MARKETPLACE_API_PREFIX=http://localhost:3003/marketplace/api/v1; exec node /app/targets/next/web/server.js"]
```

### 3. Variables de `nginx`
* Se expone el puerto `3003:3003` para poder recibir el tráfico de Dify.
```yaml
ports:
  - "${NGINX_PORT:-8080}:80"
  - "3003:3003"
```

---

## 🛠️ Procedimiento de Recuperación Paso a Paso

### Paso 1: Validar Sintaxis de Nginx
Prueba que el archivo `nginx.conf` no posea errores de estructura:
```powershell
docker exec wibsite-nginx nginx -t
```

### Paso 2: Recrear Contenedores Afectados
Aplica las variables de entorno de `docker-compose.yml` y regenera la red de Docker:
```powershell
docker compose up -d --force-recreate nginx dify-api dify-web
```

### Paso 3: Validar las respuestas HTTP de los módulos en puerto 3003
Puedes ejecutar estas consultas curl de prueba para verificar que el enrutamiento es óptimo:

```powershell
# Comprobar que Dify redirige de manera relativa en su propio puerto (debe retornar /auth/refresh...)
docker exec wibsite-nginx curl -s -o /dev/null -w "%{http_code} -> %{redirect_url}\n" http://localhost:3003/

# Comprobar la respuesta directa de la API de Dify en puerto 3003 (debe retornar 200)
docker exec wibsite-nginx curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3003/console/api/setup
```
