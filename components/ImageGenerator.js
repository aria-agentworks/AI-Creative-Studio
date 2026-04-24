'use client';

import { useState, useRef, useCallback } from 'react';

const MODELS = [
  { id: 'fal-ai/flux-2-max', name: 'Flux 2 Max', desc: 'State of the art quality', tier: 'premium' },
  { id: 'fal-ai/flux-2-pro', name: 'Flux 2 Pro', desc: 'Maximum quality', tier: 'premium' },
  { id: 'fal-ai/flux-2', name: 'Flux 2 Dev', desc: 'High quality, balanced', tier: 'standard' },
  { id: 'fal-ai/flux-2-flex', name: 'Flux 2 Flex', desc: 'Advanced controls', tier: 'standard' },
  { id: 'fal-ai/flux-2/turbo', name: 'Flux 2 Turbo', desc: 'Fast generation', tier: 'standard' },
  { id: 'fal-ai/flux-2/flash', name: 'Flux 2 Flash', desc: 'Ultra fast', tier: 'free' },
];

const IMAGE_SIZES = [
  { label: '1:1', value: 'square_hd' },
  { label: '16:9', value: 'landscape_16_9' },
  { label: '9:16', value: 'portrait_16_9' },
  { label: '4:3', value: 'landscape_4_3' },
  { label: '3:4', value: 'portrait_4_3' },
];

const STYLE_PRESETS = [
  'None', 'Photorealistic', 'Anime', 'Cinematic', 'Oil Painting',
  'Watercolor', 'Digital Art', 'Concept Art', 'Cyberpunk', 'Fantasy', 'Minimalist'
];

export default function ImageGenerator({ apiKey }) {
  const [prompt, setPrompt] = useState('');
  const [selectedModel, setSelectedModel] = useState(MODELS[0]);
  const [selectedSize, setSelectedSize] = useState(IMAGE_SIZES[0]);
  const [selectedStyle, setSelectedStyle] = useState('None');
  const [seed, setSeed] = useState(-1);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [generatedImages, setGeneratedImages] = useState([]);
  const [lightboxImage, setLightboxImage] = useState(null);

  const abortControllerRef = useRef(null);

  const buildPrompt = () => {
    let fullPrompt = prompt;
    if (selectedStyle !== 'None') fullPrompt += `, ${selectedStyle} style`;
    return fullPrompt;
  };

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim() || isGenerating) return;
    setIsGenerating(true);
    setError(null);

    const fullPrompt = buildPrompt();
    const payload = {
      prompt: fullPrompt,
      image_size: selectedSize.value,
      output_format: 'png',
    };

    if (seed !== -1) payload.seed = seed;

    // Flex model supports extra params
    if (selectedModel.id === 'fal-ai/flux-2-flex') {
      payload.guidance_scale = 3.5;
      payload.num_inference_steps = 28;
    }

    try {
      abortControllerRef.current = new AbortController();

      // Use queue API for reliability
      const submitRes = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: selectedModel.id,
          payload,
          apiKey,
        }),
        signal: abortControllerRef.current.signal,
      });

      let submitData;
      try {
        submitData = await submitRes.json();
      } catch {
        throw new Error(`Server returned an invalid response. Please try again.`);
      }

      if (!submitRes.ok) {
        throw new Error(submitData.error || `Generation failed (${submitRes.status})`);
      }

      const imageUrl = submitData.imageUrl;
      if (imageUrl) {
        setGeneratedImages((prev) => [{
          id: Date.now(),
          url: imageUrl,
          prompt: fullPrompt,
          model: selectedModel.name,
          size: selectedSize.label,
          timestamp: new Date().toLocaleTimeString(),
        }, ...prev]);
      } else if (submitData.requestId) {
        // Queue mode - poll for result
        const requestId = submitData.requestId;
        let attempts = 0;
        const maxAttempts = 120;
        const pollInterval = 2000;

        const pollResult = async () => {
          while (attempts < maxAttempts) {
            attempts++;
            await new Promise(r => setTimeout(r, pollInterval));

            const statusRes = await fetch(`/api/status?endpoint=${encodeURIComponent(selectedModel.id)}&requestId=${requestId}&apiKey=${encodeURIComponent(apiKey)}`);
            const statusData = await statusRes.json();

            if (statusData.status === 'COMPLETED' && statusData.imageUrl) {
              setGeneratedImages((prev) => [{
                id: Date.now(),
                url: statusData.imageUrl,
                prompt: fullPrompt,
                model: selectedModel.name,
                size: selectedSize.label,
                timestamp: new Date().toLocaleTimeString(),
              }, ...prev]);
              return;
            }
            if (statusData.status === 'FAILED') {
              throw new Error(statusData.error || 'Generation failed');
            }
          }
          throw new Error('Generation timed out');
        };

        await pollResult();
      }
    } catch (err) {
      if (err.name !== 'AbortError') setError(err.message);
    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  }, [prompt, selectedModel, selectedSize, selectedStyle, seed, isGenerating, apiKey]);

  const handleCancel = () => {
    if (abortControllerRef.current) abortControllerRef.current.abort();
  };

  const handleDownload = async (image) => {
    try {
      const response = await fetch(image.url);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ai-studio-${image.id}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch { window.open(image.url, '_blank'); }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleGenerate();
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden relative">
      {/* Prompt Section */}
      <div className="flex-shrink-0 overflow-y-auto custom-scrollbar">
        <div className="max-w-4xl mx-auto px-4 md:px-6 py-8 md:py-10">
          {/* Hero */}
          <div className="text-center mb-8 animate-fade-in-up">
            <h1 className="text-3xl sm:text-5xl md:text-6xl font-black text-white tracking-wider uppercase mb-3">
              Image <span className="text-[#d9ff00]">Studio</span>
            </h1>
            <p className="text-white/40 text-sm font-medium tracking-wide">
              Powered by fal.ai — Flux 2 Models
            </p>
          </div>

          {/* Prompt Bar */}
          <div className="animate-fade-in-up" style={{ animationDelay: '0.15s' }}>
            <div className="w-full bg-[#111]/90 backdrop-blur-xl border border-white/10 rounded-2xl md:rounded-3xl p-3 md:p-5 flex flex-col gap-3 md:gap-4 shadow-2xl">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Describe the image you want to create..."
                rows={3}
                className="w-full bg-transparent border-none text-white text-base md:text-lg placeholder:text-white/20 focus:outline-none resize-none leading-relaxed min-h-[60px] max-h-[200px] overflow-y-auto custom-scrollbar"
              />

              {/* Controls */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t border-white/5">
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                  {/* Model Selector */}
                  <div className="relative">
                    <button
                      onClick={() => { setShowModelDropdown(!showModelDropdown); setShowAdvanced(false); }}
                      className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 rounded-xl border border-white/5 transition-all cursor-pointer whitespace-nowrap"
                    >
                      <div className="w-5 h-5 bg-[#d9ff00] rounded-md flex items-center justify-center">
                        <span className="text-[9px] font-black text-black">F</span>
                      </div>
                      <span className="text-xs font-bold text-white">{selectedModel.name}</span>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" className="opacity-40"><path d="M6 9l6 6 6-6" /></svg>
                    </button>

                    {showModelDropdown && (
                      <div className="absolute top-full left-0 mt-2 w-72 bg-[#111]/95 backdrop-blur-xl border border-white/10 rounded-xl p-2 z-50 shadow-2xl max-h-[70vh] overflow-y-auto custom-scrollbar">
                        {MODELS.map((model) => (
                          <button
                            key={model.id}
                            onClick={() => { setSelectedModel(model); setShowModelDropdown(false); }}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all cursor-pointer ${
                              selectedModel.id === model.id ? 'bg-[#d9ff00]/10 border border-[#d9ff00]/20' : 'hover:bg-white/5 border border-transparent'
                            }`}
                          >
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                              selectedModel.id === model.id ? 'bg-[#d9ff00] text-black' : 'bg-white/5 text-white/60'
                            }`}>
                              {model.name.replace('Flux 2 ', '')}
                            </div>
                            <div className="text-left">
                              <div className="text-sm font-bold text-white">{model.name}</div>
                              <div className="text-[11px] text-white/40">{model.desc}</div>
                            </div>
                            <span className={`ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded ${
                              model.tier === 'premium' ? 'bg-purple-500/20 text-purple-400' :
                              model.tier === 'free' ? 'bg-green-500/20 text-green-400' :
                              'bg-blue-500/20 text-blue-400'
                            }`}>{model.tier}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Size Selector */}
                  <button
                    onClick={() => { setShowAdvanced(!showAdvanced); setShowModelDropdown(false); }}
                    className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 rounded-xl border border-white/5 transition-all cursor-pointer whitespace-nowrap"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="opacity-60"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /></svg>
                    <span className="text-xs font-bold text-white">{selectedSize.label}</span>
                  </button>

                  {/* Advanced Toggle */}
                  <button
                    onClick={() => { setShowAdvanced(!showAdvanced); setShowModelDropdown(false); }}
                    className="flex items-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-white/10 rounded-xl border border-white/5 transition-all cursor-pointer whitespace-nowrap"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="opacity-60"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-2.82 1.18V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1.08H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1.08 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1.08 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.6.77 1.05 1.39 1.08H21a2 2 0 0 1 0 4h-.09c-.62.03-1.13.48-1.39 1.08z" /></svg>
                    <span className="text-xs font-bold text-white/60 hidden sm:inline">More</span>
                  </button>
                </div>

                <button
                  onClick={isGenerating ? handleCancel : handleGenerate}
                  disabled={!prompt.trim()}
                  className={`w-full sm:w-auto px-8 py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    isGenerating
                      ? 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30'
                      : 'bg-[#d9ff00] text-black hover:bg-[#e5ff33] hover:shadow-glow hover:scale-105 active:scale-95 shadow-lg shadow-[#d9ff00]/5'
                  } disabled:opacity-30 disabled:cursor-not-allowed`}
                >
                  {isGenerating ? (
                    <><div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />Cancel</>
                  ) : 'Generate'}
                </button>
              </div>
            </div>

            <p className="text-center text-[11px] text-white/20 mt-3">
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
                      <button key={s.value} onClick={() => setSelectedSize(s)}
                        className={`px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          selectedSize.value === s.value
                            ? 'bg-[#d9ff00]/15 text-[#d9ff00] border border-[#d9ff00]/30'
                            : 'bg-white/5 text-white/50 border border-white/5 hover:bg-white/10 hover:text-white'
                        }`}>{s.label}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-white/40 uppercase tracking-wider mb-2 block">Style Preset</label>
                  <div className="flex gap-2 flex-wrap">
                    {STYLE_PRESETS.map((style) => (
                      <button key={style} onClick={() => setSelectedStyle(style)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          selectedStyle === style
                            ? 'bg-[#d9ff00]/15 text-[#d9ff00] border border-[#d9ff00]/30'
                            : 'bg-white/5 text-white/50 border border-white/5 hover:bg-white/10 hover:text-white'
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
                  <img src={image.url} alt={image.prompt} onClick={() => setLightboxImage(image)} className="cursor-pointer" loading="lazy" />
                  <div className="image-overlay">
                    <p className="text-xs text-white/80 line-clamp-2 mb-2">{image.prompt}</p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-[#d9ff00] bg-[#d9ff00]/10 px-2 py-0.5 rounded">{image.model}</span>
                        <span className="text-[10px] text-white/40">{image.size}</span>
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
                  <span className="text-xs text-white/30">Generating...</span>
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
            <img src={lightboxImage.url} alt={lightboxImage.prompt} className="w-full h-full object-contain rounded-xl" />
            <div className="mt-3 flex items-center justify-between">
              <p className="text-xs text-white/50 line-clamp-1">{lightboxImage.prompt}</p>
              <button onClick={() => handleDownload(lightboxImage)} className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold text-white transition-all cursor-pointer">Download</button>
            </div>
          </div>
        </div>
      )}

      {(showModelDropdown || showAdvanced) && (
        <div className="fixed inset-0 z-40" onClick={() => { setShowModelDropdown(false); setShowAdvanced(false); }} />
      )}
    </div>
  );
}
