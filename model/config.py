import torch
import os

class Config:
    # ---------------------------------------------------------
    # 1. CORE SETTINGS
    # ---------------------------------------------------------
    PROJECT_NAME = "SignalScope"
    SEED = 42                                 # For reproducibility
    DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
    
    # ---------------------------------------------------------
    # 2. DATASET LIMITS (CRITICAL FOR CPU TRAINING)
    # ---------------------------------------------------------
    # The full dataset is 96,000 images. CPU training will take weeks.
    # We restrict to a manageable subset for the baseline experiment.
    MAX_TRAIN_SAMPLES = 10000
    MAX_VAL_SAMPLES = 2000
    
    # ---------------------------------------------------------
    # 3. HYPERPARAMETERS
    # ---------------------------------------------------------
    MODEL_NAME = "convnextv2_atto"
    IMAGE_SIZE = 224
    BATCH_SIZE = 32
    EPOCHS = 7                               # Keep low for CPU
    LEARNING_RATE = 1e-4                      # Standard starting LR for AdamW
    WEIGHT_DECAY = 1e-4                       # L2 regularization
    NUM_WORKERS = 0                           # Must be 0 on Windows to avoid freezing
    PATIENCE = 3                              # Early stopping threshold
    
    # ---------------------------------------------------------
    # 4. CLASS IMBALANCE HANDLING
    # ---------------------------------------------------------
    # From Stage 3: Real(0) is 16.7%, AI(1) is 83.3%.
    # Formula for pos_weight = (Number of Negative samples) / (Number of Positive samples)
    # Negative (Real, 0) = 7,000. Positive (AI, 1) = 35,000.
    # pos_weight = 7000 / 35000 = 0.2
    # This penalizes the model for over-predicting the majority class.
    POS_WEIGHT = None
    
    # ---------------------------------------------------------
    # 5. DIRECTORIES
    # ---------------------------------------------------------
    ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    DATA_DIR = os.path.join(ROOT_DIR, "data")
    WEIGHTS_DIR = os.path.join(ROOT_DIR, "weights")
    REPORTS_DIR = os.path.join(ROOT_DIR, "reports")
    
    # We define the specific save path for our best model weights
    BEST_MODEL_PATH = os.path.join(WEIGHTS_DIR, "baseline_v1_best.pth")

# Create directories if they don't exist
os.makedirs(Config.WEIGHTS_DIR, exist_ok=True)
os.makedirs(Config.REPORTS_DIR, exist_ok=True)

if __name__ == "__main__":
    print("="*40)
    print(" SIGNALSCOPE: CONFIGURATION")
    print("="*40)
    print(f"Device        : {Config.DEVICE}")
    print(f"Model         : {Config.MODEL_NAME}")
    print(f"Batch Size    : {Config.BATCH_SIZE}")
    print(f"Train Samples : {Config.MAX_TRAIN_SAMPLES}")
    print(f"Epochs        : {Config.EPOCHS}")
    print(f"Save Path     : {Config.BEST_MODEL_PATH}")
    print("="*40)