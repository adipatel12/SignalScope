import argparse
import sys
import os
import torch
import warnings
from PIL import Image

from model.model import SignalScopeBaseline
from model.config import Config
from preprocessing.transforms import get_transforms

# Suppress torchvision warnings for a cleaner CLI output
warnings.filterwarnings("ignore")

def predict_single_image(image_path):
    # Ensure the file actually exists
    if not os.path.exists(image_path):
        print(f"Error: Could not find image at '{image_path}'")
        sys.exit(1)
        
    device = torch.device(Config.DEVICE)
    OPTIMAL_THRESHOLD = 0.55
    
    # 1. Load Model
    model = SignalScopeBaseline(backbone_name=Config.MODEL_NAME)
    
    # Ensure weights exist
    if not os.path.exists(Config.BEST_MODEL_PATH):
        print(f"Error: Model weights not found at '{Config.BEST_MODEL_PATH}'. Run training first.")
        sys.exit(1)
        
    model.load_state_dict(torch.load(Config.BEST_MODEL_PATH, map_location=device, weights_only=True))
    model.to(device)
    model.eval()
    
    # 2. Load and Transform Image
    try:
        img = Image.open(image_path).convert("RGB")
    except Exception as e:
        print(f"Error loading image: {e}")
        sys.exit(1)
        
    # Apply the deterministic validation transforms
    transforms = get_transforms()['val']
    img_tensor = transforms(img).unsqueeze(0).to(device) # Add batch dimension [1, 3, 224, 224]
    
    # 3. Run Inference
    with torch.no_grad():
        logit = model(img_tensor)
        prob_ai = torch.sigmoid(logit).item()
        
    # 4. Apply Threshold
    is_ai = prob_ai >= OPTIMAL_THRESHOLD
    
    # Responsible wording requirement from the prompt
    label = "Likely AI-generated" if is_ai else "Likely Real"
    
    # 5. Format JSON Output
    result = {
        "label": label,
        "probability_ai": round(prob_ai, 4),
        "probability_real": round(1.0 - prob_ai, 4),
        "threshold": OPTIMAL_THRESHOLD
    }
    
    return result

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="SignalScope Single Image Predictor")
    parser.add_argument("--image", type=str, required=True, help="Path to the image file")
    
    args = parser.parse_args()
    
    # Run prediction
    result = predict_single_image(args.image)
    
    # Print the raw JSON (this makes it easy for APIs to consume later)
    import json
    print("\n" + "="*40)
    print(" SIGNALSCOPE PREDICTION")
    print("="*40)
    print(json.dumps(result, indent=4))
    print("="*40)