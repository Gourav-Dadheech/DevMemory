@echo off
title DevMemory - Living Project Brain
echo ========================================================
echo   🧠 Launching DevMemory (100%% Free Local Project Brain)
echo ========================================================
cd /d "%~dp0\server"

:: Automatically free port 5005 if an old instance is running
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5005') do (
    taskkill /f /pid %%a >nul 2>&1
)

echo Starting server...
start http://localhost:5005/dashboard
node server.js
pause
