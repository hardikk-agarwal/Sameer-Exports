// Builds the site's image set: product cut-outs from the 2026 catalogue photos + licensed photographs.
// Separates the white backdrop (flood fill + colour-to-alpha on the edge band), keeps polish highlights,
// removes JPEG specks, then writes a tight transparent cut-out at most 640px on its long side.
// Usage: npm run images (after node scripts/catalogue-sync.mjs has written src/data/catalogue.json)
import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, access, rm } from 'node:fs/promises';
import path from 'node:path';

const CATALOGUE = JSON.parse(await readFile('src/data/catalogue.json', 'utf8'));
const CUTOUTS = Object.keys(CATALOGUE.products);
const PHOTO_BASE = 'https://lilkunal.github.io/sameerexports/img/p/';
// Unsplash License photographs (free for commercial use). Stand-ins until the factory's own shoot; credits in README.
// `hue` nudges a single photo's brass toward yellow; every photo then gets the same mild warm, muted grade.
// `crop` trims a fraction off the left/right edge before resizing.
const PHOTOS = [
  { name: 'teal-door', id: 'photo-1779372364693-be90d5915ccc', credit: 'Jonathan Borba', widths: [800, 1200, 1600] },
  { name: 'window-handle', id: 'photo-1730718934488-2857906d23d2', credit: 'Okna Milano', widths: [800, 1200, 1600] },
  { name: 'cabinet-knob', id: 'photo-1595418312726-3beb2f4fe67e', credit: 'Nicola Bushuven', widths: [800, 1100, 1440], crop: { left: 0.23, right: 0.17 } },
  { name: 'lever', id: 'photo-1607710533910-d7cdffd9e593', credit: 'Sneaky Head', widths: [700, 1200, 1800], hue: 8 },
  { name: 'iron-knocker', id: 'photo-1773057335672-a470bf8e2adc', credit: 'Fumiaki Hayashi', widths: [700, 1200, 1800] },
  { name: 'caliper', id: 'photo-1758873263563-5ba4aa330799', credit: 'Hans Westbeek', widths: [800, 1400, 2200] },
  { name: 'artisan', id: 'photo-1778077128762-594e292467a2', credit: 'Hasan Mrad', widths: [700, 1200, 1800], crop: { left: 0.2 } },
  { name: 'backplate', id: 'photo-1702573848674-1ebc487abe87', credit: 'Kateryna Hliznitsova', widths: [600, 1000, 1500] },
  { name: 'moulds', id: 'photo-1751979362679-8687eb4d9301', credit: 'Joseph Grieveson', widths: [600, 1000, 1500] },
  { name: 'crucible', id: 'photo-1683183004672-e9feaf0bf718', credit: 'Enlightening Images', widths: [800, 1400, 2200] },
  { name: 'lock', id: 'photo-1631083354486-01e4f4a7d1d5', credit: 'rhoda alex', widths: [600, 1000, 1500] },
  { name: 'old-door', id: 'photo-1569478675936-6fc5997f2519', credit: 'Roger Bradshaw', widths: [800, 1400, 2200] },
  { name: 'turned-wood', id: 'photo-1788296827388-567d5b582406', credit: 'HENG YIN', widths: [700, 1200, 1800] },
  { name: 'lanterns', id: 'photo-1760727467204-981086f6adfc', credit: 'mathieu gauzy', widths: [700, 1200, 1800] },
];
// Portraits supplied by the company. Their plain backdrops differ (white, red), so each gets the same warm grey.
// `despill` takes a red backdrop's cast out of dark hair near the top of the frame.
// `print` is for a photographed print on white, whose backdrop is as light as a white shirt: the fill is strict and stops at
// the shirt's faint outline, dust becomes backdrop and the grain is smoothed. `trim` cuts the print's edges off (px);
// `tone` (per-channel gamma, then contrast) takes out a faded print's magenta cast. `sharpen` is a sigma.
// `soft` is for a mottled studio backdrop that no fill can follow, behind grey hair as light as it: nothing is cut out;
// each pixel moves toward the new backdrop by how close its colour is to the old one, and skin, the suit and the eyes stay.
const PEOPLE = [
  { name: 'sanjeev-agarwal', src: 'Logo/Sanjeev-new.jpeg', print: true, trim: { left: 2, top: 2, right: 6, bottom: 24 }, tone: { gamma: [1, 0.94, 1.1], contrast: 1.07 }, sharpen: 0.8 },
  { name: 'sarthak-agarwal', src: 'Logo/Sarthak.jpeg' },
  { name: 'sp-agarwal', src: 'Logo/Surya Prakash Agarwal.jpeg', soft: true, sharpen: 0.6 },
  { name: 'hardik-agarwal', src: 'Logo/Hardik Agarwal.jpeg' },
];
const PEOPLE_WIDTHS = [160, 360, 720];
const BACKDROP_IN = [228, 224, 217];
const BACKDROP_OUT = [203, 198, 190];
const SRC = path.resolve('catalogue/site/p');
const OUT = path.resolve('public/img');
const META = path.resolve('src/data/image-meta.json');
const BG_MIN = 232; // a pixel is backdrop-like when every channel is at least this bright
const BG_SPREAD = 28; // ...and it is nearly neutral (max - min channel)
const BAND = 2; // px of soft edge to un-mix from white
const SPECK = 60; // px; smaller isolated islands are JPEG noise
const HOLE = 400; // px; enclosed white areas at least this big may be see-through openings
const EDGE_DARK = 205; // an opening is ringed by the piece's darker edge; a polish highlight fades into bright metal
const LONG_SIDE = 520;
const SMALL_SIDE = 280; // range tiles and the rail on 1x screens

await rm(OUT, { recursive: true, force: true });
await mkdir(path.join(OUT, 'p'), { recursive: true });
await mkdir(SRC, { recursive: true });

function matte(data, w, h, holes, report) {
  const n = w * h;
  const isBgLike = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const r = data[i * 3], g = data[i * 3 + 1], b = data[i * 3 + 2];
    const mn = Math.min(r, g, b), mx = Math.max(r, g, b);
    isBgLike[i] = mn >= BG_MIN && mx - mn <= BG_SPREAD ? 1 : 0;
  }
  // Backdrop = backdrop-like pixels connected to the border.
  const bg = new Uint8Array(n);
  const stack = [];
  const seed = (i) => {
    if (isBgLike[i] && !bg[i]) {
      bg[i] = 1;
      stack.push(i);
    }
  };
  for (let x = 0; x < w; x++) seed(x), seed((h - 1) * w + x);
  for (let y = 0; y < h; y++) seed(y * w), seed(y * w + w - 1);
  while (stack.length) {
    const i = stack.pop();
    const x = i % w, y = (i - x) / w;
    if (x > 0) seed(i - 1);
    if (x < w - 1) seed(i + 1);
    if (y > 0) seed(i - w);
    if (y < h - 1) seed(i + w);
  }
  // Enclosed near-white areas: a see-through opening (inside a ring, a letter-plate slot) is ringed by the
  // piece's darker edge, while a polish highlight fades into bright metal and stays opaque.
  const visited = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    if (!isBgLike[i] || bg[i] || visited[i]) continue;
    const comp = [i];
    visited[i] = 1;
    let sum = 0;
    for (let k = 0; k < comp.length; k++) {
      const j = comp[k], x = j % w, y = (j - x) / w;
      sum += Math.min(data[j * 3], data[j * 3 + 1], data[j * 3 + 2]);
      for (const m of [x > 0 ? j - 1 : -1, x < w - 1 ? j + 1 : -1, y > 0 ? j - w : -1, y < h - 1 ? j + w : -1])
        if (m >= 0 && isBgLike[m] && !visited[m] && !bg[m]) (visited[m] = 1), comp.push(m);
    }
    if (!holes || comp.length < HOLE || sum / comp.length < 246) continue;
    let ring = 0, ringN = 0;
    for (const j of comp) {
      const x = j % w, y = (j - x) / w;
      for (const m of [x > 1 ? j - 2 : -1, x < w - 2 ? j + 2 : -1, y > 1 ? j - 2 * w : -1, y < h - 2 ? j + 2 * w : -1])
        if (m >= 0 && !isBgLike[m]) (ring += 0.2126 * data[m * 3] + 0.7152 * data[m * 3 + 1] + 0.0722 * data[m * 3 + 2]), ringN++;
    }
    if (ringN && ring / ringN < EDGE_DARK) {
      for (const j of comp) bg[j] = 1;
      report.push(comp.length);
    }
  }
  // Distance (in steps) from the backdrop, capped at BAND + 1.
  const dist = new Uint8Array(n).fill(255);
  let frontier = [];
  for (let i = 0; i < n; i++) if (bg[i]) (dist[i] = 0), frontier.push(i);
  for (let d = 1; d <= BAND && frontier.length; d++) {
    const next = [];
    for (const i of frontier) {
      const x = i % w, y = (i - x) / w;
      for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1])
        if (j >= 0 && dist[j] === 255) (dist[j] = d), next.push(j);
    }
    frontier = next;
  }
  const rgba = Buffer.alloc(n * 4);
  for (let i = 0; i < n; i++) {
    let r = data[i * 3], g = data[i * 3 + 1], b = data[i * 3 + 2], a = 255;
    if (dist[i] === 0) a = 0;
    else if (dist[i] <= BAND) {
      const alpha = Math.max(255 - r, 255 - g, 255 - b) / 255;
      if (alpha < 0.02) a = 0;
      else {
        r = Math.round((r - 255 * (1 - alpha)) / alpha);
        g = Math.round((g - 255 * (1 - alpha)) / alpha);
        b = Math.round((b - 255 * (1 - alpha)) / alpha);
        a = Math.round(alpha * 255);
      }
    }
    rgba[i * 4] = r, rgba[i * 4 + 1] = g, rgba[i * 4 + 2] = b, rgba[i * 4 + 3] = a;
  }
  // Drop tiny islands (JPEG noise) that survived the flood fill.
  const seen = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    if (seen[i] || rgba[i * 4 + 3] < 128) continue;
    const comp = [i];
    seen[i] = 1;
    for (let k = 0; k < comp.length; k++) {
      const j = comp[k], x = j % w, y = (j - x) / w;
      for (const m of [x > 0 ? j - 1 : -1, x < w - 1 ? j + 1 : -1, y > 0 ? j - w : -1, y < h - 1 ? j + w : -1])
        if (m >= 0 && !seen[m] && rgba[m * 4 + 3] >= 128) (seen[m] = 1), comp.push(m);
    }
    if (comp.length < SPECK) for (const j of comp) rgba[j * 4 + 3] = 0;
  }
  // Faint pixels with no solid neighbour are leftover haze.
  for (let i = 0; i < n; i++) if (rgba[i * 4 + 3] > 0 && rgba[i * 4 + 3] < 128 && !seen[i]) {
    const x = i % w, y = (i - x) / w;
    let solid = false;
    for (const m of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]) if (m >= 0 && rgba[m * 4 + 3] >= 128) solid = true;
    if (!solid) rgba[i * 4 + 3] = 0;
  }
  return rgba;
}

const meta = {};
const openings = [];
for (const code of CUTOUTS) {
  const file = path.join(SRC, `${code}.jpg`);
  try {
    await access(file);
  } catch {
    const res = await fetch(`${PHOTO_BASE}${code}.jpg`);
    if (!res.ok) throw new Error(`${code}: HTTP ${res.status}`);
    await writeFile(file, Buffer.from(await res.arrayBuffer()));
  }
  const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const report = [];
  const cut = await sharp(matte(data, info.width, info.height, true, report), { raw: { width: info.width, height: info.height, channels: 4 } })
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 10 })
    .png()
    .toBuffer({ resolveWithObject: true });
  const scale = Math.min(1, LONG_SIDE / Math.max(cut.info.width, cut.info.height));
  const w = Math.round(cut.info.width * scale), h = Math.round(cut.info.height * scale);
  await sharp(cut.data)
    .resize({ width: w, height: h, kernel: 'lanczos3' })
    .webp({ quality: 74, alphaQuality: 85, effort: 6 })
    .toFile(path.join(OUT, 'p', `${code.toLowerCase()}.webp`));
  const small = Math.min(1, SMALL_SIDE / Math.max(cut.info.width, cut.info.height));
  const sw = Math.round(cut.info.width * small), sh = Math.round(cut.info.height * small);
  await sharp(cut.data)
    .resize({ width: sw, height: sh, kernel: 'lanczos3' })
    .webp({ quality: 76, alphaQuality: 85, effort: 6 })
    .toFile(path.join(OUT, 'p', `${code.toLowerCase()}-s.webp`));
  meta[code] = { w, h, sw };
  if (report.length) openings.push(`${code} (${report.length})`);
}
if (openings.length) console.log(`see-through openings cut in: ${openings.join(', ')}`);

await mkdir(path.join(OUT, 'photo'), { recursive: true });
for (const photo of PHOTOS) {
  const cache = path.resolve('legacy/stock', `${photo.id}-2400.jpg`);
  try {
    await access(cache);
  } catch {
    await mkdir(path.dirname(cache), { recursive: true });
    const res = await fetch(`https://images.unsplash.com/${photo.id}?w=2400&q=86&fm=jpg`);
    if (!res.ok) throw new Error(`${photo.name}: HTTP ${res.status}`);
    await writeFile(cache, Buffer.from(await res.arrayBuffer()));
  }
  let source = cache;
  if (photo.crop) {
    const { width: w, height: h } = await sharp(cache).metadata();
    const left = Math.round(w * (photo.crop.left ?? 0));
    const right = Math.round(w * (photo.crop.right ?? 0));
    source = await sharp(cache).extract({ left, top: 0, width: w - left - right, height: h }).jpeg({ quality: 95 }).toBuffer();
  }
  let last;
  for (const width of photo.widths) {
    last = await sharp(source)
      .resize({ width, withoutEnlargement: true })
      .modulate({ saturation: 0.88, hue: photo.hue ?? 0 })
      .recomb([[1.02, 0, 0], [0, 1, 0], [0, 0, 0.96]])
      .linear(0.97, 4)
      .webp({ quality: 72, effort: 5 })
      .toFile(path.join(OUT, 'photo', `${photo.name}-${width}.webp`));
  }
  meta[`photo:${photo.name}`] = { w: last.width, h: last.height, widths: photo.widths, credit: photo.credit, id: photo.id };
}

// Replaces a plain studio backdrop: flood fill from the top and sides (colour close to the backdrop, or a smooth step
// from a backdrop neighbour), then un-mix a 3 px edge band from the local backdrop so hair keeps soft edges without a halo.
function rebackdrop(data, w, h, { despill = false, print = false } = {}) {
  const n = w * h;
  const px = (i) => [data[i * 3], data[i * 3 + 1], data[i * 3 + 2]];
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const strip = [];
  for (let y = 0; y < Math.max(2, Math.round(h * 0.04)); y++) for (let x = 0; x < w; x++) strip.push(px(y * w + x));
  const med = [0, 1, 2].map((k) => strip.map((c) => c[k]).sort((a, b) => a - b)[strip.length >> 1]);
  const bg = new Uint8Array(n);
  const stack = [];
  const flood = (enter) => {
    while (stack.length) {
      const i = stack.pop();
      const x = i % w, y = (i - x) / w;
      for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1])
        if (j >= 0 && !bg[j] && enter(j, i)) (bg[j] = 1), stack.push(j);
    }
  };
  if (print) {
    // Backdrop-like: close to the backdrop, or a light warm stain. A pixel is entered only when its 3x3 neighbourhood is
    // backdrop-like, so 1 px gaps in the shirt's faint outline do not let the fill into the white shirt.
    const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    const like = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      const c = px(i), d = dist(c, med);
      like[i] = d < 14 || (d < 45 && lum(c) > 200 && c[2] - c[0] < -6) ? 1 : 0;
    }
    const open = (i) => {
      const x = i % w, y = (i - x) / w;
      for (let Y = Math.max(0, y - 1); Y <= Math.min(h - 1, y + 1); Y++)
        for (let X = Math.max(0, x - 1); X <= Math.min(w - 1, x + 1); X++) if (!like[Y * w + X]) return false;
      return true;
    };
    const seed = (i) => {
      if (!bg[i] && open(i)) (bg[i] = 1), stack.push(i);
    };
    for (let x = 0; x < w; x++) seed(x);
    for (let y = 0; y < h * 0.5; y++) seed(y * w), seed(y * w + w - 1);
    flood(open);
    // Back over the 1 px the neighbourhood test held off.
    const rim = [];
    for (let i = 0; i < n; i++) {
      const x = i % w;
      if (!bg[i] && like[i] && ((x > 0 && bg[i - 1]) || (x < w - 1 && bg[i + 1]) || (i >= w && bg[i - w]) || (i < n - w && bg[i + w]))) rim.push(i);
    }
    for (const i of rim) bg[i] = 1;
    // Dust: small islands that do not reach the bottom edge become backdrop.
    const seen = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      if (bg[i] || seen[i]) continue;
      const comp = [i];
      let bottom = false;
      seen[i] = 1;
      for (let k = 0; k < comp.length; k++) {
        const j = comp[k], x = j % w;
        if (j >= n - w) bottom = true;
        for (const q of [x > 0 ? j - 1 : -1, x < w - 1 ? j + 1 : -1, j >= w ? j - w : -1, j < n - w ? j + w : -1])
          if (q >= 0 && !bg[q] && !seen[q]) (seen[q] = 1), comp.push(q);
      }
      if (!bottom && comp.length < 1500) for (const j of comp) bg[j] = 1;
    }
  } else {
    const spread = Math.sqrt(strip.reduce((s, c) => s + dist(c, med) ** 2, 0) / strip.length);
    const CORE = Math.max(24, spread * 4), GLOBAL = CORE + 40, STEP = 12;
    const seed = (i) => {
      if (!bg[i] && dist(px(i), med) < CORE) (bg[i] = 1), stack.push(i);
    };
    for (let x = 0; x < w; x++) seed(x);
    for (let y = 0; y < h * 0.6; y++) seed(y * w), seed(y * w + w - 1);
    flood((j, i) => {
      const d = dist(px(j), med);
      return d < CORE || (d < GLOBAL && dist(px(j), px(i)) < STEP);
    });
  }
  const band = new Uint8Array(n);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (bg[y * w + x]) continue;
      for (let dy = -3; dy <= 3 && !band[y * w + x]; dy++)
        for (let dx = -3; dx <= 3; dx++) {
          const X = x + dx, Y = y + dy;
          if (X >= 0 && Y >= 0 && X < w && Y < h && bg[Y * w + X]) {
            band[y * w + x] = 1;
            break;
          }
        }
    }
  const backdrop = backdropFor(w, h);
  const out = Buffer.alloc(n * 3);
  let headTop = -1;
  for (let y = 0; y < h; y++) {
    let subject = 0;
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      let o = px(i);
      if (bg[i]) o = backdrop(x, y);
      else {
        subject++;
        if (band[i]) {
          const B = [0, 0, 0], F = [0, 0, 0];
          let nb = 0, nf = 0;
          for (let dy = -4; dy <= 4; dy++)
            for (let dx = -4; dx <= 4; dx++) {
              const X = x + dx, Y = y + dy;
              if (X < 0 || Y < 0 || X >= w || Y >= h) continue;
              const j = Y * w + X, c = px(j);
              if (bg[j]) (B[0] += c[0]), (B[1] += c[1]), (B[2] += c[2]), nb++;
              else if (!band[j]) (F[0] += c[0]), (F[1] += c[1]), (F[2] += c[2]), nf++;
            }
          const Bl = nb ? B.map((v) => v / nb) : med;
          let a = Math.min(1, dist(o, Bl) / 120);
          if (nf) {
            const fb = F.map((v, k) => v / nf - Bl[k]);
            const den = fb.reduce((s, v) => s + v * v, 0);
            if (den > 1) a = Math.min(1, Math.max(0, o.reduce((s, v, k) => s + (v - Bl[k]) * fb[k], 0) / den));
          }
          const Bn = backdrop(x, y);
          if (print && nf) {
            // Keep only 30% of the pixel's own deviation, so the print's light rim round the hair does not survive.
            const Fm = F.map((v) => v / nf);
            o = o.map((v, k) => a * Fm[k] + (1 - a) * Bn[k] + 0.3 * (v - a * Fm[k] - (1 - a) * Bl[k]));
          } else o = o.map((v, k) => v + (1 - a) * (Bn[k] - Bl[k]));
        }
        if (despill && y < h * 0.36) {
          const luma = 0.2126 * o[0] + 0.7152 * o[1] + 0.0722 * o[2];
          const top = Math.max(o[1], o[2]);
          // Full strength down to a quarter of the frame, fading out by the eyes.
          const k = 0.65 * Math.min(1, (h * 0.36 - y) / (h * 0.11));
          if (luma < 100 && o[0] > top) o = [o[0] - (o[0] - top) * k, o[1], o[2]];
        }
      }
      for (let k = 0; k < 3; k++) out[i * 3 + k] = Math.max(0, Math.min(255, Math.round(o[k])));
    }
    if (headTop < 0 && subject > w * 0.04) headTop = y;
  }
  return { out, headTop: Math.max(0, headTop), backdrop };
}

// The new backdrop: warm grey, lighter behind the head.
function backdropFor(w, h) {
  return (x, y) => {
    const r = Math.min(1, Math.hypot((x / w - 0.5) * 1.1, y / h - 0.38) / 0.75);
    const t = r * r * (3 - 2 * r);
    return BACKDROP_IN.map((v, k) => v + (BACKDROP_OUT[k] - v) * t);
  };
}

function softBackdrop(data, w, h) {
  const px = (i) => [data[i * 3], data[i * 3 + 1], data[i * 3 + 2]];
  // The old backdrop's colour, from the sides and the top corners (the hair can reach the top in the middle).
  const ring = [];
  for (let y = 0; y < h * 0.6; y++)
    for (let x = 0; x < w; x++) if (x < w * 0.05 || x >= w * 0.95 || (y < h * 0.03 && (x < w * 0.3 || x >= w * 0.7))) ring.push(px(y * w + x));
  const med = [0, 1, 2].map((k) => ring.map((c) => c[k]).sort((a, b) => a - b)[ring.length >> 1]);
  const backdrop = backdropFor(w, h);
  const out = Buffer.alloc(w * h * 3);
  let headTop = -1;
  for (let y = 0; y < h; y++) {
    let subject = 0;
    for (let x = 0; x < w; x++) {
      const i = y * w + x, c = px(i);
      const d = Math.hypot(c[0] - med[0], c[1] - med[1], c[2] - med[2]);
      const lum = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
      let a = Math.min(1, Math.max(0, (45 - d) / 27));
      if (lum < 110 || c[2] - c[1] < -10) a = 0;
      a = a * a * (3 - 2 * a);
      if (a < 0.5) subject++;
      // Move to the new colour and keep 40% of the old backdrop's mottling, so it reads as a studio canvas.
      const t = backdrop(x, y);
      for (let k = 0; k < 3; k++) out[i * 3 + k] = Math.max(0, Math.min(255, Math.round(c[k] + a * (t[k] - med[k] - 0.6 * (c[k] - med[k])))));
    }
    if (headTop < 0 && subject > w * 0.04) headTop = y;
  }
  return { out, headTop: Math.max(0, headTop), backdrop };
}

await mkdir(path.join(OUT, 'people'), { recursive: true });
for (const person of PEOPLE) {
  let { data, info } = await sharp(path.resolve(person.src)).rotate().removeAlpha().raw().toBuffer({ resolveWithObject: true });
  if (person.trim) {
    const { left, top, right, bottom } = person.trim;
    ({ data, info } = await sharp(data, { raw: { width: info.width, height: info.height, channels: 3 } })
      .extract({ left, top, width: info.width - left - right, height: info.height - top - bottom })
      .raw()
      .toBuffer({ resolveWithObject: true }));
  }
  if (person.tone) {
    const { gamma, contrast } = person.tone;
    const lut = gamma.map((g) => Uint8Array.from({ length: 256 }, (_, v) => Math.max(0, Math.min(255, Math.round(128 + contrast * (255 * (v / 255) ** g - 128))))));
    for (let i = 0; i < data.length; i++) data[i] = lut[i % 3][data[i]];
  }
  const w = info.width;
  const { out, headTop, backdrop } = person.soft ? softBackdrop(data, w, info.height) : rebackdrop(data, w, info.height, person);
  // 4:5 crop with the top of the head 6% below the frame; when the photo is cropped tighter, more backdrop goes on top.
  const cw = Math.min(w, Math.floor(info.height / 1.25)), ch = Math.round(cw * 1.25);
  const margin = Math.round(ch * 0.06);
  const pad = Math.max(0, margin - headTop);
  const fh = info.height + pad;
  const frame = Buffer.alloc(w * fh * 3);
  for (let y = 0; y < pad; y++) for (let x = 0; x < w; x++) backdrop(x, y - pad).forEach((v, k) => (frame[(y * w + x) * 3 + k] = Math.round(v)));
  out.copy(frame, w * pad * 3);
  const left = Math.round((w - cw) / 2);
  const top = Math.max(0, Math.min(fh - ch, headTop + pad - margin));
  let crop = await sharp(frame, { raw: { width: w, height: fh, channels: 3 } }).extract({ left, top, width: cw, height: ch }).png().toBuffer();
  if (person.print || person.soft) crop = await sharp(crop).median(3).png().toBuffer();
  // /img/* is cached for 30 days, so the page asks for ?v=<hash of the files>: a new portrait gets a new URL.
  const hash = createHash('sha256');
  for (const width of PEOPLE_WIDTHS) {
    let img = sharp(crop).resize({ width, kernel: 'lanczos3' });
    if (person.sharpen) img = img.sharpen({ sigma: person.sharpen });
    const file = await img.webp({ quality: 80, effort: 5 }).toBuffer();
    hash.update(file);
    await writeFile(path.join(OUT, 'people', `${person.name}-${width}.webp`), file);
  }
  meta[`people:${person.name}`] = { w: PEOPLE_WIDTHS.at(-1), h: Math.round((PEOPLE_WIDTHS.at(-1) * 5) / 4), widths: PEOPLE_WIDTHS, v: hash.digest('hex').slice(0, 8) };
}

// Every design's catalogue photo (on white, long side 420 px) for the range pages.
await mkdir(path.join(OUT, 't'), { recursive: true });
for (const code of CATALOGUE.families.flatMap((f) => f.ranges.flatMap((r) => r.designs.map((d) => d.code)))) {
  const info = await sharp(path.join(SRC, '..', 't', `${code}.jpg`)).webp({ quality: 74, effort: 5 }).toFile(path.join(OUT, 't', `${code.toLowerCase()}.webp`));
  meta[`t:${code}`] = [info.width, info.height];
}

await writeFile(META, JSON.stringify(meta, null, 2));

// Social card and touch icon, composed only from the images above.
const shadowed = async (code, height) => {
  const { data, info } = await sharp(path.join(OUT, 'p', `${code.toLowerCase()}.webp`)).resize({ height }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const shade = Buffer.alloc(data.length);
  for (let i = 0; i < data.length; i += 4) (shade[i] = 14), (shade[i + 1] = 18), (shade[i + 2] = 48), (shade[i + 3] = Math.round(data[i + 3] * 0.5));
  const pad = 24;
  const raw = { width: info.width, height: info.height, channels: 4 };
  const shadow = await sharp(shade, { raw }).extend({ top: pad, bottom: pad, left: pad, right: pad, background: { r: 0, g: 0, b: 0, alpha: 0 } }).blur(7).png().toBuffer();
  const piece = await sharp(data, { raw }).png().toBuffer();
  return { shadow, piece, w: info.width, h: info.height, pad };
};
const row = [['SE-3001', 270], ['SE-18017', 130], ['SE-1011', 300], ['SE-2017', 120], ['SE-43001', 260], ['SE-41068', 150], ['SE-16005', 96]];
const gap = 46;
const rowWidth = (list) => list.reduce((n, p) => n + p.w, 0) + gap * (list.length - 1);
let pieces = [];
for (const [code, h] of row) pieces.push(await shadowed(code, h));
const fit = Math.min(1, (1200 - 160) / rowWidth(pieces));
if (fit < 1) {
  pieces = [];
  for (const [code, h] of row) pieces.push(await shadowed(code, Math.round(h * fit)));
}
let x = Math.round((1200 - rowWidth(pieces)) / 2);
const layers = [];
for (const p of pieces) {
  const y = Math.round(330 - p.h / 2);
  layers.push({ input: p.shadow, left: x - p.pad + 9, top: y - p.pad + 15 }, { input: p.piece, left: x, top: y });
  x += p.w + gap;
}
const field = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><defs><linearGradient id="g" x1="0" y1="0" x2="0.35" y2="1"><stop offset="0" stop-color="#2d3978"/><stop offset="1" stop-color="#1b2457"/></linearGradient></defs><rect width="1200" height="630" fill="url(#g)"/></svg>`);
await sharp(field).composite(layers).jpeg({ quality: 86, mozjpeg: true }).toFile(path.resolve('public/og.jpg'));

// Icons from the logo SVGs (masters in Logo/polished/). iOS fills transparency with black, so the touch icon sits on the site's paper.
const PAPER = '#fbfaf7';
const CLEAR = { r: 0, g: 0, b: 0, alpha: 0 };
const raster = async (file, height) => {
  const svg = await readFile(path.resolve(file));
  const viewH = Number(String(svg).match(/viewBox="[\d.-]+ [\d.-]+ [\d.]+ ([\d.]+)"/)[1]);
  return sharp(svg, { density: (72 * height * 2) / viewH }).resize({ height }).png().toBuffer();
};
const square = async (file, size, height, background) =>
  sharp({ create: { width: size, height: size, channels: 4, background } })
    .composite([{ input: await raster(file, height), gravity: 'centre' }])
    .png({ compressionLevel: 9 })
    .toBuffer();
await sharp(await square('public/favicon.svg', 180, 128, PAPER)).flatten({ background: PAPER }).toFile(path.resolve('public/apple-touch-icon.png'));
await sharp(await square('public/logo.svg', 512, 336, '#ffffff')).flatten({ background: '#ffffff' }).toFile(path.resolve('public/logo.png'));
// favicon.ico: PNG images inside an ICO container (32 and 48 px).
const icons = [];
for (const size of [32, 48]) icons.push({ size, png: await square('public/favicon.svg', size, size, CLEAR) });
const head = Buffer.alloc(6 + 16 * icons.length);
head.writeUInt16LE(1, 2);
head.writeUInt16LE(icons.length, 4);
let offset = head.length;
icons.forEach(({ size, png }, i) => {
  const at = 6 + 16 * i;
  head.writeUInt8(size, at);
  head.writeUInt8(size, at + 1);
  head.writeUInt16LE(1, at + 4);
  head.writeUInt16LE(32, at + 6);
  head.writeUInt32LE(png.length, at + 8);
  head.writeUInt32LE(offset, at + 12);
  offset += png.length;
});
await writeFile(path.resolve('public/favicon.ico'), Buffer.concat([head, ...icons.map((i) => i.png)]));

console.log(`wrote ${CUTOUTS.length} product cut-outs + ${PHOTOS.length} photos, og.jpg (row ${rowWidth(pieces)}px of 1200), apple-touch-icon.png, logo.png, favicon.ico`);
