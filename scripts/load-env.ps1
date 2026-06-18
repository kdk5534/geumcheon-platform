# 저장소 루트의 .env 파일을 현재 PowerShell 세션 환경변수로 로드한다.
# 사용법: . .\scripts\load-env.ps1  (점(dot)-소스로 실행해야 현재 세션에 적용됨)

$EnvFile = Join-Path (Split-Path -Parent $PSScriptRoot) ".env"

if (-not (Test-Path -LiteralPath $EnvFile)) {
    Write-Warning "load-env: .env 파일이 없습니다 ($EnvFile). .env.example을 복사해 .env를 만드세요."
    return
}

$Loaded = 0
foreach ($Line in (Get-Content -LiteralPath $EnvFile -Encoding UTF8)) {
    # 빈 줄·주석 건너뜀
    if ([string]::IsNullOrWhiteSpace($Line) -or $Line.TrimStart().StartsWith("#")) {
        continue
    }

    $EqIndex = $Line.IndexOf("=")
    if ($EqIndex -le 0) {
        continue
    }

    $Key   = $Line.Substring(0, $EqIndex).Trim()
    $Value = $Line.Substring($EqIndex + 1).Trim()

    # 값을 감싼 따옴표 제거 ("value" 또는 'value')
    if (($Value.StartsWith('"') -and $Value.EndsWith('"')) -or
        ($Value.StartsWith("'") -and $Value.EndsWith("'"))) {
        $Value = $Value.Substring(1, $Value.Length - 2)
    }

    [System.Environment]::SetEnvironmentVariable($Key, $Value, "Process")
    $Loaded++
}

Write-Output "load-env: $Loaded 개 환경변수를 현재 세션에 로드했습니다. ($EnvFile)"
