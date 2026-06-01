# Wildlife inference backend

Inference-only FastAPI service for Traces wildlife species identification.

This service always uses Google AI Gemini for wildlife identification. It does not load or fall back to a local model.

## Run

```sh
cd apps/wildlife-inference
pip install -r requirements.txt
uvicorn server:app --host 0.0.0.0 --port 8000
```

Set a Gemini API key before starting the server. You can either create `apps/wildlife-inference/.env` from `.env.example`:

```env
GEMINI_API_KEY=your_gemini_api_key_here
```

Or export it in your terminal:

PowerShell:

```powershell
$env:GEMINI_API_KEY="your_gemini_api_key_here"
```

cmd.exe:

```bat
set GEMINI_API_KEY=your_gemini_api_key_here
```

Without `GEMINI_API_KEY` or `GOOGLE_API_KEY`, identification requests fail with `503` instead of using a local fallback.

## Response shape

Both `POST /predict` and `POST /identify` accept an optional multipart `language` field:

- `en` returns English biological text.
- `ar` returns natural Arabic biological text while preserving the JSON keys and Latin scientific name.

`POST /predict` is kept for compatibility and returns a single Google AI-derived prediction:

```json
{
  "top5": [
    {
      "name": "Jackal Buzzard",
      "commonName": "Jackal Buzzard",
      "scientificName": "Buteo rufofuscus",
      "confidence": 0.91
    }
  ]
}
```

`POST /identify` returns the richer app-facing payload:

```json
{
  "result": {
    "commonName": "Jackal Buzzard",
    "scientificName": "Buteo rufofuscus",
    "shortDescription": "A concise field-guide style description.",
    "confidenceLevel": 91,
    "taxonomy": {
      "kingdom": "Animalia",
      "family": "Accipitridae",
      "genus": "Buteo"
    },
    "notableFeatures": [],
    "ecologicalRole": "",
    "funFacts": []
  },
  "top5": [],
  "source": "google-ai",
  "language": "en",
  "isFallback": false,
  "fallbackReason": ""
}
```
