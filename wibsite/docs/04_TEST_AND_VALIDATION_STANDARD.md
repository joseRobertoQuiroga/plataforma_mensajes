# Test Execution & Validation Standard (TEVS v1.0)

## 1. Objetivo
Establecer un estándar único para diseñar, ejecutar, registrar y analizar scripts de pruebas automatizadas en la plataforma Wibsite (OTASG). El resultado de cada prueba es un evento estructurado JSON consumible por Elasticsearch/Kibana, actuando como un *Deployment Gate*.

## 2. JSON Schema Obligatorio (Nivel 1)
Todo script de prueba DEBE generar (por STDOUT) un JSON con esta estructura base:

```json
{
  "schema": {
    "name": "TEVS",
    "version": "1.0"
  },
  "test": {
    "test_id": "TEST-OBS-001",
    "test_name": "Health check Kibana",
    "test_version": "1.0.0",
    "test_type": "functional",
    "category": "observability",
    "severity": "critical",
    "tags": ["monitoring", "gate1"]
  },
  "execution": {
    "execution_id": "Generado_por_Runner",
    "correlation_id": "Opcional",
    "status": "passed|failed|warning|skipped",
    "started_at": "ISO8601",
    "finished_at": "ISO8601",
    "duration_ms": 123
  },
  "environment": {
    "name": "Wibsite-Docker"
  },
  "application": {
    "name": "Wibsite",
    "version": "1.0"
  },
  "executor": {
    "type": "script",
    "name": "tevs-runner"
  },
  "deployment_policy": {
    "blocking": true
  }
}
```

## 3. Contrato de Exit Codes
El orquestador (`tevs-runner.ps1`) y los scripts individuales deben respetar:
* `0`: PASSED
* `1`: FAILED
* `2`: WARNING
* `3`: BLOCKED (Precondiciones no cumplidas)
* `4`: TIMEOUT
* `5`: ERROR (Fallo en el script de prueba en sí)

## 4. Clasificaciones
**Tipos de Test (`test_type`):** functional, integration, regression, smoke, health, security, performance, resilience, monitoring, alerting, data_validation, recovery.

**Severidades (`severity`):** info, low, medium, high, critical.

**Estados (`status`):** passed, failed, warning, skipped, blocked, timeout, error.

## 5. Diseño de un Script (PowerShell)
Un script de prueba válido solo debe imprimir STDOUT el JSON final. Cualquier log de diagnóstico debe ir a STDERR (`Write-Error` o `Write-Host` interceptado, aunque es mejor devolverlo en el bloque `diagnostics` o `error` del JSON).
