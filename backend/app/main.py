from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.app.api.routes.assessment_proctor import router as assessment_proctor_router
from backend.app.api.v1.router import api_router
from backend.app.database import create_db_and_tables


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
	create_db_and_tables()
	yield


app = FastAPI(title="CampusLink", version="1.0.0", lifespan=lifespan)
app.add_middleware(
	CORSMiddleware,
	allow_origins=["*"],
	allow_credentials=False,
	allow_methods=["*"],
	allow_headers=["*"],
)
app.include_router(api_router)
app.include_router(assessment_proctor_router, prefix="/api/v1")


@app.get("/", tags=["health"])
def root_health_check() -> dict[str, str]:
	return {"status": "ok"}


@app.get("/health", tags=["health"])
def health_check() -> dict[str, str]:
	return {"status": "ok"}
