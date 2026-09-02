import JSZip from 'jszip';
import { ExtractedFile, ScrapedLink, ScrapedHeading, HeadingLevel, CrawlMode } from '../types.js';

export function formatBytes(bytes: number, decimals = 2): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export function downloadFile(filename: string, content: string, mimeType = 'text/plain') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function downloadZip(
  files: ExtractedFile[],
  zipName = 'offline_website_package.zip',
  mode: CrawlMode = 'single'
) {
  const zip = new JSZip();

  if (mode === 'single') {
    // Single page mode: strictly NO folders at all, all files at the root of the ZIP
    for (const file of files) {
      const cleanName = file.name.replace(/^.*[\\/]/, '');
      zip.file(cleanName, file.content);
    }
  } else {
    // Multi-page crawl mode ('all'): Maintain dedicated folder structure for each page
    const stylesFile = files.find((f) => f.name === 'styles.css');
    const scriptsFile = files.find((f) => f.name === 'scripts.js');
    const htmlPages = files.filter((f) => f.type === 'html' && f.name !== 'links_report.html');

    // 1. Root files: index.html, styles.css, scripts.js for instant multi-page preview & execution
    for (const file of files) {
      const cleanName = file.name.replace(/^.*[\\/]/, '');
      zip.file(cleanName, file.content);
    }

    // 2. Dedicated folder for EACH scanned page: pages/01_home/, pages/02_about/, etc.
    htmlPages.forEach((file, index) => {
      const pageIndex = (index + 1).toString().padStart(2, '0');
      let baseSlug = file.name.replace(/\.html$/i, '').replace(/^.*[\\/]/, '');
      if (baseSlug === 'index' || index === 0) {
        baseSlug = 'home';
      }
      const pageFolderName = `pages/${pageIndex}_${baseSlug}`;

      // Place the page's HTML inside its dedicated folder
      zip.file(`${pageFolderName}/index.html`, file.content);

      // Include styles and scripts in each page folder so that each page is 100% self-contained
      if (stylesFile) {
        zip.file(`${pageFolderName}/styles.css`, stylesFile.content);
      }
      if (scriptsFile) {
        zip.file(`${pageFolderName}/scripts.js`, scriptsFile.content);
      }
    });

    // 3. Dedicated reports folder
    const reports = files.filter(
      (f) => f.name === 'links_report.html' || f.name.endsWith('.json')
    );
    for (const report of reports) {
      const cleanName = report.name.replace(/^.*[\\/]/, '');
      zip.file(`reports/${cleanName}`, report.content);
    }
  }

  // Maximum ZIP compression (DEFLATE level 9)
  const blob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: {
      level: 9,
    },
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = zipName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportLinksToCsv(links: ScrapedLink[], filename = 'links.csv') {
  const headers = ['Index', 'Text', 'URL', 'Type', 'Source URL'];
  const rows = links.map((l, i) => [
    i + 1,
    `"${(l.text || '').replace(/"/g, '""')}"`,
    `"${(l.url || '').replace(/"/g, '""')}"`,
    l.type,
    `"${(l.sourceUrl || '').replace(/"/g, '""')}"`,
  ]);

  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  downloadFile(filename, csvContent, 'text/csv;charset=utf-8;');
}

export function exportHeadingsToCsv(headings: ScrapedHeading[], filename = 'headings.csv') {
  const headers = ['Index', 'Level', 'Heading Text', 'Source URL'];
  const rows = headings.map((h, i) => [
    i + 1,
    h.level.toUpperCase(),
    `"${(h.text || '').replace(/"/g, '""')}"`,
    `"${(h.sourceUrl || '').replace(/"/g, '""')}"`,
  ]);

  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  downloadFile(filename, csvContent, 'text/csv;charset=utf-8;');
}

export interface JsonExportOptions {
  includeLinks: boolean;
  includeHeadings: boolean;
  selectedHeadingLevels?: HeadingLevel[];
}

export function exportCustomJson(
  links: ScrapedLink[],
  headings: ScrapedHeading[],
  options: JsonExportOptions,
  filename = 'extracted_data.json'
) {
  const payload: Record<string, any> = {
    exportedAt: new Date().toISOString(),
  };

  if (options.includeLinks) {
    payload.totalLinks = links.length;
    payload.links = links;
  }

  if (options.includeHeadings) {
    const filteredHeadings =
      options.selectedHeadingLevels && options.selectedHeadingLevels.length > 0
        ? headings.filter((h) => options.selectedHeadingLevels!.includes(h.level))
        : headings;
    payload.totalHeadings = filteredHeadings.length;
    payload.headings = filteredHeadings;
  }

  const jsonStr = JSON.stringify(payload, null, 2);
  downloadFile(filename, jsonStr, 'application/json');
}
