'use client';

import { useState, useEffect, useCallback } from 'react';
import Header from '@/components/Header';
import ImageGenerator from '@/components/ImageGenerator';
import VideoGenerator from '@/components/VideoGenerator';
import SettingsModal from '@/components/SettingsModal';

const STORAGE_KEY = 'ai_studio_keys';
const TABS = [
  { id: 'image', label: 'Image Studio' },
  { id: 'video', label: 'Video Studio' },
];

export default function Home() {
  const [apiKeys, setApiKeys] = useState({});
  const [isLoaded, setIsLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState('image');
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    const init = async () => {
      // Load client-side keys from localStorage
      let stored = {};
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) stored = JSON.parse(raw);
      } catch {}

      // Check which keys are pre-configured on the server
      try {
        const res = await fetch('/api/models');
        const data = await res.json();
        const serverKeys = data.serverKeys || {};
        // For each provider that has a server-side key, inject a placeholder
        // so the UI shows "READY" instead of "NEEDS KEY"
        for (const [key, has] of Object.entries(serverKeys)) {
          if (has && !stored[key]) {
            stored[key] = '__server__';
          }
        }
      } catch {}

      setApiKeys(stored);
      setIsLoaded(true);
    };
    init();
  }, []);

  const saveKeys = useCallback((keys) => {
    setApiKeys(keys);
    // Don't save placeholder server keys to localStorage
    const toStore = { ...keys };
    for (const [key, val] of Object.entries(toStore)) {
      if (val === '__server__') delete toStore[key];
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
  }, []);

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-[#030303] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#d9ff00] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#030303] flex flex-col overflow-hidden">
      <Header onSettingsOpen={() => setShowSettings(true)} apiKeys={apiKeys} activeTab={activeTab} onTabChange={setActiveTab} tabs={TABS} />
      {activeTab === 'image' && <ImageGenerator apiKeys={apiKeys} />}
      {activeTab === 'video' && <VideoGenerator apiKeys={apiKeys} />}
      {showSettings && (
        <SettingsModal
          apiKeys={apiKeys}
          onClose={() => setShowSettings(false)}
          onSave={saveKeys}
        />
      )}
    </div>
  );
}
