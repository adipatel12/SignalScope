import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { 
  User, 
  ScanHistoryItem, 
  LoginPayload, 
  RegisterPayload, 
  ProfileUpdatePayload,
  DatabaseHealth 
} from '../types/auth';
import { 
  loginApi, 
  registerApi, 
  updateProfileApi, 
  changePasswordApi, 
  getScansApi, 
  saveScanApi, 
  deleteScanApi, 
  getDbStatusApi 
} from '../services/api';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  token: string | null;
  scanHistory: ScanHistoryItem[];
  dbHealth: DatabaseHealth | null;
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => void;
  updateProfile: (updates: ProfileUpdatePayload) => Promise<void>;
  changePassword: (oldPass: string, newPass: string) => Promise<void>;
  saveScan: (scanData: Partial<ScanHistoryItem> & Omit<ScanHistoryItem, 'userId' | 'userEmail'>) => Promise<ScanHistoryItem>;
  deleteScan: (scanId: string) => Promise<void>;
  addScanToState: (scan: ScanHistoryItem) => void;
  refreshDbStatus: () => Promise<void>;
  loginDemo: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DEMO_USER: User = {
  id: 'user_demo_alex_morgan',
  name: 'Dr. Alex Morgan',
  email: 'alex.morgan@signalscope.ai',
  organization: 'National Cyber Forensics Lab',
  department: 'Digital Media & Deepfake Verification Unit',
  role: 'Forensic Investigator',
  bio: 'Lead forensic analyst specializing in multi-spectral frequency analysis and synthetic artifact detection.',
  avatarUrl: '',
  avatarSeed: 'alex-morgan-forensic',
  securityTier: 'Tier 3 (Lead Investigator)',
  timezone: 'UTC-05:00 (Eastern Time)',
  defaultProfile: 'balanced',
  twoFactorEnabled: true,
  memberSince: '2025-11-14',
  createdAt: '2025-11-14T09:30:00Z'
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('signalscope_user');
    return saved ? JSON.parse(saved) : null;
  });
  
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem('signalscope_token') || null;
  });

  const [scanHistory, setScanHistory] = useState<ScanHistoryItem[]>(() => {
    const savedUser = localStorage.getItem('signalscope_user');
    if (savedUser) {
      try {
        const u = JSON.parse(savedUser);
        const userScans = localStorage.getItem(`signalscope_scans_${u.id}`);
        if (userScans) return JSON.parse(userScans);
      } catch {}
    }
    const general = localStorage.getItem('signalscope_scans');
    return general ? JSON.parse(general) : [];
  });

  const [dbHealth, setDbHealth] = useState<DatabaseHealth | null>({
    is_connected: true,
    database_name: 'signalscope_db',
    cluster: 'sih.62ir5ni.mongodb.net',
    storage_mode: 'MongoDB Atlas Cloud Cluster (sih.62ir5ni.mongodb.net)',
    total_users: 1,
    total_scans: 0
  });

  const [isLoading, setIsLoading] = useState(false);

  const refreshDbStatus = useCallback(async () => {
    try {
      const status = await getDbStatusApi();
      setDbHealth(status);
    } catch {
      // Fallback
    }
  }, []);

  // Fetch scans from MongoDB Atlas on login / token change
  const loadUserData = useCallback(async (authToken: string, currentUserId?: string) => {
    try {
      const scans = await getScansApi(authToken);
      setScanHistory(scans);
      if (currentUserId) {
        localStorage.setItem(`signalscope_scans_${currentUserId}`, JSON.stringify(scans));
      }
      localStorage.setItem('signalscope_scans', JSON.stringify(scans));
    } catch {
      // If offline, check local cache for this user
      if (currentUserId) {
        const cached = localStorage.getItem(`signalscope_scans_${currentUserId}`);
        if (cached) setScanHistory(JSON.parse(cached));
      }
    }
  }, []);

  useEffect(() => {
    refreshDbStatus();
    if (token && user) {
      loadUserData(token, user.id);
    }
  }, [token, user?.id, loadUserData, refreshDbStatus]);

  // Sync user state to LocalStorage
  useEffect(() => {
    if (user) {
      localStorage.setItem('signalscope_user', JSON.stringify(user));
    }
  }, [user]);

  useEffect(() => {
    if (token) {
      localStorage.setItem('signalscope_token', token);
    }
  }, [token]);

  useEffect(() => {
    if (user && scanHistory.length >= 0) {
      localStorage.setItem(`signalscope_scans_${user.id}`, JSON.stringify(scanHistory));
      localStorage.setItem('signalscope_scans', JSON.stringify(scanHistory));
    }
  }, [scanHistory, user]);

  const login = async (payload: LoginPayload) => {
    setIsLoading(true);
    try {
      try {
        const res = await loginApi(payload);
        const loggedUser = res.user;
        const authToken = res.token || `ss_sess_${Date.now()}`;
        
        setUser(loggedUser);
        setToken(authToken);
        localStorage.setItem('signalscope_user', JSON.stringify(loggedUser));
        localStorage.setItem('signalscope_token', authToken);

        // Load existing user scans from local cache first if available
        const cached = localStorage.getItem(`signalscope_scans_${loggedUser.id}`);
        if (cached) {
          try { setScanHistory(JSON.parse(cached)); } catch {}
        }

        // Fetch fresh from MongoDB Atlas
        await loadUserData(authToken, loggedUser.id);
        refreshDbStatus();
        return;
      } catch (backendErr: any) {
        if (payload.email.toLowerCase() === DEMO_USER.email.toLowerCase() && payload.password === 'password123') {
          setUser(DEMO_USER);
          const demoToken = 'ss_sess_demo_alex_morgan';
          setToken(demoToken);
          localStorage.setItem('signalscope_user', JSON.stringify(DEMO_USER));
          localStorage.setItem('signalscope_token', demoToken);
          await loadUserData(demoToken, DEMO_USER.id);
          return;
        }
        throw backendErr;
      }
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (payload: RegisterPayload) => {
    setIsLoading(true);
    try {
      const res = await registerApi(payload);
      const newUser = res.user;
      const authToken = res.token || `ss_sess_${Date.now()}`;
      
      setUser(newUser);
      setToken(authToken);
      setScanHistory([]); // Brand new user starts with 0 scans
      localStorage.setItem('signalscope_user', JSON.stringify(newUser));
      localStorage.setItem('signalscope_token', authToken);
      localStorage.setItem(`signalscope_scans_${newUser.id}`, JSON.stringify([]));
      refreshDbStatus();
    } finally {
      setIsLoading(false);
    }
  };

  const loginDemo = async () => {
    setUser(DEMO_USER);
    const demoToken = 'ss_sess_demo_alex_morgan';
    setToken(demoToken);
    localStorage.setItem('signalscope_user', JSON.stringify(DEMO_USER));
    localStorage.setItem('signalscope_token', demoToken);
    await loadUserData(demoToken, DEMO_USER.id);
  };

  const logout = () => {
    // Save current user's scan history to per-user cache before clearing active session
    if (user) {
      localStorage.setItem(`signalscope_scans_${user.id}`, JSON.stringify(scanHistory));
    }
    setUser(null);
    setToken(null);
    setScanHistory([]);
    localStorage.removeItem('signalscope_user');
    localStorage.removeItem('signalscope_token');
  };

  const updateProfile = async (updates: ProfileUpdatePayload) => {
    if (!user) return;
    setIsLoading(true);
    try {
      const res = await updateProfileApi(updates);
      setUser(res.user);
      localStorage.setItem('signalscope_user', JSON.stringify(res.user));
    } catch {
      setUser(prev => prev ? { ...prev, ...updates } : null);
    } finally {
      setIsLoading(false);
    }
  };

  const changePassword = async (oldPass: string, newPass: string) => {
    await changePasswordApi(oldPass, newPass);
  };

  const saveScan = async (scanData: Omit<ScanHistoryItem, 'id' | 'createdAt'>): Promise<ScanHistoryItem> => {
    const newId = `scan_${Date.now()}`;
    const newScan: ScanHistoryItem = {
      ...scanData,
      id: newId,
      userId: user?.id || 'anonymous',
      userEmail: user?.email || 'anonymous@signalscope.ai',
      createdAt: new Date().toISOString()
    };

    try {
      const res = await saveScanApi(scanData);
      const saved = res.scan || newScan;
      setScanHistory(prev => {
        const updated = [saved, ...prev];
        if (user) {
          localStorage.setItem(`signalscope_scans_${user.id}`, JSON.stringify(updated));
        }
        return updated;
      });
      refreshDbStatus();
      return saved;
    } catch {
      setScanHistory(prev => {
        const updated = [newScan, ...prev];
        if (user) {
          localStorage.setItem(`signalscope_scans_${user.id}`, JSON.stringify(updated));
        }
        return updated;
      });
      return newScan;
    }
  };

  const addScanToState = (scan: ScanHistoryItem) => {
    setScanHistory(prev => {
      if (prev.some(s => s.id === scan.id)) return prev;
      const updated = [scan, ...prev];
      if (user) {
        localStorage.setItem(`signalscope_scans_${user.id}`, JSON.stringify(updated));
      }
      return updated;
    });
  };

  const deleteScan = async (scanId: string) => {
    try {
      await deleteScanApi(scanId);
    } catch {
      // ignore
    }
    setScanHistory(prev => {
      const updated = prev.filter(s => s.id !== scanId);
      if (user) {
        localStorage.setItem(`signalscope_scans_${user.id}`, JSON.stringify(updated));
      }
      return updated;
    });
    refreshDbStatus();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        token,
        scanHistory,
        dbHealth,
        login,
        register,
        logout,
        updateProfile,
        changePassword,
        saveScan,
        deleteScan,
        addScanToState,
        refreshDbStatus,
        loginDemo,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
