export type DeviceType = 'desktop' | 'tablet' | 'mobile';

export type ViewportOrientation = 'portrait' | 'landscape';

export interface DeviceConfig {
  id: DeviceType;
  name: string;
  width: number;
  height: number;
  scale: number;
  orientation: ViewportOrientation;
  userAgent: string;
  devicePixelRatio: number;
  frameColor: string;
}

export interface HeadingItem {
  id: string;
  level: number; // 1 to 6
  tag: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
  text: string;
  parentTag?: string;
  elementId?: string;
  classes?: string;
  charCount: number;
  wordCount: number;
  index: number;
}

export interface ExtractedAsset {
  id: string;
  type: 'html' | 'css' | 'js' | 'image' | 'font';
  filename: string;
  content: string;
  url?: string;
  sizeBytes: number;
  source: 'inline' | 'external' | 'generated';
  status?: 'success' | 'failed' | 'cors_blocked';
}

export interface SiteMetadata {
  title: string;
  description: string;
  charset: string;
  viewport: string;
  canonicalUrl?: string;
  favicon?: string;
  author?: string;
  keywords?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  ogType?: string;
  twitterCard?: string;
  themeColor?: string;
  generator?: string;
  language?: string;
  linksCount: number;
  imagesCount: number;
  scriptsCount: number;
  stylesCount: number;
}

export interface ExtractedBundle {
  targetUrl: string;
  scrapedAt: string;
  engineUsed: 'Playwright Browser' | 'ChromeDriver' | 'Client DOM Engine' | 'Sandboxed Browser Frame';
  metadata: SiteMetadata;
  headings: HeadingItem[];
  headingCounts: {
    h1: number;
    h2: number;
    h3: number;
    h4: number;
    h5: number;
    h6: number;
    total: number;
  };
  htmlFiles: ExtractedAsset[];
  cssFiles: ExtractedAsset[];
  jsFiles: ExtractedAsset[];
  rawHtml: string;
  sanitizedHtml: string;
  stats: {
    totalAssets: number;
    totalSizeBytes: number;
    htmlSizeBytes: number;
    cssSizeBytes: number;
    jsSizeBytes: number;
    scrapeDurationMs: number;
    networkRequestsCount: number;
    domNodesCount: number;
  };
  seoScore: {
    score: number;
    grade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';
    checks: {
      hasH1: boolean;
      singleH1: boolean;
      hierarchyValid: boolean;
      hasTitle: boolean;
      hasMetaDescription: boolean;
      hasCanonical: boolean;
      hasOpenGraph: boolean;
      hasViewport: boolean;
    };
    warnings: string[];
  };
}

export type ScrapeStatus = 'idle' | 'fetching' | 'rendering' | 'extracting' | 'packaging' | 'success' | 'error';

export type LanguageCode =
  | 'fa' // Persian
  | 'en' // English
  | 'es' // Spanish
  | 'fr' // French
  | 'de' // German
  | 'zh' // Chinese
  | 'ar' // Arabic
  | 'ru' // Russian
  | 'ja' // Japanese
  | 'pt' // Portuguese
  | 'hi' // Hindi
  | 'it' // Italian
  | 'tr' // Turkish
  | 'ko' // Korean
  | 'nl' // Dutch
  | 'pl' // Polish
  | 'id' // Indonesian
  | 'vi' // Vietnamese
  | 'sv' // Swedish
  | 'uk'; // Ukrainian

export interface LanguageInfo {
  code: LanguageCode;
  name: string;
  nativeName: string;
  dir: 'rtl' | 'ltr';
  flag: string;
}

export interface EngineLog {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
  stage?: 'browser_init' | 'network' | 'dom_parse' | 'css_extract' | 'js_extract' | 'heading_analysis';
}
