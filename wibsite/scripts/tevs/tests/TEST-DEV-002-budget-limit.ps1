$ErrorActionPreference = "Stop"

$startedAt = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
$startTime = Get-Date

$maxAllowedTokens = 50000
$actualTokens = 0
$exitCode = 1
$errorCode = $null
$errorMessage = $null

try {
    $auth = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("elastic:wibsite_elastic_pass_2026"))
    $esHeaders = @{ 
        Authorization = "Basic $auth"
        "Content-Type" = "application/json"
    }
    
    # Query to sum tokens used in the last hour
    $query = @{
        query = @{
            bool = @{
                must = @(
                    @{ range = @{ "@timestamp" = @{ gte = "now-1h"; lte = "now" } } },
                    @{ exists = @{ field = "llm.usage.total_tokens" } }
                )
            }
        }
        aggs = @{
            total_tokens = @{
                sum = @{ field = "llm.usage.total_tokens" }
            }
        }
        size = 0
    }
    
    $payload = $query | ConvertTo-Json -Depth 5 -Compress
    $esResponse = Invoke-RestMethod -Method Post -Uri "http://localhost:9200/traces-doags.otel-*/_search" -Headers $esHeaders -Body $payload
    
    $actualTokens = $esResponse.aggregations.total_tokens.value
    
    if ($actualTokens -le $maxAllowedTokens) {
        $exitCode = 0
    } else {
        $exitCode = 2 # Warning/Deviation
        $errorCode = "BUDGET_EXCEEDED"
        $errorMessage = "LLM Token usage ($actualTokens) exceeded the allowed threshold ($maxAllowedTokens) in the last hour."
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
        test_id = "TEST-DEV-002"
        test_name = "LLM Budget & Token Usage Deviation"
        test_version = "1.0.0"
        test_type = "monitoring"
        category = "deviation"
        severity = "medium"
        tags = @("llm", "budget", "anomaly", "gate6")
    }
    environment = @{ name = "Wibsite-Docker" }
    application = @{ name = "LLM Analyst"; version = "1.0" }
    executor = @{ type = "script"; name = "tevs-runner" }
    deployment_policy = @{ blocking = $false }
    timing = @{ started_at = $startedAt; finished_at = $finishedAt; duration_ms = $duration }
    assertion = @{
        expected = @{ max_tokens_per_hour = $maxAllowedTokens }
        actual = @{ tokens_used = $actualTokens }
        result = if ($exitCode -eq 0) { "passed" } elseif ($exitCode -eq 2) { "warning" } else { "failed" }
    }
}

if ($exitCode -ne 0) {
    $result.error = @{
        code = $errorCode
        type = "budget_anomaly"
        message = $errorMessage
        component = "Elasticsearch"
    }
}

$result | ConvertTo-Json -Depth 10 | Write-Output
exit $exitCode
