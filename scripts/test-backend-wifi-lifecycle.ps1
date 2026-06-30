$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$TestPath = Join-Path $PSScriptRoot "tests\wifi-relay-lifecycle.Tests.ps1"

$Result = Invoke-Pester -Script $TestPath -PassThru
if ($Result.FailedCount -ne 0) {
    throw "WiFi relay lifecycle tests failed: $($Result.FailedCount)."
}
Write-Output "wifi_relay_lifecycle_tests=$($Result.PassedCount)/$($Result.TotalCount)"
