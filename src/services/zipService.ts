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
 * Generates and downloads the HTML ZIP bundle (100% Offline Runnable)
 */
export async function downloadHtmlZipBundle(bundle: ExtractedBundle): Promise<void> {
  const zip = new JSZip();

  // Root self-contained offline executable HTML
  const offlineHtml = bundle.sanitizedHtml || bundle.rawHtml;
  zip.file('index.html', offlineHtml);

  // Raw fetched HTML
  zip.file('raw_source.html', bundle.rawHtml);

  // Site Metadata JSON
  zip.file('metadata.json', JSON.stringify(bundle.metadata, null, 2));

  // Headings hierarchy JSON & Markdown outline
  zip.file('headings_h1_h6.json', JSON.stringify(bundle.headings, null, 2));
  
  const markdownOutline = bundle.headings
    .map((h) => `${'  '.repeat(h.level - 1)}- **${h.tag.toUpperCase()}**: ${h.text}`)
    .join('\n');
  zip.file('headings_outline.md', `# Headings Outline for ${bundle.targetUrl}\n\n${markdownOutline}`);

  // Individual HTML sub-assets if any
  bundle.htmlFiles.forEach((file, index) => {
    if (file.filename !== 'index.html' && file.filename !== 'raw_source.html') {
      zip.file(file.filename || `page_part_${index + 1}.html`, file.content);
    }
  });

  // Offline Instruction & Manifest
  zip.file(
    'README_OFFLINE.txt',
    `═════════════════════════════════════════════════════════════════════
راهنمای اجرای آفلاین (Offline Execution Guide)
═════════════════════════════════════════════════════════════════════
برای اجرای آفلاین سایت بدون نیاز به اتصال اینترنت:
1. فایل زیپ را استخراج (Extract) کنید.
2. بر روی فایل index.html دابل‌کلیک کنید تا در هر مرورگری اجرا شود.
3. تمامی استایل‌های CSS و ساختار صفحات به صورت کامل درون فایل گنجانده شده‌اند.

Site: ${bundle.targetUrl}
Date: ${bundle.scrapedAt}
Engine: ${bundle.engineUsed}
Headings Total: ${bundle.headingCounts.total}
═════════════════════════════════════════════════════════════════════
`
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

  // Master combined stylesheet
  const allCss = bundle.cssFiles.map((c) => `/* File: ${c.filename} */\n${c.content}\n`).join('\n\n');
  zip.file('styles.bundle.css', allCss || '/* No CSS styles extracted */');

  // Individual stylesheets
  const cssFolder = zip.folder('stylesheets') || zip;
  bundle.cssFiles.forEach((file, idx) => {
    const filename = file.filename || `style_${idx + 1}.css`;
    cssFolder.file(filename, file.content);
  });

  // Offline CSS preview test page
  zip.file(
    'preview_styles.html',
    `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CSS Styles Preview - ${bundle.metadata.title}</title>
  <link rel="stylesheet" href="styles.bundle.css">
  <style>
    .demo-container { max-width: 800px; margin: 2rem auto; padding: 1.5rem; font-family: system-ui; }
  </style>
</head>
<body>
  <div class="demo-container">
    <h1>CSS Styles Bundle Preview</h1>
    <p>This page demonstrates styles linked from <code>styles.bundle.css</code>.</p>
  </div>
</body>
</html>`
  );

  // Manifest
  zip.file(
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

  // Master combined scripts
  const allJs = bundle.jsFiles.map((j) => `// File: ${j.filename}\n${j.content}\n`).join('\n\n');
  zip.file('bundle.scripts.js', allJs || '// No scripts extracted');

  // Individual JS files
  const jsFolder = zip.folder('scripts') || zip;
  bundle.jsFiles.forEach((file, idx) => {
    const filename = file.filename || `script_${idx + 1}.js`;
    jsFolder.file(filename, file.content);
  });

  // Scripts Manifest
  zip.file(
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
 * Generates and downloads the Complete Master ZIP (containing 100% Offline Executable index.html + all 3 bundles)
 */
export async function downloadMasterPackageZip(bundle: ExtractedBundle): Promise<void> {
  const zip = new JSZip();

  // 1. ROOT DIRECTORY: 100% Offline Executable index.html
  // Double-clicking this file in any browser runs the real website offline without internet!
  const offlineHtml = bundle.sanitizedHtml || bundle.rawHtml;
  zip.file('index.html', offlineHtml);
  zip.file('offline_standalone.html', offlineHtml);

  // 2. HTML Subfolder
  const htmlFolder = zip.folder('01-HTML');
  if (htmlFolder) {
    htmlFolder.file('index.html', offlineHtml);
    htmlFolder.file('raw_source.html', bundle.rawHtml);
    htmlFolder.file('headings_h1_h6.json', JSON.stringify(bundle.headings, null, 2));
    htmlFolder.file('metadata.json', JSON.stringify(bundle.metadata, null, 2));
  }

  // 3. CSS Subfolder
  const cssFolder = zip.folder('02-CSS');
  if (cssFolder) {
    const allCss = bundle.cssFiles.map((c) => `/* ${c.filename} */\n${c.content}`).join('\n\n');
    cssFolder.file('styles.bundle.css', allCss);
    bundle.cssFiles.forEach((file, idx) => {
      cssFolder.file(file.filename || `style_${idx + 1}.css`, file.content);
    });
  }

  // 4. JS Subfolder
  const jsFolder = zip.folder('03-JS');
  if (jsFolder) {
    const allJs = bundle.jsFiles.map((j) => `// ${j.filename}\n${j.content}`).join('\n\n');
    jsFolder.file('bundle.scripts.js', allJs);
    bundle.jsFiles.forEach((file, idx) => {
      jsFolder.file(file.filename || `script_${idx + 1}.js`, file.content);
    });
  }

  // 5. Master Readme & Offline Execution Guide
  zip.file(
    'README.md',
    `# بسته کامل استخراج وب و اجرای آفلاین (Offline Web Package)
- **Target URL**: ${bundle.targetUrl}
- **Extracted At**: ${bundle.scrapedAt}
- **Engine**: ${bundle.engineUsed}
- **Total Assets**: ${bundle.stats.totalAssets}
- **Data Size**: ${(bundle.stats.totalSizeBytes / 1024).toFixed(2)} KB

---

## 🚀 راهنمای اجرای آفلاین بدون اینترنت (Offline Run Guide):
این بسته به گونه‌ای مهندسی شده است که **کاملاً بدون نیاز به اینترنت و بدون نیاز به سرور محلی** قابل اجرا باشد:
1. فایل زیپ را از حالت فشرده خارج (Extract) کنید.
2. بر روی فایل **\`index.html\`** یا **\`offline_standalone.html\`** در پوشه اصلی دابل‌کلیک کنید.
3. سایت در مرورگر شما (Google Chrome, Firefox, Safari, Edge) به صورت کامل همراه با تمام استایل‌ها، فونت‌ها و ساختار DOM اجرا می‌شود.

---

## 📁 ساختار فایل‌های استخراج‌شده:
- \`index.html\`: فایل اجرایی اصلی به صورت خودکفا (Self-Contained) با استایل‌های اینلاین
- \`01-HTML/\`: سورس خام و بهینه‌سازی‌شده HTML و متادیتاها
- \`02-CSS/\`: فایل جامع \`styles.bundle.css\` و تمامی شیت‌های تفکیک‌شده
- \`03-JS/\`: فایل جامع \`bundle.scripts.js\` و اسکریپت‌های تفکیک‌شده
- \`seo_heading_audit.json\`: گزارش کامل تگ‌های هدینگ H1 تا H6 و سئو

---

### Headings Count:
- H1: ${bundle.headingCounts.h1}
- H2: ${bundle.headingCounts.h2}
- H3: ${bundle.headingCounts.h3}
- H4: ${bundle.headingCounts.h4}
- H5: ${bundle.headingCounts.h5}
- H6: ${bundle.headingCounts.h6}
- Total: ${bundle.headingCounts.total}
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
  triggerFileDownload(content, `${domainName}-full-offline-package.zip`);
}

function getCleanDomain(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/[^a-z0-9]/gi, '-').toLowerCase();
  } catch {
    return 'scraped-site';
  }
}

