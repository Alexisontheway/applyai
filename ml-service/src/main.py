import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from scraper import scrape_job_listings, scrape_career_page
from matcher import compute_match

app = FastAPI(title="ApplyAI ML Service")

_allowed_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:4000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in _allowed_origins],
    allow_methods=["POST", "GET"],
    allow_headers=["Content-Type"],
)


class ScrapeRequest(BaseModel):
    keywords: str
    location: str
    max_results: Optional[int] = 25


class ScrapeSingleRequest(BaseModel):
    url: str


class MatchRequest(BaseModel):
    resume_text: str
    jd_text: str


@app.get("/health")
async def health():
    return {"status": "ok", "service": "ml-service"}


@app.post("/scrape-job")
async def scrape_job(req: ScrapeRequest):
    """Scrape jobs from multiple sources (LinkedIn, Indeed, Naukri) based on keywords and location."""
    jobs = scrape_job_listings(req.keywords, req.location, req.max_results)
    return {"success": True, "data": jobs, "count": len(jobs)}


@app.post("/scrape-career-page")
async def scrape_career(req: ScrapeSingleRequest):
    """Scrape a single company career page for job listings."""
    job = scrape_career_page(req.url)
    if job:
        return {"success": True, "data": job}
    return {"success": False, "error": "No jobs found on this page"}


@app.post("/match")
async def match_resume_jd(req: MatchRequest):
    """Match a resume against a job description using sentence transformers."""
    score, explanation = compute_match(req.resume_text, req.jd_text)
    return {"match_score": score, "explanation": explanation}


@app.post("/extract-skills")
async def extract_skills(req: MatchRequest):
    """Extract skills from a job description text."""
    score, explanation = compute_match(req.resume_text, req.jd_text)
    return {"skills": [], "match_score": score, "explanation": explanation}


@app.post("/gap-analysis")
async def gap_analysis(req: MatchRequest):
    """Compare resume skills against JD requirements."""
    score, explanation = compute_match(req.resume_text, req.jd_text)
    return {"missing": [], "strong": [], "match_score": score, "explanation": explanation}


@app.post("/cover-letter")
async def cover_letter(req: MatchRequest):
    """Generate a tailored cover letter using local LLM (Ollama)."""
    score, explanation = compute_match(req.resume_text, req.jd_text)
    return {"cover_letter": "", "match_score": score, "explanation": "Phase 4 — Ollama integration pending"}