import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { SystemSettings } from '../types';
import { getSystemSettings } from '../services/settings';

interface SettingsContextType {
  settings: SystemSettings | null;
  loading: boolean;
  refreshSettings: () => Promise<void>;
  updateSettingsState: (updated: SystemSettings | null) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const refreshSettings = useCallback(async () => {
    try {
      const data = await getSystemSettings();
      setSettings(data);
    } catch (err) {
      console.warn('Gagal memuat system_settings:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshSettings();
  }, [refreshSettings]);

  const updateSettingsState = (updated: SystemSettings | null) => {
    setSettings(updated);
  };

  return (
    <SettingsContext.Provider
      value={{
        settings,
        loading,
        refreshSettings,
        updateSettingsState,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = (): SettingsContextType => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings harus digunakan di dalam SettingsProvider');
  }
  return context;
};
