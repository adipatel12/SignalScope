import os
import cv2
import torch
import numpy as np
import matplotlib.pyplot as plt
import argparse
from PIL import Image

from model.model_v2 import SignalScopeFrequency
from model.config import Config
from preprocessing.transforms import get_transforms

class HookBasedGradCAM:
    """
    Extracts the gradients from the final convolutional layer to generate 
    a heatmap of what the model is 'looking at'.
    """
    def __init__(self, model, target_layer):
        self.model = model
        self.target_layer = target_layer
        self.activations = None
        self.gradients = None
        
        # PyTorch Hooks intercept the forward and backward passes dynamically
        self.target_layer.register_forward_hook(self.save_activations)
        self.target_layer.register_full_backward_hook(self.save_gradients)
        
    def save_activations(self, module, input, output):
        self.activations = output.detach()
        
    def save_gradients(self, module, grad_input, grad_output):
        self.gradients = grad_output[0].detach()
        
    def generate(self, input_tensor):
        self.model.eval()
        self.model.zero_grad()
        
        # 1. Forward Pass
        logit = self.model(input_tensor)
        
        # 2. Backward Pass (calculates gradients for the specific prediction)
        logit.backward()
        
        # 3. Global Average Pool the gradients
        pooled_gradients = torch.mean(self.gradients, dim=[0, 2, 3])
        
        # 4. Weight the channels by the gradients
        activations = self.activations[0] 
        for i in range(activations.shape[0]):
            activations[i, :, :] *= pooled_gradients[i]
            
        # 5. Average across channels to create a single 2D heatmap
        heatmap = torch.mean(activations, dim=0)
        
        # 6. Apply ReLU (we only care about features that positively influence the prediction)
        heatmap = torch.relu(heatmap)
        
        # 7. Normalize between 0 and 1
        heatmap /= (torch.max(heatmap) + 1e-8)
        
        return heatmap.cpu().numpy(), torch.sigmoid(logit).item()

def generate_heatmap(image_path):
    print("="*60)
    print(" SIGNALSCOPE: GRAD-CAM EXPLAINABILITY")
    print("="*60)
    
    device = torch.device(Config.DEVICE)
    V2_THRESHOLD = 0.315
    
    # 1. Load V2 Model
    print("[1] Loading Dual-Stream V2 Model...")
    model = SignalScopeFrequency(backbone_name=Config.MODEL_NAME)
    weights_path = os.path.join(Config.WEIGHTS_DIR, "baseline_v2_best.pth")
    model.load_state_dict(torch.load(weights_path, map_location=device, weights_only=True))
    model.to(device)
    
    # 2. Target the last convolutional stage of ConvNeXt-Atto
    target_layer = model.spatial_backbone.stages[-1]
    grad_cam = HookBasedGradCAM(model, target_layer)
    
    # 3. Load Image
    print(f"[2] Processing Image: {image_path}")
    original_img = Image.open(image_path).convert("RGB")
    transforms = get_transforms()['val']
    img_tensor = transforms(original_img).unsqueeze(0).to(device)
    img_tensor.requires_grad_(True) # Required for backward hook
    
    # 4. Generate Heatmap
    print("[3] Calculating Gradients...")
    heatmap, prob_ai = grad_cam.generate(img_tensor)
    
    # 5. Overlay Heatmap on Original Image
    print("[4] Generating Visualization Plot...")
    
    # Resize heatmap to match the image dimensions
    heatmap_resized = cv2.resize(heatmap, (original_img.size[0], original_img.size[1]))
    heatmap_color = cv2.applyColorMap(np.uint8(255 * heatmap_resized), cv2.COLORMAP_JET)
    heatmap_color = cv2.cvtColor(heatmap_color, cv2.COLOR_BGR2RGB)
    
    # Blend original image and heatmap
    original_array = np.array(original_img)
    overlay = cv2.addWeighted(original_array, 0.5, heatmap_color, 0.5, 0)
    
    # Determine Label
    pred_label = "Likely AI" if prob_ai >= V2_THRESHOLD else "Likely Real"
    
    # 6. Plotting
    fig, axes = plt.subplots(1, 3, figsize=(15, 5))
    
    axes[0].imshow(original_img)
    axes[0].set_title("Original Image")
    axes[0].axis('off')
    
    axes[1].imshow(heatmap_resized, cmap='jet')
    axes[1].set_title(f"Grad-CAM Heatmap")
    axes[1].axis('off')
    
    axes[2].imshow(overlay)
    axes[2].set_title(f"Prediction: {pred_label}\n(AI Prob: {prob_ai:.3f})")
    axes[2].axis('off')
    
    # Save Plot
    save_path = os.path.join(Config.REPORTS_DIR, "gradcam_output.png")
    plt.tight_layout()
    plt.savefig(save_path, dpi=300)
    plt.close()
    
    print(f"\n[!] Success! Visual explanation saved to {save_path}")
    print("="*60)

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--image", type=str, required=True)
    args = parser.parse_args()
    generate_heatmap(args.image)