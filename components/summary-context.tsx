"use client";

import React, { createContext, useContext, useState, ReactNode } from 'react';

interface SummaryContextType {
  refreshSummaries: () => void;
  registerRefreshCallback: (callback: () => void) => void;
}

const SummaryContext = createContext<SummaryContextType | undefined>(undefined);

export const SummaryProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [refreshCallback, setRefreshCallback] = useState<(() => void) | null>(null);

  const refreshSummaries = () => {
    if (refreshCallback) {
      refreshCallback();
    }
  };

  const registerRefreshCallback = (callback: () => void) => {
    setRefreshCallback(() => callback);
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
