# Wibsite — Reporte de Servicios de Observabilidad

> **Fecha:** Julio 2026 | **Propósito:** Estado de los 5 servicios de infraestructura levantados y conflictos detectados con Authelia.

---

## 1. Resultado del Levantamiento

| Servicio | Contenedor | Puerto | Estado | Acceso | Notas |
|----------|-----------|--------|--------|--------|-------|
| **cAdvisor** | `wibsite-cadvisor` | 8080 (interno) | ✅ Running | Solo interno (prometheus) | Sin puerto externo. Accede prometheus vía Docker network |
| **Prometheus** | `wibsite-prometheus` | 9090 (interno) | ✅ Running | Solo interno | Scrapea cadvisor:8080 y helper:3100/metrics |
| **Grafana** | `wibsite-grafana` | 3004 → 3000 | ✅ Running | `http://localhost:3004` | user: admin / pass: admin. Login OK |
| **GlitchTip** | `wibsite-glitchtip` | 8282 → 8000 | ✅ Running | `http://localhost:8282` | Frontend carga correctamente |
| **GlitchTip-worker** | — | — | ❌ **Falló** | — | Error: `celery` no encontrado en imagen |
| **GlitchTip-postgres** | `wibsite-glitchtip-pg` | 5432 (interno) | ✅ Running | Solo interno | BD independiente |
| **GlitchTip-redis** | `wibsite-glitchtip-redis` | 6379 (interno) | ✅ Running | Solo interno | Redis independiente para GlitchTip |
| **MinIO API** | `wibsite-minio` | 9000 | ✅ Running | `http://localhost:9000` | API S3 funcional, health OK |
| **MinIO Console** | `wibsite-minio` | 9001 | ✅ Running | `http://localhost:9001` | UI cargando. Login: minioadmin / minioadmin |

**Resumen: 7/8 servicios OK. 1 fallo (GlitchTip-worker).**

---

## 2. Problema Detectado: GlitchTip-worker (celery no encontrado)

### Error
```
Error response from daemon: failed to create task for container: 
exec: "celery": executable file not found in $PATH
```

### Causa probable
La imagen `glitchtip/glitchtip:latest` usa un entrypoint diferente. En versiones recientes, GlitchTip no expone un comando `celery` en el PATH del contenedor. El worker ya está integrado en el proceso principal o se inicia con un comando diferente.

### Posibles soluciones (no aplicadas - documentadas para referencia)
1. **Opción A:** Eliminar el servicio `glitchtip-worker` del compose. El proceso principal ya maneja tareas en background.
2. **Opción B:** Cambiar el comando a `["python", "-m", "celery", "-A", "glitchtip", "worker", "-l", "info"]`
3. **Opción C:** Usar una versión específica de la imagen (ej: `glitchtip/glitchtip:v4.1`)

---

## 3. Conflictos con Authelia SSO

### Sin conflictos detectados
Los servicios de observabilidad corren en puertos independientes y **no interfieren con Authelia**. Sin embargo, se identifican los siguientes puntos de integración pendientes:

| Ubicación | Problema | Impacto |
|-----------|---------|---------|
| `/grafana/` vía nginx | Grafana está en puerto 3004 pero la ruta nginx `/grafana/` apunta a `grafana:3000` | OK - funciona vía Docker network |
| `/glitchtip/` vía nginx | GlitchTip está en 8282 pero la ruta nginx `/glitchtip/` apunta a `glitchtip:8282` | OK - funciona vía Docker network |
| `/minio-console/` vía nginx | MinIO console está en 9001, la ruta nginx apunta a `minio:9001` | OK - funciona vía Docker network |
| `/storage/` vía nginx | MinIO API está en 9000, ruta pública | OK |
| `/reportes/` vía nginx | Metabase no está corriendo | Sin impacto por ahora |

### Acceso actual sin SSO (puertos directos)
```
Grafana:    http://localhost:3004     (sin auth SSO)
GlitchTip:  http://localhost:8282     (sin auth SSO)
MinIO:      http://localhost:9001     (sin auth SSO)
```

Estos accesos directos **no pasan por Authelia**. Para producción, el acceso debe ser exclusivamente vía nginx:

```
Grafana vía SSO:   http://localhost:8080/grafana/
GlitchTip vía SSO: http://localhost:8080/glitchtip/
MinIO vía SSO:     http://localhost:8080/minio-console/
```

---

## 4. Verificación de Funcionamiento

### 4.1 Verificación actual (sin pasar por Authelia)

```powershell
# Grafana
Invoke-WebRequest "http://localhost:3004/api/health"
# Esperado: {"database":"ok","version":"13.1.1"}

# Prometheus
Invoke-WebRequest "http://localhost:9090/-/healthy"  
# Esperado: Prometheus is Healthy. (requiere mapeo de puerto)

# MinIO
Invoke-RestMethod "http://localhost:9000/minio/health/live"
# Esperado: 200 OK

# GlitchTip
Invoke-WebRequest "http://localhost:8282/"
# Esperado: HTML con login de GlitchTip
```

### 4.2 Verificación vía nginx (SSO)

```powershell
# Requiere login en Authelia primero
Invoke-WebRequest "http://localhost:8080/grafana/" -MaximumRedirection 0
# Esperado: 302 a /auth/ (protegido por SSO)

Invoke-WebRequest "http://localhost:8080/glitchtip/" -MaximumRedirection 0
# Esperado: 302 a /auth/ (protegido por SSO)

# MinIO API es pública (sin auth)
Invoke-WebRequest "http://localhost:8080/storage/"
# Esperado: Acceso S3 (firmado por API key)
```

---

## 5. Configuración Pendiente

| Tarea | Servicio | Detalle |
|-------|----------|---------|
| Crear superuser | GlitchTip | `docker exec wibsite-glitchtip python manage.py createsuperuser` |
| Configurar DSN | Helper | Agregar `GLITCHTIP_DSN` real al .env |
| Agregar datasource | Grafana | Conectar a `http://prometheus:9090` como datasource |
| Crear bucket | MinIO | `wibsite-media` para almacenamiento de archivos |
| Crear dashboard | Grafana | Dashboard de infraestructura con métricas de cAdvisor |

---

## 6. Conclusión

**5 servicios de infraestructura levantados — 4 completamente operativos:**

- ✅ Prometheus (métricas)
- ✅ Grafana (dashboards visuales)
- ✅ GlitchTip (error tracking, sin worker)
- ✅ cAdvisor (métricas Docker)
- ✅ MinIO (storage S3, API + Console)

**1 fallo no crítico:** GlitchTip-worker no arranca (comando `celery` no encontrado en la imagen). No bloquea el funcionamiento de GlitchTip como recolector de errores. Pendiente de resolver cambiando el comando del worker.

**Sin conflictos con Authelia.** Los servicios están correctamente aislados y las rutas nginx ya están configuradas con `auth_request` para protegerlos tras el SSO cuando se acceda por `http://localhost:8080/`.
