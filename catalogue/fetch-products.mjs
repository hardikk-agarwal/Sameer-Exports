// Fetch every catalogue product page and record code, name, range, material group, size and finish in catalogue/site/products.json.
import { readFile, writeFile } from 'node:fs/promises';

const base = 'https://lilkunal.github.io/sameerexports/product/';
const list = JSON.parse(await readFile('catalogue/site/search.json', 'utf8'));
const decode = (s) =>
  s
    .replace(/&amp;/g, '&')
    .replace(/&times;/g, '×')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
const out = {};
const todo = [...list];
const failed = [];
const worker = async () => {
  while (todo.length) {
    const [code, name, range, slug] = todo.shift();
    try {
      const res = await fetch(base + slug + '.html');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();
      const row = (label) => {
        const m = html.match(new RegExp(`<td[^>]*>\\s*${label}\\s*</td>\\s*<td[^>]*>([\\s\\S]*?)</td>`, 'i'));
        return m ? decode(m[1].replace(/<[^>]+>/g, '')) : '';
      };
      out[code] = { code, name, range, group: row('Material group'), size: row('Size'), finish: row('Finish'), slug };
    } catch (e) {
      failed.push(`${code} ${e.message}`);
    }
  }
};
await Promise.all(Array.from({ length: 8 }, worker));
await writeFile('catalogue/site/products.json', JSON.stringify(out, null, 1));
const vals = Object.values(out);
console.log(`products ${vals.length}, failed ${failed.length} ${failed.slice(0, 5).join('; ')}`);
const count = (k) => Object.entries(vals.reduce((m, v) => ((m[v[k] || '(none)'] = (m[v[k] || '(none)'] ?? 0) + 1), m), {})).sort((a, b) => b[1] - a[1]);
console.log('groups', JSON.stringify(count('group')));
console.log('finishes', JSON.stringify(count('finish').slice(0, 40)));
console.log('empty size', vals.filter((v) => !v.size).length);
