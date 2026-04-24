'use client';

import { useState, useRef, useCallback } from 'react';

const VIDEO_MODELS = [
  { id: 'bytedance/seedance-2.0/text-to-video', name: 'Seedance 2.0', desc: 'Best quality', type: 'text' },
  { id: 'bytedance/seedance-2.0/fast/text-to-video', name: 'Seedance 2.0 Fast', desc: 'Lower cost, faster', type: 'text' },
  { id: 'bytedance/seedance-2.0/image-to-video', name: 'Image to Video', desc: 'Animate an image', type: 'image' },
  { id: 'bytedance/seedance-2.0/fast/image-to-video', name: 'Image to Video Fast', desc: 'Quick animation', type: 'image' },
];

const ASPECT_RATIOS = ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9'];
const DURATIONS = ['auto', '4', '5', '6', '8', '10'];

export default function VideoGenerator({ apiKey }) {
  const [prompt, setPrompt] = useState('');
  const [selectedModel, setSelectedModel] = useState(VIDEO_MODELS[0]);
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [duration, setDuration] = useState('auto');
  const [generateAudio, setGenerateAudio] = useState(true);
  const [seed, setSeed] = useState(-1);
  const [imageUrl, setImageUrl] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState('');
  const [generatedVideos, setGeneratedVideos] = useState([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showModelDropdown, setShowModelDropdown] = useState(false);

  const abortControllerRef = useRef(null);
  const videoRef = useRef(null);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim() || isGenerating) return;
    if (selectedModel.type === 'image' && !imageUrl.trim()) {
      setError('Please provide an image URL for Image to Video');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setProgress('Submitting...');

    const payload = {
      prompt: prompt.trim(),
      aspect_ratio: aspectRatio,
      duration,
      resolution: '720p',
      generate_audio: generateAudio,
    };

    if (seed !== -1) payload.seed = seed;
    if (selectedModel.type === 'image') payload.image_url = imageUrl.trim();

    try {
      abortControllerRef.current = new AbortController();

      // Step 1: Submit to queue
      setProgress('Queuing...');
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
        throw new Error('Server returned an invalid response. Please try again.');
      }
      if (!submitRes.ok) throw new Error(submitData.error || 'Submission failed');

      if (submitData.videoUrl) {
        // Direct result (unlikely for video but handle it)
        setGeneratedVideos((prev) => [{
          id: Date.now(),
          url: submitData.videoUrl,
          prompt: prompt.trim(),
          model: selectedModel.name,
          aspectRatio,
          duration,
          timestamp: new Date().toLocaleTimeString(),
        }, ...prev]);
        return;
      }

      // Step 2: Poll for result
      const requestId = submitData.requestId;
      if (!requestId) throw new Error('No request ID returned');

      let attempts = 0;
      const maxAttempts = 180; // 6 minutes max
      const pollInterval = 2000;

      while (attempts < maxAttempts) {
        attempts++;
        await new Promise(r => setTimeout(r, pollInterval));

        const elapsed = Math.round(attempts * pollInterval / 1000);
        setProgress(`Generating... (${elapsed}s)`);

        const statusRes = await fetch(
          `/api/status?endpoint=${encodeURIComponent(selectedModel.id)}&requestId=${requestId}&apiKey=${encodeURIComponent(apiKey)}`
        );
        const statusData = await statusRes.json();

        if (statusData.status === 'COMPLETED' && statusData.videoUrl) {
          setGeneratedVideos((prev) => [{
            id: Date.now(),
            url: statusData.videoUrl,
            prompt: prompt.trim(),
            model: selectedModel.name,
            aspectRatio,
            duration,
            timestamp: new Date().toLocaleTimeString(),
          }, ...prev]);
          setProgress('');
          return;
        }
        if (statusData.status === 'FAILED') {
          throw new Error(statusData.error || 'Video generation failed');
        }
      }
      throw new Error('Video generation timed out (6 minutes)');
    } catch (err) {
      if (err.name !== 'AbortError') setError(err.message);
    } finally {
      setIsGenerating(false);
      setProgress('');
      abortControllerRef.current = null;
    }
  }, [prompt, selectedModel, aspectRatio, duration, generateAudio, seed, imageUrl, isGenerating, apiKey]);

  const handleCancel = () => {
    if (abortControllerRef.current) abortControllerRef.current.abort();
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden relative">
      <div className="flex-shrink-0 overflow-y-auto custom-scrollbar">
        <div className="max-w-4xl mx-auto px-4 md:px-6 py-8 md:py-10">
          {/* Hero */}
          <div className="text-center mb-8 animate-fade-in-up">
            <h1 className="text-3xl sm:text-5xl md:text-6xl font-black text-white tracking-wider uppercase mb-3">
              Video <span className="text-[#d9ff00]">Studio</span>
            </h1>
            <p className="text-white/40 text-sm font-medium tracking-wide">
              Powered by fal.ai — Seedance 2.0
            </p>
          </div>

          {/* Prompt Bar */}
          <div className="animate-fade-in-up" style={{ animationDelay: '0.15s' }}>
            <div className="w-full bg-[#111]/90 backdrop-blur-xl border border-white/10 rounded-2xl md:rounded-3xl p-3 md:p-5 flex flex-col gap-3 md:gap-4 shadow-2xl">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe the video you want to create..."
                rows={3}
                className="w-full bg-transparent border-none text-white text-base md:text-lg placeholder:text-white/20 focus:outline-none resize-none leading-relaxed min-h-[60px] max-h-[200px] overflow-y-auto custom-scrollbar"
              />

              {/* Image URL input for Image-to-Video mode */}
              {selectedModel.type === 'image' && (
                <div className="pt-2 border-t border-white/5">
                  <label className="text-xs font-bold text-white/40 uppercase tracking-wider mb-2 block">Source Image URL</label>
                  <input
                    type="url"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="https://example.com/image.jpg"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-[#d9ff00]/50 transition-colors"
                  />
                </div>
              )}

              {/* Controls */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t border-white/5">
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                  {/* Model Selector */}
                  <div className="relative">
                    <button
                      onClick={() => { setShowModelDropdown(!showModelDropdown); setShowAdvanced(false); }}
                      className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 rounded-xl border border-white/5 transition-all cursor-pointer whitespace-nowrap"
                    >
                      <div className="w-5 h-5 bg-purple-500 rounded-md flex items-center justify-center">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" /></svg>
                      </div>
                      <span className="text-xs font-bold text-white">{selectedModel.name}</span>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" className="opacity-40"><path d="M6 9l6 6 6-6" /></svg>
                    </button>

                    {showModelDropdown && (
                      <div className="absolute top-full left-0 mt-2 w-72 bg-[#111]/95 backdrop-blur-xl border border-white/10 rounded-xl p-2 z-50 shadow-2xl">
                        {VIDEO_MODELS.map((model) => (
                          <button
                            key={model.id}
                            onClick={() => { setSelectedModel(model); setShowModelDropdown(false); }}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all cursor-pointer ${
                              selectedModel.id === model.id ? 'bg-[#d9ff00]/10 border border-[#d9ff00]/20' : 'hover:bg-white/5 border border-transparent'
                            }`}
                          >
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                              selectedModel.id === model.id ? 'bg-[#d9ff00] text-black' : 'bg-white/5 text-white/60'
                            }`}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" /></svg>
                            </div>
                            <div className="text-left">
                              <div className="text-sm font-bold text-white">{model.name}</div>
                              <div className="text-[11px] text-white/40">{model.desc}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Quick Settings Buttons */}
                  <button
                    onClick={() => { setShowAdvanced(!showAdvanced); setShowModelDropdown(false); }}
                    className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 rounded-xl border border-white/5 transition-all cursor-pointer whitespace-nowrap"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="opacity-60"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-2.82 1.18V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1.08H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1.08 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1.08 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.6.77 1.05 1.39 1.08H21a2 2 0 0 1 0 4h-.09c-.62.03-1.13.48-1.39 1.08z" /></svg>
                    <span className="text-xs font-bold text-white/60 hidden sm:inline">Settings</span>
                  </button>

                  {/* Audio toggle */}
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
                  ) : 'Generate Video'}
                </button>
              </div>
            </div>

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
                    Video generation typically takes 30-120 seconds. Seedance 2.0 supports text-to-video and image-to-video with audio generation.
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
                      <span className="text-[10px] font-bold text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded">{video.model}</span>
                      <span className="text-[10px] text-white/40">{video.aspectRatio}</span>
                      <span className="text-[10px] text-white/40">{video.duration !== 'auto' ? `${video.duration}s` : 'auto'}</span>
                      <a href={video.url} download target="_blank" rel="noreferrer" className="ml-auto text-[10px] text-[#d9ff00] hover:text-[#e5ff33] transition-colors cursor-pointer font-bold">Download</a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {generatedVideos.length === 0 && !isGenerating && (
          <div className="max-w-4xl mx-auto mt-16 text-center">
            <div className="w-20 h-20 mx-auto mb-6 bg-white/[0.02] rounded-2xl border border-white/5 flex items-center justify-center">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="text-white/10"><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" /></svg>
            </div>
            <p className="text-white/20 text-sm">Your generated videos will appear here</p>
            <p className="text-white/10 text-xs mt-2">Enter a prompt and click Generate Video</p>
          </div>
        )}
      </div>

      {showModelDropdown && (
        <div className="fixed inset-0 z-40" onClick={() => setShowModelDropdown(false)} />
      )}
    </div>
  );
}
