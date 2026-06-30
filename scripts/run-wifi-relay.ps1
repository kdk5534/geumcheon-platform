$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$RelayRoot = Join-Path $ProjectRoot "wifi-relay"
$ServerPath = Join-Path $RelayRoot "server.py"

if ([string]::IsNullOrWhiteSpace($env:SEOUL_OPEN_API_KEY)) {
    throw "SEOUL_OPEN_API_KEY is required by the isolated WiFi relay."
}
if ([string]::IsNullOrWhiteSpace($env:WIFI_RELAY_TOKEN) -or $env:WIFI_RELAY_TOKEN.Length -lt 32) {
    throw "WIFI_RELAY_TOKEN must contain at least 32 random characters."
}
if ([string]::IsNullOrWhiteSpace($env:WIFI_RELAY_HOST)) { $env:WIFI_RELAY_HOST = "127.0.0.1" }
if ($env:WIFI_RELAY_HOST -notin @("127.0.0.1", "::1", "localhost")) {
    throw "WIFI_RELAY_HOST must be loopback-only."
}
if ([string]::IsNullOrWhiteSpace($env:WIFI_RELAY_PORT)) { $env:WIFI_RELAY_PORT = "18088" }
if ([string]::IsNullOrWhiteSpace($env:WIFI_RELAY_STATE_PATH)) {
    $env:WIFI_RELAY_STATE_PATH = Join-Path $ProjectRoot ".tmp\wifi-relay-state.json"
}

$Python = $null
$Candidates = @(
    (Join-Path $env:LOCALAPPDATA "Programs\Python\Python313\python.exe"),
    (Join-Path $env:LOCALAPPDATA "Programs\Python\Python312\python.exe")
)
foreach ($Candidate in $Candidates) {
    if (Test-Path -LiteralPath $Candidate) { $Python = $Candidate; break }
}
if (-not $Python) {
    $Command = Get-Command python.exe -ErrorAction SilentlyContinue
    if ($Command) { $Python = $Command.Source }
}
if (-not $Python) { throw "Python 3.11+ was not found." }

Write-Output "wifi_relay_bind=$($env:WIFI_RELAY_HOST):$($env:WIFI_RELAY_PORT)"
Write-Output "wifi_relay_upstream=openapi.seoul.go.kr:8088/TbPublicWifiInfo_GC"
Set-Location $RelayRoot
& $Python $ServerPath
