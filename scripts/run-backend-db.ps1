$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$BackendRoot = Join-Path $ProjectRoot "backend-egovframe-skeleton"
$JarPath = Join-Path $BackendRoot "target\data-platform-0.1.0-SNAPSHOT.jar"

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

    & $MavenCmd -DskipTests package
    if ($LASTEXITCODE -ne 0) {
        throw "Maven package failed with exit code $LASTEXITCODE."
    }
}

$JavaExe = Resolve-JavaExe
$MvnCmd = Resolve-MavenCmd
$MissingTools = @()
if (-not $JavaExe) { $MissingTools += "Java 17" }
if (-not $MvnCmd) { $MissingTools += "Apache Maven 3.9+" }
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

Write-Output "backend_db_target=$($env:DB_HOST):$($env:DB_PORT)/$($env:DB_NAME) user=$($env:DB_USERNAME)"
Write-Output "backend_upload_base_path=$env:UPLOAD_BASE_PATH"

if (Test-JarIsStale -JarPath $JarPath -BackendRoot $BackendRoot) {
    Set-Location $BackendRoot
    Invoke-MavenPackage -MavenCmd $MvnCmd
}

Set-Location $BackendRoot
& $JavaExe -jar $JarPath `
    "--spring.security.user.name=$env:ADMIN_INITIAL_LOGIN_ID" `
    "--spring.security.user.password=$env:ADMIN_INITIAL_PASSWORD"
