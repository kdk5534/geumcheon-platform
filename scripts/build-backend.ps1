$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$BackendRoot = Join-Path $ProjectRoot "backend-egovframe-skeleton"
$JavaHome = Join-Path $ProjectRoot ".tools\jdk-17"
$MavenBin = Join-Path $ProjectRoot ".tools\apache-maven-3.9.16\bin"

$env:JAVA_HOME = $JavaHome
$env:PATH = "$JavaHome\bin;$MavenBin;$env:PATH"

Set-Location $BackendRoot
$MavenCmd = Join-Path $MavenBin "mvn.cmd"
& $MavenCmd -DskipTests package
if ($LASTEXITCODE -ne 0) {
    throw "Maven build failed with exit code $LASTEXITCODE."
}
