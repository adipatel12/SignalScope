import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Shield, 
  Lock, 
  Mail, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  Zap, 
  CheckCircle2, 
  AlertCircle, 
  Database, 
  KeyRound,
  Fingerprint
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface LoginPageProps {
  onNavigate: (view: 'home' | 'login' | 'register' | 'profile') => void;
}

export function LoginPage({ onNavigate }: LoginPageProps) {
  const { login, loginDemo, isLoading, dbHealth } = useAuth();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please provide both email and password.');
      return;
    }

    setError(null);
    try {
      await login({ email, password });
      onNavigate('profile');
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please verify your credentials.');
    }
  };

  const handleDemoLogin = async () => {
    setError(null);
    try {
      await loginDemo();
      onNavigate('profile');
    } catch (err: any) {
      setError(err.message || 'Demo login failed');
    }
  };


  return (
    <div className="min-h-screen pt-24 pb-16 px-4 flex items-center justify-center relative overflow-hidden bg-background">
      {/* Decorative Cyber Background Grid */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#00ff410d_1px,transparent_1px),linear-gradient(to_bottom,#00ff410d_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_40%,#000_60%,transparent_100%)]" />
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-brand-green/5 blur-[120px] rounded-full pointer-events-none" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 w-full max-w-md"
      >
        {/* Main Card */}
        <div className="glass rounded-2xl p-8 border border-white/10 shadow-2xl backdrop-blur-xl relative">
          {/* Top Brand Banner */}
          <div className="flex flex-col items-center text-center mb-8">
            <div className="relative mb-4">
              <div className="w-14 h-14 rounded-xl bg-brand-green/10 border border-brand-green/30 flex items-center justify-center text-brand-green shadow-[0_0_20px_rgba(0,255,65,0.2)]">
                <Shield className="w-8 h-8" />
              </div>
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-brand-green rounded-full animate-ping" />
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-brand-green rounded-full" />
            </div>

            <span className="font-mono text-xs tracking-widest text-brand-green uppercase font-semibold mb-1">
              Forensic Access Portal
            </span>
            <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
              Sign In to SignalScope
            </h1>
            <p className="text-gray-400 text-sm mt-1">
              Enter your credentials to access forensic telemetry
            </p>
          </div>

          {/* Quick 1-Click Demo Login Button */}
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            type="button"
            onClick={handleDemoLogin}
            className="w-full mb-6 p-3.5 rounded-xl bg-surfaceHover border border-brand-green/30 hover:border-brand-green hover:bg-brand-green/10 text-white flex items-center justify-between group transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-brand-green/20 text-brand-green flex items-center justify-center">
                <Zap className="w-4 h-4" />
              </div>
              <div className="text-left">
                <div className="text-xs font-mono text-brand-green font-semibold">1-CLICK INSTANT ACCESS</div>
                <div className="text-sm font-medium text-gray-200">Try Demo Analyst Account</div>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-brand-green group-hover:translate-x-0.5 transition-all" />
          </motion.button>

          <div className="relative flex py-2 items-center mb-6">
            <div className="flex-grow border-t border-white/10" />
            <span className="flex-shrink mx-4 text-xs font-mono text-gray-500 uppercase tracking-widest">Or Sign In Manually</span>
            <div className="flex-grow border-t border-white/10" />
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

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block font-mono text-xs text-gray-300 uppercase tracking-wider mb-2">
                Analyst Email
              </label>
              <div className="relative">
                <Mail className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="analyst@signalscope.ai"
                  required
                  className="w-full pl-11 pr-4 py-3 bg-surface border border-white/10 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-brand-green focus:ring-1 focus:ring-brand-green font-mono text-sm transition-all"
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="font-mono text-xs text-gray-300 uppercase tracking-wider">
                  Password
                </label>
              </div>
              <div className="relative">
                <Lock className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  className="w-full pl-11 pr-11 py-3 bg-surface border border-white/10 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-brand-green focus:ring-1 focus:ring-brand-green font-mono text-sm transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-gray-400 font-mono">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-white/10 bg-surface text-brand-green focus:ring-brand-green"
                />
                <span>Remember Session</span>
              </label>

              <span className="text-[11px] font-mono text-gray-500 flex items-center gap-1">
                <Fingerprint className="w-3.5 h-3.5 text-brand-green" /> 2FA Ready
              </span>
            </div>

            {/* Submit Button */}
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              type="submit"
              disabled={isLoading}
              className="w-full mt-6 py-3.5 px-6 rounded-xl bg-brand-green text-black font-semibold tracking-wide hover:bg-brand-green/90 transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(0,255,65,0.3)] disabled:opacity-50 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  <span>Signing In...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </motion.button>
          </form>

          {/* Switch to Register */}
          <div className="mt-8 pt-6 border-t border-white/10 text-center text-sm text-gray-400">
            Don't have an analyst account yet?{' '}
            <button
              type="button"
              onClick={() => onNavigate('register')}
              className="text-brand-green font-semibold hover:underline"
            >
              Register Clearance
            </button>
          </div>
        </div>

        {/* Security Badges */}
        <div className="mt-6 flex justify-center items-center gap-6 text-xs text-gray-500 font-mono">
          <span className="flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-brand-green" /> AES-256 Vault
          </span>
          <span>•</span>
          <span className="flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-brand-green" /> Platt Calibration
          </span>
          <span>•</span>
          <span className="flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-brand-green" /> Zero Knowledge
          </span>
        </div>
      </motion.div>


    </div>
  );
}
