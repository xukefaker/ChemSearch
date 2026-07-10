from __future__ import annotations

import hashlib
import json
import os
import re
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from threading import RLock
from uuid import uuid4

from .config import CorpusSpec, Settings
from .models import PaperRecord
from .storage import LocalStore
from .workbench_retrieval import RetrievalMethod, StandardRetrievalEngine


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _read_jsonl(path: Path) -> list[dict[str, object]]:
    if not path.exists():
        return []
    rows: list[dict[str, object]] = []
    with path.open("r", encoding="utf-8") as handle:
        for line in handle:
            if line.strip():
                rows.append(json.loads(line))
    return rows


def _clean_output(value: str) -> str:
    value = re.sub(r"\x1b\[[0-9;?]*[ -/]*[@-~]", "", value)
    return " ".join(value.split())[-1000:]


@dataclass(slots=True)
class WorkbenchJob:
    job_id: str
    kind: str
    file_name: str
    status: str
    progress: float
    message: str
    paper_id: str | None = None
    created_at: str = field(default_factory=_now_iso)
    updated_at: str = field(default_factory=_now_iso)


@dataclass(slots=True)
class SearchJob:
    job_id: str
    query: str
    retrieval_method: RetrievalMethod
    status: str = "queued"
    stage: str = "queued"
    message: str = "Queued for retrieval."
    progress: float = 0.0
    created_at: str = field(default_factory=_now_iso)
    updated_at: str = field(default_factory=_now_iso)
    error: str | None = None
    results: list[dict[str, object]] | None = None


class WorkbenchRuntime:
    def __init__(self, root_dir: Path) -> None:
        self.root_dir = root_dir.resolve()
        self.settings = Settings.from_env(root_dir=self.root_dir)
        self._lock = RLock()
        self._library_jobs: dict[str, WorkbenchJob] = {}
        self._search_jobs: dict[str, SearchJob] = {}
        self._index_executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="chemsearch-index")
        self._search_executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="chemsearch-retrieval")
        self._engine: StandardRetrievalEngine | None = None
        self._engine_build_id: str | None = None
        self._index_process: subprocess.Popen[str] | None = None

    def close(self) -> None:
        process = self._index_process
        if process is not None and process.poll() is None:
            process.terminate()
            try:
                process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                process.kill()
        self._index_executor.shutdown(wait=False, cancel_futures=True)
        self._search_executor.shutdown(wait=False, cancel_futures=True)

    def _manifest_build_id(self) -> str | None:
        path = Settings.from_env(root_dir=self.root_dir).search_current_manifest_path
        if not path.exists():
            return None
        try:
            return str(json.loads(path.read_text(encoding="utf-8")).get("build_id") or "unversioned")
        except (OSError, ValueError):
            return None

    def _retrieval_engine(self) -> StandardRetrievalEngine:
        build_id = self._manifest_build_id()
        if build_id is None:
            raise RuntimeError("No searchable index is available. Upload PDFs and run indexing first.")
        with self._lock:
            if self._engine is None or self._engine_build_id != build_id:
                self._engine = StandardRetrievalEngine(self.root_dir)
                self._engine_build_id = build_id
            return self._engine

    def _command_env(self) -> dict[str, str]:
        env = os.environ.copy()
        env["CHEMSEARCH_ROOT"] = str(self.root_dir)
        return env

    def upload_pdf(self, file_name: str, content: bytes) -> dict[str, object]:
        if not file_name.lower().endswith(".pdf"):
            raise ValueError("Only PDF files are supported.")
        if not content.startswith(b"%PDF"):
            raise ValueError("The uploaded file is not a valid PDF.")
        digest = hashlib.sha256(content).hexdigest()
        year = datetime.now(timezone.utc).year
        corpus = CorpusSpec.from_values("personal", year, "library")
        settings = Settings.from_env(root_dir=self.root_dir, corpus=corpus)
        store = LocalStore(settings)
        paper_id = f"personal-{digest[:16]}"
        destination = settings.pdf_dir / "personal" / f"{paper_id}.pdf"
        destination.parent.mkdir(parents=True, exist_ok=True)
        if not destination.exists():
            destination.write_bytes(content)
        title = re.sub(r"\s+", " ", re.sub(r"[_-]+", " ", Path(file_name).stem)).strip() or "Uploaded paper"
        existing = {paper.paper_id: paper for paper in store.load_raw_papers()}
        current = existing.get(paper_id)
        already_registered = current is not None
        metadata = {
            "original_name": Path(file_name).name,
            "content_hash": digest,
            "added_at": _now_iso(),
        }
        if current is not None:
            existing[paper_id] = current.model_copy(
                update={
                    "url": destination.absolute().as_uri(),
                    "pdf_url": destination.absolute().as_uri(),
                    "local_pdf_path": str(destination.absolute()),
                    "metadata": {**current.metadata, **metadata},
                }
            )
        else:
            existing[paper_id] = PaperRecord(
                paper_id=paper_id,
                title=title,
                authors=[],
                venue="personal",
                year=year,
                track="library",
                url=destination.absolute().as_uri(),
                pdf_url=destination.absolute().as_uri(),
                local_pdf_path=str(destination.absolute()),
                source="personal_pdf",
                metadata=metadata,
            )
        store.save_raw_papers(sorted(existing.values(), key=lambda item: item.paper_id))
        settings.active_corpus_path.parent.mkdir(parents=True, exist_ok=True)
        settings.active_corpus_path.write_text(json.dumps(corpus.to_dict(), indent=2), encoding="utf-8")
        job = WorkbenchJob(
            job_id=f"upload-{uuid4().hex[:12]}",
            kind="upload",
            file_name=Path(file_name).name,
            status="running",
            progress=20.0,
            message="Registering the uploaded PDF.",
        )
        with self._lock:
            self._library_jobs[job.job_id] = job
        with self._lock:
            job.status = "ready"
            job.progress = 100.0
            job.message = (
                "This PDF is already registered. Run indexing after adding new files."
                if already_registered
                else "Uploaded. Run indexing to make this PDF searchable."
            )
            job.paper_id = paper_id
            job.updated_at = _now_iso()
            return asdict(job)

    def start_index(self, *, retry_failed: bool = False, device: str | None = None) -> dict[str, object]:
        del retry_failed
        with self._lock:
            for existing in self._library_jobs.values():
                if existing.kind == "index" and existing.status in {"queued", "running"}:
                    return asdict(existing)
            job = WorkbenchJob(
                job_id=f"index-{uuid4().hex[:12]}",
                kind="index",
                file_name="Local PDF library",
                status="queued",
                progress=0.0,
                message="Queued for MinerU parsing and index construction.",
            )
            self._library_jobs[job.job_id] = job
        self._index_executor.submit(self._run_index, job.job_id, device)
        return asdict(job)

    def _run_index(self, job_id: str, device: str | None) -> None:
        with self._lock:
            job = self._library_jobs[job_id]
            job.status = "running"
            job.progress = 5.0
            job.message = "Running MinerU parsing and building the local index."
            job.updated_at = _now_iso()
        env = self._command_env()
        if device:
            env["CHEMSEARCH_DEVICE"] = device
        process = subprocess.Popen(
            [sys.executable, "-m", "chemsearch", "index"],
            cwd=self.root_dir,
            env=env,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
        self._index_process = process
        stdout, stderr = process.communicate()
        self._index_process = None
        with self._lock:
            job = self._library_jobs[job_id]
            if process.returncode == 0:
                job.status = "ready"
                job.progress = 100.0
                job.message = "Index completed. The uploaded papers are searchable."
                self._engine = None
                self._engine_build_id = None
            else:
                job.status = "failed"
                job.progress = 100.0
                job.message = _clean_output(stderr or stdout) or "Indexing failed. The previous index was preserved."
            job.updated_at = _now_iso()

    def library_jobs(self) -> list[dict[str, object]]:
        with self._lock:
            jobs = sorted(self._library_jobs.values(), key=lambda item: item.created_at, reverse=True)
            return [asdict(job) for job in jobs[:50]]

    def library_papers(self) -> list[dict[str, object]]:
        settings = Settings.from_env(root_dir=self.root_dir)
        normalized = settings.search_current_dir / "normalized"
        ready_rows = _read_jsonl(normalized / "papers.jsonl")
        objects = _read_jsonl(normalized / "objects.jsonl")
        stats: dict[str, dict[str, int]] = {}
        for row in objects:
            paper_id = str(row.get("paper_id") or "")
            current = stats.setdefault(paper_id, {"pages": 0, "figures": 0})
            try:
                current["pages"] = max(current["pages"], int(row.get("page_idx") or 1))
            except (TypeError, ValueError):
                pass
            if row.get("object_type") == "figure_block" and row.get("image_path"):
                current["figures"] += 1
        ready_ids = {str(row.get("paper_id") or "") for row in ready_rows}
        papers = [self._paper_payload(row, "ready", stats.get(str(row.get("paper_id") or ""), {})) for row in ready_rows]
        manifests_root = settings.data_dir / "manifests" / "personal"
        for path in sorted(manifests_root.glob("*/library/papers.jsonl")):
            for row in _read_jsonl(path):
                paper_id = str(row.get("paper_id") or "")
                if paper_id and paper_id not in ready_ids:
                    papers.append(self._paper_payload(row, "queued", {}))
        return papers

    @staticmethod
    def _paper_payload(row: dict[str, object], status: str, stats: dict[str, int]) -> dict[str, object]:
        metadata = row.get("metadata") if isinstance(row.get("metadata"), dict) else {}
        local_path = str(row.get("local_pdf_path") or "")
        return {
            "paper_id": str(row.get("paper_id") or ""),
            "title": str(row.get("title") or "Untitled paper"),
            "authors": list(row.get("authors") or []),
            "year": int(row.get("year") or 0),
            "venue": str(row.get("venue") or ""),
            "pages": int(stats.get("pages", 0)),
            "figures": int(stats.get("figures", 0)),
            "status": status,
            "tags": list(row.get("keywords") or [])[:8],
            "updated_at": str(metadata.get("added_at") or ""),
            "abstract": str(row.get("abstract") or ""),
            "preview_label": "",
            "file_name": Path(local_path).name if local_path else "",
            "source_path": local_path or None,
        }

    def start_search(self, query: str, method: RetrievalMethod) -> dict[str, object]:
        if not query.strip():
            raise ValueError("Query is required.")
        job = SearchJob(job_id=f"search-{uuid4().hex[:12]}", query=query.strip(), retrieval_method=method)
        with self._lock:
            self._search_jobs[job.job_id] = job
        self._search_executor.submit(self._run_search, job.job_id)
        return self.search_status(job.job_id)

    def _run_search(self, job_id: str) -> None:
        with self._lock:
            job = self._search_jobs[job_id]
            job.status = "running"
            job.stage = "loading_index"
            job.message = "Loading the indexed local paper library."
            job.progress = 5.0
            job.updated_at = _now_iso()

        def update(stage: str, message: str, progress: float) -> None:
            with self._lock:
                current = self._search_jobs[job_id]
                current.stage = stage
                current.message = message
                current.progress = progress
                current.updated_at = _now_iso()

        try:
            engine = self._retrieval_engine()
            results = engine.search(job.query, job.retrieval_method, top_k=20, progress_callback=update)
        except Exception as exc:
            with self._lock:
                job = self._search_jobs[job_id]
                job.status = "failed"
                job.stage = "failed"
                job.message = str(exc)
                job.error = repr(exc)
                job.progress = 100.0
                job.updated_at = _now_iso()
            return
        with self._lock:
            job = self._search_jobs[job_id]
            job.status = "completed"
            job.stage = "completed"
            job.message = "Search completed."
            job.progress = 100.0
            job.results = results
            job.updated_at = _now_iso()

    def search_status(self, job_id: str) -> dict[str, object]:
        with self._lock:
            job = self._search_jobs.get(job_id)
            if job is None:
                raise KeyError(job_id)
            return {
                "job_id": job.job_id,
                "status": job.status,
                "stage": job.stage,
                "message": job.message,
                "progress": job.progress,
                "created_at": job.created_at,
                "updated_at": job.updated_at,
                "error": job.error,
            }

    def search_result(self, job_id: str) -> dict[str, object]:
        with self._lock:
            job = self._search_jobs.get(job_id)
            if job is None:
                raise KeyError(job_id)
            if job.status == "failed":
                raise RuntimeError(job.message)
            if job.status != "completed" or job.results is None:
                raise LookupError("Search is still running.")
            return {
                "job_id": job.job_id,
                "query": job.query,
                "retrieval_method": job.retrieval_method,
                "results": job.results,
            }


__all__ = ["WorkbenchRuntime"]
