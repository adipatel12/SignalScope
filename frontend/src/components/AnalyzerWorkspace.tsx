import { useState, useRef } from 'react';
import { Upload, X, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { analyzeImage } from '../services/api';
import type { PredictionResponse } from '../services/api';
import { LoadingSequence } from './LoadingSequence';
import { ResultDashboard } from './ResultDashboard';
import { cn } from '../utils/cn';

export function AnalyzerWorkspace() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [profile, setProfile] = useState<string>('balanced');
  
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<PredictionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (selectedFile: File) => {
    if (!selectedFile.type.startsWith('image/')) {
      setError('Please select a valid image file (PNG, JPG, JPEG).');
      return;
    }
    
    // Cleanup previous object url
    if (preview) URL.revokeObjectURL(preview);
    
    setFile(selectedFile);
    setPreview(URL.createObjectURL(selectedFile));
    setResult(null);
    setError(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleAnalyze = async () => {
    if (!file) return;
    
    setIsAnalyzing(true);
    setError(null);
    setResult(null);
    
    try {
      const response = await analyzeImage(file, profile);
      setResult(response);
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred during analysis.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setResult(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <section id="analyzer" className="py-20 px-4">
      <div className="max-w-5xl mx-auto space-y-8">
        
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold tracking-wider mb-2">FORENSIC ANALYZER</h2>
          <p className="text-gray-400 font-mono text-sm uppercase tracking-widest">Enterprise Image Verification Engine</p>
        </div>

        {error && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="p-4 rounded border border-alert-red/50 bg-alert-red/10 text-alert-red flex items-center gap-3">
            <AlertCircle className="w-5 h-5" />
            <p className="font-mono text-sm">{error}</p>
          </motion.div>
        )}

        {!isAnalyzing && !result && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass rounded-2xl p-8 md:p-12 border border-white/10">
            <div className="max-w-md mx-auto space-y-6">
              
              <div className="space-y-2">
                <label className="text-xs font-mono text-gray-400 tracking-widest">DETECTION PROFILE</label>
                <select 
                  value={profile} 
                  onChange={(e) => setProfile(e.target.value)}
                  className="w-full bg-black/50 border border-white/10 text-white rounded-lg px-4 py-3 font-mono text-sm focus:outline-none focus:border-brand-green/50 transition-colors"
                >
                  <option value="balanced">Balanced (Standard Default)</option>
                  <option value="lenient">Lenient (Smartphone HDR Optimized)</option>
                  <option value="strict">Strict (Journalism & Legal Triage)</option>
                </select>
              </div>

              {!file ? (
                <div 
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-white/20 hover:border-brand-green/50 rounded-xl p-12 text-center cursor-pointer transition-all hover:bg-brand-green/5 group"
                >
                  <Upload className="w-10 h-10 mx-auto mb-4 text-gray-500 group-hover:text-brand-green transition-colors" />
                  <p className="font-mono text-sm text-gray-300">DROP AN IMAGE HERE</p>
                  <p className="font-mono text-xs text-gray-500 mt-2">PNG / JPG / JPEG</p>
                </div>
              ) : (
                <div className="relative rounded-xl overflow-hidden bg-black border border-white/10 aspect-video flex items-center justify-center group">
                  <img src={preview!} alt="Upload preview" className="max-w-full max-h-full object-contain" />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                    <button onClick={handleReset} className="p-3 bg-alert-red/20 text-alert-red rounded-full hover:bg-alert-red hover:text-white transition-colors">
                      <X className="w-6 h-6" />
                    </button>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/90 to-transparent">
                    <p className="font-mono text-xs text-white truncate">{file.name}</p>
                    <p className="font-mono text-[10px] text-gray-400">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                </div>
              )}
              
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={(e) => { if(e.target.files?.length) handleFile(e.target.files[0]) }} 
                className="hidden" 
                accept="image/png, image/jpeg, image/jpg"
              />

              <button 
                onClick={handleAnalyze}
                disabled={!file}
                className={cn(
                  "w-full py-4 rounded-lg font-mono font-bold tracking-widest transition-all",
                  file ? "bg-brand-green text-black hover:bg-[#00cc33] hover:shadow-[0_0_20px_rgba(0,255,65,0.3)]" : "bg-white/5 text-gray-600 cursor-not-allowed"
                )}
              >
                ANALYZE IMAGE
              </button>
            </div>
          </motion.div>
        )}

        {isAnalyzing && (
          <div className="py-20">
            <LoadingSequence />
          </div>
        )}

        {result && !isAnalyzing && (
          <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="space-y-8">
            <ResultDashboard result={result} imagePreviewUrl={preview} />
            <div className="flex justify-center">
              <button 
                onClick={handleReset}
                className="px-8 py-3 rounded border border-white/20 text-white font-mono text-sm hover:bg-white/10 transition-colors"
              >
                ANALYZE ANOTHER IMAGE
              </button>
            </div>
          </motion.div>
        )}
        
      </div>
    </section>
  );
}
