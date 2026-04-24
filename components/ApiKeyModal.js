'use client';

import { useState } from 'react';

const PROVIDERS = [
  {
    id: 'fal',
    name: 'fal.ai',
    desc: 'Premium: Flux 2 Pro/Max, Seedance 2.0 video',
    link: 'https://fal.ai/dashboard/keys',
    optional: true,
    color: 'purple',
  },
  {
    id: 'together',
    name: 'Together AI',
    desc: 'Free: FLUX.1-schnell (unlimited) + $25 credits',
    link: 'https://api.together.xyz/settings/api-keys',
    optional: true,
    color: 'blue',
  },
  {
    id: 'huggingface',
    name: 'Hugging Face',
    desc: 'Free: ~200 images/day, open-source models',
    link: 'https://huggingface.co/settings/tokens',
    optional: true,
    color: 'yellow',
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    desc: 'Free: ~500 images/day, Gemini 2.0 Flash',
    link: 'https://aistudio.google.com/apikey',
    optional: true,
    color: 'cyan',
  },
];

export default function ApiKeyModal({ onSave }) {
  const [keys, setKeys] = useState({});
  const [step, setStep] = useState(0);

  const currentProvider = PROVIDERS[step];
  const nextProvider = PROVIDERS[step + 1];

  const handleSkip = () => {
    if (nextProvider) {
      setStep(step + 1);
    } else {
      // Done — save whatever keys we have
      onSave(keys);
    }
  };

  const handleAddKey = () => {
    const key = keys[currentProvider.id]?.trim();
    if (key) {
      // Move to next
      if (nextProvider) {
        setStep(step + 1);
      } else {
        onSave(keys);
      }
    } else {
      handleSkip();
    }
  };

  const colorBorders = {
    purple: 'border-purple-500/30 focus:ring-purple-500/30',
    blue: 'border-blue-500/30 focus:ring-blue-500/30',
    yellow: 'border-yellow-500/30 focus:ring-yellow-500/30',
    cyan: 'border-cyan-500/30 focus:ring-cyan-500/30',
  };

  const colorBgs = {
    purple: 'bg-purple-500/5 border-purple-500/10',
    blue: 'bg-blue-500/5 border-blue-500/10',
    yellow: 'bg-yellow-500/5 border-yellow-500/10',
    cyan: 'bg-cyan-500/5 border-cyan-500/10',
  };

  return (
    <div className="min-h-screen bg-[#030303] flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-[#0a0a0a]/40 backdrop-blur-xl border border-white/10 rounded-xl p-10 shadow-2xl animate-fade-in-up">
        {/* Progress dots */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {PROVIDERS.map((p, i) => (
            <div key={p.id} className={`w-2 h-2 rounded-full transition-all ${
              i === step ? 'bg-[#d9ff00] scale-125' : i < step ? 'bg-[#d9ff00]/40' : 'bg-white/10'
            }`} />
          ))}
        </div>

        <div className="flex flex-col items-center text-center mb-8">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border mb-6 ${colorBgs[currentProvider.color]}`}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#d9ff00" strokeWidth="1.5">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight mb-2">
            AI Creative Studio
          </h1>
          <p className="text-white/40 text-[13px] leading-relaxed px-4">
            Add API keys for more models, or skip to use free models right away.
          </p>
        </div>

        {/* Current provider card */}
        <div className="space-y-4">
          <div className="bg-white/5 border border-white/[0.03] rounded-lg p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-bold text-white">{currentProvider.name}</span>
              <span className="text-[10px] font-bold text-green-400 bg-green-500/10 px-2 py-0.5 rounded">OPTIONAL</span>
            </div>
            <p className="text-[12px] text-white/40 mb-3">{currentProvider.desc}</p>
            <label className="block text-xs font-bold text-white/30 mb-2">
              {currentProvider.name} API Key
            </label>
            <input
              type="password"
              value={keys[currentProvider.id] || ''}
              onChange={(e) => setKeys({ ...keys, [currentProvider.id]: e.target.value })}
              placeholder={`Enter your ${currentProvider.name} key...`}
              className={`w-full bg-white/5 border rounded-md px-5 py-3 text-sm text-white placeholder:text-white/10 focus:outline-none focus:ring-1 focus:bg-white/[0.07] transition-all ${colorBorders[currentProvider.color]}`}
            />
            <a
              href={currentProvider.link}
              target="_blank"
              rel="noreferrer"
              className="inline-block mt-2 text-[11px] text-white/30 hover:text-[#d9ff00] transition-colors"
            >
              Get a key at {currentProvider.name} &rarr;
            </a>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleSkip}
              className="flex-1 h-10 rounded-md bg-white/5 text-white/60 hover:bg-white/10 text-xs font-semibold transition-all cursor-pointer border border-white/5"
            >
              {nextProvider ? 'Skip' : 'Skip All'}
            </button>
            <button
              onClick={handleAddKey}
              className="flex-1 h-10 rounded-md bg-[#d9ff00] text-black font-medium hover:bg-[#e5ff33] hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-[#d9ff00]/5 cursor-pointer text-xs"
            >
              {nextProvider ? 'Add & Next' : 'Start Creating'}
            </button>
          </div>

          <p className="text-center text-[11px] text-white/20 pt-2">
            Free models (Pollinations.ai) work with no keys at all
          </p>
        </div>
      </div>
    </div>
  );
}
