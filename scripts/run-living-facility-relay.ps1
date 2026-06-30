$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$RelayRoot = Join-Path $ProjectRoot "living-facility-relay"
$Python = Get-Command python.exe -ErrorAction SilentlyContinue
if (-not $Python -or $Python.Source -like "*WindowsApps*") { throw "Install Python 3.11+ or place python.exe on PATH." }
if ([string]::IsNullOrWhiteSpace($env:SEOUL_OPEN_API_KEY)) { throw "SEOUL_OPEN_API_KEY is required." }
if ([string]::IsNullOrWhiteSpace($env:LIVING_FACILITY_RELAY_TOKEN)) {
    Import-Module (Join-Path $PSScriptRoot "living-facility-relay-lifecycle.psm1") -Force
    $env:LIVING_FACILITY_RELAY_TOKEN = New-LivingFacilityRelayToken
}
$env:LIVING_FACILITY_RELAY_HOST = "127.0.0.1"
$env:LIVING_FACILITY_RELAY_PORT = "18089"
Set-Location $RelayRoot
& $Python.Source server.py
