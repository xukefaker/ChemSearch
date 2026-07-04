$ErrorActionPreference = "Stop"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $Root

Write-Host "PaperVerifier installer" -ForegroundColor Cyan

if (-not (Get-Command uv -ErrorAction SilentlyContinue)) {
  Write-Host "uv is required. Install it first:" -ForegroundColor Red
  Write-Host "winget install --id=astral-sh.uv -e"
  exit 1
}

uv python install 3.12
uv venv --python 3.12 --allow-existing .venv

$env:VIRTUAL_ENV = Join-Path $Root ".venv"
$env:PATH = (Join-Path $env:VIRTUAL_ENV "Scripts") + ";" + $env:PATH

uv pip install -e . --torch-backend=auto
& "$Root\paperverifier.cmd" init
& "$Root\paperverifier.cmd" doctor

Write-Host ""
Write-Host "Done. Edit .env, then run:" -ForegroundColor Green
Write-Host ".\paperverifier.cmd demo-acl --max-papers 20"
Write-Host ".\paperverifier.cmd index"
Write-Host ".\paperverifier.cmd web"
