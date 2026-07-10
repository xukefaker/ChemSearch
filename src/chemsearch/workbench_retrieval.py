from __future__ import annotations

import json
import math
import os
import re
import string
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path
from threading import RLock
from typing import Callable, Literal

import numpy as np
from rank_bm25 import BM25Okapi

from .config import Settings
from .devices import resolve_torch_device

RetrievalMethod = Literal[
    "bm25_full_text",
    "colbertv2",
    "spladepp",
    "hybrid_bm25_colbertv2",
    "hybrid_bm25_spladepp",
]
ProgressCallback = Callable[[str, str, float], None]

COLBERT_MODEL_ID = "colbert-ir/colbertv2.0"
SPLADE_MODEL_ID = "naver/splade-cocondenser-ensembledistil"
RRF_K = 60


@dataclass(frozen=True, slots=True)
class Passage:
    passage_id: str
    paper_id: str
    heading: str
    page_start: int
    text: str


def _read_jsonl(path: Path) -> list[dict[str, object]]:
    if not path.exists():
        return []
    rows: list[dict[str, object]] = []
    with path.open("r", encoding="utf-8") as handle:
        for line in handle:
            if not line.strip():
                continue
            rows.append(json.loads(line))
    return rows


def _tokens(value: str) -> list[str]:
    return re.findall(r"[a-z0-9]+", value.lower())


def _safe_int(value: object, default: int = 0) -> int:
    try:
        return int(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return default


class _HFColBERT:
    def __new__(cls, checkpoint: str, device: str):
        import torch
        from huggingface_hub import hf_hub_download
        from safetensors.torch import load_file
        from transformers import AutoTokenizer, BertConfig, BertModel

        class Model(torch.nn.Module):
            def __init__(self) -> None:
                super().__init__()
                config = BertConfig.from_pretrained(checkpoint)
                self.bert = BertModel(config)
                self.linear = torch.nn.Linear(config.hidden_size, 128, bias=False)

        model = Model()
        weights_path = hf_hub_download(checkpoint, "model.safetensors")
        state = load_file(weights_path, device="cpu")
        state.pop("bert.embeddings.position_ids", None)
        model.load_state_dict(state, strict=True)
        model.to(device).eval()
        tokenizer = AutoTokenizer.from_pretrained(checkpoint, use_fast=True)
        return model, tokenizer


class StandardRetrievalEngine:
    def __init__(self, root_dir: Path) -> None:
        self.root_dir = root_dir.resolve()
        self.settings = Settings.from_env(root_dir=self.root_dir)
        self.search_root = self.settings.search_current_dir
        manifest_path = self.search_root / "manifest.json"
        if not manifest_path.exists():
            raise RuntimeError("No searchable index is available. Run `chemsearch index` first.")
        self.manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        self.build_id = str(self.manifest.get("build_id") or "unversioned")
        self.cache_root = self.settings.data_dir / "retrieval_cache" / self.build_id
        self.cache_root.mkdir(parents=True, exist_ok=True)
        self.papers = _read_jsonl(self.search_root / "normalized" / "papers.jsonl")
        if not self.papers:
            raise RuntimeError("The searchable index contains no papers.")
        self.paper_by_id = {str(row["paper_id"]): row for row in self.papers}
        self.passages = self._load_passages()
        if not self.passages:
            raise RuntimeError("The searchable index contains no text passages.")
        self._lock = RLock()
        self._bm25: BM25Okapi | None = None
        self._splade_model = None
        self._splade_tokenizer = None
        self._splade_matrix = None
        self._colbert_model = None
        self._colbert_tokenizer = None
        self._colbert_docs = None
        self._colbert_mask = None
        self._objects = _read_jsonl(self.search_root / "normalized" / "objects.jsonl")
        self._paper_stats = self._build_paper_stats()

    def _load_passages(self) -> list[Passage]:
        rows = _read_jsonl(self.search_root / "normalized" / "chunks.jsonl")
        passages: list[Passage] = []
        for index, row in enumerate(rows):
            text = str(row.get("text") or "").strip()
            if len(text) < 20:
                continue
            paper_id = str(row.get("paper_id") or "")
            if paper_id not in self.paper_by_id:
                continue
            heading = str(row.get("heading") or "").strip()
            passage_id = str(row.get("chunk_id") or f"passage-{index}")
            passages.append(
                Passage(
                    passage_id=passage_id,
                    paper_id=paper_id,
                    heading=heading,
                    page_start=_safe_int(row.get("page_start"), 1),
                    text=f"{heading}\n{text}".strip(),
                )
            )
        return passages

    def _build_paper_stats(self) -> dict[str, dict[str, object]]:
        stats: dict[str, dict[str, object]] = defaultdict(lambda: {"pages": 0, "figures": 0, "preview": None})
        for row in self._objects:
            paper_id = str(row.get("paper_id") or "")
            if paper_id not in self.paper_by_id:
                continue
            page = _safe_int(row.get("page_idx"), 1)
            stats[paper_id]["pages"] = max(int(stats[paper_id]["pages"]), page)
            if row.get("object_type") == "figure_block" and row.get("image_path"):
                stats[paper_id]["figures"] = int(stats[paper_id]["figures"]) + 1
                if stats[paper_id]["preview"] is None:
                    stats[paper_id]["preview"] = Path(str(row["image_path"])).name
        return dict(stats)

    @staticmethod
    def _progress(callback: ProgressCallback | None, stage: str, message: str, progress: float) -> None:
        if callback is not None:
            callback(stage, message, progress)

    def _paper_texts(self) -> tuple[list[str], list[str]]:
        by_paper: dict[str, list[str]] = defaultdict(list)
        for passage in self.passages:
            by_paper[passage.paper_id].append(passage.text)
        ids = sorted(self.paper_by_id)
        texts = []
        for paper_id in ids:
            paper = self.paper_by_id[paper_id]
            full_text = str(paper.get("text") or "").strip()
            if not full_text:
                full_text = "\n".join(by_paper.get(paper_id, []))
            texts.append(
                "\n".join(
                    part
                    for part in [str(paper.get("title") or ""), str(paper.get("abstract") or ""), full_text]
                    if part
                )
            )
        return ids, texts

    def _rank_bm25(self, query: str) -> list[tuple[str, float, str | None]]:
        paper_ids, texts = self._paper_texts()
        with self._lock:
            if self._bm25 is None:
                self._bm25 = BM25Okapi([_tokens(text) for text in texts])
            scores = np.asarray(self._bm25.get_scores(_tokens(query)), dtype=np.float32)
        order = np.argsort(-scores, kind="stable")
        return [(paper_ids[index], float(scores[index]), None) for index in order]

    def _device(self) -> str:
        requested = os.environ.get("CHEMSEARCH_DEVICE") or self.settings.dense_device
        return resolve_torch_device(requested, purpose="standard retrieval")

    def _load_splade(self):
        if self._splade_model is not None:
            return self._splade_model, self._splade_tokenizer
        from transformers import AutoModelForMaskedLM, AutoTokenizer

        model_id = os.environ.get("CHEMSEARCH_SPLADE_MODEL", SPLADE_MODEL_ID)
        device = self._device()
        tokenizer = AutoTokenizer.from_pretrained(model_id, use_fast=True)
        model = AutoModelForMaskedLM.from_pretrained(model_id).to(device).eval()
        self._splade_model = model
        self._splade_tokenizer = tokenizer
        return model, tokenizer

    def _encode_splade(self, texts: list[str], *, max_length: int):
        import torch
        from scipy import sparse

        model, tokenizer = self._load_splade()
        device = self._device()
        batch_size = 8 if device.startswith("cuda") else 1
        matrices = []
        for start in range(0, len(texts), batch_size):
            batch = texts[start : start + batch_size]
            encoded = tokenizer(
                batch,
                padding=True,
                truncation=True,
                max_length=max_length,
                return_tensors="pt",
            )
            encoded = {key: value.to(device) for key, value in encoded.items()}
            with torch.inference_mode():
                logits = model(**encoded).logits
                weights = torch.log1p(torch.relu(logits)) * encoded["attention_mask"].unsqueeze(-1)
                reps = weights.amax(dim=1).float().cpu().numpy()
            matrices.append(sparse.csr_matrix(reps))
        return sparse.vstack(matrices, format="csr")

    def _ensure_splade_index(self, callback: ProgressCallback | None):
        from scipy import sparse

        cache_path = self.cache_root / "splade_passages.npz"
        meta_path = self.cache_root / "splade_passages.json"
        passage_ids = [passage.passage_id for passage in self.passages]
        model_id = os.environ.get("CHEMSEARCH_SPLADE_MODEL", SPLADE_MODEL_ID)
        if cache_path.exists() and meta_path.exists():
            meta = json.loads(meta_path.read_text(encoding="utf-8"))
            if meta.get("passage_ids") == passage_ids and meta.get("model_id") == model_id:
                self._splade_matrix = sparse.load_npz(cache_path)
                return self._splade_matrix
        self._progress(callback, "building_splade", "Encoding local passages with SPLADE++.", 25.0)
        matrix = self._encode_splade([passage.text for passage in self.passages], max_length=512)
        sparse.save_npz(cache_path, matrix)
        meta_path.write_text(
            json.dumps({"build_id": self.build_id, "model_id": model_id, "passage_ids": passage_ids}, indent=2),
            encoding="utf-8",
        )
        self._splade_matrix = matrix
        return matrix

    def _rank_splade(self, query: str, callback: ProgressCallback | None) -> list[tuple[str, float, str | None]]:
        matrix = self._ensure_splade_index(callback)
        query_rep = self._encode_splade([query], max_length=128)
        scores = np.asarray((matrix @ query_rep.T).toarray()).reshape(-1)
        return self._aggregate_passages(scores)

    def _load_colbert(self):
        if self._colbert_model is not None:
            return self._colbert_model, self._colbert_tokenizer
        model_id = os.environ.get("CHEMSEARCH_COLBERT_MODEL", COLBERT_MODEL_ID)
        model, tokenizer = _HFColBERT(model_id, self._device())
        self._colbert_model = model
        self._colbert_tokenizer = tokenizer
        return model, tokenizer

    @staticmethod
    def _insert_marker(values, marker_id: int):
        import torch

        marker = torch.full((values.size(0), 1), marker_id, dtype=values.dtype, device=values.device)
        return torch.cat((values[:, :1], marker, values[:, 1:]), dim=1)

    def _encode_colbert_documents(self, texts: list[str]):
        import torch

        model, tokenizer = self._load_colbert()
        device = self._device()
        marker_id = tokenizer.convert_tokens_to_ids("[unused1]")
        punctuation_ids = {
            token_id
            for symbol in string.punctuation
            for token_id in tokenizer.encode(symbol, add_special_tokens=False)[:1]
        }
        batch_size = 16 if device.startswith("cuda") else 1
        all_embeddings = []
        all_masks = []
        for start in range(0, len(texts), batch_size):
            batch = texts[start : start + batch_size]
            encoded = tokenizer(
                batch,
                padding="max_length",
                truncation=True,
                max_length=179,
                return_tensors="pt",
            )
            input_ids = self._insert_marker(encoded["input_ids"], marker_id).to(device)
            attention_mask = self._insert_marker(encoded["attention_mask"], 1).to(device)
            with torch.inference_mode():
                hidden = model.bert(input_ids, attention_mask=attention_mask).last_hidden_state
                embeddings = torch.nn.functional.normalize(model.linear(hidden), p=2, dim=2)
            valid = attention_mask.bool()
            for token_id in punctuation_ids:
                valid &= input_ids.ne(token_id)
            embeddings = embeddings * valid.unsqueeze(-1)
            all_embeddings.append(embeddings.half().cpu())
            all_masks.append(valid.cpu())
        return torch.cat(all_embeddings), torch.cat(all_masks)

    def _encode_colbert_query(self, query: str):
        import torch

        model, tokenizer = self._load_colbert()
        device = self._device()
        marker_id = tokenizer.convert_tokens_to_ids("[unused0]")
        encoded = tokenizer(
            [query],
            padding="max_length",
            truncation=True,
            max_length=31,
            return_tensors="pt",
        )
        input_ids = self._insert_marker(encoded["input_ids"], marker_id)
        attention_mask = self._insert_marker(encoded["attention_mask"], 1)
        input_ids[input_ids == tokenizer.pad_token_id] = tokenizer.mask_token_id
        with torch.inference_mode():
            hidden = model.bert(input_ids.to(device), attention_mask=attention_mask.to(device)).last_hidden_state
            return torch.nn.functional.normalize(model.linear(hidden), p=2, dim=2).squeeze(0)

    def _ensure_colbert_index(self, callback: ProgressCallback | None):
        import torch

        cache_path = self.cache_root / "colbert_passages.pt"
        meta_path = self.cache_root / "colbert_passages.json"
        passage_ids = [passage.passage_id for passage in self.passages]
        model_id = os.environ.get("CHEMSEARCH_COLBERT_MODEL", COLBERT_MODEL_ID)
        if cache_path.exists() and meta_path.exists():
            meta = json.loads(meta_path.read_text(encoding="utf-8"))
            if meta.get("passage_ids") == passage_ids and meta.get("model_id") == model_id:
                payload = torch.load(cache_path, map_location="cpu", weights_only=True)
                self._colbert_docs = payload["embeddings"]
                self._colbert_mask = payload["mask"]
                return self._colbert_docs, self._colbert_mask
        self._progress(callback, "building_colbert", "Encoding local passages with ColBERTv2.", 25.0)
        embeddings, mask = self._encode_colbert_documents([passage.text for passage in self.passages])
        torch.save({"embeddings": embeddings, "mask": mask}, cache_path)
        meta_path.write_text(
            json.dumps({"build_id": self.build_id, "model_id": model_id, "passage_ids": passage_ids}, indent=2),
            encoding="utf-8",
        )
        self._colbert_docs = embeddings
        self._colbert_mask = mask
        return embeddings, mask

    def _rank_colbert(self, query: str, callback: ProgressCallback | None) -> list[tuple[str, float, str | None]]:
        import torch

        documents, mask = self._ensure_colbert_index(callback)
        query_embedding = self._encode_colbert_query(query)
        device = self._device()
        scores: list[np.ndarray] = []
        batch_size = 128 if device.startswith("cuda") else 8
        for start in range(0, documents.size(0), batch_size):
            doc_batch = documents[start : start + batch_size].to(device)
            mask_batch = mask[start : start + batch_size].to(device)
            token_scores = doc_batch @ query_embedding.to(dtype=doc_batch.dtype).T
            token_scores = token_scores.masked_fill(~mask_batch.unsqueeze(-1), -9999)
            batch_scores = token_scores.amax(dim=1).sum(dim=1).float().cpu().numpy()
            scores.append(batch_scores)
        return self._aggregate_passages(np.concatenate(scores))

    def _aggregate_passages(self, scores: np.ndarray) -> list[tuple[str, float, str | None]]:
        paper_scores = {paper_id: -math.inf for paper_id in self.paper_by_id}
        best_passage: dict[str, Passage] = {}
        for passage, score_value in zip(self.passages, scores, strict=True):
            score = float(score_value)
            if score > paper_scores[passage.paper_id]:
                paper_scores[passage.paper_id] = score
                best_passage[passage.paper_id] = passage
        ranked = sorted(paper_scores.items(), key=lambda item: (-item[1], item[0]))
        return [
            (paper_id, score, best_passage.get(paper_id).passage_id if paper_id in best_passage else None)
            for paper_id, score in ranked
        ]

    @staticmethod
    def _rrf(*rankings: list[tuple[str, float, str | None]]) -> list[tuple[str, float, str | None]]:
        scores: dict[str, float] = defaultdict(float)
        best_passages: dict[str, str | None] = {}
        for ranking in rankings:
            for rank, (paper_id, _score, passage_id) in enumerate(ranking, 1):
                scores[paper_id] += 1.0 / (RRF_K + rank)
                if paper_id not in best_passages and passage_id is not None:
                    best_passages[paper_id] = passage_id
        return [
            (paper_id, score, best_passages.get(paper_id))
            for paper_id, score in sorted(scores.items(), key=lambda item: (-item[1], item[0]))
        ]

    def _ranking(self, query: str, method: RetrievalMethod, callback: ProgressCallback | None):
        if method == "bm25_full_text":
            return self._rank_bm25(query)
        if method == "colbertv2":
            return self._rank_colbert(query, callback)
        if method == "spladepp":
            return self._rank_splade(query, callback)
        if method == "hybrid_bm25_colbertv2":
            return self._rrf(self._rank_bm25(query), self._rank_colbert(query, callback))
        if method == "hybrid_bm25_spladepp":
            return self._rrf(self._rank_bm25(query), self._rank_splade(query, callback))
        raise ValueError(f"Unsupported retrieval method: {method}")

    def search(
        self,
        query: str,
        method: RetrievalMethod,
        *,
        top_k: int = 20,
        progress_callback: ProgressCallback | None = None,
    ) -> list[dict[str, object]]:
        self._progress(progress_callback, "loading_index", "Loading the indexed local paper library.", 10.0)
        ranking = self._ranking(query, method, progress_callback)
        self._progress(progress_callback, "ranking", "Aggregating passage scores into paper rankings.", 85.0)
        passage_by_id = {passage.passage_id: passage for passage in self.passages}
        query_terms = set(_tokens(query))
        results: list[dict[str, object]] = []
        for rank, (paper_id, score, passage_id) in enumerate(ranking[:top_k], 1):
            paper = self.paper_by_id[paper_id]
            stats = self._paper_stats.get(paper_id, {})
            searchable = f"{paper.get('title', '')} {paper.get('abstract', '')}".lower()
            matched_terms = sorted(term for term in query_terms if term in searchable)[:8]
            passage = passage_by_id.get(passage_id or "")
            preview = stats.get("preview")
            results.append(
                {
                    "paper_id": paper_id,
                    "title": str(paper.get("title") or paper_id),
                    "authors": list(paper.get("authors") or []),
                    "year": _safe_int(paper.get("year")),
                    "venue": str(paper.get("venue") or ""),
                    "pages": _safe_int(stats.get("pages")),
                    "figures": _safe_int(stats.get("figures")),
                    "status": "ready",
                    "tags": list(paper.get("keywords") or [])[:8],
                    "updated_at": str(self.manifest.get("built_at") or ""),
                    "abstract": str(paper.get("abstract") or ""),
                    "preview_label": "",
                    "rank": rank,
                    "score": score,
                    "retrieval_method": method,
                    "matched_terms": matched_terms,
                    "reason": (
                        f"Highest-scoring passage: {passage.heading or 'Paper text'} (page {passage.page_start})."
                        if passage is not None
                        else "Ranked from the full indexed paper text."
                    ),
                    "preview_image_url": (
                        f"/api/papers/{paper_id}/images/{preview}" if isinstance(preview, str) and preview else None
                    ),
                }
            )
        self._progress(progress_callback, "completed", "Search completed.", 100.0)
        return results


__all__ = ["RetrievalMethod", "StandardRetrievalEngine"]
