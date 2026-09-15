import { useState, useRef, useEffect } from 'react';
import { Upload, X, AlertCircle, Lock, LogIn, UserPlus, Zap, ChevronLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import { analyzeImage, analyzeBatch } from '../services/api';
import type { PredictionResponse } from '../services/api';
import { LoadingSequence } from './LoadingSequence';
import { ResultDashboard } from './ResultDashboard';
import { cn } from '../utils/cn';
import { useAuth } from '../context/AuthContext';

export function AnalyzerWorkspace() {
  const { user, isAuthenticated, saveScan, addScanToState, loginDemo } = useAuth();

  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [profile, setProfile] = useState<string>(user?.defaultProfile || 'balanced');

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [results, setResults] = useState<PredictionResponse[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [selectedResultIndex, setSelectedResultIndex] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user?.defaultProfile) {
      setProfile(user.defaultProfile);
    }
  }, [user?.defaultProfile]);

  const handleFiles = (selectedFiles: FileList | File[]) => {
    const validFiles = Array.from(selectedFiles).filter(f => f.type.startsWith('image/'));
    if (validFiles.length === 0) {
      setError('Please select valid image files (PNG, JPG, JPEG).');
      return;
    }

    // Cleanup previous object urls
    previews.forEach(p => URL.revokeObjectURL(p));

    setFiles(validFiles);
    setPreviews(validFiles.map(f => URL.createObjectURL(f)));
    setResults(null);
    setError(null);
    setSelectedResultIndex(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (!isAuthenticated) return;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleAnalyze = async () => {
    if (files.length === 0) return;
    if (!isAuthenticated) {
      setError('You must be signed in to perform forensic analysis.');
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setResults(null);
    setSelectedResultIndex(null);

    try {
      let responses: PredictionResponse[] = [];
      if (files.length === 1) {
        const response = await analyzeImage(files[0], profile);
        responses = [response];
      } else {
        responses = await analyzeBatch(files, profile);
      }

      setResults(responses);

      // Update scan history if backend persisted it
      for (const response of responses) {
        if (response.id && response.createdAt) {
          addScanToState(response as any);
        } else {
          // Fallback if backend couldn't persist
          try {
            await saveScan({
              userId: user?.id || 'anonymous',
              userEmail: user?.email || 'anonymous@signalscope.ai',
              filename: response.filename,
              dimensions: response.dimensions,
              prediction: response.prediction,
              risk_tier: response.risk_tier,
              confidence_ai: response.confidence_ai,
              confidence_real: response.confidence_real,
              peak_anomaly_score: response.peak_anomaly_score,
              threshold_used: response.threshold_used,
              profile_applied: response.profile_applied,
              regions_inspected: response.regions_inspected,
            });
          } catch (saveErr) {
            console.warn('Scan auto-save note:', saveErr);
          }
        }
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred during analysis.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleReset = () => {
    setFiles([]);
    previews.forEach(p => URL.revokeObjectURL(p));
    setPreviews([]);
    setResults(null);
    setError(null);
    setSelectedResultIndex(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (index: number) => {
    const newFiles = [...files];
    newFiles.splice(index, 1);
    const newPreviews = [...previews];
    URL.revokeObjectURL(newPreviews[index]);
    newPreviews.splice(index, 1);

    setFiles(newFiles);
    setPreviews(newPreviews);
    if (newFiles.length === 0) {
      handleReset();
    }
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

        {/* LOCKED STATE: When User is Not Logged In */}
        {!isAuthenticated ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass rounded-2xl p-8 md:p-12 border border-brand-green/20 text-center max-w-xl mx-auto relative overflow-hidden shadow-2xl"
          >
            <div className="w-16 h-16 mx-auto rounded-2xl bg-brand-green/10 border border-brand-green/30 flex items-center justify-center text-brand-green mb-6 shadow-[0_0_25px_rgba(0,255,65,0.2)]">
              <Lock className="w-8 h-8" />
            </div>

            <span className="font-mono text-xs tracking-widest text-brand-green uppercase font-semibold">
              Restricted Forensic Terminal
            </span>
            <h3 className="text-2xl font-bold text-white tracking-tight mt-1 mb-3 font-mono">
              Authentication Required to Analyze Images
            </h3>
            <p className="text-gray-400 text-sm mb-8 leading-relaxed">
              Image forensic verification and frequency spectrum decomposition require an active investigator session. All analysis telemetry is securely committed to MongoDB Atlas.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center mb-4">
              <a
                href="#login"
                className="px-6 py-3 rounded-xl bg-brand-green text-black font-semibold text-xs font-mono tracking-wide hover:bg-brand-green/90 transition-all flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(0,255,65,0.25)]"
              >
                <LogIn className="w-4 h-4" />
                <span>Sign In to Terminal</span>
              </a>

              <a
                href="#register"
                className="px-6 py-3 rounded-xl bg-surfaceHover border border-white/10 hover:border-brand-green text-white text-xs font-mono tracking-wide transition-all flex items-center justify-center gap-2"
              >
                <UserPlus className="w-4 h-4" />
                <span>Register Clearance</span>
              </a>
            </div>

            <button
              onClick={loginDemo}
              className="text-xs font-mono text-gray-500 hover:text-brand-green transition-colors flex items-center justify-center gap-1.5 mx-auto pt-2"
            >
              <Zap className="w-3.5 h-3.5 text-brand-green" />
              <span>Or click here to try Demo Analyst Account</span>
            </button>
          </motion.div>
        ) : (
          /* AUTHENTICATED STATE: Normal Upload & Analysis */
          <>
            {!isAnalyzing && !results && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass rounded-2xl p-8 md:p-12 border border-white/10">
                <div className="max-w-3xl mx-auto space-y-6">

                  <div className="space-y-2 max-w-md mx-auto">
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

                  {files.length === 0 ? (
                    <div
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-white/20 hover:border-brand-green/50 rounded-xl p-12 text-center cursor-pointer transition-all hover:bg-brand-green/5 group max-w-md mx-auto"
                    >
                      <Upload className="w-10 h-10 mx-auto mb-4 text-gray-500 group-hover:text-brand-green transition-colors" />
                      <p className="font-mono text-sm text-gray-300">DROP IMAGES</p>
                      <p className="font-mono text-xs text-gray-500 mt-2">PNG / JPG / JPEG (Batch Supported)</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-h-[300px] overflow-y-auto p-2">
                        {previews.map((prev, idx) => (
                          <div key={idx} className="relative rounded-xl overflow-hidden bg-black border border-white/10 aspect-square flex items-center justify-center group">
                            <img src={prev} alt="Upload preview" className="max-w-full max-h-full object-cover w-full h-full" />
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                              <button onClick={() => removeFile(idx)} className="p-2 bg-alert-red/20 text-alert-red rounded-full hover:bg-alert-red hover:text-white transition-colors">
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                            <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/90 to-transparent">
                              <p className="font-mono text-[10px] text-white truncate">{files[idx].name}</p>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="flex justify-center gap-4 pt-4">
                        <button onClick={handleReset} className="px-6 py-3 border border-white/10 text-white rounded-lg font-mono text-sm tracking-widest hover:bg-white/5 transition-all">
                          CLEAR ALL
                        </button>
                        <button onClick={() => fileInputRef.current?.click()} className="px-6 py-3 border border-brand-green/30 text-brand-green rounded-lg font-mono text-sm tracking-widest hover:bg-brand-green/10 transition-all">
                          ADD MORE
                        </button>
                      </div>
                    </div>
                  )}

                  <input
                    type="file"
                    ref={fileInputRef}
                    multiple
                    onChange={(e) => { if (e.target.files?.length) handleFiles(e.target.files) }}
                    className="hidden"
                    accept="image/png, image/jpeg, image/jpg"
                  />

                  <div className="max-w-md mx-auto">
                    <button
                      onClick={handleAnalyze}
                      disabled={files.length === 0}
                      className={cn(
                        "w-full py-4 rounded-lg font-mono font-bold tracking-widest transition-all cursor-pointer mt-4",
                        files.length > 0 ? "bg-brand-green text-black hover:bg-[#00cc33] hover:shadow-[0_0_20px_rgba(0,255,65,0.3)]" : "bg-white/5 text-gray-600 cursor-not-allowed"
                      )}
                    >
                      {files.length > 1 ? `ANALYZE BATCH (${files.length})` : "ANALYZE IMAGE"}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {isAnalyzing && (
              <div className="py-20">
                <LoadingSequence />
              </div>
            )}

            {results && (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-6">

                {results.length === 1 || selectedResultIndex !== null ? (
                  <>
                    {results.length > 1 && (
                      <button
                        onClick={() => setSelectedResultIndex(null)}
                        className="flex items-center gap-2 text-gray-400 hover:text-brand-green transition-colors font-mono text-sm mb-4"
                      >
                        <ChevronLeft className="w-4 h-4" />
                        BACK TO BATCH RESULTS
                      </button>
                    )}
                    <ResultDashboard
                      result={selectedResultIndex !== null ? results[selectedResultIndex] : results[0]}
                      imagePreviewUrl={selectedResultIndex !== null ? previews[selectedResultIndex] : previews[0]}
                    />
                  </>
                ) : (
                  <div className="glass rounded-2xl p-6 border border-white/10">
                    <h3 className="font-mono text-lg text-white mb-6 border-b border-white/10 pb-4">BATCH RESULTS ({results.length})</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {results.map((res, idx) => {
                        const isAI = res.prediction.includes('AI');
                        return (
                          <div
                            key={idx}
                            onClick={() => setSelectedResultIndex(idx)}
                            className="bg-black/40 border border-white/5 rounded-xl p-4 cursor-pointer hover:border-brand-green/30 transition-all group flex items-center gap-4"
                          >
                            <img src={previews[idx]} className="w-16 h-16 rounded-lg object-cover border border-white/10" alt="thumb" />
                            <div className="flex-1 min-w-0">
                              <p className="text-white font-mono text-sm truncate">{res.filename}</p>
                              <div className="flex items-center justify-between mt-2">
                                <span className={cn("text-xs font-mono", isAI ? "text-alert-red" : "text-brand-green")}>
                                  {isAI ? 'AI GENERATED' : 'AUTHENTIC'}
                                </span>
                                <span className="text-xs font-mono text-gray-500">
                                  {(res.confidence_ai * 100).toFixed(1)}% AI
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="flex justify-center pt-8">
                  <button onClick={handleReset} className="px-8 py-3 bg-surface hover:bg-surfaceHover border border-white/10 rounded-lg font-mono text-sm tracking-wider transition-colors">
                    {results.length > 1 ? "ANALYZE NEW BATCH" : "ANALYZE ANOTHER IMAGE"}
                  </button>
                </div>
              </motion.div>
            )}
          </>
        )}

      </div>
    </section>
  );
}
