@echo off
chcp 65001 >nul
setlocal

cd /d "%~dp0frontend"

echo.
echo [Geumcheon Dashboard] Starting React/Vite frontend...
echo URL: http://localhost:3100
echo.
echo If this is your first run, execute: npm install
echo.

npm.cmd run dev

echo.
echo React/Vite server stopped.
pause
