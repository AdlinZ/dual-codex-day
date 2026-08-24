@echo off
title codex.day live refresh
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0watch-dashboard.ps1" -Open
if errorlevel 1 pause
