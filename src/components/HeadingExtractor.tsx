import React, { useState } from 'react';
import { useI18n } from '../i18n/I18nContext';
import { HeadingItem, ExtractedBundle } from '../types';
import { triggerFileDownload } from '../services/zipService';
import { 
  Heading1, 
  Heading2, 
  Heading3, 
  Heading4, 
  Heading5, 
  Heading6, 
  Search, 
  Download, 
  AlertTriangle, 
  CheckCircle2, 
  FileText, 
  Copy, 
  Check, 
  Filter, 
  Sparkles,
  ArrowDown
} from 'lucide-react';

interface HeadingExtractorProps {
  bundle: ExtractedBundle | null;
}

export const HeadingExtractor: React.FC<HeadingExtractorProps> = ({ bundle }) => {
  const { t, dir } = useI18n();

  const [selectedLevel, setSelectedLevel] = useState<number | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!bundle) return null;

  const headings = bundle.headings;
  const counts = bundle.headingCounts;

  const filteredHeadings = headings.filter((h) => {
    const matchesLevel = selectedLevel === 'all' || h.level === selectedLevel;
    const matchesSearch =
      !searchQuery ||
      h.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
      h.tag.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesLevel && matchesSearch;
  });

  const handleCopyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const exportAsJson = () => {
    const data = JSON.stringify(headings, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    triggerFileDownload(blob, 'headings_h1_h6.json');
  };

  const exportAsCsv = () => {
    const header = 'Level,Tag,Text,CharCount,WordCount,ParentTag,ElementId\n';
    const rows = headings
      .map(
        (h) =>
          `"${h.level}","${h.tag}","${h.text.replace(/"/g, '""')}","${h.charCount}","${h.wordCount}","${h.parentTag || ''}","${h.elementId || ''}"`
      )
      .join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    triggerFileDownload(blob, 'headings_h1_h6.csv');
  };

  const exportAsMarkdown = () => {
    const content = headings
      .map((h) => `${'#'.repeat(h.level)} ${h.text}`)
      .join('\n\n');
    const blob = new Blob([content], { type: 'text/markdown' });
    triggerFileDownload(blob, 'headings_outline.md');
  };

  const exportAsText = () => {
    const content = headings
      .map((h) => `[${h.tag.toUpperCase()}] ${h.text}`)
      .join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    triggerFileDownload(blob, 'headings_list.txt');
  };

  const getHeadingBadgeStyle = (level: number) => {
    switch (level) {
      case 1:
        return 'bg-rose-500/15 text-rose-300 border-rose-500/30';
      case 2:
        return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
      case 3:
        return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
      case 4:
        return 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30';
      case 5:
        return 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30';
      case 6:
        return 'bg-purple-500/15 text-purple-300 border-purple-500/30';
      default:
        return 'bg-slate-500/15 text-slate-300 border-slate-500/30';
    }
  };

  return (
    <section className="w-full py-4 px-3 sm:px-4 max-w-[1700px] mx-auto">
      
      {/* Title & Stats Summary Cards */}
      <div className="mb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-400" />
              <span>{t.headingsTitle}</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono">
                {counts.total} {t.allHeadings}
              </span>
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {t.headingsSubtitle}
            </p>
          </div>

          {/* Export Action Buttons */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={exportAsJson}
              className="px-2.5 py-1 rounded-md bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-medium border border-slate-800 hover:border-slate-700 transition-colors flex items-center gap-1"
              title={t.exportJson}
            >
              <Download className="w-3 h-3 text-blue-400" />
              <span>JSON</span>
            </button>
            <button
              onClick={exportAsCsv}
              className="px-2.5 py-1 rounded-md bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-medium border border-slate-800 hover:border-slate-700 transition-colors flex items-center gap-1"
              title={t.exportCsv}
            >
              <Download className="w-3 h-3 text-blue-400" />
              <span>CSV</span>
            </button>
            <button
              onClick={exportAsMarkdown}
              className="px-2.5 py-1 rounded-md bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-medium border border-slate-800 hover:border-slate-700 transition-colors flex items-center gap-1"
              title={t.exportMarkdown}
            >
              <Download className="w-3 h-3 text-blue-400" />
              <span>MD</span>
            </button>
            <button
              onClick={exportAsText}
              className="px-2.5 py-1 rounded-md bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-medium border border-slate-800 hover:border-slate-700 transition-colors flex items-center gap-1"
              title={t.exportText}
            >
              <Download className="w-3 h-3 text-blue-400" />
              <span>TXT</span>
            </button>
          </div>
        </div>

        {/* Heading Breakdown Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
          
          <button
            onClick={() => setSelectedLevel('all')}
            className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
              selectedLevel === 'all'
                ? 'bg-blue-600/20 border-blue-500/50 text-blue-300 shadow-md'
                : 'bg-[#0f172a] border-slate-800 text-slate-400 hover:border-slate-700'
            }`}
          >
            <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Total / کل</div>
            <div className="text-base font-bold text-white mt-0.5 font-mono">{counts.total}</div>
          </button>

          {[
            { tag: 'h1', level: 1, count: counts.h1, color: 'text-rose-400' },
            { tag: 'h2', level: 2, count: counts.h2, color: 'text-amber-400' },
            { tag: 'h3', level: 3, count: counts.h3, color: 'text-emerald-400' },
            { tag: 'h4', level: 4, count: counts.h4, color: 'text-cyan-400' },
            { tag: 'h5', level: 5, count: counts.h5, color: 'text-blue-400' },
            { tag: 'h6', level: 6, count: counts.h6, color: 'text-purple-400' },
          ].map((item) => (
            <button
              key={item.tag}
              onClick={() => setSelectedLevel(item.level)}
              className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                selectedLevel === item.level
                  ? 'bg-blue-600/20 border-blue-500/50 text-blue-300 shadow-md'
                  : 'bg-[#0f172a] border-slate-800 text-slate-400 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">{item.tag} Tag</span>
                <span className={`text-[10px] font-mono px-1 py-0.2 rounded bg-slate-950 ${item.color}`}>
                  L{item.level}
                </span>
              </div>
              <div className="text-base font-bold text-white mt-0.5 font-mono">
                {String(item.count).padStart(2, '0')}
              </div>
            </button>
          ))}

        </div>
      </div>

      {/* SEO Warnings Banner */}
      {bundle.seoScore.warnings.length > 0 && (
        <div className="mb-3 p-3 rounded-xl bg-amber-950/20 border border-amber-500/30 flex items-start gap-2.5 text-xs text-amber-200">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-semibold text-amber-300">{t.seoHeadingAnalysis}:</span>
            <ul className="list-disc list-inside space-y-0.5 text-amber-200/90 text-[11px]">
              {bundle.seoScore.warnings.map((warn, i) => (
                <li key={i}>{warn}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Search Bar & Filter Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 mb-3">
        
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute inset-y-0 start-3 my-auto pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t.searchHeadingsPlaceholder}
            className="w-full ps-8 pe-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="text-[11px] text-slate-400 font-mono">
          Showing <span className="text-blue-400 font-bold">{filteredHeadings.length}</span> of {headings.length} headings
        </div>

      </div>

      {/* Headings Hierarchy Tree List */}
      <div className="bg-[#0f172a] rounded-xl border border-slate-800 divide-y divide-slate-800/80 max-h-[500px] overflow-y-auto shadow-inner">
        {filteredHeadings.map((heading) => {
          const indentStyle =
            dir === 'rtl'
              ? { marginRight: `${(heading.level - 1) * 16}px` }
              : { marginLeft: `${(heading.level - 1) * 16}px` };

          const isCopied = copiedId === heading.id;

          return (
            <div
              key={heading.id}
              className="p-3 hover:bg-slate-900/60 transition-colors flex items-start justify-between gap-3 group"
              style={selectedLevel === 'all' ? indentStyle : undefined}
            >
              <div className="flex items-start gap-2.5 flex-1 min-w-0">
                {/* Level Badge */}
                <span
                  className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase font-mono border shrink-0 ${getHeadingBadgeStyle(
                    heading.level
                  )}`}
                >
                  {heading.tag}
                </span>

                {/* Heading Text & Metadata */}
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm font-semibold text-slate-100 leading-snug break-words">
                    {heading.text}
                  </p>

                  <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[10px] text-slate-400 font-mono">
                    <span className="bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
                      {heading.charCount} {t.charCount}
                    </span>
                    <span className="bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
                      {heading.wordCount} {t.wordCount}
                    </span>
                    {heading.elementId && (
                      <span className="text-blue-400 bg-blue-950/40 px-1.5 py-0.5 rounded border border-blue-500/20">
                        #{heading.elementId}
                      </span>
                    )}
                    {heading.parentTag && (
                      <span className="text-slate-500">
                        in &lt;{heading.parentTag}&gt;
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Action: Copy Text */}
              <button
                onClick={() => handleCopyText(heading.text, heading.id)}
                className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1.5 rounded-md bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white transition-all text-xs shrink-0 border border-slate-800"
                title={t.copyCode}
              >
                {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-blue-400" />}
              </button>
            </div>
          );
        })}

        {filteredHeadings.length === 0 && (
          <div className="p-8 text-center text-slate-500 text-xs">
            {t.noHeadingsFound}
          </div>
        )}
      </div>

    </section>
  );
};
