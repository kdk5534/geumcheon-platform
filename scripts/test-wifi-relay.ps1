$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$RelayRoot = Join-Path $ProjectRoot "wifi-relay"
$Python = Join-Path $env:LOCALAPPDATA "Programs\Python\Python313\python.exe"
if (-not (Test-Path -LiteralPath $Python)) {
    $Command = Get-Command python.exe -ErrorAction SilentlyContinue
    if (-not $Command) { throw "Python 3.11+ was not found." }
    $Python = $Command.Source
}
Set-Location $RelayRoot
& $Python -m unittest -v test_wifi_relay.py
if ($LASTEXITCODE -ne 0) { throw "WiFi relay tests failed with exit code $LASTEXITCODE." }
