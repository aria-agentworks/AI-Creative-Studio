'use client';

import { useState, useEffect, useCallback } from 'react';
import Header from '@/components/Header';
import ApiKeyModal from '@/components/ApiKeyModal';
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
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setApiKeys(JSON.parse(stored));
    } catch {}
    setIsLoaded(true);
  }, []);

  const saveKeys = useCallback((keys) => {
    setApiKeys(keys);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
  }, []);

  const handleInitialSetup = useCallback((key, provider) => {
    const updated = { ...apiKeys, [provider]: key };
    saveKeys(updated);
  }, [apiKeys, saveKeys]);

  // User has at least one key OR can use free models (Pollinations needs no key)
  const canUseApp = isLoaded && (apiKeys.fal || apiKeys.together || apiKeys.huggingface || apiKeys.gemini || true); // always allow — Pollinations is free

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-[#030303] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#d9ff00] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!apiKeys.fal && !apiKeys.together && !apiKeys.huggingface && !apiKeys.gemini) {
    return <ApiKeyModal onSave={handleInitialSetup} />;
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
