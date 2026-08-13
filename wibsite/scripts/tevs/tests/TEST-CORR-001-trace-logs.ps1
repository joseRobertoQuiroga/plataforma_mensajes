$ErrorActionPreference = "Stop"

$startedAt = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
$startTime = Get-Date

$expectedField = "traceId"
$actualFieldFound = $false
$exitCode = 1
$errorCode = $null
$errorMessage = $null

try {
    $auth = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("elastic:wibsite_elastic_pass_2026"))
    $esHeaders = @{ 
        Authorization = "Basic $auth"
        "Content-Type" = "application/json"
    }
    
    # Check if recent traces have a traceId
    $query = @{
        query = @{
            bool = @{
                must = @(
                    @{ range = @{ "@timestamp" = @{ gte = "now-1h"; lte = "now" } } },
                    @{ exists = @{ field = "traceId" } }
                )
            }
        }
        size = 1
    }
    
    $payload = $query | ConvertTo-Json -Depth 5 -Compress
    $esResponse = Invoke-RestMethod -Method Post -Uri "http://localhost:9200/traces-doags.otel-*/_search" -Headers $esHeaders -Body $payload
    
    if ($esResponse.hits.total.value -gt 0) {
        $actualFieldFound = $true
        $exitCode = 0
    } else {
        $exitCode = 1
        $errorCode = "CORRELATION_MISSING"
        $errorMessage = "No traces found with a valid '$expectedField' in the last hour."
    }
} catch {
    # If index is missing or query fails, handle gracefully
    $exitCode = 1
    $errorCode = "QUERY_ERROR"
    $errorMessage = $_.Exception.Message
}

$finishedAt = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
$duration = [math]::Round(((Get-Date) - $startTime).TotalMilliseconds)

$result = @{
    schema = @{ name = "TEVS"; version = "1.0" }
    test = @{
        test_id = "TEST-CORR-001"
        test_name = "Trace ID Correlation Validation"
        test_version = "1.0.0"
        test_type = "integration"
        category = "correlation"
        severity = "high"
        tags = @("traces", "correlation", "gate2")
    }
    environment = @{ name = "Wibsite-Docker" }
    application = @{ name = "OTEL Collector"; version = "latest" }
    executor = @{ type = "script"; name = "tevs-runner" }
    deployment_policy = @{ blocking = $true }
    timing = @{ started_at = $startedAt; finished_at = $finishedAt; duration_ms = $duration }
    assertion = @{
        expected = @{ has_trace_id = $true }
        actual = @{ has_trace_id = $actualFieldFound }
        result = if ($exitCode -eq 0) { "passed" } else { "failed" }
    }
}

if ($exitCode -ne 0) {
    $result.error = @{
        code = $errorCode
        type = "correlation_failure"
        message = $errorMessage
        component = "Elasticsearch"
    }
}

$result | ConvertTo-Json -Depth 10 | Write-Output
exit $exitCode
