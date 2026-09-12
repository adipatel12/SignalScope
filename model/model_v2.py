import torch
import torch.nn as nn
import timm
import torch.fft

class SignalScopeFrequency(nn.Module):
    def __init__(self, backbone_name='convnextv2_atto', pretrained=True):
        """
        Baseline V2: Dual-Stream Spatial + Frequency Classifier with LayerNorm Stabilization
        """
        super(SignalScopeFrequency, self).__init__()
        
        # --- STREAM 1: SPATIAL (ConvNeXt) ---
        self.spatial_backbone = timm.create_model(
            backbone_name, 
            pretrained=pretrained, 
            num_classes=0 
        )
        
        with torch.no_grad():
            dummy_input = torch.zeros(1, 3, 224, 224)
            spatial_features = self.spatial_backbone(dummy_input)
            spatial_dim = spatial_features.shape[1]
            
        # --- STREAM 2: FREQUENCY (FFT + CNN) ---
        self.freq_backbone = nn.Sequential(
            nn.Conv2d(3, 16, kernel_size=3, stride=2, padding=1),
            nn.BatchNorm2d(16),
            nn.ReLU(),
            nn.MaxPool2d(2),
            
            nn.Conv2d(16, 32, kernel_size=3, stride=2, padding=1),
            nn.BatchNorm2d(32),
            nn.ReLU(),
            nn.AdaptiveAvgPool2d((1, 1)),
            nn.Flatten()
        )
        freq_dim = 32
        
        # --- FREQUENCY FEATURE NORMALIZATION ---
        # Normalizes unbounded log-FFT magnitudes to prevent scale mismatch with spatial features
        self.freq_norm = nn.LayerNorm(freq_dim)
        
        # --- FUSION: Combining both streams ---
        total_dim = spatial_dim + freq_dim
        self.classifier = nn.Sequential(
            nn.Dropout(p=0.4),
            nn.Linear(total_dim, 128),
            nn.ReLU(),
            nn.Dropout(p=0.2),
            nn.Linear(128, 1)
        )

    def extract_frequency(self, x):
        """Converts spatial image tensor to centered frequency magnitude spectrum."""
        # 1. Apply 2D Fast Fourier Transform on real pixels
        fft_complex = torch.fft.rfft2(x, norm="ortho")
        
        # 2. Extract magnitude (absolute value)
        magnitude = torch.abs(fft_complex)
        
        # 3. Shift zero-frequency components to center along height
        magnitude = torch.fft.fftshift(magnitude, dim=(-2,))
        
        # 4. Log scale to enhance micro-textures and avoid log(0)
        log_magnitude = torch.log(magnitude + 1e-8)
        
        return log_magnitude

    def forward(self, x):
        # Stream 1: Spatial representation
        s_feat = self.spatial_backbone(x)
        
        # Stream 2: Frequency representation + LayerNorm
        freq_tensor = self.extract_frequency(x)
        f_feat = self.freq_backbone(freq_tensor)
        f_feat = self.freq_norm(f_feat)
        
        # Fusion: Channel-wise concatenation
        combined_feat = torch.cat((s_feat, f_feat), dim=1)
        
        # Binary logit output
        logits = self.classifier(combined_feat)
        return logits.squeeze(1)

if __name__ == "__main__":
    print("="*60)
    print(" SIGNALSCOPE: V2 (FREQUENCY + LAYERNORM) TEST")
    print("="*60)
    
    model = SignalScopeFrequency()
    total_params = sum(p.numel() for p in model.parameters())
    print(f"Total Parameters: {total_params:,}")
    
    dummy_batch = torch.randn(4, 3, 224, 224)
    with torch.no_grad():
        logits = model(dummy_batch)
        probs = torch.sigmoid(logits)
        
    print(f"Output Shape: {logits.shape}")
    print(f"Sample Probabilities: {[round(p, 4) for p in probs.tolist()]}")
    print("="*60)