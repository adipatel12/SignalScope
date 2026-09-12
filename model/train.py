import os
import ssl
import time
import pandas as pd
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, Subset
from datasets import load_dataset
from sklearn.metrics import roc_auc_score, f1_score, accuracy_score
from tqdm import tqdm

# Fix for potential Windows SSL certificate issues when downloading pretrained weights
ssl._create_default_https_context = ssl._create_unverified_context

# Import our custom modules
from preprocessing.transforms import get_transforms
from preprocessing.dataset import ForensicDataset
from model.model import SignalScopeBaseline
from model.config import Config

def create_subset_loaders():
    """Loads data and creates restricted subsets for CPU training."""
    print("[1] Loading cached Hugging Face dataset...")
    raw_ds = load_dataset("Rajarshi-Roy-research/Defactify_Image_Dataset", cache_dir=Config.DATA_DIR)
    
    transforms_dict = get_transforms()
    
    full_train = ForensicDataset(raw_ds['train'], transform=transforms_dict['train'])
    full_val = ForensicDataset(raw_ds['validation'], transform=transforms_dict['val'])
    
    # Restrict dataset size for CPU sanity
    print(f"[2] Subsetting data for CPU: Train({Config.MAX_TRAIN_SAMPLES}), Val({Config.MAX_VAL_SAMPLES})")
    train_subset = Subset(full_train, range(min(Config.MAX_TRAIN_SAMPLES, len(full_train))))
    val_subset = Subset(full_val, range(min(Config.MAX_VAL_SAMPLES, len(full_val))))
    
    train_loader = DataLoader(train_subset, batch_size=Config.BATCH_SIZE, shuffle=True, num_workers=Config.NUM_WORKERS)
    val_loader = DataLoader(val_subset, batch_size=Config.BATCH_SIZE, shuffle=False, num_workers=Config.NUM_WORKERS)
    
    return train_loader, val_loader

def validate(model, val_loader, criterion, device):
    """Evaluates the model on the validation set."""
    model.eval()
    val_loss = 0.0
    all_preds_prob = []
    all_labels = []
    
    with torch.no_grad():
        for images, labels in tqdm(val_loader, desc="Validating", leave=False):
            images, labels = images.to(device), labels.to(device)
            
            logits = model(images)
            loss = criterion(logits, labels)
            val_loss += loss.item()
            
            probs = torch.sigmoid(logits)
            all_preds_prob.extend(probs.cpu().numpy())
            all_labels.extend(labels.cpu().numpy())
            
    avg_loss = val_loss / len(val_loader)
    
    # Calculate metrics
    # Threshold = 0.5 for initial validation (we optimize this in Stage 9)
    preds_binary = [1 if p >= 0.5 else 0 for p in all_preds_prob]
    
    try:
        auc = roc_auc_score(all_labels, all_preds_prob)
    except ValueError:
        auc = 0.5 # Fallback if batch only contains one class
        
    f1 = f1_score(all_labels, preds_binary, average='macro')
    acc = accuracy_score(all_labels, preds_binary)
    
    return avg_loss, auc, f1, acc

def train():
    print("="*60)
    print(f" SIGNALSCOPE: BASELINE V1 TRAINING ({Config.DEVICE.upper()})")
    print("="*60)
    
    device = torch.device(Config.DEVICE)
    train_loader, val_loader = create_subset_loaders()
    
    print("[3] Initializing model and optimizer...")
    model = SignalScopeBaseline(backbone_name=Config.MODEL_NAME).to(device)
    
    # Optimizer & Scheduler
    optimizer = optim.AdamW(model.parameters(), lr=Config.LEARNING_RATE, weight_decay=Config.WEIGHT_DECAY)
    # Reduces learning rate if validation loss stops improving
    scheduler = optim.lr_scheduler.ReduceLROnPlateau(optimizer, mode='min', patience=1, factor=0.5)
    
    # Loss Function — handles both weighted and balanced (None) modes
    if getattr(Config, 'POS_WEIGHT', None) is not None:
        pos_weight = torch.tensor([Config.POS_WEIGHT], dtype=torch.float32).to(device)
        criterion = nn.BCEWithLogitsLoss(pos_weight=pos_weight)
    else:
        criterion = nn.BCEWithLogitsLoss()
    
    best_val_auc = 0.0
    epochs_no_improve = 0
    history = []
    
    print("\n[4] Starting Training Loop...")
    for epoch in range(1, Config.EPOCHS + 1):
        start_time = time.time()
        
        # --- TRAINING PHASE ---
        model.train()
        train_loss = 0.0
        
        # We use tqdm for a nice progress bar in the terminal
        train_bar = tqdm(train_loader, desc=f"Epoch {epoch}/{Config.EPOCHS} [Train]")
        for images, labels in train_bar:
            images, labels = images.to(device), labels.to(device)
            
            optimizer.zero_grad()
            logits = model(images)
            loss = criterion(logits, labels)
            
            loss.backward()
            optimizer.step()
            
            train_loss += loss.item()
            train_bar.set_postfix({'loss': f"{loss.item():.4f}"})
            
        avg_train_loss = train_loss / len(train_loader)
        
        # --- VALIDATION PHASE ---
        val_loss, val_auc, val_f1, val_acc = validate(model, val_loader, criterion, device)
        scheduler.step(val_loss)
        
        epoch_time = time.time() - start_time
        
        print(f"\n--- Epoch {epoch} Results ({epoch_time:.0f}s) ---")
        print(f"Train Loss : {avg_train_loss:.4f} | Val Loss: {val_loss:.4f}")
        print(f"Val AUC    : {val_auc:.4f} | Val F1  : {val_f1:.4f} | Val Acc: {val_acc:.4f}")
        
        # Save history
        history.append({
            'epoch': epoch,
            'train_loss': avg_train_loss,
            'val_loss': val_loss,
            'val_auc': val_auc,
            'val_f1': val_f1,
            'val_acc': val_acc
        })
        
        # --- CHECKPOINTING ---
        if val_auc > best_val_auc:
            best_val_auc = val_auc
            epochs_no_improve = 0
            print(f"[*] New best AUC! Saving model to {Config.BEST_MODEL_PATH}")
            torch.save(model.state_dict(), Config.BEST_MODEL_PATH)
        else:
            epochs_no_improve += 1
            
        # Early Stopping
        if epochs_no_improve >= Config.PATIENCE:
            print(f"\n[!] Early stopping triggered after {epoch} epochs.")
            break
            
    # Save training history to CSV for the final report
    history_df = pd.DataFrame(history)
    history_csv_path = os.path.join(Config.REPORTS_DIR, "training_history.csv")
    history_df.to_csv(history_csv_path, index=False)
    print(f"\n[5] Training complete. History saved to {history_csv_path}")
    print("="*60)

if __name__ == "__main__":
    train()