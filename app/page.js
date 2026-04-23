'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Header from '@/components/Header';
import ApiKeyModal from '@/components/ApiKeyModal';
import ImageGenerator from '@/components/ImageGenerator';
import SettingsModal from '@/components/SettingsModal';

const STORAGE_KEY = 'nvidia_api_key';

export default function Home() {
  const [apiKey, setApiKey] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) setApiKey(stored);
    setIsLoaded(true);
  }, []);

  const handleKeySave = useCallback((key) => {
    localStorage.setItem(STORAGE_KEY, key);
    setApiKey(key);
  }, []);

  const handleKeyChange = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setApiKey(null);
  }, []);

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-[#030303] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#d9ff00] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!apiKey) {
    return <ApiKeyModal onSave={handleKeySave} />;
  }

  return (
    <div className="h-screen bg-[#030303] flex flex-col overflow-hidden">
      <Header onSettingsOpen={() => setShowSettings(true)} apiKey={apiKey} />
      <ImageGenerator apiKey={apiKey} />
      {showSettings && (
        <SettingsModal
          apiKey={apiKey}
          onClose={() => setShowSettings(false)}
          onChangeKey={handleKeyChange}
        />
      )}
    </div>
  );
}
