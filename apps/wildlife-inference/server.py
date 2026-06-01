from __future__ import annotations

import base64
import json
import os
import urllib.error
import urllib.request
from io import BytesIO
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from PIL import Image, UnidentifiedImageError


def load_local_env() -> None:
    env_path = Path(__file__).with_name(".env")
    if not env_path.exists():
        return

    for line in env_path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue

        key, value = stripped.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key:
            os.environ.setdefault(key, value)


load_local_env()

GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"

IDENTIFICATION_SYSTEM_INSTRUCTION = """You are a highly detailed and rigorous biological expert, entomologist, and botanist.
Identify the organism in the provided photo.
Return STRICTLY a valid JSON object matching this schema:
{
  "commonName": "Primary common name of organism",
  "scientificName": "Scientific nomenclature (Genus species)",
  "shortDescription": "An engaging, accurate 2-3 sentence overview describing the specimen.",
  "confidenceLevel": 92,
  "taxonomy": {
    "kingdom": "Kingdom classification",
    "phylum": "Phylum details",
    "class": "Class details",
    "order": "Order details",
    "family": "Family details",
    "genus": "Genus details",
    "species": "Species binomial naming"
  },
  "notableFeatures": [
    "At least 3 identifiable features, structures, or coloration patterns shown on this organism"
  ],
  "ecologicalRole": "Brief 1-sentence note of this species' role or habitat in its ecosystem.",
  "funFacts": [
    "At least 2 concise biological facts about this species."
  ]
}
Do not return Markdown or code fences."""

IDENTIFICATION_USER_PROMPT = (
    "Identify the plant, animal, fungus, or other organism in this picture and "
    "provide its full biological taxonomy and descriptive details."
)

TAXONOMY_KEYS = ("kingdom", "phylum", "class", "order", "family", "genus", "species")
IMAGE_MIME_TYPES = {
    "GIF": "image/gif",
    "JPEG": "image/jpeg",
    "PNG": "image/png",
    "WEBP": "image/webp",
}
SUPPORTED_LANGUAGES = {"ar", "en"}
LANGUAGE_INSTRUCTIONS = {
    "ar": (
        "Return all human-readable values in natural, grammatically correct Arabic. "
        "Keep the JSON property names exactly as specified. Keep scientificName as Latin binomial nomenclature. "
        "Use Arabic names for taxonomy values when they are commonly available."
    ),
    "en": (
        "Return all human-readable values in English. "
        "Keep the JSON property names exactly as specified."
    ),
}


def get_gemini_api_key() -> str | None:
    return os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")


def get_text(value: object, fallback: str = "") -> str:
    return value.strip() if isinstance(value, str) and value.strip() else fallback


def get_string_list(value: object) -> list[str]:
    if not isinstance(value, list):
        return []

    return [item.strip() for item in value if isinstance(item, str) and item.strip()]


def normalize_language(language: str | None) -> str:
    normalized = (language or "en").strip().lower()
    return normalized if normalized in SUPPORTED_LANGUAGES else "en"


def clean_json_text(text: str) -> str:
    cleaned = text.strip()

    if cleaned.startswith("```"):
        cleaned = cleaned.removeprefix("```json").removeprefix("```").removesuffix("```").strip()

    return cleaned


def normalize_identification(data: object) -> dict[str, object]:
    source = data if isinstance(data, dict) else {}
    confidence_level = source.get("confidenceLevel")
    taxonomy_source = source.get("taxonomy") if isinstance(source.get("taxonomy"), dict) else {}
    taxonomy = {
        key: get_text(taxonomy_source.get(key))
        for key in TAXONOMY_KEYS
    }

    return {
        "commonName": get_text(source.get("commonName"), "Unknown organism"),
        "scientificName": get_text(source.get("scientificName")),
        "shortDescription": get_text(
            source.get("shortDescription"),
            "Google AI could not provide a detailed description for this organism.",
        ),
        "confidenceLevel": int(confidence_level) if isinstance(confidence_level, (float, int)) else 0,
        "taxonomy": taxonomy,
        "notableFeatures": get_string_list(source.get("notableFeatures")),
        "ecologicalRole": get_text(source.get("ecologicalRole")),
        "funFacts": get_string_list(source.get("funFacts")),
    }


def parse_gemini_identification(response_data: object) -> object:
    if not isinstance(response_data, dict):
        raise ValueError("Gemini returned an unexpected response.")

    candidates = response_data.get("candidates")
    if not isinstance(candidates, list) or not candidates:
        raise ValueError("Gemini returned no candidates.")

    first_candidate = candidates[0]
    if not isinstance(first_candidate, dict):
        raise ValueError("Gemini returned an invalid candidate.")

    content = first_candidate.get("content")
    parts = content.get("parts") if isinstance(content, dict) else None
    if not isinstance(parts, list):
        raise ValueError("Gemini returned no content parts.")

    text = "".join(part.get("text", "") for part in parts if isinstance(part, dict))
    if not text.strip():
        raise ValueError("Gemini returned an empty response.")

    return json.loads(clean_json_text(text))


def identify_with_gemini(image_bytes: bytes, mime_type: str, language: str = "en") -> dict[str, object]:
    api_key = get_gemini_api_key()
    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="Gemini API key is not configured. Set GEMINI_API_KEY to enable detailed identification.",
        )

    response_language = normalize_language(language)
    request_body = {
        "systemInstruction": {
            "parts": [{"text": f"{IDENTIFICATION_SYSTEM_INSTRUCTION}\n\n{LANGUAGE_INSTRUCTIONS[response_language]}"}],
        },
        "contents": [
            {
                "parts": [
                    {
                        "inline_data": {
                            "mime_type": mime_type,
                            "data": base64.b64encode(image_bytes).decode("ascii"),
                        },
                    },
                    {"text": f"{IDENTIFICATION_USER_PROMPT}\nResponse language: {response_language}"},
                ],
            },
        ],
        "generationConfig": {
            "responseMimeType": "application/json",
        },
    }

    request = urllib.request.Request(
        GEMINI_ENDPOINT.format(model=GEMINI_MODEL),
        data=json.dumps(request_body).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "x-goog-api-key": api_key,
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=45) as response:
            response_data = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        details = exc.read().decode("utf-8", errors="replace")
        raise HTTPException(status_code=502, detail=f"Gemini identification failed: {details}") from exc
    except (urllib.error.URLError, TimeoutError) as exc:
        raise HTTPException(status_code=502, detail="Unable to reach Gemini for detailed identification.") from exc

    try:
        return normalize_identification(parse_gemini_identification(response_data))
    except (json.JSONDecodeError, ValueError) as exc:
        raise HTTPException(status_code=502, detail="Gemini returned an invalid identification payload.") from exc


async def read_upload_image(file: UploadFile) -> tuple[bytes, str]:
    try:
        image_bytes = await file.read()
        image = Image.open(BytesIO(image_bytes))
        image.load()
        mime_type = IMAGE_MIME_TYPES.get(image.format or "", file.content_type or "image/jpeg")
    except UnidentifiedImageError as exc:
        raise HTTPException(status_code=400, detail="Uploaded file is not a valid image.") from exc
    finally:
        await file.close()

    return image_bytes, mime_type


app = FastAPI(title="Traces Wildlife Inference")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "provider": "google-ai", "model": GEMINI_MODEL}


@app.post("/predict")
async def predict(
    file: UploadFile = File(...),
    language: str = Form("en"),
) -> dict[str, list[dict[str, float | str]]]:
    image_bytes, mime_type = await read_upload_image(file)
    result = identify_with_gemini(image_bytes, mime_type, language)
    confidence_level = result.get("confidenceLevel")
    confidence = float(confidence_level) / 100 if isinstance(confidence_level, (int, float)) else 0
    prediction: dict[str, float | str] = {
        "name": get_text(result.get("commonName"), get_text(result.get("scientificName"), "Unknown organism")),
        "confidence": confidence,
    }

    scientific_name = get_text(result.get("scientificName"))
    if scientific_name:
        prediction["scientificName"] = scientific_name

    common_name = get_text(result.get("commonName"))
    if common_name:
        prediction["commonName"] = common_name

    return {"top5": [prediction]}


@app.post("/identify")
async def identify(
    file: UploadFile = File(...),
    language: str = Form("en"),
) -> dict[str, object]:
    response_language = normalize_language(language)
    image_bytes, mime_type = await read_upload_image(file)
    result = identify_with_gemini(image_bytes, mime_type, response_language)

    return {
        "result": result,
        "top5": [],
        "source": "google-ai",
        "language": response_language,
        "isFallback": False,
        "fallbackReason": "",
    }
