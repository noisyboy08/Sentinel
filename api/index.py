"""Vercel serverless entry point — exposes the FastAPI app as an ASGI handler.

Vercel automatically discovers Python files under api/ and serves them as
serverless functions. This file adds backend/ to sys.path so that all the
'from app.X import Y' imports in backend/app/ resolve correctly.
"""
import sys
from pathlib import Path

# Add backend/ to sys.path — makes "from app.X import Y" work at runtime
sys.path.insert(0, str(Path(__file__).parent / "backend"))

from app.main import app  # noqa: E402  (import after sys.path mutation)
