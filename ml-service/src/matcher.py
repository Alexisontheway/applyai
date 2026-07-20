"""
Resume-JD semantic matcher using Sentence Transformers.

Replaced TF-IDF (from Wanna Watch) with semantic embeddings for
better understanding of synonyms and context.

Usage:
    from matcher import compute_match
    score, explanation = compute_match(resume_text, jd_text)
"""

from sentence_transformers import SentenceTransformer, util

_model = None


def _get_model():
    global _model
    if _model is None:
        _model = SentenceTransformer("all-MiniLM-L6-v2")
    return _model


def compute_match(resume_text: str, jd_text: str) -> tuple[float, str]:
    """Compute semantic similarity between resume and job description.

    Args:
        resume_text: Full text extracted from resume PDF
        jd_text: Full job description text

    Returns:
        Tuple of (score 0-100, explanation string)
    """
    model = _get_model()
    emb_resume = model.encode(resume_text, convert_to_tensor=True)
    emb_jd = model.encode(jd_text, convert_to_tensor=True)
    similarity = util.cos_sim(emb_resume, emb_jd).item()
    score = round(similarity * 100, 2)
    return score, f"Semantic similarity: {score}%"
