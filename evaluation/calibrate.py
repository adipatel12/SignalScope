import os
import random
import torch
import numpy as np
from sklearn.metrics import precision_recall_curve
from torch.utils.data import DataLoader, Subset
from tqdm import tqdm
from datasets import load_dataset

from model.config import Config
from model.model_v2 import SignalScopeFrequency
from preprocessing.dataset import ForensicDataset
from preprocessing.transforms import get_transforms

def calibrate_threshold():
    print("="*60)
    print(" SIGNALSCOPE: BALANCED THRESHOLD CALIBRATION")
    print("="*60)
    
    device = torch.device(Config.DEVICE)
    
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
    
    all_probs = []
    all_labels = []
    
    print("[3] Extracting Probabilities...")
    with torch.no_grad():
        for images, labels in tqdm(val_loader, desc="Scanning"):
            images = images.to(device)
            logits = model(images)
            probs = torch.sigmoid(logits).cpu().numpy()
            
            all_probs.extend(probs)
            all_labels.extend(labels.numpy())
            
    all_probs = np.array(all_probs)
    all_labels = np.array(all_labels)
    
    print("[4] Computing Optimal Decision Threshold...")
    precisions, recalls, thresholds = precision_recall_curve(all_labels, all_probs)
    
    f1_scores = (2 * precisions * recalls) / (precisions + recalls + 1e-8)
    optimal_idx = np.argmax(f1_scores)
    optimal_threshold = thresholds[optimal_idx]
    optimal_f1 = f1_scores[optimal_idx]
    
    print(f"\n--- Calibration Results ---")
    print(f"[*] Optimal Threshold  : {optimal_threshold:.4f}")
    print(f"[*] Maximum F1 Score   : {optimal_f1:.4f}")
    print(f"[*] Precision at Thresh: {precisions[optimal_idx]:.4f}")
    print(f"[*] Recall at Thresh   : {recalls[optimal_idx]:.4f}")
    print("============================================================")

if __name__ == "__main__":
    calibrate_threshold()