"""FastAPI entry point for the boating simulator backend."""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routes import router


def create_app() -> FastAPI:
    app = FastAPI(
        title="Boating Simulator API",
        version="0.1.0",
        description=(
            "Stateless sailing-physics endpoints powering the Next.js boating "
            "simulator. The frontend caches /polar and runs its own animation "
            "loop, calling /step occasionally for HUD readouts."
        ),
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost:3000",
            "http://127.0.0.1:3000",
        ],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(router)
    return app


app = create_app()
