import os
import random
import torch
import numpy as np
from sklearn.metrics import precision_score, recall_score, f1_score
from sklearn.linear_model import LogisticRegression
from torch.utils.data import DataLoader, Subset
from tqdm import tqdm
from datasets import load_dataset

from model.config import Config
from model.model_v2 import SignalScopeFrequency
from preprocessing.dataset import ForensicDataset
from preprocessing.transforms import get_transforms

def calibrate_threshold():
    print("="*60)
    print(" SIGNALSCOPE: PLATT SCALING CALIBRATION")
    print("="*60)
    
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    
    print("[1] Loading Validation Data...")
    raw_ds = load_dataset("Rajarshi-Roy-research/Defactify_Image_Dataset", cache_dir=Config.DATA_DIR)
    transforms_dict = get_transforms()
    hf_val = ForensicDataset(raw_ds['validation'], transform=transforms_dict['val'])
    
    # Balanced 1:1 Validation Sampling
    raw_split = raw_ds['validation']
    label_col = 'Label_A' if 'Label_A' in raw_split.column_names else 'label'
    labels = raw_split[label_col]
    
    real_indices = [i for i, label in enumerate(labels) if label == 0]
    ai_indices = [i for i, label in enumerate(labels) if label == 1]
    
    target_per_class = min(1000, len(real_indices), len(ai_indices))
    
    random.seed(42)
    selected_indices = random.sample(real_indices, target_per_class) + random.sample(ai_indices, target_per_class)
    random.shuffle(selected_indices)
    
    val_subset = Subset(hf_val, selected_indices)
    val_loader = DataLoader(val_subset, batch_size=Config.BATCH_SIZE, shuffle=False, num_workers=Config.NUM_WORKERS)
    print(f"[*] Calibrating on {len(val_subset)} balanced samples ({target_per_class} Real / {target_per_class} AI)...")
    
    print("[2] Loading Retrained V2 Best Weights...")
    model = SignalScopeFrequency(backbone_name=Config.MODEL_NAME).to(device)
    weights_path = os.path.join(Config.WEIGHTS_DIR, "baseline_v2_best.pth")
    model.load_state_dict(torch.load(weights_path, map_location=device, weights_only=True))
    model.eval()
    
    all_logits = []
    all_labels = []
    
    print("[3] Extracting Raw Logits...")
    with torch.no_grad():
        for images, labels in tqdm(val_loader, desc="Scanning"):
            images = images.to(device)
            # Extract RAW logits, not sigmoid probabilities
            logits = model(images).squeeze(-1) 
            
            # Ensure it is a 1D array before extending
            if logits.ndim == 0:
                logits = logits.unsqueeze(0)
                
            all_logits.extend(logits.cpu().numpy())
            all_labels.extend(labels.numpy())
            
    # [4] Platt Scaling (Logistic Regression)
    print("[4] Fitting Platt Scaling (Logistic Regression)...")
    X = np.array(all_logits).reshape(-1, 1)
    y = np.array(all_labels)
    
    calibrator = LogisticRegression(solver='lbfgs')
    calibrator.fit(X, y)
    
    w = calibrator.coef_[0][0]
    b = calibrator.intercept_[0]
    
    # Test the recalibrated probabilities at the standard 0.50 threshold
    calibrated_probs = 1.0 / (1.0 + np.exp(-(w * X.flatten() + b)))
    preds = (calibrated_probs >= 0.50).astype(int)
    
    f1 = f1_score(y, preds)
    prec = precision_score(y, preds)
    rec = recall_score(y, preds)
    
    print("\n--- Calibration Results ---")
    print(f"[*] Calibration Weight (w): {w:.4f}")
    print(f"[*] Calibration Bias (b)  : {b:.4f}")
    print(f"[*] F1 Score at 0.50      : {f1:.4f}")
    print(f"[*] Precision at 0.50     : {prec:.4f}")
    print(f"[*] Recall at 0.50        : {rec:.4f}")
    print("============================================================")

if __name__ == "__main__":
    calibrate_threshold()