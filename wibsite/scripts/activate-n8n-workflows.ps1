# Activar workflows n8n desde UI - Guia visual
Write-Host "=== n8n Workflow Activation Helper ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "PASO 1: Login en n8n" -ForegroundColor Yellow
Write-Host "  URL: http://localhost:5679"
Write-Host "  User: admin@wibsite.com"
Write-Host "  Pass: Wibsite2024!"
Write-Host ""
Write-Host "PASO 2: Importar workflows si no existen" -ForegroundColor Yellow
Write-Host "  Workflows > Add Workflow > Import from File"
Write-Host "  Seleccionar: n8n/workflows/01-inbound-message.json"
Write-Host "  Seleccionar: n8n/workflows/02-campaign-broadcast.json"
Write-Host ""
Write-Host "PASO 3: Crear credenciales en Settings > Credentials" -ForegroundColor Yellow
Write-Host "  - Chatwoot API: API Key $($env:CHATWOOT_API_KEY)"
Write-Host "  - Dify API: Bearer Token $($env:DIFY_API_KEY)"
Write-Host "  - Twenty CRM: Bearer Token $($env:TWENTY_API_KEY)"
Write-Host "  - Twilio: Basic Auth $($env:TWILIO_ACCOUNT_SID)/$($env:TWILIO_AUTH_TOKEN)"
Write-Host ""
Write-Host "PASO 4: Activar toggles" -ForegroundColor Yellow
Write-Host "  - Abrir workflow 01 > toggle Active (esquina superior derecha)"
Write-Host "  - Abrir workflow 02 > toggle Active"
Write-Host "  - El toggle debe ponerse VERDE"
Write-Host ""
Write-Host "PASO 5: Probar execucion" -ForegroundColor Yellow
Write-Host "  - Workflow 01 > Execute Workflow (boton)"
Write-Host "  - Workflow 02 > Execute Workflow (boton)"
Write-Host "  - Verificar executions > green checkmarks en cada nodo"
Write-Host ""
Write-Host "NOTA: El bug body parser de n8n 2.23.4 impide activar via REST API."
Write-Host "La activacion DEBE hacerse desde la UI. Es un paso manual de ~10 min."

# Intentar verificar estado actual
Write-Host ""
Write-Host "--- Verificando estado actual ---" -ForegroundColor Gray
try {
    $login = Invoke-RestMethod "http://localhost:5679/rest/login" -Method Post -Body '{"emailOrLdapLoginId":"admin@wibsite.com","password":"Wibsite2024!"}' -ContentType "application/json" -TimeoutSec 10
    $cookie = $login.data
    $workflows = Invoke-RestMethod "http://localhost:5679/rest/workflows" -Method Get -Headers @{"Cookie"="n8n-auth=$cookie"} -TimeoutSec 10
    Write-Host "Workflows encontrados: $($workflows.data.Count)" -ForegroundColor Green
    $workflows.data | ForEach-Object {
        $active = if ($_.active) { "ACTIVO" } else { "INACTIVO" }
        $color = if ($_.active) { "Green" } else { "Red" }
        Write-Host "  $($_.name): $active" -ForegroundColor $color
    }
} catch {
    Write-Host "No se pudo verificar estado automaticamente (bug body parser)." -ForegroundColor Yellow
    Write-Host "Usar verificacion manual desde la UI de n8n." -ForegroundColor Gray
}
