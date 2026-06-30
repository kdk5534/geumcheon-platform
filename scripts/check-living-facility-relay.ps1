$ErrorActionPreference = "Stop"
if ([string]::IsNullOrWhiteSpace($env:LIVING_FACILITY_RELAY_TOKEN)) { throw "LIVING_FACILITY_RELAY_TOKEN is required for authenticated status." }
$Health = Invoke-RestMethod -Method Get -Uri "http://127.0.0.1:18089/health" -TimeoutSec 3
$Status = Invoke-RestMethod -Method Get -Uri "http://127.0.0.1:18089/v1/status" `
    -Headers @{ "X-Relay-Token" = $env:LIVING_FACILITY_RELAY_TOKEN } -TimeoutSec 3
[pscustomobject]@{ Health=$Health.status; Service=$Status.service; AllowedServices=@($Status.allowedServices).Count; LastSuccessAt=$Status.lastSuccessAt }
