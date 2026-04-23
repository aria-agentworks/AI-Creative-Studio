'use client';

export default function Header({ onSettingsOpen, apiKey }) {
  return (
    <header className="flex-shrink-0 h-14 border-b border-white/[0.03] flex items-center justify-between px-6 bg-black/20 backdrop-blur-md z-40">
      {/* Left: Logo */}
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 bg-[#d9ff00] rounded-lg flex items-center justify-center">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold tracking-tight text-white">AI Creative Studio</span>
          <span className="hidden sm:inline-flex text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#d9ff00]/10 text-[#d9ff00] border border-[#d9ff00]/20">NVIDIA NIM</span>
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-full border border-white/5">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-[11px] font-medium text-white/70">Connected</span>
        </div>

        <button
          onClick={onSettingsOpen}
          className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#d9ff00] to-yellow-200 border border-white/20 cursor-pointer hover:scale-110 transition-transform"
        />
      </div>
    </header>
  );
}
