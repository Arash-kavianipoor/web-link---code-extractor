import React, { useState } from 'react';
import { useI18n } from '../i18n/I18nContext';
import { ExtractedBundle } from '../types';
import { 
  downloadHtmlZipBundle, 
  downloadCssZipBundle, 
  downloadJsZipBundle, 
  downloadMasterPackageZip 
} from '../services/zipService';
import { 
  FileCode, 
  FileSpreadsheet, 
  Code2, 
  Package, 
  Download, 
  CheckCircle2, 
  Loader2, 
  Sparkles,
  Layers,
  FileCheck
} from 'lucide-react';

interface ZipDownloadPanelProps {
  bundle: ExtractedBundle | null;
}

export const ZipDownloadPanel: React.FC<ZipDownloadPanelProps> = ({ bundle }) => {
  const { t } = useI18n();

  const [downloadingType, setDownloadingType] = useState<string | null>(null);
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);

  const handleDownload = async (type: 'html' | 'css' | 'js' | 'master') => {
    if (!bundle) return;
    setDownloadingType(type);
    try {
      if (type === 'html') {
        await downloadHtmlZipBundle(bundle);
      } else if (type === 'css') {
        await downloadCssZipBundle(bundle);
      } else if (type === 'js') {
        await downloadJsZipBundle(bundle);
      } else if (type === 'master') {
        await downloadMasterPackageZip(bundle);
      }
      setDownloadSuccess(type);
      setTimeout(() => setDownloadSuccess(null), 3000);
    } catch (err) {
      console.error('Download error:', err);
    } finally {
      setDownloadingType(null);
    }
  };

  if (!bundle) return null;

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <section className="w-full py-4 px-3 sm:px-4 max-w-[1700px] mx-auto">
      
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 p-4 bg-[#0f172a] rounded-xl border border-slate-800 shadow-lg">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-blue-600/20 border border-blue-500/30 text-blue-400 flex items-center justify-center shadow-inner">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
              {t.downloadsTitle}
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                Ready / آماده دانلود
              </span>
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {t.downloadsSubtitle}
            </p>
          </div>
        </div>

        {/* Master 3-in-1 Download Button */}
        <button
          id="btn-download-master-zip"
          onClick={() => handleDownload('master')}
          disabled={downloadingType === 'master'}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs sm:text-sm shadow-md shadow-blue-600/30 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-60 uppercase tracking-wide"
        >
          {downloadingType === 'master' ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Packaging 3 ZIPs...</span>
            </>
          ) : downloadSuccess === 'master' ? (
            <>
              <CheckCircle2 className="w-4 h-4 text-emerald-300" />
              <span>Downloaded!</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 text-blue-200" />
              <span>{t.downloadMasterZip}</span>
              <Download className="w-4 h-4" />
            </>
          )}
        </button>
      </div>

      {/* 3 Separate ZIP Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* 1. HTML ZIP Card */}
        <div className="bg-[#0f172a] rounded-xl border border-slate-800 p-4 flex flex-col justify-between hover:border-blue-500/40 transition-all group shadow-md">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center">
                <FileCode className="w-4 h-4" />
              </div>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-950 text-slate-300 border border-slate-800">
                {formatSize(bundle.stats.htmlSizeBytes)}
              </span>
            </div>

            <h4 className="text-xs sm:text-sm font-bold text-slate-100 group-hover:text-blue-400 transition-colors">
              {t.downloadHtmlZip}
            </h4>
            <p className="text-[11px] text-slate-400 mt-1 mb-3 leading-relaxed">
              {t.htmlZipDesc}
            </p>

            <div className="space-y-1 text-[10px] text-slate-400 bg-slate-950 p-2.5 rounded-lg border border-slate-800 mb-3 font-mono">
              <div className="flex justify-between">
                <span>index.html</span>
                <span className="text-slate-500">Rendered DOM</span>
              </div>
              <div className="flex justify-between">
                <span>raw_source.html</span>
                <span className="text-slate-500">Raw Source</span>
              </div>
              <div className="flex justify-between">
                <span>headings_h1_h6.json</span>
                <span className="text-blue-400">{bundle.headingCounts.total} tags</span>
              </div>
              <div className="flex justify-between">
                <span>metadata.json</span>
                <span className="text-slate-500">SEO Schema</span>
              </div>
            </div>
          </div>

          <button
            id="btn-download-html-zip"
            onClick={() => handleDownload('html')}
            disabled={downloadingType === 'html'}
            className="w-full inline-flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 hover:border-slate-700 text-xs font-semibold transition-all cursor-pointer disabled:opacity-60"
          >
            {downloadingType === 'html' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5 text-blue-400" />
            )}
            <span>{t.downloadHtmlZip}</span>
          </button>
        </div>

        {/* 2. CSS ZIP Card */}
        <div className="bg-[#0f172a] rounded-xl border border-slate-800 p-4 flex flex-col justify-between hover:border-blue-500/40 transition-all group shadow-md">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center">
                <FileSpreadsheet className="w-4 h-4" />
              </div>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-950 text-slate-300 border border-slate-800">
                {formatSize(bundle.stats.cssSizeBytes)}
              </span>
            </div>

            <h4 className="text-xs sm:text-sm font-bold text-slate-100 group-hover:text-blue-400 transition-colors">
              {t.downloadCssZip}
            </h4>
            <p className="text-[11px] text-slate-400 mt-1 mb-3 leading-relaxed">
              {t.cssZipDesc}
            </p>

            <div className="space-y-1 text-[10px] text-slate-400 bg-slate-950 p-2.5 rounded-lg border border-slate-800 mb-3 font-mono">
              <div className="flex justify-between">
                <span>styles.bundle.css</span>
                <span className="text-slate-500">Master Sheet</span>
              </div>
              <div className="flex justify-between">
                <span>Extracted Files</span>
                <span className="text-blue-400">{bundle.cssFiles.length} files</span>
              </div>
              <div className="flex justify-between">
                <span>CSS_MANIFEST.json</span>
                <span className="text-slate-500">Asset Map</span>
              </div>
            </div>
          </div>

          <button
            id="btn-download-css-zip"
            onClick={() => handleDownload('css')}
            disabled={downloadingType === 'css'}
            className="w-full inline-flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 hover:border-slate-700 text-xs font-semibold transition-all cursor-pointer disabled:opacity-60"
          >
            {downloadingType === 'css' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5 text-blue-400" />
            )}
            <span>{t.downloadCssZip}</span>
          </button>
        </div>

        {/* 3. JavaScript ZIP Card */}
        <div className="bg-[#0f172a] rounded-xl border border-slate-800 p-4 flex flex-col justify-between hover:border-blue-500/40 transition-all group shadow-md">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
                <Code2 className="w-4 h-4" />
              </div>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-950 text-slate-300 border border-slate-800">
                {formatSize(bundle.stats.jsSizeBytes)}
              </span>
            </div>

            <h4 className="text-xs sm:text-sm font-bold text-slate-100 group-hover:text-blue-400 transition-colors">
              {t.downloadJsZip}
            </h4>
            <p className="text-[11px] text-slate-400 mt-1 mb-3 leading-relaxed">
              {t.jsZipDesc}
            </p>

            <div className="space-y-1 text-[10px] text-slate-400 bg-slate-950 p-2.5 rounded-lg border border-slate-800 mb-3 font-mono">
              <div className="flex justify-between">
                <span>bundle.scripts.js</span>
                <span className="text-slate-500">Combined JS</span>
              </div>
              <div className="flex justify-between">
                <span>Script Blocks</span>
                <span className="text-emerald-400">{bundle.jsFiles.length} scripts</span>
              </div>
              <div className="flex justify-between">
                <span>JS_MANIFEST.json</span>
                <span className="text-slate-500">Modules Map</span>
              </div>
            </div>
          </div>

          <button
            id="btn-download-js-zip"
            onClick={() => handleDownload('js')}
            disabled={downloadingType === 'js'}
            className="w-full inline-flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 hover:border-slate-700 text-xs font-semibold transition-all cursor-pointer disabled:opacity-60"
          >
            {downloadingType === 'js' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5 text-blue-400" />
            )}
            <span>{t.downloadJsZip}</span>
          </button>
        </div>

      </div>

    </section>
  );
};
