param(
    [string]$TestFolder = ".\tests",
    [string]$ElasticUrl = "http://localhost:9200",
    [string]$ElasticUser = "elastic",
    [string]$ElasticPass = "wibsite_elastic_pass_2026",
    [string]$IndexPrefix = "tevs-results",
    [string]$Environment = "Wibsite-Docker"
)

$ErrorActionPreference = "Stop"

# Create a unique execution ID and correlation ID for this run
$executionId = "EXEC-" + (Get-Date -Format "yyyyMMdd-HHmmss") + "-" + (-join ((65..90) + (97..122) | Get-Random -Count 6 | % {[char]$_}))
$correlationId  = "CORR-" + [System.Guid]::NewGuid().ToString("N").Substring(0,12).ToUpper()

Write-Host "Starting TEVS Runner..." -ForegroundColor Cyan
Write-Host "Execution ID: $executionId" -ForegroundColor Cyan

# Exportar endpoints/credenciales a los subprocesos de test (CI pasa nombres de
# servicio via parametros; local queda el fallback localhost de tevs-env.ps1)
$env:ELASTIC_URL = $ElasticUrl
$env:ELASTIC_USER = $ElasticUser
$env:ELASTIC_PASSWORD = $ElasticPass
if (-not $env:KIBANA_URL) { $env:KIBANA_URL = "http://localhost:5601/kibana" }
if (-not $env:HELPER_URL) { $env:HELPER_URL = "http://localhost:3100" }
if (-not $env:GATEWAY_URL) { $env:GATEWAY_URL = "https://localhost:8080" }

# Find all test scripts
$testScripts = Get-ChildItem -Path $TestFolder -Filter "*.ps1" -Recurse

if ($testScripts.Count -eq 0) {
    Write-Host "No tests found in $TestFolder" -ForegroundColor Yellow
    exit 0
}

$auth = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("${ElasticUser}:${ElasticPass}"))
$headers = @{
    Authorization = "Basic $auth"
    "Content-Type" = "application/json"
}

$globalExitCode = 0

foreach ($script in $testScripts) {
    Write-Host "`nRunning Test: $($script.Name)" -ForegroundColor Yellow

    try {
        # Run the script capturing STDOUT and STDERR separately (critical: avoid JSON contamination)
        $tmpStdOut = [System.IO.Path]::GetTempFileName()
        $tmpStdErr = [System.IO.Path]::GetTempFileName()
        # Ejecutar el test con pwsh (Linux/CI) o powershell.exe (Windows local)
        $shellPath = if (Get-Command pwsh -ErrorAction SilentlyContinue) { (Get-Command pwsh).Source } else { "powershell.exe" }
        $proc = Start-Process -FilePath $shellPath -ArgumentList "-ExecutionPolicy", "Bypass", "-File", $script.FullName `
            -RedirectStandardOutput $tmpStdOut -RedirectStandardError $tmpStdErr -Wait -PassThru -NoNewWindow
        $exitCode = $proc.ExitCode
        $rawOut = Get-Content $tmpStdOut -Raw
        $stdout = if ($null -ne $rawOut) { $rawOut.Trim() } else { "" }
        $rawErr = Get-Content $tmpStdErr -Raw
        $stderr = if ($null -ne $rawErr) { $rawErr.Trim() } else { "" }
        Remove-Item $tmpStdOut, $tmpStdErr -ErrorAction SilentlyContinue

        if ($stderr) {
            Write-Host "STDERR from $($script.Name):" -ForegroundColor DarkYellow
            Write-Host $stderr -ForegroundColor Gray
        }

        # Try to parse the JSON
        try {
            $jsonObj = $stdout | ConvertFrom-Json
        } catch {
            Write-Host "Failed to parse test output as JSON. Output was:" -ForegroundColor Red
            Write-Host $stdout -ForegroundColor Gray
            $globalExitCode = 1
            continue
        }

        # Inject execution details (runner-managed fields)
        if (-not $jsonObj.execution) {
            $jsonObj | Add-Member -Type NoteProperty -Name "execution" -Value @{}
        }
        $jsonObj.execution.execution_id  = $executionId
        $jsonObj.execution.correlation_id = $correlationId
        # Enrich environment if script only sent a string name
        if ($jsonObj.environment -is [string]) {
            $jsonObj.environment = @{ name = $jsonObj.environment }
        }
        if (-not $jsonObj.environment) {
            $jsonObj | Add-Member -Type NoteProperty -Name "environment" -Value @{ name = $Environment }
        }
        
        if ($exitCode -eq 0) {
            $jsonObj.execution.status = "passed"
        } elseif ($exitCode -eq 1) {
            $jsonObj.execution.status = "failed"
            $globalExitCode = 1
        } elseif ($exitCode -eq 2) {
            $jsonObj.execution.status = "warning"
        } elseif ($exitCode -eq 3) {
            $jsonObj.execution.status = "blocked"
            $globalExitCode = 1
        } else {
            $jsonObj.execution.status = "error"
            $globalExitCode = 1
        }

        # Validate basic schema
        if (-not $jsonObj.test -or -not $jsonObj.test.test_id) {
            Write-Host "JSON missing required field: test.test_id" -ForegroundColor Red
            $globalExitCode = 1
            continue
        }

        # Print result
        if ($jsonObj.execution.status -eq "passed") {
            Write-Host "Result: PASSED" -ForegroundColor Green
        } else {
            Write-Host "Result: $($jsonObj.execution.status.ToUpper())" -ForegroundColor Red
        }

        # Send to Elasticsearch
        $jsonPayload = $jsonObj | ConvertTo-Json -Depth 10 -Compress
        $dateStr = (Get-Date).ToString("yyyy.MM.dd")
        $indexName = "$IndexPrefix-$dateStr"
        $esUrl = "$ElasticUrl/$indexName/_doc"

        try {
            $response = Invoke-RestMethod -Method Post -Uri $esUrl -Headers $headers -Body $jsonPayload
            Write-Host "Saved to Elasticsearch: $($response._id)" -ForegroundColor DarkGray
        } catch {
            Write-Host "Failed to send to Elasticsearch: $($_.Exception.Message)" -ForegroundColor Red
            if ($_.Exception.Response) {
                $s = $_.Exception.Response.GetResponseStream()
                $reader = New-Object System.IO.StreamReader($s)
                Write-Host $reader.ReadToEnd() -ForegroundColor Red
            }
        }
    } catch {
        Write-Host "Runner Error: $($_.Exception.Message)" -ForegroundColor Red
        $globalExitCode = 1
    }
}

Write-Host "`nTEVS Run Completed with Exit Code: $globalExitCode" -ForegroundColor Cyan
exit $globalExitCode
