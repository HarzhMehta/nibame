"""FastAPI surface for nibame's deterministic URL rule lab."""

from __future__ import annotations

from dataclasses import asdict
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from backend.categorizer import (
    DEFAULT_CONFIG_PATH,
    add_user_pattern,
    categorize_url,
    get_categories,
    load_category_definitions,
)
from backend.metadata import fetch_metadata_async


class CategorizeRequest(BaseModel):
    url: str = Field(min_length=1, max_length=4096)


class OverrideRequest(BaseModel):
    domain: str = Field(min_length=1, max_length=253)
    category: str = Field(min_length=1, max_length=80)


class MetadataRequest(BaseModel):
    url: str = Field(min_length=1, max_length=4096)


app = FastAPI(
    title="nibame URL categorizer",
    description="Explainable URL categorization using offline domain and path rules.",
    version="0.1.0",
)

assets_directory = Path(__file__).resolve().parent.parent / "assets"
app.mount("/api/assets", StaticFiles(directory=assets_directory), name="assets")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok", "mode": "offline-rules"}


@app.get("/api/categories")
def categories() -> dict[str, object]:
    category_data = [
        {
            "id": category.id,
            "label": category.label,
            "description": category.description,
            "color": category.color,
            "domain_count": len(category.domains),
            "examples": list(category.domains[:4]),
        }
        for category in get_categories()
    ]
    return {
        "categories": category_data,
        "category_count": len(category_data) - 1,
        "domain_count": sum(item["domain_count"] for item in category_data),
    }


@app.post("/api/categorize")
def categorize_link(request: CategorizeRequest) -> dict[str, object]:
    result = categorize_url(request.url)
    if not result.is_valid:
        raise HTTPException(
            status_code=422,
            detail="Enter a valid HTTP(S) URL or bare domain.",
        )
    return result.to_dict()


@app.post("/api/metadata")
async def extract_metadata(request: MetadataRequest) -> dict[str, object]:
    result = await fetch_metadata_async(request.url)
    if not result.is_valid:
        raise HTTPException(
            status_code=422,
            detail="Enter a valid HTTP(S) URL or bare domain.",
        )
    return result.to_dict()


@app.post("/api/overrides")
def remember_override(request: OverrideRequest) -> dict[str, object]:
    definitions = load_category_definitions()
    if request.category not in definitions or request.category == "unknown":
        raise HTTPException(status_code=422, detail="Choose a supported category.")

    try:
        patterns = add_user_pattern(
            request.domain,
            request.category,
            path=DEFAULT_CONFIG_PATH,
        )
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error

    updated_result = categorize_url(request.domain, user_patterns=patterns)
    return {
        "saved": True,
        "pattern_count": len(patterns),
        "result": asdict(updated_result),
    }
