import { motion } from 'framer-motion';

export function Hero() {
  return (
    <section className="relative min-h-[70vh] flex items-center justify-center overflow-hidden pt-16">
      {/* Decorative background */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#4f4f4f2e_1px,transparent_1px),linear-gradient(to_bottom,#4f4f4f2e_1px,transparent_1px)] bg-[size:14px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />
      </div>

      <div className="relative z-10 text-center px-4 max-w-4xl mx-auto">
        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-5xl md:text-7xl font-bold tracking-tight text-white mb-6"
        >
          See Beyond the <span className="text-brand-green">Pixels.</span>
        </motion.h1>
        
        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="text-lg md:text-xl text-gray-400 mb-10 max-w-2xl mx-auto"
        >
          SignalScope analyzes visual and frequency-domain evidence to estimate whether an image is likely synthetic or authentic.
        </motion.p>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="flex flex-col sm:flex-row gap-4 justify-center"
        >
          <a href="#analyzer" className="px-8 py-4 bg-white text-black font-semibold rounded-lg hover:bg-gray-200 transition-colors">
            Analyze an Image
          </a>
          <a href="#methodology" className="px-8 py-4 bg-surfaceHover text-white font-semibold rounded-lg border border-white/10 hover:bg-white/5 transition-colors">
            Explore Methodology
          </a>
        </motion.div>
      </div>
    </section>
  );
}
