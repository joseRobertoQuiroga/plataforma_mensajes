$ErrorActionPreference = "Stop"

$startedAt = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
$startTime = Get-Date

$expectedStatus = "available"
$actualStatus = "unknown"
$exitCode = 1
$errorCode = $null
$errorMessage = $null

try {
    # Check Elasticsearch
    $auth = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("elastic:wibsite_elastic_pass_2026"))
    $esHeaders = @{ Authorization = "Basic $auth" }
    
    $esResponse = Invoke-RestMethod -Uri "http://localhost:9200/_cluster/health" -Headers $esHeaders
    if ($esResponse.status -ne "green" -and $esResponse.status -ne "yellow") {
        throw "Elasticsearch is $($esResponse.status)"
    }

    # Check Kibana
    $kbResponse = Invoke-RestMethod -Uri "http://localhost:5601/kibana/api/status" -Headers $esHeaders
    $actualStatus = $kbResponse.status.overall.level
    
    if ($actualStatus -eq $expectedStatus) {
        $exitCode = 0
    } else {
        $exitCode = 1
        $errorCode = "KIBANA_UNAVAILABLE"
        $errorMessage = "Kibana status is $actualStatus"
    }

} catch {
    $exitCode = 1
    $errorCode = "CONNECTION_ERROR"
    $errorMessage = $_.Exception.Message
}

$finishedAt = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
$duration = [math]::Round(((Get-Date) - $startTime).TotalMilliseconds)

$result = @{
    schema = @{ name = "TEVS"; version = "1.0" }
    test = @{
        test_id = "TEST-OBS-001"
        test_name = "Kibana and Elasticsearch Health"
        test_version = "1.0.0"
        test_type = "health"
        category = "observability"
        severity = "critical"
        tags = @("monitoring", "gate1")
    }
    environment = @{ name = "Wibsite-Docker" }
    application = @{ name = "Observability Stack"; version = "9.4.2" }
    executor = @{ type = "script"; name = "tevs-runner" }
    deployment_policy = @{ blocking = $true }
    timing = @{ started_at = $startedAt; finished_at = $finishedAt; duration_ms = $duration }
    assertion = @{
        expected = @{ status = $expectedStatus }
        actual = @{ status = $actualStatus }
        result = if ($exitCode -eq 0) { "passed" } else { "failed" }
    }
}

if ($exitCode -ne 0) {
    $result.error = @{
        code = $errorCode
        type = "availability"
        message = $errorMessage
        component = "Kibana"
    }
}

$result | ConvertTo-Json -Depth 10 | Write-Output
exit $exitCode
