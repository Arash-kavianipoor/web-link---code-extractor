import React, { useState, useMemo } from 'react';
import { RefreshCw, ExternalLink, ShieldCheck, Monitor } from 'lucide-react';
import { ExtractedFile, Language } from '../types.js';
import { translations } from '../i18n.js';

interface LivePreviewProps {
  files: ExtractedFile[];
  language: Language;
}

export const LivePreview: React.FC<LivePreviewProps> = ({ files, language }) => {
  const [key, setKey] = useState(0);
  const t = translations[language];

  // Combine HTML with extracted styles and scripts
  const compiledDoc = useMemo(() => {
    // Find main HTML file or default to index.html
    const htmlFile = files.find((f) => f.name === 'index.html') || files.find((f) => f.type === 'html') || files[0];
    const cssFile = files.find((f) => f.name === 'styles.css');
    const jsFile = files.find((f) => f.name === 'scripts.js');

    let baseHtml = htmlFile ? htmlFile.content : '<html><body>No HTML available</body></html>';

    // Inject or update styles
    if (cssFile && cssFile.content) {
      if (baseHtml.includes('id="offline-bundle-styles"')) {
        baseHtml = baseHtml.replace(
          /<style id="offline-bundle-styles">[\s\S]*?<\/style>/i,
          `<style id="offline-bundle-styles">\n${cssFile.content}\n</style>`
        );
      } else if (baseHtml.includes('</head>')) {
        baseHtml = baseHtml.replace('</head>', `<style id="offline-bundle-styles">\n${cssFile.content}\n</style>\n</head>`);
      } else {
        baseHtml = `<style id="offline-bundle-styles">\n${cssFile.content}\n</style>\n` + baseHtml;
      }
    }

    // Inject scripts
    if (jsFile && jsFile.content) {
      if (baseHtml.includes('</body>')) {
        baseHtml = baseHtml.replace('</body>', `<script>\n${jsFile.content}\n</script>\n</body>`);
      } else {
        baseHtml = baseHtml + `\n<script>\n${jsFile.content}\n</script>`;
      }
    }

    return baseHtml;
  }, [files]);

  const handleOpenNewWindow = () => {
    const blob = new Blob([compiledDoc], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl shadow-black/25 overflow-hidden">
      {/* Top controls */}
      <div className="p-4 border-b border-slate-800 bg-slate-900/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-slate-300">
          <Monitor className="w-4 h-4 text-indigo-400" />
          <span>{t.previewNotice}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setKey((k) => k + 1)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
            <span>{t.refreshPreview}</span>
          </button>
          <button
            onClick={handleOpenNewWindow}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
          >
            <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
            <span>{t.openNewTab}</span>
          </button>
        </div>
      </div>

      {/* Sandboxed iframe */}
      <div className="relative bg-[#090d16] p-2 sm:p-4">
        <div className="w-full bg-white rounded-xl border border-slate-800 shadow-inner overflow-hidden h-[550px]">
          <iframe
            key={key}
            srcDoc={compiledDoc}
            title="Live Preview Sandbox"
            sandbox="allow-scripts allow-modals allow-forms allow-same-origin"
            className="w-full h-full border-0"
          />
        </div>
      </div>
    </div>
  );
};
