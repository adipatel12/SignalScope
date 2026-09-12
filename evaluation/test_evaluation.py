import os
import json
import torch
from torch.utils.data import DataLoader, Subset
from datasets import load_dataset
from sklearn.metrics import (
    roc_auc_score, f1_score, accuracy_score, confusion_matrix, classification_report
)
from tqdm import tqdm

from preprocessing.transforms import get_transforms
from preprocessing.dataset import ForensicDataset
from model.model import SignalScopeBaseline
from model.config import Config

def evaluate_test_set():
    print("="*60)
    print(" SIGNALSCOPE: FINAL TEST SET EVALUATION")
    print("="*60)
    
    device = torch.device(Config.DEVICE)
    
    # [HARDCODED FROM STAGE 9]
    OPTIMAL_THRESHOLD = 0.55
    TEST_SUBSET_SIZE = 1000 # Keep manageable for CPU
    
    # 1. Load the UNSEEN Test Data
    print(f"[1] Loading Test Data (Subset: {TEST_SUBSET_SIZE} images)...")
    raw_ds = load_dataset("Rajarshi-Roy-research/Defactify_Image_Dataset", cache_dir=Config.DATA_DIR)
    transforms_dict = get_transforms()
    
    # We apply the EXACT SAME deterministic transformations used in validation
    full_test = ForensicDataset(raw_ds['test'], transform=transforms_dict['val'])
    test_subset = Subset(full_test, range(min(TEST_SUBSET_SIZE, len(full_test))))
    test_loader = DataLoader(test_subset, batch_size=Config.BATCH_SIZE, shuffle=False, num_workers=Config.NUM_WORKERS)
    
    # 2. Load Model
    print(f"[2] Loading Best Weights from {Config.BEST_MODEL_PATH}")
    model = SignalScopeBaseline(backbone_name=Config.MODEL_NAME)
    model.load_state_dict(torch.load(Config.BEST_MODEL_PATH, map_location=device, weights_only=True))
    model.to(device)
    model.eval()
    
    # 3. Run Inference
    print("[3] Running Inference on Unseen Data...")
    all_preds_prob = []
    all_labels = []
    
    with torch.no_grad():
        for images, labels in tqdm(test_loader, desc="Testing", leave=False):
            images = images.to(device)
            logits = model(images)
            probs = torch.sigmoid(logits)
            
            all_preds_prob.extend(probs.cpu().numpy())
            all_labels.extend(labels.cpu().numpy())
            
    # 4. Calculate Final Metrics using Frozen Threshold
    print(f"\n[4] Calculating Metrics (FROZEN THRESHOLD = {OPTIMAL_THRESHOLD})...")
    preds_binary = [1 if p >= OPTIMAL_THRESHOLD else 0 for p in all_preds_prob]
    
    auc = roc_auc_score(all_labels, all_preds_prob)
    mac_f1 = f1_score(all_labels, preds_binary, average='macro', zero_division=0)
    acc = accuracy_score(all_labels, preds_binary)
    
    tn, fp, fn, tp = confusion_matrix(all_labels, preds_binary).ravel()
    fpr = fp / (fp + tn) if (fp + tn) > 0 else 0.0
    
    metrics = {
        "Test_AUC": float(auc),
        "Test_Macro_F1": float(mac_f1),
        "Test_Accuracy": float(acc),
        "Test_False_Positive_Rate": float(fpr),
        "Frozen_Threshold": OPTIMAL_THRESHOLD
    }
    
    # Save to JSON
    test_metrics_path = os.path.join(Config.REPORTS_DIR, "test_metrics.json")
    with open(test_metrics_path, "w") as f:
        json.dump(metrics, f, indent=4)
        
    print("\n--- OFFICIAL TEST PERFORMANCE ---")
    for k, v in metrics.items():
        print(f"{k.ljust(25)}: {v:.4f}")
        
    print("\n--- CLASSIFICATION REPORT ---")
    print(classification_report(all_labels, preds_binary, target_names=["Real (0)", "AI (1)"], zero_division=0))
    print("="*60)

if __name__ == "__main__":
    evaluate_test_set()