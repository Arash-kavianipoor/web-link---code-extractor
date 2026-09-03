import React from 'react';
import { useI18n } from '../i18n/I18nContext';
import { Layers, ShieldCheck, Globe, Cpu, Sparkles } from 'lucide-react';

export const Footer: React.FC = () => {
  const { t, availableLanguages } = useI18n();

  return (
    <footer className="w-full bg-[#020617] border-t border-slate-900 mt-12 py-8 px-4 text-xs text-slate-400">
      <div className="max-w-[1700px] mx-auto flex flex-col md:flex-row items-center justify-between gap-5">
        
        {/* Brand & Mission */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <div className="font-bold text-slate-200 text-xs sm:text-sm">
              WebScrape Studio & Multi-Device Extractor
            </div>
            <p className="text-[10px] text-slate-500">
              {t.poweredBy}
            </p>
          </div>
        </div>

        {/* Feature Badges */}
        <div className="flex flex-wrap items-center justify-center gap-2.5 text-[10px] font-mono">
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-slate-300">
            <Cpu className="w-3 h-3 text-blue-400" />
            ChromeDriver / Playwright Engine
          </span>
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-slate-300">
            <ShieldCheck className="w-3 h-3 text-emerald-400" />
            Zero Server / Worker Load
          </span>
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-slate-300">
            <Globe className="w-3 h-3 text-blue-400" />
            20 World Languages
          </span>
        </div>

        {/* Copyright */}
        <div className="text-[10px] text-slate-500 text-center md:text-right">
          <p>© {new Date().getFullYear()} WebScrape Studio. All rights reserved.</p>
          <p className="text-slate-600 mt-0.5">Engineered for browser DOM rendering & multi-device extraction.</p>
        </div>

      </div>
    </footer>
  );
};
