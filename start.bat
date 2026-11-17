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

echo Starting DevMemory backend server...
start /b node server.js

:: Wait for server to initialize
timeout /t 2 /nobreak >nul

:: Launch in Standalone Native App Window (no browser tabs, no address bar)
if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" (
    start "" "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" --app=http://localhost:5005 --user-data-dir="%LOCALAPPDATA%\DevMemory\profile" --window-size=1360,860
    exit /b
)
if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" (
    start "" "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" --app=http://localhost:5005 --user-data-dir="%LOCALAPPDATA%\DevMemory\profile" --window-size=1360,860
    exit /b
)
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
    start "" "%ProgramFiles%\Google\Chrome\Application\chrome.exe" --app=http://localhost:5005 --user-data-dir="%LOCALAPPDATA%\DevMemory\profile" --window-size=1360,860
    exit /b
)

:: Fallback if neither browser is found
start http://localhost:5005
