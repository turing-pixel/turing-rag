import asyncio
import logging

from app.api.api_v1.api import api_router
from app.api.openapi.api import router as openapi_router
from app.core.config import settings
from app.core.minio import init_minio
from app.startup.migarate import DatabaseMigrator
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
)

# CORS - allow frontend dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_allow_origins,
    allow_origin_regex=settings.cors_allow_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(api_router, prefix=settings.API_V1_STR)
app.include_router(openapi_router, prefix="/openapi")


_DEFAULT_SECRET_KEY = "your-secret-key-here"


@app.on_event("startup")
async def startup_event():
    if settings.SECRET_KEY == _DEFAULT_SECRET_KEY:
        logging.getLogger(__name__).warning(
            "SECRET_KEY is using the default placeholder; set a strong SECRET_KEY in production"
        )

    # Initialize MinIO
    init_minio()
    # Run database migrations
    migrator = DatabaseMigrator(settings.get_database_url)
    migrator.run_migrations()
    if settings.VECTOR_STORE_TYPE.lower().strip() == "chroma":
        from app.services.vector_store.chroma_client import warmup_chroma_client

        await asyncio.to_thread(warmup_chroma_client)

    from app.services.workflow_scheduler import start_workflow_scheduler

    start_workflow_scheduler()


@app.on_event("shutdown")
async def shutdown_event():
    from app.services.workflow_scheduler import stop_workflow_scheduler

    stop_workflow_scheduler()


@app.get("/")
def root():
    return {"message": "Welcome to RAG Web UI API"}


@app.get("/api/health")
async def health_check():
    payload: dict = {
        "status": "healthy",
        "version": settings.VERSION,
    }
    if settings.VECTOR_STORE_TYPE.lower().strip() == "chroma":
        chroma_status: dict = {"url": settings.CHROMA_URL}
        try:
            from app.services.vector_store.chroma_client import create_chroma_client

            client = await asyncio.to_thread(create_chroma_client)
            await asyncio.to_thread(client.heartbeat)
            chroma_status["status"] = "ok"
        except Exception as exc:
            payload["status"] = "degraded"
            chroma_status["status"] = "error"
            chroma_status["detail"] = str(exc)
        payload["chroma"] = chroma_status
    return payload
