import sys
import platform
import subprocess

def check_env():
    print("=" * 45)
    print(" SIGNALSCOPE: SYSTEM & HARDWARE DIAGNOSTIC")
    print("=" * 45)
    
    # Python & OS
    print(f"OS              : {platform.system()} {platform.release()}")
    print(f"Python Executable: {sys.executable}")
    print(f"Python Version   : {sys.version.split()[0]}")
    
    # Pip check
    pip_v = subprocess.run([sys.executable, "-m", "pip", "--version"], capture_output=True, text=True)
    print(f"Pip Version      : {pip_v.stdout.strip().split()[1] if pip_v.returncode == 0 else 'Error'}")

    print("-" * 45)
    
    # PyTorch & CUDA Inspection
    try:
        import torch
        import torchvision
        print(f"PyTorch Version  : {torch.__version__}")
        print(f"Torchvision Ver  : {torchvision.__version__}")
        
        cuda_available = torch.cuda.is_available()
        print(f"CUDA Available   : {cuda_available}")
        
        if cuda_available:
            print(f"CUDA Version (PyTorch) : {torch.version.cuda}")
            print(f"Device Count     : {torch.cuda.device_count()}")
            print(f"GPU Name         : {torch.cuda.get_device_name(0)}")
            
            # VRAM in GB
            vram_gb = torch.cuda.get_device_properties(0).total_memory / (1024**3)
            print(f"Total GPU VRAM   : {vram_gb:.2f} GB")
        else:
            print("GPU Status       : No CUDA-capable GPU detected by PyTorch.")
    except ImportError:
        print("PyTorch Status   : NOT INSTALLED")

    print("-" * 45)
    
    # Core Libraries Check
    libraries = [
        ("timm", "timm"),
        ("datasets", "datasets"),
        ("scikit-learn", "sklearn"),
        ("pillow", "PIL"),
        ("fastapi", "fastapi"),
        ("uvicorn", "uvicorn"),
        ("pymongo", "pymongo"),
        ("grad-cam", "pytorch_grad_cam")
    ]
    
    for name, import_name in libraries:
        try:
            mod = __import__(import_name)
            ver = getattr(mod, "__version__", "Installed")
            print(f"{name.ljust(16)}: {ver}")
        except ImportError:
            print(f"{name.ljust(16)}: NOT INSTALLED")
            
    print("=" * 45)

if __name__ == "__main__":
    check_env()