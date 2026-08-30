$ErrorActionPreference = "Stop"

$startedAt = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
$startTime = Get-Date

$exitCode = 1
$errorCode = $null
$errorMessage = $null
$e2eEvents = 0
$e2ePassed = 0
$e2eSkipped = 0

try {
    $auth = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("elastic:wibsite_elastic_pass_2026"))
    $esHeaders = @{
        Authorization = "Basic $auth"
        "Content-Type" = "application/json"
    }

    # Verifica que los resultados de UI E2E (Playwright) llegaron al SOAC (ES) en las Ãºltimas 24h
    $payload = '{"query":{"bool":{"must":[{"range":{"@timestamp":{"gte":"now-24h","lte":"now"}}},{"match":{"attributes.event.type":"e2e_ui"}}]}},"size":100,"aggs":{"by_action":{"terms":{"field":"attributes.wibsite.action"}}}}'

    $esResponse = Invoke-RestMethod -Method Post -Uri "$env:ELASTIC_URL/logs-doags.otel-production/_search" -Headers $esHeaders -Body $payload

    $e2eEvents = $esResponse.hits.total.value
    if ($e2eEvents -gt 0) {
        foreach ($bucket in $esResponse.aggregations.by_action.buckets) {
            if ($bucket.key -eq "test.finished") { $e2ePassed = $bucket.doc_count }
            if ($bucket.key -eq "test.skipped") { $e2eSkipped = $bucket.doc_count }
        }
        # Gate: al menos un evento e2e_ui debe haberse registrado como finished (passed)
        if ($e2ePassed -ge 1) {
            $exitCode = 0
        } else {
            $exitCode = 1
            $errorCode = "UI_E2E_NO_FINISHED"
            $errorMessage = "No e2e_ui 'test.finished' events found in the last 24h (only $e2eEvents total)."
        }
    } else {
        $exitCode = 1
        $errorCode = "UI_E2E_MISSING"
        $errorMessage = "No e2e_ui events found in Elasticsearch (SOAC) in the last 24h."
    }
} catch {
    $exitCode = 1
    $errorCode = "QUERY_ERROR"
    $errorMessage = $_.Exception.Message
}

$finishedAt = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
$duration = [math]::Round(((Get-Date) - $startTime).TotalMilliseconds)

$result = @{
    schema = @{ name = "TEVS"; version = "1.0" }
    test = @{
        test_id = "TEST-UI-001"
        test_name = "UI E2E Integration into SOAC (Playwright)"
        test_version = "1.0.0"
        test_type = "integration"
        category = "ui_e2e"
        severity = "medium"
        tags = @("ui", "e2e", "playwright", "gate3")
    }
    environment = @{ name = "Wibsite-Docker" }
    application = @{ name = "Helper API"; version = "latest" }
    executor = @{ type = "script"; name = "tevs-runner" }
    deployment_policy = @{ blocking = $false }
    timing = @{ started_at = $startedAt; finished_at = $finishedAt; duration_ms = $duration }
    assertion = @{
        expected = @{ e2e_events_gt_0 = $true; finished_ge_1 = $true }
        actual = @{ e2e_events = $e2eEvents; finished = $e2ePassed; skipped = $e2eSkipped }
        result = if ($exitCode -eq 0) { "passed" } else { "failed" }
    }
}

if ($exitCode -ne 0) {
    $result.error = @{
        code = $errorCode
        type = "ui_e2e_integration_failure"
        message = $errorMessage
        component = "Elasticsearch"
    }
}

$result | ConvertTo-Json -Depth 10 | Write-Output
exit $exitCode
