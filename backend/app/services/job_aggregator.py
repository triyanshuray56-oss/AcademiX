"""Combine Jobicy and configured Internshala/regional opportunities."""

from __future__ import annotations

import hashlib
import os
import re
import xml.etree.ElementTree as ET
from html import unescape
from typing import Any

import httpx

from backend.app.services.jobicy_service import fetch_jobicy_jobs


def _text(value: Any) -> str:
	if value is None:
		return ""
	return re.sub(r"\s+", " ", unescape(re.sub(r"<[^>]+>", " ", str(value)))).strip()


def _list(value: Any) -> list[str]:
	if isinstance(value, list):
		result = []
		for item in value:
			if isinstance(item, dict):
				item = item.get("name") or item.get("value") or item.get("label")
				if item is None:
					continue
			result.append(_text(item))
		return [item for item in result if item]
	if isinstance(value, str):
		return [part.strip() for part in re.split(r"[,;|]", value) if part.strip()]
	return []


def _salary_label(raw: dict[str, Any]) -> str | None:
	value = raw.get("stipend") or raw.get("salary") or raw.get("salaryRange") or raw.get("compensation")
	if isinstance(value, dict):
		minimum = value.get("minimum") or value.get("min") or value.get("from")
		maximum = value.get("maximum") or value.get("max") or value.get("to")
		currency = value.get("currency") or "INR"
		if minimum is not None and maximum is not None and str(minimum) != str(maximum):
			value = f"{minimum}-{maximum} {currency}"
		elif minimum is not None or maximum is not None:
			value = f"{minimum if minimum is not None else maximum} {currency}"
		else:
			value = value.get("label") or value.get("amount")
	if value is None:
		return None
	if isinstance(value, (int, float)):
		unit = raw.get("stipend_unit") or raw.get("salary_period") or "per month"
		return f"INR {value:g} {unit}"
	return _text(value) or None


def _kind(raw: dict[str, Any], title: str = "") -> str:
	kind = " ".join(_list(raw.get("job_type") or raw.get("jobType") or raw.get("type")))
	if "intern" in f"{kind} {title}".casefold():
		return "internship"
	return "job"


def _normalize_internshala(raw: dict[str, Any]) -> dict[str, Any] | None:
	title = _text(raw.get("title") or raw.get("job_title") or raw.get("jobTitle") or raw.get("profile"))
	company = _text(raw.get("company") or raw.get("company_name") or raw.get("companyName") or raw.get("employer"))
	url = raw.get("application_url") or raw.get("apply_url") or raw.get("url") or raw.get("link")
	if isinstance(url, dict):
		url = url.get("href") or url.get("url")
	if not title or not company or not isinstance(url, str) or not url.startswith(("https://", "http://")):
		return None
	identifier = raw.get("id") or raw.get("job_id") or raw.get("internship_id") or url
	kind = _kind(raw, title)
	location = raw.get("location") or raw.get("locations") or raw.get("place") or "India"
	if isinstance(location, list):
		location = ", ".join(_text(part.get("name") if isinstance(part, dict) else part) for part in location)
	else:
		location = _text(location)
	duration = raw.get("duration") or raw.get("duration_text") or raw.get("durationText")
	stipend = _salary_label(raw)
	tags = _list(raw.get("skills") or raw.get("skill_names") or raw.get("keywords") or raw.get("tags"))
	description = _text(raw.get("description") or raw.get("job_description") or raw.get("jobDescription") or raw.get("about"))
	if duration:
		description = f"{description} Duration: {_text(duration)}.".strip()
	return {
		"id": f"internshala-{hashlib.sha256(str(identifier).encode()).hexdigest()[:16]}",
		"title": title,
		"company": company,
		"location": location,
		"stipend_salary": stipend,
		"salary": stipend,
		"job_type": kind,
		"description": description,
		"application_url": url,
		"url": url,
		"tags": tags,
		"duration": _text(duration) if duration else None,
		"logo": raw.get("company_logo") or raw.get("companyLogo") or raw.get("logo"),
		"published_at": raw.get("published_at") or raw.get("posted_on") or raw.get("postedAt"),
		"source": "Internshala",
	}


def _normalize_rss(xml_content: bytes) -> list[dict[str, Any]]:
	try:
		root = ET.fromstring(xml_content)
	except ET.ParseError:
		return []
	items = []
	for element in root.findall(".//item"):
		row = {child.tag.split("}")[-1].casefold(): child.text or "" for child in element}
		normalized = _normalize_internshala({
			"title": row.get("title"), "company": row.get("company") or row.get("author"),
			"url": row.get("link"), "description": row.get("description"),
			"location": row.get("location"), "stipend": row.get("stipend") or row.get("salary"),
			"type": row.get("type") or row.get("category"), "skills": row.get("skills"),
			"duration": row.get("duration"), "published_at": row.get("pubdate"),
		})
		if normalized:
			items.append(normalized)
	return items


async def fetch_internshala_jobs(*, timeout: float = 8.0) -> list[dict[str, Any]]:
	"""Read an operator-configured Internshala-compatible JSON or RSS feed.

	Internshala does not expose a stable public jobs API. Configure
	CAMPUSLINK_INTERNSHALA_FEED_URL to a licensed/exported feed or regional
	connector endpoint; this adapter never scrapes the consumer site.
	"""
	feed_url = os.getenv("CAMPUSLINK_INTERNSHALA_FEED_URL", "").strip()
	if not feed_url or not feed_url.startswith(("https://", "http://")):
		return []
	try:
		async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
			response = await client.get(feed_url, headers={"Accept": "application/json, application/rss+xml, application/xml"})
			response.raise_for_status()
	except (httpx.TimeoutException, httpx.HTTPError):
		return []
	content_type = response.headers.get("content-type", "").casefold()
	if "json" not in content_type:
		return _normalize_rss(response.content)
	try:
		payload = response.json()
	except ValueError:
		return []
	if isinstance(payload, dict):
		rows = payload.get("jobs") or payload.get("internships") or payload.get("results") or payload.get("data") or []
	else:
		rows = payload
	if not isinstance(rows, list):
		return []
	return [job for item in rows if isinstance(item, dict) if (job := _normalize_internshala(item)) is not None]


def normalize_jobicy(raw: dict[str, Any]) -> dict[str, Any]:
	job_type = _kind(raw, raw.get("title", ""))
	salary = raw.get("salary")
	if isinstance(salary, dict):
		minimum, maximum = salary.get("minimum"), salary.get("maximum")
		currency = salary.get("currency") or "USD"
		if minimum is not None and maximum is not None and str(minimum) != str(maximum):
			pay = f"{minimum}-{maximum} {currency} / year"
		elif minimum is not None or maximum is not None:
			pay = f"{minimum if minimum is not None else maximum} {currency} / year"
		else:
			pay = None
	else:
		pay = None
	return {
		**raw,
		"job_type": job_type,
		"stipend_salary": pay,
		"application_url": raw.get("url"),
		"source": "Jobicy",
	}


async def aggregate_opportunities(*, count: int = 30, keyword: str | None = None) -> tuple[list[dict[str, Any]], dict[str, int]]:
	"""Fetch both independent sources concurrently; either can fail independently."""
	import asyncio

	jobicy_task = fetch_jobicy_jobs(count=count)
	internshala_task = fetch_internshala_jobs()
	jobicy_result, internshala_result = await asyncio.gather(jobicy_task, internshala_task, return_exceptions=True)
	jobicy_rows = [] if isinstance(jobicy_result, BaseException) else [normalize_jobicy(row) for row in jobicy_result]
	internshala_rows = [] if isinstance(internshala_result, BaseException) else internshala_result
	rows = jobicy_rows + internshala_rows
	if keyword:
		needle = keyword.casefold().strip()
		rows = [row for row in rows if needle in " ".join([str(row.get("title", "")), str(row.get("company", "")), str(row.get("location", "")), str(row.get("description", "")), *[str(tag) for tag in row.get("tags", [])]]).casefold()]
	rows.sort(key=lambda row: str(row.get("published_at") or ""), reverse=True)
	return rows, {"jobicy": len(jobicy_rows), "internshala": len(internshala_rows)}
