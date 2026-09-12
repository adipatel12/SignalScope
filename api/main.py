import os
import io
import torch
from fastapi import FastAPI, UploadFile, File, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
import numpy as np

from model.model_v2 import SignalScopeFrequency
from model.config import Config
from preprocessing.transforms import get_transforms

# Initialize FastAPI App
app = FastAPI(
    title="SignalScope Enterprise API",
    description="Production-Grade AI Image Forensics & Attribution Engine",
    version="5.0"
)

# Allow Cross-Origin Requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global variables
MODEL = None
DEVICE = None
TRANSFORMS = None
# Calibrated via evaluation/calibrate.py on balanced 1k Real / 1k AI validation set.
# F1: 0.9795 | Precision: 0.9809 | Recall: 0.9780
CALIBRATED_BASE_THRESHOLD = 0.9086

@app.on_event("startup")
async def load_model():
    global MODEL, DEVICE, TRANSFORMS
    print("🚀 Starting SignalScope Production Engine...")
    DEVICE = torch.device(Config.DEVICE)
    TRANSFORMS = get_transforms()['val']
    
    weights_path = os.path.join(Config.WEIGHTS_DIR, "baseline_v2_best.pth")
    if not os.path.exists(weights_path):
        raise RuntimeError(f"Model weights not found at {weights_path}")
        
    MODEL = SignalScopeFrequency(backbone_name=Config.MODEL_NAME)
    MODEL.load_state_dict(torch.load(weights_path, map_location=DEVICE, weights_only=True))
    MODEL.to(DEVICE)
    MODEL.eval()
    print(f"✅ Production Model loaded. Base Threshold set to {CALIBRATED_BASE_THRESHOLD}")

@app.get("/")
def health_check():
    return {
        "status": "online", 
        "engine": "SignalScope V2 (Semantic Multi-Crop)",
        "calibrated_threshold": CALIBRATED_BASE_THRESHOLD
    }

def extract_evaluation_crops(image: Image.Image, crop_size: int = 256) -> list:
    """
    Extracts crops while maintaining semantic scale so the model 
    recognizes faces and objects, not just microscopic textures.
    """
    crops = []
    
    # 1. Macro Global Overview (Always Index 0)
    crops.append(image.resize((crop_size, crop_size), Image.Resampling.BILINEAR))
    
    # 2. Normalize image size for realistic semantic patching
    w, h = image.size
    max_dim = 1024
    if max(w, h) > max_dim:
        scale = max_dim / float(max(w, h))
        new_w, new_h = max(crop_size, int(w * scale)), max(crop_size, int(h * scale))
        working_img = image.resize((new_w, new_h), Image.Resampling.LANCZOS)
    else:
        working_img = image

    # 3. Standard 5-Crop Extraction (Corners + Center)
    ww, hh = working_img.size
    if ww >= crop_size and hh >= crop_size:
        # Top-Left, Top-Right, Bottom-Left, Bottom-Right
        crops.append(working_img.crop((0, 0, crop_size, crop_size)))
        crops.append(working_img.crop((ww - crop_size, 0, ww, crop_size)))
        crops.append(working_img.crop((0, hh - crop_size, crop_size, hh)))
        crops.append(working_img.crop((ww - crop_size, hh - crop_size, ww, hh)))
        
        # Center Crop (Captures the main subject/face)
        left = (ww - crop_size) // 2
        top = (hh - crop_size) // 2
        crops.append(working_img.crop((left, top, left + crop_size, top + crop_size)))
        
    return crops

@app.post("/analyze/")
async def analyze_image(file: UploadFile = File(...), profile: str = Form("balanced")):
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image.")
        
    try:
        contents = await file.read()
        image = Image.open(io.BytesIO(contents)).convert("RGB")
        width, height = image.size
        
        # Extract semantically scaled crops
        crops = extract_evaluation_crops(image, crop_size=256)
        
        crop_probabilities = []
        with torch.no_grad():
            for crop in crops:
                img_tensor = TRANSFORMS(crop).unsqueeze(0).to(DEVICE)
                logit = MODEL(img_tensor)
                prob = torch.sigmoid(logit).item()
                crop_probabilities.append(prob)
                
        global_prob = crop_probabilities[0]
        local_probs = crop_probabilities[1:]
        
        # --- ROBUST MEDIAN AGGREGATION ---
        if len(local_probs) > 0:
            local_probs_sorted = sorted(local_probs)
            # Average the top 2 localized spikes
            top2_avg = sum(local_probs_sorted[-2:]) / 2.0 if len(local_probs_sorted) >= 2 else local_probs_sorted[0]
            median_score = float(np.median(local_probs_sorted))
            
            # Median cutoff is set to 0.45 (midpoint of [0, optimal_threshold=0.9086]).
            # If the median patch score is below this, most of the image looks authentic.
            if median_score < 0.45:
                prob_ai = (0.20 * top2_avg) + (0.55 * median_score) + (0.25 * global_prob)
            else:
                # Median is high — AI artifacts are spatially widespread (strong True AI signal).
                prob_ai = (0.45 * top2_avg) + (0.35 * median_score) + (0.20 * global_prob)
        else:
            prob_ai = global_prob
            
        threshold_map = {
            "strict": 0.6500,   # Catches subtle/stylized AI — higher false positive rate
            "balanced": CALIBRATED_BASE_THRESHOLD,  # 0.9086 (F1-optimal)
            "lenient": 0.9600   # Only flags very obvious AI — lower false positive rate
        }
        active_threshold = threshold_map.get(profile, CALIBRATED_BASE_THRESHOLD)
        is_ai = prob_ai >= active_threshold
        
        if prob_ai >= 0.90:
            risk_level = "HIGH_CONFIDENCE_SYNTHETIC"
        elif prob_ai >= active_threshold:
            risk_level = "MODERATE_SYNTHETIC_ANOMALY"
        elif prob_ai <= 0.10:
            risk_level = "HIGH_CONFIDENCE_AUTHENTIC"
        else:
            risk_level = "NATURAL_OR_COMPUTATIONAL_PHOTO"
        
        return {
            "filename": file.filename,
            "dimensions": f"{width}x{height}",
            "prediction": "Likely AI-generated" if is_ai else "Likely Real",
            "risk_tier": risk_level,
            "confidence_ai": round(prob_ai, 4),
            "confidence_real": round(1.0 - prob_ai, 4),
            "peak_anomaly_score": round(max(crop_probabilities), 4),
            "threshold_used": active_threshold,
            "profile_applied": profile,
            "regions_inspected": len(crops)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing image: {str(e)}")