"""Vercel serverless entry point for the FastAPI backend.

Vercel's Python runtime auto-detects ASGI apps named ``app`` in files under
``api/``. We reuse the router from ``frontend/server/app/routes.py`` and mount
it under ``/api`` so requests hitting ``/api/polar``, ``/api/step``, etc. are
served by this function.

Locally we still run ``uvicorn app.main:app`` from ``frontend/server`` (no
prefix); the Next.js dev server rewrites ``/api/*`` to
``http://127.0.0.1:8000/*``.
"""

from __future__ import annotations

import os
import sys

_SERVER_DIR = os.path.join(os.path.dirname(__file__), "..", "server")
if _SERVER_DIR not in sys.path:
    sys.path.insert(0, _SERVER_DIR)

from fastapi import FastAPI  # noqa: E402

from app.routes import router  # noqa: E402

app = FastAPI(
    title="Boating Simulator API",
    version="0.1.0",
    description=(
        "Stateless sailing-physics endpoints powering the Next.js boating "
        "simulator. Deployed as a Vercel Python serverless function under /api."
    ),
)

app.include_router(router, prefix="/api")
