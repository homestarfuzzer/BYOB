@echo off
REM scripts/start.bat — BYOB startup for Windows
REM Requires: WSL2 + Docker Desktop

echo.
echo   BYOB: Break Your Own Boxes
echo   ──────────────────────────────────────
echo.

REM Check if WSL is available
where wsl >nul 2>&1
if %errorlevel% neq 0 (
  echo   ERROR: WSL2 is not installed.
  echo   Install it: https://aka.ms/wsl2
  echo.
  pause
  exit /b 1
)

REM Run the server inside WSL
wsl --cd "%~dp0.." bash -c "npm install --silent && node server.js"

pause
