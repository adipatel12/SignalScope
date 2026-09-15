#  SignalScope: Telling Real From Synthetic

**Team:** The Innovators
**Challenge:** SIH 2026 - Problem Statement 2

SignalScope is a production-grade, deployable media forensics platform designed to classify images as real or AI-generated. Built to tackle the hardest challenge in media forensics—**generalisation to unseen generators**—it utilizes a novel dual-stream architecture (Spatial + Frequency domain) and provides honest, localized, and context-aware visual explanations.
---

## 1. Modules Implemented

### Core Task
- **Binary Classification (Real vs AI):** A high-performance inference pipeline utilizing a dual-stream Convolutional/Frequency architecture.
- **Calibrated Confidence:** Raw logits are calibrated using rigorous **Platt Scaling** to output true likelihood probabilities, preventing overconfident false positives on real images.

###  Bonus Modules Achieved
- **[Bonus A] Faithful Explanation (Headline):** Integrated **Hook-Based Grad-CAM**. The API generates a localized heatmap highlighting the exact anomalous regions (e.g., up-conv grid patterns) driving the prediction, presented alongside a dynamic, mathematically-routed text explanation.
- **[Bonus C] Robustness to Degradation:** The inference pipeline uses **Semantic Multi-Crop Analysis** and explicit **Compression Dampening** logic to survive heavy JPEG compression and social media downsampling without falsely flagging natural noise as AI.
- **[Bonus D] Provenance & Metadata:** The API parses hardware EXIF data and generalized `image.info` headers. If an explicit AI signature (e.g., "Midjourney") is detected, the UI raises a "PROVENANCE ALERT". If physical camera hardware data is found, it acts as an optical dampener for the visual model.
* **[Bonus F] (Real-Time / Deployable):** Shipped a production-grade React web interface featuring drag-and-drop batch scanning, detailed heat-map drill-downs, and MongoDB telemetry.
---

## 2. Setup and Run Instructions

### Prerequisites
- Python 3.10+
- Node.js (v18+)

### Backend (FastAPI)
```bash
# 1. Create and activate a virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Start the Inference API
uvicorn api.main:app --reload
# The API will run on http://127.0.0.1:8000
```

### Frontend (React/Vite)
```bash
# 1. Navigate to the frontend directory
cd frontend

# 2. Install dependencies
npm install

# 3. Start the dashboard
npm run dev
# The UI will run on http://localhost:5173
```
**To test:** Open `http://localhost:5173`, drag and drop any image, and view the visual classification, Grad-CAM heatmap, and EXIF provenance!

---

## 3. Datasets Used
- **Core Training/Validation Data:** `Rajarshi-Roy-research/Defactify_Image_Dataset`
  - **Source:** HuggingFace Datasets
  - **License:** Open/MIT Licensed for research.
  - **Details:** Used for training the `ConvNeXt` backbone and evaluating the initial baseline. No proprietary or scraped targeted individual data was used.

 also used the Training/Validation Data: Describable Textures Dataset (DTD): Leveraged specific geometric texture categories (grid, striped, meshed) as hard negatives to fortify the frequency stream against false positives from natural periodic patterns.
-- some geminie and other model used for this 
---

## 4. Reported Metrics (Held-Out Test Set)
- **Overall ROC-AUC:** `0.8493`
- **Unseen-Generator-Split AUC:** `~0.83` *(Estimated based onMidjourney/DALL-E test sets)*
- **Macro-F1 Score:** `0.6891`
- **Accuracy:** `76.9%` at a threshold of `0.310`
- **False Positive Rate:** `20.61%`
- **Confusion Matrix:** 
  - True Positives: `635` | False Positives: `34`
  - False Negatives: `200` | True Negatives: `131`
---
## 5. Architecture & Approach
### Model Architecture
SignalScope uses a **Dual-Stream** approach to avoid overfitting to specific GAN/Diffusion spatial artifacts:
1. **Spatial Stream:** `ConvNeXt-Atto` backbone capturing local textures and high-level semantics.
2. **Frequency Stream:** A custom 2D Fast Fourier Transform (FFT) block that captures periodic, algorithmic noise patterns (like checkerboard artifacts from upsampling) which are invisible to the naked eye but common across many generative architectures.

### Inference & Robustness Pipeline
To handle real-world degradations (Bonus C), we use **Semantic Multi-Crop Aggregation**:
1. The image is split into 1 global macro-crop and 9 localized overlapping patches.
2. If the image is extremely high-res (e.g., 4K Midjourney), the system heavily weights local patch spikes, as global downsampling destroys micro-artifacts.
3. If the image is standard social media resolution (and lacks camera EXIF), a **Compression Dampener** is applied to prevent heavily compressed foliage/textures from triggering false positive patch scores.

### Known Limitations
- **Heavy Adversarial Noise:** If an image is specifically poisoned with adversarial noise designed to trick CNNs, the spatial backbone may fail, though the FFT stream provides some resistance.
---

## 6. Links

- ** Video :** ["https://drive.google.com/file/d/1jvLhPXjFc8J1aRr60SrImdXntc8S24pD/view?usp=drivesdk"]
- **Report Link:** ["https://drive.google.com/file/d/1ewgN9ytyVf442KVTyQ-Zq0gDOODyIhCV/view?usp=sharing"] 

