from torchvision import transforms

def get_transforms():
    """
    Returns a dictionary of forensic-safe transformations for train and val/test sets.
    """
    # ImageNet statistics required by almost all timm pretrained backbones
    mean = [0.485, 0.456, 0.406]
    std = [0.229, 0.224, 0.225]

    return {
        "train": transforms.Compose([
            # 1. Resize slightly larger than target to allow cropping
            transforms.Resize((256, 256)),
            # 2. Random crop to 224x224. Safe for forensics as it preserves original pixel scale
            transforms.RandomCrop((224, 224)),
            # 3. Horizontal flip. Completely safe, doesn't destroy generation artifacts
            transforms.RandomHorizontalFlip(p=0.5),
            # 4. Mild brightness/contrast changes. Safe. 
            # (Do NOT use GaussianBlur or JPEG compression here, we save that for robustness testing)
            transforms.ColorJitter(brightness=0.1, contrast=0.1),
            # 5. Convert to PyTorch Tensor (scales pixels from 0-255 to 0.0-1.0)
            transforms.ToTensor(),
            # 6. Normalize using ImageNet stats
            transforms.Normalize(mean=mean, std=std)
        ]),
        
        "val": transforms.Compose([
            # Validation/Test must be deterministic. No randomness.
            transforms.Resize((256, 256)),
            transforms.CenterCrop((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize(mean=mean, std=std)
        ])
    }