# PaperVerifier Web

This is the Next.js frontend for PaperVerifier. It is normally started from the repository root:

```bash
uv run paperverifier web
```

For frontend-only development:

```bash
npm install
PAPERVERIFIER_API_BASE_URL=http://127.0.0.1:4001/api npm run dev -- --hostname 127.0.0.1 --port 4000
```

The frontend proxies API routes to the FastAPI backend through `PAPERVERIFIER_API_BASE_URL`.
