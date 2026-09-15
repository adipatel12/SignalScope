import os
import secrets
import hashlib
import time
from typing import Optional, Dict, Any, List
from pymongo import MongoClient, ASCENDING, DESCENDING
from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError

# Load environment file manually if not in env
def load_env():
    env_paths = [
        os.path.join(os.path.dirname(__file__), ".env"),
        os.path.join(os.getcwd(), "api", ".env"),
        os.path.join(os.getcwd(), ".env")
    ]
    for p in env_paths:
        if os.path.exists(p):
            try:
                with open(p, "r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if line and not line.startswith("#") and "=" in line:
                            k, v = line.split("=", 1)
                            os.environ.setdefault(k.strip(), v.strip())
            except Exception:
                pass

load_env()

# Live MongoDB Atlas Configuration
MONGO_URI = os.getenv(
    "MONGODB_URI", 
    "mongodb+srv://solankishrey22_db_user:QC8cdNfewDVu2jmF@sih.62ir5ni.mongodb.net/signalscope_db?retryWrites=true&w=majority&appName=Sih"
)
DATABASE_NAME = os.getenv("DATABASE_NAME", "signalscope_db")

class Database:
    client: Optional[MongoClient] = None
    db = None
    is_connected: bool = False
    connection_error: Optional[str] = None
    
    # In-memory fallback stores only if MongoDB Atlas is completely unreachable
    _memory_users: Dict[str, Dict[str, Any]] = {}
    _memory_scans: List[Dict[str, Any]] = []

    @classmethod
    def connect(cls):
        """Initializes connection to MongoDB Atlas."""
        if not MONGO_URI:
            cls.is_connected = False
            cls.connection_error = "MONGODB_URI not configured."
            print(f"[Database] {cls.connection_error}")
            return
            
        try:
            print(f"[Database] Connecting to MongoDB Atlas cluster...")
            cls.client = MongoClient(
                MONGO_URI,
                serverSelectionTimeoutMS=8000,
                connectTimeoutMS=8000,
                appname="SignalScope-Forensic-Engine"
            )
            # Test connection
            cls.client.admin.command('ping')
            cls.db = cls.client[DATABASE_NAME]
            cls.is_connected = True
            cls.connection_error = None
            print(f"[Database] Successfully connected to MongoDB Atlas database '{DATABASE_NAME}'!")
            
            # Setup indexes
            cls._create_indexes()
            cls._seed_database_if_empty()
        except (ConnectionFailure, ServerSelectionTimeoutError, Exception) as e:
            cls.is_connected = False
            cls.connection_error = f"Failed to connect to MongoDB Atlas: {str(e)}"
            print(f"[Database] {cls.connection_error}. Falling back to resilient memory mode.")

    @classmethod
    def disconnect(cls):
        if cls.client:
            cls.client.close()
            cls.is_connected = False
            print("[Database] Disconnected from MongoDB Atlas.")

    @classmethod
    def _create_indexes(cls):
        try:
            if cls.db is not None:
                cls.db.users.create_index([("email", ASCENDING)], unique=True)
                cls.db.scans.create_index([("userId", ASCENDING), ("createdAt", DESCENDING)])
        except Exception as e:
            print(f"[Database] Index creation note: {e}")

    @classmethod
    def _hash_password(cls, password: str, salt: Optional[str] = None) -> tuple[str, str]:
        if not salt:
            salt = secrets.token_hex(16)
        hashed = hashlib.sha256((password + salt).encode('utf-8')).hexdigest()
        return hashed, salt

    @classmethod
    def _seed_database_if_empty(cls):
        """Seeds standard demo account into MongoDB Atlas if database is fresh."""
        if cls.db is None:
            return
        try:
            demo_user = cls.db.users.find_one({"email": "alex.morgan@signalscope.ai"})
            if not demo_user:
                print("[Database] Initializing demo investigator in MongoDB Atlas...")
                demo_id = "user_demo_alex_morgan"
                hashed, salt = cls._hash_password("password123", "demo_salt_99812")
                initial_user = {
                    "_id": demo_id,
                    "id": demo_id,
                    "name": "Dr. Alex Morgan",
                    "email": "alex.morgan@signalscope.ai",
                    "password_hash": hashed,
                    "salt": salt,
                    "organization": "National Cyber Forensics Lab",
                    "department": "Digital Media & Deepfake Verification Unit",
                    "role": "Forensic Investigator",
                    "bio": "Lead forensic analyst specializing in multi-spectral frequency analysis and synthetic artifact detection.",
                    "avatarUrl": "",
                    "avatarSeed": "alex-morgan-forensic",
                    "securityTier": "Tier 3 (Lead Investigator)",
                    "timezone": "UTC-05:00 (Eastern Time)",
                    "defaultProfile": "balanced",
                    "twoFactorEnabled": True,
                    "memberSince": "2025-11-14",
                    "createdAt": "2025-11-14T09:30:00Z"
                }
                cls.db.users.insert_one(initial_user)
                print("[Database] Demo user initialized in MongoDB Atlas.")
        except Exception as e:
            print(f"[Database] Seeding note: {e}")

    # ================= USER OPERATIONS =================
    @classmethod
    def get_user_by_email(cls, email: str) -> Optional[Dict[str, Any]]:
        norm_email = email.strip().lower()
        if cls.is_connected and cls.db is not None:
            try:
                user = cls.db.users.find_one({"email": norm_email})
                if user:
                    user["id"] = str(user.get("_id", user.get("id")))
                    return user
            except Exception as e:
                print(f"[Database] get_user_by_email query error: {e}")
        return cls._memory_users.get(norm_email)

    @classmethod
    def get_user_by_id(cls, user_id: str) -> Optional[Dict[str, Any]]:
        if cls.is_connected and cls.db is not None:
            try:
                user = cls.db.users.find_one({"_id": user_id}) or cls.db.users.find_one({"id": user_id})
                if user:
                    user["id"] = str(user.get("_id", user.get("id")))
                    return user
            except Exception as e:
                print(f"[Database] get_user_by_id query error: {e}")
        for user in cls._memory_users.values():
            if user.get("id") == user_id:
                return user
        return None

    @classmethod
    def create_user(cls, user_data: Dict[str, Any], password: str) -> Dict[str, Any]:
        email = user_data["email"].strip().lower()
        if cls.get_user_by_email(email):
            raise ValueError(f"An account with email {email} already exists.")
        
        user_id = f"user_{secrets.token_hex(8)}"
        hashed, salt = cls._hash_password(password)
        
        new_user = {
            "id": user_id,
            "name": user_data.get("name", "Forensic Investigator"),
            "email": email,
            "password_hash": hashed,
            "salt": salt,
            "organization": user_data.get("organization", "SignalScope Forensic Lab"),
            "department": user_data.get("department", "Digital Forensics Unit"),
            "role": user_data.get("role", "Forensic Investigator"),
            "bio": user_data.get("bio", "Certified media forensics investigator."),
            "avatarUrl": user_data.get("avatarUrl", ""),
            "avatarSeed": user_data.get("avatarSeed", user_id),
            "securityTier": user_data.get("securityTier", "Tier 2 (Enterprise Forensic)"),
            "timezone": user_data.get("timezone", "UTC-05:00 (Eastern Time)"),
            "defaultProfile": user_data.get("defaultProfile", "balanced"),
            "twoFactorEnabled": user_data.get("twoFactorEnabled", False),
            "memberSince": time.strftime("%Y-%m-%d"),
            "createdAt": time.strftime("%Y-%m-%dT%H:%M:%SZ")
        }

        # Save to MongoDB Atlas if connected
        if cls.is_connected and cls.db is not None:
            try:
                doc = dict(new_user)
                doc["_id"] = user_id
                cls.db.users.insert_one(doc)
                print(f"[Database: Atlas] Inserted new user {email} into MongoDB Atlas!")
            except Exception as e:
                print(f"[Database] create_user Atlas insert error: {e}")

        # Save to memory fallback
        cls._memory_users[email] = new_user

        # Return safe copy without password
        safe_user = dict(new_user)
        safe_user.pop("password_hash", None)
        safe_user.pop("salt", None)
        return safe_user

    @classmethod
    def verify_password(cls, email: str, password: str) -> Optional[Dict[str, Any]]:
        user = cls.get_user_by_email(email)
        if not user:
            return None
        hashed, _ = cls._hash_password(password, user.get("salt", ""))
        if hashed == user.get("password_hash"):
            safe_user = dict(user)
            safe_user.pop("password_hash", None)
            safe_user.pop("salt", None)
            return safe_user
        return None

    @classmethod
    def update_user_profile(cls, user_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        allowed_keys = {
            "name", "organization", "department", "bio", "avatarUrl", 
            "avatarSeed", "timezone", "defaultProfile", "twoFactorEnabled"
        }
        filtered_updates = {k: v for k, v in updates.items() if k in allowed_keys}
        filtered_updates["updatedAt"] = time.strftime("%Y-%m-%dT%H:%M:%SZ")

        # Update in MongoDB Atlas
        if cls.is_connected and cls.db is not None:
            try:
                cls.db.users.update_one(
                    {"$or": [{"_id": user_id}, {"id": user_id}]},
                    {"$set": filtered_updates}
                )
                print(f"[Database: Atlas] Updated profile for user {user_id}")
            except Exception as e:
                print(f"[Database] update_user_profile Atlas error: {e}")

        # Update in memory
        for email, u in cls._memory_users.items():
            if u.get("id") == user_id:
                u.update(filtered_updates)
                safe = dict(u)
                safe.pop("password_hash", None)
                safe.pop("salt", None)
                return safe

        return cls.get_user_by_id(user_id)

    @classmethod
    def change_password(cls, user_id: str, old_pass: str, new_pass: str) -> bool:
        user = cls.get_user_by_id(user_id)
        if not user:
            return False
        
        # Verify old password
        hashed_old, _ = cls._hash_password(old_pass, user.get("salt", ""))
        if hashed_old != user.get("password_hash"):
            return False
            
        new_hashed, new_salt = cls._hash_password(new_pass)
        
        # Update MongoDB Atlas
        if cls.is_connected and cls.db is not None:
            try:
                cls.db.users.update_one(
                    {"$or": [{"_id": user_id}, {"id": user_id}]},
                    {"$set": {"password_hash": new_hashed, "salt": new_salt}}
                )
            except Exception as e:
                print(f"[Database] change_password Atlas error: {e}")

        # Update memory
        for email, u in cls._memory_users.items():
            if u.get("id") == user_id:
                u["password_hash"] = new_hashed
                u["salt"] = new_salt
                break

        return True

    # ================= SCAN HISTORY OPERATIONS =================
    @classmethod
    def save_scan(cls, scan_data: Dict[str, Any]) -> Dict[str, Any]:
        scan_id = f"scan_{secrets.token_hex(6)}_{int(time.time())}"
        record = {
            "id": scan_id,
            "userId": scan_data.get("userId", "anonymous"),
            "userEmail": scan_data.get("userEmail", "anonymous@signalscope.ai"),
            "filename": scan_data.get("filename", "unknown.png"),
            "dimensions": scan_data.get("dimensions", "N/A"),
            "prediction": scan_data.get("prediction", "Likely Real"),
            "risk_tier": scan_data.get("risk_tier", "NATURAL_OR_COMPUTATIONAL_PHOTO"),
            "confidence_ai": float(scan_data.get("confidence_ai", 0.0)),
            "confidence_real": float(scan_data.get("confidence_real", 1.0)),
            "peak_anomaly_score": float(scan_data.get("peak_anomaly_score", 0.0)),
            "threshold_used": float(scan_data.get("threshold_used", 0.5)),
            "profile_applied": scan_data.get("profile_applied", "balanced"),
            "regions_inspected": int(scan_data.get("regions_inspected", 10)),
            "createdAt": time.strftime("%Y-%m-%dT%H:%M:%SZ")
        }

        # MongoDB Atlas store
        if cls.is_connected and cls.db is not None:
            try:
                doc = dict(record)
                doc["_id"] = scan_id
                cls.db.scans.insert_one(doc)
                print(f"[Database: Atlas] Logged scan {record['filename']} for user {record['userId']}")
            except Exception as e:
                print(f"[Database] save_scan Atlas insert error: {e}")

        # Memory store
        cls._memory_scans.insert(0, record)
        return record

    @classmethod
    def get_user_scans(cls, user_id: str, limit: int = 50) -> List[Dict[str, Any]]:
        if cls.is_connected and cls.db is not None:
            try:
                cursor = cls.db.scans.find({"userId": user_id}).sort("createdAt", DESCENDING).limit(limit)
                scans = []
                for s in cursor:
                    s["id"] = str(s.get("_id", s.get("id")))
                    scans.append(s)
                return scans
            except Exception as e:
                print(f"[Database] get_user_scans Atlas error: {e}")
        
        # Fallback memory
        return [s for s in cls._memory_scans if s.get("userId") == user_id][:limit]

    @classmethod
    def delete_scan(cls, scan_id: str, user_id: str) -> bool:
        # MongoDB Atlas deletion
        if cls.is_connected and cls.db is not None:
            try:
                res = cls.db.scans.delete_one({"_id": scan_id, "userId": user_id})
                return res.deleted_count > 0
            except Exception as e:
                print(f"[Database] delete_scan Atlas error: {e}")
        
        # Memory deletion
        cls._memory_scans = [s for s in cls._memory_scans if not (s.get("id") == scan_id and s.get("userId") == user_id)]
        return True

    @classmethod
    def get_status(cls) -> Dict[str, Any]:
        return {
            "is_connected": cls.is_connected,
            "database_name": DATABASE_NAME,
            "cluster": "sih.62ir5ni.mongodb.net",
            "connection_error": cls.connection_error,
            "storage_mode": "MongoDB Atlas Cloud Cluster (sih.62ir5ni.mongodb.net)" if cls.is_connected else "Local Resilient Memory Storage",
            "total_users": cls.db.users.count_documents({}) if cls.is_connected and cls.db is not None else len(cls._memory_users),
            "total_scans": cls.db.scans.count_documents({}) if cls.is_connected and cls.db is not None else len(cls._memory_scans),
        }
