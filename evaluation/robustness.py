import os
import torch
import io
import pandas as pd
from PIL import Image, ImageFilter
from torch.utils.data import DataLoader, Subset
from datasets import load_dataset
from sklearn.metrics import roc_auc_score, f1_score, accuracy_score
from tqdm import tqdm

from preprocessing.transforms import get_transforms
from preprocessing.dataset import ForensicDataset
from model.model import SignalScopeBaseline
from model.config import Config

# --- Custom Degradation Functions ---
def apply_jpeg_compression(img, quality=60):
    """Simulates social media image compression."""
    buffer = io.BytesIO()
    img.save(buffer, "JPEG", quality=quality)
    buffer.seek(0)
    return Image.open(buffer)

def apply_blur(img, radius=2):
    """Simulates a slightly out-of-focus or downscaled image."""
    return img.filter(ImageFilter.GaussianBlur(radius))

# --- Custom Dataset Wrapper ---
class RobustnessDataset(ForensicDataset):
    def __init__(self, hf_dataset, transform=None, degradation=None):
        super().__init__(hf_dataset, transform)
        self.degradation = degradation

    def __getitem__(self, idx):
        item = self.hf_dataset[idx]
        image = item['Image'].convert("RGB")
        label = torch.tensor(item['Label_A'], dtype=torch.float32)
        
        # Apply degradation BEFORE PyTorch transforms (resizing/tensors)
        if self.degradation == "jpeg":
            image = apply_jpeg_compression(image)
        elif self.degradation == "blur":
            image = apply_blur(image)
            
        if self.transform:
            image = self.transform(image)
            
        return image, label

def run_robustness_test():
    print("="*60)
    print(" SIGNALSCOPE: ROBUSTNESS EXPERIMENTS")
    print("="*60)
    
    device = torch.device(Config.DEVICE)
    OPTIMAL_THRESHOLD = 0.55
    VAL_SUBSET_SIZE = 500 # We use Validation set because Test set already failed 
    
    raw_ds = load_dataset("Rajarshi-Roy-research/Defactify_Image_Dataset", cache_dir=Config.DATA_DIR)
    transforms_dict = get_transforms()
    
    print("[1] Loading Best Model Weights...")
    model = SignalScopeBaseline(backbone_name=Config.MODEL_NAME)
    model.load_state_dict(torch.load(Config.BEST_MODEL_PATH, map_location=device, weights_only=True))
    model.to(device)
    model.eval()
    
    conditions = ["original", "jpeg", "blur"]
    results = []
    
    for condition in conditions:
        print(f"\n[2] Testing Condition: {condition.upper()}")
        
        # Create dataset with specific degradation
        degrad_ds = RobustnessDataset(
            raw_ds['validation'], 
            transform=transforms_dict['val'], 
            degradation=condition if condition != "original" else None
        )
        
        subset = Subset(degrad_ds, range(min(VAL_SUBSET_SIZE, len(degrad_ds))))
        loader = DataLoader(subset, batch_size=Config.BATCH_SIZE, shuffle=False, num_workers=Config.NUM_WORKERS)
        
        all_preds_prob = []
        all_labels = []
        
        with torch.no_grad():
            for images, labels in tqdm(loader, desc=f"Evaluating {condition}", leave=False):
                images = images.to(device)
                logits = model(images)
                probs = torch.sigmoid(logits)
                
                all_preds_prob.extend(probs.cpu().numpy())
                all_labels.extend(labels.cpu().numpy())
                
        preds_binary = [1 if p >= OPTIMAL_THRESHOLD else 0 for p in all_preds_prob]
        
        try:
            auc = roc_auc_score(all_labels, all_preds_prob)
        except ValueError:
            auc = 0.5
            
        mac_f1 = f1_score(all_labels, preds_binary, average='macro', zero_division=0)
        acc = accuracy_score(all_labels, preds_binary)
        
        results.append({
            "Condition": condition.capitalize(),
            "AUC": f"{auc:.4f}",
            "Macro-F1": f"{mac_f1:.4f}",
            "Accuracy": f"{acc:.4f}"
        })
        
    print("\n[3] Robustness Results:")
    df = pd.DataFrame(results)
    
    # Save to Markdown
    md_path = os.path.join(Config.REPORTS_DIR, "robustness.md")
    with open(md_path, "w") as f:
        f.write("# Robustness Analysis (Baseline V1)\n\n")
        f.write(df.to_markdown(index=False))
        
    print("\n" + df.to_markdown(index=False))
    print(f"\n[!] Report saved to {md_path}")
    print("="*60)

if __name__ == "__main__":
    run_robustness_test()