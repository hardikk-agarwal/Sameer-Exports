// Temporary: content likeness (grey-level correlation of the subject crop) between catalogue thumbnails and old-site photos,
// plus likeness inside candidate finish trios.
import sharp from 'sharp';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const G = 32;
async function crop(file, inset = 0) {
  const m = await sharp(file).metadata();
  const base = sharp(file).extract({ left: inset, top: inset, width: m.width - inset * 2, height: m.height - inset * 2 });
  const { data, info } = await base.clone().removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  let x0 = W, x1 = -1, y0 = H, y1 = -1;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 3;
      if (765 - data[i] - data[i + 1] - data[i + 2] > 40) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  if (x1 <= x0 || y1 <= y0) return null;
  const g = await sharp(file)
    .extract({ left: inset + x0, top: inset + y0, width: x1 - x0 + 1, height: y1 - y0 + 1 })
    .greyscale()
    .resize(G, G, { fit: 'fill' })
    .raw()
    .toBuffer();
  const v = Float64Array.from(g);
  const mean = v.reduce((a, b) => a + b, 0) / v.length;
  let sd = 0;
  for (let k = 0; k < v.length; k++) (v[k] -= mean), (sd += v[k] * v[k]);
  sd = Math.sqrt(sd) || 1;
  for (let k = 0; k < v.length; k++) v[k] /= sd;
  return { v, aspect: (x1 - x0 + 1) / (y1 - y0 + 1) };
}
const corr = (a, b) => {
  let s = 0;
  for (let k = 0; k < a.v.length; k++) s += a.v[k] * b.v[k];
  return s;
};

const mode = process.argv[2];
if (mode === 'old') {
  const olds = [];
  for (const f of (await readdir('legacy/images')).filter((f) => /\.(jpe?g|png|gif)$/i.test(f))) {
    const c = await crop(path.join('legacy/images', f), 4).catch(() => null);
    if (c) olds.push({ f, ...c });
  }
  const list = JSON.parse(await readFile('catalogue/site/search.json', 'utf8'));
  const res = [];
  for (const [code] of list) {
    const c = await crop(`catalogue/site/t/${code}.jpg`);
    if (!c) continue;
    let best = -1, bf = '';
    for (const o of olds) {
      if (Math.abs(Math.log(o.aspect / c.aspect)) > 0.25) continue;
      const r = corr(c, o);
      if (r > best) (best = r), (bf = o.f);
    }
    res.push([code, +best.toFixed(3), bf]);
  }
  const edges = [0.8, 0.85, 0.9, 0.93, 0.96, 1.01];
  console.log(edges.map((e, i) => `${i ? edges[i - 1] : '<'}..${e}: ${res.filter(([, r]) => (i ? r > edges[i - 1] : true) && r <= e).length}`).join(' | '));
  console.log('top:', res.sort((a, b) => b[1] - a[1]).slice(0, 12).map((r) => r.join(' ')).join('\n'));
  const { writeFile } = await import('node:fs/promises');
  await writeFile('catalogue/site/old-likeness.json', JSON.stringify(Object.fromEntries(res.map(([c, r, f]) => [c, { r, f }]))));
} else {
  for (const group of process.argv.slice(3)) {
    const codes = group.split(',');
    const cs = await Promise.all(codes.map((c) => crop(`catalogue/site/t/${c}.jpg`)));
    const pairs = [];
    for (let i = 0; i < codes.length; i++) for (let j = i + 1; j < codes.length; j++) pairs.push(`${codes[i]}~${codes[j]} ${corr(cs[i], cs[j]).toFixed(2)} (aspect ${cs[i].aspect.toFixed(2)}/${cs[j].aspect.toFixed(2)})`);
    console.log(pairs.join(' | '));
  }
}
