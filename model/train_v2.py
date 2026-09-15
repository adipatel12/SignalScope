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
    """Loads images from a folder and assigns them a specific label (0.0 for Real, 1.0 for AI)."""
    def __init__(self, image_paths, label_value, transform=None):
        self.image_paths = image_paths
        self.label_value = label_value
        self.transform = transform

    def __len__(self):
        return len(self.image_paths)

    def __getitem__(self, idx):
        img_path = self.image_paths[idx]
        image = Image.open(img_path).convert("RGB")
        label = torch.tensor(self.label_value, dtype=torch.float32)
        
        if self.transform:
            image = self.transform(image)
        return image, label

def create_balanced_subset(hf_dataset, raw_split, target_total):
    label_col = 'Label_A' if 'Label_A' in raw_split.column_names else 'label'
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
    
    train_subset, n_real, n_ai = create_balanced_subset(hf_train, raw_ds['train'], Config.MAX_TRAIN_SAMPLES)
    val_subset, val_real, val_ai = create_balanced_subset(hf_val, raw_ds['validation'], Config.MAX_VAL_SAMPLES)
    
    print(f"[*] Balanced Train Partition: {n_real} Real, {n_ai} AI")
    print(f"[*] Balanced Val Partition  : {val_real} Real, {val_ai} AI")
    
    datasets_to_concat = [train_subset]
    patterns = ["**/*.jpg", "**/*.jpeg", "**/*.png", "**/*.JPG", "**/*.JPEG", "**/*.PNG"]
    
    # ---------------------------------------------------------
    # INJECT HARD NEGATIVES (Physical Grids/Windows -> Label 0.0)
    # ---------------------------------------------------------
    hn_dir = os.path.join(Config.DATA_DIR, "hard_negatives")
    if os.path.exists(hn_dir):
        hn_paths = []
        for pat in patterns:
            hn_paths.extend(glob.glob(os.path.join(hn_dir, pat), recursive=True))
        if hn_paths:
            print(f"[!] Injecting {len(hn_paths)} Hard NEGATIVES (Label 0.0)...")
            datasets_to_concat.append(CustomImageDataset(hn_paths, 0.0, transforms_dict['train']))
            
    # ---------------------------------------------------------
    # INJECT HARD POSITIVES (Digital Art/Cyberpunk -> Label 1.0)
    # ---------------------------------------------------------
    hp_dir = os.path.join(Config.DATA_DIR, "hard_positives")
    if os.path.exists(hp_dir):
        hp_paths = []
        for pat in patterns:
            hp_paths.extend(glob.glob(os.path.join(hp_dir, pat), recursive=True))
        if hp_paths:
            print(f"[!] Injecting {len(hp_paths)} Hard POSITIVES (Label 1.0)...")
            datasets_to_concat.append(CustomImageDataset(hp_paths, 1.0, transforms_dict['train']))

    final_train = ConcatDataset(datasets_to_concat)

    train_loader = DataLoader(final_train, batch_size=Config.BATCH_SIZE, shuffle=True, num_workers=Config.NUM_WORKERS)
    val_loader = DataLoader(val_subset, batch_size=Config.BATCH_SIZE, shuffle=False, num_workers=Config.NUM_WORKERS)
    
    print(f"[2] Data ready: Train({len(final_train)} samples), Val({len(val_subset)} samples)")
    return train_loader, val_loader

def train_v2():
    print("="*60)
    print(f" SIGNALSCOPE: BASELINE V2 (FREQUENCY) TRAINING ({Config.DEVICE.upper()})")
    print("="*60)
    
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    train_loader, val_loader = create_subset_loaders()
    
    print("[3] Initializing Dual-Stream Model...")
    model = SignalScopeFrequency(backbone_name=Config.MODEL_NAME).to(device)
    
    v2_save_path = os.path.join(Config.WEIGHTS_DIR, "baseline_v2_best.pth")
    if os.path.exists(v2_save_path):
        print(f"[*] Loading pre-trained checkpoint to fine-tune...")
        model.load_state_dict(torch.load(v2_save_path, map_location=device, weights_only=True))

    optimizer = optim.AdamW(model.parameters(), lr=Config.LEARNING_RATE, weight_decay=Config.WEIGHT_DECAY)
    scheduler = optim.lr_scheduler.ReduceLROnPlateau(optimizer, mode='min', patience=1, factor=0.5)
    criterion = nn.BCEWithLogitsLoss()
        
    best_val_auc = 0.0
    epochs_no_improve = 0
    
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
            torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
            optimizer.step()
            running_loss += loss.item()
            train_bar.set_postfix(loss=f"{loss.item():.4f}")
            
        epoch_loss = running_loss / len(train_loader)
        val_loss, val_auc, val_f1, val_acc = validate(model, val_loader, criterion, device)
        scheduler.step(val_loss)
        
        print(f"\n--- Epoch {epoch} Results ---")
        print(f"Val AUC: {val_auc:.4f} | Val F1: {val_f1:.4f}")
        
        if val_auc > best_val_auc:
            best_val_auc = val_auc
            epochs_no_improve = 0
            print(f"[*] Saved updated weights!")
            torch.save(model.state_dict(), v2_save_path)
        else:
            epochs_no_improve += 1
            
        if epochs_no_improve >= Config.PATIENCE:
            print(f"\n[!] Early stopping at epoch {epoch}.")
            break

if __name__ == "__main__":
    train_v2()