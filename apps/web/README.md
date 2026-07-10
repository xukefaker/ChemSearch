# ChemSearch Web

This is the Next.js frontend for ChemSearch. It is normally started from the repository root:

```bash
uv run chemsearch web
```

For frontend-only development:

```bash
npm install
CHEMSEARCH_API_BASE_URL=http://127.0.0.1:4001/api npm run dev -- --hostname 127.0.0.1 --port 4000
```

The frontend proxies API routes to the FastAPI backend through `CHEMSEARCH_API_BASE_URL`.
