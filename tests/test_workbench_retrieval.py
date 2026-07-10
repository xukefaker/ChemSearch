from __future__ import annotations

import json
import time
from pathlib import Path

from chemsearch.workbench_retrieval import StandardRetrievalEngine
from chemsearch.workbench_runtime import WorkbenchRuntime


def _write_jsonl(path: Path, rows: list[dict[str, object]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("".join(json.dumps(row) + "\n" for row in rows), encoding="utf-8")


def _make_index(tmp_path: Path, monkeypatch) -> Path:
    data_dir = tmp_path / "data"
    monkeypatch.setenv("CHEMSEARCH_DATA_DIR", str(data_dir))
    normalized = data_dir / "search_current" / "normalized"
    normalized.mkdir(parents=True)
    (data_dir / "search_current" / "manifest.json").write_text(
        json.dumps({"build_id": "test-build", "built_at": "2026-07-10T00:00:00Z"}),
        encoding="utf-8",
    )
    _write_jsonl(
        normalized / "papers.jsonl",
        [
            {
                "paper_id": "paper-co2",
                "title": "Coupled carbon dioxide reduction and water oxidation",
                "authors": ["A. Chemist"],
                "venue": "Chemistry",
                "year": 2025,
                "abstract": "A catalyst couples CO2 reduction with water oxidation.",
                "keywords": ["CO2", "water oxidation"],
            },
            {
                "paper_id": "paper-battery",
                "title": "Lithium battery electrolyte stability",
                "authors": ["B. Chemist"],
                "venue": "Chemistry",
                "year": 2024,
                "abstract": "An electrolyte study for lithium batteries.",
                "keywords": ["battery"],
            },
            {
                "paper_id": "paper-polymer",
                "title": "Mechanical properties of polymer membranes",
                "authors": ["C. Chemist"],
                "venue": "Chemistry",
                "year": 2023,
                "abstract": "A study of polymer membrane mechanics.",
                "keywords": ["polymer"],
            },
        ],
    )
    _write_jsonl(
        normalized / "chunks.jsonl",
        [
            {
                "chunk_id": "co2-1",
                "paper_id": "paper-co2",
                "heading": "Photocatalysis",
                "page_start": 2,
                "text": "The donor acceptor framework drives carbon dioxide reduction and water oxidation.",
            },
            {
                "chunk_id": "battery-1",
                "paper_id": "paper-battery",
                "heading": "Electrolyte",
                "page_start": 3,
                "text": "The electrolyte remains stable during repeated lithium battery cycling.",
            },
            {
                "chunk_id": "polymer-1",
                "paper_id": "paper-polymer",
                "heading": "Mechanical testing",
                "page_start": 4,
                "text": "The polymer membrane was measured under tensile loading conditions.",
            },
        ],
    )
    _write_jsonl(normalized / "objects.jsonl", [])
    return tmp_path


def test_bm25_search_uses_indexed_paper_text(tmp_path: Path, monkeypatch) -> None:
    root = _make_index(tmp_path, monkeypatch)
    engine = StandardRetrievalEngine(root)

    results = engine.search("carbon dioxide reduction with water oxidation", "bm25_full_text")

    assert results[0]["paper_id"] == "paper-co2"
    assert results[0]["score"] > results[1]["score"]
    assert results[0]["retrieval_method"] == "bm25_full_text"


def test_hybrid_ranking_uses_rrf(tmp_path: Path, monkeypatch) -> None:
    root = _make_index(tmp_path, monkeypatch)
    engine = StandardRetrievalEngine(root)
    monkeypatch.setattr(
        engine,
        "_rank_bm25",
        lambda _query: [("paper-co2", 2.0, None), ("paper-battery", 1.0, None)],
    )
    monkeypatch.setattr(
        engine,
        "_rank_colbert",
        lambda _query, _callback: [("paper-battery", 3.0, "battery-1"), ("paper-co2", 1.0, "co2-1")],
    )

    ranking = engine._ranking("query", "hybrid_bm25_colbertv2", None)

    assert {paper_id for paper_id, _score, _passage in ranking} == {"paper-co2", "paper-battery"}
    assert all(score > 0 for _paper_id, score, _passage in ranking)


def test_workbench_search_job_runs_real_bm25(tmp_path: Path, monkeypatch) -> None:
    root = _make_index(tmp_path, monkeypatch)
    runtime = WorkbenchRuntime(root)
    try:
        status = runtime.start_search("carbon dioxide water oxidation", "bm25_full_text")
        deadline = time.monotonic() + 5
        while status["status"] in {"queued", "running"} and time.monotonic() < deadline:
            time.sleep(0.02)
            status = runtime.search_status(str(status["job_id"]))
        assert status["status"] == "completed"
        result = runtime.search_result(str(status["job_id"]))
        assert result["results"][0]["paper_id"] == "paper-co2"
    finally:
        runtime.close()


def test_upload_registers_pdf_without_a_second_staging_copy(tmp_path: Path, monkeypatch) -> None:
    data_dir = tmp_path / "data"
    monkeypatch.setenv("CHEMSEARCH_DATA_DIR", str(data_dir))
    runtime = WorkbenchRuntime(tmp_path)
    try:
        payload = runtime.upload_pdf("My chemistry paper.pdf", b"%PDF-1.7\nsmall test document")
        papers = runtime.library_papers()
        assert payload["status"] == "ready"
        assert papers[0]["status"] == "queued"
        assert Path(str(papers[0]["source_path"])).exists()
        assert not (data_dir / "workbench" / "uploads").exists()
    finally:
        runtime.close()


def test_production_routes_have_no_demo_ranking_fallback() -> None:
    root = Path(__file__).resolve().parents[1]
    production_sources = [
        root / "apps/web/src/lib/workbench-store.ts",
        root / "apps/web/src/app/api/search/jobs/[job_id]/result/route.ts",
    ]
    combined = "\n".join(path.read_text(encoding="utf-8") for path in production_sources)
    assert "demoRankedResults" not in combined
    assert "boostByMethod" not in combined
