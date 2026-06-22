#Requires -RunAsAdministrator

param(
    [string]$PythonPath = "$env:LOCALAPPDATA\Programs\Python\Python313\python.exe"
)

$ErrorActionPreference = "Stop"

$RuleName = "Geumcheon Living Relay Seoul OpenAPI 8088"
$HostName = "openapi.seoul.go.kr"

if (-not (Test-Path -LiteralPath $PythonPath)) {
    throw "Python executable was not found: $PythonPath"
}

$RemoteAddresses = @(Resolve-DnsName $HostName -Type A -ErrorAction Stop |
    Where-Object { $_.IPAddress } |
    Select-Object -ExpandProperty IPAddress -Unique)
if ($RemoteAddresses.Count -eq 0) {
    throw "No IPv4 address was resolved for $HostName."
}

Get-NetFirewallRule -DisplayName $RuleName -ErrorAction SilentlyContinue |
    Remove-NetFirewallRule -ErrorAction Stop

New-NetFirewallRule `
    -DisplayName $RuleName `
    -Description "Allow the Geumcheon relay Python executable to call only the resolved Seoul OpenAPI endpoint on TCP 8088." `
    -Direction Outbound `
    -Action Allow `
    -Profile Public `
    -Program $PythonPath `
    -Protocol TCP `
    -RemoteAddress $RemoteAddresses `
    -RemotePort 8088 | Out-Null

$Rule = Get-NetFirewallRule -DisplayName $RuleName
$Application = $Rule | Get-NetFirewallApplicationFilter
$Address = $Rule | Get-NetFirewallAddressFilter
$Port = $Rule | Get-NetFirewallPortFilter

[pscustomobject]@{
    DisplayName = $Rule.DisplayName
    Enabled = $Rule.Enabled
    Action = $Rule.Action
    Profile = $Rule.Profile
    Program = $Application.Program
    RemoteAddress = @($Address.RemoteAddress) -join ","
    Protocol = $Port.Protocol
    RemotePort = $Port.RemotePort
}
