# tevs-env.ps1 — Resolución de credenciales y endpoints sin secretos en git.
# Orden de resolución:
#   1. Variable de entorno (CI/GitLab masked variable o shell)
#   2. Archivo .env local del proyecto (wibsite/.env — NO versionado)
# Uso (dot-source):  . "$PSScriptRoot\tevs-env.ps1"   (misma carpeta)
#                     . "$PSScriptRoot\..\tevs-env.ps1" (desde tests/)
if (-not $env:ELASTIC_PASSWORD) {
    $projectRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
    $envFile = Join-Path $projectRoot '.env'
    if (Test-Path $envFile) {
        $line = Select-String -Path $envFile -Pattern '^ELASTIC_PASSWORD=' | Select-Object -First 1
        if ($line) {
            $env:ELASTIC_PASSWORD = ($line.Line -split '=', 2)[1].Trim()
        }
    }
}
if (-not $env:ELASTIC_PASSWORD) {
    Write-Host "[tevs-env] WARNING: ELASTIC_PASSWORD no definida. Exportala como variable de entorno o crea wibsite/.env (no versionado). Los tests que consulten Elasticsearch fallarán con 401." -ForegroundColor Yellow
}

# HELPER_API_KEY: env var (CI masked) → .env local (solo para tests que llaman al helper)
if (-not $env:HELPER_API_KEY) {
    $projectRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
    $envFile = Join-Path $projectRoot '.env'
    if (Test-Path $envFile) {
        $line = Select-String -Path $envFile -Pattern '^HELPER_API_KEY=' | Select-Object -First 1
        if ($line) {
            $env:HELPER_API_KEY = ($line.Line -split '=', 2)[1].Trim()
        }
    }
}

# Endpoints: env var → default local (los tests locales usan localhost; CI pasa los nombres de servicio)
if (-not $env:ELASTIC_URL) { $env:ELASTIC_URL = "http://localhost:9200" }
if (-not $env:KIBANA_URL) { $env:KIBANA_URL = "http://localhost:5601/kibana" }
if (-not $env:HELPER_URL) { $env:HELPER_URL = "http://localhost:3100" }
if (-not $env:GATEWAY_URL) { $env:GATEWAY_URL = "https://localhost:8080" }