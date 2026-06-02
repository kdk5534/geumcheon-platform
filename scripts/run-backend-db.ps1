$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$BackendRoot = Join-Path $ProjectRoot "backend-egovframe-skeleton"
$JavaHome = Join-Path $ProjectRoot ".tools\jdk-17"
$MavenBin = Join-Path $ProjectRoot ".tools\apache-maven-3.9.16\bin"
$JarPath = Join-Path $BackendRoot "target\data-platform-0.1.0-SNAPSHOT.jar"

$env:JAVA_HOME = $JavaHome
$env:PATH = "$JavaHome\bin;$MavenBin;$env:PATH"

if ([string]::IsNullOrWhiteSpace($env:DB_HOST)) { $env:DB_HOST = "localhost" }
if ([string]::IsNullOrWhiteSpace($env:DB_PORT)) { $env:DB_PORT = "5432" }
if ([string]::IsNullOrWhiteSpace($env:DB_NAME)) { $env:DB_NAME = "geumcheon_data" }
if ([string]::IsNullOrWhiteSpace($env:DB_USERNAME)) { $env:DB_USERNAME = "geumcheon" }
if ([string]::IsNullOrWhiteSpace($env:DB_PASSWORD)) { $env:DB_PASSWORD = "change-me" }
if ([string]::IsNullOrWhiteSpace($env:ADMIN_INITIAL_LOGIN_ID)) { $env:ADMIN_INITIAL_LOGIN_ID = "admin" }
if ([string]::IsNullOrWhiteSpace($env:ADMIN_INITIAL_PASSWORD)) { $env:ADMIN_INITIAL_PASSWORD = "admin1234" }
if ([string]::IsNullOrWhiteSpace($env:UPLOAD_BASE_PATH)) { $env:UPLOAD_BASE_PATH = Join-Path $ProjectRoot "uploads" }

if (-not (Test-Path -LiteralPath $JarPath)) {
    Set-Location $BackendRoot
    & (Join-Path $MavenBin "mvn.cmd") -DskipTests package
}

Set-Location $BackendRoot
& (Join-Path $JavaHome "bin\java.exe") -jar $JarPath `
    "--spring.security.user.name=$env:ADMIN_INITIAL_LOGIN_ID" `
    "--spring.security.user.password=$env:ADMIN_INITIAL_PASSWORD"
