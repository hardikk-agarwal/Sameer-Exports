import type { APIRoute } from 'astro';
import { allRanges, thumb } from '../data/catalogue';

const pages = ['/', '/products/', ...allRanges.map((r) => `/products/${r.id}/`), '/about/', '/contact/'];
// Range pages also list their product photos, for image search.
const images = Object.fromEntries(allRanges.map((r) => [`/products/${r.id}/`, r.designs.map((d) => thumb(d.code).src)]));

export const GET: APIRoute = ({ site }) => {
  const urls = pages
    .map((p) => {
      const pics = (images[p] ?? []).map((src) => `<image:image><image:loc>${new URL(src, site).href}</image:loc></image:image>`).join('');
      return `  <url><loc>${new URL(p, site).href}</loc>${pics}</url>`;
    })
    .join('\n');
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${urls}\n</urlset>\n`, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
