'use client';

import { useState, useRef, useCallback } from 'react';

// =============================================
// PROVIDERS
// =============================================
const PROVIDERS = {
  huggingface_video: { name: 'Hugging Face', keyRequired: true, keyName: 'huggingface', desc: 'Free open-source video models' },
  fal: { name: 'fal.ai', keyRequired: true, keyName: 'fal', desc: 'Premium Seedance 2.0' },
};

// =============================================
// VIDEO MODELS — grouped by tier
// =============================================
const VIDEO_MODELS = [
  // ===== FREE — Needs free HF token (FLUX.1-schnell for frame-based) =====
  // Note: Most open-source video models are not on HF free inference.
  // Free text-to-video coming soon. Use fal.ai for production video.
  // ===== PREMIUM — fal.ai =====
  { id: 'bytedance/seedance-2.0/text-to-video', provider: 'fal', name: 'Seedance 2.0', tier: 'paid', desc: 'Best quality video generation', type: 'text', supportsRef: false },
  { id: 'bytedance/seedance-2.0/fast/text-to-video', provider: 'fal', name: 'Seedance 2.0 Fast', tier: 'paid', desc: 'Lower cost, faster generation', type: 'text', supportsRef: false },
  { id: 'bytedance/seedance-2.0/image-to-video', provider: 'fal', name: 'Seedance Image to Video', tier: 'paid', desc: 'Animate an image into video', type: 'image', supportsRef: true },
  { id: 'bytedance/seedance-2.0/fast/image-to-video', provider: 'fal', name: 'Seedance I2V Fast', tier: 'paid', desc: 'Quick image animation', type: 'image', supportsRef: true },
];

const ASPECT_RATIOS = ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9'];
const DURATIONS = ['auto', '4', '5', '6', '8', '10'];

function getModelStatus(model, apiKeys) {
  const prov = PROVIDERS[model.provider];
  if (!prov.keyRequired) return { usable: true, status: 'FREE', statusColor: 'text-green-400 bg-green-500/15 border-green-500/25' };
  if (apiKeys?.[prov.keyName]) return { usable: true, status: 'READY', statusColor: 'text-green-400 bg-green-500/15 border-green-500/25' };
  return { usable: false, status: 'NEEDS KEY', statusColor: 'text-yellow-400 bg-yellow-500/15 border-yellow-500/25' };
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function VideoGenerator({ apiKeys }) {
  const [prompt, setPrompt] = useState('');
  const [selectedModel, setSelectedModel] = useState(VIDEO_MODELS[0]);
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [duration, setDuration] = useState('auto');
  const [generateAudio, setGenerateAudio] = useState(true);
  const [seed, setSeed] = useState(-1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState('');
  const [generatedVideos, setGeneratedVideos] = useState([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [refImage, setRefImage] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  const abortControllerRef = useRef(null);
  const videoRef = useRef(null);
  const fileInputRef = useRef(null);

  const modelStatus = getModelStatus(selectedModel, apiKeys);

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

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim() || isGenerating) return;
    if (!modelStatus.usable) {
      setError(`${PROVIDERS[selectedModel.provider].name} API key required. Add it in Settings.`);
      return;
    }
    if (selectedModel.type === 'image' && !refImage) {
      setError('This model requires a reference image. Upload or drag an image above.');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setProgress('Submitting...');

    const provider = selectedModel.provider;

    try {
      abortControllerRef.current = new AbortController();

      if (provider === 'fal') {
        // === fal.ai: queue-based async ===
        const payload = {
          prompt: prompt.trim(),
          aspect_ratio: aspectRatio,
          duration,
          resolution: '720p',
          generate_audio: generateAudio,
        };
        if (seed !== -1) payload.seed = seed;
        if (selectedModel.type === 'image') payload.image_url = refImage ? refImage.base64 : '';

        setProgress('Queuing...');
        const submitRes = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            provider: 'fal',
            payload: { endpoint: selectedModel.id, ...payload },
            apiKeys,
          }),
          signal: abortControllerRef.current.signal,
        });

        let submitData;
        try { submitData = await submitRes.json(); } catch { throw new Error('Server returned an invalid response. Please try again.'); }
        if (!submitRes.ok) throw new Error(submitData.error || 'Submission failed');

        if (submitData.videoUrl) {
          setGeneratedVideos((prev) => [{ id: Date.now(), url: submitData.videoUrl, prompt: prompt.trim(), model: selectedModel.name, provider: PROVIDERS.fal.name, aspectRatio, duration, timestamp: new Date().toLocaleTimeString() }, ...prev]);
          return;
        }

        const requestId = submitData.requestId;
        if (!requestId) throw new Error('No request ID returned');

        let attempts = 0;
        const maxAttempts = 180;
        const pollInterval = 2000;

        while (attempts < maxAttempts) {
          attempts++;
          await new Promise(r => setTimeout(r, pollInterval));
          const elapsed = Math.round(attempts * pollInterval / 1000);
          setProgress(`Generating... (${elapsed}s)`);

          const falKey = apiKeys?.fal || '';
          const statusRes = await fetch(`/api/generate?endpoint=${encodeURIComponent(selectedModel.id)}&requestId=${requestId}&apiKey=${encodeURIComponent(falKey)}`);
          const statusData = await statusRes.json();

          if (statusData.status === 'COMPLETED' && statusData.videoUrl) {
            setGeneratedVideos((prev) => [{ id: Date.now(), url: statusData.videoUrl, prompt: prompt.trim(), model: selectedModel.name, provider: PROVIDERS.fal.name, aspectRatio, duration, timestamp: new Date().toLocaleTimeString() }, ...prev]);
            setProgress('');
            return;
          }
          if (statusData.status === 'FAILED') throw new Error(statusData.error || 'Video generation failed');
        }
        throw new Error('Video generation timed out (6 minutes)');

      } else if (provider === 'huggingface_video') {
        // === HuggingFace Video: sync (but can take a long time) ===
        const payload = { ...selectedModel.payload };

        // Build the request body with the actual prompt
        if (selectedModel.type === 'image' && refImage) {
          // Image-to-video: extract base64 data
          const base64Data = refImage.base64.replace(/^data:.+?;base64,/, '');
          payload.request_body = {
            inputs: base64Data,
            parameters: { num_frames: 25, motion_bucket_id: 127 },
          };
        } else {
          // Text-to-video
          if (payload.request_body) {
            // Replace PLACEHOLDER with actual prompt
            const body = JSON.stringify(payload.request_body).replace(/PLACEHOLDER/g, prompt.trim());
            payload.request_body = JSON.parse(body);
          } else {
            payload.request_body = { inputs: prompt.trim() };
          }
        }

        setProgress('Generating... (this may take 1-5 min)');

        const submitRes = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            provider: 'huggingface_video',
            payload,
            apiKeys,
          }),
          signal: abortControllerRef.current.signal,
        });

        let submitData;
        try { submitData = await submitRes.json(); } catch { throw new Error('Server returned an invalid response. Please try again.'); }
        if (!submitRes.ok) throw new Error(submitData.error || 'Video generation failed');

        if (submitData.videoUrl) {
          setGeneratedVideos((prev) => [{ id: Date.now(), url: submitData.videoUrl, prompt: prompt.trim(), model: selectedModel.name, provider: PROVIDERS.huggingface_video.name, aspectRatio, duration, timestamp: new Date().toLocaleTimeString() }, ...prev]);
          setProgress('');
          return;
        }
        throw new Error('No video returned from the model');
      }
    } catch (err) {
      if (err.name !== 'AbortError') setError(err.message);
    } finally {
      setIsGenerating(false);
      setProgress('');
      abortControllerRef.current = null;
    }
  }, [prompt, selectedModel, aspectRatio, duration, generateAudio, seed, refImage, isGenerating, apiKeys, modelStatus]);

  const handleCancel = () => {
    if (abortControllerRef.current) abortControllerRef.current.abort();
  };

  const tierBadges = {
    free_key: { label: 'FREE', class: 'bg-emerald-600 text-white' },
    paid: { label: 'PAID', class: 'bg-amber-500 text-black' },
  };

  const tierSections = [
    { key: 'paid', title: 'Video Models \u2014 fal.ai Seedance 2.0', models: VIDEO_MODELS, icon: '\ud83c\udfac' },
  ];

  return (
    <div className="flex-1 flex flex-col overflow-hidden relative">
      <div className="flex-shrink-0 overflow-y-auto custom-scrollbar">
        <div className="max-w-4xl mx-auto px-4 md:px-6 py-8 md:py-10">

          {/* Hero */}
          <div className="text-center mb-6 animate-fade-in-up">
            <h1 className="text-3xl sm:text-5xl md:text-6xl font-black text-white tracking-wider uppercase mb-3">
              Video <span className="text-[#d9ff00]">Studio</span>
            </h1>
            <p className="text-white/40 text-sm font-medium tracking-wide">
              Open-source models + Seedance 2.0
            </p>
          </div>

          {/* Model Picker - Always visible */}
          <div className="mb-4 animate-fade-in-up" style={{ animationDelay: '0.05s' }}>
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
                selectedModel.tier === 'free_key' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              }`}>
                {selectedModel.tier === 'free_key' ? '\ud83d\udd13' : '\ud83d\udc51'}
              </div>
              <div className="text-left flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-base font-bold text-white">{selectedModel.name}</span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${tierBadges[selectedModel.tier].class}`}>
                    {tierBadges[selectedModel.tier].label}
                  </span>
                  {selectedModel.type === 'image' && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">IMG2VID</span>
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

            {/* Model warning */}
            {selectedModel.warn && (
              <div className="mt-2 bg-blue-500/5 border border-blue-500/10 rounded-lg px-3 py-2">
                <p className="text-[11px] text-white/40">{selectedModel.warn}</p>
              </div>
            )}
          </div>

          {/* Prompt Bar */}
          <div className="animate-fade-in-up" style={{ animationDelay: '0.15s' }}>
            <div className="w-full bg-[#111]/90 backdrop-blur-xl border border-white/10 rounded-2xl md:rounded-3xl p-3 md:p-5 flex flex-col gap-3 md:gap-4 shadow-2xl">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={selectedModel.type === 'image' ? 'Describe how you want the image animated...' : 'Describe the video you want to create...'}
                rows={3}
                className="w-full bg-transparent border-none text-white text-base md:text-lg placeholder:text-white/20 focus:outline-none resize-none leading-relaxed min-h-[60px] max-h-[200px] overflow-y-auto custom-scrollbar"
              />

              {/* Reference Image Upload (for image-to-video models) */}
              <input
                type="file"
                accept="image/*"
                ref={fileInputRef}
                onChange={(e) => { const f = e.target.files?.[0]; handleFileUpload(f); e.target.value = ''; }}
                className="hidden"
              />

              {(selectedModel.type === 'image' || true) && (
                <div className="relative">
                  {refImage ? (
                    <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl p-2.5">
                      <img src={refImage.base64} alt="Reference" className="w-14 h-14 rounded-lg object-cover border border-white/10" />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold text-white/70">Source Image</div>
                        <div className="text-[10px] text-white/30 truncate">{refImage.name}</div>
                        {selectedModel.type === 'text' && (
                          <div className="text-[10px] text-white/30 mt-0.5">Optional for this model</div>
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
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isDragging ? 'bg-[#d9ff00]/10' : 'bg-white/5'}`}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={isDragging ? 'text-[#d9ff00]' : 'text-white/30'}>
                          <polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <div className="text-[11px] font-bold text-white/40">
                          {selectedModel.type === 'image' ? 'Upload Source Image' : 'Add Reference Image (optional)'}
                        </div>
                        <div className="text-[10px] text-white/20">Click or drag an image here</div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Controls */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t border-white/5">
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                  {/* Settings toggle */}
                  <button
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 rounded-xl border border-white/5 transition-all cursor-pointer whitespace-nowrap"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="opacity-60"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-2.82 1.18V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1.08H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1.08 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1.08 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.6.77 1.05 1.39 1.08H21a2 2 0 0 1 0 4h-.09c-.62.03-1.13.48-1.39 1.08z" /></svg>
                    <span className="text-xs font-bold text-white/60 hidden sm:inline">Settings</span>
                  </button>

                  {/* Audio toggle (only for fal models) */}
                  {selectedModel.provider === 'fal' && (
                    <button
                      onClick={() => setGenerateAudio(!generateAudio)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all cursor-pointer whitespace-nowrap ${
                        generateAudio ? 'bg-[#d9ff00]/10 border-[#d9ff00]/20 text-[#d9ff00]' : 'bg-white/5 border-white/5 text-white/40'
                      }`}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M11 5L6 9H2v6h4l5 4V5zM19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
                      </svg>
                      <span className="text-xs font-bold hidden sm:inline">{generateAudio ? 'Audio On' : 'Muted'}</span>
                    </button>
                  )}
                </div>

                <button
                  onClick={isGenerating ? handleCancel : handleGenerate}
                  disabled={!prompt.trim()}
                  className={`w-full sm:w-auto px-8 py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    isGenerating
                      ? 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30'
                      : selectedModel.tier === 'free_key'
                        ? 'bg-emerald-600 text-white hover:bg-emerald-500 hover:shadow-lg hover:scale-105 active:scale-95 shadow-lg shadow-emerald-600/20'
                        : 'bg-[#d9ff00] text-black hover:bg-[#e5ff33] hover:shadow-glow hover:scale-105 active:scale-95 shadow-lg shadow-[#d9ff00]/5'
                  } disabled:opacity-30 disabled:cursor-not-allowed`}
                >
                  {isGenerating ? (
                    <><div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />Cancel</>
                  ) : (
                    <>{selectedModel.tier === 'free_key' ? '\ud83d\udd13 ' : ''}Generate Video</>
                  )}
                </button>
              </div>
            </div>

            {/* Key warning */}
            {!modelStatus.usable && (
              <div className="mt-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2 flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-yellow-400 flex-shrink-0"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                <p className="text-[11px] text-yellow-400/80">
                  This model needs a <strong>{PROVIDERS[selectedModel.provider].name}</strong> API key. Add it in <strong>Settings</strong> (top right).
                  {selectedModel.tier === 'free_key' && ' The HuggingFace token is free to get.'}
                </p>
              </div>
            )}

            {/* Progress bar */}
            {isGenerating && progress && (
              <div className="mt-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-white/50">{progress}</span>
                </div>
                <div className="h-1 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full bg-[#d9ff00] rounded-full animate-pulse" style={{ width: '100%' }} />
                </div>
              </div>
            )}
          </div>

          {/* Advanced Settings */}
          {showAdvanced && (
            <div className="mt-4 animate-fade-in-up">
              <div className="bg-[#111]/90 backdrop-blur-xl border border-white/10 rounded-2xl p-5 flex flex-col gap-5">
                <div>
                  <label className="text-xs font-bold text-white/40 uppercase tracking-wider mb-2 block">Aspect Ratio</label>
                  <div className="flex gap-2 flex-wrap">
                    {ASPECT_RATIOS.map((ar) => (
                      <button key={ar} onClick={() => setAspectRatio(ar)}
                        className={`px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          aspectRatio === ar
                            ? 'bg-[#d9ff00]/15 text-[#d9ff00] border border-[#d9ff00]/30'
                            : 'bg-white/5 text-white/50 border border-white/5 hover:bg-white/10 hover:text-white'
                        }`}>{ar}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-white/40 uppercase tracking-wider mb-2 block">Duration (seconds)</label>
                  <div className="flex gap-2 flex-wrap">
                    {DURATIONS.map((d) => (
                      <button key={d} onClick={() => setDuration(d)}
                        className={`px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          duration === d
                            ? 'bg-[#d9ff00]/15 text-[#d9ff00] border border-[#d9ff00]/30'
                            : 'bg-white/5 text-white/50 border border-white/5 hover:bg-white/10 hover:text-white'
                        }`}>{d === 'auto' ? 'Auto' : `${d}s`}</button>
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
                <div className="bg-blue-500/5 border border-blue-500/10 rounded-lg p-3">
                  <p className="text-[11px] text-white/30">
                    {selectedModel.provider === 'huggingface_video'
                      ? 'Open-source video models run on HuggingFace free inference. First use triggers a cold start (2-5 min wait). Subsequent requests are faster.'
                      : 'Seedance 2.0 generates high-quality videos via fal.ai. Typically takes 30-120 seconds.'}
                  </p>
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

      {/* Video Gallery */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-4 md:px-6 pb-6">
        {generatedVideos.length > 0 && (
          <div className="max-w-5xl mx-auto">
            <div className="flex items-center justify-between mb-4 mt-2">
              <h2 className="text-sm font-bold text-white/60 uppercase tracking-wider">Generated ({generatedVideos.length})</h2>
              <button onClick={() => setGeneratedVideos([])} className="text-xs text-white/30 hover:text-white/60 transition-colors cursor-pointer">Clear All</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {generatedVideos.map((video) => (
                <div key={video.id} className="bg-white/[0.02] border border-white/5 rounded-xl overflow-hidden">
                  <video
                    ref={videoRef}
                    src={video.url}
                    controls
                    className="w-full aspect-video bg-black"
                    preload="metadata"
                  />
                  <div className="p-3">
                    <p className="text-xs text-white/60 line-clamp-2 mb-2">{video.prompt}</p>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        video.provider === PROVIDERS.fal.name
                          ? 'text-purple-400 bg-purple-500/10'
                          : 'text-emerald-400 bg-emerald-500/10'
                      }`}>{video.model}</span>
                      <span className="text-[10px] text-white/40">{video.provider}</span>
                      <span className="text-[10px] text-white/40">{video.aspectRatio}</span>
                      <a href={video.url} download target="_blank" rel="noreferrer" className="ml-auto text-[10px] text-[#d9ff00] hover:text-[#e5ff33] transition-colors cursor-pointer font-bold">Download</a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {isGenerating && (
          <div className="max-w-5xl mx-auto mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white/[0.02] border border-white/5 rounded-xl aspect-video flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-12 h-12 border-3 border-[#d9ff00] border-t-transparent rounded-full animate-spin" style={{ borderWidth: '3px' }} />
                  <span className="text-xs text-white/30">{progress || `Generating with ${selectedModel.name}...`}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {generatedVideos.length === 0 && !isGenerating && (
          <div className="max-w-4xl mx-auto mt-16 text-center">
            <div className="w-20 h-20 mx-auto mb-6 bg-white/[0.02] rounded-2xl border border-white/5 flex items-center justify-center">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="text-white/10"><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" /></svg>
            </div>
            <p className="text-white/20 text-sm">Your generated videos will appear here</p>
            <p className="text-white/10 text-xs mt-2">Pick a model above and describe your video</p>
          </div>
        )}
      </div>

      {/* ===== MODEL PICKER MODAL ===== */}
      {showModelPicker && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl max-h-[85vh] flex flex-col animate-fade-in-up">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 flex-shrink-0">
              <div>
                <h2 className="text-lg font-bold text-white">Choose a Video Model</h2>
                <p className="text-[11px] text-white/40 mt-0.5">{VIDEO_MODELS.length} models available</p>
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
                              model.tier === 'free_key' ? 'bg-emerald-500/15 text-emerald-400' :
                              'bg-amber-500/15 text-amber-400'
                            }`}>
                              {model.tier === 'free_key' ? '\ud83d\udd13' : '\ud83d\udc51'}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-white truncate">{model.name}</span>
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 ${tierBadges[model.tier].class}`}>
                                  {tierBadges[model.tier].label}
                                </span>
                                {model.type === 'image' && (
                                  <span className="text-[8px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 bg-blue-500/20 text-blue-400 border border-blue-500/20">IMG2VID</span>
                                )}
                              </div>
                              <div className="text-[11px] text-white/35 truncate">{model.desc}</div>
                              {model.warn && <div className="text-[10px] text-yellow-400/50 mt-0.5 truncate">{model.warn}</div>}
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
                <span className="text-[10px] font-bold px-1 py-0.5 rounded bg-emerald-600 text-white">FREE</span>
                <span className="text-[10px] text-white/30">Open-source</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold px-1 py-0.5 rounded bg-blue-500/20 text-blue-400">IMG2VID</span>
                <span className="text-[10px] text-white/30">Image to video</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
