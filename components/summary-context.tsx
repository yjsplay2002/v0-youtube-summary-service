"use client";

import React, { createContext, useContext, useRef, ReactNode } from 'react';

interface SummaryContextType {
  refreshSummaries: () => void;
  registerRefreshCallback: (callback: () => void) => void;
}

const SummaryContext = createContext<SummaryContextType | undefined>(undefined);

export const SummaryProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const refreshCallbackRef = useRef<(() => void) | null>(null);

  const refreshSummaries = () => {
    if (refreshCallbackRef.current) {
      refreshCallbackRef.current();
    }
  };

  const registerRefreshCallback = (callback: () => void) => {
    refreshCallbackRef.current = callback;
  };

  return (
    <SummaryContext.Provider value={{ refreshSummaries, registerRefreshCallback }}>
      {children}
    </SummaryContext.Provider>
  );
};

export const useSummaryContext = () => {
  const context = useContext(SummaryContext);
  if (context === undefined) {
    throw new Error('useSummaryContext must be used within a SummaryProvider');
  }
  return context;
};
