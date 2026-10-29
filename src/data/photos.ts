import meta from './image-meta.json';

type PhotoMeta = { w: number; h: number; widths: number[]; band?: number[]; v: string; credit: string; id: string };

// Licensed stand-in photography (Unsplash License) until the factory's own shoot; door-chain is our own.
const alts = {
  'window-fasteners': 'Two brass casement fasteners on a white timber window',
  lever: 'Brass lever handle on a dark wooden door',
  'cabinet-knob': 'Brass knob on a sage green cabinet under a marble worktop',
  'iron-knocker': 'Ornate black iron door knocker',
  fastener: 'Brass casement fastener on a timber window',
  'shell-pulls': 'Brass shell pull on a glass cabinet door in warm light',
  artisan: 'Craftsman finishing a metal piece by hand',
  backplate: 'Brass lever handle on a long backplate',
  moulds: 'Molten metal being poured into sand moulds',
  crucible: 'Metal melting in a crucible over a fire',
  lock: 'Traditional brass lock on a black wooden door',
  'old-door': 'Brass handle on an old wooden door',
  'door-lever': 'Silver lever handle on a grey door in slanting light',
  'door-chain': 'Brass door chain with its keeper and slide plate',
  'chain-guard': 'Brass door chain fitted across a white door and its frame',
  'window-latch': 'Barrel bolt on an open wooden casement window',
  'drawer-knob': 'Brass knob on a cabinet drawer in low light',
  'brass-hooks': 'Brass double hooks under a white shelf',
} as const;

export type PhotoName = keyof typeof alts;

// Each product family's photograph (home card, products page, range pages); pos keeps its subject in frame.
export const familyPhoto: Record<string, { name: PhotoName; pos: string }> = {
  'door-handles': { name: 'lever', pos: '38% 30%' },
  'door-fittings': { name: 'iron-knocker', pos: '72% 42%' },
  'locks-bolts-latches': { name: 'door-chain', pos: '37% 46%' },
  'window-fittings': { name: 'window-latch', pos: '30% 55%' },
  'cabinet-hardware': { name: 'drawer-knob', pos: '45% 60%' },
  'hooks-home-fittings': { name: 'brass-hooks', pos: '55% 40%' },
};

export const photo = (name: PhotoName) => {
  const m = (meta as unknown as Record<string, PhotoMeta>)[`photo:${name}`];
  if (!m) throw new Error(`No processed photo for ${name}`);
  const url = (w: number, kind = '') => `/img/photo/${name}${kind}-${w}.webp?v=${m.v}`;
  return {
    src: url(m.widths[1] ?? m.widths[0]),
    srcset: m.widths.map((w) => `${url(w)} ${w}w`).join(', '),
    // Opening photos only: a wide crop for phones, where the panels are bands.
    band: m.band?.map((w) => `${url(w, '-band')} ${w}w`).join(', '),
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
