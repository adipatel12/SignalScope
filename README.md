# SIGNALSCOPE: Telling Real From Synthetic in the Age of Generative Media

An AI image forensics system designed to classify images as **Real** or **AI-Generated**, featuring explainability (Grad-CAM), generator attribution, and robustness analysis against image transformations.

## Architecture
* **data/**: Ignored by git. Holds raw and processed dataset splits.
* **model/**: Core architecture, training loops, and PyTorch network definition.
* **preprocessing/**: Data ingestion, Hugging Face parsing, and forensic-safe augmentations.
* **evaluation/**: ROC-AUC metrics, confusion matrices, and robustness diagnostics.
* **weights/**: Ignored by git. Holds .pth checkpoints.
* **eports/**: Logs, plots, and CSV metrics from training runs.
* **pp/**: FastAPI backend serving predictions.
* **rontend/**: React-based UI for forensic analysis.
