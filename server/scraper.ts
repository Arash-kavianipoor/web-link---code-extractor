import * as cheerio from 'cheerio';
import { ScrapedLink, ScrapedHeading, HeadingLevel, ExtractedFile, ScrapeResult, CrawlMode, LinkType } from '../src/types.js';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 (Compatible WebScraperBot/2.0)';

// Known trackers to strip out for clean, error-free offline execution
const TRACKER_DOMAINS = [
  'google-analytics.com',
  'googletagmanager.com',
  'connect.facebook.net',
  'facebook.com/tr',
  'clarity.ms',
  'hotjar.com',
  'doubleclick.net',
  'pagead2.googlesyndication.com',
  'yandex.ru/metrika',
  'mc.yandex.ru',
  'adsbygoogle',
  'amplitude.com',
  'mixpanel.com',
  'segment.io',
];

export class SubrequestTracker {
  private count = 0;
  private readonly maxLimit: number;

  constructor(maxLimit = 36) {
    this.maxLimit = maxLimit;
  }

  canFetch(): boolean {
    return this.count < this.maxLimit;
  }

  record(): boolean {
    if (this.count >= this.maxLimit) {
      return false;
    }
    this.count++;
    return true;
  }

  get remaining(): number {
    return Math.max(0, this.maxLimit - this.count);
  }

  get total(): number {
    return this.count;
  }
}

async function fetchWithTimeout(
  url: string,
  timeoutMs = 7000,
  tracker?: SubrequestTracker
): Promise<{ ok: boolean; status: number; text: string; contentType: string }> {
  if (tracker && !tracker.record()) {
    throw new Error(`Subrequest limit budget reached (max ${tracker.total})`);
  }
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,text/css,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,fa;q=0.8',
      },
      signal: controller.signal,
      redirect: 'follow',
    });
    clearTimeout(id);
    const contentType = res.headers.get('content-type') || '';
    const text = await res.text();
    return { ok: res.ok, status: res.status, text, contentType };
  } catch (err: any) {
    clearTimeout(id);
    throw new Error(`Failed to fetch ${url}: ${err.message}`);
  }
}

async function fetchBinary(
  url: string,
  timeoutMs = 4500,
  tracker?: SubrequestTracker
): Promise<{ buffer: Buffer; mimeType: string } | null> {
  if (tracker && !tracker.record()) {
    return null;
  }
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: '*/*',
      },
      signal: controller.signal,
      redirect: 'follow',
    });
    clearTimeout(id);
    if (!res.ok) return null;

    let mimeType = res.headers.get('content-type') || '';
    mimeType = mimeType.split(';')[0].trim().toLowerCase();

    if (!mimeType || mimeType === 'application/octet-stream') {
      mimeType = guessMimeType(url);
    }

    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Limit individual asset to 1.5MB to protect worker memory
    if (buffer.byteLength > 1.5 * 1024 * 1024) {
      return null;
    }

    return { buffer, mimeType };
  } catch {
    clearTimeout(id);
    return null;
  }
}

function guessMimeType(urlStr: string): string {
  try {
    const pathname = new URL(urlStr).pathname.toLowerCase();
    if (pathname.endsWith('.woff2')) return 'font/woff2';
    if (pathname.endsWith('.woff')) return 'font/woff';
    if (pathname.endsWith('.ttf')) return 'font/ttf';
    if (pathname.endsWith('.otf')) return 'font/otf';
    if (pathname.endsWith('.eot')) return 'application/vnd.ms-fontobject';
    if (pathname.endsWith('.svg')) return 'image/svg+xml';
    if (pathname.endsWith('.png')) return 'image/png';
    if (pathname.endsWith('.jpg') || pathname.endsWith('.jpeg')) return 'image/jpeg';
    if (pathname.endsWith('.gif')) return 'image/gif';
    if (pathname.endsWith('.webp')) return 'image/webp';
    if (pathname.endsWith('.ico')) return 'image/x-icon';
    if (pathname.endsWith('.css')) return 'text/css';
    if (pathname.endsWith('.js')) return 'application/javascript';
  } catch {}
  return 'application/octet-stream';
}

function classifyLink(
  rawHref: string,
  basePageUrl: string,
  rootOrigin: string
): { resolvedUrl: string; type: LinkType } {
  const trimmed = rawHref.trim();
  if (trimmed.startsWith('mailto:')) {
    return { resolvedUrl: trimmed, type: 'mailto' };
  }
  if (trimmed.startsWith('tel:') || trimmed.startsWith('sms:')) {
    return { resolvedUrl: trimmed, type: 'other' };
  }
  if (trimmed.startsWith('#')) {
    return { resolvedUrl: trimmed, type: 'anchor' };
  }
  if (trimmed.startsWith('javascript:')) {
    return { resolvedUrl: trimmed, type: 'other' };
  }

  try {
    const resolved = new URL(trimmed, basePageUrl);
    const pathname = resolved.pathname.toLowerCase();
    if (/\.(png|jpe?g|gif|webp|svg|ico|pdf|zip|tar|gz|mp3|mp4|mov|woff2?|ttf|eot)$/i.test(pathname)) {
      return { resolvedUrl: resolved.href, type: 'asset' };
    }
    if (resolved.origin === rootOrigin) {
      return { resolvedUrl: resolved.href, type: 'internal' };
    }
    return { resolvedUrl: resolved.href, type: 'external' };
  } catch {
    return { resolvedUrl: trimmed, type: 'other' };
  }
}

/**
 * Recursively resolves @import rules and embeds all webfonts and images as Base64 Data URIs
 * so the CSS has ZERO internet dependencies and renders identical offline.
 */
async function processCssContent(
  rawCss: string,
  cssBaseUrl: string,
  visitedCssUrls: Set<string>,
  assetCache: Map<string, string>,
  tracker: SubrequestTracker,
  depth = 0
): Promise<string> {
  if (depth > 3) return rawCss;

  let processed = rawCss;

  // 1. Resolve and inline @import rules (e.g., @import url("..."); or @import "...";)
  const importRegex = /@import\s+(?:url\(\s*['"]?([^'")]+)['"]?\s*\)|['"]([^'"]+)['"])\s*([^;]*);/gi;
  const importMatches = [...processed.matchAll(importRegex)];

  for (const match of importMatches) {
    if (!tracker.canFetch()) break;
    const fullStatement = match[0];
    const importPath = (match[1] || match[2] || '').trim();
    if (!importPath || importPath.startsWith('data:')) continue;

    try {
      const resolvedImportUrl = new URL(importPath, cssBaseUrl).href;
      if (visitedCssUrls.has(resolvedImportUrl)) {
        processed = processed.replace(fullStatement, `/* Prevented circular @import: ${resolvedImportUrl} */`);
        continue;
      }
      visitedCssUrls.add(resolvedImportUrl);

      const res = await fetchWithTimeout(resolvedImportUrl, 4500, tracker);
      if (res.ok && res.text) {
        const nestedProcessed = await processCssContent(
          res.text,
          resolvedImportUrl,
          visitedCssUrls,
          assetCache,
          tracker,
          depth + 1
        );
        processed = processed.replace(
          fullStatement,
          `\n/* ===== START INLINED IMPORT: ${resolvedImportUrl} ===== */\n${nestedProcessed}\n/* ===== END INLINED IMPORT ===== */\n`
        );
      } else {
        processed = processed.replace(
          fullStatement,
          `/* Note: Failed to fetch imported CSS ${resolvedImportUrl} */`
        );
      }
    } catch {
      processed = processed.replace(fullStatement, `/* Note: Invalid @import URL ${importPath} */`);
    }
  }

  // 2. Resolve url(...) references: fonts, background images, icons
  const urlRegex = /url\(\s*(['"]?)([^'"()]+)\1\s*\)/gi;
  const urlMatches = [...processed.matchAll(urlRegex)];

  const distinctAssetPaths = new Set<string>();
  for (const match of urlMatches) {
    const assetPath = match[2]?.trim();
    if (
      assetPath &&
      !assetPath.startsWith('data:') &&
      !assetPath.startsWith('#') &&
      !assetPath.startsWith('blob:')
    ) {
      distinctAssetPaths.add(assetPath);
    }
  }

  // Limit font and image embeds per stylesheet to conserve subrequests and memory
  let fontEmbeds = 0;
  for (const assetPath of distinctAssetPaths) {
    try {
      const resolvedAssetUrl = new URL(assetPath, cssBaseUrl).href;

      let dataUri = assetCache.get(resolvedAssetUrl);
      if (!dataUri && tracker.canFetch() && fontEmbeds < 4) {
        const isEmbeddable = /\.(woff2?|ttf|otf|eot|svg|png|jpe?g|gif|webp|ico)(\?.*)?$/i.test(
          resolvedAssetUrl
        );

        if (isEmbeddable) {
          const binary = await fetchBinary(resolvedAssetUrl, 3500, tracker);
          if (binary && binary.buffer.byteLength <= 1024 * 1024) {
            fontEmbeds++;
            const b64 = binary.buffer.toString('base64');
            dataUri = `data:${binary.mimeType};base64,${b64}`;
            assetCache.set(resolvedAssetUrl, dataUri);
          }
        }
      }

      const escapedPath = assetPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const replaceRegex = new RegExp(`url\\(\\s*(['"]?)${escapedPath}\\1\\s*\\)`, 'g');

      if (dataUri) {
        processed = processed.replace(replaceRegex, `url("${dataUri}")`);
      } else {
        // Fallback to absolute URL so relative path doesn't fail on local file://
        processed = processed.replace(replaceRegex, `url("${resolvedAssetUrl}")`);
      }
    } catch {}
  }

  return processed;
}

/**
 * Transforms scraped HTML into a completely self-contained, 100% offline-compatible document:
 * 1. Replaces remote stylesheets with link to styles.css AND inlines the full CSS bundle
 * 2. Inlines HTML images as base64 data URIs so images render with ZERO internet connection
 * 3. Removes telemetry and ad scripts that cause offline console errors
 * 4. Adjusts internal links to point to local files
 */
async function processHtmlForOffline(
  rawHtml: string,
  pageUrl: string,
  combinedCss: string,
  pageMapping: Map<string, string>,
  assetCache: Map<string, string>,
  tracker: SubrequestTracker
): Promise<string> {
  const $ = cheerio.load(rawHtml);

  // Remove <base> tag to allow local file:/// resolution
  $('base').remove();

  // Remove remote stylesheet <link> tags
  $('link[rel="stylesheet"], link[rel="preload"][as="style"]').remove();

  // Clean out analytics and tracking scripts
  $('script').each((_, elem) => {
    const src = $(elem).attr('src') || '';
    const content = $(elem).html() || '';
    const isTracker = TRACKER_DOMAINS.some(
      (trackerDomain) => src.includes(trackerDomain) || content.includes(trackerDomain)
    );
    if (isTracker) {
      $(elem).remove();
    }
  });

  // Convert <img> tags to Base64 data URIs for true offline viewing (capped to keep subrequests under limit)
  const maxImagesToInline = Math.min(8, tracker.remaining);
  const imgElements = $('img').toArray().slice(0, maxImagesToInline);
  for (const elem of imgElements) {
    if (!tracker.canFetch()) break;
    const src = $(elem).attr('src') || $(elem).attr('data-src');
    if (src && !src.startsWith('data:')) {
      try {
        const resolvedImgUrl = new URL(src, pageUrl).href;
        let dataUri = assetCache.get(resolvedImgUrl);
        if (!dataUri) {
          const binary = await fetchBinary(resolvedImgUrl, 3500, tracker);
          if (binary && binary.buffer.byteLength <= 1024 * 1024) {
            const b64 = binary.buffer.toString('base64');
            dataUri = `data:${binary.mimeType};base64,${b64}`;
            assetCache.set(resolvedImgUrl, dataUri);
          }
        }
        if (dataUri) {
          $(elem).attr('src', dataUri);
          $(elem).removeAttr('srcset');
          $(elem).removeAttr('data-src');
          $(elem).removeAttr('loading');
        }
      } catch {}
    }
  }

  // Convert <link rel="icon">
  $('link[rel*="icon"]').each((_, elem) => {
    const href = $(elem).attr('href');
    if (href && !href.startsWith('data:')) {
      try {
        const resolvedFavicon = new URL(href, pageUrl).href;
        const cached = assetCache.get(resolvedFavicon);
        if (cached) {
          $(elem).attr('href', cached);
        }
      } catch {}
    }
  });

  // Rewrite internal links if we crawled multiple pages
  $('a').each((_, elem) => {
    const href = $(elem).attr('href');
    if (href) {
      try {
        const resolved = new URL(href, pageUrl).href.split('#')[0];
        if (pageMapping.has(resolved)) {
          const localFileName = pageMapping.get(resolved)!;
          const hash = href.includes('#') ? '#' + href.split('#')[1] : '';
          $(elem).attr('href', `${localFileName}${hash}`);
        }
      } catch {}
    }
  });

  // Ensure <head> exists
  if ($('head').length === 0) {
    $('html').prepend('<head></head>');
  }

  // 1. Link to local styles.css
  $('head').append('  <link rel="stylesheet" href="styles.css">\n');

  // 2. Also inject full CSS directly inside <style id="offline-bundle-styles">
  // This guarantees that even if index.html is downloaded alone or moved, it renders 100% styled offline!
  $('head').append(
    `  <style id="offline-bundle-styles">\n/* =========================================================\n   100% OFFLINE BUNDLE - ZERO INTERNET CONNECTION REQUIRED\n   All external stylesheets, fonts, and assets inlined.\n========================================================= */\n${combinedCss}\n  </style>\n`
  );

  // 3. Link to scripts.js at bottom of body
  if ($('body').length === 0) {
    $('html').append('<body></body>');
  }
  $('body').append('  <script src="scripts.js"></script>\n');

  return $.html();
}

export async function scrapeWebPage(
  startUrlInput: string,
  mode: CrawlMode = 'single',
  maxPages = 10
): Promise<ScrapeResult> {
  const startTime = Date.now();
  let parsedStartUrl: URL;
  try {
    let urlString = startUrlInput.trim();
    if (!/^https?:\/\//i.test(urlString)) {
      urlString = 'https://' + urlString;
    }
    parsedStartUrl = new URL(urlString);
  } catch {
    throw new Error(`Invalid URL provided: ${startUrlInput}`);
  }

  const baseOrigin = parsedStartUrl.origin;
  const domain = parsedStartUrl.hostname;

  const visitedUrls = new Set<string>();
  const toVisitQueue: string[] = [parsedStartUrl.href];
  const allScrapedLinks: ScrapedLink[] = [];
  const allScrapedHeadings: ScrapedHeading[] = [];
  const seenLinkKeys = new Set<string>();

  // Map to store raw crawled pages: url -> { filename, title, rawHtml }
  const rawPagesMap = new Map<string, { filename: string; title: string; rawHtml: string }>();
  const pageMapping = new Map<string, string>(); // url -> filename

  const allStylesheetUrls = new Set<string>();
  const allInlineStyles: { source: string; content: string }[] = [];
  const allScriptUrls = new Set<string>();
  const allInlineScripts: { source: string; content: string }[] = [];

  const assetCache = new Map<string, string>(); // url -> dataUri
  let siteTitle = '';

  // Cloudflare Workers free tier allows max 50 subrequests. Keep a strict budget of 36 to guarantee safety.
  const tracker = new SubrequestTracker(36);

  const maxPagesToCrawl = mode === 'single' ? 1 : Math.min(Math.max(1, maxPages), 20);

  while (toVisitQueue.length > 0 && visitedUrls.size < maxPagesToCrawl) {
    if (!tracker.canFetch()) break;
    const currentUrl = toVisitQueue.shift()!;
    const normalizedUrl = currentUrl.split('#')[0];

    if (visitedUrls.has(normalizedUrl)) {
      continue;
    }
    visitedUrls.add(normalizedUrl);

    try {
      const response = await fetchWithTimeout(currentUrl, 8000, tracker);
      if (!response.ok) continue;

      const html = response.text;
      const $ = cheerio.load(html);

      const pageTitle = $('title').text().trim() || domain;
      if (!siteTitle) {
        siteTitle = pageTitle;
      }

      let fileName = 'index.html';
      if (visitedUrls.size > 1) {
        let safePath = new URL(currentUrl).pathname.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/^_+|_+$/g, '');
        if (!safePath) safePath = `page_${visitedUrls.size}`;
        fileName = `${safePath}.html`;
      }

      rawPagesMap.set(normalizedUrl, { filename: fileName, title: pageTitle, rawHtml: html });
      pageMapping.set(normalizedUrl, fileName);

      // 1. Discover all links <a>
      $('a').each((_, elem) => {
        const href = $(elem).attr('href');
        if (!href) return;
        const text =
          $(elem).text().replace(/\s+/g, ' ').trim() ||
          $(elem).attr('title')?.trim() ||
          '[No anchor text]';
        const { resolvedUrl, type } = classifyLink(href, currentUrl, baseOrigin);

        const key = `${type}:${resolvedUrl}:${text}`;
        if (!seenLinkKeys.has(key)) {
          seenLinkKeys.add(key);
          allScrapedLinks.push({
            id: `link-${allScrapedLinks.length + 1}`,
            url: resolvedUrl,
            text: text.slice(0, 200),
            type,
            sourceUrl: currentUrl,
          });
        }

        if (mode === 'all' && type === 'internal' && resolvedUrl.startsWith(baseOrigin)) {
          const cleanUrl = resolvedUrl.split('#')[0];
          if (!visitedUrls.has(cleanUrl) && !toVisitQueue.includes(cleanUrl)) {
            if (!/\.(png|jpe?g|gif|svg|pdf|zip|css|js|xml|json|mp4|mp3)$/i.test(cleanUrl)) {
              toVisitQueue.push(cleanUrl);
            }
          }
        }
      });

      // 1.5. Discover and extract all headings (H1 to H6)
      $('h1, h2, h3, h4, h5, h6').each((_, elem) => {
        const tagName = (((elem as any).tagName || (elem as any).name || '') as string).toLowerCase() as HeadingLevel;
        const headingText = $(elem).text().replace(/\s+/g, ' ').trim();
        if (headingText) {
          allScrapedHeadings.push({
            id: `heading-${allScrapedHeadings.length + 1}`,
            level: tagName,
            text: headingText.slice(0, 500),
            sourceUrl: currentUrl,
            pageTitle,
            index: allScrapedHeadings.length + 1,
          });
        }
      });

      // 2. Discover ALL stylesheets (no arbitrary cap)
      $('link[rel="stylesheet"], link[rel="preload"][as="style"]').each((_, elem) => {
        const href = $(elem).attr('href');
        if (href) {
          try {
            allStylesheetUrls.add(new URL(href, currentUrl).href);
          } catch {}
        }
      });

      // 3. Extract all inline <style>
      $('style').each((idx, elem) => {
        const styleText = $(elem).html()?.trim();
        if (styleText) {
          allInlineStyles.push({
            source: `${fileName} (inline style #${idx + 1})`,
            content: styleText,
          });
        }
      });

      // 4. Discover all script tags
      $('script[src]').each((_, elem) => {
        const src = $(elem).attr('src');
        if (src) {
          const isTracker = TRACKER_DOMAINS.some((t) => src.includes(t));
          if (!isTracker) {
            try {
              allScriptUrls.add(new URL(src, currentUrl).href);
            } catch {}
          }
        }
      });

      // 5. Extract all inline scripts
      $('script:not([src])').each((idx, elem) => {
        const scriptType = $(elem).attr('type')?.toLowerCase();
        if (
          !scriptType ||
          scriptType === 'text/javascript' ||
          scriptType === 'application/javascript' ||
          scriptType === 'module'
        ) {
          const scriptText = $(elem).html()?.trim();
          if (scriptText && scriptText.length > 5) {
            const isTracker = TRACKER_DOMAINS.some((t) => scriptText.includes(t));
            if (!isTracker) {
              allInlineScripts.push({
                source: `${fileName} (inline script #${idx + 1})`,
                content: scriptText,
              });
            }
          }
        }
      });
    } catch (e: any) {
      console.warn(`Error crawling ${currentUrl}:`, e.message);
    }
  }

  // ==========================================================
  // COMPLETE CSS EXTRACTION & OFFLINE PREPARATION
  // ==========================================================
  const cssSections: string[] = [
    `/* ========================================================================\n   OFFLINE-READY STYLESHEET (100% SELF-CONTAINED)\n   Generated for: ${startUrlInput}\n   Extracted on: ${new Date().toUTCString()}\n   Zero Internet Dependencies: All @imports inlined, fonts/icons embedded as Base64 Data URIs.\n======================================================================== */\n`,
  ];

  const visitedCssUrls = new Set<string>();

  // Fetch external stylesheets (capped to 8 to avoid exhausting Cloudflare subrequests)
  const stylesheetUrlArray = Array.from(allStylesheetUrls).slice(0, 8);
  for (const cssUrl of stylesheetUrlArray) {
    if (visitedCssUrls.has(cssUrl) || !tracker.canFetch()) continue;
    visitedCssUrls.add(cssUrl);

    try {
      const cssRes = await fetchWithTimeout(cssUrl, 5000, tracker);
      if (cssRes.ok && cssRes.text) {
        const processedCss = await processCssContent(
          cssRes.text,
          cssUrl,
          visitedCssUrls,
          assetCache,
          tracker,
          0
        );
        cssSections.push(
          `/* ------------------------------------------------------------------------\n   Styles from External Stylesheet: ${cssUrl}\n------------------------------------------------------------------------ */\n${processedCss}\n`
        );
      }
    } catch {
      cssSections.push(`/* Note: Could not fetch stylesheet ${cssUrl} */\n`);
    }
  }

  // Append all inline <style> tags
  for (const inlineStyle of allInlineStyles) {
    try {
      const processedInline = await processCssContent(
        inlineStyle.content,
        parsedStartUrl.href,
        visitedCssUrls,
        assetCache,
        tracker,
        0
      );
      cssSections.push(
        `/* ------------------------------------------------------------------------\n   Inline Style from: ${inlineStyle.source}\n------------------------------------------------------------------------ */\n${processedInline}\n`
      );
    } catch {
      cssSections.push(`/* Note: Failed to process inline style from ${inlineStyle.source} */\n`);
    }
  }

  const combinedCss = cssSections.join('\n\n');

  // ==========================================================
  // JAVASCRIPT EXTRACTION
  // ==========================================================
  const jsSections: string[] = [
    `// ========================================================================\n// OFFLINE JAVASCRIPT BUNDLE\n// Extracted from ${startUrlInput}\n// ========================================================================\n`,
  ];

  for (const jsUrl of Array.from(allScriptUrls).slice(0, 6)) {
    if (!tracker.canFetch()) break;
    try {
      const jsRes = await fetchWithTimeout(jsUrl, 4000, tracker);
      if (jsRes.ok && jsRes.text && jsRes.text.length < 500000) {
        jsSections.push(
          `// --- Script from ${jsUrl} ---\n(function(){\ntry {\n${jsRes.text}\n} catch(e){ console.warn("Error in script ${jsUrl}:", e); }\n})();\n`
        );
      }
    } catch {
      jsSections.push(`// Note: Could not fetch script ${jsUrl}\n`);
    }
  }

  for (const inlineScript of allInlineScripts) {
    jsSections.push(
      `// --- Inline script: ${inlineScript.source} ---\n(function(){\ntry {\n${inlineScript.content}\n} catch(e){ console.warn("Error in inline script:", e); }\n})();\n`
    );
  }

  const combinedJs = jsSections.join('\n\n');

  // ==========================================================
  // TRANSFORM HTML PAGES FOR 100% OFFLINE USAGE
  // ==========================================================
  const files: ExtractedFile[] = [];

  for (const [pageUrl, rawData] of rawPagesMap.entries()) {
    const offlineHtml = await processHtmlForOffline(
      rawData.rawHtml,
      pageUrl,
      combinedCss,
      pageMapping,
      assetCache,
      tracker
    );

    files.push({
      id: `file-html-${rawData.filename}`,
      name: rawData.filename,
      type: 'html',
      content: offlineHtml,
      size: Buffer.byteLength(offlineHtml, 'utf-8'),
      sourceUrl: pageUrl,
      description: `100% Offline-ready: ${rawData.title}`,
    });
  }

  // Add styles.css
  files.push({
    id: 'file-css-main',
    name: 'styles.css',
    type: 'css',
    content: combinedCss,
    size: Buffer.byteLength(combinedCss, 'utf-8'),
    description: `Complete offline stylesheet (${allStylesheetUrls.size} external stylesheets + ${allInlineStyles.length} inline styles)`,
  });

  // Add scripts.js
  files.push({
    id: 'file-js-main',
    name: 'scripts.js',
    type: 'javascript',
    content: combinedJs,
    size: Buffer.byteLength(combinedJs, 'utf-8'),
    description: `Extracted JavaScript bundle (${allScriptUrls.size} external scripts + ${allInlineScripts.length} inline scripts)`,
  });

  // Add links_report.html
  const linksReportHtml = `<!DOCTYPE html>
<html lang="en" dir="auto">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Extracted Links Report - ${escapeHtml(siteTitle || domain)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.6; margin: 0; padding: 2rem; background: #0f172a; color: #e2e8f0; }
    .container { max-width: 1100px; margin: 0 auto; background: #1e293b; padding: 2rem; border-radius: 16px; border: 1px solid #334155; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3); }
    h1 { margin-top: 0; color: #f8fafc; font-size: 1.75rem; }
    .meta { display: flex; gap: 1.5rem; margin-bottom: 2rem; padding-bottom: 1rem; border-bottom: 1px solid #334155; font-size: 0.9rem; color: #94a3b8; flex-wrap: wrap; }
    .badge { display: inline-block; padding: 0.25rem 0.65rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; }
    .badge-internal { background: #064e3b; color: #34d399; border: 1px solid #059669; }
    .badge-external { background: #78350f; color: #fbbf24; border: 1px solid #d97706; }
    .badge-asset { background: #312e81; color: #a5b4fc; border: 1px solid #6366f1; }
    .badge-anchor { background: #334155; color: #cbd5e1; border: 1px solid #475569; }
    .badge-other { background: #1e293b; color: #94a3b8; border: 1px solid #334155; }
    table { width: 100%; border-collapse: collapse; margin-top: 1rem; font-size: 0.875rem; }
    th, td { text-align: left; padding: 0.75rem; border-bottom: 1px solid #334155; vertical-align: top; }
    th { background: #0f172a; color: #94a3b8; font-weight: 600; }
    a { color: #60a5fa; text-decoration: none; word-break: break-all; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Extracted Links Report</h1>
    <div class="meta">
      <div><strong>Target:</strong> ${escapeHtml(startUrlInput)}</div>
      <div><strong>Pages Scanned:</strong> ${visitedUrls.size}</div>
      <div><strong>Total Links:</strong> ${allScrapedLinks.length}</div>
      <div><strong>Offline Status:</strong> 100% Self-Contained (Zero Internet Dependency)</div>
    </div>
    <table>
      <thead>
        <tr>
          <th style="width: 50px;">#</th>
          <th>Link Text</th>
          <th>Target URL</th>
          <th style="width: 100px;">Type</th>
          <th>Found on Page</th>
        </tr>
      </thead>
      <tbody>
        ${allScrapedLinks
          .map(
            (link, idx) => `
        <tr>
          <td>${idx + 1}</td>
          <td><strong>${escapeHtml(link.text)}</strong></td>
          <td><a href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(link.url)}</a></td>
          <td><span class="badge badge-${link.type}">${link.type}</span></td>
          <td><small>${escapeHtml(link.sourceUrl)}</small></td>
        </tr>
        `
          )
          .join('')}
      </tbody>
    </table>
  </div>
</body>
</html>`;

  files.push({
    id: 'file-report-html',
    name: 'links_report.html',
    type: 'html',
    content: linksReportHtml,
    size: Buffer.byteLength(linksReportHtml, 'utf-8'),
    description: 'Self-contained interactive HTML report of all extracted links',
  });

  // Add structured links.json
  const linksJsonContent = JSON.stringify(
    {
      scrapedAt: new Date().toISOString(),
      targetUrl: startUrlInput,
      domain,
      offlineReady: true,
      pagesScanned: Array.from(visitedUrls),
      totalLinks: allScrapedLinks.length,
      totalHeadings: allScrapedHeadings.length,
      stylesheetsExtracted: allStylesheetUrls.size,
      inlineStylesExtracted: allInlineStyles.length,
      links: allScrapedLinks,
      headings: allScrapedHeadings,
    },
    null,
    2
  );

  files.push({
    id: 'file-json-links',
    name: 'links.json',
    type: 'json',
    content: linksJsonContent,
    size: Buffer.byteLength(linksJsonContent, 'utf-8'),
    description: 'Structured JSON file containing all scraped links metadata',
  });

  const headingsCount: Record<HeadingLevel, number> = {
    h1: allScrapedHeadings.filter((h) => h.level === 'h1').length,
    h2: allScrapedHeadings.filter((h) => h.level === 'h2').length,
    h3: allScrapedHeadings.filter((h) => h.level === 'h3').length,
    h4: allScrapedHeadings.filter((h) => h.level === 'h4').length,
    h5: allScrapedHeadings.filter((h) => h.level === 'h5').length,
    h6: allScrapedHeadings.filter((h) => h.level === 'h6').length,
  };

  // Add structured headings.json
  const headingsJsonContent = JSON.stringify(
    {
      scrapedAt: new Date().toISOString(),
      targetUrl: startUrlInput,
      domain,
      totalHeadings: allScrapedHeadings.length,
      counts: headingsCount,
      headings: allScrapedHeadings,
    },
    null,
    2
  );

  files.push({
    id: 'file-json-headings',
    name: 'headings.json',
    type: 'json',
    content: headingsJsonContent,
    size: Buffer.byteLength(headingsJsonContent, 'utf-8'),
    description: `Structured JSON file with all ${allScrapedHeadings.length} extracted H1-H6 headings`,
  });

  const internalCount = allScrapedLinks.filter((l) => l.type === 'internal').length;
  const externalCount = allScrapedLinks.filter((l) => l.type === 'external').length;

  return {
    targetUrl: startUrlInput,
    mode,
    domain,
    title: siteTitle || domain,
    pagesScanned: visitedUrls.size,
    totalLinksFound: allScrapedLinks.length,
    internalLinksCount: internalCount,
    externalLinksCount: externalCount,
    links: allScrapedLinks,
    headings: allScrapedHeadings,
    totalHeadingsFound: allScrapedHeadings.length,
    headingsCount,
    files,
    scannedUrls: Array.from(visitedUrls),
    executionTimeMs: Date.now() - startTime,
  };
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
