'use client';

import { useState, useRef, useCallback } from 'react';

const PROVIDERS = {
  pollinations: { name: 'Pollinations.ai', keyRequired: false, desc: 'Free, no key needed' },
  together: { name: 'Together AI', keyRequired: true, keyName: 'together', desc: 'Free FLUX.1-schnell' },
  huggingface: { name: 'Hugging Face', keyRequired: true, keyName: 'huggingface', desc: 'Free ~200/day' },
  gemini: { name: 'Google Gemini', keyRequired: true, keyName: 'gemini', desc: 'Free ~500/day' },
  fal: { name: 'fal.ai', keyRequired: true, keyName: 'fal', desc: 'Premium quality' },
};

const MODELS = [
  // ===== FREE — NO KEY NEEDED (Pollinations.ai) =====
  { id: 'pollinations-flux', provider: 'pollinations', name: 'Flux', desc: 'High quality, unlimited free', tier: 'free', payload: { model: 'flux' }, supportsRef: false },
  { id: 'pollinations-turbo', provider: 'pollinations', name: 'Flux Turbo', desc: 'Fast generation, no queue', tier: 'free', payload: { model: 'turbo' }, supportsRef: false },
  { id: 'pollinations-realism', provider: 'pollinations', name: 'Flux Realism', desc: 'Photo-realistic output', tier: 'free', payload: { model: 'flux-realism' }, supportsRef: false },
  { id: 'pollinations-anime', provider: 'pollinations', name: 'Flux Anime', desc: 'Anime / illustration style', tier: 'free', payload: { model: 'flux-anime' }, supportsRef: false },
  { id: 'pollinations-3d', provider: 'pollinations', name: 'Flux 3D', desc: '3D render style', tier: 'free', payload: { model: 'flux-3d' }, supportsRef: false },
  { id: 'pollinations-cablyai', provider: 'pollinations', name: 'CablyAI', desc: 'Creative artistic style', tier: 'free', payload: { model: 'flux-cablyai' }, supportsRef: false },
  { id: 'pollinations-sdxl', provider: 'pollinations', name: 'Stable Diffusion XL', desc: 'Classic open-source model', tier: 'free', payload: { model: 'sdxl' }, supportsRef: false },
  { id: 'pollinations-dreamshaper', provider: 'pollinations', name: 'DreamShaper', desc: 'Fantasy / dreamy style', tier: 'free', payload: { model: 'dreamshaper' }, supportsRef: false },
  { id: 'pollinations-flux-pro', provider: 'pollinations', name: 'Flux Pro', desc: 'Enhanced Flux quality', tier: 'free', payload: { model: 'flux-pro' }, supportsRef: false },
  { id: 'pollinations-flux-4o', provider: 'pollinations', name: 'Flux 4o', desc: 'Latest Flux variant', tier: 'free', payload: { model: 'flux-4o' }, supportsRef: false },
  // ===== FREE — NEEDS FREE API KEY =====
  { id: 'hf-flux-schnell', provider: 'huggingface', name: 'FLUX.1 Schnell', desc: 'Open-source, 4-step (HF token)', tier: 'free_key', payload: { model_id: 'black-forest-labs/FLUX.1-schnell', steps: 4 }, supportsRef: false },
  { id: 'together-flux-schnell', provider: 'together', name: 'FLUX.1 Schnell', desc: 'Free unlimited (Together AI)', tier: 'free_key', payload: { model_id: 'black-forest-labs/FLUX.1-schnell', steps: 4 }, supportsRef: false },
  { id: 'gemini-flash', provider: 'gemini', name: 'Gemini 2.0 Flash', desc: 'Free ~500/day + ref image', tier: 'free_key', payload: { model_id: 'gemini-2.0-flash-image-generation' }, supportsRef: true },
  // ===== PREMIUM =====
  { id: 'together-flux-dev', provider: 'together', name: 'FLUX.1 Dev', desc: 'High quality (Together credits)', tier: 'paid', payload: { model_id: 'black-forest-labs/FLUX.1-dev', steps: 28 }, supportsRef: false },
  { id: 'fal-ai/flux-2-flash', provider: 'fal', name: 'Flux 2 Flash', desc: 'Ultra fast ($0.003/MP)', tier: 'paid', falEndpoint: 'fal-ai/flux-2/flash', supportsRef: true },
  { id: 'fal-ai/flux-2-flex', provider: 'fal', name: 'Flux 2 Flex', desc: 'Advanced controls ($0.02/img)', tier: 'paid', falEndpoint: 'fal-ai/flux-2-flex', supportsRef: true },
  { id: 'fal-ai/flux-2', provider: 'fal', name: 'Flux 2 Dev', desc: 'High quality balanced ($0.03/img)', tier: 'paid', falEndpoint: 'fal-ai/flux-2', supportsRef: true },
  { id: 'fal-ai/flux-2-pro', provider: 'fal', name: 'Flux 2 Pro', desc: 'Maximum quality ($0.04/img)', tier: 'paid', falEndpoint: 'fal-ai/flux-2-pro', supportsRef: true },
  { id: 'fal-ai/flux-2-max', provider: 'fal', name: 'Flux 2 Max', desc: 'State of the art ($0.05/img)', tier: 'paid', falEndpoint: 'fal-ai/flux-2-max', supportsRef: true },
];

const SIZE_MAP = {
  '1:1': [1024, 1024],
  '16:9': [1344, 768],
  '9:16': [768, 1344],
  '4:3': [1152, 896],
  '3:4': [896, 1152],
  '21:9': [1536, 640],
};
const IMAGE_SIZES = Object.keys(SIZE_MAP);

const STYLE_PRESETS = [
  'None', 'Photorealistic', 'Anime', 'Cinematic', 'Oil Painting',
  'Watercolor', 'Digital Art', 'Concept Art', 'Cyberpunk', 'Fantasy', 'Minimalist',
];

function getModelStatus(model, apiKeys) {
  const prov = PROVIDERS[model.provider];
  if (!prov.keyRequired) return { usable: true, status: 'FREE', statusColor: 'text-green-400 bg-green-500/15 border-green-500/25', statusDot: 'bg-green-400' };
  if (apiKeys?.[prov.keyName]) return { usable: true, status: 'READY', statusColor: 'text-green-400 bg-green-500/15 border-green-500/25', statusDot: 'bg-green-400' };
  return { usable: false, status: 'NEEDS KEY', statusColor: 'text-yellow-400 bg-yellow-500/15 border-yellow-500/25', statusDot: 'bg-yellow-400' };
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function ImageGenerator({ apiKeys }) {
  const [prompt, setPrompt] = useState('');
  const [selectedModel, setSelectedModel] = useState(MODELS[0]);
  const [selectedSize, setSelectedSize] = useState('1:1');
  const [selectedStyle, setSelectedStyle] = useState('None');
  const [seed, setSeed] = useState(-1);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [generatedImages, setGeneratedImages] = useState([]);
  const [lightboxImage, setLightboxImage] = useState(null);
  const [refImage, setRefImage] = useState(null); // { name, base64 }
  const [isDragging, setIsDragging] = useState(false);

  const abortControllerRef = useRef(null);
  const fileInputRef = useRef(null);

  const getProvider = () => PROVIDERS[selectedModel.provider];
  const modelStatus = getModelStatus(selectedModel, apiKeys);

  const buildPrompt = () => {
    let fullPrompt = prompt;
    if (selectedStyle !== 'None') fullPrompt += `, ${selectedStyle} style`;
    return fullPrompt;
  };

  const buildPayload = () => {
    const fullPrompt = buildPrompt();
    const [w, h] = SIZE_MAP[selectedSize] || [1024, 1024];
    const base = { prompt: fullPrompt, width: w, height: h, seed: seed !== -1 ? seed : undefined };
    const model = selectedModel;

    // Add reference image if model supports it and one is provided
    if (refImage && model.supportsRef) base.image = refImage.base64;

    if (model.provider === 'pollinations') return { ...base, model: model.payload.model };
    if (model.provider === 'together') return { ...base, model_id: model.payload.model_id, steps: model.payload.steps };
    if (model.provider === 'huggingface') return { ...base, model_id: model.payload.model_id, steps: model.payload.steps };
    if (model.provider === 'gemini') return { prompt: fullPrompt, model_id: model.payload.model_id, image: refImage && model.supportsRef ? refImage.base64 : undefined };
    if (model.provider === 'fal') {
      return {
        endpoint: model.falEndpoint,
        prompt: fullPrompt,
        image_size: selectedSize === '1:1' ? 'square_hd' : selectedSize === '16:9' ? 'landscape_16_9' : selectedSize === '9:16' ? 'portrait_16_9' : selectedSize === '4:3' ? 'landscape_4_3' : selectedSize === '3:4' ? 'portrait_4_3' : 'landscape_4_3',
        output_format: 'png',
        ...(refImage && model.supportsRef ? { image: refImage.base64 } : {}),
        ...(seed !== -1 ? { seed } : {}),
      };
    }
    return base;
  };

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim() || isGenerating) return;
    if (!modelStatus.usable) {
      const prov = getProvider();
      setError(`${prov.name} API key required. Click the key icon next to the model to add it in Settings.`);
      return;
    }
    if (refImage && !selectedModel.supportsRef) {
      setError(`Reference image is not supported by ${selectedModel.name}. Try Gemini or fal.ai models.`);
      return;
    }

    setIsGenerating(true);
    setError(null);

    const payload = buildPayload();
    const provider = selectedModel.provider;

    try {
      abortControllerRef.current = new AbortController();
      const submitRes = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, payload, apiKeys }),
        signal: abortControllerRef.current.signal,
      });

      let submitData;
      try { submitData = await submitRes.json(); } catch { throw new Error('Server returned an invalid response. Please try again.'); }
      if (!submitRes.ok) throw new Error(submitData.error || `Generation failed (${submitRes.status})`);

      if (submitData.imageUrl) {
        setGeneratedImages((prev) => [{ id: Date.now(), url: submitData.imageUrl, prompt: buildPrompt(), model: selectedModel.name, provider: getProvider().name, size: selectedSize, timestamp: new Date().toLocaleTimeString() }, ...prev]);
      } else if (submitData.videoUrl) {
        setGeneratedImages((prev) => [{ id: Date.now(), url: submitData.videoUrl, prompt: buildPrompt(), model: selectedModel.name, provider: getProvider().name, size: selectedSize, timestamp: new Date().toLocaleTimeString() }, ...prev]);
      } else if (submitData.requestId) {
        const requestId = submitData.requestId;
        const endpoint = submitData.endpoint;
        let attempts = 0;
        while (attempts < 120) {
          attempts++;
          await new Promise(r => setTimeout(r, 2000));
          const falKey = apiKeys?.fal || '';
          const statusRes = await fetch(`/api/generate?endpoint=${encodeURIComponent(endpoint)}&requestId=${requestId}&apiKey=${encodeURIComponent(falKey)}`);
          const statusData = await statusRes.json();
          if (statusData.status === 'COMPLETED' && statusData.imageUrl) {
            setGeneratedImages((prev) => [{ id: Date.now(), url: statusData.imageUrl, prompt: buildPrompt(), model: selectedModel.name, provider: getProvider().name, size: selectedSize, timestamp: new Date().toLocaleTimeString() }, ...prev]);
            return;
          }
          if (statusData.status === 'FAILED') throw new Error(statusData.error || 'Generation failed');
        }
        throw new Error('Generation timed out');
      }
    } catch (err) {
      if (err.name !== 'AbortError') setError(err.message);
    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  }, [prompt, selectedModel, selectedSize, selectedStyle, seed, isGenerating, apiKeys, modelStatus, getProvider, refImage]);

  const handleCancel = () => { if (abortControllerRef.current) abortControllerRef.current.abort(); };

  const handleDownload = async (image) => {
    try {
      const response = await fetch(image.url);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `ai-studio-${image.id}.png`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch { window.open(image.url, '_blank'); }
  };

  const handleKeyDown = (e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); handleGenerate(); } };

  const handleFileUpload = async (file) => {
    if (!file || !file.type.startsWith('image/')) return;
    if (file.size > 10 * 1024 * 1024) { setError('Image too large. Max 10MB.'); return; }
    try {
      const base64 = await fileToBase64(file);
      setRefImage({ name: file.name, base64 });
      setError(null);
    } catch { setError('Failed to process image.'); }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer?.files?.[0];
    handleFileUpload(file);
  };

  const tierBadges = {
    free: { label: 'FREE', class: 'bg-green-500 text-white' },
    free_key: { label: 'FREE', class: 'bg-emerald-600 text-white' },
    paid: { label: 'PAID', class: 'bg-amber-500 text-black' },
  };

  const tierSections = [
    { key: 'free', title: 'FREE \u2014 No API Key Needed', models: MODELS.filter(m => m.tier === 'free'), icon: '\u2b50' },
    { key: 'free_key', title: 'FREE \u2014 Needs Free API Key', models: MODELS.filter(m => m.tier === 'free_key'), icon: '\ud83d\udd13' },
    { key: 'paid', title: 'Premium \u2014 Paid API Key', models: MODELS.filter(m => m.tier === 'paid'), icon: '\ud83d\udc51' },
  ];

  return (
    <div className="flex-1 flex flex-col overflow-hidden relative">
      <div className="flex-shrink-0 overflow-y-auto custom-scrollbar">
        <div className="max-w-4xl mx-auto px-4 md:px-6 py-6 md:py-8">

          {/* Model Picker - Always visible at top */}
          <div className="mb-6 animate-fade-in-up">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-bold text-white/50 uppercase tracking-wider">Select Model</h2>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${modelStatus.statusColor}`}>
                {modelStatus.status}
              </span>
            </div>

            <button
              onClick={() => setShowModelPicker(true)}
              className="w-full bg-[#111]/90 backdrop-blur-xl border border-white/10 rounded-xl p-4 flex items-center gap-4 cursor-pointer hover:border-white/20 transition-all group"
            >
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-lg ${
                selectedModel.tier === 'free' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                selectedModel.tier === 'free_key' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              }`}>
                {selectedModel.tier === 'free' ? '\u2b50' : selectedModel.tier === 'free_key' ? '\ud83d\udd13' : '\ud83d\udc51'}
              </div>
              <div className="text-left flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-base font-bold text-white">{selectedModel.name}</span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${tierBadges[selectedModel.tier].class}`}>
                    {tierBadges[selectedModel.tier].label}
                  </span>
                  {selectedModel.supportsRef && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">REF IMG</span>
                  )}
                </div>
                <div className="text-xs text-white/40 mt-0.5">{selectedModel.desc}</div>
              </div>
              <div className="flex items-center gap-2">
                {!modelStatus.usable && (
                  <div className="w-7 h-7 rounded-lg bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-yellow-400"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                  </div>
                )}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/30 group-hover:text-white/60 transition-colors">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </div>
            </button>
          </div>

          {/* Prompt Bar */}
          <div className="animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
            <div className="w-full bg-[#111]/90 backdrop-blur-xl border border-white/10 rounded-2xl md:rounded-3xl p-3 md:p-5 flex flex-col gap-3 md:gap-4 shadow-2xl">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Describe the image you want to create..."
                rows={3}
                className="w-full bg-transparent border-none text-white text-base md:text-lg placeholder:text-white/20 focus:outline-none resize-none leading-relaxed min-h-[60px] max-h-[200px] overflow-y-auto custom-scrollbar"
              />

              {/* Reference Image Upload */}
              <div className="relative">
                <input
                  type="file"
                  accept="image/*"
                  ref={fileInputRef}
                  onChange={(e) => { const f = e.target.files?.[0]; handleFileUpload(f); e.target.value = ''; }}
                  className="hidden"
                />

                {refImage ? (
                  <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl p-2.5">
                    <img src={refImage.base64} alt="Reference" className="w-12 h-12 rounded-lg object-cover border border-white/10" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-white/70 truncate">Reference Image</div>
                      <div className="text-[10px] text-white/30 truncate">{refImage.name}</div>
                      {!selectedModel.supportsRef && (
                        <div className="text-[10px] text-yellow-400 mt-0.5">Not supported by {selectedModel.name} (needs Gemini/fal.ai)</div>
                      )}
                    </div>
                    <button
                      onClick={() => setRefImage(null)}
                      className="w-7 h-7 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center hover:bg-red-500/20 transition-all cursor-pointer"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-red-400"><path d="M18 6L6 18M6 6l12 12" /></svg>
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragEnter={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    className={`flex items-center gap-3 rounded-xl p-2.5 border transition-all cursor-pointer ${
                      isDragging ? 'bg-[#d9ff00]/5 border-[#d9ff00]/30' : 'bg-white/[0.02] border-white/5 hover:bg-white/5 hover:border-white/10'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      isDragging ? 'bg-[#d9ff00]/10' : 'bg-white/5'
                    }`}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={isDragging ? 'text-[#d9ff00]' : 'text-white/30'}>
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <div className="text-[11px] font-bold text-white/40">Add Reference Image</div>
                      <div className="text-[10px] text-white/20">Click or drop an image \u2022 Gemini & fal.ai models</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Controls row */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t border-white/5">
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                  {/* Quick size */}
                  <button
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 rounded-xl border border-white/5 transition-all cursor-pointer whitespace-nowrap"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="opacity-60"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /></svg>
                    <span className="text-xs font-bold text-white">{selectedSize}</span>
                  </button>

                  {/* Style */}
                  <button
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="flex items-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-white/10 rounded-xl border border-white/5 transition-all cursor-pointer whitespace-nowrap"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="opacity-60"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-2.82 1.18V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1.08H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1.08 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1.08 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.6.77 1.05 1.39 1.08H21a2 2 0 0 1 0 4h-.09c-.62.03-1.13.48-1.39 1.08z" /></svg>
                    <span className="text-xs font-bold text-white/60 hidden sm:inline">{selectedStyle === 'None' ? 'Style' : selectedStyle}</span>
                  </button>
                </div>

                {/* Generate button */}
                <button
                  onClick={isGenerating ? handleCancel : handleGenerate}
                  disabled={!prompt.trim()}
                  className={`w-full sm:w-auto px-8 py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    isGenerating
                      ? 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30'
                      : selectedModel.tier === 'free'
                        ? 'bg-green-500 text-white hover:bg-green-400 hover:shadow-lg hover:scale-105 active:scale-95 shadow-lg shadow-green-500/20'
                        : selectedModel.tier === 'free_key'
                          ? 'bg-emerald-600 text-white hover:bg-emerald-500 hover:shadow-lg hover:scale-105 active:scale-95 shadow-lg shadow-emerald-600/20'
                          : 'bg-[#d9ff00] text-black hover:bg-[#e5ff33] hover:shadow-glow hover:scale-105 active:scale-95 shadow-lg shadow-[#d9ff00]/5'
                  } disabled:opacity-30 disabled:cursor-not-allowed`}
                >
                  {isGenerating ? (
                    <><div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />Cancel</>
                  ) : (
                    <>{selectedModel.tier === 'free' ? '\u2b50 ' : selectedModel.tier === 'free_key' ? '\ud83d\udd13 ' : ''}Generate</>
                  )}
                </button>
              </div>
            </div>

            {/* Key warning */}
            {!modelStatus.usable && (
              <div className="mt-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2 flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-yellow-400 flex-shrink-0"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                <p className="text-[11px] text-yellow-400/80">
                  This model needs a <strong>{getProvider().name}</strong> API key. Add it in <strong>Settings</strong> (top right).
                  {selectedModel.tier !== 'paid' && ' The key is free to get.'}
                </p>
              </div>
            )}

            <p className="text-center text-[11px] text-white/20 mt-2">
              Press <kbd className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-white/40 font-mono">Ctrl+Enter</kbd> to generate
            </p>
          </div>

          {/* Advanced Panel */}
          {showAdvanced && (
            <div className="mt-4 animate-fade-in-up">
              <div className="bg-[#111]/90 backdrop-blur-xl border border-white/10 rounded-2xl p-5 flex flex-col gap-5">
                <div>
                  <label className="text-xs font-bold text-white/40 uppercase tracking-wider mb-2 block">Image Size</label>
                  <div className="flex gap-2 flex-wrap">
                    {IMAGE_SIZES.map((s) => (
                      <button key={s} onClick={() => setSelectedSize(s)}
                        className={`px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          selectedSize === s ? 'bg-[#d9ff00]/15 text-[#d9ff00] border border-[#d9ff00]/30' : 'bg-white/5 text-white/50 border border-white/5 hover:bg-white/10 hover:text-white'
                        }`}>{s}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-white/40 uppercase tracking-wider mb-2 block">Style Preset</label>
                  <div className="flex gap-2 flex-wrap">
                    {STYLE_PRESETS.map((style) => (
                      <button key={style} onClick={() => setSelectedStyle(style)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          selectedStyle === style ? 'bg-[#d9ff00]/15 text-[#d9ff00] border border-[#d9ff00]/30' : 'bg-white/5 text-white/50 border border-white/5 hover:bg-white/10 hover:text-white'
                        }`}>{style}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-white/40 uppercase tracking-wider">Seed</label>
                    <button onClick={() => setSeed(Math.floor(Math.random() * 999999999))} className="text-[11px] font-bold text-[#d9ff00] hover:text-[#e5ff33] transition-colors cursor-pointer">Randomize</button>
                  </div>
                  <input type="number" value={seed} onChange={(e) => setSeed(parseInt(e.target.value) || -1)} placeholder="-1 for random"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#d9ff00]/50 transition-colors" />
                </div>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mt-4 bg-red-500/10 border border-red-500/20 rounded-xl p-4 animate-fade-in-up">
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-red-400"><path d="M18 6L6 18M6 6l12 12" /></svg>
                </div>
                <p className="text-sm text-red-400/90">{error}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Gallery */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-4 md:px-6 pb-6">
        {generatedImages.length > 0 && (
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-4 mt-2">
              <h2 className="text-sm font-bold text-white/60 uppercase tracking-wider">Generated ({generatedImages.length})</h2>
              <button onClick={() => setGeneratedImages([])} className="text-xs text-white/30 hover:text-white/60 transition-colors cursor-pointer">Clear All</button>
            </div>
            <div className="image-grid">
              {generatedImages.map((image) => (
                <div key={image.id} className="image-card bg-white/[0.02]">
                  {image.url.endsWith('.mp4') ? (
                    <video src={image.url} controls className="w-full aspect-square object-cover bg-black cursor-pointer" preload="metadata" onClick={() => setLightboxImage(image)} />
                  ) : (
                    <img src={image.url} alt={image.prompt} onClick={() => setLightboxImage(image)} className="cursor-pointer" loading="lazy" />
                  )}
                  <div className="image-overlay">
                    <p className="text-xs text-white/80 line-clamp-2 mb-2">{image.prompt}</p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-[#d9ff00] bg-[#d9ff00]/10 px-2 py-0.5 rounded">{image.model}</span>
                        <span className="text-[10px] text-white/40">{image.provider}</span>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={(e) => { e.stopPropagation(); handleDownload(image); }} className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all cursor-pointer" title="Download">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-white"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(image.prompt); }} className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all cursor-pointer" title="Copy prompt">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-white"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {isGenerating && (
          <div className="max-w-6xl mx-auto mt-4">
            <div className="image-grid">
              <div className="aspect-square rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-12 h-12 border-3 border-[#d9ff00] border-t-transparent rounded-full animate-spin" style={{ borderWidth: '3px' }} />
                  <span className="text-xs text-white/30">Generating with {selectedModel.name}...</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {generatedImages.length === 0 && !isGenerating && (
          <div className="max-w-4xl mx-auto mt-16 text-center">
            <div className="w-20 h-20 mx-auto mb-6 bg-white/[0.02] rounded-2xl border border-white/5 flex items-center justify-center">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="text-white/10"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
            </div>
            <p className="text-white/20 text-sm">Your generated images will appear here</p>
            <p className="text-white/10 text-xs mt-2">Pick a model above and start creating</p>
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightboxImage && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-50 p-4 cursor-pointer" onClick={() => setLightboxImage(null)}>
          <button className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all cursor-pointer z-10" onClick={() => setLightboxImage(null)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-white"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
          <div className="max-w-5xl max-h-[90vh] w-full" onClick={(e) => e.stopPropagation()}>
            {lightboxImage.url.endsWith('.mp4') ? (
              <video src={lightboxImage.url} controls className="w-full h-full object-contain rounded-xl" />
            ) : (
              <img src={lightboxImage.url} alt={lightboxImage.prompt} className="w-full h-full object-contain rounded-xl" />
            )}
            <div className="mt-3 flex items-center justify-between">
              <div>
                <p className="text-xs text-white/50 line-clamp-1">{lightboxImage.prompt}</p>
                <p className="text-[10px] text-white/30 mt-1">{lightboxImage.provider} — {lightboxImage.model}</p>
              </div>
              <button onClick={() => handleDownload(lightboxImage)} className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold text-white transition-all cursor-pointer">Download</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== MODEL PICKER MODAL ===== */}
      {showModelPicker && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl max-h-[85vh] flex flex-col animate-fade-in-up">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 flex-shrink-0">
              <div>
                <h2 className="text-lg font-bold text-white">Choose a Model</h2>
                <p className="text-[11px] text-white/40 mt-0.5">{MODELS.length} models available</p>
              </div>
              <button onClick={() => setShowModelPicker(false)} className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center cursor-pointer transition-all">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-white/60"><path d="M18 6L6 18M6 6l12 12" /></svg>
              </button>
            </div>

            {/* Model list */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-5">
              {tierSections.map((section) => {
                if (section.models.length === 0) return null;
                return (
                  <div key={section.key}>
                    <div className="flex items-center gap-2 mb-2 px-1">
                      <span className="text-sm">{section.icon}</span>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-white/50">{section.title}</span>
                      <span className="text-[10px] text-white/20">({section.models.length})</span>
                    </div>
                    <div className="space-y-1.5">
                      {section.models.map((model) => {
                        const status = getModelStatus(model, apiKeys);
                        const isSelected = selectedModel.id === model.id;
                        return (
                          <button
                            key={model.id}
                            onClick={() => { setSelectedModel(model); setShowModelPicker(false); }}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all cursor-pointer text-left ${
                              isSelected
                                ? 'bg-[#d9ff00]/10 border border-[#d9ff00]/25'
                                : status.usable
                                  ? 'bg-white/[0.02] border border-white/5 hover:bg-white/5'
                                  : 'bg-white/[0.01] border border-white/5 hover:bg-white/[0.03] opacity-70'
                            }`}
                          >
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-base flex-shrink-0 ${
                              isSelected ? 'bg-[#d9ff00] text-black' :
                              model.tier === 'free' ? 'bg-green-500/15 text-green-400' :
                              model.tier === 'free_key' ? 'bg-emerald-500/15 text-emerald-400' :
                              'bg-amber-500/15 text-amber-400'
                            }`}>
                              {model.tier === 'free' ? '\u2b50' : model.tier === 'free_key' ? '\ud83d\udd13' : '\ud83d\udc51'}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-white truncate">{model.name}</span>
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 ${tierBadges[model.tier].class}`}>
                                  {tierBadges[model.tier].label}
                                </span>
                                {model.supportsRef && (
                                  <span className="text-[8px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 bg-blue-500/20 text-blue-400 border border-blue-500/20">REF</span>
                                )}
                              </div>
                              <div className="text-[11px] text-white/35 truncate">{model.desc}</div>
                            </div>
                            <div className="flex-shrink-0">
                              {isSelected ? (
                                <div className="w-6 h-6 rounded-full bg-[#d9ff00] flex items-center justify-center">
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="3"><path d="M20 6L9 17l-5-5" /></svg>
                                </div>
                              ) : status.usable ? (
                                <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center">
                                  <div className="w-2 h-2 rounded-full bg-green-400" />
                                </div>
                              ) : (
                                <div className="w-6 h-6 rounded-full bg-yellow-500/20 flex items-center justify-center">
                                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-yellow-400"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                                </div>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer legend */}
            <div className="flex items-center justify-center gap-4 px-6 py-3 border-t border-white/5 flex-shrink-0">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-green-400" />
                <span className="text-[10px] text-white/30">Ready</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-yellow-400" />
                <span className="text-[10px] text-white/30">Needs key</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold px-1 py-0.5 rounded bg-green-500 text-white">FREE</span>
                <span className="text-[10px] text-white/30">No cost</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold px-1 py-0.5 rounded bg-blue-500/20 text-blue-400">REF</span>
                <span className="text-[10px] text-white/30">Ref image</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
