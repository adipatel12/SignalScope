import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

const steps = [
  "INITIALIZING SIGNALSCOPE",
  "READING IMAGE",
  "ANALYZING VISUAL SIGNALS",
  "PROCESSING FORENSIC RESULT"
];

export function LoadingSequence() {
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStep((prev) => (prev < steps.length - 1 ? prev + 1 : prev));
    }, 600); // Progress every 600ms visually
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center p-12 glass rounded-xl w-full max-w-2xl mx-auto border border-white/10 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-1 bg-brand-green/20">
        <motion.div 
          className="h-full bg-brand-green" 
          initial={{ width: "0%" }}
          animate={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>
      
      <div className="w-16 h-16 mb-8 relative">
        <div className="absolute inset-0 border-2 border-brand-green border-t-transparent rounded-full animate-spin"></div>
        <div className="absolute inset-2 border-2 border-brand-cyan border-b-transparent rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
      </div>
      
      <div className="text-center font-mono space-y-2">
        {steps.map((step, index) => (
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 10 }}
            animate={{ 
              opacity: index === currentStep ? 1 : index < currentStep ? 0.3 : 0,
              y: 0 
            }}
            className={index === currentStep ? "text-brand-green font-bold text-lg" : "text-gray-500 text-sm"}
          >
            {index <= currentStep && "> "} {step}
          </motion.div>
        ))}
      </div>
      
      {/* Decorative scanline */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-brand-green/5 to-transparent h-20 animate-scan pointer-events-none" />
    </div>
  );
}
