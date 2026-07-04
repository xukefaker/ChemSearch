# PaperVerifier

![Python](https://img.shields.io/badge/python-3.11%20%7C%203.12-blue)
![uv](https://img.shields.io/badge/env-uv-4B32C3)
![Platforms](https://img.shields.io/badge/platform-macOS%20%7C%20Linux%20%7C%20Windows-lightgrey)

Local evidence-verified paper search for your PDF library.

Drop PDFs into a folder, build an evidence-aware local index, then ask questions from the web UI.

- Bring your own PDFs.
- Parse paper text, sections, figures, and tables.
- Search and ask with cited evidence.

## Quick Start

Requirements: `uv`, Node.js 20+, and an OpenAI-compatible API key.

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
git clone https://github.com/xukefaker/PaperVerifier.git
cd PaperVerifier
./scripts/install.sh
```

Edit `.env`:

```env
OPENAI_API_KEY=sk-...
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini
PAPERVERIFIER_DEVICE=auto
```

Try a small ACL demo:

```bash
./paperverifier demo-acl --max-papers 5
./paperverifier index
./paperverifier web
```

Open `http://127.0.0.1:4000`.

<details>
<summary>Windows PowerShell</summary>

Install `uv`, clone the repo, then run the installer:

```powershell
winget install --id=astral-sh.uv -e
git clone https://github.com/xukefaker/PaperVerifier.git
cd PaperVerifier
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\install.ps1
```

Edit `.env`:

```powershell
notepad .env
```

Run the demo:

```powershell
.\paperverifier.cmd demo-acl --max-papers 5
.\paperverifier.cmd index
.\paperverifier.cmd web
```

Open `http://127.0.0.1:4000`.

</details>

## Use Your PDFs

```bash
mkdir -p pdfs
# Put PDFs in ./pdfs

./paperverifier add-pdfs ./pdfs
./paperverifier index
./paperverifier web
```

During indexing, press `q` to cancel. PaperVerifier removes staged files from that run and keeps the previous working index.

MinerU PDF parsing is the slowest step. PaperVerifier shows real paper-level progress: the current PDF, page count, elapsed time, and completed paper count. If you press `q` while MinerU is inside one PDF, PaperVerifier finishes that PDF first, then stops and removes staged files from the run.

## Configuration

The installer creates `.venv/`, installs PaperVerifier with an automatically selected PyTorch backend, creates `.env`, and runs the doctor check.

The only required setting is:

```env
OPENAI_API_KEY=sk-...
```

Useful defaults:

```env
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini
PAPERVERIFIER_DATA_DIR=./data
PAPERVERIFIER_DEVICE=auto
PAPERVERIFIER_APP_NAME=PaperVerifier
```

`PAPERVERIFIER_DEVICE=auto` prefers CUDA or Apple MPS when PyTorch can use it. If no accelerator is available, PaperVerifier warns and continues on CPU.

## Troubleshooting

```bash
./paperverifier doctor
```

- `CUDA available=False`: your Python environment cannot use CUDA. CPU still works, but indexing is slower.
- `demo-acl` PDF download timeout: ACL Anthology is unreachable from your network. Retry later, use a VPN/proxy, or skip the demo and run `./paperverifier add-pdfs ./pdfs` with your own PDFs.
- PowerShell blocks scripts: use the installer command shown in the Windows section; its bypass applies only to that command.
- First `web` run is slow: frontend dependencies are installed under `apps/web/node_modules/`.
