"""
Sentence-embedding similarity with a graceful degradation path.

`sentence-transformers` pulls in PyTorch (~2GB). That is a heavy dependency for
a feature that only nudges the score by 15%, so it lives in
`requirements-embeddings.txt` and this module reports honestly when it is
missing instead of crashing the service.
"""

from __future__ import annotations

import logging
import os
import threading
from dataclasses import dataclass
from typing import Optional

logger = logging.getLogger("applyai.ml.embeddings")

DEFAULT_MODEL = os.getenv("EMBEDDING_MODEL", "all-MiniLM-L6-v2")
MAX_CHARS = 12_000

_model = None
_model_lock = threading.Lock()
_load_error: Optional[str] = None


class EmbeddingUnavailable(RuntimeError):
    pass


def _load_model():
    """Load the model once, on first use, and remember failures."""
    global _model, _load_error
    if _model is not None:
        return _model
    with _model_lock:
        if _model is not None:
            return _model
        try:
            from sentence_transformers import SentenceTransformer  # type: ignore

            logger.info("loading embedding model %s (first call only)", DEFAULT_MODEL)
            _model = SentenceTransformer(DEFAULT_MODEL)
            _load_error = None
        except Exception as error:  # pragma: no cover - depends on the environment
            _load_error = str(error)
            logger.warning("sentence-transformers unavailable: %s", error)
            raise EmbeddingUnavailable(_load_error) from error
    return _model


@dataclass
class EmbedderStatus:
    available: bool
    model: Optional[str]
    note: Optional[str] = None


@dataclass
class SimilarityResult:
    score: Optional[float]
    model: Optional[str]
    available: bool
    note: Optional[str] = None


def embedder_status() -> EmbedderStatus:
    if _model is not None:
        return EmbedderStatus(available=True, model=DEFAULT_MODEL)
    try:
        _load_model()
        return EmbedderStatus(available=True, model=DEFAULT_MODEL)
    except EmbeddingUnavailable:
        return EmbedderStatus(
            available=False,
            model=None,
            note=(
                "sentence-transformers is not installed. Install it with "
                "`pip install -r requirements-embeddings.txt` to enable semantic matching. "
                "The API keeps working without it."
            ),
        )


def semantic_similarity(resume_text: str, jd_text: str) -> SimilarityResult:
    """Cosine similarity between the two documents' embeddings (raw, 0..1)."""
    if not resume_text.strip() or not jd_text.strip():
        return SimilarityResult(score=None, model=None, available=False, note="Empty input.")

    try:
        model = _load_model()
    except EmbeddingUnavailable:
        return SimilarityResult(
            score=None,
            model=None,
            available=False,
            note="Embedding model not installed; using lexical matching only.",
        )

    from sentence_transformers import util  # type: ignore

    embeddings = model.encode(
        [resume_text[:MAX_CHARS], jd_text[:MAX_CHARS]],
        convert_to_tensor=True,
        normalize_embeddings=True,
    )
    similarity = float(util.cos_sim(embeddings[0], embeddings[1]).item())
    # Cosine of normalised vectors is in [-1, 1]; clamp the negative tail.
    return SimilarityResult(score=max(0.0, min(1.0, similarity)), model=DEFAULT_MODEL, available=True)
