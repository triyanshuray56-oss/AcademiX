"""Public contest and practice links for the student coding workspace."""

import asyncio
import json
import time
from urllib.error import URLError
from urllib.request import Request, urlopen

from fastapi import APIRouter, Depends

from backend.app.core.security import require_roles
from backend.app.models import User

router = APIRouter(prefix="/coding", tags=["Competitive Coding"])


def _fallback_contests() -> list[dict]:
	start = int(time.time()) + 24 * 60 * 60
	return [
		{"id": "fallback-codeforces-round", "name": "Codeforces — Upcoming Round", "platform": "Codeforces", "phase": "BEFORE", "start_time_seconds": start, "duration_seconds": 7200, "url": "https://codeforces.com/contests"},
		{"id": "fallback-atcoder-contest", "name": "AtCoder — Upcoming Contest", "platform": "AtCoder", "phase": "BEFORE", "start_time_seconds": start + 2 * 24 * 60 * 60, "duration_seconds": 6000, "url": "https://atcoder.jp/contests/"},
	]


def _fetch_codeforces_contests() -> list[dict]:
	request = Request("https://codeforces.com/api/contest.list?gym=false", headers={"User-Agent": "CampusLink/1.0"})
	with urlopen(request, timeout=5) as response:
		payload = json.loads(response.read().decode("utf-8"))
	if payload.get("status") != "OK":
		raise ValueError("Codeforces returned an unsuccessful response")
	contests = []
	for contest in payload.get("result", []):
		phase = contest.get("phase")
		if phase not in {"BEFORE", "CODING"}:
			continue
		contest_id = contest.get("id")
		contests.append({
			"id": contest_id,
			"name": contest.get("name", "Codeforces contest"),
			"platform": "Codeforces",
			"phase": phase,
			"start_time_seconds": contest.get("startTimeSeconds"),
			"duration_seconds": contest.get("durationSeconds", 0),
			"url": f"https://codeforces.com/contest/{contest_id}",
		})
	return contests


@router.get("/competitions")
async def get_competitions(_current_user: User = Depends(require_roles("student"))) -> dict:
	try:
		contests = await asyncio.to_thread(_fetch_codeforces_contests)
		return {"competitions": contests, "source": "Codeforces"}
	except (OSError, URLError, TimeoutError, ValueError, json.JSONDecodeError):
		return {"competitions": _fallback_contests(), "source": "fallback"}


@router.get("/practice")
def get_practice_arenas(_current_user: User = Depends(require_roles("student"))) -> dict:
	return {"arenas": [
		{"name": "LeetCode Problemset", "category": "Data Structures & Algorithms", "difficulty_range": "Easy to Hard", "description": "Interview focused problems, contests, and company question lists.", "url": "https://leetcode.com/problemset/", "target": "_blank"},
		{"name": "CodeChef Practice", "category": "Algorithms", "difficulty_range": "Beginner to Advanced", "description": "Practice problems organized by difficulty, topic, and rating.", "url": "https://www.codechef.com/practice", "target": "_blank"},
		{"name": "HackerRank Domains", "category": "Algorithms, Data Structures & SQL", "difficulty_range": "Easy to Hard", "description": "Guided tracks for core programming, databases, and interview skills.", "url": "https://www.hackerrank.com/domains", "target": "_blank"},
		{"name": "GeeksforGeeks Practice", "category": "Data Structures & Algorithms", "difficulty_range": "School to Expert", "description": "Topic based practice with structured problem sets and explanations.", "url": "https://www.geeksforgeeks.org/explore", "target": "_blank"},
		{"name": "System Design Primer", "category": "System Design", "difficulty_range": "Foundational to Advanced", "description": "Learn and practice system design concepts with curated resources.", "url": "https://github.com/donnemartin/system-design-primer", "target": "_blank"},
	]}
