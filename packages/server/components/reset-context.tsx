"use client";

import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';

interface ResetContextType {
  resetSummary: () => void;
  registerResetCallback: (callback: () => void) => void;
}

const ResetContext = createContext<ResetContextType | undefined>(undefined);

export const ResetProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [resetCallback, setResetCallback] = useState<(() => void) | null>(null);

  const resetSummary = useCallback(() => {
    if (resetCallback) {
      resetCallback();
    }
  }, [resetCallback]);

  const registerResetCallback = useCallback((callback: () => void) => {
    setResetCallback(() => callback);
  }, []);

  return (
    <ResetContext.Provider value={{ resetSummary, registerResetCallback }}>
      {children}
    </ResetContext.Provider>
  );
};

export const useResetContext = () => {
  const context = useContext(ResetContext);
  if (context === undefined) {
    throw new Error('useResetContext must be used within a ResetProvider');
  }
  return context;
};
