/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { I18nProvider, useI18n } from './i18n/I18nContext';
import { ExtractedBundle, EngineLog } from './types';
import { scrapeTargetWebsite, normalizeTargetUrl } from './services/scraperEngine';
import { downloadMasterPackageZip } from './services/zipService';
import { Header } from './components/Header';
import { UrlInputBar } from './components/UrlInputBar';
import { DeviceViewports } from './components/DeviceViewports';
import { ZipDownloadPanel } from './components/ZipDownloadPanel';
import { HeadingExtractor } from './components/HeadingExtractor';
import { CodeAssetViewer } from './components/CodeAssetViewer';
import { BrowserRequirementModal } from './components/BrowserRequirementModal';
import { Footer } from './components/Footer';

function MainApp() {
  const { t } = useI18n();

  // URL state
  const [url, setUrl] = useState<string>('https://en.wikipedia.org/wiki/Web_scraping');
  const [activeScrapedUrl, setActiveScrapedUrl] = useState<string>('https://en.wikipedia.org/wiki/Web_scraping');

  // Viewport mode
  const [viewMode, setViewMode] = useState<'triple' | 'desktop' | 'tablet' | 'mobile' | 'split'>('triple');

  // Extraction data & status
  const [bundle, setBundle] = useState<ExtractedBundle | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingStage, setLoadingStage] = useState<string>('');
  const [loadingProgress, setLoadingProgress] = useState<number>(0);
  const [logs, setLogs] = useState<EngineLog[]>([]);

  // Browser requirement modal state (non-blocking popup)
  const [isBrowserNoticeOpen, setIsBrowserNoticeOpen] = useState<boolean>(false);
  const [browserNoticeReason, setBrowserNoticeReason] = useState<string>('');

  const addLog = useCallback((log: EngineLog) => {
    setLogs((prev) => [log, ...prev].slice(0, 50));
  }, []);

  // Main Scrape Handler
  const handleScrape = useCallback(
    async (overrideUrl?: string) => {
      const target = overrideUrl || url;
      if (!target.trim()) return;

      const normalized = normalizeTargetUrl(target);
      setIsLoading(true);
      setLoadingStage('Initializing ChromeDriver...');
      setLoadingProgress(10);
      setLogs([]);

      try {
        const result = await scrapeTargetWebsite({
          url: normalized,
          onLog: addLog,
          onProgress: (stage, percent) => {
            setLoadingStage(stage);
            setLoadingProgress(percent);
          },
        });

        setBundle(result);
        setActiveScrapedUrl(normalized);

        // If site was strictly walled or required driver fallback, open browser notice gracefully
        if (result.engineUsed === 'Client DOM Engine') {
          setBrowserNoticeReason(
            `Target site (${normalized}) has strict CORS / frame constraints. Rendered in Client Sandbox mode.`
          );
        }
      } catch (err) {
        console.error('Scrape execution error:', err);
        setBrowserNoticeReason(
          `Unable to directly execute automated browser runner for "${normalized}". A modern browser (Chrome / Playwright) is recommended.`
        );
        setIsBrowserNoticeOpen(true);
      } finally {
        setIsLoading(false);
        setLoadingStage('');
        setLoadingProgress(100);
      }
    },
    [url, addLog]
  );

  // Initial load scrape
  useEffect(() => {
    handleScrape('https://en.wikipedia.org/wiki/Web_scraping');
  }, []);

  const handleQuickDownloadAll = () => {
    if (bundle) {
      downloadMasterPackageZip(bundle);
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 flex flex-col selection:bg-blue-600 selection:text-white">
      
      {/* Top Header with 20 Language Selector & View Modes */}
      <Header
        viewMode={viewMode}
        setViewMode={setViewMode}
        onOpenBrowserNotice={() => setIsBrowserNoticeOpen(true)}
        hasExtractedData={Boolean(bundle)}
        onQuickDownloadAll={handleQuickDownloadAll}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col">
        
        {/* Target URL Input Bar */}
        <UrlInputBar
          url={url}
          setUrl={setUrl}
          onScrape={handleScrape}
          isLoading={isLoading}
          loadingStage={loadingStage}
          loadingProgress={loadingProgress}
        />

        {/* Triple Simultaneous Device Viewports (Desktop / Tablet / Mobile) */}
        <DeviceViewports
          bundle={bundle}
          targetUrl={activeScrapedUrl}
          viewMode={viewMode}
        />

        {/* 3 Separate ZIP Downloads (HTML, CSS, JS) + Master Archive */}
        {bundle && (
          <ZipDownloadPanel bundle={bundle} />
        )}

        {/* Full H1 to H6 Heading Hierarchy Analyzer & Exporter */}
        {bundle && (
          <HeadingExtractor bundle={bundle} />
        )}

        {/* Code & Asset Inspector (HTML, CSS, JS, Metadata, Logs) */}
        {bundle && (
          <CodeAssetViewer bundle={bundle} logs={logs} />
        )}

      </main>

      {/* Non-Blocking Browser / Playwright Requirement Modal */}
      <BrowserRequirementModal
        isOpen={isBrowserNoticeOpen}
        onClose={() => setIsBrowserNoticeOpen(false)}
        onRetryScrape={() => handleScrape()}
        reasonMessage={browserNoticeReason}
      />

      {/* Semantic Accessible Footer */}
      <Footer />

    </div>
  );
}

export default function App() {
  return (
    <I18nProvider>
      <MainApp />
    </I18nProvider>
  );
}
