import { Shield } from 'lucide-react';

export function Navbar() {
  return (
    <nav className="fixed top-0 w-full z-50 glass border-b-0 border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-6 h-6 text-brand-green" />
          <span className="font-mono text-xl tracking-widest font-bold text-white">SIGNALSCOPE</span>
        </div>
        <div className="hidden md:flex gap-8 text-sm font-medium tracking-wide">
          <a href="#analyzer" className="text-gray-400 hover:text-white transition-colors">Analyzer</a>
          <a href="#methodology" className="text-gray-400 hover:text-white transition-colors">Methodology</a>
          <a href="#architecture" className="text-gray-400 hover:text-white transition-colors">Architecture</a>
        </div>
      </div>
    </nav>
  );
}
