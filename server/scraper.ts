import * as cheerio from 'cheerio';
import { ScrapedLink, ScrapedHeading, HeadingLevel, ExtractedFile, ScrapeResult, CrawlMode, LinkType } from '../src/types.js';

const CHROME_DESKTOP_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

// Known trackers and ad networks to strip for clean offline execution
const TRACKER_DOMAINS = [
  'google-analytics.com',
  'googletagmanager.com',
  'connect.facebook.net',
  'facebook.com/tr',
  'clarity.ms',
  'hotjar.com',
  'doubleclick.net',
  'pagead2.googlesyndication.com',
  'yandex.ru',
  'mc.yandex.ru',
  'adsbygoogle',
  'amplitude.com',
  'mixpanel.com',
  'segment.io',
  'sentry.io',
  'datadoghq.com',
  'newrelic.com',
];

const BROWSER_HEADERS: Record<string, string> = {
  'User-Agent': CHROME_DESKTOP_UA,
  'Accept-Language': 'en-US,en;q=0.9,fa;q=0.8',
  'Sec-Ch-Ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
  'Sec-Ch-Ua-Mobile': '?0',
  'Sec-Ch-Ua-Platform': '"Windows"',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Upgrade-Insecure-Requests': '1',
};

// Check if running in Node.js runtime vs Cloudflare Workers
const isNodeRuntime =
  typeof process !== 'undefined' &&
  process.versions != null &&
  process.versions.node != null;

export class SubrequestTracker {
  private count = 0;
  private readonly maxLimit: number;

  constructor(maxLimit?: number) {
    this.maxLimit = maxLimit ?? (isNodeRuntime ? 160 : 42);
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
  timeoutMs = 9000,
  tracker?: SubrequestTracker,
  customAccept = 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8'
): Promise<{ ok: boolean; status: number; text: string; contentType: string; finalUrl: string }> {
  if (tracker && !tracker.record()) {
    throw new Error(`Subrequest limit budget reached (max ${tracker.total})`);
  }
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: {
        ...BROWSER_HEADERS,
        Accept: customAccept,
      },
      signal: controller.signal,
      redirect: 'follow',
    });
    clearTimeout(id);
    const contentType = res.headers.get('content-type') || '';
    const text = await res.text();
    return { ok: res.ok, status: res.status, text, contentType, finalUrl: res.url || url };
  } catch (err: any) {
    clearTimeout(id);
    throw new Error(`Failed to fetch ${url}: ${err.message}`);
  }
}

async function fetchBinary(
  url: string,
  timeoutMs = 6000,
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
        'User-Agent': CHROME_DESKTOP_UA,
        Accept: '*/*',
        'Sec-Fetch-Dest': 'image',
        'Sec-Fetch-Mode': 'no-cors',
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

    // Limit individual asset to 2MB to protect memory
    if (buffer.byteLength > 2 * 1024 * 1024) {
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
 * Universal stylesheet tester: accurately catches all variants of stylesheet link tags
 * (e.g., 'preload stylesheet', 'stylesheet', 'alternate stylesheet', 'preload as=style', etc.)
 */
function isStylesheetLink(relAttr: string, asAttr: string, typeAttr: string, hrefAttr: string): boolean {
  const rel = (relAttr || '').toLowerCase();
  const as = (asAttr || '').toLowerCase();
  const type = (typeAttr || '').toLowerCase();
  const href = (hrefAttr || '').toLowerCase();

  return (
    rel.includes('stylesheet') ||
    as === 'style' ||
    type === 'text/css' ||
    /\.css(\?.*)?$/i.test(href)
  );
}

/**
 * Recursively resolves @import rules and embeds webfonts and images as Base64 Data URIs
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

  // Remove individual @charset directives so we can have a single unified one at file head
  let processed = rawCss.replace(/@charset\s+['"][^'"]*['"];?/gi, '');

  // 1. Resolve and inline @import rules recursively
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
        processed = processed.replace(fullStatement, `/* Circular @import prevented: ${resolvedImportUrl} */`);
        continue;
      }
      visitedCssUrls.add(resolvedImportUrl);

      const res = await fetchWithTimeout(resolvedImportUrl, 7000, tracker, 'text/css,*/*;q=0.1');
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
          `\n/* ===== INLINED IMPORT: ${resolvedImportUrl} ===== */\n${nestedProcessed}\n/* ===== END INLINED IMPORT ===== */\n`
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

  // 2. Discover all url(...) asset paths in CSS (fonts, background images, icons)
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

  // Pre-fetch fonts and images for offline embedding (prioritizing fonts and icons)
  for (const assetPath of distinctAssetPaths) {
    if (!tracker.canFetch()) break;
    try {
      const resolvedAssetUrl = new URL(assetPath, cssBaseUrl).href;
      if (!assetCache.has(resolvedAssetUrl)) {
        const isEmbeddable = /\.(woff2?|ttf|otf|eot|svg|png|jpe?g|gif|webp|ico)(\?.*)?$/i.test(resolvedAssetUrl);
        if (isEmbeddable) {
          const binary = await fetchBinary(resolvedAssetUrl, 5000, tracker);
          if (binary && binary.buffer.byteLength <= 1.5 * 1024 * 1024) {
            const b64 = binary.buffer.toString('base64');
            const dataUri = `data:${binary.mimeType};base64,${b64}`;
            assetCache.set(resolvedAssetUrl, dataUri);
          }
        }
      }
    } catch {}
  }

  // 3. Fast, single-pass URL rewriting:
  // Replaces all relative URLs with their Base64 Data URI (if cached), or their absolute URL.
  // This GUARANTEES that zero relative paths are left broken in offline files!
  processed = processed.replace(
    /url\(\s*(['"]?)([^'"()]+)\1\s*\)/gi,
    (fullMatch, _quote, rawUrl) => {
      const trimmed = (rawUrl || '').trim();
      if (!trimmed || trimmed.startsWith('data:') || trimmed.startsWith('#') || trimmed.startsWith('blob:')) {
        return fullMatch;
      }
      try {
        const resolved = new URL(trimmed, cssBaseUrl).href;
        const replacement = assetCache.get(resolved) || resolved;
        return `url("${replacement}")`;
      } catch {
        return fullMatch;
      }
    }
  );

  return processed;
}

/**
 * Transforms scraped HTML into a completely self-contained, 100% offline-compatible document:
 * 1. Discovers and removes all remote stylesheet links (preventing 404 network requests)
 * 2. Links to local styles.css AND inlines the full CSS bundle inside <style id="offline-bundle-styles">
 * 3. Rewrites URLs in inline <style> tags and element inline style="..." attributes
 * 4. Inlines HTML images as base64 data URIs so images render with ZERO internet connection
 * 5. Handles lazy-loaded images (data-src, data-lazy-src) and removes blocking attributes
 * 6. Strips tracking scripts that throw offline errors
 * 7. Links to local scripts.js
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

  // Remove ALL remote stylesheet links (including preload, alternate, modulepreload styles)
  $('link').each((_, elem) => {
    const rel = ($(elem).attr('rel') || '').toLowerCase();
    const as = ($(elem).attr('as') || '').toLowerCase();
    const type = ($(elem).attr('type') || '').toLowerCase();
    const href = $(elem).attr('href') || $(elem).attr('data-href') || '';

    if (isStylesheetLink(rel, as, type, href)) {
      $(elem).remove();
    }
  });

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

  // Rewrite URLs inside inline <style> blocks so they don't break offline
  $('style').each((_, elem) => {
    const originalCss = $(elem).html() || '';
    if (originalCss) {
      const rewritten = originalCss.replace(
        /url\(\s*(['"]?)([^'"()]+)\1\s*\)/gi,
        (fullMatch, _quote, rawUrl) => {
          const trimmed = (rawUrl || '').trim();
          if (!trimmed || trimmed.startsWith('data:') || trimmed.startsWith('#')) return fullMatch;
          try {
            const resolved = new URL(trimmed, pageUrl).href;
            const replacement = assetCache.get(resolved) || resolved;
            return `url("${replacement}")`;
          } catch {
            return fullMatch;
          }
        }
      );
      $(elem).html(rewritten);
    }
  });

  // Rewrite URLs in element style="..." attributes (e.g. style="background-image: url(...)")
  $('[style*="url("]').each((_, elem) => {
    const styleAttr = $(elem).attr('style') || '';
    const rewritten = styleAttr.replace(
      /url\(\s*(['"]?)([^'"()]+)\1\s*\)/gi,
      (fullMatch, _quote, rawUrl) => {
        const trimmed = (rawUrl || '').trim();
        if (!trimmed || trimmed.startsWith('data:') || trimmed.startsWith('#')) return fullMatch;
        try {
          const resolved = new URL(trimmed, pageUrl).href;
          const replacement = assetCache.get(resolved) || resolved;
          return `url("${replacement}")`;
        } catch {
          return fullMatch;
        }
      }
    );
    $(elem).attr('style', rewritten);
  });

  // Process and convert <img> tags for true offline viewing
  const imgElements = $('img').toArray();
  for (const elem of imgElements) {
    let src = $(elem).attr('src') || '';
    const dataSrc =
      $(elem).attr('data-src') ||
      $(elem).attr('data-lazy-src') ||
      $(elem).attr('data-original') ||
      $(elem).attr('data-src-retina');

    // If src is a placeholder (1px gif or empty data-uri), prefer dataSrc
    if ((!src || src.startsWith('data:image/svg') || src.startsWith('data:image/gif')) && dataSrc) {
      src = dataSrc;
      $(elem).attr('src', dataSrc);
    }

    if (src && !src.startsWith('data:')) {
      try {
        const resolvedImgUrl = new URL(src, pageUrl).href;
        let dataUri = assetCache.get(resolvedImgUrl);

        // Fetch image if within subrequest budget
        if (!dataUri && tracker.canFetch()) {
          const binary = await fetchBinary(resolvedImgUrl, 5000, tracker);
          if (binary && binary.buffer.byteLength <= 1.5 * 1024 * 1024) {
            const b64 = binary.buffer.toString('base64');
            dataUri = `data:${binary.mimeType};base64,${b64}`;
            assetCache.set(resolvedImgUrl, dataUri);
          }
        }

        if (dataUri) {
          $(elem).attr('src', dataUri);
          $(elem).removeAttr('srcset');
        } else {
          // Fallback to absolute URL so it never breaks with a relative 404
          $(elem).attr('src', resolvedImgUrl);
        }

        // Clean up lazy-load markers that block offline rendering
        $(elem).removeAttr('data-src');
        $(elem).removeAttr('data-lazy-src');
        $(elem).removeAttr('data-original');
        $(elem).attr('loading', 'eager');
        $(elem).attr('decoding', 'async');
        $(elem).attr('referrerpolicy', 'no-referrer');
      } catch {}
    }
  }

  // Also process <source> tags inside <picture>
  $('picture source').each((_, elem) => {
    const srcset = $(elem).attr('srcset') || $(elem).attr('data-srcset');
    if (srcset && !srcset.startsWith('data:')) {
      try {
        const firstUrl = srcset.trim().split(/\s+/)[0];
        const resolved = new URL(firstUrl, pageUrl).href;
        const cached = assetCache.get(resolved) || resolved;
        $(elem).attr('srcset', cached);
      } catch {}
    }
  });

  // Convert <link rel="icon"> and <link rel="apple-touch-icon">
  $('link[rel*="icon"]').each((_, elem) => {
    const href = $(elem).attr('href');
    if (href && !href.startsWith('data:')) {
      try {
        const resolvedFavicon = new URL(href, pageUrl).href;
        const cached = assetCache.get(resolvedFavicon) || resolvedFavicon;
        $(elem).attr('href', cached);
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

  // Ensure UTF-8 charset and responsive viewport are in <head>
  if ($('meta[charset]').length === 0) {
    $('head').prepend('<meta charset="UTF-8">\n');
  }
  if ($('meta[name="viewport"]').length === 0) {
    $('head').append('<meta name="viewport" content="width=device-width, initial-scale=1.0">\n');
  }

  // 1. Link to local styles.css
  $('head').append('  <link rel="stylesheet" href="styles.css">\n');

  // 2. Also inject full CSS directly inside <style id="offline-bundle-styles">
  // Safely escape </style> so it cannot break HTML document parsing
  const safeCss = combinedCss.replace(/<\/style>/gi, '<\\/style>');
  $('head').append(
    `  <style id="offline-bundle-styles">\n/* =========================================================\n   100% OFFLINE BUNDLE - ZERO INTERNET CONNECTION REQUIRED\n   All external stylesheets, webfonts, and assets inlined.\n========================================================= */\n${safeCss}\n  </style>\n`
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
  let normalizedInput = startUrlInput.trim();
  if (!/^https?:\/\//i.test(normalizedInput)) {
    normalizedInput = 'https://' + normalizedInput;
  }

  try {
    parsedStartUrl = new URL(normalizedInput);
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

  // Structured record of styles discovered in document order
  interface DiscoveredStyle {
    type: 'external' | 'inline';
    url?: string;
    content?: string;
    media?: string;
    source: string;
  }

  const discoveredStyles: DiscoveredStyle[] = [];
  const discoveredScriptUrls = new Set<string>();
  const discoveredInlineScripts: { source: string; content: string }[] = [];

  const assetCache = new Map<string, string>(); // url -> dataUri
  let siteTitle = '';

  // Adaptive subrequest budgeting: Node.js (full capacity up to 160) vs Workers (safe budget up to 42)
  const tracker = new SubrequestTracker();

  const maxPagesToCrawl = mode === 'single' ? 1 : Math.min(Math.max(1, maxPages), 20);

  while (toVisitQueue.length > 0 && visitedUrls.size < maxPagesToCrawl) {
    if (!tracker.canFetch()) break;
    const currentUrl = toVisitQueue.shift()!;
    const normalizedUrl = currentUrl.split('#')[0];

    if (visitedUrls.has(normalizedUrl)) continue;
    visitedUrls.add(normalizedUrl);

    try {
      let response: { ok: boolean; status: number; text: string; contentType: string; finalUrl: string };
      try {
        response = await fetchWithTimeout(currentUrl, 10000, tracker);
      } catch (firstErr: any) {
        // If HTTPS fails and was auto-prepended, try HTTP fallback
        if (currentUrl.startsWith('https://') && !startUrlInput.startsWith('https://')) {
          const httpUrl = currentUrl.replace(/^https:\/\//i, 'http://');
          response = await fetchWithTimeout(httpUrl, 10000, tracker);
        } else {
          throw firstErr;
        }
      }

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

      // 2. Discover all headings (H1 to H6)
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

      // 3. Discover ALL stylesheets in document order (both external link and inline style tags)
      $('link, style').each((idx, elem) => {
        const tagName = (((elem as any).tagName || (elem as any).name || '') as string).toLowerCase();
        if (tagName === 'link') {
          const rel = ($(elem).attr('rel') || '').toLowerCase();
          const as = ($(elem).attr('as') || '').toLowerCase();
          const type = ($(elem).attr('type') || '').toLowerCase();
          const href = $(elem).attr('href') || $(elem).attr('data-href');
          const media = $(elem).attr('media')?.trim();

          if (href && isStylesheetLink(rel, as, type, href)) {
            try {
              const fullCssUrl = new URL(href, currentUrl).href;
              // Avoid duplicate external stylesheets
              if (!discoveredStyles.some((s) => s.url === fullCssUrl)) {
                discoveredStyles.push({
                  type: 'external',
                  url: fullCssUrl,
                  media,
                  source: `${fileName} (<link href="${href}">)`,
                });
              }
            } catch {}
          }
        } else if (tagName === 'style') {
          const styleText = $(elem).html()?.trim();
          const media = $(elem).attr('media')?.trim();
          if (styleText) {
            discoveredStyles.push({
              type: 'inline',
              content: styleText,
              media,
              source: `${fileName} (<style #${idx + 1}>)`,
            });
          }
        }
      });

      // 4. Discover all external scripts
      $('script[src]').each((_, elem) => {
        const src = $(elem).attr('src') || $(elem).attr('data-src');
        if (src) {
          const isTracker = TRACKER_DOMAINS.some((t) => src.includes(t));
          if (!isTracker) {
            try {
              discoveredScriptUrls.add(new URL(src, currentUrl).href);
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
              discoveredInlineScripts.push({
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
    `@charset "UTF-8";\n/* ========================================================================\n   OFFLINE-READY STYLESHEET (100% SELF-CONTAINED)\n   Generated for: ${startUrlInput}\n   Extracted on: ${new Date().toUTCString()}\n   Zero Internet Dependencies: All @imports inlined, fonts/icons embedded as Base64 Data URIs.\n======================================================================== */\n`,
  ];

  const visitedCssUrls = new Set<string>();

  // Process all discovered stylesheets in their natural cascade order
  for (const item of discoveredStyles) {
    if (item.type === 'external' && item.url) {
      if (visitedCssUrls.has(item.url)) continue;
      visitedCssUrls.add(item.url);

      if (!tracker.canFetch()) {
        cssSections.push(`/* Note: Skipped external stylesheet ${item.url} due to budget limits */\n`);
        continue;
      }

      try {
        const cssRes = await fetchWithTimeout(item.url, 8000, tracker, 'text/css,*/*;q=0.1');
        if (cssRes.ok && cssRes.text) {
          let processedCss = await processCssContent(
            cssRes.text,
            item.url,
            visitedCssUrls,
            assetCache,
            tracker,
            0
          );

          // Wrap in @media block if media query specified (e.g. print or screen size)
          if (item.media && item.media !== 'all' && item.media !== 'screen') {
            processedCss = `@media ${item.media} {\n${processedCss}\n}`;
          }

          cssSections.push(
            `/* ------------------------------------------------------------------------\n   Styles from External Stylesheet: ${item.url}\n------------------------------------------------------------------------ */\n${processedCss}\n`
          );
        }
      } catch {
        cssSections.push(`/* Note: Could not fetch stylesheet ${item.url} */\n`);
      }
    } else if (item.type === 'inline' && item.content) {
      try {
        let processedInline = await processCssContent(
          item.content,
          parsedStartUrl.href,
          visitedCssUrls,
          assetCache,
          tracker,
          0
        );

        if (item.media && item.media !== 'all' && item.media !== 'screen') {
          processedInline = `@media ${item.media} {\n${processedInline}\n}`;
        }

        cssSections.push(
          `/* ------------------------------------------------------------------------\n   Inline Style from: ${item.source}\n------------------------------------------------------------------------ */\n${processedInline}\n`
        );
      } catch {
        cssSections.push(`/* Note: Failed to process inline style from ${item.source} */\n`);
      }
    }
  }

  const combinedCss = cssSections.join('\n\n');

  // ==========================================================
  // JAVASCRIPT BUNDLE FOR OFFLINE INTERACTIVITY
  // ==========================================================
  const jsSections: string[] = [
    `// ========================================================================\n// OFFLINE JAVASCRIPT BUNDLE\n// Extracted from ${startUrlInput}\n// ========================================================================\n`,
  ];

  // Fetch external scripts (prioritized to key UI libraries)
  for (const jsUrl of Array.from(discoveredScriptUrls).slice(0, 10)) {
    if (!tracker.canFetch()) break;
    try {
      const jsRes = await fetchWithTimeout(jsUrl, 6000, tracker, '*/*');
      if (jsRes.ok && jsRes.text && jsRes.text.length < 800000) {
        jsSections.push(
          `// --- Script from ${jsUrl} ---\n(function(){\ntry {\n${jsRes.text}\n} catch(e){ console.warn("Error in script ${jsUrl}:", e); }\n})();\n`
        );
      }
    } catch {}
  }

  // Include extracted inline scripts
  for (const inlineScript of discoveredInlineScripts) {
    jsSections.push(
      `// --- ${inlineScript.source} ---\n(function(){\ntry {\n${inlineScript.content}\n} catch(e){ console.warn("Error in inline script ${inlineScript.source}:", e); }\n})();\n`
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
    description: `Complete offline stylesheet (${discoveredStyles.length} styles merged with embedded fonts/assets)`,
  });

  // Add scripts.js
  files.push({
    id: 'file-js-main',
    name: 'scripts.js',
    type: 'javascript',
    content: combinedJs,
    size: Buffer.byteLength(combinedJs, 'utf-8'),
    description: `Extracted JavaScript bundle (${discoveredScriptUrls.size} external scripts + ${discoveredInlineScripts.length} inline scripts)`,
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
      stylesDiscovered: discoveredStyles.length,
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
