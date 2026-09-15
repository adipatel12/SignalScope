import type { 
  User, 
  ScanHistoryItem, 
  AuthResponse, 
  RegisterPayload, 
  LoginPayload, 
  ProfileUpdatePayload,
  DatabaseHealth 
} from '../types/auth';

export interface PredictionResponse {
  id?: string;
  filename: string;
  dimensions: string;
  prediction: string;
  risk_tier: string;
  confidence_ai: number;
  confidence_real: number;
  peak_anomaly_score: number;
  threshold_used: number;
  profile_applied: string;
  regions_inspected: number;
  userId?: string;
  createdAt?: string;
  heatmap_base64?: string;
  explanation?: string;
}

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

function getAuthHeaders(token?: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const activeToken = token || localStorage.getItem('signalscope_token');
  if (activeToken) {
    headers['Authorization'] = `Bearer ${activeToken}`;
  }
  return headers;
}

// ================= FORENSIC ANALYZER =================

export async function analyzeImage(file: File, profile: string): Promise<PredictionResponse> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('profile', profile);

  const token = localStorage.getItem('signalscope_token');
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}/analyze/`, {
    method: 'POST',
    headers,
    body: formData,
  });

  if (!response.ok) {
    let errorMessage = 'Failed to analyze image';
    try {
      const errorData = await response.json();
      errorMessage = errorData.detail || errorMessage;
    } catch {
      // If it's not JSON, use default
    }
    throw new Error(errorMessage);
  }

  return response.json();
}

export async function analyzeBatch(files: File[], profile: string): Promise<PredictionResponse[]> {
  const formData = new FormData();
  files.forEach(file => {
    formData.append('files', file); // Note: must match FastAPI's 'files' parameter
  });
  formData.append('profile', profile);

  const token = localStorage.getItem('signalscope_token');
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}/analyze/batch/`, {
    method: 'POST',
    headers,
    body: formData,
  });

  if (!response.ok) {
    let errorMessage = 'Failed to analyze batch';
    try {
      const errorData = await response.json();
      errorMessage = errorData.detail || errorMessage;
    } catch {
      // If it's not JSON, use default
    }
    throw new Error(errorMessage);
  }

  return response.json();
}

// ================= AUTHENTICATION APIS =================

export async function registerApi(payload: RegisterPayload): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let errorMessage = 'Registration failed';
    try {
      const errorData = await response.json();
      errorMessage = errorData.detail || errorMessage;
    } catch {
      // fallback
    }
    throw new Error(errorMessage);
  }

  return response.json();
}

export async function loginApi(payload: LoginPayload): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let errorMessage = 'Invalid forensic credentials';
    try {
      const errorData = await response.json();
      errorMessage = errorData.detail || errorMessage;
    } catch {
      // fallback
    }
    throw new Error(errorMessage);
  }

  return response.json();
}

export async function getProfileApi(token?: string): Promise<User> {
  const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
    method: 'GET',
    headers: getAuthHeaders(token),
  });

  if (!response.ok) {
    throw new Error('Failed to retrieve analyst profile');
  }

  return response.json();
}

export async function updateProfileApi(updates: ProfileUpdatePayload): Promise<{ status: string; user: User }> {
  const response = await fetch(`${API_BASE_URL}/api/auth/profile`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(updates),
  });

  if (!response.ok) {
    let errorMessage = 'Failed to update profile';
    try {
      const errorData = await response.json();
      errorMessage = errorData.detail || errorMessage;
    } catch {}
    throw new Error(errorMessage);
  }

  return response.json();
}

export async function changePasswordApi(oldPassword: string, newPassword: string): Promise<{ status: string; message: string }> {
  const response = await fetch(`${API_BASE_URL}/api/auth/change-password`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ oldPassword, newPassword }),
  });

  if (!response.ok) {
    let errorMessage = 'Failed to change password';
    try {
      const errorData = await response.json();
      errorMessage = errorData.detail || errorMessage;
    } catch {}
    throw new Error(errorMessage);
  }

  return response.json();
}

// ================= SCAN HISTORY APIS =================

export async function getScansApi(token?: string): Promise<ScanHistoryItem[]> {
  const response = await fetch(`${API_BASE_URL}/api/scans/history`, {
    method: 'GET',
    headers: getAuthHeaders(token),
  });

  if (!response.ok) {
    throw new Error('Failed to fetch scan history from MongoDB Atlas');
  }

  return response.json();
}

export async function saveScanApi(scanData: Omit<ScanHistoryItem, 'id' | 'createdAt'>): Promise<{ status: string; scan: ScanHistoryItem }> {
  const response = await fetch(`${API_BASE_URL}/api/scans/save`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(scanData),
  });

  if (!response.ok) {
    let errorMessage = 'Failed to persist scan record';
    try {
      const err = await response.json();
      errorMessage = err.detail || errorMessage;
    } catch {}
    throw new Error(errorMessage);
  }

  return response.json();
}

export async function deleteScanApi(scanId: string): Promise<{ status: string; message: string }> {
  const response = await fetch(`${API_BASE_URL}/api/scans/${scanId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to delete scan from MongoDB Atlas');
  }

  return response.json();
}

// ================= DATABASE HEALTH =================

export async function getDbStatusApi(): Promise<DatabaseHealth> {
  const response = await fetch(`${API_BASE_URL}/api/health/db`, {
    method: 'GET',
  });

  if (!response.ok) {
    throw new Error('Database status unavailable');
  }

  return response.json();
}
