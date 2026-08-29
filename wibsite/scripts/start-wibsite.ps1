# ═══════════════════════════════════════════════════════════════
# Wibsite — Levantar todo el sistema en local (stack wibsite + GitLab Self-Managed + Runner + validación SOAC)
# Uso:  .\scripts\start-wibsite.ps1 [-NoBuild] [-SkipWait] [-SkipTeVS] [-NoPause] [-NoDiag]
#   -NoBuild  : no ejecuta --build (usa imágenes existentes)
#   -SkipWait : no espera a que los servicios estén saludables
#   -SkipTeVS : no ejecuta la suite TeVS de validación profunda del SOAC (requiere pwsh/PowerShell 7)
#   -NoPause  : no espera una tecla al final (para consolas no interactivas)
#   -NoDiag   : salta el diagnóstico de contenedores y gateway
# ═══════════════════════════════════════════════════════════════
[CmdletBinding()]
param(
    [switch]$NoBuild,    # no ejecuta --build (usa imágenes existentes)
    [switch]$SkipWait,   # no espera a que los servicios estén saludables
    [switch]$SkipTeVS,   # no ejecuta la suite TeVS de validación del SOAC
    [switch]$NoPause,    # no espera una tecla al final (para consolas no interactivas)
    [switch]$NoDiag      # salta el diagnóstico de contenedores y gateway
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

# ═══ Helpers ═══════════════════════════════════════════════════
function Write-Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Write-OK($msg)   { Write-Host "  [OK] $msg" -ForegroundColor Green }
function Write-Err($msg)  { Write-Host "  [ERROR] $msg" -ForegroundColor Red }
function Write-Warn($msg) { Write-Host "  [WARN] $msg" -ForegroundColor Yellow }

# Ejecuta un comando (con cmd /c) capturando stdout+stderr como texto plano.
# Evita que EAP=Stop convierta el stderr de comandos nativos en error terminante.
function Run-Capture {
    param([string]$CommandLine)
    $prev = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    $out = cmd /c $CommandLine 2>&1
    $ErrorActionPreference = $prev
    return ,$out
}

# Mantiene la ventana abierta aunque falle algo (doble clic / powershell -File)
function Pause-IfInteractive {
    if ($NoPause) { return }
    Write-Host "`nPresiona una tecla para cerrar esta ventana..." -ForegroundColor Yellow
    try { $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown") } catch { Start-Sleep -Seconds 5 }
}

function Fail($msg) {
    Write-Err $msg
    Pause-IfInteractive
    exit 1
}

# ─── Estado de contenedores (docker compose ps -a --format json) ──
function Get-ContainerStates {
    $json = Run-Capture "docker compose ps -a --format json 2>&1"
    if (-not $json -or -not $json[0]) { return @() }
    try {
        # --format json emite UN objeto JSON por línea → convertir línea a línea
        $ctrs = @($json | ForEach-Object { $_ | ConvertFrom-Json })
        $ctrs = @($ctrs | Where-Object { $_ })
    } catch { return @() }
    if ($ctrs.Count -eq 0) { return @() }
    return $ctrs
}

function Get-ProblemContainers {
    $ctrs = Get-ContainerStates
    $bad = @()
    foreach ($c in $ctrs) {
        $state  = "$($c.State)"
        $health = "$($c.Health)"
        $status = "$($c.Status)"
        if (($state -match "exited|created|restarting|paused|dead") -or ($health -eq "unhealthy")) {
            $bad += [pscustomobject]@{ Name="$($c.Name)"; Service="$($c.Service)"; State=$state; Health=$health; Status=$status }
        }
    }
    return $bad
}

# ─── Conflictos de puertos en el host ──────────────────────────
function Test-PortConflicts {
    $ports = 80, 8080, 3003, 5001, 5002, 5679, 8194, 3100, 9200, 5601, 4317, 4318, 9000, 9001, 9080, 9443, 9022
    $rows = @()
    foreach ($p in $ports) {
        $conn = Get-NetTCPConnection -State Listen -LocalPort $p -ErrorAction SilentlyContinue | Select-Object -First 1
        if (-not $conn) { continue }
        $proc = "PID $($conn.OwningProcess)"
        try { $proc = (Get-Process -Id $conn.OwningProcess -ErrorAction Stop).ProcessName } catch { }
        $det = ""
        $dockerOwned = $false
        if ($proc -match "docker|vpnkit|wslrelay") {
            $dockerOwned = $true
            $ctr = Run-Capture "docker ps --filter publish=$p --format {{.Names}}"
            if ($ctr -and $ctr[0]) { $det = "contenedor: $($ctr -join ', ')" }
            else { $det = "proceso Docker (relay)" }
        }
        $rows += [pscustomobject]@{ Puerto=$p; Proceso=$proc; Detalle=$det; Docker=$dockerOwned }
    }
    return $rows
}

# ─── Diagnóstico: contenedores con problemas + logs ────────────
function Show-ContainerDiagnostics {
    Write-Step "6. Diagnóstico: contenedores con problemas"
    $ctrs = Get-ContainerStates
    if (-not $ctrs) {
        Write-Err "No se pudo obtener el estado de los contenedores (¿daemon Docker activo?)."
        return
    }
    $bad = Get-ProblemContainers
    $running = @($ctrs | Where-Object { "$($_.State)" -eq "running" }).Count
    Write-Host "  Total: $($ctrs.Count) contenedores | en ejecución: $running | con problemas: $($bad.Count)"

    if ($bad.Count -eq 0) {
        Write-OK "Todos los contenedores están en ejecución"
        return
    }

    foreach ($b in $bad) {
        $color = if ($b.State -eq "running") { "Yellow" } else { "Red" }
        Write-Host "`n  [PROBLEMA] $($b.Name)  →  $($b.Status)" -ForegroundColor $color
        if ($b.Health -eq "unhealthy") {
            Write-Warn "Healthcheck fallando — bloquea a los servicios que dependen de él (depends_on: service_healthy)"
        }
        $logs = Run-Capture "docker logs --tail 30 $($b.Name) 2>&1"
        if ($logs -and $logs[0]) {
            Write-Host "  Últimos logs:" -ForegroundColor DarkGray
            $logs | Select-Object -Last 30 | ForEach-Object { Write-Host "    $_" -ForegroundColor DarkGray }
        }
    }
    Write-Host ""
}

# ─── Validación del gateway y el frontend ──────────────────────
function Test-Gateway {
    Write-Step "7. Validación del gateway (https://localhost:8080) y frontend"
    $checks = @(
        @{ N="GET /health (público -> helper)";        U="https://localhost:8080/health";     OK=@(200);    E="502/504 = helper no accesible desde nginx (wibsite-helper)" }
        @{ N="GET /api/health (público)";              U="https://localhost:8080/api/health"; OK=@(200);    E="502 = helper no accesible desde nginx" }
        @{ N="GET /auth/ (portal Authelia)";           U="https://localhost:8080/auth/";      OK=@(200);    E="502 = authelia caído (wibsite-authelia)" }
        @{ N="GET / (frontend, sin sesión)";           U="https://localhost:8080/";           OK=@(200,302); E="302->/auth = SSO ok (esperado sin sesión); 502 = frontend caído (wibsite-frontend-1)" }
        @{ N="GET /dashboard (frontend, sin sesión)";  U="https://localhost:8080/dashboard";   OK=@(200,302); E="302->/auth = SSO ok; 502 = frontend caído (wibsite-frontend-1)" }
    )
    $results = @()
    foreach ($c in $checks) {
        $code = & curl.exe -k -s -o NUL -w "%{http_code}" $c.U --max-time 5
        $results += [pscustomobject]@{ N=$c.N; U=$c.U; Code=$code; OkCodes=$c.OK; Expl=$c.E }
        if ($c.OK -contains $code) { Write-OK "$($c.N) -> $code" }
        else { Write-Err "$($c.N) -> $code  ($($c.E))" }
    }
    $failCount = @($results | Where-Object { $_.OkCodes -notcontains $_.Code }).Count
    if ($failCount -eq 0) {
        Write-OK "Gateway operativo: nginx + SSO + frontend responden correctamente"
        return
    }

    # ── Remedio 1: DNS estancado en nginx ────────────────────────
    # Síntoma: /health y /api/health dan 502 pero el helper responde directo en :3100.
    # Causa: nginx resuelve los proxy_pass estáticos al arrancar; si el contenedor
    # helper/frontend se recrea con otra IP, nginx sigue apuntando a la IP vieja.
    $helperDirect = & curl.exe -s -o NUL -w "%{http_code}" "http://localhost:3100/health" --max-time 3
    $gw502 = @($results | Where-Object { $_.Code -eq "502" -and $_.U -match "health" }).Count -gt 0
    if ($helperDirect -eq "200" -and $gw502) {
        Write-Host "`n  El helper responde directo (:3100) pero nginx da 502 — posible DNS estancado en nginx." -ForegroundColor Yellow
        $helperIp = Run-Capture "docker inspect wibsite-helper --format {{.NetworkSettings.Networks.wibsite_default.IPAddress}} 2>&1"
        $nginxLogs = Run-Capture "docker logs wibsite-nginx --tail 200 2>&1"
        $usedIp = $nginxLogs | Select-String -Pattern "upstream: `"http://([0-9.]+):3100" | ForEach-Object { $_.Matches[0].Groups[1].Value } | Select-Object -Last 1
        if ($usedIp -and $helperIp -and $helperIp[0] -and $usedIp -ne $helperIp[0]) {
            Write-Warn "Causa encontrada: nginx apunta a la IP $usedIp pero el helper actual está en $($helperIp[0]) (contenedor recreado)."
            Write-Host "  Aplicando remedio: docker restart wibsite-nginx ..." -ForegroundColor Yellow
            $null = Run-Capture "docker restart wibsite-nginx 2>&1"
            Start-Sleep -Seconds 4
            Write-Host "  Re-validando gateway tras reiniciar nginx..." -ForegroundColor Yellow
            $still = 0
            foreach ($r in $results) {
                $code = & curl.exe -k -s -o NUL -w "%{http_code}" $r.U --max-time 5
                $r.Code = $code
                if ($r.OkCodes -contains $code) { Write-OK "$($r.N) -> $code (tras reinicio)" }
                else { Write-Err "$($r.N) -> $code (tras reinicio)  ($($r.Expl))"; $still++ }
            }
            if ($still -eq 0) {
                Write-OK "Gateway recuperado tras reiniciar nginx (refresca la resolución DNS de los upstreams)"
                return
            }
            Write-Warn "El reinicio de nginx no resolvió el problema — revisando logs abajo."
        } else {
            Write-Warn "Helper responde pero no se detectó IP vieja en nginx — revisa los logs abajo."
        }
    }

    # ── Diagnóstico en profundidad cuando algo falla ─────────────
    Write-Host "`n  Falló algún endpoint. Revisando logs de nginx / frontend / helper / authelia..." -ForegroundColor Yellow
    $svcs = @{ nginx="wibsite-nginx"; frontend="wibsite-frontend-1"; helper="wibsite-helper"; authelia="wibsite-authelia" }
    foreach ($k in $svcs.Keys) {
        $name = $svcs[$k]
        $exists = Run-Capture "docker ps -a --filter name=^/$name`$ --format {{.Names}}"
        if (-not $exists -or -not $exists[0]) {
            Write-Warn "Contenedor $name no existe (¿no se creó? revisa docker compose up)"
            continue
        }
        $logs = Run-Capture "docker logs --tail 25 $name 2>&1"
        Write-Host "`n  --- logs ($name) ---" -ForegroundColor Cyan
        if ($logs -and $logs[0]) { $logs | Select-Object -Last 25 | ForEach-Object { Write-Host "    $_" -ForegroundColor DarkGray } }
        else { Write-Host "    (sin logs)" -ForegroundColor DarkGray }
    }

    # Conectividad interna desde nginx hacia los upstreams
    Write-Host "`n  Conectividad interna (desde el contenedor nginx):" -ForegroundColor Yellow
    $nginxUp = Run-Capture "docker ps --filter name=^/wibsite-nginx`$ --format {{.Names}}"
    if (-not $nginxUp -or -not $nginxUp[0]) {
        Write-Err "wibsite-nginx no está corriendo — el gateway no puede responder"
        return
    }
    $upstreams = @(
        @{ N="frontend:4000 (app Next.js)"; C="docker exec wibsite-nginx wget -q -O /dev/null -T 3 http://frontend:4000/ 2>&1" }
        @{ N="helper:3100 (Helper API)";    C="docker exec wibsite-nginx wget -q -O /dev/null -T 3 http://helper:3100/health 2>&1" }
        @{ N="authelia:9091 (SSO)";         C="docker exec wibsite-nginx wget -q -O /dev/null -T 3 http://authelia:9091/api/health 2>&1" }
    )
    foreach ($u in $upstreams) {
        $null = Run-Capture $u.C
        if ($LASTEXITCODE -eq 0) { Write-OK "$($u.N) alcanzable desde nginx" }
        else { Write-Err "$($u.N) NO responde desde nginx (exit $LASTEXITCODE)" }
    }
    Write-Host ""
}

# ─── GitLab: arranque, red compartida y sincronización del runner ──
$gitlabComposePath = Join-Path $root "infrastructure\gitlab\docker-compose.yml"
$gitlabCtr         = "gitlab-ce"
$gitlabRunnerCtr   = "gitlab-runner"

function Start-GitLabStack {
    if (-not (Test-Path $gitlabComposePath)) {
        Write-Warn "No existe $gitlabComposePath — se omite GitLab (infraestructura no presente)."
        return $false
    }
    Write-Step "2b. Levantando GitLab Self-Managed + Runner"
    $upOut = Run-Capture "docker compose -f `"$gitlabComposePath`" up -d 2>&1"
    if ($upOut -and $upOut[0]) { $upOut | ForEach-Object { Write-Host "  $_" -ForegroundColor DarkGray } }
    if ($LASTEXITCODE -ne 0) {
        Write-Err "docker compose (gitlab) falló (exit $LASTEXITCODE). Revisa: docker compose -f infrastructure\gitlab\docker-compose.yml logs --tail 50 gitlab"
        return $false
    }
    Write-OK "Compose GitLab levantado ($gitlabCtr + $gitlabRunnerCtr)"
    return $true
}

function Sync-GitLabNetwork {
    # Los jobs del runner corren en la red wibsite_default; gitlab-ce debe estar
    # también en esa red (alias 'gitlab') para que el clonado funcione.
    $ctrNet = @(& docker inspect $gitlabCtr --format "{{range .NetworkSettings.Networks}}{{.NetworkID}} {{end}}" 2>&1)
    $wibNet = @(& docker network inspect wibsite_default --format "{{.Id}}" 2>&1)
    if (-not $ctrNet -or -not $wibNet) {
        Write-Warn "No se pudo inspeccionar las redes ($gitlabCtr / wibsite_default)."
        return
    }
    $ctrText = ($ctrNet -join ' ') -replace '\s+', ' '
    $wibId   = (($wibNet -join '') -replace '[\r\n]', '').Trim()
    if ($ctrText -notmatch [regex]::Escape($wibId)) {
        Write-Host "  Conectando $gitlabCtr a la red wibsite_default (alias 'gitlab')..." -ForegroundColor Yellow
        $null = Run-Capture "docker network connect --alias gitlab wibsite_default $gitlabCtr 2>&1"
        Start-Sleep -Seconds 3
        Write-OK "$gitlabCtr conectado a wibsite_default"
    } else {
        Write-OK "$gitlabCtr ya está en wibsite_default"
    }
}

function Sync-RunnerExtraHosts {
    # El config.toml del runner fija extra_hosts: gitlab.local → IP de gitlab-ce
    # en wibsite_default. Si la IP cambió (recreate del contenedor), se actualiza.
    $ipWib = @(& docker inspect $gitlabCtr --format "{{.NetworkSettings.Networks.wibsite_default.IPAddress}}" 2>&1)
    if (-not $ipWib) {
        Write-Warn "No se pudo obtener la IP de $gitlabCtr en wibsite_default."
        return
    }
    $ipWib = (($ipWib -join '') -replace '[\r\n]', '').Trim()
    if ($ipWib -notmatch '^\d+\.\d+\.\d+\.\d+$') {
        Write-Warn "$gitlabCtr no tiene IP en wibsite_default (¿red no conectada?)."
        return
    }
    $cfg = @(& docker exec $gitlabRunnerCtr cat /etc/gitlab-runner/config.toml 2>&1)
    if (-not $cfg) { return }
    $cfgText = $cfg -join "`n"
    if ($cfgText -match 'gitlab\.local:(\d+\.\d+\.\d+\.\d+)') {
        $current = $Matches[1]
        if ($current -ne $ipWib) {
            Write-Warn "IP de gitlab-ce cambió en wibsite_default ($current → $ipWib). Actualizando extra_hosts del runner..."
            $null = & docker exec $gitlabRunnerCtr sed -i "s/gitlab\.local:[0-9.]*/gitlab.local:$ipWib/" /etc/gitlab-runner/config.toml 2>&1
            $null = Run-Capture "docker restart $gitlabRunnerCtr 2>&1"
            Start-Sleep -Seconds 6
            Write-OK "Runner reiniciado con extra_hosts actualizado (gitlab.local → $ipWib)"
        } else {
            Write-OK "Runner extra_hosts correcto (gitlab.local → $ipWib)"
        }
    }
}

function Test-GitLabHealth {
    Write-Step "3b. Esperando a que GitLab esté healthy (max 10 min)"
    $glOk = $false
    foreach ($i in 1..40) {
        Start-Sleep -Seconds 15
        $h = & docker inspect --format "{{.State.Health.Status}}" $gitlabCtr 2>&1
        $health = if ($h) { (($h -join '') -replace '[\r\n]', '').Trim() } else { "" }
        if ($health -eq "healthy") { $glOk = $true; break }
        $code = & curl.exe -s -o NUL -w "%{http_code}" "http://127.0.0.1:9080/users/sign_in" --max-time 3 2>$null
        Write-Host "  ...esperando GitLab ($($i*15)s) health=$health http=$code"
    }
    if ($glOk) { Write-OK "GitLab healthy (http://localhost:9080)" }
    else {
        Write-Warn "GitLab aún arranca en segundo plano (revisa: docker logs gitlab-ce | docker inspect gitlab-ce --format '{{.State.Health}}')"
    }
}

# ═══════════════════════════════════════════════════════════════
try {
    # ─── 1. Pre-requisitos ───────────────────────────────────────
    Write-Step "1. Verificando pre-requisitos"
    $null = Run-Capture "docker info --format {{.ServerVersion}} 2>&1"
    if ($LASTEXITCODE -ne 0) {
        Fail "Docker no está corriendo. Inicia Docker Desktop y reintenta."
    }
    Write-OK "Docker daemon disponible"

    if (-not (Test-Path "$root\.env")) {
        Fail "No existe .env. Copia .env.example a .env primero."
    }
    Write-OK ".env presente"

    # ─── 1b. Conflictos de puertos ───────────────────────────────
    Write-Step "1b. Puertos requeridos en uso (posibles conflictos)"
    $conflicts = Test-PortConflicts
    if ($conflicts.Count -eq 0) {
        Write-OK "Ninguno de los 14 puertos requeridos está ocupado"
    } else {
        $stack = @($conflicts | Where-Object { $_.Detalle -match "wibsite-|gitlab-" })
        $real  = @($conflicts | Where-Object { -not $_.Docker -or ($_.Detalle -notmatch "wibsite-|gitlab-") })
        if ($stack.Count -gt 0) {
            Write-OK "Puertos ya ocupados por este stack: $($stack.Puerto -join ', ')  (contenedores: $($stack.Detalle -replace 'contenedor: ',' ' -join ', '))"
        }
        if ($real.Count -gt 0) {
            Write-Err "CONFLICTOS REALES de puertos — docker compose fallará con 'port is already allocated':"
            $real | Format-Table Puerto,Proceso,Detalle -AutoSize | Out-String | Write-Host
        } else {
            Write-OK "Sin conflictos externos: todos los puertos ocupados pertenecen a este stack"
        }
    }

    # ─── 2. Levantar el stack ─────────────────────────────────────
    Write-Step "2. Levantando el stack (docker compose)"
    if ($NoBuild) {
        $upOut = Run-Capture "docker compose up -d 2>&1"
    } else {
        $upOut = Run-Capture "docker compose up -d --build 2>&1"
    }
    if ($upOut -and $upOut[0]) { $upOut | ForEach-Object { Write-Host "  $_" -ForegroundColor DarkGray } }
    if ($LASTEXITCODE -ne 0) {
        Fail "docker compose falló (exit $LASTEXITCODE). Revisa: docker compose logs --tail 50 <servicio>  |  docker compose ps"
    }

    Write-Host "  Compose levanto el stack. Contenedores:"
    $psOut = Run-Capture "docker compose ps --format `"table {{.Name}}\t{{.Status}}\t{{.Ports}}`" 2>&1"
    if ($psOut -and $psOut[0]) { $psOut | ForEach-Object { Write-Host "  $_" -ForegroundColor DarkGray } }

    # ─── 2b. GitLab Self-Managed + Runner ─────────────────────────
    $gitlabUp = Start-GitLabStack
    if ($gitlabUp) {
        Sync-GitLabNetwork
        Sync-RunnerExtraHosts
    }

    # ─── 3. Esperar salud ─────────────────────────────────────────
    if (-not $SkipWait) {
        Write-Step "3. Esperando a que los servicios estén saludables (max 180s)"
        $envContent = Get-Content "$root\.env"
        $esPass = ($envContent | Where-Object { $_ -match '^ELASTIC_PASSWORD=' }) -replace '^ELASTIC_PASSWORD=', ''
        if (-not $esPass) { $esPass = $env:ELASTIC_PASSWORD }
        if (-not $esPass) { Write-Warning "ELASTIC_PASSWORD no definido en .env ni en entorno; skip healthcheck ES" }
        $b64 = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("elastic:$esPass"))
        $esHeaders = @{ Authorization = "Basic $b64" }

        $up = $false
        foreach ($i in 1..60) {
            Start-Sleep -Seconds 3
            $helperOk = $false; $esOk = $false; $kibanaOk = $false; $otelOk = $false
            try {
                $h  = Invoke-RestMethod "http://localhost:3100/health" -TimeoutSec 3
                $helperOk = ($h.status -eq "ok")
            } catch { }
            try {
                $es = Invoke-RestMethod "http://localhost:9200/_cluster/health" -Headers $esHeaders -TimeoutSec 3
                $esOk = ($es.status -ne "red")
            } catch { }
            $kb = & curl.exe -s -o NUL -w "%{http_code}" "http://localhost:5601/kibana/app/home" --max-time 3 2>$null
            $kibanaOk = ($kb -eq "200" -or $kb -eq "302")
            $otelState = & docker inspect --format "{{.State.Status}}" wibsite-otel-collector 2>&1
            $otelOk = (($otelState -join '') -match 'running')
            if ($helperOk -and $esOk -and $kibanaOk -and $otelOk) { $up = $true; break }
            Write-Host "  ...esperando ($($i*3)s) helper=$helperOk es=$esOk kibana=$kibanaOk otel=$otelOk" -NoNewline; Write-Host "`r" -NoNewline
        }
        if (-not $up) { Write-Host "`n  (algunos servicios aún arrancan — revisa: docker compose ps)" -ForegroundColor Yellow }
        else { Write-OK "SOAC operativo: Helper, Elasticsearch, Kibana y OTel Collector responden" }

        # ─── 3c. Validación profunda del SOAC (suite TeVS, opcional) ──────
        if (-not $SkipTeVS) {
            Write-Step "3c. Validación profunda del SOAC (suite TeVS)"
            $tevsRunner = Join-Path $root "scripts\tevs\tevs-runner.ps1"
            if (-not (Test-Path $tevsRunner)) {
                Write-Warn "No existe $tevsRunner — se omite TeVS."
            } else {
                $pwshCmd = Get-Command pwsh -ErrorAction SilentlyContinue
                if (-not $pwshCmd) {
                    Write-Warn "pwsh (PowerShell 7) no está instalado — se omite TeVS. Instala pwsh o usa -SkipTeVS."
                } else {
                    $tevsTests = Join-Path $root "scripts\tevs\tests"
                    $tevsOut = Run-Capture "pwsh -NoProfile -File `"$tevsRunner`" -TestFolder `"$tevsTests`" -ElasticUrl `"http://localhost:9200`" -ElasticUser `"elastic`" -ElasticPassword `"$esPass`" 2>&1"
                    if ($tevsOut -and $tevsOut[0]) {
                        $tevsOut | Select-Object -Last 25 | ForEach-Object { Write-Host "  $_" -ForegroundColor DarkGray }
                        if ($LASTEXITCODE -ne 0) { Write-Warn "TeVS finalizó con código $LASTEXITCODE — revisa el resumen de arriba." }
                        else { Write-OK "Suite TeVS ejecutada sin errores (ver resumen arriba)" }
                    } else {
                        Write-Warn "TeVS no produjo salida (revisa: pwsh -File $tevsRunner -?)"
                    }
                }
            }
        }
    }

    # ─── 3b. GitLab health ────────────────────────────────────────
    if ($gitlabUp -and -not $SkipWait) { Test-GitLabHealth }

    # ─── 4. Resumen de URLs ───────────────────────────────────────
    Write-Step "4. URLs de los servicios (gateway SSO en https://localhost:8080)"
    $urls = @(
        [pscustomobject]@{ Servicio="FRONTEND Wibsite 2.0 (principal)";  URL="https://localhost:8080/";                     Nota="Login SSO: admin@wibsite.com" }
        [pscustomobject]@{ Servicio="SOAC - Kibana (monitoreo)";          URL="https://localhost:8080/kibana/";             Nota="SSO protegido" }
        [pscustomobject]@{ Servicio="SOAC - Elasticsearch (API)";         URL="http://localhost:9200";                       Nota="cluster health: /_cluster/health" }
        [pscustomobject]@{ Servicio="SOAC - OpenTelemetry Collector";     URL="http://localhost:4318";                       Nota="traces/metrics OTLP" }
        [pscustomobject]@{ Servicio="SOAC - TeVS runner (tests)";         URL=".\scripts\tevs\tevs-runner.ps1";              Nota="14 tests de observabilidad" }
        [pscustomobject]@{ Servicio="Dify (console)";                     URL="https://localhost:8080/dify/";               Nota="tambien http://localhost:3003" }
        [pscustomobject]@{ Servicio="n8n (workflows)";                    URL="https://localhost:8080/n8n/";                 Nota="tambien http://localhost:5679" }
        [pscustomobject]@{ Servicio="Helper API";                         URL="https://localhost:8080/api/";                 Nota="health: /health" }
        [pscustomobject]@{ Servicio="Frontend - Dashboard";               URL="https://localhost:8080/dashboard";            Nota="panel principal de la app" }
        [pscustomobject]@{ Servicio="MinIO Console";                      URL="https://localhost:8080/minio-console/";       Nota="tambien http://localhost:9001" }
        [pscustomobject]@{ Servicio="Portal";                             URL="https://localhost:8080/portal/";              Nota="SSO protegido" }
        [pscustomobject]@{ Servicio="PostgreSQL";                         URL="localhost:5432";                              Nota="bases: wibsite, dify, n8n, chatwoot, twenty" }
        [pscustomobject]@{ Servicio="Redis";                              URL="localhost:6379";                              Nota="" }
        [pscustomobject]@{ Servicio="GitLab Self-Managed (CE)";             URL="http://localhost:9080";                       Nota="devops: issues/CI/registry; admin: root" }
        [pscustomobject]@{ Servicio="GitLab Runner";                        URL="(docker: gitlab-runner)";                     Nota="jobs CI en red wibsite_default" }
    )
    $urls | Format-Table -AutoSize | Out-String | Write-Host

    # ─── 5. Credenciales ──────────────────────────────────────────
    Write-Step "5. Credenciales (leídas desde .env / entorno — sin valores hardcodeados)"
    function Get-EnvVal([string]$key) {
        $envVal = [Environment]::GetEnvironmentVariable($key)
        if ($envVal) { return $envVal }
        $line = Select-String -Path "$root\.env" -Pattern "^$key=" -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($line) { return ($line.Line -split '=', 2)[1].Trim() }
        return $null
    }
    $credEmail = Get-EnvVal 'DIFY_USERNAME'; if (-not $credEmail) { $credEmail = 'admin@wibsite.com' }
    $credAdmin = Get-EnvVal 'AUTHELIA_USER';  if (-not $credAdmin) { $credAdmin = 'admin@wibsite.com' }
    $gitlabPass = $env:GITLAB_ROOT_PASSWORD
    if (-not $gitlabPass) { $gitlabPass = Get-EnvVal 'GITLAB_ROOT_PASSWORD' }
    $creds = @(
        [pscustomobject]@{ Servicio="SSO (Authelia) — todas las apps";      Usuario=$credAdmin;                     Password=(Get-EnvVal 'AUTHELIA_PASSWORD' | ForEach-Object { if ($_) { ''.PadLeft(8,'*') } else { "(obtener de .env)" } }) }
        [pscustomobject]@{ Servicio="Dify";                                  Usuario=$credEmail;                     Password=(Get-EnvVal 'DIFY_ADMIN_PASSWORD' | ForEach-Object { if ($_) { ''.PadLeft(8,'*') } else { "(obtener de .env)" } }) }
        [pscustomobject]@{ Servicio="n8n";                                   Usuario=$credAdmin;                     Password=(Get-EnvVal 'N8N_USER_PASSWORD' | ForEach-Object { if ($_) { ''.PadLeft(8,'*') } else { "(obtener de .env)" } }) }
        [pscustomobject]@{ Servicio="SOAC - Elasticsearch (superusuario)";   Usuario="elastic";                      Password=(Get-EnvVal 'ELASTIC_PASSWORD' | ForEach-Object { if ($_) { ''.PadLeft(8,'*') } else { "(obtener de .env)" } }) }
        [pscustomobject]@{ Servicio="SOAC - Kibana (SSO por defecto)";       Usuario="$credAdmin (SSO)";             Password=(Get-EnvVal 'N8N_USER_PASSWORD' | ForEach-Object { if ($_) { ''.PadLeft(8,'*') } else { "(obtener de .env)" } }) }
        [pscustomobject]@{ Servicio="MinIO";                                 Usuario="minioadmin";                   Password=(Get-EnvVal 'MINIO_ROOT_PASSWORD' | ForEach-Object { if ($_) { ''.PadLeft(8,'*') } else { "(obtener de .env)" } }) }
        [pscustomobject]@{ Servicio="PostgreSQL";                            Usuario="wibsite";                      Password=(Get-EnvVal 'POSTGRES_PASSWORD' | ForEach-Object { if ($_) { ''.PadLeft(8,'*') } else { "(obtener de .env)" } }) }
        [pscustomobject]@{ Servicio="Helper API (X-API-Key)";                Usuario="HELPER_API_KEY";               Password=(Get-EnvVal 'HELPER_API_KEY' | ForEach-Object { if ($_) { ''.PadLeft(8,'*') } else { "(obtener de .env)" } }) }
        [pscustomobject]@{ Servicio="GitLab (root)";                         Usuario="root";                         Password=$(if ($gitlabPass) { '********' } else { "(definir GITLAB_ROOT_PASSWORD en .env)" }) }
    )
    $creds | Format-Table -AutoSize | Out-String | Write-Host

    # ─── 6. Diagnóstico de contenedores ──────────────────────────
    if (-not $NoDiag) { Show-ContainerDiagnostics }
    if (-not $NoDiag -and $gitlabUp) {
        Write-Host "`n  Contenedores GitLab:" -ForegroundColor Cyan
        $glPs = Run-Capture "docker compose -f `"$gitlabComposePath`" ps --format `"table {{.Name}}\t{{.Status}}`" 2>&1"
        if ($glPs -and $glPs[0]) { $glPs | ForEach-Object { Write-Host "  $_" -ForegroundColor DarkGray } }
    }

    # ─── 7. Validación del gateway / frontend ────────────────────
    if (-not $NoDiag) { Test-Gateway }

    # ─── 7b. ACCESO RÁPIDO ───────────────────────────────────────
    Write-Step "LISTO — Accede al sistema"
    Write-Host "  =============================================================" -ForegroundColor Cyan
    Write-Host "    Wibsite Frontend :  https://localhost:8080/" -ForegroundColor Green
    Write-Host "    (login SSO: admin@wibsite.com / Admin@123)" -ForegroundColor DarkGray
    Write-Host "    Monitoreo SOAC   :  https://localhost:8080/kibana/" -ForegroundColor Green
    Write-Host "    GitLab CI/CD     :  http://localhost:9080  (admin: root)" -ForegroundColor Green
    Write-Host "  =============================================================" -ForegroundColor Cyan

    Write-Host "`nTodos los servicios deberían estar arriba. Ver monitoreo en tiempo real:"
    Write-Host "  docker compose ps  |  docker compose logs -f <servicio>  |  docker stats" -ForegroundColor DarkGray
    Write-Host "SOAC: https://localhost:8080/kibana/  (logs/traces/metrics en ES)" -ForegroundColor Green
    Write-Host "GitLab: http://localhost:9080  (CI/CD + issues + registry)" -ForegroundColor Green

    # ─── 8. Monitoreo en vivo ─────────────────────────────────────
    $canMonitor = $false
    try { $null = $Host.UI.RawUI.KeyAvailable; $canMonitor = $true } catch { }

    if (-not $NoPause -and $canMonitor) {
        Write-Step "8. Monitoreo en vivo de contenedores y servicios"
        Write-Host "  El estado se actualiza cada 10 segundos. Presiona ESC para salir." -ForegroundColor DarkGray

        $loop = $true
        while ($loop) {
            Clear-Host
            Write-Host "`nWibsite - Monitoreo en vivo  ($(Get-Date -Format 'yyyy-MM-dd HH:mm:ss'))" -ForegroundColor Cyan
            Write-Host "  ESC para salir | Ctrl+C para cancelar | se refresca cada 10s" -ForegroundColor DarkGray
            Write-Host ""

            $bad = Get-ProblemContainers
            if ($bad.Count -gt 0) {
                Write-Err "Contenedores con problemas ($($bad.Count)): $($bad.Name -join ', ')"
            } else {
                Write-OK "Contenedores con problemas: 0"
            }
            Write-Host ""

            $psOut = Run-Capture "docker compose ps --format `"table {{.Name}}\t{{.Status}}\t{{.Ports}}`" 2>&1"
            if ($psOut -and $psOut[0]) { $psOut | ForEach-Object { Write-Host "  $_" -ForegroundColor DarkGray } }
            else { Write-Err "docker compose ps falló (sin salida)" }

            Write-Host ""
            $gw = & curl.exe -k -s -o NUL -w "%{http_code}" "https://localhost:8080/health" --max-time 3
            $es = & curl.exe -s -o NUL -w "%{http_code}" "http://localhost:9200/_cluster/health" --max-time 3
            $hl = & curl.exe -s -o NUL -w "%{http_code}" "http://localhost:3100/health" --max-time 3
            $au = & curl.exe -k -s -o NUL -w "%{http_code}" "https://localhost:8080/auth/" --max-time 3

            $gwOk = ($gw -eq "200")
            Write-Host "  Gateway (https://localhost:8080/health) -> $gw" -NoNewline
            Write-Host ("  " + $(if ($gwOk) { "[OK]" } else { "[fallo]" })) -ForegroundColor $(if ($gwOk) { "Green" } else { "Red" })

            $esOk = ($es -eq "200")
            Write-Host "  Elasticsearch (:9200/_cluster/health) -> $es" -NoNewline
            Write-Host ("  " + $(if ($esOk) { "[OK]" } else { "[fallo]" })) -ForegroundColor $(if ($esOk) { "Green" } else { "Red" })

            $hlOk = ($hl -eq "200")
            Write-Host "  Helper API (:3100/health) -> $hl" -NoNewline
            Write-Host ("  " + $(if ($hlOk) { "[OK]" } else { "[fallo]" })) -ForegroundColor $(if ($hlOk) { "Green" } else { "Red" })

            $auOk = ($au -eq "200")
            Write-Host "  Authelia (https://localhost:8080/auth/) -> $au" -NoNewline
            Write-Host ("  " + $(if ($auOk) { "[OK]" } else { "[fallo]" })) -ForegroundColor $(if ($auOk) { "Green" } else { "Red" })

            $gl = & curl.exe -s -o NUL -w "%{http_code}" "http://127.0.0.1:9080/users/sign_in" --max-time 3 2>$null
            $glOk = ($gl -eq "200")
            Write-Host "  GitLab (:9080) -> $gl" -NoNewline
            Write-Host ("  " + $(if ($glOk) { "[OK]" } else { "[fallo]" })) -ForegroundColor $(if ($glOk) { "Green" } else { "Red" })

            # Espera hasta 10s o hasta que se presione ESC
            $deadline = (Get-Date).AddSeconds(10)
            while ((Get-Date) -lt $deadline -and $loop) {
                try {
                    if ($Host.UI.RawUI.KeyAvailable) {
                        $k = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
                        if ($k.Key -eq [ConsoleKey]::Escape) { $loop = $false }
                    }
                } catch { }
                Start-Sleep -Milliseconds 250
            }
        }
    } else {
        Write-Step "8. Modo no interactivo (sin monitoreo en vivo, usa -NoPause para CI)"
    }
}
catch {
    Write-Err "Error inesperado: $($_.Exception.Message)"
    Pause-IfInteractive
    exit 1
}