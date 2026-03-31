from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request

from ..schemas import CreateSearchJobRequest, SearchJobResultResponse, SearchJobStatusResponse

router = APIRouter()


@router.post("/search/jobs", response_model=SearchJobStatusResponse)
def create_search_job(request: Request, payload: CreateSearchJobRequest) -> SearchJobStatusResponse:
    service_manager = request.app.state.service_manager
    query = payload.query.strip()
    if not query:
        raise HTTPException(status_code=400, detail="query must not be empty")
    with service_manager.acquire_services() as services:
        return services.jobs.submit(query=query, top_k=payload.top_k, display_k=payload.display_k)


@router.get("/search/jobs/{job_id}", response_model=SearchJobStatusResponse)
def get_search_job(request: Request, job_id: str) -> SearchJobStatusResponse:
    service_manager = request.app.state.service_manager
    with service_manager.acquire_job_services(job_id) as services:
        status = services.jobs.get_status(job_id)
    if status is None:
        raise HTTPException(status_code=404, detail="Search job not found")
    return status


@router.get("/search/jobs/{job_id}/result", response_model=SearchJobResultResponse)
def get_search_job_result(request: Request, job_id: str) -> SearchJobResultResponse:
    service_manager = request.app.state.service_manager
    with service_manager.acquire_job_services(job_id) as services:
        status = services.jobs.get_status(job_id)
        if status is None:
            raise HTTPException(status_code=404, detail="Search job not found")
        if status.status == "failed":
            raise HTTPException(status_code=409, detail=status.error or "Search job failed")
        if status.status != "completed":
            raise HTTPException(status_code=409, detail="Search job is not completed yet")
        result = services.jobs.get_result(job_id)
    if result is None:
        raise HTTPException(status_code=500, detail="Search result is missing")
    return result
