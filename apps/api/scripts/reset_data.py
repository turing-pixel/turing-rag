#!/usr/bin/env python3
"""
Reset all RAG application data:

- PostgreSQL: truncate all application tables (including users)
- MinIO: remove all objects in the documents bucket
- Vector store: delete all collections (Chroma or Qdrant per VECTOR_STORE_TYPE)
- Local temp: /tmp/rag_uploads and /tmp/temp_* processing files

Usage:
  python scripts/reset_data.py --confirm
  python scripts/reset_data.py --dry-run
  python scripts/reset_data.py --confirm --skip-db
"""

from __future__ import annotations

import argparse
import glob
import logging
import os
import shutil
import sys
from pathlib import Path

from sqlalchemy import text

# Ensure apps/api is on sys.path when invoked as scripts/reset_data.py
_API_ROOT = Path(__file__).resolve().parents[1]
if str(_API_ROOT) not in sys.path:
    sys.path.insert(0, str(_API_ROOT))

from app.core.config import settings  # noqa: E402
from app.core.minio import get_minio_client  # noqa: E402
from app.db.session import engine  # noqa: E402
from app.models.api_key import APIKey  # noqa: E402, F401
from app.models.base import Base  # noqa: E402
from app.models.chat import Chat, Message, MessageSource, chat_knowledge_bases  # noqa: E402, F401
from app.models.embedding_config import EmbeddingConfig  # noqa: E402, F401
from app.models.knowledge import (  # noqa: E402, F401
    Document,
    DocumentChunk,
    DocumentUpload,
    KnowledgeBase,
    ProcessingTask,
)
from app.models.llm_config import LlmConfig  # noqa: E402, F401
from app.models.user import User  # noqa: E402, F401
from app.models.user_preference import UserPreference  # noqa: E402, F401
from app.services.vector_store.chroma_client import create_chroma_client  # noqa: E402

logger = logging.getLogger(__name__)

RAG_UPLOADS_DIR = Path("/tmp/rag_uploads")
TEMP_FILE_GLOB = "/tmp/temp_*"


def _table_names() -> list[str]:
    return sorted(Base.metadata.tables.keys())


def clear_database(*, dry_run: bool) -> int:
    tables = _table_names()
    if not tables:
        logger.info("Database: no tables registered in metadata")
        return 0
    quoted = ", ".join(f'"{name}"' for name in tables)
    sql = f"TRUNCATE TABLE {quoted} RESTART IDENTITY CASCADE"
    logger.info("Database: will truncate %d tables: %s", len(tables), ", ".join(tables))
    if dry_run:
        return len(tables)
    with engine.connect() as conn:
        conn.execute(text(sql))
        conn.commit()
    logger.info("Database: truncated %d tables", len(tables))
    return len(tables)


def clear_minio(*, dry_run: bool) -> int:
    client = get_minio_client()
    bucket = settings.MINIO_BUCKET_NAME
    if not client.bucket_exists(bucket):
        logger.info("MinIO: bucket %r does not exist, skipping", bucket)
        return 0
    objects = list(client.list_objects(bucket, recursive=True))
    names = [obj.object_name for obj in objects]
    logger.info("MinIO: bucket %r has %d object(s)", bucket, len(names))
    if dry_run:
        for name in names[:20]:
            logger.info("  - %s", name)
        if len(names) > 20:
            logger.info("  ... and %d more", len(names) - 20)
        return len(names)
    removed = 0
    for name in names:
        client.remove_object(bucket, name)
        removed += 1
    logger.info("MinIO: removed %d object(s) from %r", removed, bucket)
    return removed


def clear_chroma_vectors(*, dry_run: bool) -> list[str]:
    client = create_chroma_client()
    collections = client.list_collections()
    names = [col.name for col in collections]
    logger.info("Chroma (%s): %d collection(s)", settings.CHROMA_URL, len(names))
    if dry_run:
        for name in names:
            logger.info("  - %s", name)
        return names
    deleted: list[str] = []
    for name in names:
        client.delete_collection(name)
        deleted.append(name)
        logger.info("Chroma: deleted collection %r", name)
    return deleted


def clear_qdrant_vectors(*, dry_run: bool) -> list[str]:
    from qdrant_client import QdrantClient

    client = QdrantClient(
        url=settings.QDRANT_URL,
        prefer_grpc=settings.QDRANT_PREFER_GRPC,
    )
    response = client.get_collections()
    names = [col.name for col in response.collections]
    logger.info("Qdrant (%s): %d collection(s)", settings.QDRANT_URL, len(names))
    if dry_run:
        for name in names:
            logger.info("  - %s", name)
        return names
    deleted: list[str] = []
    for name in names:
        client.delete_collection(name)
        deleted.append(name)
        logger.info("Qdrant: deleted collection %r", name)
    return deleted


def clear_vectors(*, dry_run: bool) -> list[str]:
    store_type = settings.VECTOR_STORE_TYPE.lower().strip()
    if store_type == "chroma":
        return clear_chroma_vectors(dry_run=dry_run)
    if store_type == "qdrant":
        return clear_qdrant_vectors(dry_run=dry_run)
    raise ValueError(
        f"Unsupported VECTOR_STORE_TYPE={settings.VECTOR_STORE_TYPE!r}. "
        "Supported: chroma, qdrant"
    )


def clear_local_temp(*, dry_run: bool) -> int:
    removed = 0

    if RAG_UPLOADS_DIR.exists():
        entries = list(RAG_UPLOADS_DIR.iterdir())
        logger.info("Local: %s has %d item(s)", RAG_UPLOADS_DIR, len(entries))
        if dry_run:
            for path in entries[:20]:
                logger.info("  - %s", path)
        else:
            for path in entries:
                if path.is_dir():
                    shutil.rmtree(path, ignore_errors=True)
                else:
                    path.unlink(missing_ok=True)
                removed += 1
            logger.info("Local: cleared %d item(s) under %s", removed, RAG_UPLOADS_DIR)
    else:
        logger.info("Local: %s does not exist", RAG_UPLOADS_DIR)

    temp_files = glob.glob(TEMP_FILE_GLOB)
    logger.info("Local: %d temp file(s) matching %s", len(temp_files), TEMP_FILE_GLOB)
    if dry_run:
        for path in temp_files[:20]:
            logger.info("  - %s", path)
    else:
        for path in temp_files:
            try:
                os.remove(path)
                removed += 1
            except OSError as exc:
                logger.warning("Local: failed to remove %s: %s", path, exc)
        if temp_files:
            logger.info("Local: removed %d temp file(s)", len(temp_files))

    return removed


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Clear PostgreSQL, MinIO files, vector collections, and local upload temp.",
    )
    parser.add_argument(
        "--confirm",
        action="store_true",
        help="Required to perform destructive cleanup (ignored with --dry-run).",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print what would be deleted without making changes.",
    )
    parser.add_argument("--skip-db", action="store_true", help="Skip PostgreSQL truncate.")
    parser.add_argument("--skip-files", action="store_true", help="Skip MinIO object removal.")
    parser.add_argument("--skip-vectors", action="store_true", help="Skip vector store cleanup.")
    parser.add_argument("--skip-local", action="store_true", help="Skip /tmp upload cleanup.")
    return parser.parse_args()


def main() -> int:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(levelname)s - %(message)s",
    )
    args = parse_args()

    if not args.dry_run and not args.confirm:
        logger.error("Refusing to run without --confirm. Use --dry-run to preview.")
        return 1

    dry_run = args.dry_run
    if dry_run:
        logger.info("DRY RUN: no data will be modified")

    logger.info("Target database: %s", settings.get_database_url.split("@")[-1])
    logger.info("MinIO endpoint: %s, bucket: %s", settings.MINIO_ENDPOINT, settings.MINIO_BUCKET_NAME)
    logger.info("Vector store: %s", settings.VECTOR_STORE_TYPE)

    try:
        if not args.skip_db:
            clear_database(dry_run=dry_run)
        if not args.skip_files:
            clear_minio(dry_run=dry_run)
        if not args.skip_vectors:
            clear_vectors(dry_run=dry_run)
        if not args.skip_local:
            clear_local_temp(dry_run=dry_run)
    except Exception:
        logger.exception("Reset failed")
        return 1

    if dry_run:
        logger.info("Dry run complete. Re-run with --confirm to apply.")
    else:
        logger.info("Reset complete.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
