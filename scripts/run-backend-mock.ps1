$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$BackendRoot = Join-Path $ProjectRoot "backend-egovframe-skeleton"
$JavaHome = Join-Path $ProjectRoot ".tools\jdk-17"
$MavenBin = Join-Path $ProjectRoot ".tools\apache-maven-3.9.16\bin"
$JarPath = Join-Path $BackendRoot "target\data-platform-0.1.0-SNAPSHOT.jar"

$env:JAVA_HOME = $JavaHome
$env:PATH = "$JavaHome\bin;$MavenBin;$env:PATH"

if (-not (Test-Path -LiteralPath $JarPath)) {
    Set-Location $BackendRoot
    & (Join-Path $MavenBin "mvn.cmd") -DskipTests package
}

Set-Location $BackendRoot
& (Join-Path $JavaHome "bin\java.exe") -jar $JarPath --spring.profiles.active=mock
