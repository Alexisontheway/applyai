"""Parsing + embedding-fallback tests. Run with `pytest` from ml-service/."""

import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.parsing import ParseError, normalize_text, parse_document  # noqa: E402


def test_normalize_collapses_whitespace_and_bullets():
    raw = "SKILLS\n\n\n\n• Python   • SQL\r\n\r\nEngineer-\ning team\n"
    text = normalize_text(raw)
    assert "- Python - SQL" in text
    assert "Engineering team" in text
    assert "\n\n\n" not in text


def test_plain_text_is_accepted():
    payload = ("Priyanshu Pramanik\nEngineer\n" + "Experience with Python and SQL. " * 10).encode()
    parsed = parse_document("resume.txt", payload)
    assert parsed.engine == "text"
    assert "Python" in parsed.text


def test_unsupported_binary_is_rejected_with_a_helpful_message():
    with pytest.raises(ParseError) as error:
        parse_document("headshot.png", b"\x89PNG\r\n\x1a\n" + b"\x00" * 500)
    assert "PDF, DOCX or TXT" in str(error.value)


def test_malformed_pdf_is_rejected():
    with pytest.raises(ParseError):
        parse_document("broken.pdf", b"%PDF-1.4 not really a pdf")


def test_embedding_fallback_is_reported_not_raised():
    from src.embeddings import semantic_similarity

    result = semantic_similarity("python engineer", "we need python engineers")
    # Either sentence-transformers is installed (score present) or it is not
    # (score None + note). Both are valid; crashing is not.
    if result.available:
        assert result.score is not None and 0.0 <= result.score <= 1.0
    else:
        assert result.score is None
        assert result.note
