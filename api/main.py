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
    version="6.0"
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

# Platt Scaling Calibration Constants
CALIBRATION_W = 0.8042
CALIBRATION_B = -0.1060

@app.on_event("startup")
async def load_model():
    global MODEL, DEVICE, TRANSFORMS
    print("🚀 Starting SignalScope Production Engine...")
    DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    TRANSFORMS = get_transforms()['val']
    
    weights_path = os.path.join(Config.WEIGHTS_DIR, "baseline_v2_best.pth")
    if not os.path.exists(weights_path):
        raise RuntimeError(f"Model weights not found at {weights_path}")
        
    MODEL = SignalScopeFrequency(backbone_name=Config.MODEL_NAME)
    MODEL.load_state_dict(torch.load(weights_path, map_location=DEVICE, weights_only=True))
    MODEL.to(DEVICE)
    MODEL.eval()
    print(f"✅ Production Model loaded. Platt Scaling (w={CALIBRATION_W}, b={CALIBRATION_B}) activated.")

@app.get("/")
def health_check():
    return {
        "status": "online", 
        "engine": "SignalScope V2 (Semantic Multi-Crop + Platt Scaling)",
        "calibrated_threshold": 0.5000
    }

def extract_evaluation_crops(image: Image.Image, crop_size: int = 256) -> list:
    """Extracts a global macro and a dense 3x3 overlapping grid."""
    crops = []
    
    # 1. Macro Global Overview (Index 0)
    crops.append(image.resize((crop_size, crop_size), Image.Resampling.BILINEAR))
    
    # 2. Scale image
    w, h = image.size
    max_dim = 1024
    if max(w, h) > max_dim:
        scale = max_dim / float(max(w, h))
        new_w, new_h = max(crop_size, int(w * scale)), max(crop_size, int(h * scale))
        working_img = image.resize((new_w, new_h), Image.Resampling.LANCZOS)
    else:
        working_img = image

    ww, hh = working_img.size
    
    # 3. Dense 3x3 Overlapping Grid (9 Crops)
    step_x = max(1, (ww - crop_size) // 2)
    step_y = max(1, (hh - crop_size) // 2)
    
    for i in range(3):
        for j in range(3):
            left = min(i * step_x, ww - crop_size)
            top = min(j * step_y, hh - crop_size)
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
                raw_logit = MODEL(img_tensor)
                
                # Apply Platt scaling to the raw logit before converting to probability
                calibrated_logit = (CALIBRATION_W * raw_logit) + CALIBRATION_B
                prob = torch.sigmoid(calibrated_logit).item()
                crop_probabilities.append(prob)
                
        # --- RESOLUTION-AWARE AGGREGATION ---
        max_dim = max(width, height)
        # Lowered to 2000 to catch modern 2K AI generations (like Midjourney & Gemini)
        is_high_res = max_dim >= 2000  
        
        global_prob = crop_probabilities[0]
        local_probs = crop_probabilities[1:]
        
        if len(local_probs) > 0:
            local_probs_sorted = sorted(local_probs, reverse=True)
            
            top_k = max(2, len(local_probs_sorted) // 3)
            top_k_avg = sum(local_probs_sorted[:top_k]) / top_k
            median_score = float(np.median(local_probs_sorted))
            
            if is_high_res:
                # 2K/4K/5K: Global downsampling destroys artifacts. Heavily weight local spikes.
                prob_ai = (0.65 * top_k_avg) + (0.25 * median_score) + (0.10 * global_prob)
            elif global_prob < 0.20 and top_k_avg > 0.70:
                # COMPRESSION DAMPENER: Protects standard <2000px social media uploads from noisy false positives.
                prob_ai = (0.15 * top_k_avg) + (0.35 * median_score) + (0.50 * global_prob)
            else:
                # Standard Contextual Formula
                prob_ai = (0.35 * top_k_avg) + (0.25 * median_score) + (0.40 * global_prob)
        else:
            prob_ai = global_prob
            
        # --- STANDARD PROBABILITY RISK TIERS ---
        threshold_map = {
            "strict": 0.3000,                      
            "balanced": 0.5000, 
            "lenient": 0.7000                      
        }
        active_threshold = threshold_map.get(profile, 0.5000)
        is_ai = prob_ai >= active_threshold
        
        # Clean, intuitive risk categorization
        if prob_ai >= 0.8500:
            risk_level = "HIGH_CONFIDENCE_SYNTHETIC"
        elif prob_ai >= active_threshold:
            risk_level = "MODERATE_SYNTHETIC_ANOMALY"
        elif prob_ai <= 0.1500:
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