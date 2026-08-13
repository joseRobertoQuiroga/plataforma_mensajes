Write-Host "=== Diagnostico respuestas 401 ===" -ForegroundColor Yellow

foreach($path in @("/crm/","/n8n/","/dify/")){
  try {
    $r = Invoke-WebRequest "http://localhost:8080$path" -UseBasicParsing -TimeoutSec 3 -MaximumRedirection 0 -ErrorAction Stop
    Write-Host "${path}: $($r.StatusCode) $($r.Headers.Location)"
  } catch {
    $resp = $_.Exception.Response
    Write-Host "${path}: HTTP $([int]$resp.StatusCode)"
    if ($resp.Headers.Location) {
        Write-Host "  Location: $($resp.Headers.Location)"
    }
  }
}

Write-Host "`n=== n8n health endpoints ===" -ForegroundColor Yellow
foreach($ep in @("/health","/","/n8n/health","/n8n")){
  try {
    $r = Invoke-WebRequest "http://localhost:5679$ep" -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop
    Write-Host "${ep}: $($r.StatusCode)"
  } catch {
    Write-Host "${ep}: $([int]$_.Exception.Response.StatusCode)"
  }
}
