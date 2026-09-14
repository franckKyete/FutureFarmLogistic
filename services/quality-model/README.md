# FutureFarm Quality Model API

This service downloads the private Keras quality model from Hugging Face at
startup and exposes `POST /predict/quality` for `bad` and `good` classification.

Required environment variables:

- `HF_TOKEN`: Hugging Face read token for the private model repository.
- `MODEL_API_TOKEN`: shared secret expected from the FutureFarm API.

Optional variables:

- `HF_MODEL_REPO` (default: `winXT/futurefarm-quality-model`)
- `HF_MODEL_FILENAME` (default: `quality_model.keras`)
