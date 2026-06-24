@echo off
setlocal enabledelayedexpansion

echo =======================================
echo     MoviesAlert Startup Script
echo =======================================

:: 1. Find the current Local IP Address
echo.
echo [1/3] Detecting local network IP address...
set "ip="
for /f "usebackq tokens=*" %%a in (`powershell -NoProfile -Command "(Get-NetIPAddress -AddressFamily IPv4 -InterfaceAlias Wi-Fi -ErrorAction SilentlyContinue | Select-Object -First 1).IPAddress"`) do set "ip=%%a"

if "%ip%"=="" (
    for /f "usebackq tokens=*" %%a in (`powershell -NoProfile -Command "(Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notmatch 'Loopback|vEthernet|Virtual' } | Select-Object -First 1).IPAddress"`) do set "ip=%%a"
)

if "%ip%"=="" (
    echo Error: Could not detect Local IP address. Defaulting to 127.0.0.1
    set ip=127.0.0.1
) else (
    echo Detected IP: %ip%
)

:: 2. Update the .env file with the new IP so the frontend knows where to look
echo.
echo [2/3] Updating .env file...
if exist .env (
    findstr /v "VITE_DOWNLOADS_API_URL" .env > .env.temp
    echo VITE_DOWNLOADS_API_URL=http://%ip%:8000>> .env.temp
    move /y .env.temp .env > nul
) else (
    echo VITE_DOWNLOADS_API_URL=http://%ip%:8000> .env
)
echo .env updated successfully.

:: 3. Start the Backend API
echo.
echo [3/3] Starting Background Services...
echo Starting Backend API (Port 8000)...
start "MoviesAlert API" cmd /c "cd api && .\.venv\Scripts\uvicorn.exe main:app --host 0.0.0.0 --port 8000"

echo Starting Huey Task Queue Worker...
start "MoviesAlert Task Queue" cmd /c "cd api && .\.venv\Scripts\huey_consumer.exe tasks.huey"

:: 4. Start the Frontend App
echo Starting Frontend Web App (Port 8080)...
start "MoviesAlert Frontend" cmd /c "npm run dev -- --host 0.0.0.0"

echo.
echo =======================================
echo    Everything is starting up!
echo.
echo    Give it a few seconds, then open:
echo    http://%ip%:8080
echo =======================================
pause
