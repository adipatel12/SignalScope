from fastapi import APIRouter, HTTPException, Depends, Header
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
import secrets

from api.database import Database

router = APIRouter(prefix="/api", tags=["Forensic Authentication & Persistence"])

# --- Request / Response Models ---
class RegisterPayload(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    email: str = Field(..., min_length=3, max_length=150)
    password: str = Field(..., min_length=6)
    organization: Optional[str] = "Independent Forensic Analyst"
    department: Optional[str] = "Digital Media Verification"
    role: Optional[str] = "Forensic Investigator"
    securityTier: Optional[str] = "Tier 2 (Enterprise Forensic)"
    timezone: Optional[str] = "UTC-05:00 (Eastern Time)"

class LoginPayload(BaseModel):
    email: str
    password: str

class ProfileUpdatePayload(BaseModel):
    name: Optional[str] = None
    organization: Optional[str] = None
    department: Optional[str] = None
    bio: Optional[str] = None
    avatarUrl: Optional[str] = None
    avatarSeed: Optional[str] = None
    timezone: Optional[str] = None
    defaultProfile: Optional[str] = None
    twoFactorEnabled: Optional[bool] = None

class PasswordChangePayload(BaseModel):
    oldPassword: str
    newPassword: str = Field(..., min_length=6)

class ScanSavePayload(BaseModel):
    filename: str
    dimensions: str
    prediction: str
    risk_tier: str
    confidence_ai: float
    confidence_real: float
    peak_anomaly_score: float
    threshold_used: float
    profile_applied: str
    regions_inspected: int
    userId: Optional[str] = None
    userEmail: Optional[str] = None

# Active session tokens mapping token -> user_id
ACTIVE_SESSIONS: Dict[str, str] = {}

def get_current_user_id(authorization: Optional[str] = Header(None)) -> str:
    """Helper to extract user from Authorization header or throw 401 if unauthenticated."""
    if not authorization:
        raise HTTPException(status_code=401, detail="Authentication required. Please sign in to access this forensic endpoint.")
    
    token = authorization.replace("Bearer ", "").strip()
    user_id = ACTIVE_SESSIONS.get(token)
    if not user_id:
        # Check if direct user ID was passed
        user = Database.get_user_by_id(token)
        if user:
            return token
        # Check if it's the demo token
        if token == "ss_sess_demo_alex_morgan":
            return "user_demo_alex_morgan"
        raise HTTPException(status_code=401, detail="Invalid or expired session token. Please sign in again.")
    return user_id

# ================= AUTH ENDPOINTS =================

@router.post("/auth/register")
def register(payload: RegisterPayload):
    try:
        user_data = payload.model_dump()
        password = user_data.pop("password")
        user = Database.create_user(user_data, password)
        
        # Generate session token
        token = f"ss_sess_{secrets.token_urlsafe(32)}"
        ACTIVE_SESSIONS[token] = user["id"]
        
        return {
            "status": "success",
            "message": "Analyst registered in MongoDB Atlas.",
            "token": token,
            "user": user
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Registration failed: {str(e)}")

@router.post("/auth/login")
def login(payload: LoginPayload):
    user = Database.verify_password(payload.email, payload.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password. Please verify your credentials.")
    
    token = f"ss_sess_{secrets.token_urlsafe(32)}"
    ACTIVE_SESSIONS[token] = user["id"]
    
    return {
        "status": "success",
        "message": "Authentication successful.",
        "token": token,
        "user": user
    }

@router.get("/auth/me")
def get_current_profile(user_id: str = Depends(get_current_user_id)):
    user = Database.get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User profile not found in MongoDB Atlas.")
    
    safe = dict(user)
    safe.pop("password_hash", None)
    safe.pop("salt", None)
    return safe

@router.put("/auth/profile")
def update_profile(payload: ProfileUpdatePayload, user_id: str = Depends(get_current_user_id)):
    updates = payload.model_dump(exclude_unset=True)
    updated_user = Database.update_user_profile(user_id, updates)
    if not updated_user:
        raise HTTPException(status_code=404, detail="User profile could not be updated.")
    return {
        "status": "success",
        "message": "Forensic analyst profile updated in MongoDB Atlas.",
        "user": updated_user
    }

@router.post("/auth/change-password")
def change_password(payload: PasswordChangePayload, user_id: str = Depends(get_current_user_id)):
    success = Database.change_password(user_id, payload.oldPassword, payload.newPassword)
    if not success:
        raise HTTPException(status_code=400, detail="Current password incorrect or password change failed.")
    return {
        "status": "success",
        "message": "Password updated successfully in MongoDB Atlas."
    }

# ================= SCAN HISTORY ENDPOINTS =================

@router.get("/scans/history")
def get_scan_history(limit: int = 50, user_id: str = Depends(get_current_user_id)):
    scans = Database.get_user_scans(user_id, limit=limit)
    return scans

@router.post("/scans/save")
def save_scan(payload: ScanSavePayload, user_id: str = Depends(get_current_user_id)):
    scan_dict = payload.model_dump()
    scan_dict["userId"] = user_id
    user = Database.get_user_by_id(user_id)
    if user:
        scan_dict["userEmail"] = user.get("email")
    
    saved_record = Database.save_scan(scan_dict)
    return {
        "status": "success",
        "message": "Scan telemetry committed to MongoDB Atlas audit ledger.",
        "scan": saved_record
    }

@router.delete("/scans/{scan_id}")
def delete_scan(scan_id: str, user_id: str = Depends(get_current_user_id)):
    success = Database.delete_scan(scan_id, user_id)
    if not success:
        raise HTTPException(status_code=404, detail="Scan record not found or could not be removed.")
    return {
        "status": "success",
        "message": "Scan audit entry deleted from MongoDB Atlas."
    }

# ================= DATABASE HEALTH ENDPOINT =================

@router.get("/health/db")
def get_db_health():
    return Database.get_status()
