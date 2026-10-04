"""API-level tests for the ML service.

These exist because the service shipped with a logging bug that returned a 500
on every /parse-resume call: `extra={"filename": ...}` collides with the
reserved LogRecord attribute. Endpoint tests catch that class of failure.
"""

from __future__ import annotations

import io

import pytest
from fastapi.testclient import TestClient

from src.main import app

client = TestClient(app)


def _docx_bytes(paragraphs: list[str]) -> bytes:
    docx = pytest.importorskip("docx")
    document = docx.Document()
    for paragraph in paragraphs:
        document.add_paragraph(paragraph)
    buffer = io.BytesIO()
    document.save(buffer)
    return buffer.getvalue()


def test_health_reports_capabilities() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert payload["service"] == "ml-service"
    assert isinstance(payload["embeddings_available"], bool)
    # The service must always explain how to enable the optional model.
    assert payload["note"]


def test_match_degrades_without_embeddings() -> None:
    response = client.post(
        "/match",
        json={"resume_text": "React and TypeScript", "jd_text": "React engineer with TypeScript"},
    )
    assert response.status_code == 200
    payload = response.json()
    if payload["available"]:
        assert 0.0 <= payload["semantic_score"] <= 1.0
    else:
        assert payload["semantic_score"] is None
        assert payload["note"]


def test_match_rejects_empty_input() -> None:
    assert client.post("/match", json={"resume_text": "", "jd_text": "x"}).status_code == 422


def test_parse_txt_resume() -> None:
    text = "Priyanshu Pramanik\nSenior engineer\n" + "Skills: Go, Python, Kubernetes, PostgreSQL.\n" * 3
    response = client.post(
        "/parse-resume",
        files={"file": ("resume.txt", text.encode("utf-8"), "text/plain")},
    )
    assert response.status_code == 200, response.text
    payload = response.json()
    assert "Kubernetes" in payload["text"]
    assert payload["engine"] == "text"
    assert payload["word_count"] > 10


def test_parse_docx_resume() -> None:
    payload = _docx_bytes(
        [
            "Priyanshu Pramanik — Backend Engineer",
            "Summary: seven years building Go services on Kubernetes.",
            "Skills: Go, Python, PostgreSQL, Terraform, AWS.",
        ]
    )
    response = client.post(
        "/parse-resume",
        files={
            "file": (
                "resume.docx",
                payload,
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            )
        },
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["engine"] == "python-docx"
    assert "Backend Engineer" in body["text"]


def test_parse_rejects_too_short_documents() -> None:
    response = client.post("/parse-resume", files={"file": ("tiny.txt", b"hi there", "text/plain")})
    assert response.status_code == 422
    assert "readable text" in response.json()["detail"].lower()


def test_parse_rejects_binary_garbage() -> None:
    response = client.post(
        "/parse-resume",
        files={"file": ("image.bin", b"\x89PNG\r\n\x1a\n" + b"\x00" * 400, "application/octet-stream")},
    )
    assert response.status_code == 422
