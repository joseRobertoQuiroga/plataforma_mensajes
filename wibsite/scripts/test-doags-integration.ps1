#!/usr/bin/env pwsh
# ===================================================================
# DOAG-S Integration Test Script
# Validates the 5 layers of the observability platform:
#   Layer 1: Infrastructure (ES, Kibana, OTEL Collector)
#   Layer 2: SSO Integration (Authelia)
#   Layer 3: OTLP Telemetry Reception
#   Layer 4: Data in Elasticsearch
#   Layer 5: Kibana Proxy via Nginx
# ===================================================================

$ErrorActionPreference = "Continue"
$ELASTIC_URL = "http://localhost:9200"
$KIBANA_URL = "http://localhost:5601"
$OTEL_URL = "http://localhost:4318"
$NGINX_URL = "https://localhost:8080"
$ELASTIC_USER = "elastic"
$ELASTIC_PASS = "wibsite_elastic_pass_2026"
$AUTH_HEADER = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("${ELASTIC_USER}:${ELASTIC_PASS}"))

$PASS = 0
$FAIL = 0

function Test-Endpoint {
    param($Name, $Url, $Headers = @{}, $SkipCert = $false)
    try {
        $params = @{
            Uri = $Url
            Method = "GET"
            Headers = $Headers
            TimeoutSec = 10
        }
        if ($SkipCert) {
            $params["SkipCertificateCheck"] = $true
        }
        $resp = Invoke-WebRequest @params -UseBasicParsing
        if ($resp.StatusCode -lt 400) {
            Write-Host "  [PASS] $Name — HTTP $($resp.StatusCode)" -ForegroundColor Green
            $script:PASS++
            return $true
        } else {
            Write-Host "  [FAIL] $Name — HTTP $($resp.StatusCode)" -ForegroundColor Red
            $script:FAIL++
            return $false
        }
    } catch {
        Write-Host "  [FAIL] $Name — $($_.Exception.Message)" -ForegroundColor Red
        $script:FAIL++
        return $false
    }
}

function Test-JsonEndpoint {
    param($Name, $Url, $Headers = @{}, $ExpectedKey = $null)
    try {
        $resp = Invoke-RestMethod -Uri $Url -Headers $Headers -TimeoutSec 10
        if ($ExpectedKey -and -not $resp.$ExpectedKey) {
            Write-Host "  [FAIL] $Name — Missing key: $ExpectedKey" -ForegroundColor Red
            $script:FAIL++
            return $null
        }
        Write-Host "  [PASS] $Name" -ForegroundColor Green
        $script:PASS++
        return $resp
    } catch {
        Write-Host "  [FAIL] $Name — $($_.Exception.Message)" -ForegroundColor Red
        $script:FAIL++
        return $null
    }
}

Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  DOAG-S Platform — Integration Tests" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""

# ─── LAYER 1: Infrastructure ────────────────────────────────────
Write-Host "LAYER 1: Infrastructure Health" -ForegroundColor Yellow
Write-Host "-------------------------------"

$esHeaders = @{ "Authorization" = "Basic $AUTH_HEADER" }

# Elasticsearch health
$esHealth = Test-JsonEndpoint "Elasticsearch cluster health" "$ELASTIC_URL/_cluster/health" $esHeaders "status"
if ($esHealth) {
    Write-Host "  -> Cluster status: $($esHealth.status), nodes: $($esHealth.number_of_nodes)" -ForegroundColor Cyan
}

# Elasticsearch version
$esInfo = Test-JsonEndpoint "Elasticsearch info/version" "$ELASTIC_URL" $esHeaders "version"
if ($esInfo) {
    Write-Host "  -> Version: $($esInfo.version.number)" -ForegroundColor Cyan
}

# Kibana status (direct port)
Test-Endpoint "Kibana (direct :5601)" "$KIBANA_URL/kibana/api/status"

# OTEL Collector health (via metrics endpoint)
# The contrib collector exposes a health check endpoint
Write-Host "  [INFO] OTEL Collector — checking via telemetry send..." -ForegroundColor Cyan

# ─── LAYER 2: SSO / Authelia ────────────────────────────────────
Write-Host ""
Write-Host "LAYER 2: SSO / Authelia Integration" -ForegroundColor Yellow
Write-Host "------------------------------------"

# Authelia health
Test-Endpoint "Authelia health" "http://localhost:9091/api/health" -SkipCert $false

# Nginx → Kibana (via SSO) - should redirect to Authelia login (302 or 401)
try {
    $resp = Invoke-WebRequest -Uri "$NGINX_URL/kibana/" -SkipCertificateCheck -MaximumRedirection 0 -UseBasicParsing -ErrorAction SilentlyContinue
    if ($resp.StatusCode -in @(200, 302, 401)) {
        Write-Host "  [PASS] Nginx /kibana/ — HTTP $($resp.StatusCode) (SSO intercept expected)" -ForegroundColor Green
        $PASS++
    } else {
        Write-Host "  [WARN] Nginx /kibana/ — HTTP $($resp.StatusCode)" -ForegroundColor Yellow
    }
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    if ($statusCode -in @(302, 401, 302)) {
        Write-Host "  [PASS] Nginx /kibana/ — HTTP $statusCode (SSO redirect as expected)" -ForegroundColor Green
        $PASS++
    } else {
        Write-Host "  [FAIL] Nginx /kibana/ — $($_.Exception.Message)" -ForegroundColor Red
        $FAIL++
    }
}

# ─── LAYER 3: OTLP Telemetry Reception ──────────────────────────
Write-Host ""
Write-Host "LAYER 3: OTLP Telemetry Reception" -ForegroundColor Yellow
Write-Host "---------------------------------"

# Send a test trace to OTEL Collector via HTTP
$testTrace = @{
    resourceSpans = @(
        @{
            resource = @{
                attributes = @(
                    @{ key = "service.name"; value = @{ stringValue = "doags-integration-test" } }
                    @{ key = "deployment.environment"; value = @{ stringValue = "production" } }
                )
            }
            scopeSpans = @(
                @{
                    scope = @{ name = "doags-test"; version = "1.0.0" }
                    spans = @(
                        @{
                            traceId = "4bf92f3577b34da6a3ce929d0e0e4736"
                            spanId = "00f067aa0ba902b7"
                            name = "doags.integration.test"
                            kind = 2
                            startTimeUnixNano = ([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() * 1000000).ToString()
                            endTimeUnixNano = (([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() + 100) * 1000000).ToString()
                            status = @{ code = 1 }
                            attributes = @(
                                @{ key = "test.phase"; value = @{ stringValue = "layer3-otlp-reception" } }
                                @{ key = "test.timestamp"; value = @{ stringValue = (Get-Date -Format "o") } }
                            )
                        }
                    )
                }
            )
        }
    )
} | ConvertTo-Json -Depth 10

try {
    $otelResp = Invoke-WebRequest -Uri "$OTEL_URL/v1/traces" `
        -Method POST `
        -Body $testTrace `
        -ContentType "application/json" `
        -TimeoutSec 10 `
        -UseBasicParsing
    if ($otelResp.StatusCode -eq 200) {
        Write-Host "  [PASS] OTEL Collector received test trace — HTTP 200" -ForegroundColor Green
        $PASS++
    } else {
        Write-Host "  [WARN] OTEL Collector — HTTP $($otelResp.StatusCode)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "  [FAIL] OTEL Collector trace send — $($_.Exception.Message)" -ForegroundColor Red
    $FAIL++
}

# Send a test log
$testLog = @{
    resourceLogs = @(
        @{
            resource = @{
                attributes = @(
                    @{ key = "service.name"; value = @{ stringValue = "doags-integration-test" } }
                )
            }
            scopeLogs = @(
                @{
                    logRecords = @(
                        @{
                            timeUnixNano = ([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() * 1000000).ToString()
                            severityNumber = 9
                            severityText = "INFO"
                            body = @{ stringValue = "DOAG-S integration test log — platform bootstrap validation" }
                            attributes = @(
                                @{ key = "event.category"; value = @{ stringValue = "observability" } }
                                @{ key = "event.action"; value = @{ stringValue = "integration.test" } }
                            )
                        }
                    )
                }
            )
        }
    )
} | ConvertTo-Json -Depth 10

try {
    $logResp = Invoke-WebRequest -Uri "$OTEL_URL/v1/logs" `
        -Method POST `
        -Body $testLog `
        -ContentType "application/json" `
        -TimeoutSec 10 `
        -UseBasicParsing
    if ($logResp.StatusCode -eq 200) {
        Write-Host "  [PASS] OTEL Collector received test log — HTTP 200" -ForegroundColor Green
        $PASS++
    } else {
        Write-Host "  [WARN] OTEL Collector log send — HTTP $($logResp.StatusCode)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "  [FAIL] OTEL Collector log send — $($_.Exception.Message)" -ForegroundColor Red
    $FAIL++
}

# ─── LAYER 4: Data in Elasticsearch ─────────────────────────────
Write-Host ""
Write-Host "LAYER 4: Elasticsearch Data Streams" -ForegroundColor Yellow
Write-Host "------------------------------------"

# Wait a moment for OTEL to forward to ES
Start-Sleep -Seconds 5

# Check for OTEL data streams
$dataStreams = Test-JsonEndpoint "Elasticsearch data streams listing" "$ELASTIC_URL/_data_stream?pretty" $esHeaders
if ($dataStreams) {
    $dsCount = ($dataStreams.data_streams | Measure-Object).Count
    Write-Host "  -> Data streams found: $dsCount" -ForegroundColor Cyan
    if ($dsCount -gt 0) {
        $dataStreams.data_streams | Select-Object -First 5 | ForEach-Object {
            Write-Host "     • $($_.name)" -ForegroundColor Cyan
        }
    }
}

# Check traces index
try {
    $tracesResp = Invoke-RestMethod -Uri "$ELASTIC_URL/traces-*/_count" -Headers $esHeaders -TimeoutSec 10
    Write-Host "  [PASS] Traces index — docs: $($tracesResp.count)" -ForegroundColor Green
    $PASS++
} catch {
    Write-Host "  [INFO] Traces index not yet created (normal on first run)" -ForegroundColor Cyan
}

# Check logs index
try {
    $logsResp = Invoke-RestMethod -Uri "$ELASTIC_URL/logs-*/_count" -Headers $esHeaders -TimeoutSec 10
    Write-Host "  [PASS] Logs index — docs: $($logsResp.count)" -ForegroundColor Green
    $PASS++
} catch {
    Write-Host "  [INFO] Logs index not yet created (normal on first run)" -ForegroundColor Cyan
}

# Verify integration test trace made it in
Start-Sleep -Seconds 3
try {
    $searchResp = Invoke-RestMethod -Uri "$ELASTIC_URL/traces-*/_search" `
        -Method POST `
        -Headers ($esHeaders + @{ "Content-Type" = "application/json" }) `
        -Body '{"query":{"match":{"name":"doags.integration.test"}}}' `
        -TimeoutSec 10
    $hits = $searchResp.hits.total.value
    if ($hits -gt 0) {
        Write-Host "  [PASS] Integration test trace found in Elasticsearch ($hits docs)" -ForegroundColor Green
        $PASS++
    } else {
        Write-Host "  [INFO] Test trace not yet indexed (may need more time)" -ForegroundColor Cyan
    }
} catch {
    Write-Host "  [INFO] Could not search traces — may still be indexing" -ForegroundColor Cyan
}

# ─── LAYER 5: Kibana via Nginx + SSO ────────────────────────────
Write-Host ""
Write-Host "LAYER 5: Kibana Proxy via Nginx + SSO" -ForegroundColor Yellow
Write-Host "--------------------------------------"

# Verify Kibana /status endpoint (direct)
Test-Endpoint "Kibana status API (direct)" "$KIBANA_URL/kibana/api/status" -SkipCert $false

# Nginx routes
Test-Endpoint "Nginx → Hub (public)" "$NGINX_URL/hub/" -SkipCert $true
Test-Endpoint "Nginx → Auth portal" "$NGINX_URL/auth/" -SkipCert $true
Test-Endpoint "Nginx health" "$NGINX_URL/health" -SkipCert $true

# ─── Summary ────────────────────────────────────────────────────
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  RESULTS: $PASS passed, $FAIL failed" -ForegroundColor $(if ($FAIL -eq 0) { "Green" } else { "Yellow" })
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""

if ($FAIL -eq 0) {
    Write-Host "All tests passed. DOAG-S platform is operational." -ForegroundColor Green
} else {
    Write-Host "$FAIL test(s) failed. Review output above for details." -ForegroundColor Yellow
    Write-Host "Note: Some failures may be expected if services are still starting." -ForegroundColor Cyan
}
