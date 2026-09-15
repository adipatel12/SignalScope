import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ShieldAlert, 
  ShieldCheck, 
  Settings, 
  Activity, 
  History, 
  Lock, 
  LogOut, 
  CheckCircle2, 
  Download, 
  Trash2, 
  ExternalLink, 
  Sparkles, 
  Layers, 
  Sliders, 
  Search, 
  Filter, 
  FileText, 
  Clock, 
  Cpu 
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import type { AnalysisProfile, ScanHistoryItem } from '../types/auth';

interface ProfilePageProps {
  onNavigate: (view: 'home' | 'login' | 'register' | 'profile') => void;
}

type TabType = 'overview' | 'scans' | 'account' | 'security';

export function ProfilePage({ onNavigate }: ProfilePageProps) {
  const { 
    user, 
    logout, 
    updateProfile, 
    changePassword, 
    scanHistory, 
    deleteScan 
  } = useAuth();

  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Account form state
  const [name, setName] = useState(user?.name || '');
  const [department, setDepartment] = useState(user?.department || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [defaultProfile, setDefaultProfile] = useState<AnalysisProfile>(user?.defaultProfile || 'balanced');
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(user?.twoFactorEnabled ?? true);

  // Avatar presets
  const [avatarSeed, setAvatarSeed] = useState(user?.avatarSeed || 'alex-morgan-forensic');
  const [showAvatarModal, setShowAvatarModal] = useState(false);

  // Security password state
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  // Scan history filter & search
  const [searchQuery, setSearchQuery] = useState('');
  const [historyFilter, setHistoryFilter] = useState<'all' | 'synthetic' | 'authentic' | 'high-risk'>('all');
  const [selectedScanDetail, setSelectedScanDetail] = useState<ScanHistoryItem | null>(null);

  const showToast = (msg: string, isError = false) => {
    if (isError) {
      setErrorMessage(msg);
      setTimeout(() => setErrorMessage(null), 4000);
    } else {
      setSuccessMessage(msg);
      setTimeout(() => setSuccessMessage(null), 4000);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateProfile({
        name,
        department,
        bio,
        defaultProfile,
        twoFactorEnabled,
        avatarSeed,
      });
      showToast('Profile updated successfully.');
    } catch (err: any) {
      showToast(err.message || 'Failed to update profile.', true);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmNewPassword) {
      showToast('New passwords do not match.', true);
      return;
    }
    if (newPassword.length < 6) {
      showToast('New password must be at least 6 characters.', true);
      return;
    }

    try {
      await changePassword(oldPassword, newPassword);
      setOldPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      showToast('Password updated successfully.');
    } catch (err: any) {
      showToast(err.message || 'Failed to update password.', true);
    }
  };

  const exportScanReport = (scan: ScanHistoryItem) => {
    const reportData = {
      forensic_audit_report: "SignalScope Forensic Telemetry Report",
      investigator: user?.name || "Verified Analyst",
      scan_id: scan.id,
      timestamp: scan.createdAt,
      target_file: scan.filename,
      dimensions: scan.dimensions,
      classification: scan.prediction,
      risk_tier: scan.risk_tier,
      ai_confidence_score: `${(scan.confidence_ai * 100).toFixed(2)}%`,
      authentic_confidence_score: `${(scan.confidence_real * 100).toFixed(2)}%`,
      peak_frequency_anomaly: scan.peak_anomaly_score,
      analysis_profile: scan.profile_applied,
      calibration_engine: "SignalScope Frequency V2 + Platt Scaling (w=0.8042, b=-0.1060)"
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SignalScope_Report_${scan.filename.replace(/\.[^/.]+$/, "")}_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Forensic JSON Audit Report downloaded.');
  };

  // Real-time forensic analytics strictly from user's actual MongoDB scans
  const totalScansCount = scanHistory.length;
  const syntheticScans = scanHistory.filter(s => s.prediction.toLowerCase().includes('ai') || s.risk_tier.includes('SYNTHETIC'));
  const authenticScans = scanHistory.filter(s => !s.prediction.toLowerCase().includes('ai') && !s.risk_tier.includes('SYNTHETIC'));
  const syntheticRate = totalScansCount > 0 ? Math.round((syntheticScans.length / totalScansCount) * 100) : 0;
  const authenticRate = totalScansCount > 0 ? Math.round((authenticScans.length / totalScansCount) * 100) : 0;
  const avgPeakAnomaly = totalScansCount > 0 
    ? (scanHistory.reduce((acc, curr) => acc + (curr.peak_anomaly_score || 0), 0) / totalScansCount).toFixed(4)
    : '0.0000';

  // Filtered scans
  const filteredScans = scanHistory.filter(s => {
    const matchesSearch = s.filename.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          s.prediction.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          s.risk_tier.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;

    if (historyFilter === 'synthetic') {
      return s.prediction.toLowerCase().includes('ai') || s.risk_tier.includes('SYNTHETIC');
    }
    if (historyFilter === 'authentic') {
      return !s.prediction.toLowerCase().includes('ai') && !s.risk_tier.includes('SYNTHETIC');
    }
    if (historyFilter === 'high-risk') {
      return s.risk_tier.includes('HIGH_CONFIDENCE_SYNTHETIC') || s.confidence_ai >= 0.85;
    }
    return true;
  });

  const avatarGradients = [
    { id: 'alex-morgan-forensic', name: 'Neural Emerald', bg: 'from-emerald-500 to-green-800' },
    { id: 'cyan-cyber-agent', name: 'Quantum Cyan', bg: 'from-cyan-500 to-blue-800' },
    { id: 'purple-matrix', name: 'Deep Ultraviolet', bg: 'from-purple-500 to-indigo-900' },
    { id: 'amber-radar', name: 'Solar Anomaly', bg: 'from-amber-500 to-orange-800' },
    { id: 'crimson-guard', name: 'Cyber Sentinel', bg: 'from-rose-500 to-red-900' }
  ];

  const currentAvatarGrad = avatarGradients.find(a => a.id === avatarSeed) || avatarGradients[0];

  return (
    <div className="min-h-screen pt-24 pb-20 px-4 max-w-7xl mx-auto relative bg-background">
      {/* Background Cyber Grid */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#00ff410a_1px,transparent_1px),linear-gradient(to_bottom,#00ff410a_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_70%,transparent_100%)]" />
      </div>

      {/* Global Toast Notification */}
      <AnimatePresence>
        {successMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 right-8 z-50 p-4 rounded-xl bg-surface border border-brand-green/40 shadow-2xl flex items-center gap-3 text-brand-green text-sm font-mono backdrop-blur-lg"
          >
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span>{successMessage}</span>
          </motion.div>
        )}
        {errorMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 right-8 z-50 p-4 rounded-xl bg-surface border border-alert-red/40 shadow-2xl flex items-center gap-3 text-alert-red text-sm font-mono backdrop-blur-lg"
          >
            <ShieldAlert className="w-5 h-5 shrink-0" />
            <span>{errorMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Profile Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-2xl p-6 md:p-8 border border-white/10 mb-8 relative overflow-hidden shadow-2xl"
      >
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
            {/* Avatar with badge picker */}
            <div className="relative group cursor-pointer" onClick={() => setShowAvatarModal(true)}>
              <div className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${currentAvatarGrad.bg} flex items-center justify-center text-white text-2xl font-bold shadow-[0_0_25px_rgba(0,255,65,0.25)] border-2 border-white/20 transition-transform group-hover:scale-105`}>
                {user?.name ? user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : 'AM'}
              </div>
              <div className="absolute -bottom-1 -right-1 p-1.5 rounded-lg bg-surface border border-brand-green text-brand-green group-hover:bg-brand-green group-hover:text-black transition-colors">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Analyst Info */}
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
                  {user?.name || 'Dr. Alex Morgan'}
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-brand-green/10 text-brand-green border border-brand-green/30 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> VERIFIED INVESTIGATOR
                </span>
              </div>
              
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-400 font-mono">
                <span className="text-gray-300">{user?.email || 'analyst@signalscope.ai'}</span>
                <span>•</span>
                <span className="text-brand-cyan">{user?.department || 'Digital Media Forensics'}</span>
                <span>•</span>
                <span className="text-gray-400">{user?.securityTier || 'Tier 2 (Enterprise Forensic)'}</span>
              </div>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-3 self-stretch md:self-auto justify-end">
            <button
              onClick={() => onNavigate('home')}
              className="px-4 py-2.5 rounded-xl bg-brand-green text-black font-semibold text-xs font-mono tracking-wide hover:bg-brand-green/90 transition-all flex items-center gap-2 shadow-[0_0_15px_rgba(0,255,65,0.25)] cursor-pointer"
            >
              <Activity className="w-4 h-4" />
              <span>Launch Analyzer</span>
            </button>

            <button
              onClick={() => {
                logout();
                onNavigate('home');
              }}
              className="px-4 py-2.5 rounded-xl bg-surfaceHover border border-white/10 hover:border-alert-red hover:bg-alert-red/10 text-gray-300 hover:text-alert-red text-xs font-mono tracking-wide transition-all flex items-center gap-2 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>

        {/* Status Sub-bar */}
        <div className="mt-6 pt-6 border-t border-white/10 flex items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-2 text-gray-400">
            <Clock className="w-3.5 h-3.5 text-gray-500" />
            <span>Member Since: <strong className="text-gray-200">{user?.memberSince || '2026-09-15'}</strong></span>
          </div>
        </div>
      </motion.div>

      {/* Navigation Tabs (Only 4 focused tabs, no API quota) */}
      <div className="flex overflow-x-auto gap-2 border-b border-white/10 pb-3 mb-8 no-scrollbar font-mono text-sm">
        <TabButton 
          active={activeTab === 'overview'} 
          onClick={() => setActiveTab('overview')} 
          icon={Activity} 
          label="Forensic Overview" 
        />
        <TabButton 
          active={activeTab === 'scans'} 
          onClick={() => setActiveTab('scans')} 
          icon={History} 
          label={`Scan History (${totalScansCount})`} 
        />
        <TabButton 
          active={activeTab === 'account'} 
          onClick={() => setActiveTab('account')} 
          icon={Settings} 
          label="Account Profile" 
        />
        <TabButton 
          active={activeTab === 'security'} 
          onClick={() => setActiveTab('security')} 
          icon={Lock} 
          label="Security & Preferences" 
        />
      </div>

      {/* Tab 1: FORENSIC OVERVIEW */}
      {activeTab === 'overview' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
          {/* 4 Stat Cards calculated from real scans */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <StatCard 
              title="TOTAL SCANS" 
              value={totalScansCount.toString()} 
              subtitle="All-time forensic evaluations" 
              icon={Activity} 
              color="text-brand-green" 
            />
            <StatCard 
              title="SYNTHETIC DETECTIONS" 
              value={`${syntheticScans.length} (${syntheticRate}%)`} 
              subtitle="High & moderate AI anomalies" 
              icon={ShieldAlert} 
              color="text-alert-red" 
            />
            <StatCard 
              title="AUTHENTIC VALIDATED" 
              value={`${authenticScans.length} (${authenticRate}%)`} 
              subtitle="Natural optical photographs" 
              icon={ShieldCheck} 
              color="text-brand-cyan" 
            />
            <StatCard 
              title="AVG PEAK ANOMALY" 
              value={avgPeakAnomaly} 
              subtitle="Platt scaled frequency score" 
              icon={Cpu} 
              color="text-alert-amber" 
            />
          </div>

          {/* Model & Architecture Spec (Full Width) */}
          <div className="glass rounded-2xl p-6 border border-white/10 shadow-xl">
            <div className="flex items-center gap-2 text-brand-green mb-4">
              <Layers className="w-5 h-5" />
              <h3 className="font-mono text-sm font-semibold tracking-wider text-white uppercase">
                Active Forensic Engine Configuration
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 font-mono text-xs">
              <div className="p-4 rounded-xl bg-surface border border-white/5 space-y-1">
                <span className="text-gray-500 text-[11px]">DETECTION ARCHITECTURE</span>
                <div className="text-white font-semibold">SignalScope Frequency V2</div>
                <div className="text-gray-400 text-[11px]">Semantic Multi-Crop (Macro + 3x3 Grid)</div>
              </div>

              <div className="p-4 rounded-xl bg-surface border border-white/5 space-y-1">
                <span className="text-gray-500 text-[11px]">CALIBRATION CONSTANTS</span>
                <div className="text-white font-semibold">Platt Scaling Activated</div>
                <div className="text-brand-green text-[11px]">w = 0.8042 • b = -0.1060</div>
              </div>

              <div className="p-4 rounded-xl bg-surface border border-white/5 space-y-1">
                <span className="text-gray-500 text-[11px]">ACTIVE PROFILE THRESHOLD</span>
                <div className="text-white font-semibold uppercase">{defaultProfile} PROFILE</div>
                <div className="text-gray-400 text-[11px]">Decision Threshold = {defaultProfile === 'strict' ? '0.30' : defaultProfile === 'lenient' ? '0.70' : '0.50'}</div>
              </div>
            </div>
          </div>

          {/* Quick Recent Scans Preview */}
          <div className="glass rounded-2xl p-6 border border-white/10 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-brand-green" />
                <h3 className="font-mono text-sm font-semibold tracking-wider text-white uppercase">
                  Recent Forensic Scans
                </h3>
              </div>
              {scanHistory.length > 0 && (
                <button
                  onClick={() => setActiveTab('scans')}
                  className="text-xs font-mono text-brand-green hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <span>View All {totalScansCount} Scans</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {scanHistory.length === 0 ? (
              <div className="py-10 text-center space-y-3">
                <p className="text-xs font-mono text-gray-500">No forensic scans logged yet for your account.</p>
                <button
                  onClick={() => onNavigate('home')}
                  className="px-4 py-2 rounded-xl bg-brand-green text-black font-semibold text-xs font-mono hover:bg-brand-green/90 cursor-pointer"
                >
                  Analyze First Image
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {scanHistory.slice(0, 3).map((scan) => (
                  <ScanRowItem 
                    key={scan.id} 
                    scan={scan} 
                    onInspect={() => setSelectedScanDetail(scan)} 
                    onExport={() => exportScanReport(scan)}
                    onDelete={() => deleteScan(scan.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Tab 2: SCAN HISTORY */}
      {activeTab === 'scans' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          {/* Filter & Search Bar */}
          <div className="glass rounded-2xl p-4 border border-white/10 flex flex-col md:flex-row items-center justify-between gap-4">
            {/* Search */}
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search scans by filename, risk..."
                className="w-full pl-10 pr-4 py-2 bg-surface border border-white/10 rounded-xl text-white text-xs font-mono placeholder-gray-600 focus:outline-none focus:border-brand-green"
              />
            </div>

            {/* Filter Pills */}
            <div className="flex flex-wrap items-center gap-2 self-start md:self-auto font-mono text-xs">
              <span className="text-gray-500 flex items-center gap-1 mr-1">
                <Filter className="w-3.5 h-3.5" /> Filter:
              </span>
              <FilterPill active={historyFilter === 'all'} onClick={() => setHistoryFilter('all')} label="All Scans" count={scanHistory.length} />
              <FilterPill active={historyFilter === 'synthetic'} onClick={() => setHistoryFilter('synthetic')} label="AI Synthetic" count={syntheticScans.length} />
              <FilterPill active={historyFilter === 'authentic'} onClick={() => setHistoryFilter('authentic')} label="Authentic Real" count={authenticScans.length} />
              <FilterPill active={historyFilter === 'high-risk'} onClick={() => setHistoryFilter('high-risk')} label="High Risk" />
            </div>
          </div>

          {/* List of Scans */}
          {filteredScans.length === 0 ? (
            <div className="glass rounded-2xl p-12 border border-white/10 text-center space-y-4">
              <div className="w-12 h-12 mx-auto rounded-xl bg-surfaceHover border border-white/10 flex items-center justify-center text-gray-500">
                <History className="w-6 h-6" />
              </div>
              <h4 className="text-lg font-bold text-white font-mono">No telemetry records found</h4>
              <p className="text-xs text-gray-400 max-w-sm mx-auto">
                {scanHistory.length === 0 
                  ? "You have not performed any image analysis scans yet. Upload an image in the Analyzer Workspace to log forensic records."
                  : "No scans match your active filter."}
              </p>
              <button
                onClick={() => onNavigate('home')}
                className="px-5 py-2.5 rounded-xl bg-brand-green text-black font-semibold text-xs font-mono hover:bg-brand-green/90 cursor-pointer"
              >
                Launch Analyzer
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredScans.map((scan) => (
                <ScanRowItem 
                  key={scan.id} 
                  scan={scan} 
                  onInspect={() => setSelectedScanDetail(scan)} 
                  onExport={() => exportScanReport(scan)}
                  onDelete={() => deleteScan(scan.id)}
                />
              ))}
            </div>
          )}
        </motion.div>
      )}

      {/* Tab 3: ACCOUNT PROFILE */}
      {activeTab === 'account' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-2xl mx-auto">
          <div className="glass rounded-2xl p-8 border border-white/10 shadow-2xl">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/10">
              <Settings className="w-6 h-6 text-brand-green" />
              <div>
                <h3 className="text-lg font-bold text-white font-mono">Account Profile Settings</h3>
                <p className="text-xs text-gray-400">Manage identity credentials and specialization</p>
              </div>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-5">
              <div>
                <label className="block font-mono text-xs text-gray-300 uppercase tracking-wider mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full px-4 py-3 bg-surface border border-white/10 rounded-xl text-white font-mono text-sm focus:border-brand-green focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-mono text-xs text-gray-300 uppercase tracking-wider mb-2">
                  Department / Unit
                </label>
                <input
                  type="text"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="Deepfake Forensics Unit"
                  className="w-full px-4 py-3 bg-surface border border-white/10 rounded-xl text-white font-mono text-sm focus:border-brand-green focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-mono text-xs text-gray-300 uppercase tracking-wider mb-2">
                  Analyst Bio / Specialization
                </label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 bg-surface border border-white/10 rounded-xl text-white font-mono text-sm focus:border-brand-green focus:outline-none resize-none"
                />
              </div>

              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                type="submit"
                className="w-full py-3.5 px-6 rounded-xl bg-brand-green text-black font-semibold font-mono tracking-wide hover:bg-brand-green/90 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_20px_rgba(0,255,65,0.25)]"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Save Profile Changes</span>
              </motion.button>
            </form>
          </div>
        </motion.div>
      )}

      {/* Tab 4: SECURITY & PREFERENCES */}
      {activeTab === 'security' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-2xl mx-auto space-y-8">
          {/* Password Change Card */}
          <div className="glass rounded-2xl p-8 border border-white/10">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/10">
              <Lock className="w-6 h-6 text-brand-cyan" />
              <div>
                <h3 className="text-lg font-bold text-white font-mono">Change Password</h3>
                <p className="text-xs text-gray-400">Update your account credentials</p>
              </div>
            </div>

            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block font-mono text-xs text-gray-300 uppercase tracking-wider mb-2">
                  Current Password
                </label>
                <input
                  type="password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  required
                  placeholder="••••••••••••"
                  className="w-full px-4 py-3 bg-surface border border-white/10 rounded-xl text-white font-mono text-sm focus:border-brand-cyan focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-mono text-xs text-gray-300 uppercase tracking-wider mb-2">
                    New Password
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    placeholder="Min 6 characters"
                    className="w-full px-4 py-3 bg-surface border border-white/10 rounded-xl text-white font-mono text-sm focus:border-brand-cyan focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-mono text-xs text-gray-300 uppercase tracking-wider mb-2">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    required
                    placeholder="Repeat new password"
                    className="w-full px-4 py-3 bg-surface border border-white/10 rounded-xl text-white font-mono text-sm focus:border-brand-cyan focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 px-6 rounded-xl bg-brand-cyan text-black font-semibold font-mono tracking-wide hover:bg-brand-cyan/90 transition-all cursor-pointer mt-2"
              >
                Update Password
              </button>
            </form>
          </div>

          {/* Preferences Card */}
          <div className="glass rounded-2xl p-8 border border-white/10 space-y-6">
            <div className="flex items-center gap-3 pb-4 border-b border-white/10">
              <Sliders className="w-6 h-6 text-brand-green" />
              <div>
                <h3 className="text-lg font-bold text-white font-mono">Forensic Preferences & 2FA</h3>
                <p className="text-xs text-gray-400">Analysis defaults and verification protocol</p>
              </div>
            </div>

            {/* Default Analysis Profile */}
            <div>
              <label className="block font-mono text-xs text-gray-300 uppercase tracking-wider mb-2">
                Default Analysis Sensitivity Profile
              </label>
              <div className="grid grid-cols-3 gap-3 font-mono text-xs">
                {(['strict', 'balanced', 'lenient'] as AnalysisProfile[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => {
                      setDefaultProfile(p);
                      updateProfile({ defaultProfile: p });
                      showToast(`Default profile set to ${p.toUpperCase()}`);
                    }}
                    className={`py-3 px-4 rounded-xl border capitalize transition-all cursor-pointer ${
                      defaultProfile === p
                        ? 'bg-brand-green/10 border-brand-green text-brand-green font-bold shadow-[0_0_15px_rgba(0,255,65,0.2)]'
                        : 'bg-surface border-white/10 text-gray-400 hover:text-white'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
              <p className="text-[11px] font-mono text-gray-500 mt-2">
                {defaultProfile === 'strict' && 'Strict (0.30 Threshold): Flags subtle synthetic patterns aggressively.'}
                {defaultProfile === 'balanced' && 'Balanced (0.50 Threshold): Standard enterprise calibration for general forensic intake.'}
                {defaultProfile === 'lenient' && 'Lenient (0.70 Threshold): Minimizes false alarms on low-quality social media uploads.'}
              </p>
            </div>

            {/* 2FA Toggle */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-surface border border-white/5">
              <div>
                <div className="font-mono text-sm font-bold text-white">Two-Factor Authentication (2FA)</div>
                <div className="text-xs text-gray-400">Require cryptographic confirmation token during login</div>
              </div>
              <button
                type="button"
                onClick={() => {
                  const next = !twoFactorEnabled;
                  setTwoFactorEnabled(next);
                  updateProfile({ twoFactorEnabled: next });
                  showToast(next ? '2FA Protection Activated' : '2FA Deactivated');
                }}
                className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                  twoFactorEnabled ? 'bg-brand-green' : 'bg-gray-700'
                }`}
              >
                <div 
                  className={`w-4 h-4 rounded-full bg-black absolute top-1 transition-transform ${
                    twoFactorEnabled ? 'right-1' : 'left-1'
                  }`} 
                />
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* MODAL: Avatar Selector */}
      {showAvatarModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass rounded-2xl p-6 border border-white/10 max-w-md w-full space-y-5"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg text-white font-mono flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-brand-green" />
                Select Investigator Badge
              </h3>
              <button onClick={() => setShowAvatarModal(false)} className="text-gray-400 hover:text-white cursor-pointer">✕</button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {avatarGradients.map((grad) => (
                <button
                  key={grad.id}
                  onClick={() => {
                    setAvatarSeed(grad.id);
                    updateProfile({ avatarSeed: grad.id });
                    setShowAvatarModal(false);
                    showToast(`Avatar style updated to ${grad.name}`);
                  }}
                  className={`p-3 rounded-xl border flex items-center gap-3 transition-all cursor-pointer ${
                    avatarSeed === grad.id 
                      ? 'border-brand-green bg-brand-green/10' 
                      : 'border-white/10 bg-surface hover:border-white/30'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${grad.bg} flex items-center justify-center text-white font-bold shrink-0`}>
                    {user?.name ? user.name.slice(0, 2).toUpperCase() : 'AM'}
                  </div>
                  <div className="text-left font-mono text-xs text-gray-300">{grad.name}</div>
                </button>
              ))}
            </div>
          </motion.div>
        </div>
      )}

      {/* MODAL: Inspect Scan Detail */}
      {selectedScanDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass rounded-2xl p-6 border border-white/10 max-w-lg w-full space-y-5"
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-brand-green" />
                <h3 className="font-bold text-base text-white font-mono">Forensic Telemetry Inspector</h3>
              </div>
              <button onClick={() => setSelectedScanDetail(null)} className="text-gray-400 hover:text-white cursor-pointer">✕</button>
            </div>

            <div className="space-y-2 font-mono text-xs">
              <DetailRow label="FILE" value={selectedScanDetail.filename} />
              <DetailRow label="DIMENSIONS" value={selectedScanDetail.dimensions} />
              <DetailRow label="PREDICTION" value={selectedScanDetail.prediction} highlight={selectedScanDetail.prediction.includes('AI') ? 'text-alert-red font-bold' : 'text-brand-green font-bold'} />
              <DetailRow label="RISK TIER" value={selectedScanDetail.risk_tier} />
              <DetailRow label="AI CONFIDENCE" value={`${(selectedScanDetail.confidence_ai * 100).toFixed(2)}%`} />
              <DetailRow label="REAL CONFIDENCE" value={`${(selectedScanDetail.confidence_real * 100).toFixed(2)}%`} />
              <DetailRow label="PEAK ANOMALY" value={selectedScanDetail.peak_anomaly_score.toFixed(4)} />
              <DetailRow label="THRESHOLD USED" value={selectedScanDetail.threshold_used.toFixed(4)} />
              <DetailRow label="PROFILE APPLIED" value={selectedScanDetail.profile_applied.toUpperCase()} />
              <DetailRow label="REGIONS INSPECTED" value={selectedScanDetail.regions_inspected.toString()} />
              <DetailRow label="LOGGED AT" value={selectedScanDetail.createdAt.replace('T', ' ').replace('Z', ' UTC')} />
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-white/10">
              <button
                onClick={() => exportScanReport(selectedScanDetail)}
                className="px-4 py-2 rounded-xl bg-surface border border-white/10 hover:border-brand-green text-gray-200 hover:text-brand-green text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export JSON Report</span>
              </button>

              <button
                onClick={() => setSelectedScanDetail(null)}
                className="px-4 py-2 rounded-xl bg-brand-green text-black font-semibold text-xs font-mono hover:bg-brand-green/90 cursor-pointer"
              >
                Close Inspector
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

// Subcomponents

function TabButton({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: any; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-xl flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer ${
        active 
          ? 'bg-brand-green/10 text-brand-green border border-brand-green/30 font-bold shadow-[0_0_15px_rgba(0,255,65,0.15)]' 
          : 'text-gray-400 hover:text-white hover:bg-white/5'
      }`}
    >
      <Icon className="w-4 h-4" />
      <span>{label}</span>
    </button>
  );
}

function StatCard({ title, value, subtitle, icon: Icon, color }: { title: string; value: string; subtitle: string; icon: any; color: string }) {
  return (
    <div className="glass rounded-2xl p-5 border border-white/10 flex flex-col justify-between shadow-lg">
      <div className="flex items-center justify-between mb-3">
        <span className="font-mono text-[11px] text-gray-400 tracking-wider uppercase font-semibold">{title}</span>
        <Icon className={`w-5 h-5 ${color}`} />
      </div>
      <div>
        <div className={`text-2xl font-bold font-mono ${color}`}>{value}</div>
        <div className="text-[11px] font-mono text-gray-500 mt-1">{subtitle}</div>
      </div>
    </div>
  );
}

function FilterPill({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count?: number }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
        active 
          ? 'bg-brand-green text-black font-semibold' 
          : 'bg-surface border border-white/5 text-gray-400 hover:text-white'
      }`}
    >
      {label} {count !== undefined && <span className="opacity-80">({count})</span>}
    </button>
  );
}

function ScanRowItem({ 
  scan, 
  onInspect, 
  onExport, 
  onDelete 
}: { 
  scan: ScanHistoryItem; 
  onInspect: () => void; 
  onExport: () => void; 
  onDelete: () => void;
}) {
  const isSynthetic = scan.prediction.toLowerCase().includes('ai') || scan.risk_tier.includes('SYNTHETIC');
  const aiScore = Math.round(scan.confidence_ai * 100);

  return (
    <div className="glass rounded-xl p-4 border border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:border-white/20 transition-all">
      <div className="flex items-center gap-4">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
          isSynthetic ? 'bg-alert-red/10 text-alert-red border border-alert-red/30' : 'bg-brand-green/10 text-brand-green border border-brand-green/30'
        }`}>
          {isSynthetic ? <ShieldAlert className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
        </div>

        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-bold text-white truncate max-w-xs">{scan.filename}</span>
            <span className={`px-2 py-0.5 rounded text-[10px] font-mono ${
              isSynthetic ? 'bg-alert-red/10 text-alert-red' : 'bg-brand-green/10 text-brand-green'
            }`}>
              {isSynthetic ? `${aiScore}% AI SYNTHETIC` : `${100 - aiScore}% AUTHENTIC`}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-gray-500 mt-1">
            <span>{scan.dimensions}</span>
            <span>•</span>
            <span>Profile: {scan.profile_applied}</span>
            <span>•</span>
            <span>Logged: {scan.createdAt.split('T')[0]}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 self-end sm:self-auto">
        <button
          onClick={onInspect}
          className="px-3 py-1.5 rounded-lg bg-surfaceHover border border-white/10 hover:border-brand-cyan hover:text-brand-cyan text-xs font-mono text-gray-300 transition-colors cursor-pointer"
        >
          Inspect
        </button>
        <button
          onClick={onExport}
          title="Download JSON Report"
          className="p-1.5 rounded-lg bg-surfaceHover border border-white/10 hover:border-brand-green hover:text-brand-green text-gray-400 transition-colors cursor-pointer"
        >
          <Download className="w-4 h-4" />
        </button>
        <button
          onClick={onDelete}
          title="Delete Record"
          className="p-1.5 rounded-lg bg-surfaceHover border border-white/10 hover:border-alert-red hover:text-alert-red text-gray-400 transition-colors cursor-pointer"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function DetailRow({ label, value, highlight }: { label: string; value: string; highlight?: string }) {
  return (
    <div className="flex justify-between items-center border-b border-white/5 pb-1.5">
      <span className="text-gray-500">{label}</span>
      <span className={highlight || "text-gray-200 font-mono"}>{value}</span>
    </div>
  );
}
