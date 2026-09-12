import os
import time
import glob
import random
import torch
import torch.nn as nn
import torch.optim as optim
from PIL import Image
from torch.utils.data import DataLoader, Subset, ConcatDataset, Dataset
from datasets import load_dataset
from tqdm import tqdm

from preprocessing.dataset import ForensicDataset
from preprocessing.transforms import get_transforms
from model.config import Config
from model.model_v2 import SignalScopeFrequency
from model.train import validate 

class CustomImageDataset(Dataset):
    """Loads personal smartphone photos as verified Real (Label 0.0) images."""
    def __init__(self, image_paths, transform=None):
        self.image_paths = image_paths
        self.transform = transform

    def __len__(self):
        return len(self.image_paths)

    def __getitem__(self, idx):
        img_path = self.image_paths[idx]
        image = Image.open(img_path).convert("RGB")
        label = torch.tensor(0.0, dtype=torch.float32)
        
        if self.transform:
            image = self.transform(image)
        return image, label

def create_balanced_subset(hf_dataset, raw_split, target_total):
    """
    Samples an exact 50/50 split of Real (0) and AI (1) items using metadata indices.
    """
    # Auto-detect the exact column name used by the Defactify dataset (Label_A)
    label_col = 'Label_A' if 'Label_A' in raw_split.column_names else 'label'
    
    # Extract the labels using the correct key
    labels = raw_split[label_col]
    
    real_indices = [i for i, label in enumerate(labels) if label == 0]
    ai_indices = [i for i, label in enumerate(labels) if label == 1]
    
    target_per_class = target_total // 2
    
    selected_real = random.sample(real_indices, min(target_per_class, len(real_indices)))
    selected_ai = random.sample(ai_indices, min(target_per_class, len(ai_indices)))
    
    balanced_indices = selected_real + selected_ai
    random.shuffle(balanced_indices)
    
    return Subset(hf_dataset, balanced_indices), len(selected_real), len(selected_ai)

def create_subset_loaders():
    print("[1] Loading cached Hugging Face dataset...")
    raw_ds = load_dataset("Rajarshi-Roy-research/Defactify_Image_Dataset", cache_dir=Config.DATA_DIR)
    transforms_dict = get_transforms()
    
    hf_train = ForensicDataset(raw_ds['train'], transform=transforms_dict['train'])
    hf_val = ForensicDataset(raw_ds['validation'], transform=transforms_dict['val'])
    
    # 50/50 Balanced Sampling
    train_subset, n_real, n_ai = create_balanced_subset(hf_train, raw_ds['train'], Config.MAX_TRAIN_SAMPLES)
    val_subset, val_real, val_ai = create_balanced_subset(hf_val, raw_ds['validation'], Config.MAX_VAL_SAMPLES)
    
    print(f"[*] Balanced Train Partition: {n_real} Real, {n_ai} AI")
    print(f"[*] Balanced Val Partition  : {val_real} Real, {val_ai} AI")
    
    # Inject Custom Hard Negatives (Smartphone Photos)
    hard_negative_dir = os.path.join(Config.DATA_DIR, "hard_negatives")
    if os.path.exists(hard_negative_dir):
        patterns = ["*.jpg", "*.jpeg", "*.png", "*.JPG", "*.JPEG", "*.PNG"]
        image_paths = []
        for pat in patterns:
            image_paths.extend(glob.glob(os.path.join(hard_negative_dir, pat)))
            
        if image_paths:
            print(f"[!] Injecting {len(image_paths)} custom Hard Negatives into training pool...")
            custom_train = CustomImageDataset(image_paths, transform=transforms_dict['train'])
            final_train = ConcatDataset([train_subset, custom_train])
        else:
            final_train = train_subset
    else:
        final_train = train_subset

    train_loader = DataLoader(
        final_train, 
        batch_size=Config.BATCH_SIZE, 
        shuffle=True, 
        num_workers=Config.NUM_WORKERS
    )
    val_loader = DataLoader(
        val_subset, 
        batch_size=Config.BATCH_SIZE, 
        shuffle=False, 
        num_workers=Config.NUM_WORKERS
    )
    
    print(f"[2] Data ready: Train({len(final_train)} samples), Val({len(val_subset)} samples)")
    return train_loader, val_loader

def train_v2():
    print("="*60)
    print(f" SIGNALSCOPE: BASELINE V2 (FREQUENCY) TRAINING ({Config.DEVICE.upper()})")
    print("="*60)
    
    device = torch.device(Config.DEVICE)
    train_loader, val_loader = create_subset_loaders()
    
    print("[3] Initializing Dual-Stream Model with Frequency Normalization...")
    model = SignalScopeFrequency(backbone_name=Config.MODEL_NAME).to(device)
    
    optimizer = optim.AdamW(model.parameters(), lr=Config.LEARNING_RATE, weight_decay=Config.WEIGHT_DECAY)
    scheduler = optim.lr_scheduler.ReduceLROnPlateau(optimizer, mode='min', patience=1, factor=0.5)
    
    # Use unweighted loss when training on balanced data
    if getattr(Config, 'POS_WEIGHT', None) is not None:
        pos_weight = torch.tensor([Config.POS_WEIGHT], dtype=torch.float32).to(device)
        criterion = nn.BCEWithLogitsLoss(pos_weight=pos_weight)
        print(f"[*] Applying loss pos_weight: {Config.POS_WEIGHT}")
    else:
        criterion = nn.BCEWithLogitsLoss()
        print("[*] Dataset balanced 1:1. Using standard BCEWithLogitsLoss (no pos_weight).")
        
    best_val_auc = 0.0
    epochs_no_improve = 0
    v2_save_path = os.path.join(Config.WEIGHTS_DIR, "baseline_v2_best.pth")
    
    for epoch in range(1, Config.EPOCHS + 1):
        start_time = time.time()
        model.train()
        running_loss = 0.0
        
        train_bar = tqdm(train_loader, desc=f"Epoch {epoch}/{Config.EPOCHS} [Train]")
        for images, labels in train_bar:
            images, labels = images.to(device), labels.to(device)
            
            optimizer.zero_grad()
            logits = model(images)
            loss = criterion(logits, labels)
            loss.backward()
            
            # Gradient clipping to stabilize FFT stream backpropagation
            torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
            
            optimizer.step()
            running_loss += loss.item()
            train_bar.set_postfix(loss=f"{loss.item():.4f}")
            
        epoch_loss = running_loss / len(train_loader)
        val_loss, val_auc, val_f1, val_acc = validate(model, val_loader, criterion, device)
        scheduler.step(val_loss)
        
        elapsed = time.time() - start_time
        print(f"\n--- Epoch {epoch} Results ({elapsed:.1f}s) ---")
        print(f"Train Loss: {epoch_loss:.4f} | Val Loss: {val_loss:.4f}")
        print(f"Val AUC   : {val_auc:.4f} | Val F1: {val_f1:.4f} | Val Acc: {val_acc:.4f}")
        
        if val_auc > best_val_auc:
            best_val_auc = val_auc
            epochs_no_improve = 0
            print(f"[*] New best V2 AUC! Saving weights to {v2_save_path}")
            torch.save(model.state_dict(), v2_save_path)
        else:
            epochs_no_improve += 1
            print(f"[!] No improvement for {epochs_no_improve}/{Config.PATIENCE} epochs.")
            
        if epochs_no_improve >= Config.PATIENCE:
            print(f"\n[!] Early stopping triggered at epoch {epoch}.")
            break
            
    print("="*60)
    print(" Training sequence complete. Proceed to calibration.")
    print("="*60)

if __name__ == "__main__":
    train_v2()