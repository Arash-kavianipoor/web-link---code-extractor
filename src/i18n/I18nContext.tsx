import React, { createContext, useContext, useState, useEffect } from 'react';
import { LanguageCode, LanguageInfo } from '../types';
import { LANGUAGES } from './languages';
import { TRANSLATIONS, TranslationSchema } from './translations';

interface I18nContextType {
  currentLanguage: LanguageCode;
  languageInfo: LanguageInfo;
  t: TranslationSchema;
  dir: 'rtl' | 'ltr';
  setLanguage: (lang: LanguageCode) => void;
  availableLanguages: LanguageInfo[];
}

const I18nContext = createContext<I18nContextType | null>(null);

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentLanguage, setCurrentLanguageState] = useState<LanguageCode>(() => {
    const saved = localStorage.getItem('webscrape_lang') as LanguageCode;
    if (saved && TRANSLATIONS[saved]) {
      return saved;
    }
    return 'fa'; // Default Persian as requested
  });

  const languageInfo = LANGUAGES.find((l) => l.code === currentLanguage) || LANGUAGES[0];
  const t = TRANSLATIONS[currentLanguage] || TRANSLATIONS.fa;
  const dir = languageInfo.dir;

  useEffect(() => {
    localStorage.setItem('webscrape_lang', currentLanguage);
    document.documentElement.lang = currentLanguage;
    document.documentElement.dir = dir;
  }, [currentLanguage, dir]);

  const setLanguage = (lang: LanguageCode) => {
    if (TRANSLATIONS[lang]) {
      setCurrentLanguageState(lang);
    }
  };

  return (
    <I18nContext.Provider
      value={{
        currentLanguage,
        languageInfo,
        t,
        dir,
        setLanguage,
        availableLanguages: LANGUAGES,
      }}
    >
      {children}
    </I18nContext.Provider>
  );
};

export const useI18n = (): I18nContextType => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
};
