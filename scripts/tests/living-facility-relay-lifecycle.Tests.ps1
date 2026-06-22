$ModulePath = Join-Path (Split-Path -Parent (Split-Path -Parent $PSScriptRoot)) "scripts\living-facility-relay-lifecycle.psm1"
Import-Module $ModulePath -Force

Describe "Living facility relay lifecycle" {
    InModuleScope living-facility-relay-lifecycle {
        It "creates a strong non-repeating runtime token" {
            $First = New-LivingFacilityRelayToken
            $Second = New-LivingFacilityRelayToken
            ($First.Length -ge 32) | Should Be $true
            $First | Should Not Be $Second
        }

        It "does not claim ownership when a managed relay is reused" {
            Mock Read-LivingFacilityRelayTokenFile { "x" * 40 }
            Mock Test-LivingFacilityRelayReady { $true }
            $Session = Get-OrStartLivingFacilityRelay -PythonPath "python.exe" -RelayRoot "." `
                -TokenPath "token" -LogDirectory "logs"
            $Session.OwnsProcess | Should Be $false
            $Session.Process | Should Be $null
        }

        It "rejects an occupied unmanaged port" {
            Mock Read-LivingFacilityRelayTokenFile { $null }
            Mock Test-LivingFacilityRelayTcpPort { $true }
            { Get-OrStartLivingFacilityRelay -PythonPath "python.exe" -RelayRoot "." `
                -TokenPath "token" -LogDirectory "logs" } | Should Throw "Port 127.0.0.1:18089 is occupied by an unmanaged or unauthenticated process."
        }
    }
}
