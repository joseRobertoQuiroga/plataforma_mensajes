$ErrorActionPreference = "Stop"

$startedAt = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
$startTime = Get-Date

$minAllowedConfidence = 0.80
$badScoresFound = 0
$exitCode = 1
$errorCode = $null
$errorMessage = $null

try {
    $auth = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("elastic:wibsite_elastic_pass_2026"))
    $esHeaders = @{ 
        Authorization = "Basic $auth"
        "Content-Type" = "application/json"
    }
    
    # Query traces looking for confidence scores lower than the threshold
    # Payload literal: ConvertTo-Json de PS 5.1 rompe hashtables con claves '@...'
    $payload = '{"query":{"bool":{"must":[{"range":{"@timestamp":{"gte":"now-24h","lte":"now"}}},{"range":{"attributes.llm.metrics.confidence_score":{"lt":0.3}}}]}}}'
    
    $esResponse = Invoke-RestMethod -Method Post -Uri "http://localhost:9200/traces-doags.otel-*/_count" -Headers $esHeaders -Body $payload
    
    $badScoresFound = $esResponse.count
    
    if ($badScoresFound -eq 0) {
        $exitCode = 0
    } else {
        $exitCode = 2 # Warning/Deviation
        $errorCode = "LOW_CONFIDENCE_DETECTED"
        $errorMessage = "Detected $badScoresFound agent responses with confidence score below $minAllowedConfidence."
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
        test_id = "TEST-DEV-003"
        test_name = "LLM Confidence & Hallucination Metrics"
        test_version = "1.0.0"
        test_type = "monitoring"
        category = "deviation"
        severity = "high"
        tags = @("llm", "hallucination", "quality", "gate6")
    }
    environment = @{ name = "Wibsite-Docker" }
    application = @{ name = "LLM Analyst"; version = "1.0" }
    executor = @{ type = "script"; name = "tevs-runner" }
    deployment_policy = @{ blocking = $false }
    timing = @{ started_at = $startedAt; finished_at = $finishedAt; duration_ms = $duration }
    assertion = @{
        expected = @{ min_confidence = $minAllowedConfidence }
        actual = @{ low_confidence_events = $badScoresFound }
        result = if ($exitCode -eq 0) { "passed" } elseif ($exitCode -eq 2) { "warning" } else { "failed" }
    }
}

if ($exitCode -ne 0) {
    $result.error = @{
        code = $errorCode
        type = "quality_degradation"
        message = $errorMessage
        component = "LLM-Agent"
    }
}

$result | ConvertTo-Json -Depth 10 | Write-Output
exit $exitCode
