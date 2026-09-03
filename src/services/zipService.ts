import JSZip from 'jszip';
import { ExtractedBundle } from '../types';

/**
 * Triggers a browser download of a Blob file
 */
export function triggerFileDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 200);
}

/**
 * Generates and downloads the HTML ZIP bundle
 */
export async function downloadHtmlZipBundle(bundle: ExtractedBundle): Promise<void> {
  const zip = new JSZip();
  const folder = zip.folder('html-bundle') || zip;

  // Main clean rendered HTML
  folder.file('index.html', bundle.sanitizedHtml || bundle.rawHtml);

  // Raw fetched HTML
  folder.file('raw_source.html', bundle.rawHtml);

  // Site Metadata JSON
  folder.file('metadata.json', JSON.stringify(bundle.metadata, null, 2));

  // Headings hierarchy JSON & Markdown outline
  folder.file('headings_h1_h6.json', JSON.stringify(bundle.headings, null, 2));
  
  const markdownOutline = bundle.headings
    .map((h) => `${'  '.repeat(h.level - 1)}- **${h.tag.toUpperCase()}**: ${h.text}`)
    .join('\n');
  folder.file('headings_outline.md', `# Headings Outline for ${bundle.targetUrl}\n\n${markdownOutline}`);

  // Individual HTML sub-assets if any
  bundle.htmlFiles.forEach((file, index) => {
    if (file.filename !== 'index.html') {
      folder.file(file.filename || `page_part_${index + 1}.html`, file.content);
    }
  });

  // Manifest info
  folder.file(
    'HTML_MANIFEST.txt',
    `Extracted from: ${bundle.targetUrl}\nScraped at: ${bundle.scrapedAt}\nEngine: ${bundle.engineUsed}\nTotal Headings: ${bundle.headingCounts.total}\n`
  );

  const content = await zip.generateAsync({ type: 'blob' });
  const domainName = getCleanDomain(bundle.targetUrl);
  triggerFileDownload(content, `${domainName}-html-bundle.zip`);
}

/**
 * Generates and downloads the CSS ZIP bundle
 */
export async function downloadCssZipBundle(bundle: ExtractedBundle): Promise<void> {
  const zip = new JSZip();
  const folder = zip.folder('css-bundle') || zip;

  // Master combined stylesheet
  const allCss = bundle.cssFiles.map((c) => `/* File: ${c.filename} */\n${c.content}\n`).join('\n\n');
  folder.file('styles.bundle.css', allCss || '/* No CSS styles extracted */');

  // Individual stylesheets
  bundle.cssFiles.forEach((file, idx) => {
    const filename = file.filename || `style_${idx + 1}.css`;
    folder.file(filename, file.content);
  });

  // Manifest
  folder.file(
    'CSS_MANIFEST.json',
    JSON.stringify(
      {
        targetUrl: bundle.targetUrl,
        scrapedAt: bundle.scrapedAt,
        totalStylesheets: bundle.cssFiles.length,
        totalBytes: bundle.stats.cssSizeBytes,
        files: bundle.cssFiles.map((f) => ({
          filename: f.filename,
          source: f.source,
          url: f.url,
          size: f.sizeBytes,
        })),
      },
      null,
      2
    )
  );

  const content = await zip.generateAsync({ type: 'blob' });
  const domainName = getCleanDomain(bundle.targetUrl);
  triggerFileDownload(content, `${domainName}-css-bundle.zip`);
}

/**
 * Generates and downloads the JavaScript ZIP bundle
 */
export async function downloadJsZipBundle(bundle: ExtractedBundle): Promise<void> {
  const zip = new JSZip();
  const folder = zip.folder('js-bundle') || zip;

  // Master combined scripts
  const allJs = bundle.jsFiles.map((j) => `// File: ${j.filename}\n${j.content}\n`).join('\n\n');
  folder.file('bundle.scripts.js', allJs || '// No scripts extracted');

  // Individual JS files
  bundle.jsFiles.forEach((file, idx) => {
    const filename = file.filename || `script_${idx + 1}.js`;
    folder.file(filename, file.content);
  });

  // Scripts Manifest
  folder.file(
    'JS_MANIFEST.json',
    JSON.stringify(
      {
        targetUrl: bundle.targetUrl,
        scrapedAt: bundle.scrapedAt,
        totalScripts: bundle.jsFiles.length,
        totalBytes: bundle.stats.jsSizeBytes,
        files: bundle.jsFiles.map((f) => ({
          filename: f.filename,
          source: f.source,
          url: f.url,
          size: f.sizeBytes,
        })),
      },
      null,
      2
    )
  );

  const content = await zip.generateAsync({ type: 'blob' });
  const domainName = getCleanDomain(bundle.targetUrl);
  triggerFileDownload(content, `${domainName}-javascript-bundle.zip`);
}

/**
 * Generates and downloads the Complete Master ZIP (containing all 3 bundles: HTML, CSS, JS)
 */
export async function downloadMasterPackageZip(bundle: ExtractedBundle): Promise<void> {
  const zip = new JSZip();

  // HTML Subfolder
  const htmlFolder = zip.folder('01-HTML');
  if (htmlFolder) {
    htmlFolder.file('index.html', bundle.sanitizedHtml || bundle.rawHtml);
    htmlFolder.file('raw_source.html', bundle.rawHtml);
    htmlFolder.file('headings_h1_h6.json', JSON.stringify(bundle.headings, null, 2));
    htmlFolder.file('metadata.json', JSON.stringify(bundle.metadata, null, 2));
  }

  // CSS Subfolder
  const cssFolder = zip.folder('02-CSS');
  if (cssFolder) {
    const allCss = bundle.cssFiles.map((c) => `/* ${c.filename} */\n${c.content}`).join('\n\n');
    cssFolder.file('styles.bundle.css', allCss);
    bundle.cssFiles.forEach((file, idx) => {
      cssFolder.file(file.filename || `style_${idx + 1}.css`, file.content);
    });
  }

  // JS Subfolder
  const jsFolder = zip.folder('03-JS');
  if (jsFolder) {
    const allJs = bundle.jsFiles.map((j) => `// ${j.filename}\n${j.content}`).join('\n\n');
    jsFolder.file('bundle.scripts.js', allJs);
    bundle.jsFiles.forEach((file, idx) => {
      jsFolder.file(file.filename || `script_${idx + 1}.js`, file.content);
    });
  }

  // Master Readme & SEO report
  zip.file(
    'README.md',
    `# Complete Extracted Web Package
- **Target URL**: ${bundle.targetUrl}
- **Extracted At**: ${bundle.scrapedAt}
- **Engine**: ${bundle.engineUsed}
- **Total Assets Extracted**: ${bundle.stats.totalAssets}
- **Total Data Size**: ${(bundle.stats.totalSizeBytes / 1024).toFixed(2)} KB

## Headings Summary
- H1: ${bundle.headingCounts.h1}
- H2: ${bundle.headingCounts.h2}
- H3: ${bundle.headingCounts.h3}
- H4: ${bundle.headingCounts.h4}
- H5: ${bundle.headingCounts.h5}
- H6: ${bundle.headingCounts.h6}
- Total: ${bundle.headingCounts.total}

Generated with WebScrape Studio (Client-side Browser Engine).
`
  );

  zip.file(
    'seo_heading_audit.json',
    JSON.stringify(
      {
        url: bundle.targetUrl,
        score: bundle.seoScore,
        counts: bundle.headingCounts,
        metadata: bundle.metadata,
      },
      null,
      2
    )
  );

  const content = await zip.generateAsync({ type: 'blob' });
  const domainName = getCleanDomain(bundle.targetUrl);
  triggerFileDownload(content, `${domainName}-full-triple-package.zip`);
}

function getCleanDomain(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/[^a-z0-9]/gi, '-').toLowerCase();
  } catch {
    return 'scraped-site';
  }
}
