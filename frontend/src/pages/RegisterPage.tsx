import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  ShieldCheck, 
  Lock, 
  Mail, 
  User as UserIcon, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  Check, 
  X, 
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import type { ForensicRole, SecurityTier } from '../types/auth';

interface RegisterPageProps {
  onNavigate: (view: 'home' | 'login' | 'register' | 'profile') => void;
}

export function RegisterPage({ onNavigate }: RegisterPageProps) {
  const { register, isLoading } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<ForensicRole>('Forensic Investigator');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Password strength checks
  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);
  const passwordsMatch = password.length > 0 && password === confirmPassword;

  const strengthScore = [hasMinLength, hasUppercase, hasNumber, hasSpecial].filter(Boolean).length;
  
  const getStrengthLabel = () => {
    if (strengthScore === 0) return { label: 'Empty', color: 'bg-gray-600', text: 'text-gray-400' };
    if (strengthScore <= 2) return { label: 'Weak', color: 'bg-alert-red', text: 'text-alert-red' };
    if (strengthScore === 3) return { label: 'Moderate', color: 'bg-alert-amber', text: 'text-alert-amber' };
    return { label: 'Forensic Grade', color: 'bg-brand-green', text: 'text-brand-green' };
  };

  const strengthInfo = getStrengthLabel();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreeTerms) {
      setError('You must accept the SignalScope Forensic Audit Agreement.');
      return;
    }
    if (!passwordsMatch) {
      setError('Passwords do not match.');
      return;
    }
    if (strengthScore < 2) {
      setError('Please choose a stronger password meeting the security criteria.');
      return;
    }

    setError(null);
    try {
      let securityTier: SecurityTier = 'Tier 2 (Enterprise Forensic)';
      if (role === 'Forensic Investigator') securityTier = 'Tier 3 (Lead Investigator)';
      else if (role === 'Academic / Student') securityTier = 'Tier 1 (Analyst)';

      await register({
        name,
        email,
        password,
        organization: 'SignalScope Forensic Lab',
        role,
        securityTier,
      });

      onNavigate('profile');
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please try again.');
    }
  };

  return (
    <div className="min-h-screen pt-24 pb-16 px-4 flex items-center justify-center relative overflow-hidden bg-background">
      {/* Decorative Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#00ff410d_1px,transparent_1px),linear-gradient(to_bottom,#00ff410d_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_40%,#000_60%,transparent_100%)]" />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] bg-brand-cyan/5 blur-[130px] rounded-full pointer-events-none" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 w-full max-w-xl"
      >
        <div className="glass rounded-2xl p-8 border border-white/10 shadow-2xl backdrop-blur-xl">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-14 h-14 mx-auto rounded-xl bg-brand-cyan/10 border border-brand-cyan/30 flex items-center justify-center text-brand-cyan mb-4 shadow-[0_0_20px_rgba(0,229,255,0.2)]">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <span className="font-mono text-xs tracking-widest text-brand-cyan uppercase font-semibold">
              Investigator Onboarding
            </span>
            <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight mt-1">
              Create Analyst Account
            </h1>
            <p className="text-gray-400 text-sm mt-1">
              Join SignalScope to authenticate media and manage forensic telemetry
            </p>
          </div>

          {/* Error Alert */}
          {error && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mb-6 p-3.5 rounded-xl bg-alert-red/10 border border-alert-red/30 flex items-start gap-3 text-alert-red text-sm"
            >
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Full Name */}
              <div>
                <label className="block font-mono text-xs text-gray-300 uppercase tracking-wider mb-2">
                  Full Name
                </label>
                <div className="relative">
                  <UserIcon className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Dr. Jordan Hayes"
                    required
                    className="w-full pl-11 pr-4 py-3 bg-surface border border-white/10 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-brand-cyan focus:ring-1 focus:ring-brand-cyan font-mono text-sm transition-all"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block font-mono text-xs text-gray-300 uppercase tracking-wider mb-2">
                  Enterprise Email
                </label>
                <div className="relative">
                  <Mail className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="jordan.hayes@lab.gov"
                    required
                    className="w-full pl-11 pr-4 py-3 bg-surface border border-white/10 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-brand-cyan focus:ring-1 focus:ring-brand-cyan font-mono text-sm transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Role Selection */}
            <div>
              <label className="block font-mono text-xs text-gray-300 uppercase tracking-wider mb-2">
                Forensic Role
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as ForensicRole)}
                className="w-full px-4 py-3 bg-surface border border-white/10 rounded-xl text-white focus:outline-none focus:border-brand-cyan focus:ring-1 focus:ring-brand-cyan font-mono text-sm transition-all cursor-pointer"
              >
                <option value="Forensic Investigator">Forensic Investigator (Tier 3)</option>
                <option value="Security Analyst">Security Analyst (Tier 2)</option>
                <option value="Media Verification Specialist">Media Verification Specialist (Tier 2)</option>
                <option value="Research Scientist">Research Scientist (Tier 2)</option>
                <option value="Academic / Student">Academic / Student (Tier 1)</option>
              </select>
            </div>

            {/* Password */}
            <div>
              <label className="block font-mono text-xs text-gray-300 uppercase tracking-wider mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 8 characters with mix of cases"
                  required
                  className="w-full pl-11 pr-11 py-3 bg-surface border border-white/10 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-brand-cyan focus:ring-1 focus:ring-brand-cyan font-mono text-sm transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Password Strength Meter */}
              {password.length > 0 && (
                <div className="mt-2.5 p-3 rounded-lg bg-black/40 border border-white/5 space-y-2">
                  <div className="flex justify-between items-center text-xs font-mono">
                    <span className="text-gray-400">Security Strength:</span>
                    <span className={`font-semibold ${strengthInfo.text}`}>{strengthInfo.label}</span>
                  </div>

                  {/* Strength Bar */}
                  <div className="grid grid-cols-4 gap-1.5 h-1.5">
                    {[1, 2, 3, 4].map((step) => (
                      <div
                        key={step}
                        className={`h-full rounded-full transition-all ${
                          strengthScore >= step ? strengthInfo.color : 'bg-gray-800'
                        }`}
                      />
                    ))}
                  </div>

                  {/* Criteria Checklist */}
                  <div className="grid grid-cols-2 gap-1.5 pt-1 text-[11px] font-mono">
                    <div className={`flex items-center gap-1.5 ${hasMinLength ? 'text-brand-green' : 'text-gray-500'}`}>
                      {hasMinLength ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                      <span>8+ Characters</span>
                    </div>
                    <div className={`flex items-center gap-1.5 ${hasUppercase ? 'text-brand-green' : 'text-gray-500'}`}>
                      {hasUppercase ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                      <span>Uppercase Letter</span>
                    </div>
                    <div className={`flex items-center gap-1.5 ${hasNumber ? 'text-brand-green' : 'text-gray-500'}`}>
                      {hasNumber ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                      <span>Number (0-9)</span>
                    </div>
                    <div className={`flex items-center gap-1.5 ${hasSpecial ? 'text-brand-green' : 'text-gray-500'}`}>
                      {hasSpecial ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                      <span>Special Symbol (!@#$)</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block font-mono text-xs text-gray-300 uppercase tracking-wider mb-2">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat password"
                  required
                  className={`w-full pl-11 pr-4 py-3 bg-surface border rounded-xl text-white placeholder-gray-600 focus:outline-none font-mono text-sm transition-all ${
                    confirmPassword.length > 0 
                      ? passwordsMatch 
                        ? 'border-brand-green focus:border-brand-green focus:ring-1 focus:ring-brand-green' 
                        : 'border-alert-red focus:border-alert-red focus:ring-1 focus:ring-alert-red'
                      : 'border-white/10 focus:border-brand-cyan focus:ring-1 focus:ring-brand-cyan'
                  }`}
                />
              </div>
            </div>

            {/* Terms Agreement */}
            <div className="pt-2">
              <label className="flex items-start gap-3 cursor-pointer select-none text-xs text-gray-400 font-mono">
                <input
                  type="checkbox"
                  checked={agreeTerms}
                  onChange={(e) => setAgreeTerms(e.target.checked)}
                  className="mt-0.5 rounded border-white/10 bg-surface text-brand-cyan focus:ring-brand-cyan"
                />
                <span className="leading-relaxed">
                  I agree to the <span className="text-brand-cyan">SignalScope Forensic Audit Policy</span>, agreeing that synthetic attribution telemetry will be securely logged in the verification ledger.
                </span>
              </label>
            </div>

            {/* Submit Button */}
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              type="submit"
              disabled={isLoading}
              className="w-full mt-4 py-3.5 px-6 rounded-xl bg-brand-cyan text-black font-semibold tracking-wide hover:bg-brand-cyan/90 transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(0,229,255,0.3)] disabled:opacity-50 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  <span>Creating Account...</span>
                </>
              ) : (
                <>
                  <span>Create Analyst Account</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </motion.button>
          </form>

          {/* Switch to Login */}
          <div className="mt-8 pt-6 border-t border-white/10 text-center text-sm text-gray-400">
            Already have an active account?{' '}
            <button
              type="button"
              onClick={() => onNavigate('login')}
              className="text-brand-cyan font-semibold hover:underline cursor-pointer"
            >
              Sign In
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
