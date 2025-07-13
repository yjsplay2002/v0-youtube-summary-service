'use client';

import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { translations, getSystemLocale, type SupportedLocale, type TranslationKey } from '@/lib/i18n';

interface I18nContextType {
  locale: SupportedLocale;
  setLocale: (locale: SupportedLocale) => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<SupportedLocale>('en');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Get saved locale from localStorage or fall back to system locale
    const savedLocale = typeof window !== 'undefined' ? localStorage.getItem('preferred-locale') as SupportedLocale : null;
    const systemLocale = getSystemLocale();
    const initialLocale = savedLocale || systemLocale;
    setLocaleState(initialLocale);
    setMounted(true);
  }, []);

  const setLocale = (newLocale: SupportedLocale) => {
    setLocaleState(newLocale);
    // Save to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('preferred-locale', newLocale);
    }
  };

  const t = (key: TranslationKey, params?: Record<string, string | number>): string => {
    let translation = translations[locale][key] || translations.en[key] || key;
    
    // Simple parameter replacement
    if (params) {
      Object.entries(params).forEach(([paramKey, value]) => {
        translation = translation.replace(`{{${paramKey}}}`, String(value));
      });
    }
    
    return translation;
  };

  // Don't render until mounted to avoid hydration mismatch
  if (!mounted) {
    return children as React.ReactElement;
  }

  return React.createElement(
    I18nContext.Provider,
    { value: { locale, setLocale, t } },
    children
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    // Return a fallback during SSR/hydration before provider is mounted
    return {
      locale: 'en' as SupportedLocale,
      setLocale: () => {},
      t: (key: TranslationKey) => key
    };
  }
  return context;
}