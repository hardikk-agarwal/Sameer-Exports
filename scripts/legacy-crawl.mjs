// Crawls the legacy brass-builders.com site and records every product (code, name, images) per category.
// Usage: node scripts/legacy-crawl.mjs [--images]   (--images also downloads the large photos to legacy/images)
import { mkdir, writeFile, access } from 'node:fs/promises';
import path from 'node:path';

const ROOT = 'https://brass-builders.com/';
const OUT = path.resolve('legacy');
const downloadImages = process.argv.includes('--images');

const decode = (s) =>
  s
    .replace(/&amp;/gi, '&')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

async function get(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.text();
}

function links(html, base) {
  const out = new Set();
  for (const m of html.matchAll(/href\s*=\s*["']([^"'#]+\.html)(#[^"']*)?["']/gi)) {
    const u = new URL(m[1], base);
    if (u.hostname === 'brass-builders.com') out.add(u.href);
  }
  return [...out];
}

function parseProducts(html, pageUrl) {
  const products = [];
  const tables = html.split(/<table/i).slice(1);
  for (const t of tables) {
    const body = t.split(/<\/table>/i)[0];
    const images = [...body.matchAll(/openchild\(\s*"([^"]+)"\s*\)[^>]*>\s*<img[^>]*src\s*=\s*"([^"]+)"[^>]*?(?:alt\s*=\s*"([^"]*)")?[^>]*>/gi)].map(
      (m) => ({
        large: new URL(m[1], pageUrl).href,
        thumb: new URL(m[2], pageUrl).href,
        alt: decode(m[3] ?? ''),
      }),
    );
    const codes = [...body.matchAll(/Item\s*Code\s*:?\s*([^<]+)</gi)].map((m) => decode(m[1]));
    if (!images.length) continue;
    images.forEach((img, i) => products.push({ code: codes[i] ?? null, ...img }));
  }
  return products;
}

const pageTitle = (html) => decode(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? '');
const heading = (html) => decode(html.match(/class="heading"[^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? '');
const intro = (html) => decode(html.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i)?.[1] ?? '');
const metaDesc = (html) => decode(html.match(/<meta[^>]+name="description"[^>]+content="([^"]*)"/i)?.[1] ?? '');
const metaKeys = (html) => decode(html.match(/<meta[^>]+name="keywords"[^>]+content="([^"]*)"/i)?.[1] ?? '');

const home = await get(ROOT);
const queue = links(home, ROOT).filter((u) => !/query\.html$/i.test(u));
const seen = new Set([ROOT]);
const pages = [];

while (queue.length) {
  const url = queue.shift();
  if (seen.has(url)) continue;
  seen.add(url);
  let html;
  try {
    html = await get(url);
  } catch (e) {
    pages.push({ url, error: String(e.message) });
    continue;
  }
  const products = parseProducts(html, url);
  pages.push({ url, title: pageTitle(html), heading: heading(html), intro: intro(html), description: metaDesc(html), keywords: metaKeys(html), products });
  for (const l of links(html, url)) if (!seen.has(l) && !/query\.html$/i.test(l)) queue.push(l);
}

await mkdir(OUT, { recursive: true });
await writeFile(path.join(OUT, 'catalog.json'), JSON.stringify({ crawledAt: new Date().toISOString(), home: { title: pageTitle(home), description: metaDesc(home), keywords: metaKeys(home) }, pages }, null, 2));

const total = pages.reduce((n, p) => n + (p.products?.length ?? 0), 0);
console.log(`pages: ${pages.length}, products: ${total}`);
for (const p of pages) console.log(`${String(p.products?.length ?? 'ERR').padStart(4)}  ${p.url.replace(ROOT, '')}  ${p.heading ?? p.error}`);

if (downloadImages) {
  const dir = path.join(OUT, 'images');
  await mkdir(dir, { recursive: true });
  let n = 0;
  for (const p of pages)
    for (const prod of p.products ?? []) {
      const rel = new URL(prod.large).pathname.replace(/^\//, '').replace(/\//g, '__');
      const file = path.join(dir, rel);
      try {
        await access(file);
        continue;
      } catch {}
      const res = await fetch(prod.large);
      if (!res.ok) {
        console.warn('missing', prod.large);
        continue;
      }
      await writeFile(file, Buffer.from(await res.arrayBuffer()));
      n++;
    }
  console.log(`downloaded ${n} images to ${dir}`);
}
