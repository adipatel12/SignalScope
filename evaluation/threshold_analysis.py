import os
import torch
import numpy as np
import matplotlib.pyplot as plt
from torch.utils.data import DataLoader, Subset
from datasets import load_dataset
from sklearn.metrics import f1_score, confusion_matrix
from tqdm import tqdm

from preprocessing.transforms import get_transforms
from preprocessing.dataset import ForensicDataset
from model.model import SignalScopeBaseline
from model.config import Config

def optimize_threshold():
    print("="*60)
    print(" SIGNALSCOPE: THRESHOLD ANALYSIS")
    print("="*60)
    
    device = torch.device(Config.DEVICE)
    
    # 1. Load Data
    print("[1] Loading Validation Data (for Threshold Tuning)...")
    raw_ds = load_dataset("Rajarshi-Roy-research/Defactify_Image_Dataset", cache_dir=Config.DATA_DIR)
    transforms_dict = get_transforms()
    full_val = ForensicDataset(raw_ds['validation'], transform=transforms_dict['val'])
    val_subset = Subset(full_val, range(min(Config.MAX_VAL_SAMPLES, len(full_val))))
    val_loader = DataLoader(val_subset, batch_size=Config.BATCH_SIZE, shuffle=False, num_workers=Config.NUM_WORKERS)
    
    # 2. Load Model
    print("[2] Loading Best Model Weights...")
    model = SignalScopeBaseline(backbone_name=Config.MODEL_NAME)
    model.load_state_dict(torch.load(Config.BEST_MODEL_PATH, map_location=device, weights_only=True))
    model.to(device)
    model.eval()
    
    # 3. Get all predictions
    print("[3] Running Inference...")
    all_preds_prob = []
    all_labels = []
    
    with torch.no_grad():
        for images, labels in tqdm(val_loader, desc="Scanning", leave=False):
            images = images.to(device)
            logits = model(images)
            probs = torch.sigmoid(logits)
            
            all_preds_prob.extend(probs.cpu().numpy())
            all_labels.extend(labels.cpu().numpy())
            
    # 4. Search for the best threshold
    print("\n[4] Scanning Thresholds (0.01 to 0.99)...")
    thresholds = np.arange(0.01, 1.0, 0.01)
    
    best_thresh = 0.5
    best_macro_f1 = 0.0
    best_metrics = {}
    
    threshold_f1_scores = []
    
    for t in thresholds:
        # Apply the moving threshold
        preds_binary = [1 if p >= t else 0 for p in all_preds_prob]
        
        # Calculate Macro-F1 (balances both classes)
        mac_f1 = f1_score(all_labels, preds_binary, average='macro', zero_division=0)
        threshold_f1_scores.append(mac_f1)
        
        if mac_f1 > best_macro_f1:
            best_macro_f1 = mac_f1
            best_thresh = t
            
            # Extract confusion matrix for this specific threshold
            tn, fp, fn, tp = confusion_matrix(all_labels, preds_binary).ravel()
            fpr = fp / (fp + tn) if (fp + tn) > 0 else 0.0
            
            best_metrics = {
                "Threshold": t,
                "Macro_F1": mac_f1,
                "FPR": fpr,
                "True_Real": tn,
                "False_AI": fp
            }
            
    print("\n--- OPTIMAL THRESHOLD FOUND ---")
    print(f"Optimal Threshold : {best_thresh:.2f}")
    print(f"Max Macro-F1      : {best_metrics['Macro_F1']:.4f}")
    print(f"False Positive %  : {best_metrics['FPR']*100:.1f}%")
    print(f"Real Images Saved : {best_metrics['True_Real']} correctly identified as Real")
    print(f"Real Images Lost  : {best_metrics['False_AI']} falsely accused of being AI")
    
    print("\n[!] FORENSICS RULE: We must freeze this threshold now.")
    print("    We will strictly use this threshold on the unseen Test Set.")
    
    # 5. Plot the threshold search
    plt.figure()
    plt.plot(thresholds, threshold_f1_scores, color='blue', lw=2, label='Macro-F1')
    plt.axvline(x=best_thresh, color='red', linestyle='--', label=f'Optimal ({best_thresh:.2f})')
    plt.title('Threshold Optimization for Imbalanced Data')
    plt.xlabel('Decision Threshold')
    plt.ylabel('Macro-F1 Score')
    plt.legend(loc='lower center')
    plt.savefig(os.path.join(Config.REPORTS_DIR, "threshold_analysis.png"))
    plt.close()
    
    print(f"\nPlot saved to {os.path.join(Config.REPORTS_DIR, 'threshold_analysis.png')}")
    print("="*60)

if __name__ == "__main__":
    optimize_threshold()