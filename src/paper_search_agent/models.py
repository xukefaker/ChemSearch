from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

ChunkType = Literal["text_chunk", "table_chunk", "figure_chunk"]
ObjectType = Literal["text_block", "list_block", "table_block", "figure_block", "equation_block"]


class SectionNode(BaseModel):
    node_id: str
    heading: str
    level: int = 1
    page_start: int = 1
    page_end: int = 1
    char_start: int = 0
    char_end: int = 0
    children: list["SectionNode"] = Field(default_factory=list)


class PaperRecord(BaseModel):
    paper_id: str
    anthology_id: str | None = None
    title: str
    authors: list[str] = Field(default_factory=list)
    venue: str
    year: int
    track: str | None = None
    volume_id: str | None = None
    abstract: str = ""
    doi: str | None = None
    url: str
    pdf_url: str | None = None
    local_pdf_path: str | None = None
    source: str = "acl_anthology"
    parser_backend: str | None = None
    text: str = ""
    intro_summary: str = ""
    section_headings: list[str] = Field(default_factory=list)
    keywords: list[str] = Field(default_factory=list)
    sections: list[SectionNode] = Field(default_factory=list)
    section_ids: list[str] = Field(default_factory=list)
    object_ids: list[str] = Field(default_factory=list)
    chunk_ids: list[str] = Field(default_factory=list)
    typed_evidence_summary: dict[str, int] = Field(default_factory=dict)
    metadata: dict[str, Any] = Field(default_factory=dict)


class SectionRecord(BaseModel):
    section_id: str
    paper_id: str
    section_title: str
    section_path: list[str] = Field(default_factory=list)
    level: int = 1
    ordinal: int = 0
    page_start: int = 1
    page_end: int = 1
    text: str = ""
    text_summary: str = ""
    member_object_ids: list[str] = Field(default_factory=list)
    member_chunk_ids: list[str] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)


class ObjectRecord(BaseModel):
    object_id: str
    paper_id: str
    section_id: str
    object_type: ObjectType
    ordinal: int = 0
    page_idx: int = 1
    bbox: list[float] = Field(default_factory=list)
    section_path: list[str] = Field(default_factory=list)
    text: str = ""
    caption: str = ""
    footnote: str = ""
    html: str = ""
    image_path: str | None = None
    source_fields: list[str] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)


class ChunkRecord(BaseModel):
    chunk_id: str
    paper_id: str
    section_id: str
    chunk_type: ChunkType = "text_chunk"
    member_object_ids: list[str] = Field(default_factory=list)
    heading: str
    section_path: list[str] = Field(default_factory=list)
    page_start: int = 1
    page_end: int = 1
    page_span: list[int] = Field(default_factory=list)
    char_start: int = 0
    char_end: int = 0
    token_count: int = 0
    evidence_types: list[str] = Field(default_factory=list)
    evidence_scores: dict[str, float] = Field(default_factory=dict)
    text: str
    metadata: dict[str, Any] = Field(default_factory=dict)


class ParsedPaperBundle(BaseModel):
    paper: PaperRecord
    sections: list[SectionRecord] = Field(default_factory=list)
    objects: list[ObjectRecord] = Field(default_factory=list)
    chunks: list[ChunkRecord] = Field(default_factory=list)


class ScopeConstraints(BaseModel):
    venues: list[str] = Field(default_factory=list)
    years: list[int] = Field(default_factory=list)
    tracks: list[str] = Field(default_factory=list)


class QueryAspect(BaseModel):
    aspect_id: str
    query: str
    weight: float = 1.0


class VerifierRubric(BaseModel):
    must_satisfy: list[str] = Field(default_factory=list)
    should_satisfy: list[str] = Field(default_factory=list)
    rejection_rules: list[str] = Field(default_factory=list)


class EvidenceBucket(BaseModel):
    bucket_id: str
    description: str
    queries: list[str] = Field(default_factory=list)
    target_chunks: int = 1


class QueryPlan(BaseModel):
    mode: str = "api_llm"
    user_query: str
    global_query: str
    scope_constraints: ScopeConstraints = Field(default_factory=ScopeConstraints)
    entity_terms: list[str] = Field(default_factory=list)
    exact_phrases: list[str] = Field(default_factory=list)
    aspect_queries: list[QueryAspect] = Field(default_factory=list)
    verifier_rubric: VerifierRubric = Field(default_factory=VerifierRubric)
    evidence_buckets: list[EvidenceBucket] = Field(default_factory=list)


class RecallItem(BaseModel):
    item_id: str
    source: str
    score: float
    rank: int
    aspect_id: str | None = None


class EvidenceChunk(BaseModel):
    paper_id: str
    bucket_id: str
    chunk_id: str
    chunk_type: str | None = None
    score: float
    source_query: str
    heading: str
    section_path: list[str] = Field(default_factory=list)
    page_start: int = 1
    page_end: int = 1
    text: str


class StructuredSummary(BaseModel):
    methodology: str | None = None
    benchmarks: list[str] = Field(default_factory=list)
    key_findings: list[str] = Field(default_factory=list)


class EnrichedMetadata(BaseModel):
    citations: int | None = None
    code_url: str | None = None


class StructuredAuthor(BaseModel):
    name: str
    affiliation: str | None = None


class PaperReferenceEntry(BaseModel):
    ordinal: int
    raw_text: str
    year: int | None = None
    doi: str | None = None
    arxiv_id: str | None = None
    url: str | None = None


class PaperReferencesRecord(BaseModel):
    paper_id: str
    references: list[PaperReferenceEntry] = Field(default_factory=list)
    updated_at: str | None = None


class PaperEnrichmentRecord(BaseModel):
    paper_id: str
    affiliations: list[str] = Field(default_factory=list)
    authors_structured: list[StructuredAuthor] = Field(default_factory=list)
    reference_count: int = 0
    structured_summary: StructuredSummary | None = None
    enriched_metadata: EnrichedMetadata | None = None
    updated_at: str | None = None


class StructuredRationale(BaseModel):
    main_reason: str | None = None
    matching_points: list[str] = Field(default_factory=list)


class PaperResult(BaseModel):
    paper_id: str
    title: str
    score: float
    coarse_score: float
    verifier_score: float
    venue: str
    year: int
    track: str | None = None
    verdict: str
    entity_role: str | None = None
    satisfied_constraints: list[str] = Field(default_factory=list)
    missing_constraints: list[str] = Field(default_factory=list)
    confidence: float = 0.0
    rationale: str
    rationale_structured: StructuredRationale | None = None
    matched_sections: list[str] = Field(default_factory=list)
    matched_sections_summary: dict[str, int] = Field(default_factory=dict)
    evidence_chunks: dict[str, list[EvidenceChunk]] = Field(default_factory=dict)
    main_image_url: str | None = None
    abstract: str | None = None
    authors: list[str] = Field(default_factory=list)
    affiliations: list[str] = Field(default_factory=list)
    authors_structured: list[StructuredAuthor] = Field(default_factory=list)
    structured_summary: StructuredSummary | None = None
    enriched_metadata: EnrichedMetadata | None = None


class TokenUsage(BaseModel):
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0
    cost_estimate_usd: float | None = None


class SearchTrace(BaseModel):
    trace_id: str
    created_at: str
    mode: str
    user_query: str
    query_plan: QueryPlan
    paper_recall: list[RecallItem] = Field(default_factory=list)
    evidence_packs: dict[str, dict[str, list[EvidenceChunk]]] = Field(default_factory=dict)
    filter_summary: dict[str, Any] = Field(default_factory=dict)
    verifier_summary: dict[str, Any] = Field(default_factory=dict)
    final_results: dict[str, list[PaperResult]] = Field(default_factory=dict)
    timings_ms: dict[str, float] = Field(default_factory=dict)
    token_usage: TokenUsage = Field(default_factory=TokenUsage)


class ParseFailureRecord(BaseModel):
    paper_id: str
    venue: str
    year: int
    track: str | None = None
    parser_backend: str
    stage: str
    error_type: str
    error_message: str
    local_pdf_path: str | None = None
    analysis: str
    suggestion: str
    details: dict[str, Any] = Field(default_factory=dict)
    occurred_at: str


class IngestSummary(BaseModel):
    venue: str
    year: int
    tracks: list[str]
    fetched_papers: int
    saved_papers: int
    downloaded_pdfs: int
    skipped_existing_pdfs: int


class BuildIndexSummary(BaseModel):
    papers: int
    total_papers: int
    indexed_papers: int
    failed_papers: int
    sections: int = 0
    objects: int = 0
    chunks: int = 0
    text_chunks: int = 0
    table_chunks: int = 0
    figure_chunks: int = 0
    deep_chat_evidence_units: int = 0
    paper_vector_dim: int
    chunk_vector_dim: int
    paper_dense_backend: str
    chunk_dense_backend: str
    pdf_parser_backend: str
    parser_backend_counts: dict[str, int] = Field(default_factory=dict)
    parse_failure_counts: dict[str, int] = Field(default_factory=dict)
    built_at: str


class SearchResponse(BaseModel):
    trace_id: str
    mode: str
    satisfied: list[PaperResult] = Field(default_factory=list)
    partial: list[PaperResult] = Field(default_factory=list)
    rejected: list[PaperResult] = Field(default_factory=list)


SectionNode.model_rebuild()
