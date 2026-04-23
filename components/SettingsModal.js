'use client';

export default function SettingsModal({ apiKey, onClose, onChangeKey }) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in-up">
      <div className="bg-[#0a0a0a] border border-white/10 rounded-xl p-8 w-full max-w-sm shadow-2xl">
        <h2 className="text-white font-bold text-lg mb-2">Settings</h2>
        <p className="text-white/40 text-[13px] mb-8">
          Manage your NVIDIA NIM API key and preferences.
        </p>

        <div className="space-y-4 mb-8">
          <div className="bg-white/5 border border-white/[0.03] rounded-md p-4">
            <label className="block text-xs font-bold text-white/30 mb-2">
              Active API Key
            </label>
            <div className="text-[13px] font-mono text-white/80">
              {apiKey.slice(0, 12)}{'•'.repeat(24)}
            </div>
          </div>

          <div className="bg-white/5 border border-white/[0.03] rounded-md p-4">
            <label className="block text-xs font-bold text-white/30 mb-2">
              API Provider
            </label>
            <div className="text-[13px] text-white/80 flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              NVIDIA NIM (build.nvidia.com)
            </div>
          </div>

          <div className="bg-white/5 border border-white/[0.03] rounded-md p-4">
            <label className="block text-xs font-bold text-white/30 mb-2">
              Available Models
            </label>
            <div className="text-[13px] text-white/80">
              Flux 2 Pro, Flux 2 Dev, Flux 2 Flex, Flux 2 Klein
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onChangeKey}
            className="flex-1 h-10 rounded-md bg-red-500/10 text-red-400 hover:bg-red-500/20 text-xs font-semibold transition-all cursor-pointer"
          >
            Change Key
          </button>
          <button
            onClick={onClose}
            className="flex-1 h-10 rounded-md bg-white/5 text-white/80 hover:bg-white/10 text-xs font-semibold transition-all border border-white/5 cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
