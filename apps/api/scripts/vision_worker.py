#!/usr/bin/env python3
"""
Future Farm Logistic - Persistent Vision Inference Worker
Loads Keras models once into memory on startup and continuously listens for inference jobs via stdin.
Emits real-time image-by-image processing logs to stderr.
"""

import sys
import os
import json
import io
import time
import argparse
import traceback
import numpy as np
from PIL import Image

def log(msg: str):
    sys.stderr.write(f"[VisionWorker] {msg}\n")
    sys.stderr.flush()

def main():
    parser = argparse.ArgumentParser(description="FutureFarm Vision Inference Daemon")
    parser.add_argument("--product-model", required=True, help="Path to product classification keras model")
    parser.add_argument("--quality-model", required=True, help="Path to quality classification keras model")
    args = parser.parse_args()

    product_model_path = os.path.abspath(args.product_model)
    quality_model_path = os.path.abspath(args.quality_model)

    log(f"Initializing inference worker (PID: {os.getpid()})...")

    product_model = None
    quality_model = None

    # Load Keras / TensorFlow
    try:
        import keras
        load_fn = keras.models.load_model
        log(f"Using Keras library version {getattr(keras, '__version__', 'unknown')}")
    except Exception:
        import tensorflow as tf
        load_fn = tf.keras.models.load_model
        log(f"Using TensorFlow Keras library version {getattr(tf, '__version__', 'unknown')}")

    # 1. Preload Product Model into memory
    if os.path.exists(product_model_path):
        log(f"Pre-loading Product Model from '{product_model_path}' into memory...")
        t0 = time.time()
        try:
            product_model = load_fn(product_model_path)
            log(f"✓ Product Model loaded in {time.time() - t0:.2f}s (Input shape: {getattr(product_model, 'input_shape', 'unknown')})")
        except Exception as e:
            log(f"✗ Failed to load product model: {e}\n{traceback.format_exc()}")
    else:
        log(f"⚠ Product model file not found at '{product_model_path}'")

    # 2. Preload Quality Model into memory
    if os.path.exists(quality_model_path):
        log(f"Pre-loading Quality Model from '{quality_model_path}' into memory...")
        t0 = time.time()
        try:
            quality_model = load_fn(quality_model_path)
            log(f"✓ Quality Model loaded in {time.time() - t0:.2f}s (Input shape: {getattr(quality_model, 'input_shape', 'unknown')})")
        except Exception as e:
            log(f"✗ Failed to load quality model: {e}\n{traceback.format_exc()}")
    else:
        log(f"⚠ Quality model file not found at '{quality_model_path}'")

    # Signal ready state to parent Node process
    sys.stdout.write(json.dumps({
        "status": "READY",
        "productModelLoaded": product_model is not None,
        "qualityModelLoaded": quality_model is not None,
        "pid": os.getpid()
    }) + "\n")
    sys.stdout.flush()
    log("Worker ready to receive inference requests via stdin.")

    classes = ["tomato", "potato", "bellpepper", "cucumber"]

    # Continuous request processing loop
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue

        try:
            request = json.loads(line)
        except Exception as err:
            log(f"Failed to parse incoming JSON line: {err}")
            continue

        req_id = request.get("requestId", "unknown")
        mode = request.get("mode", "both")
        raw_images = request.get("images", [])
        image_names = request.get("imageNames", [])
        total_images = len(raw_images)

        log(f"[Req:{req_id}] Received inference task (mode='{mode}', total_images={total_images})")

        product_votes = []
        product_details = []
        quality_classifications = []
        quality_details = []

        for idx, item in enumerate(raw_images, start=1):
            if isinstance(item, dict):
                b64 = item.get("data", "")
                img_name = item.get("name") or (image_names[idx - 1] if idx - 1 < len(image_names) else f"image_{idx}")
            else:
                b64 = item
                img_name = image_names[idx - 1] if idx - 1 < len(image_names) else f"image_{idx}"

            try:
                import base64
                img_bytes = base64.b64decode(b64)
                img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
            except Exception as e:
                log(f"[Req:{req_id}] [Image {idx}/{total_images}] ('{img_name}') Error decoding image: {e}")
                # Fallback transparent placeholder
                img = Image.new("RGB", (254, 254), color=(0, 0, 0))

            # --- A. Product Classification ---
            if mode in ("both", "product"):
                if product_model is not None:
                    # 160x160 RGB sequential inference
                    img_prod = img.resize((160, 160))
                    arr_prod = np.array(img_prod, dtype=np.float32)
                    arr_prod = np.expand_dims(arr_prod, axis=0)
                    preds_prod = product_model.predict(arr_prod, verbose=0)[0]
                    top_idx = int(np.argmax(preds_prod))
                    predicted_class = classes[top_idx]
                    confidence = float(preds_prod[top_idx])
                    product_votes.append(preds_prod)
                    
                    scores_str = ", ".join([f"{classes[k]}={preds_prod[k]:.1%}" for k in range(min(len(classes), len(preds_prod)))])
                    log(f"[Req:{req_id}] [Image {idx}/{total_images}] ('{img_name}') [PRODUCT 160x160] -> Output: '{predicted_class}' ({confidence:.1%}) [{scores_str}]")
                    product_details.append({
                        "imageIndex": idx,
                        "imageName": img_name,
                        "predictedClass": predicted_class,
                        "confidence": confidence
                    })
                else:
                    log(f"[Req:{req_id}] [Image {idx}/{total_images}] ('{img_name}') [PRODUCT] Model not loaded, using fallback default")

            # --- B. Quality Classification ---
            if mode in ("both", "quality"):
                if quality_model is not None:
                    # 254x254 (or model input shape) RGB sequential inference
                    target_size = (224, 224)
                    try:
                        if hasattr(quality_model, 'input_shape') and quality_model.input_shape and len(quality_model.input_shape) >= 3:
                            h = quality_model.input_shape[1] or 224
                            w = quality_model.input_shape[2] or 224
                            target_size = (w, h)
                    except Exception:
                        pass
                    
                    img_qual = img.resize(target_size)
                    arr_qual = np.array(img_qual, dtype=np.float32)
                    arr_qual = np.expand_dims(arr_qual, axis=0)
                    preds_qual = quality_model.predict(arr_qual, verbose=0)[0]

                    # Binary classification logic: index 0 is BAD, index 1 is GOOD
                    if len(preds_qual) >= 2:
                        prob_bad = float(preds_qual[0])
                        prob_good = float(preds_qual[1])
                        is_good = prob_good >= prob_bad
                        classification = "GOOD" if is_good else "BAD"
                        log(f"[Req:{req_id}] [Image {idx}/{total_images}] ('{img_name}') [QUALITY {target_size[0]}x{target_size[1]}] -> Output: {classification} (good: {prob_good:.1%}, bad: {prob_bad:.1%})")
                    else:
                        prob_good = float(preds_qual[0])
                        prob_bad = 1.0 - prob_good
                        is_good = prob_good >= 0.5
                        classification = "GOOD" if is_good else "BAD"
                        log(f"[Req:{req_id}] [Image {idx}/{total_images}] ('{img_name}') [QUALITY {target_size[0]}x{target_size[1]}] -> Output: {classification} (good_prob: {prob_good:.1%})")

                    quality_classifications.append(classification)
                    quality_details.append({
                        "imageIndex": idx,
                        "imageName": img_name,
                        "classification": classification,
                        "goodProbability": prob_good,
                        "badProbability": prob_bad
                    })
                else:
                    log(f"[Req:{req_id}] [Image {idx}/{total_images}] ('{img_name}') [QUALITY] Model not loaded, using fallback")

        # Compile overall response
        response_data = {
            "requestId": req_id,
            "success": True,
        }

        if mode in ("both", "product") and len(product_votes) > 0:
            avg_preds = np.mean(product_votes, axis=0)
            overall_top_idx = int(np.argmax(avg_preds))
            overall_class = classes[overall_top_idx]
            overall_conf = float(avg_preds[overall_top_idx])
            response_data["product"] = {
                "predictedClass": overall_class,
                "confidence": overall_conf,
                "details": product_details
            }
            log(f"[Req:{req_id}] [SUMMARY] Product Classification: '{overall_class}' (Overall Confidence: {overall_conf:.1%})")

        if mode in ("both", "quality") and len(quality_classifications) > 0:
            good_count = quality_classifications.count("GOOD")
            total_count = len(quality_classifications)
            score_out_of_10 = round((good_count / total_count) * 10, 1) if total_count > 0 else 0.0
            response_data["quality"] = {
                "goodCount": good_count,
                "totalCount": total_count,
                "scoreOutOf10": score_out_of_10,
                "classifications": quality_classifications,
                "details": quality_details
            }
            log(f"[Req:{req_id}] [SUMMARY] Quality Evaluation: {good_count}/{total_count} GOOD (Score: {score_out_of_10}/10)")

        # Send JSON response line to parent
        sys.stdout.write(json.dumps(response_data) + "\n")
        sys.stdout.flush()

if __name__ == "__main__":
    main()
