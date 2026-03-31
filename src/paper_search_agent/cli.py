from __future__ import annotations

import json
import logging
from pathlib import Path

import typer

from .acl_anthology import ACLAnthologyIngestor
from .config import CorpusSpec, Settings
from .indexer import IndexBuilder
from .offline import OfflineEnrichmentRunner, OfflineRunner, render_status, request_pause
from .search_current import rebuild_search_current
from .search import SearchEngine
from .storage import LocalStore
from .terminal_logging import configure_terminal_logging

configure_terminal_logging()

app = typer.Typer(no_args_is_help=True, add_completion=False)
PROJECT_ROOT = Path(__file__).resolve().parents[2]


def _components() -> tuple[Settings, LocalStore]:
    settings = Settings.from_env(root_dir=PROJECT_ROOT)
    store = LocalStore(settings)
    return settings, store


def _online_components() -> tuple[Settings, LocalStore]:
    settings = Settings.from_env(root_dir=PROJECT_ROOT)
    store = LocalStore(settings, root_dir=settings.search_current_dir)
    return settings, store


def _corpus_track(track: list[str] | None = None, *, explicit: str | None = None) -> str:
    if explicit is not None:
        return explicit
    normalized = [item.strip().lower() for item in (track or ["long"]) if item.strip()]
    if not normalized:
        return "long"
    if "all" in normalized or len(normalized) > 1:
        return "all"
    return normalized[0]


def _components_for_corpus(*, venue: str, year: int, track: str) -> tuple[Settings, LocalStore]:
    settings = Settings.from_env(root_dir=PROJECT_ROOT, corpus=CorpusSpec.from_values(venue, year, track))
    store = LocalStore(settings)
    return settings, store


def _parse_corpus_ref(value: str) -> CorpusSpec:
    parts = [part.strip() for part in value.split("/") if part.strip()]
    if len(parts) != 3:
        raise typer.BadParameter(f"Invalid corpus reference {value!r}. Expected format: venue/year/track")
    venue, year_text, track = parts
    try:
        year = int(year_text)
    except ValueError as exc:
        raise typer.BadParameter(f"Invalid corpus year in {value!r}: {year_text!r}") from exc
    return CorpusSpec.from_values(venue, year, track)


def _write_search_current_scope(selected_corpora: list[CorpusSpec]) -> None:
    settings = Settings.from_env(root_dir=PROJECT_ROOT)
    if len(selected_corpora) == 1:
        payload = selected_corpora[0].to_dict()
        settings.active_corpus_path.parent.mkdir(parents=True, exist_ok=True)
        settings.active_corpus_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        return
    settings.active_corpus_path.unlink(missing_ok=True)


@app.command("ingest-acl")
def ingest_acl(
    venue: str = typer.Option(..., "--venue"),
    year: int = typer.Option(..., "--year"),
    track: list[str] = typer.Option(["long"], "--track"),
    max_papers: int | None = typer.Option(None, "--max-papers"),
    download_pdfs: bool = typer.Option(True, "--download-pdfs/--no-download-pdfs"),
) -> None:
    settings, store = _components_for_corpus(venue=venue, year=year, track=_corpus_track(track))
    summary = ACLAnthologyIngestor(settings, store).ingest_event(
        venue=venue,
        year=year,
        tracks=track,
        max_papers=max_papers,
        download_pdfs=download_pdfs,
    )
    typer.echo(summary.model_dump_json(indent=2))


@app.command("build-index")
def build_index(
    max_papers: int | None = typer.Option(None, "--max-papers", min=1),
    paper_id_file: Path | None = typer.Option(
        None,
        "--paper-id-file",
        exists=True,
        file_okay=True,
        dir_okay=False,
        readable=True,
        resolve_path=True,
    ),
) -> None:
    settings, store = _components()
    builder = IndexBuilder(settings, store)
    paper_ids = builder.load_paper_ids(paper_id_file) if paper_id_file is not None else None
    summary = builder.build(max_papers=max_papers, paper_ids=paper_ids)
    typer.echo(summary.model_dump_json(indent=2))


@app.command("search")
def search(
    query: str = typer.Option(..., "--query"),
    top_k: int = typer.Option(10, "--top-k"),
) -> None:
    settings, store = _online_components()
    response = SearchEngine(settings, store).search(query, top_k=top_k)
    typer.echo(response.model_dump_json(indent=2))


@app.command("show-paper")
def show_paper(paper_id: str = typer.Argument(...)) -> None:
    _, store = _online_components()
    paper = store.get_paper(paper_id)
    if paper is None:
        raise typer.Exit(code=1)
    typer.echo(paper.model_dump_json(indent=2))


@app.command("inspect-trace")
def inspect_trace(trace_id: str = typer.Argument(...)) -> None:
    _, store = _online_components()
    trace = store.load_trace(trace_id)
    if trace is None:
        raise typer.Exit(code=1)
    typer.echo(trace.model_dump_json(indent=2))


@app.command("rebuild-search-current")
def rebuild_search_current_command(
    corpus: list[str] = typer.Option(
        [],
        "--corpus",
        help="Publish only the specified corpus set. Format: venue/year/track. Repeat --corpus to publish multiple corpora.",
    ),
) -> None:
    selected_corpora = [_parse_corpus_ref(item) for item in corpus]
    manifest = rebuild_search_current(PROJECT_ROOT, corpora=selected_corpora or None)
    if selected_corpora:
        _write_search_current_scope(selected_corpora)
    typer.echo(json.dumps(manifest, ensure_ascii=False, indent=2))


@app.command("offline-run")
def offline_run(
    venue: str = typer.Option("acl", "--venue"),
    year: int = typer.Option(2025, "--year"),
    track: str = typer.Option("long", "--track"),
    mode: str = typer.Option("resume", "--mode"),
) -> None:
    normalized_mode = mode.strip().lower()
    if normalized_mode not in {"resume", "rebuild"}:
        raise typer.BadParameter("--mode must be either 'resume' or 'rebuild'")
    settings = Settings.from_env(root_dir=PROJECT_ROOT, corpus=CorpusSpec.from_values(venue, year, track))
    result = OfflineRunner(settings).run(mode=normalized_mode)
    typer.echo(json.dumps(result.to_dict(), ensure_ascii=False, indent=2))


@app.command("offline-enrich")
def offline_enrich(
    venue: str = typer.Option("acl", "--venue"),
    year: int = typer.Option(2025, "--year"),
    track: str = typer.Option("long", "--track"),
    mode: str = typer.Option("resume", "--mode"),
) -> None:
    normalized_mode = mode.strip().lower()
    if normalized_mode not in {"resume", "rebuild"}:
        raise typer.BadParameter("--mode must be either 'resume' or 'rebuild'")
    settings = Settings.from_env(root_dir=PROJECT_ROOT, corpus=CorpusSpec.from_values(venue, year, track))
    result = OfflineEnrichmentRunner(settings).run(mode=normalized_mode)
    typer.echo(json.dumps(result.to_dict(), ensure_ascii=False, indent=2))


@app.command("offline-pause")
def offline_pause() -> None:
    settings = Settings.from_env(root_dir=PROJECT_ROOT)
    typer.echo(json.dumps(request_pause(settings), ensure_ascii=False, indent=2))


@app.command("offline-status")
def offline_status() -> None:
    settings = Settings.from_env(root_dir=PROJECT_ROOT)
    render_status(settings)
