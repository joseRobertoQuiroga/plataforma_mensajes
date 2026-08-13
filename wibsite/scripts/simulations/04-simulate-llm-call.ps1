$ErrorActionPreference = "Stop"
Write-Host "Simulating LLM Agent trace..."

$traceId = [Guid]::NewGuid().ToString("N")
$spanId = [Guid]::NewGuid().ToString("N").Substring(0,16)
$timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() * 1000000

$payload = @{
    resourceSpans = @(
        @{
            resource = @{
                attributes = @(
                    @{ key = "service.name"; value = @{ stringValue = "dify-worker" } }
                    @{ key = "telemetry.sdk.name"; value = @{ stringValue = "opentelemetry" } }
                )
            }
            scopeSpans = @(
                @{
                    scope = @{ name = "dify.llm" }
                    spans = @(
                        @{
                            traceId = $traceId
                            spanId = $spanId
                            name = "LLM/Generate"
                            kind = 3 # CLIENT
                            startTimeUnixNano = $timestamp
                            endTimeUnixNano = $timestamp + 500000000 # 500ms latency
                            attributes = @(
                                @{ key = "llm.usage.total_tokens"; value = @{ intValue = 150 } }
                                @{ key = "llm.usage.prompt_tokens"; value = @{ intValue = 50 } }
                                @{ key = "llm.usage.completion_tokens"; value = @{ intValue = 100 } }
                                @{ key = "llm.model"; value = @{ stringValue = "gpt-4" } }
                                @{ key = "dify.agent_id"; value = @{ stringValue = "agent-xyz-123" } }
                            )
                        }
                    )
                }
            )
        }
    )
}

$jsonPayload = $payload | ConvertTo-Json -Depth 10

try {
    Invoke-RestMethod -Method Post -Uri "http://localhost:4318/v1/traces" -Body $jsonPayload -Headers @{ "Content-Type" = "application/json" }
    Write-Host "Synthetic LLM trace sent successfully to OTEL Collector." -ForegroundColor Green
} catch {
    Write-Host "Error sending trace: $($_.Exception.Message)" -ForegroundColor Red
}
