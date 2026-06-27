@echo off
chcp 65001 >nul
setlocal

cd /d "%~dp0"

echo.
echo [Geumcheon Platform] Starting backend and React dashboard...
echo Backend: http://localhost:8080
echo React dashboard: http://localhost:3100
echo.

start "Geumcheon Backend DB" powershell -ExecutionPolicy Bypass -NoProfile -NoExit -Command ". '%~dp0scripts\load-env.ps1'; & '%~dp0scripts\run-backend-db.ps1'"

timeout /t 4 /nobreak >nul

start "Geumcheon React Dashboard" cmd /k "cd /d ""%~dp0frontend-react-poc"" && npm.cmd run dev"

echo.
echo Two windows were opened.
echo - Backend DB mode
echo - React/Vite dashboard
echo.
echo Open http://localhost:3100 in your browser.
echo.
pause
