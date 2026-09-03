import React, { useState } from 'react';
import { useI18n } from '../i18n/I18nContext';
import { Search, Loader2, ArrowRight, ArrowLeft, ExternalLink, Sparkles, Globe, ShieldCheck } from 'lucide-react';

interface UrlInputBarProps {
  url: string;
  setUrl: (url: string) => void;
  onScrape: (targetUrl?: string) => void;
  isLoading: boolean;
  loadingStage?: string;
  loadingProgress?: number;
}

const SAMPLE_SITES = [
  { name: 'Wikipedia', url: 'https://en.wikipedia.org/wiki/Web_scraping' },
  { name: 'MDN Web Docs', url: 'https://developer.mozilla.org/en-US/docs/Web/HTML' },
  { name: 'Tailwind CSS', url: 'https://tailwindcss.com' },
  { name: 'GitHub Blog', url: 'https://github.blog' },
  { name: 'Example Domain', url: 'https://example.com' },
];

export const UrlInputBar: React.FC<UrlInputBarProps> = ({
  url,
  setUrl,
  onScrape,
  isLoading,
  loadingStage,
  loadingProgress,
}) => {
  const { t, dir } = useI18n();
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) {
      setErrorMsg('Please enter a target URL / لطفاً آدرس را وارد کنید');
      return;
    }
    setErrorMsg('');
    onScrape();
  };

  const handleSampleClick = (sampleUrl: string) => {
    setUrl(sampleUrl);
    setErrorMsg('');
    onScrape(sampleUrl);
  };

  return (
    <section className="w-full bg-[#020617] border-b border-slate-800 py-6 px-4">
      <div className="max-w-4xl mx-auto">
        
        {/* Main Form */}
        <form onSubmit={handleSubmit} className="relative">
          <div className="relative group">
            <div className="absolute inset-y-0 start-4 flex items-center pointer-events-none text-slate-500">
              <Globe className="w-4 h-4 text-blue-400" />
            </div>
            
            <input
              id="input-target-url"
              type="text"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                if (errorMsg) setErrorMsg('');
              }}
              placeholder={t.urlPlaceholder}
              disabled={isLoading}
              className="w-full bg-slate-900 border border-slate-700 rounded-full py-3 ps-11 pe-36 focus:outline-none focus:border-blue-500 text-sm text-slate-200 placeholder-slate-500 transition-all shadow-inner"
            />

            {url && !isLoading && (
              <button
                type="button"
                onClick={() => setUrl('')}
                className="absolute inset-y-0 end-32 flex items-center px-2 text-slate-500 hover:text-slate-300 text-xs"
              >
                ✕
              </button>
            )}

            {/* Scrape / Analyze Action Button */}
            <button
              id="btn-submit-scrape"
              type="submit"
              disabled={isLoading}
              className="absolute end-1.5 top-1.5 bottom-1.5 inline-flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white px-5 rounded-full text-xs sm:text-sm font-semibold tracking-wide transition-all shadow-md shadow-blue-600/30 active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer uppercase"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="hidden sm:inline">{loadingStage || t.scrapingButton}</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{t.scrapeButton}</span>
                  {dir === 'rtl' ? <ArrowLeft className="w-3.5 h-3.5" /> : <ArrowRight className="w-3.5 h-3.5" />}
                </>
              )}
            </button>
          </div>

          {/* Error message */}
          {errorMsg && (
            <p className="mt-2 text-xs text-rose-400 font-medium px-4 animate-in fade-in">
              {errorMsg}
            </p>
          )}

          {/* Progress Bar during loading */}
          {isLoading && (
            <div className="mt-3 w-full bg-slate-800 rounded-full h-1 overflow-hidden">
              <div
                className="bg-gradient-to-r from-blue-600 via-cyan-400 to-blue-500 h-1 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${loadingProgress || 50}%` }}
              />
            </div>
          )}
        </form>

        {/* Quick Sample Sites & Light Architecture Note */}
        <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2.5 text-xs text-slate-400">
          
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-medium text-slate-400">{t.sampleSites}</span>
            {SAMPLE_SITES.map((sample) => (
              <button
                key={sample.name}
                type="button"
                onClick={() => handleSampleClick(sample.url)}
                disabled={isLoading}
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 hover:border-slate-700 transition-colors text-[11px]"
              >
                <span>{sample.name}</span>
                <ExternalLink className="w-2.5 h-2.5 opacity-60" />
              </button>
            ))}
          </div>

          {/* No Server Stress Badge */}
          <div className="flex items-center gap-1.5 text-blue-400 text-[11px] bg-blue-950/40 px-2.5 py-0.5 rounded-full border border-blue-500/20">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
            <span>{t.engineDescription}</span>
          </div>

        </div>

      </div>
    </section>
  );
};
