import React, { useState } from 'react';
import { useI18n } from '../i18n/I18nContext';
import { LanguageCode } from '../types';
import { 
  Globe, 
  Layers, 
  Monitor, 
  Tablet, 
  Smartphone, 
  Cpu, 
  ChevronDown, 
  Check, 
  Sparkles,
  Download
} from 'lucide-react';

interface HeaderProps {
  viewMode: 'triple' | 'desktop' | 'tablet' | 'mobile' | 'split';
  setViewMode: (mode: 'triple' | 'desktop' | 'tablet' | 'mobile' | 'split') => void;
  onOpenBrowserNotice: () => void;
  hasExtractedData: boolean;
  onQuickDownloadAll?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  viewMode,
  setViewMode,
  onOpenBrowserNotice,
  hasExtractedData,
  onQuickDownloadAll,
}) => {
  const { currentLanguage, languageInfo, setLanguage, availableLanguages, t, dir } = useI18n();
  const [isLangOpen, setIsLangOpen] = useState(false);
  const [langSearch, setLangSearch] = useState('');

  const filteredLanguages = availableLanguages.filter(
    (l) =>
      l.name.toLowerCase().includes(langSearch.toLowerCase()) ||
      l.nativeName.toLowerCase().includes(langSearch.toLowerCase()) ||
      l.code.toLowerCase().includes(langSearch.toLowerCase())
  );

  return (
    <header className="sticky top-0 z-40 bg-[#020617]/90 backdrop-blur-md border-b border-slate-800 shadow-xl">
      <div className="max-w-[1700px] mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16 sm:h-20 gap-4">
          
          {/* Logo & App Title */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-600/30">
              <Layers className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold tracking-tight text-white">
                  SCRAPE<span className="text-blue-400">ENGINE</span>
                </h1>
                <span className="hidden sm:inline-block text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  STUDIO v2.5
                </span>
              </div>
              <p className="text-[11px] text-slate-400 max-w-xs truncate hidden md:block">
                {t.appSubtitle}
              </p>
            </div>
          </div>

          {/* Center: Device View Controls */}
          <div className="hidden lg:flex items-center bg-slate-900 p-1 rounded-xl border border-slate-800">
            <button
              id="btn-view-triple"
              onClick={() => setViewMode('triple')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'triple'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/80'
              }`}
              title={t.viewTriple}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>{t.viewTriple}</span>
            </button>

            <button
              id="btn-view-desktop"
              onClick={() => setViewMode('desktop')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'desktop'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/80'
              }`}
              title={t.viewDesktop}
            >
              <Monitor className="w-3.5 h-3.5" />
              <span>{t.viewDesktop}</span>
            </button>

            <button
              id="btn-view-tablet"
              onClick={() => setViewMode('tablet')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'tablet'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/80'
              }`}
              title={t.viewTablet}
            >
              <Tablet className="w-3.5 h-3.5" />
              <span>{t.viewTablet}</span>
            </button>

            <button
              id="btn-view-mobile"
              onClick={() => setViewMode('mobile')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'mobile'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/80'
              }`}
              title={t.viewMobile}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>{t.viewMobile}</span>
            </button>
          </div>

          {/* Right Actions: Engine Badge, Quick ZIP, Language Selector */}
          <div className="flex items-center gap-2 sm:gap-3">
            
            {/* Browser Engine Badge / Notice Trigger */}
            <button
              id="btn-engine-status"
              onClick={onOpenBrowserNotice}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-slate-900 border border-slate-800 text-slate-300 hover:border-slate-700 text-xs font-medium transition-colors"
              title="ChromeDriver / Playwright Browser Engine Status"
            >
              <Cpu className="w-3.5 h-3.5 text-blue-400" />
              <span className="hidden sm:inline">{t.engineBadge}</span>
            </button>

            {/* Quick Download Button if data extracted */}
            {hasExtractedData && onQuickDownloadAll && (
              <button
                id="btn-quick-download"
                onClick={onQuickDownloadAll}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-md shadow-blue-600/30"
                title={t.downloadMasterZip}
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden md:inline">{t.downloadMasterZip}</span>
              </button>
            )}

            {/* 20 Languages Selector Dropdown */}
            <div className="relative">
              <button
                id="btn-language-selector"
                onClick={() => setIsLangOpen(!isLangOpen)}
                className="flex items-center gap-2 bg-slate-900 border border-slate-800 hover:border-slate-700 px-3 py-1.5 rounded-md text-slate-200 text-xs transition-colors"
                aria-label="Language selector"
              >
                <Globe className="w-3.5 h-3.5 text-blue-400" />
                <span className="text-base leading-none">{languageInfo.flag}</span>
                <span className="text-xs text-slate-300 font-medium">{languageInfo.code.toUpperCase()}</span>
                <ChevronDown className={`w-3 h-3 text-slate-500 transition-transform ${isLangOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Dropdown Menu */}
              {isLangOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsLangOpen(false)}
                  />
                  <div
                    className={`absolute ${dir === 'rtl' ? 'left-0' : 'right-0'} mt-2 w-64 bg-[#0f172a] border border-slate-800 rounded-xl shadow-2xl py-2 z-50 text-xs`}
                  >
                    <div className="px-3 pb-2 border-b border-slate-800">
                      <p className="text-[11px] font-semibold text-slate-400 mb-1.5">
                        20 World Languages (زبان‌ها / Languages)
                      </p>
                      <input
                        type="text"
                        placeholder="Search language / جستجو..."
                        value={langSearch}
                        onChange={(e) => setLangSearch(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 placeholder-slate-500 text-xs focus:outline-none focus:border-blue-500"
                        autoFocus
                      />
                    </div>

                    <div className="max-h-60 overflow-y-auto py-1">
                      {filteredLanguages.map((lang) => {
                        const isSelected = lang.code === currentLanguage;
                        return (
                          <button
                            key={lang.code}
                            id={`lang-opt-${lang.code}`}
                            onClick={() => {
                              setLanguage(lang.code as LanguageCode);
                              setIsLangOpen(false);
                            }}
                            className={`w-full flex items-center justify-between px-3 py-2 hover:bg-slate-800 text-left transition-colors ${
                              isSelected ? 'bg-blue-600/20 text-blue-300 font-semibold' : 'text-slate-300'
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <span className="text-base">{lang.flag}</span>
                              <div>
                                <div className="text-xs font-medium text-slate-100">{lang.nativeName}</div>
                                <div className="text-[10px] text-slate-400">{lang.name} ({lang.code.toUpperCase()})</div>
                              </div>
                            </div>
                            {isSelected && <Check className="w-3.5 h-3.5 text-blue-400" />}
                          </button>
                        );
                      })}
                      {filteredLanguages.length === 0 && (
                        <div className="px-3 py-4 text-center text-slate-500 text-xs">
                          No language found
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

          </div>

        </div>
      </div>
    </header>
  );
};
