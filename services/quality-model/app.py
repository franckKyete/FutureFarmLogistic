import io
import os
from typing import Annotated

import keras
import numpy as np
from fastapi import FastAPI, File, Header, HTTPException, UploadFile
from huggingface_hub import hf_hub_download
from PIL import Image


LABELS = ["bad", "good"]
IMAGE_SIZE = (224, 224)
MODEL_REPO = os.getenv("HF_MODEL_REPO", "winXT/futurefarm-quality-model")
MODEL_FILENAME = os.getenv("HF_MODEL_FILENAME", "quality_model.keras")
MODEL_API_TOKEN = os.getenv("MODEL_API_TOKEN", "")

app = FastAPI(title="FutureFarm Quality Model API", version="1.0.0")
model = None


def require_service_token(authorization: str | None) -> None:
    if MODEL_API_TOKEN and authorization != f"Bearer {MODEL_API_TOKEN}":
        raise HTTPException(status_code=401, detail="Invalid quality model service token")


@app.on_event("startup")
def load_model() -> None:
    global model
    model_path = hf_hub_download(
        repo_id=MODEL_REPO,
        filename=MODEL_FILENAME,
        token=os.getenv("HF_TOKEN") or None,
    )
    model = keras.saving.load_model(model_path, compile=False)


@app.get("/health")
def health() -> dict[str, object]:
    return {"status": "ok", "model_loaded": model is not None, "model": MODEL_REPO}


@app.post("/predict/quality")
async def predict_quality(
    file: Annotated[UploadFile, File(...)],
    authorization: Annotated[str | None, Header()] = None,
) -> dict[str, object]:
    require_service_token(authorization)

    if model is None:
        raise HTTPException(status_code=503, detail="Model is not loaded")

    if file.content_type not in {"image/jpeg", "image/png"}:
        raise HTTPException(status_code=415, detail="Only JPEG and PNG images are supported")

    try:
        image = Image.open(io.BytesIO(await file.read())).convert("RGB")
        image = image.resize(IMAGE_SIZE)
        batch = np.asarray(image, dtype=np.float32)[None, ...]
        probabilities = np.asarray(model.predict(batch, verbose=0)[0], dtype=np.float32)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Unable to process image: {exc}") from exc

    if probabilities.shape != (2,):
        raise HTTPException(
            status_code=500,
            detail=f"Unexpected model output shape: {probabilities.shape}; expected (2,)",
        )

    quality_index = int(np.argmax(probabilities))
    percentages = probabilities * 100

    return {
        "quality": LABELS[quality_index],
        "confidence": round(float(percentages[quality_index]), 2),
        "probabilities": {
            label: round(float(percentages[index]), 2)
            for index, label in enumerate(LABELS)
        },
    }
