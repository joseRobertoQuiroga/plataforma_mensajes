# ==============================================================================
# audit-all.ps1 - Script PowerShell para Auditoría Máxima y Diagnóstico Rápido
# ==============================================================================
# Propósito:
# Ejecuta la auditoría maestra completa del sistema y muestra un resumen formateado
# en PowerShell con colores e información de errores en tiempo real.
#
# Uso:
#   .\scripts\audit-all.ps1
# ==============================================================================

Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -ErrorAction SilentlyContinue

Write-Host "Ejecutando Auditoría Maestra de la Plataforma Wibsite..." -ForegroundColor Cipher

node scripts/audit-all.js

$exitCode = $LASTEXITCODE
if ($exitCode -eq 0) {
    Write-Host "`n[ÉXITO] Auditoría completada. Todos los servicios y comprobaciones pasaron correctamente." -ForegroundColor Green
} else {
    Write-Host "`n[ALERTA] Se detectaron fallas durante la auditoría. Revisa los logs detallados arriba." -ForegroundColor Red
}

exit $exitCode
