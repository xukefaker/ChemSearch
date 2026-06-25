# PaperSearchAgent

English | [简体中文](README.zh-CN.md)

PaperSearchAgent is a local paper search workbench. Put PDFs into a folder, build an evidence-aware index, then ask questions from the web UI.

## Quick Start

Requirements:

- Python 3.11 or 3.12
- Node.js >= 20.9.0
- An OpenAI-compatible API key for question answering

```bash
git clone https://github.com/xukefaker/PaperSearchAgent.git
cd PaperSearchAgent

python -m venv .venv
source .venv/bin/activate
python -m pip install -U pip
python -m pip install -e .

paper-search-agent init
```

Edit `.env` and set at least:

```bash
OPENAI_API_KEY=sk-...
OPENAI_MODEL=your-model-name
```

Add your PDFs and build the local index:

```bash
paper-search-agent add-pdfs ./pdfs
paper-search-agent index
paper-search-agent web
```

Open `http://127.0.0.1:4000`.

`paper-search-agent web` starts the FastAPI backend on port `4001` and the Next.js frontend on port `4000`. It runs `npm install` inside `apps/web` the first time if `node_modules` is missing.

## Commands

- `paper-search-agent init`: create `.env` from `.env.example` and initialize local data folders.
- `paper-search-agent add-pdfs ./pdfs`: register PDFs under the personal library corpus.
- `paper-search-agent index`: run MinerU parsing, build dense/sparse indexes, and publish `data/search_current`.
- `paper-search-agent index --skip-parse`: reuse existing MinerU artifacts and rebuild indexes only.
- `paper-search-agent web`: start backend and frontend.
- `paper-search-agent search --query "..."`: run a CLI search against the current online index.

## Configuration

Runtime data is written to `data/` by default and is ignored by git. You can change it with:

```bash
PAPER_SEARCH_AGENT_DATA_DIR=/path/to/data
```

The default config uses CPU-compatible device settings. If you have a CUDA GPU, set these in `config.toml` or `.env`:

```toml
[mineru]
device = "cuda:0"

[indexing]
dense_device = "cuda:0"

[reranker]
device = "cuda:0"
```

## Repository Layout

- `src/paper_search_agent/`: Python package, indexing, retrieval, API, and CLI.
- `apps/web/`: Next.js web interface.
- `data/`: local runtime data, indexes, parsed PDF artifacts, and traces. This directory is gitignored.
- `research/`: archived benchmark scripts, reproduction notes, UoL/internal scripts, and research-only materials.

## Troubleshooting

- If `paper-search-agent index` finishes with `0 indexed papers`, check `data/parsed/mineru_failures.jsonl` and the PDF files.
- If the web UI starts but search fails, confirm `data/search_current/manifest.json` exists and `.env` contains a valid API key/model.
- If `npm` is missing, install Node.js >= 20.9.0 and rerun `paper-search-agent web`.
