@echo off
setlocal

set "ROOT=%~dp0"
if defined CHEMSEARCH_VENV_PATH (
  set "VENV_PATH=%CHEMSEARCH_VENV_PATH%"
) else if exist "%ROOT%.chemsearch-venv" (
  set /p VENV_PATH=<"%ROOT%.chemsearch-venv"
) else (
  set "VENV_PATH=%ROOT%.venv"
)
set "CMD=%VENV_PATH%\Scripts\chemsearch.exe"
set "LOCAL_NODE=%ROOT%.local\node\current"

if exist "%LOCAL_NODE%\node.exe" (
  set "PATH=%LOCAL_NODE%;%PATH%"
)

if not exist "%CMD%" (
  echo ChemSearch is not installed yet. Run:
  echo powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\install.ps1
  exit /b 1
)

"%CMD%" %*
