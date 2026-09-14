# FutureFarm Product Model API

This service downloads the private Keras model from Hugging Face at startup and
exposes `POST /predict/product` for tomato, potato, bellpepper, and cucumber
classification.

Required environment variables:

- `HF_TOKEN`: Hugging Face read token for the private model repository.
- `MODEL_API_TOKEN`: shared secret expected from the FutureFarm API.

Optional variables:

- `HF_MODEL_REPO` (default: `winXT/futurefarm-product-model`)
- `HF_MODEL_FILENAME` (default: `product_model_mvp_final.keras`)
