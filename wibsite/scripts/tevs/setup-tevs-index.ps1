$ErrorActionPreference = "Stop"

$esUrl = "http://localhost:9200"
$auth = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("elastic:wibsite_elastic_pass_2026"))
$headers = @{
    Authorization = "Basic $auth"
    "Content-Type" = "application/json"
}

# 1. Create Index Template for tevs-results-*
$template = @{
    index_patterns = @("tevs-results-*")
    template = @{
        settings = @{
            "index.lifecycle.name" = "tevs-ilm-policy"
            "index.lifecycle.rollover_alias" = "tevs-results"
        }
        mappings = @{
            properties = @{
                schema = @{
                    properties = @{
                        name = @{ type = "keyword" }
                        version = @{ type = "keyword" }
                    }
                }
                test = @{
                    properties = @{
                        test_id = @{ type = "keyword" }
                        test_name = @{ type = "text"; fields = @{ keyword = @{ type = "keyword"; ignore_above = 256 } } }
                        test_version = @{ type = "keyword" }
                        test_type = @{ type = "keyword" }
                        category = @{ type = "keyword" }
                        severity = @{ type = "keyword" }
                        tags = @{ type = "keyword" }
                    }
                }
                execution = @{
                    properties = @{
                        execution_id = @{ type = "keyword" }
                        correlation_id = @{ type = "keyword" }
                        status = @{ type = "keyword" }
                        started_at = @{ type = "date" }
                        finished_at = @{ type = "date" }
                        duration_ms = @{ type = "long" }
                    }
                }
                environment = @{ properties = @{ name = @{ type = "keyword" } } }
                application = @{ properties = @{ name = @{ type = "keyword" }; version = @{ type = "keyword" } } }
                executor = @{ properties = @{ type = @{ type = "keyword" }; name = @{ type = "keyword" } } }
                deployment_policy = @{ properties = @{ blocking = @{ type = "boolean" } } }
                error = @{
                    properties = @{
                        code = @{ type = "keyword" }
                        type = @{ type = "keyword" }
                        message = @{ type = "text" }
                        component = @{ type = "keyword" }
                    }
                }
            }
        }
    }
}

Write-Host "Creating TEVS Index Template..." -ForegroundColor Yellow
$payload = $template | ConvertTo-Json -Depth 10 -Compress
Invoke-RestMethod -Method Put -Uri "$esUrl/_index_template/tevs-results-template" -Headers $headers -Body $payload
Write-Host "Template Created." -ForegroundColor Green

# 2. Setup Data View in Kibana (We'll assume Kibana is running)
Write-Host "Creating Kibana Data View..." -ForegroundColor Yellow
$kbUrl = "http://localhost:5601/kibana"
$kbHeaders = @{
    Authorization = "Basic $auth"
    "kbn-xsrf" = "true"
    "Content-Type" = "application/json"
}

$dvPayload = @{
    data_view = @{
        id = "tevs-results"
        title = "tevs-results-*"
        name = "TEVS Results"
        timeFieldName = "execution.started_at"
    }
    override = $true
} | ConvertTo-Json -Depth 5 -Compress

Invoke-RestMethod -Method Post -Uri "$kbUrl/api/data_views/data_view" -Headers $kbHeaders -Body $dvPayload
Write-Host "Data View Created." -ForegroundColor Green
