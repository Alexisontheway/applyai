from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="ApplyAI ML Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "ml-service"}


@app.post("/match")
async def match_resume_jd():
    """Match a resume against a job description using sentence transformers."""
    return {"match_score": 0, "explanation": "Not implemented yet — Phase 4"}


@app.post("/extract-skills")
async def extract_skills():
    """Extract skills from a job description text."""
    return {"skills": [], "explanation": "Not implemented yet — Phase 4"}


@app.post("/gap-analysis")
async def gap_analysis():
    """Compare resume skills against JD requirements."""
    return {"missing": [], "strong": [], "explanation": "Not implemented yet — Phase 4"}


@app.post("/cover-letter")
async def cover_letter():
    """Generate a tailored cover letter using local LLM (Ollama)."""
    return {"cover_letter": "", "explanation": "Not implemented yet — Phase 4"}


@app.post("/scrape-job")
async def scrape_job():
    """Scrape a job posting from a URL using Playwright."""
    return {"title": "", "company": "", "description": "", "explanation": "Not implemented yet — Phase 3"}
