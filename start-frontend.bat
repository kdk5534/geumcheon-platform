@echo off
chcp 65001 >nul
echo [프론트엔드] http://localhost:3100 으로 시작합니다...
cd /d "%~dp0frontend"
npm run dev
pause
