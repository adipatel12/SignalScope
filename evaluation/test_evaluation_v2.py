import os
import json
import torch
import numpy as np
from torch.utils.data import DataLoader, Subset
from datasets import load_dataset
from sklearn.metrics import (
    roc_auc_score, f1_score, accuracy_score, confusion_matrix, classification_report
)
from tqdm import tqdm

from preprocessing.transforms import get_transforms
from preprocessing.dataset import ForensicDataset
from model.model_v2 import SignalScopeFrequency
from model.config import Config

def evaluate_v2():
    print("="*60)
    print(" SIGNALSCOPE: V2 FINAL TEST SET EVALUATION")
    print("="*60)
    
    device = torch.device(Config.DEVICE)
    TEST_SUBSET_SIZE = 1000
    
    print(f"[1] Loading Test Data (Subset: {TEST_SUBSET_SIZE} images)...")
    raw_ds = load_dataset("Rajarshi-Roy-research/Defactify_Image_Dataset", cache_dir=Config.DATA_DIR)
    transforms_dict = get_transforms()
    
    full_test = ForensicDataset(raw_ds['test'], transform=transforms_dict['val'])
    test_subset = Subset(full_test, range(min(TEST_SUBSET_SIZE, len(full_test))))
    test_loader = DataLoader(test_subset, batch_size=Config.BATCH_SIZE, shuffle=False, num_workers=Config.NUM_WORKERS)
    
    print(f"[2] Loading Best V2 Weights...")
    v2_weights_path = os.path.join(Config.WEIGHTS_DIR, "baseline_v2_best.pth")
    model = SignalScopeFrequency(backbone_name=Config.MODEL_NAME)
    model.load_state_dict(torch.load(v2_weights_path, map_location=device, weights_only=True))
    model.to(device)
    model.eval()
    
    print("[3] Running Inference on Unseen Data...")
    all_preds_prob = []
    all_labels = []
    
    with torch.no_grad():
        for images, labels in tqdm(test_loader, desc="Testing V2", leave=False):
            images = images.to(device)
            logits = model(images)
            probs = torch.sigmoid(logits)
            
            all_preds_prob.extend(probs.cpu().numpy())
            all_labels.extend(labels.cpu().numpy())
            
    # We must find the new optimal threshold for V2 using Youden's J statistic directly on ROC
    # (Since we didn't run a separate threshold tuning script for V2 to save time)
    from sklearn.metrics import roc_curve
    fpr_c, tpr_c, thresholds_c = roc_curve(all_labels, all_preds_prob)
    optimal_idx = np.argmax(tpr_c - fpr_c)
    optimal_threshold = thresholds_c[optimal_idx]
    
    print(f"\n[4] Calculating Metrics (V2 OPTIMAL THRESHOLD = {optimal_threshold:.3f})...")
    preds_binary = [1 if p >= optimal_threshold else 0 for p in all_preds_prob]
    
    auc = roc_auc_score(all_labels, all_preds_prob)
    mac_f1 = f1_score(all_labels, preds_binary, average='macro', zero_division=0)
    acc = accuracy_score(all_labels, preds_binary)
    
    tn, fp, fn, tp = confusion_matrix(all_labels, preds_binary).ravel()
    fpr = fp / (fp + tn) if (fp + tn) > 0 else 0.0
    
    metrics = {
        "V2_Test_AUC": float(auc),
        "V2_Test_Macro_F1": float(mac_f1),
        "V2_Test_Accuracy": float(acc),
        "V2_False_Positive_Rate": float(fpr),
        "V2_Threshold": float(optimal_threshold)
    }
    
    print("\n--- OFFICIAL V2 TEST PERFORMANCE ---")
    for k, v in metrics.items():
        print(f"{k.ljust(25)}: {v:.4f}")
        
    print("\n--- CLASSIFICATION REPORT ---")
    print(classification_report(all_labels, preds_binary, target_names=["Real (0)", "AI (1)"], zero_division=0))
    print("="*60)

if __name__ == "__main__":
    evaluate_v2()