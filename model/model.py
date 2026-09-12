import torch
import torch.nn as nn
import timm

class SignalScopeBaseline(nn.Module):
    def __init__(self, backbone_name='convnextv2_atto', pretrained=True):
        """
        Baseline V1: Forensic Binary Classifier
        Args:
            backbone_name: string name of the timm model
            pretrained: bool, whether to use ImageNet weights
        """
        super(SignalScopeBaseline, self).__init__()
        self.backbone_name = backbone_name
        
        # 1. Load the pretrained backbone. 
        # num_classes=0 removes the original classifier head, leaving just the feature extractor.
        self.backbone = timm.create_model(
            backbone_name, 
            pretrained=pretrained, 
            num_classes=0 
        )
        
        # 2. Find the feature dimension size automatically
        with torch.no_grad():
            dummy_input = torch.zeros(1, 3, 224, 224)
            features = self.backbone(dummy_input)
            in_features = features.shape[1]
            
        # 3. Create our binary classification head
        # We use a single output neuron for Binary Cross Entropy (BCEWithLogitsLoss)
        self.classifier = nn.Sequential(
            nn.Dropout(p=0.3),          # Prevent overfitting to forensic artifacts
            nn.Linear(in_features, 1)   # Maps features to a single logit
        )

    def forward(self, x):
        # 1. Extract visual features
        features = self.backbone(x)
        
        # 2. Pass through our classification head
        logits = self.classifier(features)
        
        # We return the raw logit (not passed through sigmoid yet). 
        # BCEWithLogitsLoss expects raw logits for numerical stability.
        # To get probability, we use torch.sigmoid(logits) later.
        # Squeeze removes the extra dimension: [Batch, 1] -> [Batch]
        return logits.squeeze(1)

if __name__ == "__main__":
    print("="*50)
    print(" SIGNALSCOPE: ARCHITECTURE TEST")
    print("="*50)
    
    # 1. Initialize model
    print("Downloading/Loading pretrained ConvNeXt-V2-Atto weights...")
    model = SignalScopeBaseline()
    
    # 2. Check parameter count
    total_params = sum(p.numel() for p in model.parameters())
    trainable_params = sum(p.numel() for p in model.parameters() if p.requires_grad)
    
    print(f"Total Parameters    : {total_params:,}")
    print(f"Trainable Parameters: {trainable_params:,}")
    
    # 3. Test forward pass with a dummy batch (batch_size=4, channels=3, H=224, W=224)
    print("\nSimulating forward pass...")
    dummy_batch = torch.randn(4, 3, 224, 224)
    
    with torch.no_grad(): # Don't track gradients for a simple test
        logits = model(dummy_batch)
        probabilities = torch.sigmoid(logits)
        
    print(f"Dummy Input Shape   : {dummy_batch.shape}")
    print(f"Output Logits Shape : {logits.shape} -> {logits.tolist()}")
    print(f"Output Probabilities: {probabilities.tolist()}")
    
    print("="*50)
    print("SUCCESS! Architecture is ready.")