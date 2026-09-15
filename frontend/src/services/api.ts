export interface PredictionResponse {
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
}

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

export async function analyzeImage(file: File, profile: string): Promise<PredictionResponse> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('profile', profile);

  const response = await fetch(`${API_BASE_URL}/analyze/`, {
    method: 'POST',
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
