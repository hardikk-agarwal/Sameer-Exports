// Find a design by item code ("SE-1013", "1013") or by words in its name or range ("door knocker").
type Row = [code: string, name: string, range: string, title: string, v: string];

const SHOW = 8;
let rows: Row[] = [];
let loading: Promise<void> | null = null;
const load = () =>
  (loading ??= fetch('/designs.json')
    .then((r) => r.json())
    .then((d: Row[]) => void (rows = d))
    .catch(() => void (rows = [])));

const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const search = (q: string): Row[] => {
  const code = q.match(/^\s*(?:se)?[\s-]*(\d{2,})\s*$/i)?.[1];
  if (code) {
    const hits = rows.filter((r) => r[0].slice(3).startsWith(code));
    return hits.sort((a, b) => Number(b[0].slice(3) === code) - Number(a[0].slice(3) === code));
  }
  const terms = words(q).split(' ').filter(Boolean);
  if (!terms.length) return [];
  // Rank designs whose range or name is the word (knobs, "cabinet knob") above names that merely contain it ("knob lock").
  const hits: { r: Row; s: number; i: number }[] = [];
  rows.forEach((r, i) => {
    const name = ` ${words(r[1])}`;
    const title = ` ${words(r[3])}`;
    if (!terms.every((t) => `${name}${title}`.includes(` ${t}`))) return;
    const last = name.trim().split(' ').at(-1) ?? '';
    const s = terms.reduce((n, t) => n + (title.includes(` ${t}`) ? 2 : 0) + (last.startsWith(t) ? 1 : 0), 0);
    hits.push({ r, s, i });
  });
  return hits.sort((a, b) => b.s - a.s || a.i - b.i).map((h) => h.r);
};

const item = ([code, name, range, title, v]: Row) => {
  const li = document.createElement('li');
  const a = document.createElement('a');
  a.href = `/products/${range}/#${code.toLowerCase()}`;
  const img = document.createElement('img');
  img.src = `/img/t/${code.toLowerCase()}.webp?v=${v}`;
  img.alt = '';
  img.width = 48;
  img.height = 48;
  img.loading = 'lazy';
  const text = document.createElement('span');
  const top = document.createElement('span');
  top.className = 'finder-name';
  top.textContent = name;
  const sub = document.createElement('span');
  sub.className = 'finder-sub';
  sub.textContent = `${code}, ${title}`;
  text.append(top, ' ', sub);
  a.append(img, text);
  li.append(a);
  return li;
};

export function initFinders() {
  document.querySelectorAll<HTMLFormElement>('[data-finder]:not([data-ready])').forEach((finder) => {
    finder.dataset.ready = '';
    const input = finder.querySelector<HTMLInputElement>('[data-finder-input]')!;
    const panel = finder.querySelector<HTMLElement>('[data-finder-panel]')!;
    const list = finder.querySelector<HTMLUListElement>('[data-finder-list]')!;
    const count = finder.querySelector<HTMLElement>('[data-finder-count]')!;
    const live = finder.querySelector<HTMLElement>('[data-finder-live]')!;
    const hint = finder.querySelector<HTMLElement>('[data-finder-hint]');

    const render = () => {
      const q = input.value.trim();
      if (q.length < 2) {
        panel.hidden = true;
        live.textContent = '';
      } else {
        const found = search(q);
        list.replaceChildren(...found.slice(0, SHOW).map(item));
        const n = found.length;
        count.textContent = n ? `${n} ${n === 1 ? 'design' : 'designs'}${n > SHOW ? `, showing the first ${SHOW}` : ''}` : 'No designs match. Try a code like SE-1013 or a word like knocker.';
        live.textContent = count.textContent;
        panel.hidden = false;
      }
      if (hint) hint.hidden = !panel.hidden;
    };

    input.addEventListener('focus', () => void load(), { once: true });
    input.addEventListener('input', () => void load().then(render));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && input.value) {
        // First Escape clears the search; only an empty field lets Escape close a surrounding dialog.
        e.preventDefault();
        input.value = '';
        render();
      }
    });
    finder.addEventListener('submit', (e) => {
      e.preventDefault();
      const first = list.querySelector('a');
      if (first && !panel.hidden) first.click();
    });
  });
}
