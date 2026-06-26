@echo off
setlocal

set "ROOT=%~dp0"
set "CMD=%ROOT%.venv\Scripts\paperscout.exe"

if not exist "%CMD%" (
  echo PaperScout is not installed yet. Run:
  echo powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\install.ps1
  exit /b 1
)

"%CMD%" %*
