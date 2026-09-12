import os
import torch
import numpy as np
from torch.utils.data import DataLoader, Subset
from datasets import load_dataset
from tqdm import tqdm
from PIL import Image

from preprocessing.transforms import get_transforms
from preprocessing.dataset import ForensicDataset
from model.model import SignalScopeBaseline
from model.config import Config

def extract_errors():
    print("="*60)
    print(" SIGNALSCOPE: ERROR ANALYSIS & EXTRACTION")
    print("="*60)
    
    device = torch.device(Config.DEVICE)
    OPTIMAL_THRESHOLD = 0.55
    TEST_SUBSET_SIZE = 1000
    
    # 1. Setup output directories
    error_dir = os.path.join(Config.REPORTS_DIR, "errors")
    fp_dir = os.path.join(error_dir, "false_positives")
    fn_dir = os.path.join(error_dir, "false_negatives")
    os.makedirs(fp_dir, exist_ok=True)
    os.makedirs(fn_dir, exist_ok=True)
    
    print(f"[1] Loading Test Data (Subset: {TEST_SUBSET_SIZE})...")
    raw_ds = load_dataset("Rajarshi-Roy-research/Defactify_Image_Dataset", cache_dir=Config.DATA_DIR)
    transforms_dict = get_transforms()
    full_test = ForensicDataset(raw_ds['test'], transform=transforms_dict['val'])
    test_subset = Subset(full_test, range(min(TEST_SUBSET_SIZE, len(full_test))))
    test_loader = DataLoader(test_subset, batch_size=Config.BATCH_SIZE, shuffle=False, num_workers=Config.NUM_WORKERS)
    
    print("[2] Loading Best Weights...")
    model = SignalScopeBaseline(backbone_name=Config.MODEL_NAME)
    model.load_state_dict(torch.load(Config.BEST_MODEL_PATH, map_location=device, weights_only=True))
    model.to(device)
    model.eval()
    
    errors = []
    
    print("[3] Scanning for high-confidence errors...")
    with torch.no_grad():
        for batch_idx, (images, labels_a) in enumerate(tqdm(test_loader, desc="Scanning", leave=False)):
            images = images.to(device)
            logits = model(images)
            probs = torch.sigmoid(logits).cpu().numpy()
            labels_a = labels_a.cpu().numpy()
            
            start_idx = batch_idx * Config.BATCH_SIZE
            
            for i in range(len(images)):
                global_idx = start_idx + i
                prob_ai = probs[i]
                pred = 1 if prob_ai >= OPTIMAL_THRESHOLD else 0
                true_a = int(labels_a[i])
                
                # False Positive: Predicted AI, but actually Real
                if pred == 1 and true_a == 0:
                    errors.append({
                        "type": "FP",
                        "global_idx": global_idx,
                        "prob": prob_ai,
                        "generator": "Real (MS COCO)"
                    })
                
                # False Negative: Predicted Real, but actually AI
                elif pred == 0 and true_a == 1:
                    gen_id = raw_ds['test'][global_idx]['Label_B']
                    gen_map = {1: "SD 2.1", 2: "SDXL", 3: "SD3", 4: "DALL-E 3", 5: "Midjourney v6"}
                    
                    errors.append({
                        "type": "FN",
                        "global_idx": global_idx,
                        "prob": prob_ai,  # Note: 1 - prob_ai is the confidence it is Real
                        "generator": gen_map.get(gen_id, f"Unknown ({gen_id})")
                    })
                    
    # Sort errors by how confident the model was in its wrong decision
    # For FPs, sort by highest prob_ai (Most confident it was AI)
    # For FNs, sort by lowest prob_ai (Most confident it was Real)
    fps = sorted([e for e in errors if e["type"] == "FP"], key=lambda x: x["prob"], reverse=True)
    fns = sorted([e for e in errors if e["type"] == "FN"], key=lambda x: x["prob"])
    
    print(f"\n[4] Found {len(fps)} False Positives and {len(fns)} False Negatives.")
    print(f"Extracting top 5 worst mistakes of each type to {error_dir}...")
    
    md_lines = ["# Error Analysis - Top Visual Failures\n"]
    
    def extract_and_save(error_list, category_name, save_dir, max_images=5):
        md_lines.append(f"## Top {category_name}\n")
        for rank, err in enumerate(error_list[:max_images]):
            g_idx = err["global_idx"]
            prob = err["prob"]
            source = err["generator"]
            
            # Fetch original raw image from Hugging Face
            raw_img = raw_ds['test'][g_idx]['Image'].convert("RGB")
            
            # Save the image
            filename = f"rank{rank+1}_idx{g_idx}_prob{prob:.3f}.jpg"
            filepath = os.path.join(save_dir, filename)
            raw_img.save(filepath)
            
            md_lines.append(f"**Rank {rank+1}** (Index: {g_idx})")
            md_lines.append(f"- **True Source:** {source}")
            md_lines.append(f"- **Predicted:** {'AI' if category_name == 'False Positives' else 'Real'}")
            md_lines.append(f"- **Confidence:** {prob*100:.1f}% (Probability of being AI)")
            md_lines.append(f"- **File:** `{filename}`\n")
            
            md_lines.append("> *Hypothesis: [Needs visual inspection]*\n")
            
    extract_and_save(fps, "False Positives", fp_dir)
    extract_and_save(fns, "False Negatives", fn_dir)
    
    md_path = os.path.join(error_dir, "error_analysis.md")
    with open(md_path, "w") as f:
        f.write("\n".join(md_lines))
        
    print(f"\n[!] Extraction complete. Markdown report saved to {md_path}")
    print("="*60)

if __name__ == "__main__":
    extract_errors()