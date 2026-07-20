# Chatwoot Diagnostic Script
# Uso: .\scripts\diagnose-chatwoot.ps1
# Requiere Docker corriendo

Write-Host "=== Chatwoot Diagnostic ===" -ForegroundColor Cyan

# 1. Check container status
Write-Host "`n1. Container Status:" -ForegroundColor Yellow
docker ps -a --filter "name=wibsite-chatwoot" --format "table {{.Names}}\t{{.Status}}\t{{.RestartCount}}"

# 2. Check logs (last 50 lines)
Write-Host "`n2. Last 50 log lines:" -ForegroundColor Yellow
docker logs wibsite-chatwoot --tail 50 2>&1

# 3. Check database
Write-Host "`n3. Database check:" -ForegroundColor Yellow
docker exec wibsite-postgres psql -U wibsite -d chatwoot -c "SELECT current_database(), version();" 2>&1

# 4. Check Redis
Write-Host "`n4. Redis check:" -ForegroundColor Yellow
docker exec wibsite-redis redis-cli ping 2>&1

# 5. Check PostgreSQL connection from Chatwoot
Write-Host "`n5. PG connection test:" -ForegroundColor Yellow
docker exec wibsite-postgres psql -U wibsite -d chatwoot -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>&1

# 6. Check if Chatwoot port is in use
Write-Host "`n6. Port 3002/3000 check:" -ForegroundColor Yellow
netstat -ano | findstr ":3002 " 2>&1
netstat -ano | findstr ":3000 " 2>&1

# 7. Check SECRET_KEY_BASE length
Write-Host "`n7. Secret key length check:" -ForegroundColor Yellow
$key = Select-String -Path "$PSScriptRoot\..\.env" -Pattern "CHATWOOT_SECRET_KEY" | ForEach-Object { $_ -replace '.*=' , '' }
Write-Host "  CHATWOOT_SECRET_KEY length: $($key.Length) chars (min 64 required)"

Write-Host "`n=== Diagnostic Complete ===" -ForegroundColor Cyan
