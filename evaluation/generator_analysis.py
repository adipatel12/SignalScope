import os
import torch
import pandas as pd
from torch.utils.data import DataLoader, Subset
from datasets import load_dataset
from sklearn.metrics import accuracy_score
from tqdm import tqdm

from preprocessing.transforms import get_transforms
from preprocessing.dataset import ForensicDataset
from model.model import SignalScopeBaseline
from model.config import Config

def analyze_generators():
    print("="*60)
    print(" SIGNALSCOPE: GENERATOR/SOURCE ANALYSIS")
    print("="*60)
    
    device = torch.device(Config.DEVICE)
    OPTIMAL_THRESHOLD = 0.55
    TEST_SUBSET_SIZE = 1000
    
    print(f"[1] Loading Test Data (Subset: {TEST_SUBSET_SIZE})...")
    raw_ds = load_dataset("Rajarshi-Roy-research/Defactify_Image_Dataset", cache_dir=Config.DATA_DIR)
    transforms_dict = get_transforms()
    full_test = ForensicDataset(raw_ds['test'], transform=transforms_dict['val'])
    test_subset = Subset(full_test, range(min(TEST_SUBSET_SIZE, len(full_test))))
    test_loader = DataLoader(test_subset, batch_size=Config.BATCH_SIZE, shuffle=False, num_workers=Config.NUM_WORKERS)
    
    print("[2] Loading Best Weights...")
    model = SignalScopeBaseline(backbone_name=Config.MODEL_NAME)
    model.load_state_dict(torch.load(Config.BEST_MODEL_PATH, map_location=device, weights_only=True))
    model.to(device)
    model.eval()
    
    # In addition to images and Label_A, we must fetch Label_B directly from the HuggingFace dataset
    # because our DataLoader currently only returns (image, Label_A).
    
    results = []
    
    print("[3] Running Inference and Mapping Sources...")
    with torch.no_grad():
        for batch_idx, (images, labels_a) in enumerate(tqdm(test_loader, desc="Analyzing", leave=False)):
            images = images.to(device)
            logits = model(images)
            probs = torch.sigmoid(logits).cpu().numpy()
            labels_a = labels_a.cpu().numpy()
            
            # Match the batch indices back to the Hugging Face dataset to extract Label_B
            start_idx = batch_idx * Config.BATCH_SIZE
            end_idx = start_idx + len(images)
            
            for i in range(len(images)):
                global_idx = start_idx + i
                label_b = raw_ds['test'][global_idx]['Label_B']
                prob = probs[i]
                pred = 1 if prob >= OPTIMAL_THRESHOLD else 0
                true_a = int(labels_a[i])
                
                results.append({
                    "True_A": true_a,       # 0 = Real, 1 = AI
                    "Label_B": label_b,     # Generator ID
                    "Prob_AI": prob,
                    "Pred": pred
                })
                
    # Convert to DataFrame for easy grouping
    df = pd.DataFrame(results)
    
    # Generator mapping (based on Defactify paper structure)
    source_map = {
        0: "Real (MS COCO)",
        1: "Stable Diffusion 2.1",
        2: "SDXL",
        3: "Stable Diffusion 3",
        4: "DALL-E 3",
        5: "Midjourney v6"
    }
    
    print("\n[4] Generating Breakdown Table...")
    analysis = []
    
    for source_id in sorted(df['Label_B'].unique()):
        subset = df[df['Label_B'] == source_id]
        
        # Calculate accuracy for this specific generator
        acc = accuracy_score(subset['True_A'], subset['Pred'])
        
        # Average probability the model assigned to this generator being AI
        avg_prob = subset['Prob_AI'].mean()
        
        analysis.append({
            "Source ID": source_id,
            "Generator": source_map.get(source_id, f"Unknown ({source_id})"),
            "Samples": len(subset),
            "Accuracy": f"{acc*100:.1f}%",
            "Avg AI Probability": f"{avg_prob:.4f}"
        })
        
    analysis_df = pd.DataFrame(analysis)
    
    # Save to Markdown for the final report
    md_path = os.path.join(Config.REPORTS_DIR, "generator_analysis.md")
    with open(md_path, "w") as f:
        f.write("# Generator Source Analysis (Baseline V1)\n\n")
        f.write(analysis_df.to_markdown(index=False))
        
    print("\n" + analysis_df.to_markdown(index=False))
    print(f"\n[!] Analysis saved to {md_path}")
    print("="*60)

if __name__ == "__main__":
    analyze_generators()