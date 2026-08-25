@echo off
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 22.5 or newer is required.
  pause
  exit /b 1
)
set "launcher=%~dp0..\dist\dual-codex-day.exe"
powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy RemoteSigned -File "%~dp0build-profiles-launcher.ps1"
if not errorlevel 1 (
  start "" "%launcher%"
  exit /b
)
powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy RemoteSigned -File "%~dp0codex-profiles-ui.ps1"
if errorlevel 1 pause
