import { useState, useRef, useEffect } from 'react';
import { 
  Shield, 
  User as UserIcon, 
  LogOut, 
  History, 
  ChevronDown, 
  LogIn, 
  UserPlus 
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface NavbarProps {
  currentView: 'home' | 'login' | 'register' | 'profile';
  onNavigate: (view: 'home' | 'login' | 'register' | 'profile') => void;
}

export function Navbar({ currentView, onNavigate }: NavbarProps) {
  const { user, isAuthenticated, logout } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNavClick = (view: 'home' | 'login' | 'register' | 'profile', anchor?: string) => {
    onNavigate(view);
    if (anchor && view === 'home') {
      setTimeout(() => {
        const el = document.getElementById(anchor);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 50);
    }
  };

  return (
    <nav className="fixed top-0 w-full z-50 glass border-b border-white/10 bg-background/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <button 
          onClick={() => handleNavClick('home')} 
          className="flex items-center gap-2.5 focus:outline-none group cursor-pointer"
        >
          <div className="w-9 h-9 rounded-lg bg-brand-green/10 border border-brand-green/30 flex items-center justify-center text-brand-green group-hover:shadow-[0_0_15px_rgba(0,255,65,0.3)] transition-all">
            <Shield className="w-5 h-5" />
          </div>
          <div className="text-left">
            <span className="font-mono text-lg tracking-widest font-bold text-white block leading-none">SIGNALSCOPE</span>
            <span className="text-[10px] font-mono text-gray-400 tracking-wider">FORENSIC ENGINE</span>
          </div>
        </button>

        {/* Desktop Navigation Links */}
        <div className="hidden md:flex items-center gap-7 text-xs font-mono tracking-wider">
          <button 
            onClick={() => handleNavClick('home', 'analyzer')} 
            className={`transition-colors hover:text-brand-green cursor-pointer ${
              currentView === 'home' ? 'text-gray-200' : 'text-gray-400'
            }`}
          >
            ANALYZER
          </button>
          <button 
            onClick={() => handleNavClick('home', 'methodology')} 
            className="text-gray-400 hover:text-brand-green transition-colors cursor-pointer"
          >
            METHODOLOGY
          </button>
          <button 
            onClick={() => handleNavClick('home', 'architecture')} 
            className="text-gray-400 hover:text-brand-green transition-colors cursor-pointer"
          >
            ARCHITECTURE
          </button>
        </div>

        {/* Right Authentication / Profile Actions */}
        <div className="flex items-center gap-3">
          {isAuthenticated && user ? (
            /* Authenticated User Pill & Dropdown */
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className={`flex items-center gap-2.5 p-1.5 pr-3 rounded-full border transition-all cursor-pointer ${
                  dropdownOpen || currentView === 'profile'
                    ? 'border-brand-green bg-brand-green/10 shadow-[0_0_15px_rgba(0,255,65,0.2)]'
                    : 'border-white/10 bg-surface hover:border-white/20'
                }`}
              >
                <div className="w-7 h-7 rounded-full bg-brand-green/20 border border-brand-green/40 text-brand-green text-xs font-mono font-bold flex items-center justify-center">
                  {user.name ? user.name.slice(0, 2).toUpperCase() : 'AM'}
                </div>
                <div className="hidden sm:block text-left text-xs font-mono">
                  <span className="text-white font-semibold block leading-tight max-w-[120px] truncate">{user.name}</span>
                  <span className="text-[10px] text-brand-green leading-tight block">{user.role.split(' ')[0]}</span>
                </div>
                <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Dropdown Menu */}
              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-surface border border-white/10 shadow-2xl p-2 z-50 backdrop-blur-xl font-mono text-xs space-y-1">
                  <div className="px-3 py-2 border-b border-white/5">
                    <div className="text-white font-bold truncate">{user.name}</div>
                    <div className="text-[10px] text-gray-400 truncate">{user.email}</div>
                  </div>

                  <button
                    onClick={() => {
                      onNavigate('profile');
                      setDropdownOpen(false);
                    }}
                    className="w-full px-3 py-2 rounded-xl flex items-center gap-2 text-gray-300 hover:text-brand-green hover:bg-brand-green/10 transition-colors text-left"
                  >
                    <UserIcon className="w-4 h-4 text-brand-green" />
                    <span>Profile & Forensics</span>
                  </button>

                  <button
                    onClick={() => {
                      onNavigate('profile');
                      setDropdownOpen(false);
                    }}
                    className="w-full px-3 py-2 rounded-xl flex items-center gap-2 text-gray-300 hover:text-brand-cyan hover:bg-brand-cyan/10 transition-colors text-left"
                  >
                    <History className="w-4 h-4 text-brand-cyan" />
                    <span>Scan History</span>
                  </button>

                  <div className="border-t border-white/5 pt-1">
                    <button
                      onClick={() => {
                        logout();
                        setDropdownOpen(false);
                        onNavigate('home');
                      }}
                      className="w-full px-3 py-2 rounded-xl flex items-center gap-2 text-alert-red hover:bg-alert-red/10 transition-colors text-left cursor-pointer"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Unauthenticated: Sign In & Register buttons */
            <div className="flex items-center gap-2.5 font-mono text-xs">
              <button
                onClick={() => onNavigate('login')}
                className={`px-3.5 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                  currentView === 'login'
                    ? 'bg-surface border border-brand-green text-brand-green'
                    : 'text-gray-300 hover:text-white hover:bg-white/5'
                }`}
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </button>

              <button
                onClick={() => onNavigate('register')}
                className={`px-4 py-2 rounded-xl bg-brand-green text-black font-semibold transition-all shadow-[0_0_15px_rgba(0,255,65,0.25)] hover:bg-brand-green/90 cursor-pointer flex items-center gap-1.5 ${
                  currentView === 'register' ? 'ring-2 ring-brand-green ring-offset-2 ring-offset-black' : ''
                }`}
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Register</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
