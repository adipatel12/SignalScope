export function Footer() {
  return (
    <footer className="border-t border-white/5 bg-black py-12 text-center">
      <div className="max-w-5xl mx-auto px-4">
        <p className="font-mono text-sm text-gray-500 tracking-widest mb-4">
          SIGNALSCOPE © {new Date().getFullYear()}
        </p>
        <p className="text-xs text-gray-600 max-w-xl mx-auto">
          Enterprise AI Image Forensics. The backend is the single source of truth. 
          Frontend visualizations strictly reflect backend analytical predictions.
        </p>
      </div>
    </footer>
  );
}
