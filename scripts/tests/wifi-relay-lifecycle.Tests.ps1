$ModulePath = Join-Path (Split-Path -Parent (Split-Path -Parent $PSScriptRoot)) "scripts\wifi-relay-lifecycle.psm1"
Import-Module $ModulePath -Force

Describe "WiFi relay lifecycle" {
    InModuleScope wifi-relay-lifecycle {
        It "reuses an authenticated managed relay without starting a duplicate" {
            Mock Read-WifiRelayTokenFile { "existing-managed-token-with-at-least-32-characters" }
            Mock Test-WifiRelayReady { $true }
            Mock Test-WifiRelayTcpPort { $true }
            Mock Start-Process { throw "must not start" }

            $Session = Get-OrStartWifiRelay -PythonPath "python.exe" -RelayRoot "C:\relay" `
                -TokenPath "C:\runtime\token" -LogDirectory "C:\runtime\logs"

            $Session.OwnsProcess | Should Be $false
            $Session.Token | Should Be "existing-managed-token-with-at-least-32-characters"
            Assert-MockCalled Start-Process -Times 0
        }

        It "fails safely and cleans up when a new relay never becomes ready" {
            Mock Read-WifiRelayTokenFile { $null }
            Mock Test-WifiRelayTcpPort { $false }
            Mock New-WifiRelayToken { "new-managed-token-with-at-least-32-characters" }
            Mock Write-WifiRelayTokenFile {}
            Mock Test-Path { $true }
            $FakeProcess = [pscustomobject]@{ Id = 4242; HasExited = $false }
            Mock Start-Process { $FakeProcess }
            Mock Test-WifiRelayReady { $false }
            Mock Start-Sleep {}
            Mock Stop-Process {}
            Mock Remove-Item {}

            { Get-OrStartWifiRelay -PythonPath "python.exe" -RelayRoot "C:\relay" `
                    -TokenPath "C:\runtime\token" -LogDirectory "C:\runtime\logs" `
                    -ReadyTimeoutSeconds 0 } | Should Throw "WiFi relay did not become ready on 127.0.0.1:18088."

            Assert-MockCalled Stop-Process -Times 1 -ParameterFilter { $Id -eq 4242 }
            Assert-MockCalled Remove-Item -Times 1
        }

        It "stops and removes only a relay owned by the current backend session" {
            $FakeProcess = [pscustomobject]@{ Id = 5151; HasExited = $false }
            $FakeProcess | Add-Member -MemberType ScriptMethod -Name WaitForExit -Value { param($milliseconds) $true }
            $Session = [pscustomobject]@{
                OwnsProcess = $true
                Process = $FakeProcess
                TokenPath = "C:\runtime\token"
            }
            Mock Stop-Process {}
            Mock Remove-Item {}

            Stop-WifiRelaySession -Session $Session

            Assert-MockCalled Stop-Process -Times 1 -ParameterFilter { $Id -eq 5151 }
            Assert-MockCalled Remove-Item -Times 1 -ParameterFilter { $LiteralPath -eq "C:\runtime\token" }
        }

        It "releases the owned relay when Spring Boot startup fails" {
            $State = [pscustomobject]@{ Released = $false }
            $Acquire = { [pscustomobject]@{ OwnsProcess = $true } }
            $Run = { param($Session) throw "Spring Boot startup failed" }
            $Release = { param($Session) $State.Released = $Session.OwnsProcess }

            { Invoke-WithWifiRelaySession -Acquire $Acquire -RunBackend $Run -Release $Release } `
                | Should Throw "Spring Boot startup failed"
            $State.Released | Should Be $true
        }
    }
}
