@echo off
chcp 65001 >nul
echo [백엔드] .env 로드 후 DB 모드로 시작합니다...
powershell -ExecutionPolicy Bypass -NoProfile -Command ". '%~dp0scripts\load-env.ps1'; & '%~dp0scripts\run-backend-db.ps1'"
pause
