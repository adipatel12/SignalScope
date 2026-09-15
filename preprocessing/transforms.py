from torchvision import transforms

def get_transforms():
    """
    Returns a dictionary of forensic-safe transformations.
    Removes destructive resizing to preserve high-frequency AI artifacts.
    """
    mean = [0.485, 0.456, 0.406]
    std = [0.229, 0.224, 0.225]

    return {
        "train": transforms.Compose([
            # 1. Pad images smaller than 224 to avoid crash, but DO NOT resize
            transforms.Pad(padding=0, fill=0, padding_mode='constant'), 
            transforms.RandomCrop((224, 224), pad_if_needed=True),
            
            # 2. Discrete, safe geometric transforms
            transforms.RandomHorizontalFlip(p=0.5),
            
            # 3. Photometric shifts (Safe for FFT phase relationships)
            transforms.ColorJitter(brightness=0.1, contrast=0.1),
            
            # 4. Standard Tensor conversion and normalization
            transforms.ToTensor(),
            transforms.Normalize(mean=mean, std=std)
        ]),
        
        "val": transforms.Compose([
            # Deterministic, pure center crop directly from native resolution
            transforms.CenterCrop((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize(mean=mean, std=std)
        ])
    }