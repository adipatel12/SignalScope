import torch
from torch.utils.data import Dataset, DataLoader
from datasets import load_dataset
from preprocessing.transforms import get_transforms

class ForensicDataset(Dataset):
    def __init__(self, hf_dataset, transform=None):
        """
        Args:
            hf_dataset: The Hugging Face dataset split (e.g., dataset['train'])
            transform: torchvision transforms to apply to the images
        """
        self.hf_dataset = hf_dataset
        self.transform = transform

    def __len__(self):
        return len(self.hf_dataset)

    def __getitem__(self, idx):
        # Fetch the row from Hugging Face
        item = self.hf_dataset[idx]
        
        # 1. Extract the PIL Image and ensure it is RGB
        # (Some images might be Grayscale or RGBA, which crashes CNNs expecting 3 channels)
        image = item['Image'].convert("RGB")
        
        # 2. Extract Label_A (0 for Real, 1 for AI-generated)
        # We enforce it as a float32 tensor because we will use BCEWithLogitsLoss later
        label = torch.tensor(item['Label_A'], dtype=torch.float32)
        
        # 3. Apply transformations
        if self.transform:
            image = self.transform(image)
            
        return image, label

if __name__ == "__main__":
    print("="*50)
    print(" SIGNALSCOPE: PIPELINE TEST")
    print("="*50)
    
    # 1. Load Hugging Face dataset (will load instantly from cache)
    print("Loading cached dataset...")
    raw_ds = load_dataset("Rajarshi-Roy-research/Defactify_Image_Dataset", cache_dir="./data")
    
    # 2. Get our transforms
    transforms_dict = get_transforms()
    
    # 3. Wrap in our custom PyTorch Dataset
    train_dataset = ForensicDataset(raw_ds['train'], transform=transforms_dict['train'])
    
    # 4. Create a DataLoader
    # We use num_workers=0 on Windows to prevent multiprocessing freezing during tests
    # Batch size 16 is safe for CPU memory
    train_loader = DataLoader(train_dataset, batch_size=16, shuffle=True, num_workers=0)
    
    print(f"Total training batches: {len(train_loader)}")
    
    # 5. Fetch exactly ONE batch to prove it works
    print("Fetching one batch...")
    images, labels = next(iter(train_loader))
    
    print("\n[BATCH VERIFICATION]")
    print(f"Image Batch Shape: {images.shape} (Batch, Channels, Height, Width)")
    print(f"Label Batch Shape: {labels.shape}")
    print(f"First 5 Labels   : {labels[:5].tolist()}")
    print("="*50)
    print("SUCCESS! Data Pipeline is ready for the neural network.")