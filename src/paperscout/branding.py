from __future__ import annotations

import os


DEFAULT_APP_NAME = "PaperVerifier"
DEFAULT_APP_TAGLINE = "Evidence-verified paper search"


def app_name() -> str:
    return (
        os.getenv("PAPERVERIFIER_APP_NAME")
        or os.getenv("PAPERSCOUT_APP_NAME")
        or DEFAULT_APP_NAME
    )


def app_tagline() -> str:
    return (
        os.getenv("PAPERVERIFIER_APP_TAGLINE")
        or os.getenv("PAPERSCOUT_APP_TAGLINE")
        or DEFAULT_APP_TAGLINE
    )
