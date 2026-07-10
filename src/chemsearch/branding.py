from __future__ import annotations

import os


DEFAULT_APP_NAME = "ChemSearch"
DEFAULT_APP_TAGLINE = "Local chemistry paper search and question answering"


def app_name() -> str:
    return os.getenv("CHEMSEARCH_APP_NAME") or DEFAULT_APP_NAME


def app_tagline() -> str:
    return os.getenv("CHEMSEARCH_APP_TAGLINE") or DEFAULT_APP_TAGLINE
