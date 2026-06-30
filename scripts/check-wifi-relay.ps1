$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($env:WIFI_RELAY_TOKEN)) {
    throw "WIFI_RELAY_TOKEN is required."
}
$HostName = if ($env:WIFI_RELAY_HOST) { $env:WIFI_RELAY_HOST } else { "127.0.0.1" }
$Port = if ($env:WIFI_RELAY_PORT) { $env:WIFI_RELAY_PORT } else { "18088" }
if ($HostName -notin @("127.0.0.1", "::1", "localhost")) {
    throw "Relay status checks are restricted to loopback."
}
$BaseUrl = "http://${HostName}:${Port}"
$Health = Invoke-RestMethod -Method Get -Uri "$BaseUrl/health" -TimeoutSec 5
$Status = Invoke-RestMethod -Method Get -Uri "$BaseUrl/v1/status" -Headers @{ "X-Relay-Token" = $env:WIFI_RELAY_TOKEN } -TimeoutSec 5
[pscustomobject]@{
    health = $Health.status
    service = $Status.service
    status = $Status.status
    lastAttemptAt = $Status.lastAttemptAt
    lastSuccessAt = $Status.lastSuccessAt
    lastSuccessCount = $Status.lastSuccessCount
    errorCode = $Status.errorCode
} | ConvertTo-Json -Depth 5
