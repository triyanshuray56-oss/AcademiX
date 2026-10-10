"""Async adapter for Jobicy's public remote-jobs feed."""

from __future__ import annotations

import re
import hashlib
from html import unescape
from typing import Any

import httpx

JOBICY_URL = "https://jobicy.com/api/v2/remote-jobs"


def _as_list(value: Any) -> list[str]:
	if isinstance(value, list):
		return [str(item).strip() for item in value if str(item).strip()]
	if isinstance(value, str) and value.strip():
		return [part.strip() for part in re.split(r"[,;|]", value) if part.strip()]
	return []


def _text(value: Any) -> str:
	return re.sub(r"\s+", " ", unescape(re.sub(r"<[^>]+>", " ", str(value or "")))).strip()


def _normalize_job(raw: dict[str, Any]) -> dict[str, Any] | None:
	job_id = raw.get("id") or raw.get("jobId")
	url = raw.get("url") or raw.get("jobUrl")
	title = raw.get("jobTitle") or raw.get("title")
	company = raw.get("companyName") or raw.get("company")
	if not url or not title or not company:
		return None
	job_type = _as_list(raw.get("jobType") or raw.get("job_type"))
	industries = _as_list(raw.get("jobIndustry") or raw.get("industry"))
	required_branches = _as_list(
		raw.get("requiredBranches") or raw.get("eligibleBranches") or raw.get("jobBranch")
	)
	geo = raw.get("jobGeo") or raw.get("geo") or raw.get("location") or "Remote"
	if isinstance(geo, list):
		geo = ", ".join(str(place) for place in geo)
	else:
		geo = str(geo)
	minimum = raw.get("annualSalaryMin") or raw.get("salaryMin")
	maximum = raw.get("annualSalaryMax") or raw.get("salaryMax")
	currency = raw.get("salaryCurrency") or raw.get("currency")
	application_deadline = (
		raw.get("applicationDeadline") or raw.get("application_deadline")
		or raw.get("jobDeadline") or raw.get("deadline") or raw.get("closingDate")
	)
	salary = None
	if minimum is not None or maximum is not None:
		salary = {"minimum": minimum, "maximum": maximum, "currency": currency, "period": "annual"}
	return {
		"id": f"jobicy-{job_id}" if job_id is not None else f"jobicy-{hashlib.sha256(str(url).encode()).hexdigest()[:16]}",
		"recruiter_jd_id": None,
		"title": _text(title),
		"company": _text(company),
		"description": _text(raw.get("jobDescription") or raw.get("jobExcerpt") or raw.get("description")),
		"logo": raw.get("companyLogo") or raw.get("logo"),
		"url": str(url),
		"tags": industries,
		"required_branches": required_branches,
		"job_type": job_type or ["Remote"],
		"location": geo,
		"geo_requirements": geo,
		"salary": salary,
		"annual_salary_min": minimum,
		"annual_salary_max": maximum,
		"salary_currency": currency,
		"published_at": raw.get("pubDate") or raw.get("publishedAt"),
		"application_deadline": application_deadline,
		"drive_date": None,
	}


async def fetch_jobicy_jobs(
	*,
	tag: str | None = None,
	industry: str | None = None,
	count: int = 20,
	timeout: float = 8.0,
) -> list[dict[str, Any]]:
	"""Fetch and normalize remote jobs; network and upstream errors return []."""
	params: dict[str, str | int] = {"count": max(1, min(count, 50))}
	if tag:
		params["tag"] = tag.strip()
	if industry:
		params["industry"] = industry.strip()
	try:
		async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
			response = await client.get(JOBICY_URL, params=params)
			response.raise_for_status()
		payload = response.json()
	except (httpx.TimeoutException, httpx.HTTPError, ValueError):
		return []

	items = payload.get("jobs", []) if isinstance(payload, dict) else []
	if not isinstance(items, list):
		return []
	return [normalized for raw in items if isinstance(raw, dict) if (normalized := _normalize_job(raw)) is not None]
