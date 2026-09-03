import React from 'react';
import { useI18n } from '../i18n/I18nContext';
import { 
  AlertTriangle, 
  ExternalLink, 
  Download, 
  CheckCircle2, 
  RefreshCw, 
  X, 
  Info, 
  Terminal, 
  ShieldAlert,
  Cpu
} from 'lucide-react';

interface BrowserRequirementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRetryScrape?: () => void;
  reasonMessage?: string;
}

const BROWSER_DOWNLOADS = [
  {
    name: 'Google Chrome',
    desc: 'Official Chromium browser runtime with full JavaScript engine',
    url: 'https://www.google.com/chrome/',
    iconColor: 'from-amber-500 to-rose-500',
    version: 'v128+ Latest Stable',
    badge: 'Recommended / پیشنهادی',
  },
  {
    name: 'Playwright Browser Drivers',
    desc: 'Headless automation & scraping suite (npx playwright install chromium)',
    url: 'https://playwright.dev/docs/intro',
    iconColor: 'from-emerald-500 to-teal-600',
    version: 'Chromium / WebKit / Firefox',
    badge: 'Scraper Engine',
  },
  {
    name: 'Chromium Project',
    desc: 'Pure open-source browser engine for developers',
    url: 'https://www.chromium.org/getting-involved/download-chromium/',
    iconColor: 'from-blue-500 to-cyan-500',
    version: 'Nightly & Stable',
    badge: 'Open-Source',
  },
  {
    name: 'Microsoft Edge',
    desc: 'Chromium-based browser with enterprise performance',
    url: 'https://www.microsoft.com/edge',
    iconColor: 'from-cyan-500 to-blue-600',
    version: 'Stable Release',
    badge: 'Windows / Mac / Linux',
  },
  {
    name: 'Firefox Developer Edition',
    desc: 'Advanced CSS grid and web inspector engine',
    url: 'https://www.mozilla.org/firefox/developer/',
    iconColor: 'from-orange-500 to-purple-600',
    version: 'Developer Channel',
    badge: 'Gecko Engine',
  },
];

export const BrowserRequirementModal: React.FC<BrowserRequirementModalProps> = ({
  isOpen,
  onClose,
  onRetryScrape,
  reasonMessage,
}) => {
  const { t, dir } = useI18n();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-2xl bg-[#0f172a] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        role="dialog"
        aria-modal="true"
      >
        
        {/* Modal Header */}
        <div className="flex items-start justify-between p-4 sm:p-5 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400 flex items-center justify-center">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-100">
                {t.browserRequiredTitle}
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5">
                ChromeDriver / Playwright Runtime Requirement & Download Center
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4">
          
          {/* Explanation Banner */}
          <div className="p-3.5 rounded-xl bg-blue-950/30 border border-blue-500/20 flex items-start gap-3">
            <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            <div className="text-xs text-blue-200 leading-relaxed space-y-1">
              <p className="font-semibold text-white">
                {reasonMessage || t.browserRequiredMessage}
              </p>
              <p className="text-blue-300/80 text-[11px]">
                {t.browserRequiredSubmessage}
              </p>
            </div>
          </div>

          {/* Quick Terminal Command */}
          <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 font-mono text-xs text-slate-300 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-blue-400" />
              <span className="text-slate-500">$</span>
              <span className="text-blue-300 font-bold">npx playwright install chromium</span>
            </div>
            <span className="text-[10px] text-slate-500 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
              CLI
            </span>
          </div>

          {/* Download Cards Grid */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-300">
              Official Browser & Driver Download Links (لینک‌های مستقیم دانلود):
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {BROWSER_DOWNLOADS.map((item) => (
                <a
                  key={item.name}
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-3 rounded-xl bg-slate-950 hover:bg-slate-900 border border-slate-800 hover:border-blue-500/40 transition-all group flex flex-col justify-between text-left"
                >
                  <div>
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="text-xs font-bold text-slate-100 group-hover:text-blue-400 transition-colors flex items-center gap-1.5">
                        <Cpu className="w-3.5 h-3.5 text-blue-400" />
                        {item.name}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-900 text-slate-400 font-medium border border-slate-800">
                        {item.badge}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 line-clamp-2">
                      {item.desc}
                    </p>
                  </div>

                  <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-blue-400 font-medium font-mono">
                    <span>{item.version}</span>
                    <span className="flex items-center gap-1 text-slate-300 group-hover:text-blue-400">
                      <Download className="w-3 h-3" />
                      Download <ExternalLink className="w-2.5 h-2.5" />
                    </span>
                  </div>
                </a>
              ))}
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/90 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[11px] text-slate-500">
            {t.noServerStressNote}
          </p>

          <div className="flex items-center gap-2">
            {onRetryScrape && (
              <button
                onClick={() => {
                  onClose();
                  onRetryScrape();
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-600/30 transition-all cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>{t.retryScraping}</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-medium border border-slate-800 transition-colors cursor-pointer"
            >
              {t.dismissNotice}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
