@echo off
chcp 65001 >nul
echo [프론트엔드] http://localhost:3000 으로 시작합니다...
node "%~dp0frontend-static\serve-static.mjs"
pause
