export type ForensicRole = 
  | 'Forensic Investigator'
  | 'Security Analyst'
  | 'Media Verification Specialist'
  | 'Research Scientist'
  | 'Academic / Student';

export type SecurityTier = 
  | 'Tier 1 (Analyst)'
  | 'Tier 2 (Enterprise Forensic)'
  | 'Tier 3 (Lead Investigator)';

export type AnalysisProfile = 'balanced' | 'strict' | 'lenient';

export interface User {
  id: string;
  name: string;
  email: string;
  organization: string;
  department?: string;
  role: ForensicRole;
  bio?: string;
  avatarUrl?: string;
  avatarSeed?: string;
  securityTier: SecurityTier;
  timezone?: string;
  defaultProfile: AnalysisProfile;
  twoFactorEnabled: boolean;
  memberSince: string;
  createdAt?: string;
}

export interface ScanHistoryItem {
  id: string;
  userId: string;
  userEmail?: string;
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
  imageUrl?: string;
  createdAt: string;
}

export interface DatabaseHealth {
  is_connected: boolean;
  database_name: string;
  cluster?: string;
  storage_mode: string;
  total_users: number;
  total_scans: number;
  connection_error?: string | null;
}

export interface AuthResponse {
  status: string;
  message: string;
  token?: string;
  user: User;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  organization?: string;
  department?: string;
  role?: ForensicRole;
  securityTier?: SecurityTier;
  timezone?: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface ProfileUpdatePayload {
  name?: string;
  organization?: string;
  department?: string;
  bio?: string;
  avatarUrl?: string;
  avatarSeed?: string;
  timezone?: string;
  defaultProfile?: AnalysisProfile;
  twoFactorEnabled?: boolean;
}
