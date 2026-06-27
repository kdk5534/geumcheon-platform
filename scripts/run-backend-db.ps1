$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$BackendRoot = Join-Path $ProjectRoot "backend-egovframe-skeleton"
$JarPath = Join-Path $BackendRoot "target\data-platform-0.1.0-SNAPSHOT.jar"
$RelayRoot = Join-Path $ProjectRoot "wifi-relay"
$RelayLifecycleModule = Join-Path $PSScriptRoot "wifi-relay-lifecycle.psm1"
Import-Module $RelayLifecycleModule -Force
$LivingRelayRoot = Join-Path $ProjectRoot "living-facility-relay"
$LivingRelayLifecycleModule = Join-Path $PSScriptRoot "living-facility-relay-lifecycle.psm1"
Import-Module $LivingRelayLifecycleModule -Force

$EnvFile = Join-Path $ProjectRoot ".env"
if (Test-Path -LiteralPath $EnvFile) {
    Get-Content -LiteralPath $EnvFile -Encoding UTF8 | ForEach-Object {
        if ($_ -match '^([^#][^=]+)=(.*)$') {
            $Name = $matches[1].Trim()
            $Value = $matches[2].Trim().Trim('"').Trim("'")
            if (-not [string]::IsNullOrWhiteSpace($Name)) {
                Set-Item -Path ("Env:" + $Name) -Value $Value
            }
        }
    }
}

function Test-JarIsStale {
    param(
        [string]$JarPath,
        [string]$BackendRoot
    )

    if (-not (Test-Path -LiteralPath $JarPath)) {
        return $true
    }

    $JarTime = (Get-Item -LiteralPath $JarPath).LastWriteTimeUtc
    $SourceItems = @()

    $PomPath = Join-Path $BackendRoot "pom.xml"
    if (Test-Path -LiteralPath $PomPath) {
        $SourceItems += Get-Item -LiteralPath $PomPath
    }

    $SrcPath = Join-Path $BackendRoot "src"
    if (Test-Path -LiteralPath $SrcPath) {
        $SourceItems += Get-ChildItem -LiteralPath $SrcPath -Recurse -File -ErrorAction SilentlyContinue
    }

    foreach ($Item in $SourceItems) {
        if ($Item.LastWriteTimeUtc -gt $JarTime) {
            return $true
        }
    }

    return $false
}

function Resolve-JavaExe {
    if (-not [string]::IsNullOrWhiteSpace($env:JAVA_HOME)) {
        $Candidate = Join-Path $env:JAVA_HOME "bin\java.exe"
        if (Test-Path -LiteralPath $Candidate) {
            return $Candidate
        }
    }

    $Command = Get-Command java.exe -ErrorAction SilentlyContinue
    if ($Command) {
        return $Command.Source
    }

    $CommonRoots = @(
        $env:ProgramFiles,
        ${env:ProgramFiles(x86)},
        (Join-Path $env:LOCALAPPDATA "Programs")
    ) | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }

    $JavaCandidates = @(
        "Java",
        "Eclipse Adoptium",
        "Microsoft",
        "Zulu",
        "Amazon Corretto",
        "JetBrains"
    )

    foreach ($Root in $CommonRoots) {
        foreach ($Folder in $JavaCandidates) {
            $Candidate = Join-Path $Root $Folder
            if (Test-Path -LiteralPath $Candidate) {
                $Hit = Get-ChildItem -Path $Candidate -Recurse -Filter java.exe -ErrorAction SilentlyContinue | Select-Object -First 1
                if ($Hit) {
                    return $Hit.FullName
                }
            }
        }
    }

    return $null
}

function Resolve-MavenCmd {
    if (-not [string]::IsNullOrWhiteSpace($env:MAVEN_HOME)) {
        $Candidate = Join-Path $env:MAVEN_HOME "bin\mvn.cmd"
        if (Test-Path -LiteralPath $Candidate) {
            return $Candidate
        }
    }

    $Command = Get-Command mvn.cmd -ErrorAction SilentlyContinue
    if ($Command) {
        return $Command.Source
    }

    $Command = Get-Command mvn -ErrorAction SilentlyContinue
    if ($Command) {
        return $Command.Source
    }

    $DownloadRoot = Join-Path $env:USERPROFILE "Downloads"
    if (Test-Path -LiteralPath $DownloadRoot) {
        $Hit = Get-ChildItem -Path $DownloadRoot -Recurse -Filter mvn.cmd -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($Hit) {
            return $Hit.FullName
        }
    }

    $CommonRoots = @(
        $env:ProgramFiles,
        ${env:ProgramFiles(x86)},
        (Join-Path $env:LOCALAPPDATA "Programs")
    ) | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }

    foreach ($Root in $CommonRoots) {
        $CandidateRoots = @(
            (Join-Path $Root "Apache"),
            (Join-Path $Root "Apache Maven"),
            (Join-Path $Root "Maven")
        )
        foreach ($CandidateRoot in $CandidateRoots) {
            if (Test-Path -LiteralPath $CandidateRoot) {
                $Hit = Get-ChildItem -Path $CandidateRoot -Recurse -Filter mvn.cmd -ErrorAction SilentlyContinue | Select-Object -First 1
                if ($Hit) {
                    return $Hit.FullName
                }
            }
        }
    }

    return $null
}

function Invoke-MavenPackage {
    param([string]$MavenCmd)

    & $MavenCmd -DskipTests clean package
    if ($LASTEXITCODE -ne 0) {
        throw "Maven package failed with exit code $LASTEXITCODE."
    }
}

function Resolve-PythonExe {
    $Candidates = @(
        (Join-Path $env:LOCALAPPDATA "Programs\Python\Python313\python.exe"),
        (Join-Path $env:LOCALAPPDATA "Programs\Python\Python312\python.exe"),
        (Join-Path $env:LOCALAPPDATA "Programs\Python\Python311\python.exe")
    )
    foreach ($Candidate in $Candidates) {
        if (Test-Path -LiteralPath $Candidate) { return $Candidate }
    }
    $Command = Get-Command python.exe -ErrorAction SilentlyContinue
    if ($Command -and $Command.Source -notlike "*WindowsApps*") { return $Command.Source }
    return $null
}

$JavaExe = Resolve-JavaExe
$MvnCmd = Resolve-MavenCmd
$PythonExe = Resolve-PythonExe
$MissingTools = @()
if (-not $JavaExe) { $MissingTools += "Java 17" }
if (-not $MvnCmd) { $MissingTools += "Apache Maven 3.9+" }
if (-not $PythonExe) { $MissingTools += "Python 3.11+" }
if ($MissingTools.Count -gt 0) {
    throw ("Missing required tools: {0}. Install them or set JAVA_HOME / MAVEN_HOME / PATH." -f ($MissingTools -join ", "))
}
$JavaHome = Split-Path (Split-Path $JavaExe -Parent) -Parent

$env:JAVA_HOME = $JavaHome
$env:PATH = "$JavaHome\bin;$($env:PATH)"

if ([string]::IsNullOrWhiteSpace($env:DB_HOST)) { $env:DB_HOST = "localhost" }
if ([string]::IsNullOrWhiteSpace($env:DB_PORT)) { $env:DB_PORT = "5432" }
if ([string]::IsNullOrWhiteSpace($env:DB_NAME)) { $env:DB_NAME = "geumcheon_data" }
if ([string]::IsNullOrWhiteSpace($env:DB_USERNAME)) { $env:DB_USERNAME = "geumcheon" }
if ([string]::IsNullOrWhiteSpace($env:DB_PASSWORD)) { $env:DB_PASSWORD = "change-me" }
if ([string]::IsNullOrWhiteSpace($env:ADMIN_INITIAL_LOGIN_ID)) { $env:ADMIN_INITIAL_LOGIN_ID = "admin" }
if ([string]::IsNullOrWhiteSpace($env:ADMIN_INITIAL_PASSWORD)) {
    throw "Set ADMIN_INITIAL_PASSWORD before starting DB mode. Default admin passwords are disabled."
}
if ($env:ADMIN_INITIAL_PASSWORD -eq "admin1234" -or $env:ADMIN_INITIAL_PASSWORD -eq "change-me") {
    throw "ADMIN_INITIAL_PASSWORD must be a real secret, not a default placeholder."
}
if ([string]::IsNullOrWhiteSpace($env:UPLOAD_BASE_PATH)) { $env:UPLOAD_BASE_PATH = Join-Path $ProjectRoot "uploads" }
$WifiRealtimeCollectionEnabled = $env:WIFI_REALTIME_COLLECTION_ENABLED -eq "true"
$LivingFacilityRelayEnabled = $env:LIVING_FACILITY_RELAY_ENABLED -eq "true"
if (($WifiRealtimeCollectionEnabled -or $LivingFacilityRelayEnabled) -and [string]::IsNullOrWhiteSpace($env:SEOUL_OPEN_API_KEY)) {
    throw "SEOUL_OPEN_API_KEY is required when a Seoul 8088 relay is enabled."
}
if (-not $WifiRealtimeCollectionEnabled) {
    $env:WIFI_RELAY_TOKEN = ""
    $env:WIFI_RELAY_SCHEDULE_ENABLED = "false"
}
if (-not $LivingFacilityRelayEnabled) {
    $env:LIVING_FACILITY_RELAY_TOKEN = ""
}
$env:WIFI_RELAY_HOST = "127.0.0.1"
$env:WIFI_RELAY_PORT = "18088"
$env:WIFI_RELAY_BASE_URL = "http://127.0.0.1:18088"
if ([string]::IsNullOrWhiteSpace($env:WIFI_RELAY_STATE_PATH)) {
    $env:WIFI_RELAY_STATE_PATH = Join-Path $ProjectRoot ".tmp\wifi-relay-state.json"
}
$env:LIVING_FACILITY_RELAY_HOST = "127.0.0.1"
$env:LIVING_FACILITY_RELAY_PORT = "18089"
$env:LIVING_FACILITY_RELAY_BASE_URL = "http://127.0.0.1:18089"
if ([string]::IsNullOrWhiteSpace($env:LIVING_FACILITY_RELAY_STATE_PATH)) {
    $env:LIVING_FACILITY_RELAY_STATE_PATH = Join-Path $ProjectRoot ".tmp\living-facility-relay-state.json"
}

Write-Output "backend_db_target=$($env:DB_HOST):$($env:DB_PORT)/$($env:DB_NAME) user=$($env:DB_USERNAME)"
Write-Output "backend_upload_base_path=$env:UPLOAD_BASE_PATH"

if (Test-JarIsStale -JarPath $JarPath -BackendRoot $BackendRoot) {
    Set-Location $BackendRoot
    Invoke-MavenPackage -MavenCmd $MvnCmd
}

$TokenPath = Join-Path $ProjectRoot ".tmp\wifi-relay-runtime.token"
$LivingTokenPath = Join-Path $ProjectRoot ".tmp\living-facility-relay-runtime.token"
$RelayLogDirectory = Join-Path $ProjectRoot ".tmp\logs"
$PreviousRelayToken = $env:WIFI_RELAY_TOKEN
$PreviousLivingRelayToken = $env:LIVING_FACILITY_RELAY_TOKEN

$AcquireRelay = {
    Get-OrStartWifiRelay -PythonPath $PythonExe -RelayRoot $RelayRoot `
        -TokenPath $TokenPath -LogDirectory $RelayLogDirectory -Port 18088
}
if ($WifiRealtimeCollectionEnabled) {
    Write-Output "wifi_realtime_collection=enabled"
    Write-Output "wifi_relay_bind=127.0.0.1:18088"
    Write-Output "wifi_relay_upstream=openapi.seoul.go.kr:8088/TbPublicWifiInfo_GC"
} else {
    Write-Output "wifi_realtime_collection=disabled snapshot_rows=1644"
}
if ($LivingFacilityRelayEnabled) {
    Write-Output "living_facility_relay=enabled"
    Write-Output "living_facility_relay_bind=127.0.0.1:18089"
    Write-Output "living_facility_relay_upstream=openapi.seoul.go.kr:8088/approved-allowlist(5)"
} else {
    Write-Output "living_facility_relay=disabled"
}

$WifiSession = $null
$LivingSession = $null
try {
    if ($WifiRealtimeCollectionEnabled) {
        $WifiSession = & $AcquireRelay
    }
    if ($LivingFacilityRelayEnabled) {
        $LivingSession = Get-OrStartLivingFacilityRelay -PythonPath $PythonExe -RelayRoot $LivingRelayRoot `
            -TokenPath $LivingTokenPath -LogDirectory $RelayLogDirectory -Port 18089
    }
    if ($WifiSession) {
        $env:WIFI_RELAY_TOKEN = $WifiSession.Token
    }
    if ($LivingSession) {
        $env:LIVING_FACILITY_RELAY_TOKEN = $LivingSession.Token
    }
    Set-Location $BackendRoot
    & $JavaExe -jar $JarPath
    if ($LASTEXITCODE -ne 0) { throw "Spring Boot exited with code $LASTEXITCODE." }
} finally {
    if ($LivingSession) { Stop-LivingFacilityRelaySession -Session $LivingSession }
    if ($WifiSession) { Stop-WifiRelaySession -Session $WifiSession }
    $env:WIFI_RELAY_TOKEN = $PreviousRelayToken
    $env:LIVING_FACILITY_RELAY_TOKEN = $PreviousLivingRelayToken
}
