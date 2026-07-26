"""
Job board scraper using Playwright.

Handles LinkedIn, Indeed, Naukri, and generic career pages.
"""

from playwright.sync_api import sync_playwright
from urllib.parse import quote_plus
import time

def _launch_browser(headless: bool = True):
    """Launch Playwright browser with stealth settings."""
    playwright = sync_playwright().start()
    browser = playwright.chromium.launch(
        headless=headless,
        args=[
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-blink-features=AutomationControlled",
        ],
    )
    return playwright, browser

def _close_browser(playwright):
    """Close Playwright browser and stop instance."""
    playwright.stop()

def scrape_linkedin_jobs(keywords: str, location: str, max_results: int = 25) -> list[dict]:
    """Scrape LinkedIn job listings for given keywords and location."""
    playwright, browser = _launch_browser(headless=True)
    jobs = []
    
    try:
        page = browser.new_page()
        search_url = f"https://www.linkedin.com/jobs/search/?keywords={quote_plus(keywords)}&location={quote_plus(location)}"
        page.goto(search_url, wait_until="domcontentloaded", timeout=30000)
        
        # Accept cookies if banner appears
        try:
            page.click("button.cookie-accept-button, button.artdeco-button--primary", timeout=5000)
        except:
            pass
        
        # Scroll to load more jobs
        last_height = 0
        for _ in range(5):
            page.evaluate("window.scrollBy(0, document.body.scrollHeight)")
            time.sleep(1)
            new_height = page.evaluate("document.body.scrollHeight")
            if new_height == last_height:
                break
            last_height = new_height
        
        # Extract job cards
        job_cards = page.query_selector_all(".job-card-container")
        for card in job_cards[:max_results]:
            try:
                title_elem = card.query_selector(".job-card-list__title")
                company_elem = card.query_selector(".job-card-container__company-name")
                location_elem = card.query_selector(".job-card-container__location")
                link_elem = card.query_selector("a")
                
                if title_elem and company_elem:
                    jobs.append({
                        "title": title_elem.inner_text().strip(),
                        "company": company_elem.inner_text().strip(),
                        "location": location_elem.inner_text().strip() if location_elem else location,
                        "url": f"https://www.linkedin.com{link_elem.get_attribute('href')}" if link_elem else "",
                        "source": "linkedin",
                    })
            except Exception:
                continue
        
        page.close()
    except Exception as e:
        print(f"LinkedIn scrape error: {e}")
    finally:
        _close_browser(playwright)
    
    return jobs


def scrape_indeed_jobs(keywords: str, location: str, max_results: int = 25) -> list[dict]:
    """Scrape Indeed job listings."""
    playwright, browser = _launch_browser(headless=True)
    jobs = []
    
    try:
        page = browser.new_page()
        search_url = f"https://www.indeed.com/jobs?q={quote_plus(keywords)}&l={quote_plus(location)}"
        page.goto(search_url, wait_until="domcontentloaded", timeout=30000)
        
        # Extract job cards
        job_cards = page.query_selector_all("div.job_seen_beacon")
        for card in job_cards[:max_results]:
            try:
                title_elem = card.query_selector("h2.jobTitle")
                company_elem = card.query_selector(".companyName")
                location_elem = card.query_selector(".companyLocation")
                link_elem = card.query_selector("h2 a")
                
                if title_elem and company_elem:
                    jobs.append({
                        "title": title_elem.inner_text().strip(),
                        "company": company_elem.inner_text().strip(),
                        "location": location_elem.inner_text().strip() if location_elem else location,
                        "url": f"https://www.indeed.com{link_elem.get_attribute('href')}" if link_elem else "",
                        "source": "indeed",
                    })
            except Exception:
                continue
        
        # Navigate to next pages if needed
        if len(jobs) < max_results:
            next_btn = page.query_selector("a[data-label='Next']")
            if next_btn:
                next_url = next_btn.get_attribute("href")
                if next_url:
                    page.goto(f"https://www.indeed.com{next_url}", wait_until="domcontentloaded", timeout=30000)
                    job_cards = page.query_selector_all("div.job_seen_beacon")[:max_results - len(jobs)]
                    for card in job_cards[:max_results - len(jobs)]:
                        try:
                            title_elem = card.query_selector("h2.jobTitle")
                            company_elem = card.query_selector(".companyName")
                            location_elem = card.query_selector(".companyLocation")
                            link_elem = card.query_selector("h2 a")
                            
                            if title_elem and company_elem:
                                jobs.append({
                                    "title": title_elem.inner_text().strip(),
                                    "company": company_elem.inner_text().strip(),
                                    "location": location_elem.inner_text().strip() if location_elem else location,
                                    "url": f"https://www.indeed.com{link_elem.get_attribute('href')}" if link_elem else "",
                                    "source": "indeed",
                                })
                        except Exception:
                            continue
        
        page.close()
    except Exception as e:
        print(f"Indeed scrape error: {e}")
    finally:
        _close_browser(playwright)
    
    return jobs


def scrape_naukri_jobs(keywords: str, location: str, max_results: int = 25) -> list[dict]:
    """Scrape Naukri job listings (India-focused)."""
    playwright, browser = _launch_browser(headless=True)
    jobs = []
    
    try:
        page = browser.new_page()
        search_url = f"https://www.naukri.com/jobs-in-{quote_plus(location)}?keyword={quote_plus(keywords)}"
        page.goto(search_url, wait_until="domcontentloaded", timeout=30000)
        
        job_cards = page.query_selector_all("div.sj_common")
        for card in job_cards[:max_results]:
            try:
                title_elem = card.query_selector("a.job-title")
                company_elem = card.query_selector("a.company-name")
                location_elem = card.query_selector("li.location")
                
                if title_elem and company_elem:
                    jobs.append({
                        "title": title_elem.inner_text().strip(),
                        "company": company_elem.inner_text().strip(),
                        "location": location_elem.inner_text().strip() if location_elem else location,
                        "url": title_elem.get_attribute("href") or "",
                        "source": "naukri",
                    })
            except Exception:
                continue
        
        page.close()
    except Exception as e:
        print(f"Naukri scrape error: {e}")
    finally:
        _close_browser(playwright)
    
    return jobs


def scrape_career_page(url: str) -> dict | None:
    """Scrape a company career page for job listings."""
    playwright, browser = _launch_browser(headless=True)
    job = None
    
    try:
        page = browser.new_page()
        page.goto(url, wait_until="domcontentloaded", timeout=30000)
        
        # Extract generic job listing elements
        title_selectors = ["h1", ".job-title", ".career-title", "[data-role='job-title']"]
        company_selectors = ["h2", ".company-name", ".organization", "[itemprop='name']"]
        description_selectors = [".job-description", "#description", "[data-role='job-desc']", "article"]
        
        title = company = location = description = ""
        
        for sel in title_selectors:
            el = page.query_selector(sel)
            if el:
                title = el.inner_text().strip()
                break
        
        for sel in company_selectors:
            el = page.query_selector(sel)
            if el:
                company = el.inner_text().strip()
                break
        
        desc_el = None
        for sel in description_selectors:
            desc_el = page.query_selector(sel)
            if desc_el:
                break
        
        if desc_el:
            description = desc_el.inner_text().strip()[:5000]  # Limit to 5000 chars
        
        job = {
            "title": title,
            "company": company,
            "location": location,
            "description": description,
            "url": url,
            "source": "scrape",
        }
        
        page.close()
    except Exception as e:
        print(f"Career page scrape error: {e}")
    finally:
        _close_browser(playwright)
    
    # Return None if we couldn't extract meaningful data
    if not title:
        return None
    return job


def scrape_job_listings(keywords: str, location: str, max_results: int = 25) -> list[dict]:
    """Aggregate jobs from all sources, deduped by URL."""
    all_jobs = []
    
    all_jobs.extend(scrape_linkedin_jobs(keywords, location, max_results))
    all_jobs.extend(scrape_indeed_jobs(keywords, location, max_results))
    all_jobs.extend(scrape_naukri_jobs(keywords, location, max_results))
    
    # Deduplicate by URL
    seen_urls = set()
    unique_jobs = []
    for job in all_jobs:
        if job["url"] and job["url"] not in seen_urls:
            seen_urls.add(job["url"])
            unique_jobs.append(job)
    
    return unique_jobs[:max_results]