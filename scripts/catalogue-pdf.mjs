// The downloadable catalogue: an A4 PDF of every range and design on the website, laid out here and printed with the
// installed Edge (or Chrome). Run `npm run catalogue` after `npm run images`. Writes the PDF into public/catalogue/ and
// src/data/catalogue-pdf.json (page count, size and each range's page, used by the site's links).
import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';
import qrcode from 'qrcode-generator';
import { chromium } from 'playwright-core';
import { site, people } from '../src/data/site.ts';
import data from '../src/data/catalogue.json' with { type: 'json' };
import meta from '../src/data/image-meta.json' with { type: 'json' };
import mark from '../src/data/mark.json' with { type: 'json' };

const EDITION = 2026;
const OUT_PDF = 'public/catalogue/sameer-exports-catalogue-2026.pdf';
const OUT_JSON = 'src/data/catalogue-pdf.json';
const TMP = path.join(os.tmpdir(), 'sameer-catalogue');
const WEB = site.url.replace(/^https:\/\//, '');

// Layout in millimetres. A4 page; the content box runs from TOP to BOTTOM between the running header and footer.
const PAGE_W = 210;
const PAGE_H = 297;
const SIDE = 14;
const TOP = 17;
const BOTTOM = 282;
const COLS = 4;
const COL_GAP = 6;
const TILE_W = (PAGE_W - 2 * SIDE - COL_GAP * (COLS - 1)) / COLS;
const TILE_H = 38;
const CAPTION = 17.6;
const ROW_H = TILE_H + 2 + CAPTION;
const ROW_GAP = 4;
const RANGE_HEAD = 19;
const RANGE_GAP = 8;
const CONT_HEAD = 9;
const BAND_H = 118;
const DPI = 300;
const px = (mm) => Math.round((mm / 25.4) * DPI);

// The site's colour tokens (src/styles/global.css), converted to sRGB so photos and type share exact colours.
const oklch = (L, C, h) => {
  const a = C * Math.cos((h * Math.PI) / 180);
  const b = C * Math.sin((h * Math.PI) / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const rgb = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
  return `#${rgb.map((v) => Math.round(255 * Math.min(1, Math.max(0, v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055))).toString(16).padStart(2, '0')).join('')}`;
};
const C = {
  paper: oklch(0.985, 0.004, 80),
  tile: oklch(0.935, 0.006, 75),
  line: oklch(0.885, 0.007, 80),
  ink: oklch(0.19, 0.012, 268),
  muted: oklch(0.5, 0.01, 268),
  indigo: oklch(0.33, 0.1, 268),
  indigoDeep: oklch(0.26, 0.085, 268),
  indigoGlow: oklch(0.42, 0.11, 268),
  onDark: oklch(0.975, 0.003, 268),
  onDarkMuted: oklch(0.78, 0.02, 268),
  red: '#da291c',
};

// Same swatches as src/components/Finishes.astro.
const SWATCH = {
  BPL: 'linear-gradient(135deg, oklch(0.92 0.09 92), oklch(0.68 0.12 76) 50%, oklch(0.86 0.11 86))',
  GPL: 'linear-gradient(135deg, oklch(0.9 0.12 86), oklch(0.64 0.14 70) 50%, oklch(0.83 0.13 80))',
  AB: 'linear-gradient(135deg, oklch(0.7 0.08 75), oklch(0.45 0.07 65) 50%, oklch(0.62 0.08 72))',
  FB: 'linear-gradient(135deg, oklch(0.5 0.05 55), oklch(0.3 0.04 50) 50%, oklch(0.44 0.05 55))',
  CP: 'linear-gradient(135deg, oklch(0.98 0.003 250), oklch(0.62 0.01 250) 50%, oklch(0.93 0.005 250))',
  SCP: 'linear-gradient(135deg, oklch(0.94 0.004 250), oklch(0.74 0.008 250) 50%, oklch(0.88 0.005 250))',
  BSC: 'linear-gradient(135deg, oklch(0.52 0.01 260), oklch(0.28 0.01 260) 50%, oklch(0.44 0.01 260))',
  ORB: 'linear-gradient(135deg, oklch(0.42 0.045 50), oklch(0.23 0.03 45) 50%, oklch(0.35 0.04 50))',
  PC: 'linear-gradient(135deg, oklch(0.34 0.005 260), oklch(0.2 0.005 260))',
  PCT: 'radial-gradient(circle at 50% 50%, oklch(0.4 0.005 260) 0.25mm, transparent 0.5mm) 0 0 / 1.1mm 1.1mm, oklch(0.24 0.005 260)',
  HDP: 'linear-gradient(135deg, oklch(0.84 0.006 230), oklch(0.66 0.008 230) 50%, oklch(0.79 0.006 230))',
  ZP: 'linear-gradient(135deg, oklch(0.9 0.02 240), oklch(0.7 0.03 240) 50%, oklch(0.86 0.02 240))',
};

// Pieces for the cover (from the social card's row) and for each family's opening band. Web cut-outs are 520 px tall, so
// none is enlarged more than MAX_UPSCALE.
const COVER_ROW = [['SE-3001', 270], ['SE-2017', 120], ['SE-1011', 300], ['SE-18017', 130], ['SE-25011', 260]];
const BAND_PIECES = 3;
const MAX_UPSCALE = 1.35;

const families = data.families;
const designCount = families.reduce((n, f) => n + f.ranges.reduce((k, r) => k + r.designs.length, 0), 0);
const rangeCount = families.reduce((n, f) => n + f.ranges.length, 0);
const finishes = data.finishes.filter((f) => SWATCH[f.code]);

const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);
const chunk = (list, n) => Array.from({ length: Math.ceil(list.length / n) }, (_, i) => list.slice(i * n, i * n + n));
const listText = (items) => (items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`);
const designUrl = (range, code) => `${site.url}/products/${range.id}/#${code.toLowerCase()}`;
// Long, flat pieces get more width and compact ones more height, as on the site (fit() in src/data/catalogue.ts).
const fitBox = (w, h) => (w / h >= 1.8 ? [0.84, 0.56] : w / h >= 1.1 ? [0.7, 0.68] : [0.52, 0.74]);
// Sizes were read from the printed catalogue; a few list every size across two lines.
const cleanSize = (s) => {
  if (/available\s*sizes/i.test(s)) {
    const mm = [...s.matchAll(/(\d+)\s*mm/g)].map((m) => Number(m[1]));
    return `Sizes ${Math.min(...mm)}–${Math.max(...mm)}mm`;
  }
  return s.replace(/\s*\/\s*/g, ' ').replace(/,\s*,/g, ',').replace(/\s{2,}/g, ' ').trim();
};

// ---------- Images (JPEG only: Chromium embeds JPEGs as they are, but re-encodes PNG and WebP losslessly) ----------

await mkdir(path.join(TMP, 'tiles'), { recursive: true });

// A design's catalogue photo (on white) multiplied onto the tile colour, as the range pages show it.
const tile = async (code) => {
  const src = path.join('catalogue/site/t', `${code}.jpg`);
  const out = path.join(TMP, 'tiles', `${code}.jpg`);
  const W = px(TILE_W);
  const H = px(TILE_H);
  const { width, height } = await sharp(src).metadata();
  const [fw, fh] = fitBox(width, height);
  const piece = await sharp(src).resize({ width: Math.round(W * fw), height: Math.round(H * fh), fit: 'inside', kernel: 'lanczos3' }).removeAlpha().toBuffer({ resolveWithObject: true });
  await sharp({ create: { width: W, height: H, channels: 3, background: C.tile } })
    .composite([{ input: piece.data, left: Math.round((W - piece.info.width) / 2), top: Math.round((H - piece.info.height) / 2), blend: 'multiply' }])
    .jpeg({ quality: 80, mozjpeg: true })
    .toFile(out);
};

// A cut-out piece with a soft and a contact shadow, for the cover and the family bands.
const shadowed = async (code, height, tint, shadows) => {
  const { data: pix, info } = await sharp(`public/img/p/${code.toLowerCase()}.webp`).resize({ height, kernel: 'lanczos3' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const raw = { width: info.width, height: info.height, channels: 4 };
  const layers = [];
  for (const { blur, dx, dy, opacity } of shadows) {
    const shade = Buffer.alloc(pix.length);
    for (let i = 0; i < pix.length; i += 4) (shade[i] = tint[0]), (shade[i + 1] = tint[1]), (shade[i + 2] = tint[2]), (shade[i + 3] = Math.round(pix[i + 3] * opacity));
    const sigma = Math.max(0.6, height * blur);
    const pad = Math.ceil(sigma * 3);
    const input = await sharp(shade, { raw }).extend({ top: pad, bottom: pad, left: pad, right: pad, background: { r: 0, g: 0, b: 0, alpha: 0 } }).blur(sigma).png().toBuffer();
    layers.push({ input, dx: Math.round(height * dx) - pad, dy: Math.round(height * dy) - pad });
  }
  layers.push({ input: await sharp(pix, { raw }).png().toBuffer(), dx: 0, dy: 0 });
  return { layers, w: info.width, h: info.height };
};
const place = (piece, x, y) => piece.layers.map((l) => ({ input: l.input, left: Math.round(x + l.dx), top: Math.round(y + l.dy) }));

const coverArt = async () => {
  const W = px(PAGE_W);
  const H = px(PAGE_H);
  const gap = 46;
  const aspect = (code) => meta[code].w / meta[code].h;
  const natural = COVER_ROW.reduce((n, [code, h]) => n + h * aspect(code), 0) + gap * (COVER_ROW.length - 1);
  const scale = Math.min((W - 2 * px(15)) / natural, ...COVER_ROW.map(([code, h]) => (meta[code].h * MAX_UPSCALE) / h));
  const pieces = [];
  for (const [code, h] of COVER_ROW) pieces.push(await shadowed(code, Math.round(h * scale), [8, 10, 34], [{ blur: 0.045, dx: 0.035, dy: 0.07, opacity: 0.55 }, { blur: 0.008, dx: 0.004, dy: 0.01, opacity: 0.35 }]));
  const total = pieces.reduce((n, p) => n + p.w, 0) + gap * scale * (pieces.length - 1);
  let x = (W - total) / 2;
  const mid = H * 0.455;
  const layers = [];
  for (const p of pieces) {
    layers.push(...place(p, x, mid - p.h / 2));
    x += p.w + gap * scale;
  }
  const field = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><defs><linearGradient id="g" x1="0" y1="0" x2="0.35" y2="1"><stop offset="0" stop-color="${C.indigo}"/><stop offset="1" stop-color="${C.indigoDeep}"/></linearGradient><radialGradient id="r" cx="0.5" cy="0.455" r="0.55"><stop offset="0" stop-color="${C.indigoGlow}" stop-opacity="0.75"/><stop offset="1" stop-color="${C.indigoGlow}" stop-opacity="0"/></radialGradient></defs><rect width="${W}" height="${H}" fill="url(#g)"/><rect width="${W}" height="${H}" fill="url(#r)"/></svg>`);
  await sharp(field).composite(layers).jpeg({ quality: 84, mozjpeg: true }).toFile(path.join(TMP, 'cover.jpg'));
};

// Each family opens on a full-width band: up to three of its range pieces, the biggest in the middle.
const bandArt = async (family) => {
  const W = px(PAGE_W);
  const H = px(BAND_H);
  const codes = [...new Set(family.ranges.map((r) => r.image))].filter((code) => meta[code]).slice(0, BAND_PIECES);
  const share = (code) => {
    const a = meta[code].w / meta[code].h;
    return a >= 1.6 ? 0.24 : a >= 0.9 ? 0.36 : 0.46;
  };
  const areaX = W * 0.52;
  const areaW = W * 0.44;
  const gap = W * 0.02;
  const wanted = codes.map((code) => Math.min(H * share(code), meta[code].h * MAX_UPSCALE));
  const natural = codes.reduce((n, code, i) => n + wanted[i] * (meta[code].w / meta[code].h), 0) + gap * (codes.length - 1);
  const scale = Math.min(1, areaW / natural);
  const pieces = [];
  for (const [i, code] of codes.entries()) pieces.push(await shadowed(code, Math.round(wanted[i] * scale), [30, 32, 60], [{ blur: 0.05, dx: 0.03, dy: 0.06, opacity: 0.22 }, { blur: 0.008, dx: 0.004, dy: 0.008, opacity: 0.3 }]));
  const ranked = [...pieces].sort((a, b) => b.h - a.h);
  const arranged = ranked.length === 3 ? [ranked[1], ranked[0], ranked[2]] : ranked;
  const total = arranged.reduce((n, p) => n + p.w, 0) + gap * (arranged.length - 1);
  let x = areaX + (areaW - total) / 2;
  const mid = H * 0.56;
  const layers = [];
  for (const p of arranged) {
    layers.push(...place(p, x, mid - p.h / 2));
    x += p.w + gap;
  }
  await sharp({ create: { width: W, height: H, channels: 3, background: C.tile } }).composite(layers).jpeg({ quality: 84, mozjpeg: true }).toFile(path.join(TMP, `band-${family.id}.jpg`));
};

const allDesigns = families.flatMap((f) => f.ranges.flatMap((r) => r.designs.map((d) => d.code)));
const tileCodes = [...new Set([...allDesigns, ...finishes.map((f) => f.example).filter(Boolean)])];
const t0 = Date.now();
for (let i = 0; i < tileCodes.length; i += 16) await Promise.all(tileCodes.slice(i, i + 16).map(tile));
await coverArt();
for (const f of families) await bandArt(f);
console.log(`images: ${tileCodes.length} tiles, cover and ${families.length} bands in ${Math.round((Date.now() - t0) / 1000)} s`);

// ---------- Pagination ----------

const pages = [{ kind: 'cover' }, { kind: 'about' }, { kind: 'contents' }, { kind: 'finishes' }];
const rangePage = {};
const familyPage = {};
for (const family of families) {
  let page = { kind: 'flow', family, band: true, blocks: [] };
  pages.push(page);
  familyPage[family.id] = pages.length;
  let y = BAND_H + 9;
  const slots = (top) => Math.max(0, Math.floor((BOTTOM - top + ROW_GAP) / (ROW_H + ROW_GAP)));
  const turn = (range) => {
    page = { kind: 'flow', family, blocks: [] };
    pages.push(page);
    y = TOP;
    if (range) {
      page.blocks.push({ type: 'cont', range, y });
      y += CONT_HEAD;
    }
  };
  for (const [ri, range] of family.ranges.entries()) {
    const rows = chunk(range.designs, COLS);
    const atTop = page.blocks.length === 0;
    const gap = atTop ? 0 : RANGE_GAP;
    const room = slots(y + gap + RANGE_HEAD);
    // The band page always opens with the first range. Elsewhere a range of one or two rows stays whole, and a longer
    // one does not start with a single row at the foot of a page.
    if (!atTop && (room === 0 || (room < rows.length && (rows.length <= 2 || room === 1)))) turn();
    else y += gap;
    page.blocks.push({ type: 'range', range, y });
    rangePage[range.id] = pages.length;
    y += RANGE_HEAD;
    let left = rows.length;
    while (left > 0) {
      let here = Math.min(slots(y), left);
      // The family's last page should not hold one lone row: carry one more over with it.
      if (ri === family.ranges.length - 1 && left - here === 1 && here >= 2) here -= 1;
      for (let k = 0; k < here; k++) {
        page.blocks.push({ type: 'row', range, designs: rows[rows.length - left], y });
        y += ROW_H + ROW_GAP;
        left -= 1;
      }
      if (left > 0) turn(range);
    }
    y -= ROW_GAP;
  }
}
pages.push({ kind: 'back' });

// ---------- HTML ----------

const markSvg = (cls = 'mark') => `<svg class="${cls}" viewBox="0 0 ${mark.w} ${mark.h}" aria-hidden="true"><path fill-rule="evenodd" d="${mark.d}"/></svg>`;
const qr = (text) => {
  const q = qrcode(0, 'M');
  q.addData(text);
  q.make();
  const n = q.getModuleCount();
  let d = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
  return `<svg class="qr" viewBox="-3 -3 ${n + 6} ${n + 6}" shape-rendering="crispEdges" aria-hidden="true"><rect x="-3" y="-3" width="${n + 6}" height="${n + 6}" fill="#fff"/><path d="${d}" fill="${C.ink}"/></svg>`;
};
const run = (right = '') => `<header class="run"><span class="brand">${markSvg()}<span>${esc(site.name)}</span><span class="dim">Catalogue ${EDITION}</span></span><span>${esc(right)}</span></header>`;
const foot = (n) => `<footer class="foot"><a href="${site.url}/">${WEB}</a><span class="num">${n}</span></footer>`;

const rangeHead = (range, y) => {
  const fin = [...new Set(range.designs.map((d) => d.finish).filter(Boolean))];
  const finText = fin.length <= 3 ? listText(fin) : `${fin.slice(0, 2).join(', ')} and ${fin.length - 2} more finishes`;
  return `<div class="blk range-head" id="r-${range.id}" style="top:${y}mm"><h2>${esc(range.title)}</h2><p class="meta"><span>${range.designs.length} designs</span><span>${esc(finText)}</span><a href="${site.url}/products/${range.id}/">${WEB}/products/${range.id}</a></p></div>`;
};
const row = (range, designs, y) =>
  `<div class="blk row" style="top:${y}mm">${designs
    .map((d) => {
      const spec = [cleanSize(d.size), d.finish].filter(Boolean).join(' · ');
      return `<a class="tile" href="${designUrl(range, d.code)}"><img src="tiles/${d.code}.jpg" alt="${esc(`${d.name}, item ${d.code}`)}"><span class="cap"><span class="code">${d.code}</span><span class="name">${esc(d.name)}</span><span class="spec">${esc(spec)}</span></span></a>`;
    })
    .join('')}</div>`;

const about = () => {
  const work = [
    ['Sand casting', 'Our own foundry casts solid parts in traditional sand moulds, which keeps fine detail on period designs.'],
    ['Forging', 'Modern forging machines press hot metal into dense, non-porous parts for pieces that take hard use.'],
    ['Finishing', 'Every piece is partly machined and partly handcrafted, then finished, polished and lacquered in-house.'],
    ['Packing', 'Orders are packed to international standards and to each buyer’s own requirements.'],
  ];
  const facts = [
    ['Established', String(site.founded)],
    ...people.map((p) => [p.role, p.name]),
    ['Certification', 'ISO 9001'],
    ['GSTIN', site.gstin],
    ['Import Export Code', site.iec],
    ['Factory and office', `${site.address.street}, ${site.address.city} ${site.address.postcode}, ${site.address.region}, ${site.address.country}`],
  ];
  const steps = ['Note the codes, quantities and finish you need.', 'Send the list on WhatsApp, by email or with the quote form.', 'We reply with price, MOQ, packing and lead time. Samples on request.'];
  return `<section class="page sheet" id="about">${run('About us')}
    <div class="sheet-body about-body">
      <p class="kicker">About us</p>
      <h1 class="sheet-title">Made in Aligarh since ${site.founded}</h1>
      <p class="lede">We make and export brass and wrought iron hardware from our factory in Talanagri, Aligarh.</p>
      <div class="about-grid">
        <div class="prose">
          <p>Aligarh has been India’s centre for locks and builders’ hardware for more than a century, and the district our factory stands in is named for the trade: Talanagri means “lock town”. The casting, filing and polishing skills our people use are the town’s own.</p>
          <p>${esc(people[0].name)} started ${esc(site.name)} in ${site.founded} under the direction of Er. S.P. Agarwal. Today a team of designers keeps the range evolving, and our buyers are importers, wholesalers and builders in ${listText(site.markets)}.</p>
        </div>
        <dl class="facts">${facts.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
      </div>
      <h2 class="sub-title">How we make it</h2>
      <ol class="work">${work.map(([t, x]) => `<li><h3>${t}</h3><p>${x}</p></li>`).join('')}</ol>
      <div class="order">
        <h2 class="sub-title">How to order</h2>
        <ol class="steps">${steps.map((s, i) => `<li><span class="code">${i + 1}</span><p>${s}</p></li>`).join('')}</ol>
        <p class="order-contact">WhatsApp <a href="${site.contact.whatsapp}">${site.contact.whatsappNumber}</a><span>Email <a href="mailto:${site.contact.email}">${site.contact.email}</a></span><span>Quote form <a href="${site.url}/contact/">${WEB}/contact</a></span></p>
      </div>
    </div>${foot(2)}</section>`;
};

const contents = () => `<section class="page sheet">${run('Contents')}
  <div class="sheet-body">
    <p class="kicker">Catalogue ${EDITION}</p>
    <h1 class="sheet-title">Contents</h1>
    <p class="lede">${designCount} designs in ${rangeCount} ranges. Every design has an item code: send us the codes and quantities you need for a quote.</p>
    <div class="toc">
      <div class="toc-fam toc-front"><a class="toc-row" href="#about"><span>About us and how to order</span><span>2</span></a><a class="toc-row" href="#finishes"><span>Finishes</span><span>4</span></a></div>
      ${families
        .map(
          (f) => `<div class="toc-fam"><a class="toc-row toc-head" href="#f-${f.id}"><span>${esc(f.name)}</span><span>${familyPage[f.id]}</span></a>${f.ranges
            .map((r) => `<a class="toc-row" href="#r-${r.id}"><span>${esc(r.title)}</span><span>${rangePage[r.id]}</span></a>`)
            .join('')}</div>`,
        )
        .join('')}
    </div>
  </div>${foot(3)}</section>`;

const finishPage = () => `<section class="page sheet" id="finishes">${run('Finishes')}
  <div class="sheet-body">
    <p class="kicker">${finishes.length} finishes</p>
    <h1 class="sheet-title">Finishes</h1>
    <p class="lede">The finishes we use across the range, each shown on a piece from this catalogue. Every design lists its standard finish; ask about others when you send your list.</p>
    <ul class="finish-grid">${finishes
      .map((f) => {
        const d = families.flatMap((x) => x.ranges.flatMap((r) => r.designs)).find((x) => x.code === f.example);
        return `<li><span class="swatch" style="background:${SWATCH[f.code]}"></span>${f.example ? `<img src="tiles/${f.example}.jpg" alt="${esc(`${d?.name ?? 'Example'} in ${f.name.toLowerCase()}`)}">` : ''}<span class="finish-cap"><span class="code">${f.code}</span><span class="name">${esc(f.name)}</span>${f.example ? `<span class="spec">Shown: ${f.example}${d ? `, ${esc(d.name.toLowerCase())}` : ''}</span>` : ''}</span></li>`;
      })
      .join('')}</ul>
  </div>${foot(4)}</section>`;

const flow = (page, n) => {
  const { family } = page;
  const total = family.ranges.reduce((k, r) => k + r.designs.length, 0);
  const band = page.band
    ? `<div class="band" id="f-${family.id}"><img class="band-art" src="band-${family.id}.jpg" alt="">${run('')}<div class="band-copy"><p class="kicker">${total} designs in ${family.ranges.length} ranges</p><h1>${esc(family.name)}</h1><p class="band-text">${esc(family.text)}</p><ul class="band-list">${family.ranges.map((r) => `<li><a href="#r-${r.id}"><span>${esc(r.title)}</span><span>${rangePage[r.id]}</span></a></li>`).join('')}</ul></div></div>`
    : run(family.name);
  const blocks = page.blocks.map((b) => (b.type === 'range' ? rangeHead(b.range, b.y) : b.type === 'cont' ? `<div class="blk cont" style="top:${b.y}mm">${esc(b.range.title)}, continued</div>` : row(b.range, b.designs, b.y))).join('');
  return `<section class="page flow">${band}${blocks}${foot(n)}</section>`;
};

const cover = () => `<section class="page cover"><img class="cover-art" src="cover.jpg" alt="">
  <div class="cover-top"><span class="logo">${markSvg()}<span><span class="logo-name">${esc(site.name)}</span><span class="logo-tag">${esc(site.tagline)}, Aligarh</span></span></span><span class="edition">Catalogue ${EDITION}</span></div>
  <div class="cover-title"><h1>Builders’ hardware in solid brass and iron</h1><p>Door handles, door fittings, locks, window fittings, cabinet hardware and hooks, made in our own factory in Aligarh since ${site.founded}.</p></div>
  <div class="cover-foot"><span><b>${designCount}</b> designs</span><span><b>${rangeCount}</b> ranges</span><span><b>${finishes.length}</b> finishes</span><span>ISO 9001</span><a href="${site.url}/">${WEB}</a></div>
</section>`;

const back = () => `<section class="page back">
  <div class="back-top"><span class="logo">${markSvg()}<span><span class="logo-name">${esc(site.name)}</span><span class="logo-tag">${esc(site.tagline)}, Aligarh</span></span></span></div>
  <div class="back-body">
    <h1>Send us your codes and quantities.</h1>
    <p class="back-lede">We reply with price, MOQ, packing and lead time. Samples on request.</p>
    <div class="back-grid">
      <dl class="back-contact">
        <div><dt>WhatsApp</dt><dd><a href="${site.contact.whatsapp}">${site.contact.whatsappNumber}</a></dd></div>
        <div><dt>Office</dt><dd><a href="${site.contact.officeHref}">${site.contact.office}</a></dd></div>
        <div><dt>Email</dt><dd><a href="mailto:${site.contact.email}">${site.contact.email}</a></dd></div>
        <div><dt>Website</dt><dd><a href="${site.url}/">${WEB}</a></dd></div>
        ${people.map((p) => `<div><dt>${esc(p.role)}</dt><dd>${esc(p.name)}, <a href="${p.phoneHref}">${p.phone}</a></dd></div>`).join('')}
        <div><dt>Factory and office</dt><dd>${esc(site.address.street)}<br>${esc(site.address.city)} ${site.address.postcode}, ${esc(site.address.region)}, ${esc(site.address.country)}<br><a href="${site.address.map}">Open in Google Maps</a></dd></div>
        <div><dt>Hours</dt><dd>${esc(site.hours)}</dd></div>
      </dl>
      <div class="codes">
        <a href="${site.contact.whatsapp}">${qr(site.contact.whatsapp)}<span>WhatsApp us</span></a>
        <a href="${site.url}/products/">${qr(`${site.url}/products/`)}<span>See every range online</span></a>
      </div>
    </div>
  </div>
  <p class="back-small">ISO 9001 certified · GSTIN ${site.gstin} · IEC ${site.iec}<br>© ${EDITION} ${esc(site.name)} (${esc(site.tagline)}). Sizes are nominal; please confirm details with your quote.</p>
</section>`;

const font = (file) => pathToFileURL(path.resolve('node_modules/@fontsource-variable/archivo/files', file)).href;
const css = await readFile(new URL('./catalogue-pdf.css', import.meta.url), 'utf8');
const vars = `:root{--side:${SIDE}mm;--tile-w:${TILE_W}mm;--tile-h:${TILE_H}mm;--caption:${CAPTION}mm;--row-h:${ROW_H}mm;--col-gap:${COL_GAP}mm;--range-head:${RANGE_HEAD}mm;--cont-head:${CONT_HEAD}mm;--band-h:${BAND_H}mm;${Object.entries(C)
  .map(([k, v]) => `--${k.replace(/[A-Z]/g, (ch) => `-${ch.toLowerCase()}`)}:${v};`)
  .join('')}}`;
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(site.name)} catalogue ${EDITION}</title>
<style>
@font-face{font-family:'Archivo';font-style:normal;font-display:block;font-weight:100 900;font-stretch:62% 125%;src:url(${font('archivo-latin-wdth-normal.woff2')}) format('woff2-variations');unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}
@font-face{font-family:'Archivo';font-style:normal;font-display:block;font-weight:100 900;font-stretch:62% 125%;src:url(${font('archivo-latin-ext-wdth-normal.woff2')}) format('woff2-variations');unicode-range:U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF}
${vars}
${css}
</style></head><body>
${pages
  .map((p, i) => {
    if (p.kind === 'cover') return cover();
    if (p.kind === 'about') return about();
    if (p.kind === 'contents') return contents();
    if (p.kind === 'finishes') return finishPage();
    if (p.kind === 'back') return back();
    return flow(p, i + 1);
  })
  .join('\n')}
</body></html>`;
const htmlFile = path.join(TMP, 'catalogue.html');
await writeFile(htmlFile, html);

// ---------- Print ----------

const launch = async () => {
  for (const channel of ['msedge', 'chrome']) {
    try {
      return await chromium.launch({ channel });
    } catch {}
  }
  throw new Error('Needs Microsoft Edge or Google Chrome installed to print the catalogue.');
};
const browser = await launch();
const tab = await browser.newPage();
await tab.goto(pathToFileURL(htmlFile).href, { waitUntil: 'load' });
await tab.evaluate(async () => {
  await document.fonts.ready;
  await Promise.all([...document.images].map((img) => img.decode().catch(() => {})));
});
// Anything clipped: captions longer than their lines, single-line labels wider than their box, or a page that grew.
const problems = await tab.evaluate(() => {
  const out = [];
  for (const el of document.querySelectorAll('.name, .spec, .band-text, .sheet-body, .back-body, .toc')) if (el.scrollHeight > el.clientHeight + 1) out.push(`clipped ${el.className}: ${el.textContent.slice(0, 60)}`);
  for (const el of document.querySelectorAll('.range-head h2, .meta, .code, .cont, .toc-row')) if (el.scrollWidth > el.clientWidth + 1) out.push(`too wide ${el.className || el.tagName}: ${el.textContent.slice(0, 60)}`);
  for (const img of document.images) if (!img.naturalWidth) out.push(`missing image ${img.getAttribute('src')}`);
  for (const p of document.querySelectorAll('.page')) if (Math.round(p.getBoundingClientRect().height) !== Math.round((297 * 96) / 25.4)) out.push('page height changed');
  return out;
});
await mkdir(path.dirname(OUT_PDF), { recursive: true });
await tab.pdf({ path: OUT_PDF, preferCSSPageSize: true, printBackground: true, tagged: true, outline: true });
await browser.close();

const { size } = await stat(OUT_PDF);
await writeFile(OUT_JSON, `${JSON.stringify({ edition: EDITION, pages: pages.length, bytes: size, families: familyPage, ranges: rangePage }, null, 2)}\n`);
console.log(`${OUT_PDF}: ${pages.length} pages, ${(size / 1e6).toFixed(1)} MB`);
if (problems.length) {
  console.log(`${problems.length} layout problems:\n  ${problems.slice(0, 20).join('\n  ')}`);
  process.exitCode = 1;
}
