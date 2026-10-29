# Sameer Exports (Brass Builders) website

Static Astro site for brass-builders.com.

## Run

```bash
npm install
npm run dev       # http://localhost:4321
npm run build     # static site in dist/
npm run images    # rebuild the 70 product cut-outs, 910 catalogue photos, the 15 photographs, the 2 portraits, og.jpg and the icons
```

## Catalogue data and product photos

Products, ranges, counts and product photos come from the 2026 catalogue (`catalogue/Sameer-Exports-Catalogue.pdf`, 910 designs in 62 ranges). The catalogue was generated from lilkunal.github.io/sameerexports, so the scripts read that site's product list, product pages and photos. No photos from the old website are used.

```bash
node catalogue/fetch-products.mjs   # product pages -> catalogue/site/products.json (size, finish, group)
node scripts/catalogue-sync.mjs     # families, ranges, every design, page numbers and photo picks -> src/data/catalogue.json
npm run images                      # cuts out the picked photos and converts every design's catalogue photo for the site
```

`catalogue-sync.mjs` picks one photo per range by sharpness, shape, finish colour and name (a pulley for pulleys, a vase for vases), plus the home page rail (`GALLERY`) and one example per finish code. To change a range's photo, adjust the scoring or the lists at the top of that script rather than editing the JSON. It also lists every design under its range, fixing spelling in names (`clean`), finish labels (`FINISH_FIX`) and size spacing (`sizeText`). `catalogue/catalogue-text.txt` is the PDF's text, used for page numbers. The four families group the catalogue's 12 sections (`FAMILIES` in the script).

### The catalogue on the site

- `/products/` shows the four families and their 62 ranges, with a search box that finds any design by item code ("SE-1013", "1013") or by words in its name ("door knocker"), using `/designs.json`. The same search (`src/components/Finder.astro`, logic in `src/scripts/finder.ts`) opens from the magnifier in the header on every page, sits at the top of the phone menu, and is on the 404 page for visitors arriving on old catalogue links.
- Each range has its own page, `/products/<range>/` (`src/pages/products/[range].astro`), with every design's photo, code, name, size and finish. Each design has an anchor (`#se-1013`), which the search results and the home page rail link to.
- "Add to quote list" on a design keeps it in the visitor's browser (`src/components/QuoteList.astro`, localStorage). The bar at the bottom of the page opens the quote form with the codes already in the message and their ranges ticked; the list clears after the form sends through Formspree or Web3Forms.
- The PDF is still there to download (`public/catalogue/sameer-exports-catalogue-2026.pdf`, buttons on the products and range pages and in the footer). Its footer and product links point to lilkunal.github.io/sameerexports; a copy pointing to brass-builders.com would be better before launch.

## Logo

The mark is redrawn as vectors from `Logo/Sameer Exports logo.png` (unchanged). Masters, colours and usage notes are in `Logo/polished/` (see its README; `preview.html` compares old and new). The site uses the flat red mark from `src/data/mark.json` in the header and footer, `public/favicon.svg` and `public/logo.svg`; `npm run images` makes `favicon.ico`, `apple-touch-icon.png` and `logo.png` (structured data) from those two SVGs.

The portraits on the About and Contact pages come from `Logo/Sanjeev-new.jpeg` (a photographed passport print) and `Logo/Sarthak.jpeg`. `npm run images` swaps their backdrops for the same warm grey and crops them 4:5 (`PEOPLE` in `scripts/build-images.mjs`); for the print it also trims the print's edges, removes dust, corrects the faded colour and smooths the grain. Names, designations, phones and emails are in `src/data/site.ts` (`people`).

## Deploy (Cloudflare Pages)

Build command `npm run build`, output directory `dist`. `public/_redirects` sends every old URL (for example `/casement-stay-supplier/index.html`, `/about-us.html`, `/query.html`) to the matching range of the new catalogue with a 301. On other hosts, recreate those redirects in the host's own config.

The live site is the Cloudflare Pages project `sameer-exports-main`, connected to this repository: every push to `main` deploys to brass-builders.com. The Node version comes from `.node-version`.

## Search engines

- Canonical address: `https://brass-builders.com` (no www). A Cloudflare Redirect Rule on the zone (Rules > Redirect Rules, "Redirect www to brass-builders.com") sends www to it with a 301; it lives in Cloudflare, not in this repository.
- Every page has its own title, description, canonical link and Open Graph tags (`src/layouts/Base.astro`). Range pages are titled like "Brass Lever Handles Manufacturer in India | Sameer Exports", shortened when a title would pass 60 characters.
- Structured data on every page: LocalBusiness (address, hours, contacts) and WebSite (the site name Google shows). Range pages add a BreadcrumbList.
- `/sitemap.xml` lists the home, products, about, contact and all range pages, with every product photo on its range page (for image search); `robots.txt` points to it. `/designs.json` (the search data) is sent with `X-Robots-Tag: noindex`.
- `robots.txt` lets every crawler in, AI search and assistants included (Cloudflare AI Crawl Control blocks none), and its `Content-Signal` line allows search, AI answers and AI training. Change `ai-train=yes` to `no` to opt out of training.
- IndexNow (Bing, Yandex and others): the key file is `public/5296c5540fcd54988382c75a310c0585.txt`. Cloudflare Crawler Hints (Caching > Configuration) is on, so changed pages are reported automatically.
- `public/speculation-rules.json` (sent through a `Speculation-Rules` header) lets Chrome and Edge prefetch a page when a visitor hovers its link, so pages open almost instantly.

## Security

- `public/_headers` sends HSTS, a Content-Security-Policy, COOP, X-Frame-Options, nosniff, Referrer-Policy and Permissions-Policy on every response.
- The policy allows scripts from this site only (plus Cloudflare Web Analytics). Astro is set never to inline scripts (`vite.build.assetsInlineLimit: 0` in `astro.config.mjs`); keep it that way, or inline scripts will be blocked. Inline styles are allowed. If the quote form is pointed at a provider other than Formspree or Web3Forms, add its address to `connect-src` and `form-action`.
- `public/.well-known/security.txt` gives a contact for security reports. Renew its `Expires` date before October 2027.
- On the Cloudflare zone: minimum TLS 1.2, Always Use HTTPS, Certificate Transparency alerts, email obfuscation off (it hid the addresses on the page from visitors and search engines), one DMARC record with `p=quarantine` (reports in Email > DMARC Management), DNSSEC on (the DS record is at GoDaddy under Domain > DNS > DS Records; if Cloudflare's DNSSEC key ever changes, update it there). The old cPanel records (cpanel, webmail, ftp and the like) were removed in October 2026.

## Quote form

Without configuration the form opens the visitor's email app with the request filled in (to info@brass-builders.com, with sarthak@brass-builders.com in CC), and offers WhatsApp (+91 98370 31885, Sanjeev Agarwal's mobile). The CC comes from `ccQuotes: true` on a person in `src/data/site.ts`. To receive requests directly, create a free Formspree or Web3Forms form and set the variables from `.env.example` in Cloudflare Pages, then rebuild. A form service sends to the recipients set in its own dashboard, so add Sarthak there too: in Formspree, add a second Email action for his address in the form's Workflow; Web3Forms only offers CC on paid plans.

## Replace before launch

- The 15 photographs in `public/img/photo/` are Unsplash photos (Unsplash License, free for commercial use) standing in for your own. They show hardware, woodwork and metalwork in general, not Sameer Exports products, so replace them with your own shoot before launch: the same file names in `scripts/build-images.mjs` (`PHOTOS`) keep every page working. The home page opens with four of them side by side (teal-door, white-door, window-handle, cabinet-knob: a front door, an interior door, a window and a cabinet fitted with brass hardware, in bright daylight); one stands open at a time with three catalogue pieces for that use (`src/components/HeroPanels.astro`). Photographers: Jonathan Borba (teal-door), Okna Milano (window-handle), Nicola Bushuven (cabinet-knob), Sneaky Head (lever), Fumiaki Hayashi (iron-knocker), Hans Westbeek (caliper), Hasan Mrad (artisan), Kateryna Hliznitsova (backplate), Joseph Grieveson (moulds), Enlightening Images (crucible), rhoda alex (lock), Roger Bradshaw (old-door), Jason Gooljar (white-door), HENG YIN (turned-wood), mathieu gauzy (lanterns).
- The craft photos (artisan, caliper, moulds, crucible, turned-wood) are other workshops. Your own foundry, benches and packing room will say "made in our own factory" far better.
