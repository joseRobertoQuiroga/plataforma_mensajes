$ErrorActionPreference = "Stop"

$startedAt = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
$startTime = Get-Date

$expectedStatusCode = 401
$actualStatusCode = 0
$exitCode = 1
$errorCode = $null
$errorMessage = $null

try {
    # Request Kibana through Nginx without auth headers
    # Nginx should return 401 because Authelia intercepts it.
    try {
        $curlOut = & curl.exe -s -o /dev/null -w "%{http_code}" -k -L --max-redirs 0 "$env:GATEWAY_URL/kibana/"
        $actualStatusCode = [int]$curlOut
    } catch {
        throw $_
    }
    
    if ($actualStatusCode -eq $expectedStatusCode -or $actualStatusCode -eq 302) {
        $exitCode = 0
    } else {
        $exitCode = 1
        $errorCode = "AUTH_BYPASS"
        $errorMessage = "Expected 401 or 302, got $actualStatusCode"
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
        test_id = "TEST-SEC-001"
        test_name = "Authelia Protection on Kibana"
        test_version = "1.0.0"
        test_type = "security"
        category = "authorization"
        severity = "critical"
        tags = @("auth", "security", "gate4")
    }
    environment = @{ name = "Wibsite-Docker" }
    application = @{ name = "Nginx-Authelia"; version = "1.0" }
    executor = @{ type = "script"; name = "tevs-runner" }
    deployment_policy = @{ blocking = $true }
    timing = @{ started_at = $startedAt; finished_at = $finishedAt; duration_ms = $duration }
    assertion = @{
        expected = @{ status_code = $expectedStatusCode }
        actual = @{ status_code = $actualStatusCode }
        result = if ($exitCode -eq 0) { "passed" } else { "failed" }
    }
}

if ($exitCode -ne 0) {
    $result.error = @{
        code = $errorCode
        type = "security_vulnerability"
        message = $errorMessage
        component = "Nginx"
    }
}

$result | ConvertTo-Json -Depth 10 | Write-Output
exit $exitCode
