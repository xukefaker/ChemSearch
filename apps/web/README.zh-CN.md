# PaperSearchAgent Web

[English](README.md) | 简体中文

这里是 PaperSearchAgent 的 Next.js 前端。通常从仓库根目录启动：

```bash
paper-search-agent web
```

只开发前端时：

```bash
npm install
PAPER_SEARCH_AGENT_API_BASE_URL=http://127.0.0.1:4001/api npm run dev -- --hostname 127.0.0.1 --port 4000
```

前端会通过 `PAPER_SEARCH_AGENT_API_BASE_URL` 把 API 请求代理到 FastAPI 后端。
