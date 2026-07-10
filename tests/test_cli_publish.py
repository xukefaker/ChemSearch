from __future__ import annotations

import json
from types import SimpleNamespace

from chemsearch.cli import _rewrite_published_image_paths


def test_rewrite_published_image_paths_moves_staged_paths_to_final_root(tmp_path) -> None:
    staged_root = tmp_path / "data" / ".runs" / "index-1" / "parsed" / "mineru"
    final_root = tmp_path / "data" / "parsed" / "mineru"
    normalized_dir = tmp_path / "data" / ".runs" / "index-1" / "release" / "current" / "normalized"
    image_path = staged_root / "paper-1" / "txt" / "images" / "figure.jpg"
    normalized_dir.mkdir(parents=True)
    objects_path = normalized_dir / "objects.jsonl"
    objects_path.write_text(
        json.dumps({"paper_id": "paper-1", "object_type": "figure_block", "image_path": str(image_path)}) + "\n",
        encoding="utf-8",
    )

    staged_settings = SimpleNamespace(normalized_dir=normalized_dir, mineru_output_dir=staged_root)
    final_settings = SimpleNamespace(mineru_output_dir=final_root)
    _rewrite_published_image_paths(staged_settings, final_settings)

    record = json.loads(objects_path.read_text(encoding="utf-8"))
    assert record["image_path"] == str(final_root / "paper-1" / "txt" / "images" / "figure.jpg")
