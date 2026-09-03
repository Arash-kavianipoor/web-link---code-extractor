import React, { useState } from 'react';
import { useI18n } from '../i18n/I18nContext';
import { ExtractedBundle, EngineLog } from '../types';
import { 
  Code, 
  FileCode, 
  FileSpreadsheet, 
  Code2, 
  Terminal, 
  Info, 
  Copy, 
  Check, 
  Download, 
  ExternalLink,
  Search,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

interface CodeAssetViewerProps {
  bundle: ExtractedBundle | null;
  logs: EngineLog[];
}

export const CodeAssetViewer: React.FC<CodeAssetViewerProps> = ({ bundle, logs }) => {
  const { t } = useI18n();

  const [activeTab, setActiveTab] = useState<'html' | 'css' | 'js' | 'metadata' | 'console'>('html');
  const [selectedFileIdx, setSelectedFileIdx] = useState<number>(0);
  const [isCopied, setIsCopied] = useState(false);
  const [codeSearch, setCodeSearch] = useState('');

  if (!bundle) return null;

  // Compute active code content
  let activeContent = '';
  let activeFilename = '';

  if (activeTab === 'html') {
    const file = bundle.htmlFiles[selectedFileIdx] || bundle.htmlFiles[0];
    activeContent = file?.content || bundle.sanitizedHtml || bundle.rawHtml;
    activeFilename = file?.filename || 'index.html';
  } else if (activeTab === 'css') {
    const file = bundle.cssFiles[selectedFileIdx] || bundle.cssFiles[0];
    activeContent = file?.content || '/* No CSS styles extracted */';
    activeFilename = file?.filename || 'styles.css';
  } else if (activeTab === 'js') {
    const file = bundle.jsFiles[selectedFileIdx] || bundle.jsFiles[0];
    activeContent = file?.content || '// No scripts extracted';
    activeFilename = file?.filename || 'script.js';
  } else if (activeTab === 'metadata') {
    activeContent = JSON.stringify(bundle.metadata, null, 2);
    activeFilename = 'metadata.json';
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(activeContent);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const lineCount = activeContent.split('\n').length;
  const sizeBytes = new Blob([activeContent]).size;

  return (
    <section className="w-full py-4 px-3 sm:px-4 max-w-[1700px] mx-auto">
      
      <div className="bg-[#0f172a] rounded-xl border border-slate-800 shadow-xl overflow-hidden flex flex-col">
        
        {/* Navigation Tabs Header */}
        <div className="flex flex-wrap items-center justify-between border-b border-slate-800 bg-slate-900/80 px-4 pt-2.5 gap-2">
          
          <div className="flex items-center gap-1 overflow-x-auto pb-2 sm:pb-0">
            
            <button
              onClick={() => {
                setActiveTab('html');
                setSelectedFileIdx(0);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'html'
                  ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <FileCode className="w-3.5 h-3.5 text-blue-400" />
              <span>{t.tabHtml}</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-950 text-slate-400 font-mono">
                {bundle.htmlFiles.length}
              </span>
            </button>

            <button
              onClick={() => {
                setActiveTab('css');
                setSelectedFileIdx(0);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'css'
                  ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-blue-400" />
              <span>{t.tabCss}</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-950 text-slate-400 font-mono">
                {bundle.cssFiles.length}
              </span>
            </button>

            <button
              onClick={() => {
                setActiveTab('js');
                setSelectedFileIdx(0);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'js'
                  ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Code2 className="w-3.5 h-3.5 text-blue-400" />
              <span>{t.tabJs}</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-950 text-slate-400 font-mono">
                {bundle.jsFiles.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('metadata')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'metadata'
                  ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Info className="w-3.5 h-3.5 text-blue-400" />
              <span>{t.tabMetadata}</span>
            </button>

            <button
              onClick={() => setActiveTab('console')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'console'
                  ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Terminal className="w-3.5 h-3.5 text-blue-400" />
              <span>{t.tabConsole}</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-950 text-slate-400 font-mono">
                {logs.length}
              </span>
            </button>

          </div>

          {/* Sub Controls: Copy & Line Counts */}
          {activeTab !== 'console' && (
            <div className="flex items-center gap-3 pb-2 text-xs text-slate-400">
              <span className="font-mono text-[11px]">
                {lineCount} {t.lineCount} | {(sizeBytes / 1024).toFixed(1)} KB
              </span>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-medium border border-slate-800 transition-colors"
              >
                {isCopied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{t.copied}</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-blue-400" />
                    <span>{t.copyCode}</span>
                  </>
                )}
              </button>
            </div>
          )}

        </div>

        {/* Sub-file Selector Pills if multiple files exist in tab */}
        {activeTab === 'css' && bundle.cssFiles.length > 1 && (
          <div className="flex items-center gap-2 px-4 py-2 bg-slate-950 border-b border-slate-800 overflow-x-auto text-xs">
            <span className="text-slate-500 text-[11px] font-medium">Files:</span>
            {bundle.cssFiles.map((f, idx) => (
              <button
                key={f.id}
                onClick={() => setSelectedFileIdx(idx)}
                className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors whitespace-nowrap ${
                  selectedFileIdx === idx
                    ? 'bg-blue-600/20 text-blue-300 border border-blue-500/40 font-bold'
                    : 'text-slate-400 hover:text-slate-200 bg-slate-900 border border-slate-800'
                }`}
              >
                {f.filename}
              </button>
            ))}
          </div>
        )}

        {activeTab === 'js' && bundle.jsFiles.length > 1 && (
          <div className="flex items-center gap-2 px-4 py-2 bg-slate-950 border-b border-slate-800 overflow-x-auto text-xs">
            <span className="text-slate-500 text-[11px] font-medium">Files:</span>
            {bundle.jsFiles.map((f, idx) => (
              <button
                key={f.id}
                onClick={() => setSelectedFileIdx(idx)}
                className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors whitespace-nowrap ${
                  selectedFileIdx === idx
                    ? 'bg-blue-600/20 text-blue-300 border border-blue-500/40 font-bold'
                    : 'text-slate-400 hover:text-slate-200 bg-slate-900 border border-slate-800'
                }`}
              >
                {f.filename}
              </button>
            ))}
          </div>
        )}

        {/* Main Code & Console View Area */}
        <div className="relative p-4 bg-slate-950 max-h-[500px] overflow-auto font-mono text-xs text-slate-200 leading-relaxed">
          
          {activeTab === 'console' ? (
            <div className="space-y-1.5">
              <div className="text-[11px] text-slate-500 border-b border-slate-800 pb-2 mb-3 flex items-center justify-between">
                <span>Playwright / ChromeDriver Simulation Console Output</span>
                <span>{logs.length} events</span>
              </div>
              {logs.map((log) => (
                <div key={log.id} className="flex items-start gap-2.5 font-mono text-xs">
                  <span className="text-slate-600 shrink-0">[{log.timestamp}]</span>
                  {log.level === 'success' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />}
                  {log.level === 'warn' && <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />}
                  {log.level === 'error' && <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />}
                  {log.level === 'info' && <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0 mt-1.5" />}
                  <span
                    className={`${
                      log.level === 'success'
                        ? 'text-emerald-300 font-semibold'
                        : log.level === 'warn'
                        ? 'text-amber-300'
                        : log.level === 'error'
                        ? 'text-rose-400'
                        : 'text-slate-300'
                    }`}
                  >
                    {log.message}
                  </span>
                </div>
              ))}
              {logs.length === 0 && (
                <p className="text-slate-500">No console output recorded yet.</p>
              )}
            </div>
          ) : (
            <pre className="whitespace-pre-wrap break-all text-slate-300 selection:bg-blue-600 selection:text-white">
              <code>{activeContent}</code>
            </pre>
          )}

        </div>

      </div>

    </section>
  );
};
