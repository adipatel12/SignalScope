import os
from collections import Counter
from datasets import load_dataset

def inspect():
    print("="*50)
    print(" SIGNALSCOPE: DATASET INSPECTION")
    print("="*50)
    print("Connecting to Hugging Face...")
    print("NOTE: If this is the first run, it will download the dataset.")
    print("This may take 10-20 minutes depending on your internet connection.")
    
    # Load dataset and cache it locally in our project folder
    dataset = load_dataset(
        "Rajarshi-Roy-research/Defactify_Image_Dataset", 
        cache_dir="./data"
    )
    
    # 1. Split Sizes
    print("\n[1] DATASET SPLITS")
    for split in dataset.keys():
        print(f" - {split.capitalize():<12}: {len(dataset[split]):,} samples")
        
    train_ds = dataset['train']
    print(f"\n[2] COLUMNS (Features)")
    print(f" - {train_ds.column_names}")
    
    # Extract labels quickly for counting
    # Note: We use train split for distribution analysis to avoid peeking at test data
    labels_a = train_ds['Label_A']
    labels_b = train_ds['Label_B']
    total_train = len(train_ds)
    
    # 2. Label A (Real vs AI)
    print("\n[3] LABEL A (REAL vs AI) - TRAINING SET")
    label_a_counts = Counter(labels_a)
    real_pct = (label_a_counts[0] / total_train) * 100
    ai_pct = (label_a_counts[1] / total_train) * 100
    
    print(f" - Real (0)       : {label_a_counts[0]:,} ({real_pct:.1f}%)")
    print(f" - AI-Generated(1): {label_a_counts[1]:,} ({ai_pct:.1f}%)")
    
    if abs(real_pct - ai_pct) < 10:
        print("   -> ASSESSMENT  : Classes are well balanced.")
    else:
        print("   -> ASSESSMENT  : Classes are imbalanced. We may need weighted loss later.")
        
    # 3. Label B (Generator Source)
    print("\n[4] LABEL B (GENERATORS/SOURCES) - TRAINING SET")
    label_b_counts = Counter(labels_b)
    for k, v in sorted(label_b_counts.items()):
        pct = (v / total_train) * 100
        print(f" - Source Class {k}: {v:>6,} samples ({pct:.1f}%)")
        
    # 4. Image Properties & Missing Values
    print("\n[5] IMAGE METADATA (First 5 Training Samples)")
    null_detected = False
    for i in range(5):
        sample = train_ds[i]
        img = sample['Image']
        
        # Check for missing crucial fields
        if sample['Label_A'] is None or img is None:
            null_detected = True
            
        print(f" - Sample {i}: Mode={img.mode}, Size={img.size} (WxH)")
        
    print("\n[6] INTEGRITY CHECK")
    if null_detected:
        print(" - WARNING: Missing values detected in early samples.")
    else:
        print(" - SUCCESS: Schema enforced by Hugging Face. No obvious nulls.")
    print("="*50)

if __name__ == '__main__':
    inspect()