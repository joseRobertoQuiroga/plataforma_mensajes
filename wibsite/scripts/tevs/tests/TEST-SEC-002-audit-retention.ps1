$ErrorActionPreference = "Stop"

$startedAt = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
$startTime = Get-Date

$expectedPolicy = "tevs-ilm-policy"
$actualPolicy = "none"
$exitCode = 1
$errorCode = $null
$errorMessage = $null

try {
    $auth = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("elastic:wibsite_elastic_pass_2026"))
    $esHeaders = @{ 
        Authorization = "Basic $auth"
        "Content-Type" = "application/json"
    }
    
    # Query Elasticsearch index template settings for tevs-results
    $esResponse = Invoke-RestMethod -Method Get -Uri "$env:ELASTIC_URL/_index_template/tevs-results-template" -Headers $esHeaders
    
    $settings = $esResponse.index_templates[0].index_template.template.settings
    if ($settings.index -and $settings.index.lifecycle) {
        $actualPolicy = $settings.index.lifecycle.name
    } elseif ($settings."index.lifecycle.name") {
        $actualPolicy = $settings."index.lifecycle.name"
    } else {
        $actualPolicy = "none"
    }
    
    if ($actualPolicy -eq $expectedPolicy) {
        $exitCode = 0
    } else {
        $exitCode = 1
        $errorCode = "MISSING_ILM_POLICY"
        $errorMessage = "Expected ILM policy '$expectedPolicy', got '$actualPolicy'."
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
        test_id = "TEST-SEC-002"
        test_name = "Audit Data Retention Validation (ILM)"
        test_version = "1.0.0"
        test_type = "security"
        category = "audit"
        severity = "high"
        tags = @("ilm", "retention", "security", "gate3")
    }
    environment = @{ name = "Wibsite-Docker" }
    application = @{ name = "Elasticsearch"; version = "latest" }
    executor = @{ type = "script"; name = "tevs-runner" }
    deployment_policy = @{ blocking = $true }
    timing = @{ started_at = $startedAt; finished_at = $finishedAt; duration_ms = $duration }
    assertion = @{
        expected = @{ ilm_policy = $expectedPolicy }
        actual = @{ ilm_policy = $actualPolicy }
        result = if ($exitCode -eq 0) { "passed" } else { "failed" }
    }
}

if ($exitCode -ne 0) {
    $result.error = @{
        code = $errorCode
        type = "security_vulnerability"
        message = $errorMessage
        component = "Elasticsearch"
    }
}

$result | ConvertTo-Json -Depth 10 | Write-Output
exit $exitCode
