$ErrorActionPreference = "Stop"

$startedAt = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
$startTime = Get-Date

$expectedMinDocs = 1
$actualDocs = 0
$exitCode = 1
$errorCode = $null
$errorMessage = $null

try {
    $auth = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("elastic:wibsite_elastic_pass_2026"))
    $esHeaders = @{ 
        Authorization = "Basic $auth"
        "Content-Type" = "application/json"
    }
    
    # Check for traces in the last 15 minutes
    $query = @{
        query = @{
            range = @{
                "@timestamp" = @{
                    gte = "now-15m"
                    lte = "now"
                }
            }
        }
    }
    
    $payload = $query | ConvertTo-Json -Depth 5 -Compress
    $esResponse = Invoke-RestMethod -Method Post -Uri "$env:ELASTIC_URL/traces-doags.otel-*/_count" -Headers $esHeaders -Body $payload
    
    $actualDocs = $esResponse.count
    
    if ($actualDocs -ge $expectedMinDocs) {
        $exitCode = 0
    } else {
        $exitCode = 1
        $errorCode = "NO_TRACES_RECEIVED"
        $errorMessage = "Expected at least $expectedMinDocs traces in the last 15m, got $actualDocs"
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
        test_id = "TEST-DATA-001"
        test_name = "OTEL Traces Ingestion Validation"
        test_version = "1.0.0"
        test_type = "data_validation"
        category = "observability"
        severity = "high"
        tags = @("traces", "otel", "gate1")
    }
    environment = @{ name = "Wibsite-Docker" }
    application = @{ name = "OTEL Collector"; version = "latest" }
    executor = @{ type = "script"; name = "tevs-runner" }
    deployment_policy = @{ blocking = $true }
    timing = @{ started_at = $startedAt; finished_at = $finishedAt; duration_ms = $duration }
    assertion = @{
        expected = @{ min_docs = $expectedMinDocs }
        actual = @{ docs = $actualDocs }
        result = if ($exitCode -eq 0) { "passed" } else { "failed" }
    }
}

if ($exitCode -ne 0) {
    $result.error = @{
        code = $errorCode
        type = "data_missing"
        message = $errorMessage
        component = "Elasticsearch"
    }
}

$result | ConvertTo-Json -Depth 10 | Write-Output
exit $exitCode
