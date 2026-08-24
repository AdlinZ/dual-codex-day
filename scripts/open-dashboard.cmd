@echo off
where node >nul 2>nul
if not errorlevel 1 (
  powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy RemoteSigned -File "%~dp0codex-day-tray.ps1" -Open
  exit /b
)
title codex.day live refresh
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0watch-dashboard.ps1" -Open
if errorlevel 1 pause
