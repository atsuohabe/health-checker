'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { Language } from '@/types';
import ja from './ja.json';
import en from './en.json';
import zhTW from './zh-TW.json';

const dictionaries: Record<Language, Record<string, unknown>> = {
  ja,
  en,
  'zh-TW': zhTW,
};

function getNestedValue(obj: Record<string, unknown>, path: string): string {
  const keys = path.split('.');
  let current: unknown = obj;
  for (const key of keys) {
    if (current && typeof current === 'object' && key in (current as Record<string, unknown>)) {
      current = (current as Record<string, unknown>)[key];
    } else {
      return path;
    }
  }
  return typeof current === 'string' ? current : path;
}

interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, params?: Record<string, string>) => string;
}

const I18nContext = createContext<I18nContextType>({
  language: 'ja',
  setLanguage: () => {},
  t: (key) => key,
});

export function I18nProvider({ children, initialLanguage = 'ja' }: { children: ReactNode; initialLanguage?: Language }) {
  const [language, setLanguage] = useState<Language>(initialLanguage);

  const t = useCallback((key: string, params?: Record<string, string>) => {
    let value = getNestedValue(dictionaries[language], key);
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        value = value.replace(`{${k}}`, v);
      });
    }
    return value;
  }, [language]);

  return (
    <I18nContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useTranslation() {
  return useContext(I18nContext);
}
