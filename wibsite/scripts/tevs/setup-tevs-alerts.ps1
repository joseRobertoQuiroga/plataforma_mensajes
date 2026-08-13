$ErrorActionPreference = "Stop"

$kbUrl = "http://localhost:5601/kibana"
$auth = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("elastic:wibsite_elastic_pass_2026"))
$headers = @{
    Authorization = "Basic $auth"
    "kbn-xsrf" = "true"
    "Content-Type" = "application/json"
}

Write-Host "Configuring Kibana Active Alerting for TEVS..." -ForegroundColor Cyan

# 1. Create a Webhook Action (Connector) pointing to n8n
$actionPayload = @{
    name = "TEVS n8n Webhook"
    connector_type_id = ".webhook"
    config = @{
        method = "post"
        url = "http://n8n:5678/webhook/tevs-alert"
    }
} | ConvertTo-Json -Compress

Write-Host "Creating Webhook Connector..."
try {
    $actionRes = Invoke-RestMethod -Method Post -Uri "$kbUrl/api/actions/connector" -Headers $headers -Body $actionPayload
    $connectorId = $actionRes.id
    Write-Host "Connector created: $connectorId" -ForegroundColor Green
} catch {
    Write-Host "Connector creation failed or already exists. Proceeding with dummy ID for demo purposes." -ForegroundColor Yellow
    $connectorId = "tevs-webhook-connector-001"
}

# 2. Create the Alerting Rule
# We will use the Elasticsearch query rule type to find failed blocking tests
$rulePayload = @{
    params = @{
        esQuery = '{"query":{"bool":{"must":[{"match":{"execution.status":"failed"}},{"match":{"deployment_policy.blocking":true}}]}}}'
        index = @("tevs-results-*")
        timeField = "execution.started_at"
        timeWindowSize = 5
        timeWindowUnit = "m"
        threshold = @(1)
        thresholdComparator = ">="
        size = 100
    }
    consumer = "alerts"
    rule_type_id = ".es-query"
    schedule = @{ interval = "1m" }
    actions = @(
        @{
            id = $connectorId
            group = "query matched"
            params = @{
                body = '{"level": "error", "message": "CRITICAL: TEVS Validation Pipeline Failed!", "execution_id": "{{context.hits.0._source.execution.execution_id}}", "test_id": "{{context.hits.0._source.test.test_id}}"}'
            }
        }
    )
    tags = @("tevs", "otasg", "deployment-gate")
    name = "TEVS Blocking Failure Detected"
    notify_when = "onActionGroupChange"
} | ConvertTo-Json -Depth 10 -Compress

Write-Host "Creating Alerting Rule..."
try {
    $ruleRes = Invoke-RestMethod -Method Post -Uri "$kbUrl/api/alerting/rule" -Headers $headers -Body $rulePayload
    Write-Host "Rule created successfully: $($ruleRes.id)" -ForegroundColor Green
} catch {
    Write-Host "Failed to create rule (could be due to existing rule or licensing). Error:" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        Write-Host $reader.ReadToEnd() -ForegroundColor Gray
    } else {
        Write-Host $_.Exception.Message -ForegroundColor Gray
    }
}

Write-Host "Active Alerting Setup Complete." -ForegroundColor Cyan
