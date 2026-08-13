$ErrorActionPreference = "Stop"

$esUrl = "http://localhost:9200"
$auth = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("elastic:wibsite_elastic_pass_2026"))
$headers = @{
    Authorization = "Basic $auth"
    "Content-Type" = "application/json"
}

Write-Host "Configuring ILM Policy for TEVS..." -ForegroundColor Cyan

# 1. Create ILM Policy
$ilmPayload = @{
    policy = @{
        phases = @{
            hot = @{
                actions = @{
                    rollover = @{
                        max_age = "30d"
                        max_size = "50gb"
                    }
                }
            }
            cold = @{
                min_age = "30d"
                actions = @{
                    set_priority = @{ priority = 0 }
                }
            }
            delete = @{
                min_age = "90d"
                actions = @{
                    delete = @{}
                }
            }
        }
    }
} | ConvertTo-Json -Depth 5 -Compress

Invoke-RestMethod -Method Put -Uri "$esUrl/_ilm/policy/tevs-ilm-policy" -Headers $headers -Body $ilmPayload
Write-Host "ILM Policy 'tevs-ilm-policy' created (90d retention)." -ForegroundColor Green

# 2. Attach ILM to the tevs-results-* index template
$templatePayload = @{
    index_patterns = @("tevs-results-*")
    template = @{
        settings = @{
            "index.lifecycle.name" = "tevs-ilm-policy"
            "index.lifecycle.rollover_alias" = "tevs-results"
        }
    }
} | ConvertTo-Json -Depth 5 -Compress

# Note: We use _index_template to update the template settings while keeping the mappings intact
# But since we previously used _index_template with mappings, we need to merge them.
# To keep it simple, we just update the settings component template and attach it, or just update the template entirely.
# Let's fetch existing and inject settings.
try {
    $existingTemplateStr = Invoke-RestMethod -Method Get -Uri "$esUrl/_index_template/tevs-results-template" -Headers $headers | ConvertTo-Json -Depth 20
    $existingTemplate = $existingTemplateStr | ConvertFrom-Json
    $template = $existingTemplate.index_templates[0].index_template
    
    if (-not $template.template.settings) {
        $template.template | Add-Member -Type NoteProperty -Name "settings" -Value @{}
    }
    $template.template.settings."index.lifecycle.name" = "tevs-ilm-policy"
    
    $fullPayload = $template | ConvertTo-Json -Depth 10 -Compress
    Invoke-RestMethod -Method Put -Uri "$esUrl/_index_template/tevs-results-template" -Headers $headers -Body $fullPayload
    Write-Host "ILM Policy attached to tevs-results-template." -ForegroundColor Green
} catch {
    Write-Host "Failed to update template: $($_.Exception.Message)" -ForegroundColor Red
}
