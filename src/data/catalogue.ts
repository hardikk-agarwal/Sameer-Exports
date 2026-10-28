import data from './catalogue.json';
import meta from './image-meta.json';

// Generated from the 2026 catalogue by scripts/catalogue-sync.mjs; edit the script, not the JSON.
export type Product = { name: string; range: string; size: string; finish: string };
export type Design = { code: string; name: string; size: string; finish: string };
export type Range = { id: string; name: string; title: string; full: string; count: number; page: number; image: string; designs: Design[] };
export type Family = { id: string; name: string; text: string; page: number; ranges: Range[] };

export const families = data.families as Family[];
export const products = data.products as Record<string, Product>;
export const gallery = data.gallery as string[];
export const finishes = data.finishes as { code: string; name: string; example: string | null }[];
export const totalDesigns = data.designs;
export const allRanges = families.flatMap((f) => f.ranges.map((r) => ({ ...r, family: f })));
export const familyCount = (f: Family) => f.ranges.reduce((n, r) => n + r.count, 0);
export const rangeById = Object.fromEntries(allRanges.map((r) => [r.id, r]));

// The full catalogue PDF, served from this site for download.
export const catalogue = {
  href: '/catalogue/sameer-exports-catalogue-2026.pdf',
  file: 'Sameer-Exports-Catalogue-2026.pdf',
  pages: 120,
  size: '15 MB',
};

// A design's catalogue photo (white backdrop), from scripts/build-images.mjs.
export const thumb = (code: string) => {
  const m = (meta as unknown as Record<string, [number, number]>)[`t:${code}`];
  if (!m) throw new Error(`No catalogue photo for ${code}`);
  return { src: `/img/t/${code.toLowerCase()}.webp`, width: m[0], height: m[1] };
};

export const img = (code: string) => {
  const m = (meta as Record<string, { w: number; h: number; sw: number }>)[code];
  if (!m) throw new Error(`No processed image for ${code}`);
  const base = `/img/p/${code.toLowerCase()}`;
  return { src: `${base}.webp`, srcset: `${base}-s.webp ${m.sw}w, ${base}.webp ${m.w}w`, width: m.w, height: m.h };
};

// Long, flat pieces get more width and compact ones more height, so every piece reads at a similar size.
export const fit = (w: number, h: number, wide = [84, 56], mid = [70, 68], tall = [52, 74]) => {
  const [fw, fh] = w / h >= 1.8 ? wide : w / h >= 1.1 ? mid : tall;
  return `--fit-w:${fw}%;--fit-h:${fh}%`;
};
