@echo off
title codex.day live refresh
where node >nul 2>nul
if not errorlevel 1 (
  node "%~dp0codex-day.mjs" --open
  if errorlevel 1 pause
  exit /b
)
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0watch-dashboard.ps1" -Open
if errorlevel 1 pause
