from fastapi import APIRouter

from backend.app.api.v1.analytics import router as analytics_router
from backend.app.api.v1.application_analysis import router as application_analysis_router
from backend.app.api.v1.ai_chat import router as ai_chat_router
from backend.app.api.v1.attendance import router as attendance_router
from backend.app.api.v1.auth import router as auth_router
from backend.app.api.v1.admin import router as admin_router
from backend.app.api.v1.drives import router as drives_router
from backend.app.api.v1.growth import router as growth_router
from backend.app.api.v1.interviews import router as interviews_router
from backend.app.api.v1.matching import router as matching_router
from backend.app.api.v1.messages import (
	admin_messages_router,
	recruiter_messages_router,
	router as messages_router,
)
from backend.app.api.v1.mock_interview import router as mock_interview_router
from backend.app.api.v1.notices import router as notices_router
from backend.app.api.v1.jobs import router as jobs_router
from backend.app.api.v1.recruiters import router as recruiters_router
from backend.app.api.v1.recruiter_portal import router as recruiter_portal_router
from backend.app.api.v1.recruiter_interviews import router as recruiter_interviews_router
from backend.app.api.v1.recruiter_offers import router as recruiter_offers_router
from backend.app.api.v1.recruiter_analytics import router as recruiter_analytics_router
from backend.app.api.v1.recruiter_profile import router as recruiter_profile_router
from backend.app.api.v1.recruiter_notices import router as recruiter_notices_router
from backend.app.api.v1.students import router as students_router
from backend.app.api.v1.coding_arenas import router as coding_router
from backend.app.api.v1.courses import router as courses_router
from backend.app.api.v1.community import router as community_router
from backend.app.api.v1.tests import router as tests_router

api_router = APIRouter(prefix="/api")
api_router.include_router(auth_router)
api_router.include_router(admin_router, prefix="/v1")
api_router.include_router(attendance_router, prefix="/attendance", tags=["attendance"])
api_router.include_router(students_router)
api_router.include_router(drives_router)
api_router.include_router(growth_router)
api_router.include_router(growth_router, prefix="/v1")
api_router.include_router(ai_chat_router, prefix="/v1")
api_router.include_router(interviews_router, prefix="/v1")
api_router.include_router(mock_interview_router, prefix="/v1")
api_router.include_router(matching_router)
api_router.include_router(notices_router, prefix="/v1")
api_router.include_router(jobs_router, prefix="/v1")
api_router.include_router(application_analysis_router, prefix="/v1")
api_router.include_router(recruiters_router)
api_router.include_router(recruiter_portal_router, prefix="/v1")
api_router.include_router(recruiter_interviews_router, prefix="/v1")
api_router.include_router(recruiter_offers_router, prefix="/v1")
api_router.include_router(recruiter_analytics_router, prefix="/v1")
api_router.include_router(recruiter_profile_router, prefix="/v1")
api_router.include_router(recruiter_notices_router, prefix="/v1")
api_router.include_router(analytics_router)
api_router.include_router(coding_router, prefix="/v1")
api_router.include_router(courses_router, prefix="/v1")
api_router.include_router(tests_router, prefix="/v1")
api_router.include_router(community_router, prefix="/v1")
api_router.include_router(messages_router, prefix="/v1")
api_router.include_router(recruiter_messages_router, prefix="/v1")
api_router.include_router(admin_messages_router, prefix="/v1")
