import React, { useState, useRef, useEffect } from 'react';
import { useI18n } from '../i18n/I18nContext';
import { ExtractedBundle, DeviceType, ViewportOrientation } from '../types';
import { 
  Monitor, 
  Tablet, 
  Smartphone, 
  RotateCw, 
  RefreshCw, 
  Maximize2, 
  ZoomIn, 
  ZoomOut, 
  Compass,
  Lock,
  Layers,
  Sparkles,
  ExternalLink,
  Code
} from 'lucide-react';

interface DeviceViewportsProps {
  bundle: ExtractedBundle | null;
  targetUrl: string;
  viewMode: 'triple' | 'desktop' | 'tablet' | 'mobile' | 'split';
  onInspectElement?: (tagName: string) => void;
}

export const DeviceViewports: React.FC<DeviceViewportsProps> = ({
  bundle,
  targetUrl,
  viewMode,
  onInspectElement,
}) => {
  const { t } = useI18n();

  // Orientation states
  const [tabletOrientation, setTabletOrientation] = useState<ViewportOrientation>('portrait');
  const [mobileOrientation, setMobileOrientation] = useState<ViewportOrientation>('portrait');

  // Zoom scale states
  const [desktopZoom, setDesktopZoom] = useState<number>(0.65);
  const [tabletZoom, setTabletZoom] = useState<number>(0.65);
  const [mobileZoom, setMobileZoom] = useState<number>(0.75);

  // Sync scroll state
  const [syncScroll, setSyncScroll] = useState<boolean>(true);
  const desktopFrameRef = useRef<HTMLIFrameElement | null>(null);
  const tabletFrameRef = useRef<HTMLIFrameElement | null>(null);
  const mobileFrameRef = useRef<HTMLIFrameElement | null>(null);

  // Frame refresh keys
  const [reloadKey, setReloadKey] = useState<number>(0);

  const handleRefreshAll = () => {
    setReloadKey((prev) => prev + 1);
  };

  // Generate safe data URI or blob URL for iframe display
  const [frameSrc, setFrameSrc] = useState<string>('about:blank');

  useEffect(() => {
    if (!bundle) {
      setFrameSrc('about:blank');
      return;
    }

    // Build standalone HTML with inline styles & scripts
    const combinedStyles = bundle.cssFiles.map((c) => `<style>${c.content}</style>`).join('\n');
    const combinedScripts = bundle.jsFiles.map((j) => `<script>${j.content}</script>`).join('\n');

    let fullHtml = bundle.sanitizedHtml || bundle.rawHtml;
    if (!fullHtml.includes('<style>') && combinedStyles) {
      fullHtml = fullHtml.replace('</head>', `${combinedStyles}</head>`);
    }

    const blob = new Blob([fullHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    setFrameSrc(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [bundle, reloadKey]);

  return (
    <section className="w-full py-4 px-3 sm:px-4 max-w-[1700px] mx-auto">
      
      {/* Top Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 p-3 bg-[#0f172a] rounded-xl border border-slate-800 shadow-lg">
        
        {/* Left: Section Title & Active Target */}
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                {t.tabPreview}
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-900 text-blue-400 font-mono border border-slate-800">
                {bundle?.engineUsed || 'Playwright / Chromium'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 truncate max-w-md">
              {targetUrl || 'Waiting for URL input...'}
            </p>
          </div>
        </div>

        {/* Right: Global Viewport Actions (Sync Scroll, Reload) */}
        <div className="flex items-center gap-2">
          
          <button
            onClick={() => setSyncScroll(!syncScroll)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              syncScroll
                ? 'bg-blue-600/20 border-blue-500/40 text-blue-300'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
            title={t.syncScroll}
          >
            <Compass className={`w-3.5 h-3.5 ${syncScroll ? 'animate-spin' : ''}`} />
            <span>{syncScroll ? t.syncScrollActive : t.syncScroll}</span>
          </button>

          <button
            onClick={handleRefreshAll}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-medium border border-slate-800 transition-colors"
            title={t.refreshDevice}
          >
            <RefreshCw className="w-3.5 h-3.5 text-blue-400" />
            <span>{t.refreshDevice}</span>
          </button>

        </div>

      </div>

      {/* Viewport Render Containers Grid */}
      <div className={`grid gap-3 sm:gap-4 items-stretch ${
        viewMode === 'triple' 
          ? 'grid-cols-1 xl:grid-cols-12' 
          : viewMode === 'split' 
          ? 'grid-cols-1 lg:grid-cols-2' 
          : 'grid-cols-1'
      }`}>

        {/* 1. DESKTOP VIEWPORT (1440px / 1920px) */}
        {(viewMode === 'triple' || viewMode === 'desktop' || viewMode === 'split') && (
          <div className={`${
            viewMode === 'triple' 
              ? 'xl:col-span-7' 
              : viewMode === 'split' 
              ? 'col-span-1' 
              : 'col-span-1 max-w-5xl mx-auto w-full'
          } bg-[#0f172a] rounded-xl border border-slate-800 flex flex-col overflow-hidden shadow-2xl`}>
            
            {/* Desktop Pane Header */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800 bg-slate-900/60">
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold flex items-center gap-1.5">
                  <Monitor className="w-3.5 h-3.5 text-blue-400" />
                  Desktop View (1440px)
                </span>
                <div className="hidden sm:flex items-center gap-1 ms-1">
                  <div className="w-2 h-2 rounded-full bg-red-500/40" />
                  <div className="w-2 h-2 rounded-full bg-yellow-500/40" />
                  <div className="w-2 h-2 rounded-full bg-green-500/40" />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="hidden md:flex items-center gap-1 text-[10px] text-slate-400 font-mono bg-slate-950 px-2 py-0.5 rounded border border-slate-800 max-w-[200px] truncate">
                  <Lock className="w-2.5 h-2.5 text-blue-400" />
                  <span className="truncate">{targetUrl}</span>
                </div>

                {/* Scale buttons */}
                <div className="flex items-center bg-slate-950 rounded-lg p-0.5 border border-slate-800 text-slate-300">
                  <button
                    onClick={() => setDesktopZoom((z) => Math.max(0.4, Number((z - 0.1).toFixed(2))))}
                    className="p-1 hover:text-white"
                    title={t.zoomOut}
                  >
                    <ZoomOut className="w-3 h-3" />
                  </button>
                  <span className="text-[10px] px-1 font-mono">{Math.round(desktopZoom * 100)}%</span>
                  <button
                    onClick={() => setDesktopZoom((z) => Math.min(1.2, Number((z + 0.1).toFixed(2))))}
                    className="p-1 hover:text-white"
                    title={t.zoomIn}
                  >
                    <ZoomIn className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>

            {/* Desktop Screen Canvas */}
            <div className="relative bg-slate-950 p-3 flex-1 min-h-[500px] flex items-center justify-center overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent pointer-events-none" />
              {bundle ? (
                <div 
                  className="w-[1280px] h-[800px] origin-top transition-transform duration-200 bg-white rounded border border-slate-700 shadow-2xl overflow-hidden"
                  style={{ transform: `scale(${desktopZoom})` }}
                >
                  <iframe
                    ref={desktopFrameRef}
                    key={`desktop-${reloadKey}`}
                    src={frameSrc}
                    title="Desktop Preview 1920x1080"
                    sandbox="allow-scripts allow-same-origin"
                    className="w-full h-full bg-white border-0"
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-8 text-center text-slate-500 space-y-3">
                  <Monitor className="w-10 h-10 text-slate-700 animate-pulse" />
                  <p className="text-xs text-slate-400">{t.readyToScrape}</p>
                </div>
              )}
            </div>

          </div>
        )}

        {/* 2. TABLET VIEWPORT (768px) */}
        {(viewMode === 'triple' || viewMode === 'tablet' || viewMode === 'split') && (
          <div className={`${
            viewMode === 'triple' 
              ? 'xl:col-span-3' 
              : viewMode === 'split' 
              ? 'col-span-1' 
              : 'col-span-1 max-w-xl mx-auto w-full'
          } bg-[#0f172a] rounded-xl border border-slate-800 flex flex-col overflow-hidden shadow-2xl`}>
            
            {/* Tablet Chassis Header */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800 bg-slate-900/60">
              <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold flex items-center gap-1.5">
                <Tablet className="w-3.5 h-3.5 text-blue-400" />
                Tablet (768px)
              </span>

              <button
                onClick={() => setTabletOrientation((o) => (o === 'portrait' ? 'landscape' : 'portrait'))}
                className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-950 hover:bg-slate-800 text-slate-300 text-[10px] font-mono border border-slate-800 transition-colors"
                title={t.rotateScreen}
              >
                <RotateCw className="w-2.5 h-2.5 text-blue-400" />
                <span className="capitalize">{tabletOrientation}</span>
              </button>
            </div>

            {/* Tablet Screen Canvas */}
            <div className="relative bg-slate-950 flex-1 min-h-[500px] flex items-center justify-center p-2 overflow-hidden">
              {bundle ? (
                <div 
                  className={`transition-all duration-300 rounded-2xl p-2.5 bg-slate-900 border border-slate-700 shadow-2xl flex flex-col items-center ${
                    tabletOrientation === 'portrait' ? 'w-[380px]' : 'w-[480px]'
                  }`}
                  style={{ transform: `scale(${tabletZoom})` }}
                >
                  <div className="w-2 h-2 rounded-full bg-slate-800 mb-1.5 border border-slate-700" />
                  
                  <div className={`${tabletOrientation === 'portrait' ? 'w-[768px] h-[1024px]' : 'w-[1024px] h-[768px]'} origin-top`} style={{ transform: 'scale(0.46)' }}>
                    <iframe
                      ref={tabletFrameRef}
                      key={`tablet-${reloadKey}-${tabletOrientation}`}
                      src={frameSrc}
                      title="Tablet Preview 768x1024"
                      sandbox="allow-scripts allow-same-origin"
                      className="w-full h-full bg-white rounded-lg border-0 shadow-inner"
                    />
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-8 text-center text-slate-500 space-y-2">
                  <Tablet className="w-8 h-8 text-slate-700 animate-pulse" />
                  <p className="text-xs">{t.tabletLabel}</p>
                </div>
              )}
            </div>

          </div>
        )}

        {/* 3. MOBILE VIEWPORT (390px) */}
        {(viewMode === 'triple' || viewMode === 'mobile') && (
          <div className={`${
            viewMode === 'triple' 
              ? 'xl:col-span-2' 
              : 'col-span-1 max-w-sm mx-auto w-full'
          } bg-[#0f172a] rounded-xl border border-slate-800 flex flex-col overflow-hidden shadow-2xl`}>
            
            {/* Mobile Chassis Header */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800 bg-slate-900/60">
              <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold flex items-center gap-1.5">
                <Smartphone className="w-3.5 h-3.5 text-blue-400" />
                Mobile
              </span>

              <button
                onClick={() => setMobileOrientation((o) => (o === 'portrait' ? 'landscape' : 'portrait'))}
                className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-950 hover:bg-slate-800 text-slate-300 text-[10px] font-mono border border-slate-800 transition-colors"
                title={t.rotateScreen}
              >
                <RotateCw className="w-2.5 h-2.5 text-blue-400" />
                <span className="capitalize">{mobileOrientation}</span>
              </button>
            </div>

            {/* Mobile Screen Canvas */}
            <div className="relative bg-slate-950 flex-1 min-h-[500px] flex items-center justify-center p-2 overflow-hidden">
              {bundle ? (
                <div 
                  className={`transition-all duration-300 rounded-[28px] p-2 bg-slate-900 border-2 border-slate-800 shadow-2xl flex flex-col items-center ${
                    mobileOrientation === 'portrait' ? 'w-[260px]' : 'w-[360px]'
                  }`}
                  style={{ transform: `scale(${mobileZoom})` }}
                >
                  {/* Dynamic Island Notch */}
                  <div className="w-16 h-3 rounded-full bg-slate-950 mb-1.5 border border-slate-800 flex items-center justify-end px-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-800" />
                  </div>

                  <div className={`${mobileOrientation === 'portrait' ? 'w-[390px] h-[844px]' : 'w-[844px] h-[390px]'} origin-top`} style={{ transform: 'scale(0.62)' }}>
                    <iframe
                      ref={mobileFrameRef}
                      key={`mobile-${reloadKey}-${mobileOrientation}`}
                      src={frameSrc}
                      title="Mobile Preview 390x844"
                      sandbox="allow-scripts allow-same-origin"
                      className="w-full h-full bg-white rounded-xl border-0 shadow-inner"
                    />
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-8 text-center text-slate-500 space-y-2">
                  <Smartphone className="w-8 h-8 text-slate-700 animate-pulse" />
                  <p className="text-xs">{t.mobileLabel}</p>
                </div>
              )}
            </div>

          </div>
        )}

      </div>

    </section>
  );
};
