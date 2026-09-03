import * as cheerio from 'cheerio';
import {
  ScrapedLink,
  ScrapedHeading,
  HeadingLevel,
  ExtractedFile,
  ScrapeResult,
  CrawlMode,
  LinkType,
  DeviceType,
  DeviceVersion,
} from '../src/types.js';

// Realistic Device Profiles for 3-way Browser Emulation
export const DEVICE_PROFILES: Record<DeviceType, { name: string; userAgent: string; secChUa: string; secChUaMobile: string; secChUaPlatform: string; viewport: string; previewWidth: number }> = {
  desktop: { name: 'Desktop', userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36', secChUa: '"Not(A:Brand";v="99", "Google Chrome";v="133", "Chromium";v="133"', secChUaMobile: '?0', secChUaPlatform: '"Windows"', viewport: 'width=device-width, initial-scale=1.0', previewWidth: 1280 },
  tablet: { name: 'Tablet', userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1', secChUa: '"Not(A:Brand";v="99", "Apple Safari";v="17", "WebKit";v="605"', secChUaMobile: '?1', secChUaPlatform: '"iOS"', viewport: 'width=768, initial-scale=1.0, maximum-scale=2.0', previewWidth: 768 },
  mobile: { name: 'Mobile', userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Mobile Safari/537.36', secChUa: '"Not(A:Brand";v="99", "Google Chrome";v="133", "Chromium";v="133"', secChUaMobile: '?1', secChUaPlatform: '"Android"', viewport: 'width=390, initial-scale=1.0, maximum-scale=2.0', previewWidth: 390 },
};

const TRACKER_DOMAINS = ['google-analytics.com','googletagmanager.com','connect.facebook.net','facebook.com/tr','clarity.ms','hotjar.com','doubleclick.net','pagead2.googlesyndication.com','yandex.ru','mc.yandex.ru','adsbygoogle','amplitude.com','mixpanel.com','segment.io','sentry.io','datadoghq.com','newrelic.com','static.cloudflareinsights.com'];

type ScraperRuntime = 'node' | 'cloudflare';

export class CookieJar {
  private cookies = new Map<string, string>();
  storeCookies(rawHeader: string | null) {
    if (!rawHeader) return;
    const items = rawHeader.split(/,(?=[^;]+=[^;]+)/g);
    for (const item of items) {
      const firstPart = item.split(';')[0].trim();
      const eqIdx = firstPart.indexOf('=');
      if (eqIdx > 0) {
        const key = firstPart.slice(0, eqIdx).trim();
        const val = firstPart.slice(eqIdx + 1).trim();
        if (key) this.cookies.set(key, val);
      }
    }
  }
  getCookieHeader(): string { return Array.from(this.cookies.entries()).map(([k,v]) => `${k}=${v}`).join('; '); }
}

function getBrowserHeaders(resourceType: 'document'|'image'|'style'|'font'|'script'|'other', refererUrl?: string, cookieHeader?: string, targetOrigin?: string, device: DeviceType = 'desktop'): Record<string,string> {
  const profile = DEVICE_PROFILES[device] || DEVICE_PROFILES.desktop;
  const isSameOrigin = !!(refererUrl && targetOrigin && refererUrl.startsWith(targetOrigin));
  const headers: Record<string,string> = {
    'User-Agent': profile.userAgent,
    'Accept-Language': 'en-US,en;q=0.9,fa;q=0.8',
    'Sec-Ch-Ua': profile.secChUa,
    'Sec-Ch-Ua-Mobile': profile.secChUaMobile,
    'Sec-Ch-Ua-Platform': profile.secChUaPlatform,
  };
  if (resourceType === 'document') {
    headers.Accept = 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8';
    headers['Sec-Fetch-Dest']='document'; headers['Sec-Fetch-Mode']='navigate'; headers['Sec-Fetch-Site']='none'; headers['Sec-Fetch-User']='?1'; headers['Upgrade-Insecure-Requests']='1';
  } else if (resourceType === 'image') {
    headers.Accept='image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'; headers['Sec-Fetch-Dest']='image'; headers['Sec-Fetch-Mode']='no-cors'; headers['Sec-Fetch-Site']=isSameOrigin?'same-origin':'cross-site';
  } else if (resourceType === 'style') {
    headers.Accept='text/css,*/*;q=0.1'; headers['Sec-Fetch-Dest']='style'; headers['Sec-Fetch-Mode']='no-cors'; headers['Sec-Fetch-Site']=isSameOrigin?'same-origin':'cross-site';
  } else if (resourceType === 'font') {
    headers.Accept='font/woff2,font/woff,font/ttf,*/*;q=0.1'; headers['Sec-Fetch-Dest']='font'; headers['Sec-Fetch-Mode']='cors'; headers['Sec-Fetch-Site']=isSameOrigin?'same-origin':'cross-site';
  } else {
    headers.Accept='*/*'; headers['Sec-Fetch-Dest']='empty'; headers['Sec-Fetch-Mode']='cors'; headers['Sec-Fetch-Site']=isSameOrigin?'same-origin':'cross-site';
  }
  if (refererUrl) headers.Referer=refererUrl;
  if (cookieHeader) headers.Cookie=cookieHeader;
  return headers;
}

export class SubrequestTracker {
  private count=0; private totalDownloadedBytes=0;
  constructor(private readonly maxLimit=45, private readonly maxBytesLimit=65*1024*1024) {}
  canFetch(){ return this.count < this.maxLimit && this.totalDownloadedBytes < this.maxBytesLimit; }
  record(bytes=0){ if(!this.canFetch()) return false; this.count++; this.totalDownloadedBytes+=bytes; return true; }
  recordBytes(bytes:number){ this.totalDownloadedBytes+=bytes; }
  get remaining(){ return Math.max(0,this.maxLimit-this.count); }
  get total(){ return this.count; }
  get totalBytes(){ return this.totalDownloadedBytes; }
}

async function runWithConcurrency<T,R>(items:T[], concurrency:number, fn:(item:T,index:number)=>Promise<R>):Promise<R[]> {
  if(!items.length) return [];
  const results:R[]=new Array(items.length); let currentIndex=0;
  const workers=Array.from({length:Math.min(concurrency,items.length)},async()=>{ while(currentIndex<items.length){ const idx=currentIndex++; try{results[idx]=await fn(items[idx],idx);}catch{} } });
  await Promise.all(workers); return results;
}

async function fetchWithTimeout(url:string, timeoutMs=6000, tracker?:SubrequestTracker, resourceType:'document'|'image'|'style'|'font'|'script'|'other'='document', refererUrl?:string, cookieJar?:CookieJar, device:DeviceType='desktop') {
  if(tracker && !tracker.record()) throw new Error(`Subrequest limit reached (${tracker.total})`);
  const cookieHeader=cookieJar?.getCookieHeader(); let targetOrigin=''; try{targetOrigin=new URL(url).origin;}catch{}
  const headers=getBrowserHeaders(resourceType,refererUrl,cookieHeader,targetOrigin,device);
  const controller=new AbortController(); const id=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    const res=await fetch(url,{headers,signal:controller.signal,redirect:'follow'}); clearTimeout(id);
    if(cookieJar){const setCookie=res.headers.get('set-cookie'); if(setCookie) cookieJar.storeCookies(setCookie);}
    const contentType=res.headers.get('content-type')||''; const text=await res.text();
    if(tracker) tracker.recordBytes(new TextEncoder().encode(text).byteLength);
    return {ok:res.ok,status:res.status,text,contentType,finalUrl:res.url||url};
  }catch(err:any){ clearTimeout(id); throw new Error(`Failed to fetch ${url}: ${err?.message||'request failed'}`); }
}

async function fetchBinary(url:string,timeoutMs=2500,tracker?:SubrequestTracker,refererUrl?:string,cookieJar?:CookieJar,resourceType:'image'|'font'='image') {
  if(tracker && !tracker.record()) return null;
  const cookieHeader=cookieJar?.getCookieHeader(); let targetOrigin=''; try{targetOrigin=new URL(url).origin;}catch{}
  const headers=getBrowserHeaders(resourceType,refererUrl,cookieHeader,targetOrigin);
  const controller=new AbortController(); const id=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    const res=await fetch(url,{headers,signal:controller.signal,redirect:'follow'}); clearTimeout(id);
    if(cookieJar){const setCookie=res.headers.get('set-cookie'); if(setCookie) cookieJar.storeCookies(setCookie);}
    if(!res.ok) return null;
    let mimeType=(res.headers.get('content-type')||'').split(';')[0].trim().toLowerCase()||guessMimeType(url);
    const arrayBuffer=await res.arrayBuffer(); const bytes=arrayBuffer.byteLength;
    if(bytes>2.5*1024*1024) return null;
    if(tracker) tracker.recordBytes(bytes);
    return {buffer:new Uint8Array(arrayBuffer),mimeType};
  }catch{clearTimeout(id);return null;}
}

function guessMimeType(urlStr:string){try{const p=new URL(urlStr).pathname.toLowerCase(); if(p.endsWith('.woff2'))return'font/woff2'; if(p.endsWith('.woff'))return'font/woff'; if(p.endsWith('.ttf'))return'font/ttf'; if(p.endsWith('.otf'))return'font/otf'; if(p.endsWith('.eot'))return'application/vnd.ms-fontobject'; if(p.endsWith('.svg'))return'image/svg+xml'; if(p.endsWith('.png'))return'image/png'; if(/\.jpe?g$/.test(p))return'image/jpeg'; if(p.endsWith('.gif'))return'image/gif'; if(p.endsWith('.webp'))return'image/webp'; if(p.endsWith('.avif'))return'image/avif'; if(p.endsWith('.ico'))return'image/x-icon';}catch{} return'application/octet-stream';}
function toBase64(bytes:Uint8Array){let binary=''; const chunk=0x8000; for(let i=0;i<bytes.length;i+=chunk) binary+=String.fromCharCode(...bytes.subarray(i,Math.min(i+chunk,bytes.length))); return btoa(binary);}
function classifyLink(rawHref:string,basePageUrl:string,rootOrigin:string):{resolvedUrl:string;type:LinkType}{ const trimmed=rawHref.trim(); if(trimmed.startsWith('mailto:'))return{resolvedUrl:trimmed,type:'mailto'}; if(trimmed.startsWith('tel:')||trimmed.startsWith('sms:'))return{resolvedUrl:trimmed,type:'other'}; if(trimmed.startsWith('#'))return{resolvedUrl:trimmed,type:'anchor'}; if(trimmed.startsWith('javascript:'))return{resolvedUrl:trimmed,type:'other'}; try{const resolved=new URL(trimmed,basePageUrl); const pathname=resolved.pathname.toLowerCase(); if(/\.(png|jpe?g|gif|webp|avif|svg|ico|pdf|zip|tar|gz|mp3|mp4|mov|woff2?|ttf|eot)$/i.test(pathname))return{resolvedUrl:resolved.href,type:'asset'}; return resolved.origin===rootOrigin?{resolvedUrl:resolved.href,type:'internal'}:{resolvedUrl:resolved.href,type:'external'};}catch{return{resolvedUrl:trimmed,type:'other'}} }
function isStylesheetLink(relAttr:string,asAttr:string,typeAttr:string,hrefAttr:string){const rel=(relAttr||'').toLowerCase(),as=(asAttr||'').toLowerCase(),type=(typeAttr||'').toLowerCase(),href=(hrefAttr||'').toLowerCase(); return rel.includes('stylesheet')||as==='style'||type==='text/css'||/\.css(\?.*)?$/i.test(href);}
function parseSrcsetUrls(srcsetValue:string){if(!srcsetValue)return[]; return srcsetValue.split(/,\s*(?![^()]*\))/).map(e=>e.trim().split(/\s+/)[0]).filter(u=>u&&!u.startsWith('data:'));}

async function processCssContent(rawCss:string,cssBaseUrl:string,visitedCssUrls:Set<string>,assetCache:Map<string,string>,tracker:SubrequestTracker,cookieJar:CookieJar,depth=0,assetLimit=10){
  if(depth>2)return rawCss; let processed=rawCss.replace(/@charset\s+['"][^'"]*['"];?/gi,'');
  const importRegex=/@import\s+(?:url\(\s*['"]?([^'")]+)['"]?\s*\)|['"]([^'"]+)['"])\s*([^;]*);/gi;
  for(const match of [...processed.matchAll(importRegex)]){if(!tracker.canFetch())break; const stmt=match[0],path=String(match[1]||match[2]||'').trim(); if(!path||path.startsWith('data:'))continue; try{const u=new URL(path,cssBaseUrl).href;if(visitedCssUrls.has(u)){processed=processed.replace(stmt,'');continue;} visitedCssUrls.add(u); const res=await fetchWithTimeout(u,2500,tracker,'style',cssBaseUrl,cookieJar); if(res.ok&&res.text){const nested=await processCssContent(res.text,u,visitedCssUrls,assetCache,tracker,cookieJar,depth+1,assetLimit);processed=processed.replace(stmt,`\n${nested}\n`);}else processed=processed.replace(stmt,'');}catch{processed=processed.replace(stmt,'');}}
  const urls=[...processed.matchAll(/url\(\s*(['"]?)([^'"()]+)\1\s*\)/gi)].map(m=>m[2]?.trim()).filter(u=>u&&!u.startsWith('data:')&&!u.startsWith('#')&&!u.startsWith('blob:'));
  await runWithConcurrency([...new Set(urls)].slice(0,assetLimit),4,async(assetPath)=>{if(!tracker.canFetch())return; try{const u=new URL(assetPath,cssBaseUrl).href;if(assetCache.has(u))return;const isFont=/\.(woff2?|ttf|otf|eot)(\?.*)?$/i.test(u);const b=await fetchBinary(u,1800,tracker,cssBaseUrl,cookieJar,isFont?'font':'image');if(b)assetCache.set(u,`data:${b.mimeType};base64,${toBase64(b.buffer)}`);}catch{}});
  return processed.replace(/url\(\s*(['"]?)([^'"()]+)\1\s*\)/gi,(full,_q,raw)=>{const t=String(raw||'').trim();if(!t||t.startsWith('data:')||t.startsWith('#')||t.startsWith('blob:'))return full;try{const u=new URL(t,cssBaseUrl).href;return `url(\"${assetCache.get(u)||u}\")`;}catch{return full;}});
}

async function processHtmlForOffline(rawHtml:string,pageUrl:string,combinedCss:string,pageMapping:Map<string,string>,assetCache:Map<string,string>,tracker:SubrequestTracker,cookieJar:CookieJar,device:DeviceType='desktop',embedAssets=true){
  const $=cheerio.load(rawHtml); $('base').remove();
  $('link').each((_,elem)=>{const rel=($(elem).attr('rel')||'').toLowerCase(),as=($(elem).attr('as')||'').toLowerCase(),type=($(elem).attr('type')||'').toLowerCase(),href=$(elem).attr('href')||$(elem).attr('data-href')||'';if(isStylesheetLink(rel,as,type,href))$(elem).remove();});
  $('script').each((_,elem)=>{const src=$(elem).attr('src')||'',content=$(elem).html()||'';if(TRACKER_DOMAINS.some(t=>src.includes(t)||content.includes(t)))$(elem).remove();});
  const targets:{element:any;urls:string[]}[]=[]; const urls=new Set<string>();
  $('img').each((_,elem)=>{const $img=$(elem);const c=[$img.attr('data-src'),$img.attr('data-lazy-src'),$img.attr('data-original'),$img.attr('data-src-retina'),$img.attr('src'),...parseSrcsetUrls($img.attr('srcset')||$img.attr('data-srcset')||'')].filter(Boolean) as string[]; if(c.length){targets.push({element:elem,urls:c});for(const u of c){try{if(!u.startsWith('data:'))urls.add(new URL(u,pageUrl).href);}catch{}}}});
  if(embedAssets){await runWithConcurrency([...urls].slice(0,12),4,async(u)=>{if(!tracker.canFetch())return;const b=await fetchBinary(u,2200,tracker,pageUrl,cookieJar,'image');if(b&&b.buffer.byteLength<=1024*1024)assetCache.set(u,`data:${b.mimeType};base64,${toBase64(b.buffer)}`);});}
  for(const t of targets){const $e=$(t.element);let src='';for(const c of t.urls){if(c.startsWith('data:')){src=c;break;}try{const u=new URL(c,pageUrl).href;src=assetCache.get(u)||u;if(assetCache.has(u))break;}catch{}}if(src)$e.attr('src',src);$e.removeAttr('data-src').removeAttr('data-lazy-src').removeAttr('data-original').removeAttr('data-src-retina').removeAttr('data-srcset').attr('loading','eager');}
  $('a').each((_,elem)=>{const href=$(elem).attr('href');if(!href)return;try{const resolved=new URL(href,pageUrl).href.split('#')[0];if(pageMapping.has(resolved))$(elem).attr('href',`${pageMapping.get(resolved)!}${href.includes('#')?'#'+href.split('#')[1]:''}`);}catch{}});
  $('[data-aos],.aos-init,.aos-animate,.wow,.reveal,.lazyload,.lazyloading').each((_,elem)=>{$(elem).removeAttr('data-aos').removeAttr('data-aos-delay').removeAttr('data-aos-duration');let s=$(elem).attr('style')||'';s=s.replace(/opacity\s*:\s*0\s*;?/gi,'opacity:1;').replace(/visibility\s*:\s*hidden\s*;?/gi,'visibility:visible;');$(elem).attr('style',s);});
  $('meta[name="viewport"]').remove();const profile=DEVICE_PROFILES[device];if($('head').length===0)$('html').prepend('<head></head>');$('head').append(`<meta name="viewport" content="${profile.viewport}">`);$('head').append('<link rel="stylesheet" href="styles.css">');const safeCss=combinedCss.replace(/<\/style>/gi,'<\\/style>');$('head').append(`<style id="offline-bundle-styles">html,body{overflow-x:hidden!important;min-height:100%;height:auto}[data-aos],.aos-init,.aos-animate,.wow,.reveal,.lazyload,.lazyloading,.opacity-0,.invisible,footer,section,main{opacity:1!important;visibility:visible!important;transform:none!important;transition:none!important}${safeCss}</style>`);if($('body').length===0)$('html').append('<body></body>');$('body').append('<script src="scripts.js"></script>');return $.html();
}

export async function scrapeWebPage(startUrlInput:string,mode:CrawlMode='single',maxPages=10,options?:{runtime?:ScraperRuntime}):Promise<ScrapeResult>{
  const runtime=options?.runtime||'node'; const isCloudflare=runtime==='cloudflare'; const startTime=Date.now(); let parsedStartUrl:URL; let normalizedInput=startUrlInput.trim(); if(!/^https?:\/\//i.test(normalizedInput))normalizedInput='https://'+normalizedInput;
  try{parsedStartUrl=new URL(normalizedInput);}catch{throw new Error(`Invalid URL provided: ${startUrlInput}`);} const baseOrigin=parsedStartUrl.origin,domain=parsedStartUrl.hostname; const cookieJar=new CookieJar(); const visitedUrls=new Set<string>(),toVisitQueue=[parsedStartUrl.href]; const allScrapedLinks:ScrapedLink[]=[],allScrapedHeadings:ScrapedHeading[]=[],seenLinkKeys=new Set<string>();
  const rawPagesMap=new Map<string,{filename:string;title:string;rawHtml:string}>(),pageMapping=new Map<string,string>(); const discoveredStyles:{type:'external'|'inline';url?:string;content?:string;media?:string;source:string}[]=[]; const discoveredScriptUrls=new Set<string>(); const discoveredInlineScripts:{source:string;content:string}[]=[]; const assetCache=new Map<string,string>(); let siteTitle='';
  const tracker=new SubrequestTracker(isCloudflare?30:600,isCloudflare?8*1024*1024:65*1024*1024);
  const maxPagesToCrawl=mode==='single'?1:Math.min(Math.max(1,maxPages),isCloudflare?3:20);
  while(toVisitQueue.length&&visitedUrls.size<maxPagesToCrawl){
    if(!tracker.canFetch())break;
    const currentUrl=toVisitQueue.shift()!,normalizedUrl=currentUrl.split('#')[0];
    if(visitedUrls.has(normalizedUrl))continue;
    visitedUrls.add(normalizedUrl);
    try{
      const response=await fetchWithTimeout(currentUrl,isCloudflare?7000:12000,tracker,'document',undefined,cookieJar);
      if(!response.ok)continue;
      const html=response.text,$=cheerio.load(html),pageTitle=$('title').text().trim()||domain;
      if(!siteTitle)siteTitle=pageTitle;
      let fileName='index.html';
      if(visitedUrls.size>1){let safePath=new URL(currentUrl).pathname.replace(/[^a-zA-Z0-9_-]/g,'_').replace(/^_+|_+$/g,'');if(!safePath)safePath=`page_${visitedUrls.size}`;fileName=`${safePath}.html`;}
      rawPagesMap.set(normalizedUrl,{filename:fileName,title:pageTitle,rawHtml:html});
      pageMapping.set(normalizedUrl,fileName);
      $('a').each((_,elem)=>{const href=$(elem).attr('href');if(!href)return;const text=$(elem).text().replace(/\s+/g,' ').trim()||$(elem).attr('title')?.trim()||'[No anchor text]';const {resolvedUrl,type}=classifyLink(href,currentUrl,baseOrigin);const key=`${type}:${resolvedUrl}:${text}`;if(!seenLinkKeys.has(key)){seenLinkKeys.add(key);allScrapedLinks.push({id:`link-${allScrapedLinks.length+1}`,url:resolvedUrl,text:text.slice(0,200),type,sourceUrl:currentUrl});}if(mode==='all'&&type==='internal'&&resolvedUrl.startsWith(baseOrigin)){const clean=resolvedUrl.split('#')[0];if(!visitedUrls.has(clean)&&!toVisitQueue.includes(clean)&&!/\.(png|jpe?g|gif|svg|pdf|zip|css|js|xml|json|mp4|mp3)$/i.test(clean))toVisitQueue.push(clean);}});
      $('h1,h2,h3,h4,h5,h6').each((_,elem)=>{const tag=String((elem as any).tagName||(elem as any).name||'').toLowerCase() as HeadingLevel,text=$(elem).text().replace(/\s+/g,' ').trim();if(text)allScrapedHeadings.push({id:`heading-${allScrapedHeadings.length+1}`,level:tag,text:text.slice(0,500),sourceUrl:currentUrl,pageTitle,index:allScrapedHeadings.length+1});});
      $('link,style').each((idx,elem)=>{const tag=String((elem as any).tagName||(elem as any).name||'').toLowerCase();if(tag==='link'){const rel=($(elem).attr('rel')||'').toLowerCase(),as=($(elem).attr('as')||'').toLowerCase(),type=($(elem).attr('type')||'').toLowerCase(),href=$(elem).attr('href')||$(elem).attr('data-href'),media=$(elem).attr('media')?.trim();if(href&&isStylesheetLink(rel,as,type,href)){try{const u=new URL(href,currentUrl).href;if(!discoveredStyles.some(s=>s.url===u))discoveredStyles.push({type:'external',url:u,media,source:`${fileName} (${href})`});}catch{}}}else{const content=$(elem).html()?.trim();if(content)discoveredStyles.push({type:'inline',content,media:$(elem).attr('media')?.trim(),source:`${fileName} inline #${idx+1}`});}});
      $('script[src]').each((_,elem)=>{const src=$(elem).attr('src')||$(elem).attr('data-src');if(src&&!TRACKER_DOMAINS.some(t=>src.includes(t))){try{discoveredScriptUrls.add(new URL(src,currentUrl).href);}catch{}}});
      $('script:not([src])').each((idx,elem)=>{const type=$(elem).attr('type')?.toLowerCase();if(!type||type==='text/javascript'||type==='application/javascript'||type==='module'){const content=$(elem).html()?.trim();if(content&&!TRACKER_DOMAINS.some(t=>content.includes(t)))discoveredInlineScripts.push({source:`${fileName} inline #${idx+1}`,content});}});
    }catch(e:any){console.warn(`Error crawling ${currentUrl}:`,e?.message||e);}
  }

  const rawPagesMapTablet=new Map<string,{filename:string;title:string;rawHtml:string}>(); const rawPagesMapMobile=new Map<string,{filename:string;title:string;rawHtml:string}>();
  if(!isCloudflare){
    for(const [pageUrl,rawData] of rawPagesMap){
      try{const r=await fetchWithTimeout(pageUrl,10000,tracker,'document',undefined,cookieJar,'tablet');rawPagesMapTablet.set(pageUrl,r.ok&&r.text?{filename:rawData.filename,title:rawData.title,rawHtml:r.text}:{...rawData});}catch{rawPagesMapTablet.set(pageUrl,{...rawData});}
      try{const r=await fetchWithTimeout(pageUrl,10000,tracker,'document',undefined,cookieJar,'mobile');rawPagesMapMobile.set(pageUrl,r.ok&&r.text?{filename:rawData.filename,title:rawData.title,rawHtml:r.text}:{...rawData});}catch{rawPagesMapMobile.set(pageUrl,{...rawData});}
    }
  }

  const cssSections:string[]=[`@charset "UTF-8";\n/* Offline stylesheet for ${startUrlInput} */\n`]; const visitedCssUrls=new Set<string>(); const maxStyles=isCloudflare?4:100;
  for(const item of discoveredStyles.slice(0,maxStyles)){if(item.type==='external'&&item.url){if(visitedCssUrls.has(item.url)||!tracker.canFetch())continue;visitedCssUrls.add(item.url);try{const r=await fetchWithTimeout(item.url,isCloudflare?2500:9000,tracker,'style',parsedStartUrl.href,cookieJar);if(r.ok&&r.text)cssSections.push(await processCssContent(r.text,item.url,visitedCssUrls,assetCache,tracker,cookieJar,0,isCloudflare?5:20));}catch{}}else if(item.content){try{cssSections.push(await processCssContent(item.content,parsedStartUrl.href,visitedCssUrls,assetCache,tracker,cookieJar,0,isCloudflare?5:20));}catch{}}}
  const combinedCss=cssSections.join('\n\n');
  const jsSections:string[]=[`// Offline JavaScript bundle\n`]; const maxScripts=isCloudflare?2:10;
  for(const u of Array.from(discoveredScriptUrls).slice(0,maxScripts)){if(!tracker.canFetch())break;try{const r=await fetchWithTimeout(u,isCloudflare?2500:7000,tracker,'script',parsedStartUrl.href,cookieJar);if(r.ok&&r.text&&r.text.length<(isCloudflare?150000:800000))jsSections.push(`\n// ${u}\n(function(){try{${r.text}}catch(e){console.warn(e)}})();\n`);}catch{}}
  for(const s of discoveredInlineScripts.slice(0,isCloudflare?3:100))jsSections.push(`\n// ${s.source}\n(function(){try{${s.content}}catch(e){console.warn(e)}})();\n`); const combinedJs=jsSections.join('\n');

  const filesDesktop:ExtractedFile[]=[];for(const [pageUrl,rawData] of rawPagesMap){const html=await processHtmlForOffline(rawData.rawHtml,pageUrl,combinedCss,pageMapping,assetCache,tracker,cookieJar,'desktop',!isCloudflare);filesDesktop.push({id:`file-html-${rawData.filename}-desktop`,name:rawData.filename,type:'html',content:html,size:new TextEncoder().encode(html).byteLength,sourceUrl:pageUrl,description:`Desktop: ${rawData.title}`});}
  const filesTablet:ExtractedFile[]=[]; const filesMobile:ExtractedFile[]=[];
  if(!isCloudflare){for(const [pageUrl,rawData] of rawPagesMapTablet){const html=await processHtmlForOffline(rawData.rawHtml,pageUrl,combinedCss,pageMapping,assetCache,tracker,cookieJar,'tablet');filesTablet.push({id:`file-html-${rawData.filename}-tablet`,name:rawData.filename,type:'html',content:html,size:new TextEncoder().encode(html).byteLength,sourceUrl:pageUrl,description:`Tablet: ${rawData.title}`});}for(const [pageUrl,rawData] of rawPagesMapMobile){const html=await processHtmlForOffline(rawData.rawHtml,pageUrl,combinedCss,pageMapping,assetCache,tracker,cookieJar,'mobile');filesMobile.push({id:`file-html-${rawData.filename}-mobile`,name:rawData.filename,type:'html',content:html,size:new TextEncoder().encode(html).byteLength,sourceUrl:pageUrl,description:`Mobile: ${rawData.title}`});}}

  const fileCssMain:ExtractedFile={id:'file-css-main',name:'styles.css',type:'css',content:combinedCss,size:new TextEncoder().encode(combinedCss).byteLength,description:`Extracted stylesheet (${discoveredStyles.length} discovered)`}; const fileJsMain:ExtractedFile={id:'file-js-main',name:'scripts.js',type:'javascript',content:combinedJs,size:new TextEncoder().encode(combinedJs).byteLength,description:`Extracted JavaScript (${discoveredScriptUrls.size} external scripts)`};
  const linksJsonContent=JSON.stringify({scrapedAt:new Date().toISOString(),targetUrl:startUrlInput,domain,offlineReady:true,pagesScanned:Array.from(visitedUrls),totalLinks:allScrapedLinks.length,totalHeadings:allScrapedHeadings.length,stylesDiscovered:discoveredStyles.length,embeddedAssetsCount:assetCache.size,links:allScrapedLinks,headings:allScrapedHeadings},null,2); const headingsCount:Record<HeadingLevel,number>={h1:0,h2:0,h3:0,h4:0,h5:0,h6:0};for(const h of allScrapedHeadings)headingsCount[h.level]++;
  const fileJsonLinks:ExtractedFile={id:'file-json-links',name:'links.json',type:'json',content:linksJsonContent,size:new TextEncoder().encode(linksJsonContent).byteLength}; const headingsJsonContent=JSON.stringify({scrapedAt:new Date().toISOString(),targetUrl:startUrlInput,domain,totalHeadings:allScrapedHeadings.length,counts:headingsCount,headings:allScrapedHeadings},null,2); const fileJsonHeadings:ExtractedFile={id:'file-json-headings',name:'headings.json',type:'json',content:headingsJsonContent,size:new TextEncoder().encode(headingsJsonContent).byteLength}; const commonFiles=[fileCssMain,fileJsMain,fileJsonLinks,fileJsonHeadings]; const allDesktopFiles=[...filesDesktop,...commonFiles]; const allTabletFiles=isCloudflare?commonFiles:[...filesTablet,...commonFiles]; const allMobileFiles=isCloudflare?commonFiles:[...filesMobile,...commonFiles];
  const makeVersion=(device:DeviceType,files:ExtractedFile[]):DeviceVersion=>({device,title:`${siteTitle||domain} (${device})`,files,totalBytes:files.reduce((a,f)=>a+f.size,0),viewport:DEVICE_PROFILES[device].viewport,userAgent:DEVICE_PROFILES[device].userAgent});
  const internalCount=allScrapedLinks.filter(l=>l.type==='internal').length,externalCount=allScrapedLinks.filter(l=>l.type==='external').length;
  return {targetUrl:startUrlInput,mode,domain,title:siteTitle||domain,pagesScanned:visitedUrls.size,totalLinksFound:allScrapedLinks.length,internalLinksCount:internalCount,externalLinksCount:externalCount,links:allScrapedLinks,headings:allScrapedHeadings,totalHeadingsFound:allScrapedHeadings.length,headingsCount,files:allDesktopFiles,deviceVersions:{desktop:makeVersion('desktop',allDesktopFiles),tablet:makeVersion('tablet',allTabletFiles),mobile:makeVersion('mobile',allMobileFiles)},scannedUrls:Array.from(visitedUrls),executionTimeMs:Date.now()-startTime};
}
