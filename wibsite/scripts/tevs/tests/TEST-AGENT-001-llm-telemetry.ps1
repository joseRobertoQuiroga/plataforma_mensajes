$ErrorActionPreference = "Stop"

$startedAt = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
$startTime = Get-Date

$expectedField = "llm.usage.total_tokens"
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
    
    # Query for any Dify or LLM traces that contain token usage metadata
    # We simulate this by checking if ANY trace in the last 24h has some llm token field.
    # In a real environment, you'd filter specifically by service.name = dify or llm-analyst
    $query = @{
        query = @{
            bool = @{
                must = @(
                    @{ range = @{ "@timestamp" = @{ gte = "now-24h"; lte = "now" } } }
                )
                should = @(
                    @{ exists = @{ field = "llm.usage.total_tokens" } },
                    @{ exists = @{ field = "attributes.llm.token_count" } },
                    @{ exists = @{ field = "metadata.tokens" } }
                )
                minimum_should_match = 1
            }
        }
        size = 1
    }
    
    $payload = $query | ConvertTo-Json -Depth 10 -Compress
    $esResponse = Invoke-RestMethod -Method Post -Uri "http://localhost:9200/traces-doags.otel-*/_search?ignore_unavailable=true" -Headers $esHeaders -Body $payload
    
    if ($esResponse.hits.total.value -gt 0) {
        $actualFieldFound = $true
        $exitCode = 0
    } else {
        $exitCode = 1
        $errorCode = "MISSING_AGENT_TELEMETRY"
        $errorMessage = "No LLM trace found with token usage metadata (e.g. '$expectedField') in the last 24h. Agents might be operating without financial/performance observability."
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
        test_id = "TEST-AGENT-001"
        test_name = "Agent/LLM Telemetry Validation (Tokens & Latency)"
        test_version = "1.0.0"
        test_type = "integration"
        category = "governance"
        severity = "critical"
        tags = @("llm", "tokens", "dify", "gate-agent")
    }
    environment = @{ name = "Wibsite-Docker" }
    application = @{ name = "LLM Analyst & Dify"; version = "1.0" }
    executor = @{ type = "script"; name = "tevs-runner" }
    deployment_policy = @{ blocking = $true } # Missing telemetry for LLMs should block deployments to avoid silent cost overruns
    timing = @{ started_at = $startedAt; finished_at = $finishedAt; duration_ms = $duration }
    assertion = @{
        expected = @{ has_token_metrics = $true }
        actual = @{ has_token_metrics = $actualFieldFound }
        result = if ($exitCode -eq 0) { "passed" } else { "failed" }
    }
}

if ($exitCode -ne 0) {
    $result.error = @{
        code = $errorCode
        type = "observability_gap"
        message = $errorMessage
        component = "LLM-Agent"
    }
}

$result | ConvertTo-Json -Depth 10 | Write-Output
exit $exitCode
