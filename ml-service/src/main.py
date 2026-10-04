"""
ApplyAI ML service — the optional Python half of the product.

Scope is deliberately narrow. Everything that can be done well in Node lives in
the API (matching engine, skill extraction, job discovery). This service does
the two things Node is bad at:

  1. Sentence embeddings  — semantic similarity that understands synonyms.
  2. Document parsing     — PDF / DOCX → clean text.

Both are optional. If torch is not installed, `/match` reports that embeddings
are unavailable and the API simply redistributes that signal's weight. If the
service is not running at all, the API still works end to end.
"""

from __future__ import annotations

import logging
import os
from typing import Optional

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from src.embeddings import embedder_status, semantic_similarity
from src.parsing import ParseError, parse_document

logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO").upper())
logger = logging.getLogger("applyai.ml")

app = FastAPI(
    title="ApplyAI ML service",
    version="0.2.0",
    description="Embeddings and document parsing for ApplyAI. Optional — the API degrades gracefully.",
)

allowed_origins = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "http://localhost:4000").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

MAX_UPLOAD_BYTES = int(os.getenv("MAX_UPLOAD_BYTES", str(8 * 1024 * 1024)))


class MatchRequest(BaseModel):
    resume_text: str = Field(min_length=1, max_length=60_000)
    jd_text: str = Field(min_length=1, max_length=60_000)


class MatchResponse(BaseModel):
    semantic_score: Optional[float]
    model: Optional[str]
    available: bool
    note: Optional[str] = None


@app.get("/health")
async def health() -> dict:
    status = embedder_status()
    return {
        "status": "ok",
        "service": "ml-service",
        "version": app.version,
        "model": status.model,
        "embeddings_available": status.available,
        "note": status.note,
        "endpoints": ["/match", "/parse-resume", "/health"],
    }


@app.post("/match", response_model=MatchResponse)
async def match(request: MatchRequest) -> MatchResponse:
    """Raw cosine similarity between resume and job description embeddings.

    The API owns the scoring blend and calibrates this number, so this endpoint
    returns the raw embedding similarity and nothing else.
    """
    result = semantic_similarity(request.resume_text, request.jd_text)
    return MatchResponse(
        semantic_score=result.score,
        model=result.model,
        available=result.available,
        note=result.note,
    )


@app.post("/parse-resume")
async def parse_resume(file: UploadFile = File(...)) -> dict:
    """Extract plain text from a PDF / DOCX / TXT resume."""
    payload = await file.read()
    if len(payload) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="File is larger than the 8MB limit.")

    try:
        parsed = parse_document(file.filename or "resume", payload)
    except ParseError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error

    if len(parsed.text.strip()) < 40:
        raise HTTPException(
            status_code=422,
            detail="No readable text found — the file may be a scanned image or an unsupported format.",
        )

    # NB: logging's LogRecord already owns `filename`, so extras are prefixed.
    logger.info(
        "parsed resume",
        extra={"upload_name": file.filename, "char_count": len(parsed.text), "engine": parsed.engine},
    )
    return {
        "text": parsed.text,
        "pages": parsed.pages,
        "engine": parsed.engine,
        "word_count": len(parsed.text.split()),
    }
