export function Methodology() {
  return (
    <section id="methodology" className="py-24 bg-black border-t border-white/5">
      <div className="max-w-5xl mx-auto px-4">
        
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold tracking-wider mb-4">FORENSIC METHODOLOGY</h2>
          <p className="text-gray-400 max-w-2xl mx-auto">
            SignalScope employs a dual-stream architecture, analyzing both spatial structures and frequency-domain artifacts to detect synthetic media.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          
          {/* Spatial Stream */}
          <div className="glass p-8 rounded-xl border border-white/10">
            <div className="w-12 h-12 rounded-full bg-brand-green/10 flex items-center justify-center mb-6">
              <span className="text-brand-green font-mono font-bold text-xl">1</span>
            </div>
            <h3 className="text-xl font-bold mb-3 tracking-wide">SPATIAL ANALYSIS</h3>
            <p className="text-gray-400 text-sm leading-relaxed mb-4">
              The first stream uses a ConvNeXt-based backbone to evaluate the raw RGB pixel data. This detects spatial inconsistencies common in AI models, such as:
            </p>
            <ul className="list-disc list-inside text-gray-500 text-sm space-y-2 font-mono">
              <li>Asymmetric anatomical structures</li>
              <li>Nonsensical background textures</li>
              <li>Lighting and shadow mismatches</li>
            </ul>
          </div>

          {/* Frequency Stream */}
          <div className="glass p-8 rounded-xl border border-white/10">
            <div className="w-12 h-12 rounded-full bg-brand-cyan/10 flex items-center justify-center mb-6">
              <span className="text-brand-cyan font-mono font-bold text-xl">2</span>
            </div>
            <h3 className="text-xl font-bold mb-3 tracking-wide">FREQUENCY DOMAIN</h3>
            <p className="text-gray-400 text-sm leading-relaxed mb-4">
              The second stream applies a 2D Fast Fourier Transform (FFT) to extract the frequency magnitude spectrum. This reveals invisible artifacts:
            </p>
            <ul className="list-disc list-inside text-gray-500 text-sm space-y-2 font-mono">
              <li>Generative grid patterns (Up-conv artifacts)</li>
              <li>Unnatural high-frequency noise</li>
              <li>Compression discrepancies</li>
            </ul>
          </div>

        </div>
        
        {/* Architecture Flow */}
        <div id="architecture" className="mt-16 glass p-8 rounded-xl border border-white/10">
          <h3 className="text-xl font-bold mb-8 tracking-wide text-center">PIPELINE ARCHITECTURE</h3>
          
          <div className="flex flex-col items-center space-y-4 font-mono text-sm">
            <FlowStep label="IMAGE UPLOAD" />
            <FlowArrow />
            <FlowStep label="SEMANTIC MULTI-CROP (9 REGIONS + GLOBAL)" />
            <FlowArrow />
            <FlowStep label="DUAL-STREAM INFERENCE (SPATIAL + FFT)" />
            <FlowArrow />
            <FlowStep label="RAW LOGIT EXTRACTION" />
            <FlowArrow />
            <FlowStep label="PLATT SCALING CALIBRATION" highlight />
            <FlowArrow />
            <FlowStep label="ROBUST MEDIAN AGGREGATION" />
            <FlowArrow />
            <FlowStep label="FINAL FORENSIC RESULT" />
          </div>
        </div>
        
      </div>
    </section>
  );
}

function FlowStep({ label, highlight = false }: { label: string, highlight?: boolean }) {
  return (
    <div className={`px-6 py-3 rounded text-center min-w-[300px] border ${highlight ? 'border-brand-green text-brand-green bg-brand-green/10' : 'border-white/20 text-gray-300 bg-white/5'}`}>
      {label}
    </div>
  );
}

function FlowArrow() {
  return <div className="text-gray-600 text-xl">↓</div>;
}
