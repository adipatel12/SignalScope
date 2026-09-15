import os
import torch
from torch.utils.data import DataLoader, Subset
from datasets import load_dataset
from tqdm import tqdm
import torchvision.transforms.v2 as v2
from sklearn.metrics import roc_auc_score, f1_score, accuracy_score

from model.config import Config
from model.model_v2 import SignalScopeFrequency
from preprocessing.dataset import ForensicDataset

# Platt Calibration Constants (From your previous calibration)
CALIBRATION_W = 0.3470
CALIBRATION_B = -1.1228

def get_compression_transforms(quality_factor):
    """
    Returns validation transforms with simulated JPEG compression injected
    before the tensor conversion.
    """
    mean = [0.485, 0.456, 0.406]
    std = [0.229, 0.224, 0.225]
    
    return v2.Compose([
        v2.CenterCrop((224, 224)),
        # Apply simulated social media compression 
        v2.JPEG(quality=quality_factor),
        v2.ToImage(),
        v2.ToDtype(torch.float32, scale=True),
        v2.Normalize(mean=mean, std=std)
    ])

def evaluate_compression(quality_factor):
    print(f"\n============================================================")
    print(f" TESTING COMPRESSION ROBUSTNESS: JPEG Quality {quality_factor}")
    print(f"============================================================")
    
    device = torch.device(Config.DEVICE)
    
    raw_ds = load_dataset("Rajarshi-Roy-research/Defactify_Image_Dataset", cache_dir=Config.DATA_DIR)
    transforms = get_compression_transforms(quality_factor)
    hf_val = ForensicDataset(raw_ds['validation'], transform=transforms)
    
    # Take a fast 1,000 image slice for quick benchmarking
    val_subset = Subset(hf_val, list(range(1000)))
    val_loader = DataLoader(val_subset, batch_size=Config.BATCH_SIZE, shuffle=False, num_workers=Config.NUM_WORKERS)
    
    model = SignalScopeFrequency(backbone_name=Config.MODEL_NAME).to(device)
    model.load_state_dict(torch.load(os.path.join(Config.WEIGHTS_DIR, "baseline_v2_best.pth"), map_location=device, weights_only=True))
    model.eval()
    
    all_probs = []
    all_labels = []
    
    with torch.no_grad():
        for images, labels in tqdm(val_loader, desc=f"Evaluating QF {quality_factor}"):
            images = images.to(device)
            raw_logits = model(images).squeeze(-1)
            
            # Apply Platt Scaling to match API outputs
            calibrated_logits = (CALIBRATION_W * raw_logits) + CALIBRATION_B
            probs = torch.sigmoid(calibrated_logits).cpu().numpy()
            
            # Handle single-item batch squeezing issues
            if probs.ndim == 0:
                probs = [probs.item()]
                
            all_probs.extend(probs)
            all_labels.extend(labels.numpy())
            
    # Binary predictions using your optimal balanced 0.50 threshold
    preds = [1 if p >= 0.50 else 0 for p in all_probs]
    
    auc = roc_auc_score(all_labels, all_probs)
    f1 = f1_score(all_labels, preds)
    acc = accuracy_score(all_labels, preds)
    
    print(f"\n[*] Results for JPEG QF {quality_factor}:")
    print(f"    - Accuracy : {acc:.4f}")
    print(f"    - F1 Score : {f1:.4f}")
    print(f"    - ROC-AUC  : {auc:.4f}")

if __name__ == "__main__":
    # Test across three degradation tiers
    for qf in [95, 70, 50]:
        evaluate_compression(qf)