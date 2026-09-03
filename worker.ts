// Safe worker.ts structure for Cloudflare Workers & Pages
export interface Fetcher {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

export interface ExecutionContext {
  waitUntil(promise: Promise<any>): void;
  passThroughOnException(): void;
}

export interface Env {
  ASSETS?: Fetcher;
  DB?: any;
  ENVIRONMENT?: string;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      });
    }

    // 1. Handle API routes
    if (url.pathname.startsWith('/api/')) {
      // System health-check endpoint
      if (url.pathname === '/api/health') {
        return new Response(
          JSON.stringify({
            status: 'ok',
            app: 'webscrape-studio',
            db_connected: !!env.DB,
            timestamp: new Date().toISOString(),
          }),
          {
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
          }
        );
      }

      // 404 for undefined API endpoints
      return new Response(
        JSON.stringify({
          error: 'Endpoint not found',
          path: url.pathname,
        }),
        {
          status: 404,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    // 2. Serve the frontend and static assets from dist through ASSETS
    if (env.ASSETS) {
      return await env.ASSETS.fetch(request);
    }

    return new Response('Assets binding not available', { status: 500 });
  },
};
