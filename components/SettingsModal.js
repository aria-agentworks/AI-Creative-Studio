'use client';

import { useState } from 'react';

const KEY_PROVIDERS = [
  { id: 'fal', name: 'fal.ai', desc: 'Flux 2 Pro/Max, Seedance 2.0 video', link: 'https://fal.ai/dashboard/keys', color: 'purple' },
  { id: 'together', name: 'Together AI', desc: 'FLUX.1-schnell (free unlimited)', link: 'https://api.together.xyz/settings/api-keys', color: 'blue' },
  { id: 'huggingface', name: 'Hugging Face', desc: '~200 images/day free', link: 'https://huggingface.co/settings/tokens', color: 'yellow' },
  { id: 'gemini', name: 'Google Gemini', desc: '~500 images/day free', link: 'https://aistudio.google.com/apikey', color: 'cyan' },
];

export default function SettingsModal({ apiKeys, onClose, onSave }) {
  const [editKeys, setEditKeys] = useState({ ...apiKeys });
  const [editing, setEditing] = useState(null);

  const handleSaveKey = (provider) => {
    const key = editKeys[provider]?.trim();
    if (key) {
      onSave({ ...apiKeys, [provider]: key });
    }
    setEditing(null);
  };

  const handleRemoveKey = (provider) => {
    const updated = { ...apiKeys };
    delete updated[provider];
    onSave(updated);
    setEditKeys({ ...updated });
  };

  const colorDots = {
    purple: 'bg-purple-500',
    blue: 'bg-blue-500',
    yellow: 'bg-yellow-500',
    cyan: 'bg-cyan-500',
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in-up">
      <div className="bg-[#0a0a0a] border border-white/10 rounded-xl p-8 w-full max-w-sm shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar">
        <h2 className="text-white font-bold text-lg mb-1">Settings</h2>
        <p className="text-white/40 text-[13px] mb-6">
          Manage your API keys. All keys are stored locally in your browser.
        </p>

        <div className="space-y-3 mb-6">
          {KEY_PROVIDERS.map((p) => {
            const hasKey = !!apiKeys[p.id];
            const isEditing = editing === p.id;
            return (
              <div key={p.id} className="bg-white/5 border border-white/[0.03] rounded-md p-4">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${colorDots[p.color]} ${hasKey ? '' : 'opacity-30'}`} />
                    <span className="text-[13px] font-bold text-white">{p.name}</span>
                  </div>
                  {hasKey && (
                    <span className="text-[9px] font-bold text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded">ACTIVE</span>
                  )}
                </div>
                <p className="text-[11px] text-white/30 mb-3">{p.desc}</p>

                {isEditing ? (
                  <div className="space-y-2">
                    <input
                      type="password"
                      value={editKeys[p.id] || ''}
                      onChange={(e) => setEditKeys({ ...editKeys, [p.id]: e.target.value })}
                      placeholder="Paste API key..."
                      className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm text-white placeholder:text-white/10 focus:outline-none focus:border-[#d9ff00]/50 transition-colors"
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <button onClick={() => setEditing(null)} className="flex-1 text-[11px] text-white/40 hover:text-white/60 py-1 cursor-pointer">Cancel</button>
                      <button onClick={() => handleSaveKey(p.id)} className="flex-1 text-[11px] text-[#d9ff00] font-bold py-1 cursor-pointer">Save</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    {hasKey ? (
                      <span className="text-[12px] font-mono text-white/50">
                        {apiKeys[p.id].slice(0, 8)}{'•'.repeat(20)}
                      </span>
                    ) : (
                      <span className="text-[11px] text-white/20">No key set</span>
                    )}
                    <div className="flex gap-1">
                      <button
                        onClick={() => setEditing(p.id)}
                        className="text-[10px] font-bold text-white/40 hover:text-white/70 px-2 py-1 rounded bg-white/5 hover:bg-white/10 transition-all cursor-pointer"
                      >
                        {hasKey ? 'Edit' : 'Add'}
                      </button>
                      {hasKey && (
                        <button
                          onClick={() => handleRemoveKey(p.id)}
                          className="text-[10px] font-bold text-red-400/60 hover:text-red-400 px-2 py-1 rounded bg-red-500/5 hover:bg-red-500/10 transition-all cursor-pointer"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Free models info */}
        <div className="bg-green-500/5 border border-green-500/10 rounded-md p-3 mb-6">
          <p className="text-[11px] text-green-400/80 font-bold mb-1">Free Models (No Key Needed)</p>
          <p className="text-[11px] text-white/30">Pollinations.ai — FLUX, Turbo, and more. Completely free, unlimited.</p>
        </div>

        <button
          onClick={onClose}
          className="w-full h-10 rounded-md bg-white/5 text-white/80 hover:bg-white/10 text-xs font-semibold transition-all border border-white/5 cursor-pointer"
        >
          Close
        </button>
      </div>
    </div>
  );
}
