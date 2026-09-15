import { motion } from 'framer-motion';
import type { PredictionResponse } from '../services/api';
import { cn } from '../utils/cn';
import { ShieldAlert, ShieldCheck, Activity, BarChart2 } from 'lucide-react';

interface ResultDashboardProps {
  result: PredictionResponse;
  imagePreviewUrl: string | null;
}

export function ResultDashboard({ result, imagePreviewUrl }: ResultDashboardProps) {
  const isSynthetic = result.prediction.toLowerCase().includes('ai-generated') || result.risk_tier.includes('SYNTHETIC');
  const isAmber = result.risk_tier === "MODERATE_SYNTHETIC_ANOMALY";
  
  let themeColor = "text-brand-green border-brand-green/30 bg-brand-green/10";
  let Icon = ShieldCheck;
  
  if (isSynthetic) {
    if (isAmber) {
      themeColor = "text-alert-amber border-alert-amber/30 bg-alert-amber/10";
      Icon = ShieldAlert;
    } else {
      themeColor = "text-alert-red border-alert-red/30 bg-alert-red/10";
      Icon = ShieldAlert;
    }
  }

  const aiPercent = Math.round(result.confidence_ai * 100);

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      <div className={cn("p-8 rounded-xl border flex flex-col md:flex-row items-center gap-8", themeColor)}>
        <div className="flex-1 flex flex-col justify-center items-center md:items-start text-center md:text-left">
          <div className="flex items-center gap-3 mb-2">
            <Icon className="w-8 h-8" />
            <h2 className="text-3xl font-bold tracking-wider">{result.prediction.toUpperCase()}</h2>
          </div>
          <p className="font-mono text-sm opacity-80 mt-1">RISK TIER: {result.risk_tier}</p>
        </div>
        
        {/* Animated Gauge */}
        <div className="relative w-48 h-48 flex items-center justify-center shrink-0">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="8" className="opacity-20" />
            <motion.circle 
              cx="50" cy="50" r="45" 
              fill="none" stroke="currentColor" strokeWidth="8"
              strokeDasharray="283"
              initial={{ strokeDashoffset: 283 }}
              animate={{ strokeDashoffset: 283 - (283 * result.confidence_ai) }}
              transition={{ duration: 1.5, ease: "easeOut" }}
              className="drop-shadow-lg"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-4xl font-bold font-mono">{aiPercent}%</span>
            <span className="text-xs tracking-widest opacity-80 mt-1">AI SCORE</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Image Viewer */}
        <div className="glass rounded-xl p-4 border border-white/10 flex flex-col">
          <div className="flex items-center gap-2 mb-4 px-2 text-gray-400">
            <Activity className="w-4 h-4" />
            <span className="text-sm font-mono tracking-wide">FORENSIC SUBJECT</span>
          </div>
          <div className="relative flex-1 bg-black rounded-lg overflow-hidden flex items-center justify-center min-h-[300px]">
            {imagePreviewUrl && (
              <img src={imagePreviewUrl} alt="Analyzed Subject" className="max-w-full max-h-[400px] object-contain" />
            )}
            <div className="absolute top-4 left-4 bg-black/60 backdrop-blur text-xs font-mono px-2 py-1 rounded text-white/70 border border-white/10">
              {result.dimensions}
            </div>
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#4f4f4f2e_1px,transparent_1px),linear-gradient(to_bottom,#4f4f4f2e_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none opacity-30" />
          </div>
        </div>

        {/* Forensic Details */}
        <div className="glass rounded-xl p-4 border border-white/10 flex flex-col">
          <div className="flex items-center gap-2 mb-4 px-2 text-gray-400">
            <BarChart2 className="w-4 h-4" />
            <span className="text-sm font-mono tracking-wide">FORENSIC DETAILS</span>
          </div>
          <div className="flex-1 bg-black/50 rounded-lg p-6 font-mono text-sm space-y-4">
            <DetailRow label="FILE" value={result.filename} />
            <DetailRow label="DIMENSIONS" value={result.dimensions} />
            <DetailRow label="REAL CONFIDENCE" value={`${(result.confidence_real * 100).toFixed(2)}%`} />
            <DetailRow label="AI CONFIDENCE" value={`${(result.confidence_ai * 100).toFixed(2)}%`} />
            <DetailRow label="PEAK ANOMALY" value={result.peak_anomaly_score.toFixed(4)} />
            <DetailRow label="THRESHOLD USED" value={result.threshold_used.toFixed(4)} />
            <DetailRow label="PROFILE APPLIED" value={result.profile_applied.toUpperCase()} />
            <DetailRow label="REGIONS INSPECTED" value={result.regions_inspected.toString()} />
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string, value: string }) {
  return (
    <div className="flex justify-between items-center border-b border-white/5 pb-2">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-200">{value}</span>
    </div>
  );
}
