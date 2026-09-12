import os
import json
import torch
import matplotlib.pyplot as plt
from sklearn.metrics import (
    roc_auc_score, f1_score, accuracy_score, precision_score, recall_score,
    confusion_matrix, classification_report, roc_curve, ConfusionMatrixDisplay
)
from torch.utils.data import DataLoader, Subset
from datasets import load_dataset
from tqdm import tqdm

from preprocessing.transforms import get_transforms
from preprocessing.dataset import ForensicDataset
from model.model import SignalScopeBaseline
from model.config import Config

def evaluate():
    print("="*60)
    print(" SIGNALSCOPE: BASELINE EVALUATION")
    print("="*60)
    
    device = torch.device(Config.DEVICE)
    
    # 1. Load Validation Data (Same 500 samples used during training)
    print("[1] Loading Validation Data...")
    raw_ds = load_dataset("Rajarshi-Roy-research/Defactify_Image_Dataset", cache_dir=Config.DATA_DIR)
    transforms_dict = get_transforms()
    full_val = ForensicDataset(raw_ds['validation'], transform=transforms_dict['val'])
    val_subset = Subset(full_val, range(min(Config.MAX_VAL_SAMPLES, len(full_val))))
    val_loader = DataLoader(val_subset, batch_size=Config.BATCH_SIZE, shuffle=False, num_workers=Config.NUM_WORKERS)
    
    # 2. Load Model & Best Weights
    print(f"[2] Loading Best Weights from {Config.BEST_MODEL_PATH}")
    model = SignalScopeBaseline(backbone_name=Config.MODEL_NAME)
    
    # We use map_location to ensure it loads perfectly on CPU
    model.load_state_dict(torch.load(Config.BEST_MODEL_PATH, map_location=device, weights_only=True))
    model.to(device)
    model.eval() # Disable dropout and batchnorm updates
    
    # 3. Run Inference
    print("[3] Running Inference...")
    all_preds_prob = []
    all_labels = []
    
    with torch.no_grad():
        for images, labels in tqdm(val_loader, desc="Evaluating", leave=False):
            images = images.to(device)
            logits = model(images)
            probs = torch.sigmoid(logits)
            
            all_preds_prob.extend(probs.cpu().numpy())
            all_labels.extend(labels.cpu().numpy())
            
    # 4. Calculate Metrics (Default Threshold 0.5)
    print("\n[4] Calculating Metrics...")
    threshold = 0.5
    preds_binary = [1 if p >= threshold else 0 for p in all_preds_prob]
    
    auc = roc_auc_score(all_labels, all_preds_prob)
    mac_f1 = f1_score(all_labels, preds_binary, average='macro')
    acc = accuracy_score(all_labels, preds_binary)
    
    # Precision & Recall specifically for the AI class (1)
    prec = precision_score(all_labels, preds_binary, zero_division=0)
    rec = recall_score(all_labels, preds_binary, zero_division=0)
    
    # Unpack confusion matrix to get False Positive Rate
    tn, fp, fn, tp = confusion_matrix(all_labels, preds_binary).ravel()
    fpr = fp / (fp + tn) if (fp + tn) > 0 else 0.0
    
    metrics = {
        "AUC": float(auc),
        "Macro_F1": float(mac_f1),
        "Accuracy": float(acc),
        "Precision_AI": float(prec),
        "Recall_AI": float(rec),
        "False_Positive_Rate": float(fpr),
        "Threshold": float(threshold)
    }
    
    # Save to JSON for later comparison
    metrics_path = os.path.join(Config.REPORTS_DIR, "metrics.json")
    with open(metrics_path, "w") as f:
        json.dump(metrics, f, indent=4)
        
    print("\n--- PERFORMANCE SUMMARY ---")
    for k, v in metrics.items():
        print(f"{k.ljust(20)}: {v:.4f}")
        
    print("\n--- CLASSIFICATION REPORT ---")
    print(classification_report(all_labels, preds_binary, target_names=["Real (0)", "AI (1)"], zero_division=0))
    
    # 5. Generate Plots
    print("[5] Generating Plots...")
    
    # Confusion Matrix Plot
    cm = confusion_matrix(all_labels, preds_binary)
    disp = ConfusionMatrixDisplay(confusion_matrix=cm, display_labels=["Real", "AI"])
    disp.plot(cmap=plt.cm.Blues)
    plt.title(f"Confusion Matrix (Threshold={threshold})")
    plt.savefig(os.path.join(Config.REPORTS_DIR, "confusion_matrix.png"))
    plt.close()
    
    # ROC Curve Plot
    fpr_curve, tpr_curve, _ = roc_curve(all_labels, all_preds_prob)
    plt.figure()
    plt.plot(fpr_curve, tpr_curve, color='darkorange', lw=2, label=f'ROC curve (AUC = {auc:.3f})')
    plt.plot([0, 1], [0, 1], color='navy', lw=2, linestyle='--')
    plt.xlim([0.0, 1.0])
    plt.ylim([0.0, 1.05])
    plt.xlabel('False Positive Rate (Incorrectly called AI)')
    plt.ylabel('True Positive Rate (Correctly called AI)')
    plt.title('Receiver Operating Characteristic')
    plt.legend(loc="lower right")
    plt.savefig(os.path.join(Config.REPORTS_DIR, "roc_curve.png"))
    plt.close()
    
    print(f"Plots saved to {Config.REPORTS_DIR}")
    print("="*60)

if __name__ == "__main__":
    evaluate()