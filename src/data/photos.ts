import meta from './image-meta.json';

type PhotoMeta = { w: number; h: number; widths: number[]; credit: string; id: string };

// Licensed stand-in photography (Unsplash License) until the factory's own shoot.
const alts = {
  'teal-door': 'Ornate brass knob on a teal panelled front door',
  'window-handle': 'Brass handle on a white window frame in sunlight',
  lever: 'Brass lever handle on a dark wooden door',
  'cabinet-knob': 'Brass knob on a sage green cabinet under a marble worktop',
  'iron-knocker': 'Ornate black iron door knocker',
  fastener: 'Brass casement fastener on a timber window',
  caliper: 'Hands measuring a brass part with a digital caliper',
  artisan: 'Craftsman finishing a metal piece by hand',
  backplate: 'Brass lever handle on a long backplate',
  moulds: 'Molten metal being poured into sand moulds',
  crucible: 'Metal melting in a crucible over a fire',
  lock: 'Traditional brass lock on a black wooden door',
  'old-door': 'Brass handle on an old wooden door',
  'white-door': 'Polished brass knob on a white panelled door',
  'turned-wood': 'Turned wooden spindles and carved mouldings on a workshop bench',
  lanterns: 'Pierced brass and copper lanterns hanging in a dim shop',
} as const;

export type PhotoName = keyof typeof alts;

// Each product family's photograph (home card, products page, range pages); pos keeps its subject in frame.
export const familyPhoto: Record<string, { name: PhotoName; pos: string }> = {
  brass: { name: 'lever', pos: '38% 30%' },
  iron: { name: 'iron-knocker', pos: '72% 42%' },
  'wood-bone-aluminium': { name: 'turned-wood', pos: '40% 80%' },
  'art-ware': { name: 'lanterns', pos: '50% 30%' },
};

export const photo = (name: PhotoName) => {
  const m = (meta as unknown as Record<string, PhotoMeta>)[`photo:${name}`];
  if (!m) throw new Error(`No processed photo for ${name}`);
  const url = (w: number) => `/img/photo/${name}-${w}.webp`;
  return {
    src: url(m.widths[1] ?? m.widths[0]),
    srcset: m.widths.map((w) => `${url(w)} ${w}w`).join(', '),
    width: m.w,
    height: m.h,
    alt: alts[name],
  };
};

// Team portraits (4:5), made by scripts/build-images.mjs from the files in Logo/.
export const portrait = (id: string) => {
  const m = (meta as unknown as Record<string, Omit<PhotoMeta, 'credit' | 'id'> & { v?: string }>)[`people:${id}`];
  if (!m) throw new Error(`No processed portrait for ${id}`);
  const url = (w: number) => `/img/people/${id}-${w}.webp${m.v ? `?v=${m.v}` : ''}`;
  return {
    src: url(m.widths[1] ?? m.widths[0]),
    srcset: m.widths.map((w) => `${url(w)} ${w}w`).join(', '),
    width: m.w,
    height: m.h,
  };
};
