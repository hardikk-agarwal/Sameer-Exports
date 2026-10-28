// Builds src/data/catalogue.json from the 2026 catalogue (lilkunal.github.io/sameerexports, the source of
// catalogue/Sameer-Exports-Catalogue.pdf): families, ranges, catalogue page numbers, and one photographed
// piece per range picked by image quality. Product pages, thumbnails and analysis are cached in catalogue/site/.
// Usage: node scripts/catalogue-sync.mjs [--refresh]
import sharp from 'sharp';
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import path from 'node:path';

const BASE = 'https://lilkunal.github.io/sameerexports/';
const SITE = path.resolve('catalogue/site');
const refresh = process.argv.includes('--refresh');
const exists = (f) => access(f).then(() => true, () => false);

// Families group the catalogue's 12 sections; `pdf` is the section's first page in the PDF.
const FAMILIES = [
  {
    id: 'brass',
    name: 'Brass hardware',
    groups: ['Brass Hardware'],
    text: 'Solid brass for doors, windows and furniture: lever handles, latches, knockers, bolts, casement stays and fasteners, knobs, pulls, hooks and hinges.',
  },
  {
    id: 'iron',
    name: 'Iron hardware',
    groups: ['Iron Hardware'],
    text: 'Forged and cast iron for doors, gates, windows and cabinets, from lever handles and knockers to hinges, latches, pulls and pulleys.',
  },
  {
    id: 'wood-bone-aluminium',
    name: 'Wood, bone and aluminium',
    groups: ['Wooden & Bone Hardware', 'Aluminium Hardware'],
    text: 'Wooden handles and knobs, bone cabinet knobs, and aluminium handles and accessories.',
  },
  {
    id: 'art-ware',
    name: 'Art ware, garden and saddlery',
    groups: ['Lanterns', 'Fire Sets', 'Candle Stands', 'Bar Accessories', 'Coasters & Vases', 'Fancy Boxes', 'Garden Tools', 'Saddlery Fittings'],
    text: 'Lanterns, fire sets, candle stands, bar accessories, coasters, vases and boxes, plus garden tools and saddlery fittings.',
  },
];
// Ranges on the home page rail, in order.
const GALLERY = [
  'Brass Door Knockers', 'Brass Lever Handles', 'Brass Cabinet Knobs', 'Brass Rose Latches', 'Brass Drawer Pulls', 'Brass Hooks',
  'Brass Letter Plates', 'Brass Casement Fasteners', 'Brass Door Stoppers', 'Hand Forged Entrance Door Handles', 'Iron Hinges',
  'Wooden Door Knobs', 'Bone Cabinet Knobs', 'Lanterns',
];
const FINISHES = [
  ['BPL', 'Brass polished lacquered'], ['GPL', 'Gold polished lacquered'], ['AB', 'Antique brass'], ['FB', 'Florentine bronze'],
  ['CP', 'Chrome plated'], ['SCP', 'Satin chrome plated'], ['BSC', 'Black satin chrome'], ['EPNS', 'Electro plated nickel silver'],
  ['ORB', 'Oil rubbed bronze'], ['PC', 'Powder coated'], ['PCT', 'Powder coated textured'], ['HDP', 'Hot dip galvanised'],
  ['ZP', 'Zinc plated'], ['A', 'Anodized'],
];

const slug = (s) => s.toLowerCase().replace(/&/g, ' ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const sentence = (s) => s.charAt(0) + s.slice(1).toLowerCase();
// Display names: the catalogue's own words, with its typos and run-together words fixed.
const PROPER = /^(georgian|victorian|edwardian|regency|euro|suffolk|norfolk|medusa|trinity|gravity|tudor|gothic|celtic|bulldog)$/i;
const clean = (name) =>
  sentence(
    name
      .replace(/\bLatche\b/gi, 'Latch')
      .replace(/\b(Lanterm|Lantem|Lanten)\b/gi, 'Lantern')
      .replace(/\bHarican\b/gi, 'Hurricane')
      .replace(/\bDoule\b/gi, 'Double')
      .replace(/\bCleet\b/gi, 'Cleat')
      .replace(/\bCenrte\b/gi, 'Centre')
      .replace(/\bComer\b/gi, 'Corner')
      .replace(/\bTum\b/gi, 'Turn')
      .replace(/\bPulll\b/gi, 'Pull')
      .replace(/\bBoxe\b/gi, 'Box')
      .replace(/\bironwheel\b/gi, 'iron wheel')
      .replace(/\bLeveron\b/gi, 'Lever on')
      .replace(/\bCylender\b/gi, 'Cylinder')
      .replace(/\bNews Paper\b/gi, 'Newspaper')
      .replace(/\bBrassbell\b/gi, 'Brass bell')
      .replace(/\bFlorantine\b/gi, 'Florentine')
      .replace(/\s*Wt\..*$/i, '')
      .replace(/\s*\(\s*PS\s*\)|\s*（\s*PS\s*）/gi, '')
      .replace(/\s*&\s*/g, ' and ')
      .replace(/-/g, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
  )
    .split(' ')
    .map((w) => (PROPER.test(w) ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(' ');
// Finish labels as printed, with spelling fixed; abbreviations (S/Gold, BCP) stay as they are.
const FINISH_FIX = {
  florantine: 'Florentine bronze', 'florantine bronze': 'Florentine bronze', 'power coated': 'Powder coated', 'nickle plated': 'Nickel plated',
  galvanized: 'Galvanised', 'hot dip': 'Hot dip galvanised', 'hot dip galvanized': 'Hot dip galvanised', 'e.p.n.s.': 'EPNS',
  'brass-plated': 'Brass plated', 'silver gold': 'Silver/Gold', 'bpl&pc': 'BPL and PC', 'bpl,bcp.': 'BPL and BCP', 'ss&brass': 'Stainless steel and brass',
};
const finishName = (f = '') => {
  const t = f.trim();
  if (!t) return '';
  return FINISH_FIX[t.toLowerCase()] ?? (/[A-Z]{2,}|\//.test(t) ? t : t.charAt(0).toUpperCase() + t.slice(1).toLowerCase());
};
// Sizes as printed, spaced consistently: "240mm×45mm" -> "240mm × 45mm", "Rose52mm0" -> "Rose 52mm" (the 0 stands in for a diameter sign).
const sizeText = (s = '') =>
  s
    .replace(/，/g, ', ')
    .replace(/mm0\b/g, 'mm')
    .replace(/\bCto C/g, 'C to C')
    .replace(/\s*[×xX]\s*(?=\d)/g, ' × ')
    .replace(/([a-z])(\d)/gi, '$1 $2')
    .replace(/,(?=\S)/g, ', ')
    .replace(/\s+/g, ' ')
    .trim();

// 1. Product list and details.
await mkdir(path.join(SITE, 't'), { recursive: true });
const searchFile = path.join(SITE, 'search.json');
if (refresh || !(await exists(searchFile))) await writeFile(searchFile, Buffer.from(await (await fetch(BASE + 'search.json')).arrayBuffer()));
const list = JSON.parse(await readFile(searchFile, 'utf8'));
const productsFile = path.join(SITE, 'products.json');
if (refresh || !(await exists(productsFile))) throw new Error('Run catalogue/fetch-products.mjs first (writes catalogue/site/products.json).');
const details = JSON.parse(await readFile(productsFile, 'utf8'));

// 2. Thumbnails (330 x 420 max) for scoring.
const todo = list.map(([code]) => code);
await Promise.all(
  Array.from({ length: 8 }, async () => {
    while (todo.length) {
      const code = todo.shift();
      const file = path.join(SITE, 't', `${code}.jpg`);
      if (!refresh && (await exists(file))) continue;
      const res = await fetch(`${BASE}img/t/${code}.jpg`);
      if (res.ok) await writeFile(file, Buffer.from(await res.arrayBuffer()));
    }
  }),
);

// 3. Score every thumbnail: clean white backdrop, sharpness, silhouette, separate parts, likeness to an old-site photo.
const lum = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
async function silhouette(file, inset = 0) {
  const m = await sharp(file).metadata();
  const { data, info } = await sharp(file)
    .extract({ left: inset, top: inset, width: m.width - inset * 2, height: m.height - inset * 2 })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  const ring = [];
  for (let x = 0; x < W; x += 2) for (const y of [0, 1, H - 2, H - 1]) ring.push((y * W + x) * 3);
  for (let y = 0; y < H; y += 2) for (const x of [0, 1, W - 2, W - 1]) ring.push((y * W + x) * 3);
  const med = [0, 1, 2].map((k) => ring.map((i) => data[i + k]).sort((a, b) => a - b)[ring.length >> 1]);
  const ringDev = Math.sqrt(ring.reduce((s, i) => s + (data[i] - med[0]) ** 2 + (data[i + 1] - med[1]) ** 2 + (data[i + 2] - med[2]) ** 2, 0) / ring.length);
  const mask = new Uint8Array(W * H);
  let minx = W, maxx = -1, miny = H, maxy = -1;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 3;
      if (Math.abs(data[i] - med[0]) + Math.abs(data[i + 1] - med[1]) + Math.abs(data[i + 2] - med[2]) > 40) {
        mask[y * W + x] = 1;
        if (x < minx) minx = x;
        if (x > maxx) maxx = x;
        if (y < miny) miny = y;
        if (y > maxy) maxy = y;
      }
    }
  return { data, W, H, mask, ringDev, box: [minx, miny, maxx, maxy] };
}
function metrics(s) {
  const { data, W, H, mask, box } = s;
  let n = 0, lapSum = 0, lapSq = 0, lapN = 0, hx = 0, hy = 0, sat = 0, light = 0;
  for (let i = 0; i < W * H; i++) {
    if (!mask[i]) continue;
    n++;
    const r = data[i * 3] / 255, g = data[i * 3 + 1] / 255, b = data[i * 3 + 2] / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    let h = 0;
    if (mx !== mn) {
      if (mx === r) h = ((g - b) / (mx - mn)) * 60;
      else if (mx === g) h = (2 + (b - r) / (mx - mn)) * 60;
      else h = (4 + (r - g) / (mx - mn)) * 60;
    }
    const sv = mx ? (mx - mn) / mx : 0;
    hx += Math.cos((h * Math.PI) / 180) * sv;
    hy += Math.sin((h * Math.PI) / 180) * sv;
    sat += sv;
    light += lum(r, g, b);
  }
  for (let y = 1; y < H - 1; y++)
    for (let x = 1; x < W - 1; x++) {
      if (!mask[y * W + x]) continue;
      const L = (xx, yy) => {
        const i = (yy * W + xx) * 3;
        return lum(data[i], data[i + 1], data[i + 2]);
      };
      const l = 4 * L(x, y) - L(x - 1, y) - L(x + 1, y) - L(x, y - 1) - L(x, y + 1);
      lapSum += l;
      lapSq += l * l;
      lapN++;
    }
  // Separate parts larger than 2% of the silhouette.
  const seen = new Uint8Array(W * H);
  let parts = 0;
  for (let i = 0; i < W * H; i++) {
    if (!mask[i] || seen[i]) continue;
    const st = [i];
    seen[i] = 1;
    let size = 0;
    while (st.length) {
      const j = st.pop();
      size++;
      const x = j % W, y = (j - x) / W;
      for (const k of [x > 0 ? j - 1 : -1, x < W - 1 ? j + 1 : -1, y > 0 ? j - W : -1, y < H - 1 ? j + W : -1]) if (k >= 0 && mask[k] && !seen[k]) (seen[k] = 1), st.push(k);
    }
    if (size > n * 0.02) parts++;
  }
  return {
    v: 2,
    fill: n / (W * H),
    sharp: lapN ? lapSq / lapN - (lapSum / lapN) ** 2 : 0,
    parts,
    aspect: (box[2] - box[0] + 1) / (box[3] - box[1] + 1),
    hue: n ? (((Math.atan2(hy, hx) * 180) / Math.PI + 360) % 360) : 0,
    sat: n ? sat / n : 0,
    light: n ? light / n : 0,
  };
}

const analysisFile = path.join(SITE, 'analysis.json');
let analysis = !refresh && (await exists(analysisFile)) ? JSON.parse(await readFile(analysisFile, 'utf8')) : {};
// Grey-level likeness to the closest old-website photo (catalogue/likeness.mjs old); 0.93+ would be the same photo.
const oldLike = (await exists(path.join(SITE, 'old-likeness.json'))) ? JSON.parse(await readFile(path.join(SITE, 'old-likeness.json'), 'utf8')) : {};
for (const [code] of list) {
  if (analysis[code]?.v === 2) continue;
  const s = await silhouette(path.join(SITE, 't', `${code}.jpg`));
  analysis[code] = { ...metrics(s), ringDev: s.ringDev, w: s.W, h: s.H };
}
for (const [code] of list) analysis[code].old = oldLike[code]?.r ?? 0;
await writeFile(analysisFile, JSON.stringify(analysis));

// 4. Families and ranges in catalogue order. A range's page is the first product page whose header names it.
const text = await readFile('catalogue/catalogue-text.txt', 'utf8');
const pageHeads = [...text.matchAll(/=== page (\d+) [^\n]*\n(?:[^\n]*\n){0,2}?\s*46: ([^\n]*)/g)].map((m) => ({ page: +m[1], head: m[2].replace(/ \| /g, ' ') }));
const pageOf = (name) => pageHeads.find((p) => p.head.startsWith(`${name} `) && /\d+ designs/.test(p.head))?.page ?? null;
const sectionOf = (group) => {
  const m = text.match(new RegExp(`=== page (\\d+) [^\\n]*\\n(?:[^\\n]*\\n){1,3}?\\s*234: ${group.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\n`));
  return m ? +m[1] : null;
};
const rangeOrder = [];
const byRange = new Map();
for (const [code, name, range] of list) {
  if (!byRange.has(range)) byRange.set(range, []), rangeOrder.push(range);
  byRange.get(range).push(code);
}
const groupOf = (range) => details[byRange.get(range)[0]].group;

const STOP = new Set(['brass', 'iron', 'wooden', 'bone', 'aluminium', 'cast', 'hand', 'forged', 'and', '&', 'the', 'side', 'light']);
const singular = (w) => w.replace(/(es|s)$/, '').replace(/ie$/, 'y');
const score = (code, family, range) => {
  const a = analysis[code];
  const d = details[code];
  if (a.ringDev > 8 || a.old >= 0.93) return -Infinity;
  // A grey, nearly full-frame shot is a photo on a surface padded with white, not a piece on white.
  if (a.fill > 0.85 && a.sat < 0.15 && a.light > 0.55) return -Infinity;
  let s = Math.log10(a.sharp + 10);
  s += a.aspect >= 0.45 && a.aspect <= 2.4 ? 0.5 : a.aspect > 4 || a.aspect < 0.2 ? -1 : a.aspect > 3.2 || a.aspect < 0.3 ? -0.3 : 0;
  s += a.parts === 1 ? 0.4 : a.parts === 2 ? 0.15 : a.parts >= 4 ? -0.6 : 0;
  if (family === 'brass') s += (/polished lacquer|gold|antique brass|^brass$/i.test(d.finish) ? 0.6 : 0) + (a.hue >= 30 && a.hue <= 55 && a.sat >= 0.4 && a.light >= 0.4 ? 0.8 : 0);
  if (family === 'iron') s += /powder|black/i.test(d.finish) ? 0.2 : 0;
  if (range) {
    // The piece should be what the range is called: a pulley for pulleys, a vase for vases.
    const keys = range.toLowerCase().split(/[^a-z]+/).filter((w) => w && !STOP.has(w)).map(singular);
    const words = d.name.toLowerCase().split(/[^a-z]+/).map(singular);
    const hits = keys.filter((k) => words.some((w) => w.startsWith(k) || k.startsWith(w) && w.length > 3)).length;
    s += hits ? 0.6 + 0.3 * (hits / keys.length) : -0.3;
    if (/^wooden/i.test(range)) s += (a.hue >= 10 && a.hue <= 55 && a.sat >= 0.2 && a.sat <= 0.6 && a.light < 0.7 ? 0.5 : -0.8) + (/wood/i.test(d.name) ? 0.5 : 0);
    if (/^bone/i.test(range)) s += a.light > 0.6 && a.sat < 0.35 ? 0.4 : 0;
  }
  s -= Math.max(0, a.old - 0.8) * 4;
  return s;
};

const families = FAMILIES.map((f) => ({
  id: f.id,
  name: f.name,
  text: f.text,
  page: Math.min(...f.groups.map((g) => sectionOf(g)).filter(Boolean)),
  ranges: rangeOrder
    .filter((r) => f.groups.includes(groupOf(r)))
    .map((r) => {
      const codes = byRange.get(r);
      const ranked = [...codes].sort((a, b) => score(b, f.id, r) - score(a, f.id, r));
      const short = f.id === 'brass' ? r.replace(/^Brass /, '') : f.id === 'iron' ? r.replace(/^Iron /, '') : r;
      return { id: slug(r), name: sentence(short).replace(/&/g, 'and'), title: sentence(r).replace(/&/g, 'and'), full: r, count: codes.length, page: pageOf(r), image: ranked[0], alt: ranked[1] };
    }),
}));

// 5. One photographed example per finish code, preferring door and cabinet hardware so the pieces compare well.
const FINISH_MATCH = {
  BPL: /^brass polished lacquered$/i, GPL: /gold polished/i, AB: /^antique brass$/i, FB: /florantine bronze|florentine bronze/i,
  CP: /^chrome plated$/i, SCP: /^satin chrome plated$/i, BSC: /black satin chrome/i, EPNS: /e\.?p\.?n\.?s/i,
  ORB: /oil rubbed bronze/i, PC: /^powder coated$/i, PCT: /powder coated textured/i, HDP: /hot dip|galvani[sz]ed/i,
  ZP: /zinc plated/i, A: /anodized/i,
};
const PREFERRED = /lever|knob|rose|pull|handle|knocker|hook|latch/i;
// The photo has to look like its finish label (the catalogue sometimes reuses one photo for several finishes).
const LOOKS = {
  BPL: (a) => a.hue >= 30 && a.hue <= 55 && a.sat >= 0.4, GPL: (a) => a.hue >= 25 && a.hue <= 55 && a.sat >= 0.35,
  AB: (a) => a.hue >= 15 && a.hue <= 50 && a.sat >= 0.25, FB: (a) => a.light < 0.45, ORB: (a) => a.light < 0.45,
  CP: (a) => a.sat < 0.15, SCP: (a) => a.sat < 0.15, BSC: (a) => a.sat < 0.15 && a.light < 0.55, EPNS: (a) => a.sat < 0.15,
  PC: (a) => a.light < 0.35 && a.sat < 0.2, PCT: (a) => a.light < 0.35 && a.sat < 0.2, HDP: (a) => a.sat < 0.15,
  ZP: (a) => a.sat < 0.15, A: (a) => a.sat < 0.15,
};
const finishExamples = FINISHES.map(([code]) => {
  const ranked = Object.values(details)
    .filter((d) => FINISH_MATCH[code].test(d.finish ?? ''))
    .map((d) => ({ d, s: score(d.code, slug(d.group).startsWith('brass') ? 'brass' : 'other') + (PREFERRED.test(d.name) ? 0.5 : 0) + (LOOKS[code](analysis[d.code]) ? 2 : 0) }))
    .filter((x) => x.s > -Infinity)
    .sort((a, b) => b.s - a.s);
  return { finish: code, code: ranked[0]?.d.code ?? null };
});

// 6. Write the data the site reads.
const allRanges = families.flatMap((f) => f.ranges);
const rangeId = (name) => slug(name);
const gallery = GALLERY.map((r) => allRanges.find((x) => x.full === r)?.image).filter(Boolean);
const images = [...new Set([...allRanges.map((r) => r.image), ...gallery, ...finishExamples.map((f) => f.code).filter(Boolean)])];
const products = Object.fromEntries(
  images.map((c) => {
    const d = details[c];
    return [c, { name: clean(d.name), range: rangeId(d.range), size: d.size, finish: d.finish }];
  }),
);
// Every design in catalogue order, for the range pages.
for (const r of allRanges) {
  r.designs = byRange.get(r.full).map((c) => ({ code: c, name: clean(details[c].name), size: sizeText(details[c].size), finish: finishName(details[c].finish) }));
}
const out = {
  source: 'Sameer Exports catalogue 2026 (catalogue/Sameer-Exports-Catalogue.pdf)',
  designs: list.length,
  ranges: allRanges.length,
  finishes: FINISHES.map(([code, name]) => ({ code, name, example: finishExamples.find((f) => f.finish === code)?.code ?? null })),
  families,
  gallery,
  products,
};
await writeFile('src/data/catalogue.json', JSON.stringify(out, null, 1));
console.log(`families ${families.map((f) => `${f.id}:${f.ranges.length}/${f.ranges.reduce((n, r) => n + r.count, 0)}@p${f.page}`).join(' ')}`);
console.log(`ranges without page: ${allRanges.filter((r) => !r.page).map((r) => r.full).join(', ') || 'none'}`);
console.log(`finish examples: ${finishExamples.map((f) => `${f.finish}=${f.code ?? '-'}`).join(' ')}`);
console.log(`images ${images.length}; old-site lookalikes (0.93+): ${Object.values(analysis).filter((a) => a.old >= 0.93).length}`);
