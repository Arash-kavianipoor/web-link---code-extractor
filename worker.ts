import { scrapeWebPage } from './server/scraper.js';
import { generateRobotsTxt, generateSitemapXml } from './server/seoServer.js';
import { SEO_LANGUAGES } from './src/seo/seoConfig.js';

export interface Fetcher { fetch(request: Request | string): Promise<Response>; }
export interface ExecutionContext { waitUntil(promise: Promise<unknown>): void; passThroughOnException(): void; }
export interface Env { ASSETS: Fetcher; DB?: unknown; ENVIRONMENT?: string; }

const CORS_HEADERS: Record<string,string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS_HEADERS },
  });
}

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });

    if (url.pathname.startsWith('/api/')) {
      if (url.pathname === '/api/health') {
        return jsonResponse({ status: 'ok', db_connected: !!env.DB, runtime: 'cloudflare-workers', timestamp: new Date().toISOString() });
      }

      if (url.pathname === '/api/seo-status') {
        const languages = Object.keys(SEO_LANGUAGES);
        return jsonResponse({ status:'healthy', totalLanguages:languages.length, supportedLanguages:languages, sitemapUrl:`${url.origin}/sitemap.xml`, robotsUrl:`${url.origin}/robots.txt`, hreflangCompliant:true });
      }

      if (url.pathname === '/api/scrape') {
        if (request.method !== 'POST') return jsonResponse({ error:'Method not allowed' },405);
        const requestId = crypto.randomUUID();
        const started = Date.now();
        try {
          const body = await request.json() as { url?: unknown; mode?: unknown; maxPages?: unknown };
          if (typeof body.url !== 'string' || !body.url.trim()) return jsonResponse({ error:'URL parameter is required and must be a valid string.', requestId },400);
          const mode = body.mode === 'all' ? 'all' : 'single';
          const maxPages = typeof body.maxPages === 'number' ? Math.min(Math.max(1, Math.floor(body.maxPages)),3) : 1;
          const result = await scrapeWebPage(body.url, mode, maxPages, { runtime:'cloudflare' });
          return jsonResponse({ ...result, runtime:'cloudflare-workers', requestId });
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : String(error);
          console.error(JSON.stringify({ requestId, route:'/api/scrape', elapsedMs:Date.now()-started, error:message }));
          return jsonResponse({ error: message || 'Scraping failed.', requestId, runtime:'cloudflare-workers', elapsedMs:Date.now()-started },500);
        }
      }

      return jsonResponse({ error:'Endpoint not found' },404);
    }

    if (url.pathname === '/robots.txt') return new Response(generateRobotsTxt(url.origin), { headers:{ 'Content-Type':'text/plain; charset=utf-8', 'Cache-Control':'public, max-age=86400' } });
    if (url.pathname === '/sitemap.xml') return new Response(generateSitemapXml(url.origin), { headers:{ 'Content-Type':'application/xml; charset=utf-8', 'Cache-Control':'public, max-age=86400' } });
    if (env.ASSETS) return env.ASSETS.fetch(request);
    return new Response('Assets binding not available',{status:500});
  },
};
