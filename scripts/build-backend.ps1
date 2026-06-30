$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$BackendRoot = Join-Path $ProjectRoot "backend-egovframe-skeleton"
$JavaHome = Join-Path $ProjectRoot ".tools\jdk-17"
$MavenBin = Join-Path $ProjectRoot ".tools\apache-maven-3.9.16\bin"

if (Test-Path -LiteralPath (Join-Path $JavaHome "bin\java.exe")) {
    $env:JAVA_HOME = $JavaHome
    $env:PATH = "$JavaHome\bin;$env:PATH"
}

$BundledMaven = Join-Path $MavenBin "mvn.cmd"
if (Test-Path -LiteralPath $BundledMaven) {
    $MavenCmd = $BundledMaven
} else {
    $Maven = Get-Command mvn.cmd -ErrorAction SilentlyContinue
    if (-not $Maven) {
        $Maven = Get-Command mvn -ErrorAction SilentlyContinue
    }
    if (-not $Maven) {
        throw "Apache Maven was not found. Install Maven or add mvn to PATH."
    }
    $MavenCmd = $Maven.Source
}

Set-Location $BackendRoot
& $MavenCmd -DskipTests package
if ($LASTEXITCODE -ne 0) {
    throw "Maven build failed with exit code $LASTEXITCODE."
}
