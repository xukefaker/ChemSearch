from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, File, HTTPException, Request, UploadFile
from pydantic import BaseModel

from ...workbench_retrieval import RetrievalMethod

router = APIRouter(prefix="/workbench")


class WorkbenchSearchRequest(BaseModel):
    query: str
    retrieval_method: RetrievalMethod = "bm25_full_text"
    qa_model: str | None = None
    corpus_scope: str | None = None


class WorkbenchIndexRequest(BaseModel):
    retry_failed: bool = False
    device: Literal["auto", "cpu", "cuda"] | None = None


def _runtime(request: Request):
    return request.app.state.workbench_runtime


@router.get("/library/papers")
def list_library_papers(request: Request):
    return {"papers": _runtime(request).library_papers()}


@router.get("/library/jobs")
def list_library_jobs(request: Request):
    return {"jobs": _runtime(request).library_jobs()}


@router.post("/library/upload")
async def upload_library_pdf(request: Request, file: UploadFile = File(...)):
    try:
        content = await file.read()
        job = _runtime(request).upload_pdf(file.filename or "paper.pdf", content)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    return {"job": job}


@router.post("/library/index")
def index_library(request: Request, payload: WorkbenchIndexRequest):
    try:
        job = _runtime(request).start_index(retry_failed=payload.retry_failed, device=payload.device)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    return {"job": job}


@router.post("/search/jobs")
def create_search_job(request: Request, payload: WorkbenchSearchRequest):
    try:
        return _runtime(request).start_search(payload.query, payload.retrieval_method)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/search/jobs/{job_id}")
def get_search_job(request: Request, job_id: str):
    try:
        return _runtime(request).search_status(job_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Search job not found.") from exc


@router.get("/search/jobs/{job_id}/result")
def get_search_result(request: Request, job_id: str):
    try:
        return _runtime(request).search_result(job_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Search job not found.") from exc
    except LookupError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


__all__ = ["router"]
