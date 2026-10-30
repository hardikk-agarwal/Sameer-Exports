# Sameer Exports (Brass Builders) website

Static Astro site for brass-builders.com.

## Run

```bash
npm install
npm run dev       # http://localhost:4321
npm run build     # static site in dist/
npm run images    # rebuild the 86 product cut-outs, 691 catalogue photos, the 16 photographs, the 2 portraits, og.jpg and the icons
npm run catalogue # the downloadable catalogue PDF, from the same data and photos (needs Microsoft Edge or Google Chrome)
```

## Catalogue data and product photos

Products, ranges, counts and product photos come from the 2026 catalogue (`catalogue/Sameer-Exports-Catalogue.pdf`, 910 designs in 62 ranges). The catalogue was generated from lilkunal.github.io/sameerexports, so the scripts read that site's product list, product pages and photos. No photos from the old website are used.

```bash
node catalogue/fetch-products.mjs   # product pages -> catalogue/site/products.json (size, finish, group)
node scripts/catalogue-sync.mjs     # families, ranges, every design, page numbers and photo picks -> src/data/catalogue.json
npm run images                      # cuts out the picked photos and converts every design's catalogue photo for the site
```

`catalogue-sync.mjs` picks one photo per range by sharpness, shape, finish colour and name (a pulley for pulleys, a vase for vases), plus the home page rail (`GALLERY`) and one example per finish code. To change a range's photo, adjust the scoring or the lists at the top of that script rather than editing the JSON. It also lists every design under its range, fixing spelling in names (`clean`), finish labels (`FINISH_FIX`) and size spacing (`sizeText`). `catalogue/catalogue-text.txt` is the PDF's text, used for page numbers.

The site groups ranges into families by what the pieces are for, the way buyers look for them: door handles, door fittings, locks, bolts and latches, window fittings, cabinet hardware, and hooks and home fittings (`FAMILIES` in the script). The material stays in each range's name (Brass lever handles, Iron lever handles), so a family shows both materials side by side. The PDF itself is organised by material.

The PDF's wood, bone and aluminium, and art ware, garden and saddlery ranges (252 designs, still in the PDF) are in no family, so the sync leaves them out of `src/data/catalogue.json`. None of their ranges, search results, photos or counts are on the site, and neither are the two finishes only they use (EPNS, anodized). `public/_redirects` sends their old range pages to `/products/`. To show them again, add their range ids to a family in `FAMILIES` (or to a new one), re-run the sync and `npm run images`, and delete those redirects. A new family also needs a photo (`familyPhoto` in `src/data/photos.ts`) and a home page card (`src/pages/index.astro`).

Ranges from outside the PDF (`EXTRA` in the script) come from the two JSON files below.

### Security chain locks

`catalogue/security-chain-locks.json` adds 9 door chains (SE-53001 to SE-53009) as one range, Security chain locks, under Locks, bolts and latches. Names come from the file names of the company's own photos in `catalogue/New products`. Those phone photos were taken on paper under uneven light. For `catalogue/site/p` and `catalogue/site/t` only the paper's colour cast was taken out, so the metal keeps its own tone (lifting the paper to white had turned the polished faces white too). The paper and its shadows were replaced with white through each piece's product mask, and each photo was cropped to the piece. The family's photo (`catalogue/security-chain-locks.jpg`, `door-chain` in `PHOTOS`) is the brass door chain, cut out with its mask and set on a deep teal backdrop, left of centre so the opening's label does not cover it. It is the second panel of the home page opening, tagged "Top selling".

### Chrome and black door handles

`catalogue/door-handles.json` adds 24 door handles in polished chrome, matt black and black antique (SE-52001 to SE-52024), as the first two ranges under Door handles: lever handles (on backplate) and handles on rose. Names follow the descriptions in the door-pack sheet of December 2023, without its brand name. `sheet` gives the sheet's S.No rows for each design: rows 1–3, 4–6, 7–9 and 10–12 are one handle each (the sheet repeats row 9's photo for row 12, but its listing is the matt black Liberty bathroom pack). Their photos in `catalogue/site/p` (1040 px) and `catalogue/site/t` (640 px) are the handles cut out of the main photo of each pack's online listing (2000 px), with the floor reflections retouched out. SE-52010's listing now shows a different lock, so its photo is still the soft 2× crop from the sheet. Replace the photos with photos of your own samples under the same file names, make new masks for them (see Product cut-outs), then run `npm run images`. They are the first panel of the home page opening, "Door handles", tagged "Top selling".

### Product cut-outs

`npm run images` cuts each product shown on its own (range tiles, the opening, the gallery, finishes) out of its white backdrop. `catalogue/site/mask` holds a product mask for every one of these photos, made with the BiRefNet-lite segmentation model (MIT licence): pixels the mask marks as product are never taken for backdrop (polished brass and chrome reflect white), and light areas it marks as background go (paper trapped inside a chain, shadowed openings, printed labels). A new cut-out photo needs a new mask. Photos that still give no clean cut-out (a piece as pale as the backdrop, a damaged scan, a stray object in the frame) are listed in `NO_CUTOUT` in `scripts/catalogue-sync.mjs`, so their ranges use their next best photo; they still show as photos on their range pages.

### The catalogue on the site

- `/products/` shows the six families and their 49 ranges, with a search box that finds any design by item code ("SE-1013", "1013") or by words in its name ("door knocker"), using `/designs.json`. The same search (`src/components/Finder.astro`, logic in `src/scripts/finder.ts`) opens from the magnifier in the header on every page, sits at the top of the phone menu, and is on the 404 page for visitors arriving on old catalogue links.
- Each range has its own page, `/products/<range>/` (`src/pages/products/[range].astro`), with every design's photo, code, name, size and finish. Each design has an anchor (`#se-1013`), which the search results and the home page rail link to.
- "Add to quote list" on a design keeps it in the visitor's browser (`src/components/QuoteList.astro`, localStorage). The bar at the bottom of the page opens the quote form with the codes already in the message and their ranges ticked; the list clears after the form sends through Formspree or Web3Forms.
- The catalogue PDF (`public/catalogue/sameer-exports-catalogue-2026.pdf`) is made from the site's own data and photos (see below). The products page, the footer and the contact page offer it for download; each range page opens it at that range's page.

### The catalogue PDF

`npm run catalogue` (`scripts/catalogue-pdf.mjs`, styles in `scripts/catalogue-pdf.css`) lays out every family, range and design on the site as an A4 PDF and prints it with the installed Edge or Chrome: a cover, about us and how to order, contents, finishes, then each family opening on a band of its pieces, followed by its ranges four designs to a row, and contact details with QR codes on the back. Run it after `npm run images` whenever designs, names, sizes or photos change. It writes the PDF and `src/data/catalogue-pdf.json` (page count, file size and each range's page, which the range pages link to). Every design in the PDF links to its place on the website, the contents and family lists link to their pages, and the PDF has bookmarks. Photos go in as JPEGs on the site's tile colour, which keeps the file small; the cover and family bands use the product cut-outs. The original printed catalogue stays in `catalogue/Sameer-Exports-Catalogue.pdf` as the data source.

## Logo

The mark is redrawn as vectors from `Logo/Sameer Exports logo.png` (unchanged). Masters, colours and usage notes are in `Logo/polished/` (see its README; `preview.html` compares old and new). The site uses the flat red mark from `src/data/mark.json` in the header and footer, `public/favicon.svg` and `public/logo.svg`; `npm run images` makes `favicon.ico`, `favicon-96x96.png` (for search results: Google wants a raster icon over 48 px and does not read SVG favicons), `apple-touch-icon.png` and `logo.png` (structured data) from those two SVGs.

The portraits on the About and Contact pages come from `Logo/Sanjeev-new.jpeg` (a photographed passport print) and `Logo/Sarthak.jpeg`. `npm run images` swaps their backdrops for the same warm grey and crops them 4:5 (`PEOPLE` in `scripts/build-images.mjs`); for the print it also trims the print's edges, removes dust, corrects the faded colour and smooths the grain. Names, designations, phones and emails are in `src/data/site.ts` (`people`).

## Deploy (Cloudflare Pages)

Build command `npm run build`, output directory `dist`. `public/_redirects` sends every old URL (for example `/casement-stay-supplier/index.html`, `/about-us.html`, `/query.html`) to the matching range of the new catalogue with a 301, and the range pages of the hidden families to `/products/`. On other hosts, recreate those redirects in the host's own config.

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

- `public/_headers` sends HSTS, a Content-Security-Policy, COOP, X-Frame-Options, nosniff, Referrer-Policy and Permissions-Policy on every response. Images under `/img/` are cached for a year: `npm run images` stores a short fingerprint of every image (`v` in `src/data/image-meta.json`) and pages ask for `?v=<fingerprint>`, so a changed image gets a new address and nobody sees an old copy. On phones the opening's four photographs come as wide bands cropped around the hardware (`band` in `PHOTOS`), not the whole, often tall, photographs.
- The policy allows scripts from this site only (plus Cloudflare Web Analytics). Astro is set never to inline scripts (`vite.build.assetsInlineLimit: 0` in `astro.config.mjs`); keep it that way, or inline scripts will be blocked. Inline styles are allowed. If the quote form is pointed at a provider other than Formspree or Web3Forms, add its address to `connect-src` and `form-action`.
- `public/.well-known/security.txt` gives a contact for security reports. Renew its `Expires` date before October 2027.
- On the Cloudflare zone: minimum TLS 1.2, Always Use HTTPS, Certificate Transparency alerts, email obfuscation off (it hid the addresses on the page from visitors and search engines), one DMARC record with `p=quarantine` (reports in Email > DMARC Management), DNSSEC on (the DS record is at GoDaddy under Domain > DNS > DS Records; if Cloudflare's DNSSEC key ever changes, update it there). The old cPanel records (cpanel, webmail, ftp and the like) were removed in October 2026.

## Quote form

Without configuration the form opens the visitor's email app with the request filled in (to info@brass-builders.com, with sarthak@brass-builders.com in CC), and offers WhatsApp (+91 98370 31885, Sanjeev Agarwal's mobile). The CC comes from `ccQuotes: true` on a person in `src/data/site.ts`. To receive requests directly, create a free Formspree or Web3Forms form and set the variables from `.env.example` in Cloudflare Pages, then rebuild. A form service sends to the recipients set in its own dashboard, so add Sarthak there too: in Formspree, add a second Email action for his address in the form's Workflow; Web3Forms only offers CC on paid plans.

## Replace before launch

- Of the 17 photographs in `public/img/photo/`, door-chain is your own brass door chain (see Security chain locks above). chain-guard (the opening's Security chain locks panel) is a retailer's product photo found through Bing image search, `catalogue/security-chain-locks-door.jpg`, widened with more of its white door; its owner and licence are unknown, so replace it with your own photo of a fitted chain under the same file name. window-fasteners (the Window fittings panel) is Hardwick's collection photo of their Lyndon nightvent fasteners (hardwick.co.uk), only available at 512 px, so it was upscaled 4× with the Swin2SR real-world model and widened on the right with more of the same window, rebuilt from parts of the photo (`catalogue/window-fittings-hero.jpg`); it is Hardwick's photograph of Hardwick's product, so use it only with their permission, or replace it with your own photo under the same file name. The other 14 are Unsplash photos (Unsplash License, free for commercial use) standing in for your own. They show hardware and metalwork in general, not Sameer Exports products, so replace them with your own shoot before launch: the same file names in `scripts/build-images.mjs` (`PHOTOS`) keep every page working. The home page opens with four categories side by side, the two top sellers first, each with three catalogue pieces (`src/components/HeroPanels.astro`): door-lever (door handles), chain-guard (security chain locks), window-fasteners (window fittings) and cabinet-knob (cabinet hardware). Photographers: Shyam (door-lever), Nicola Bushuven (cabinet-knob), Sneaky Head (lever), Fumiaki Hayashi (iron-knocker), Liana S (shell-pulls), Hasan Mrad (artisan), Kateryna Hliznitsova (backplate), Joseph Grieveson (moulds), Enlightening Images (crucible), rhoda alex (lock), Roger Bradshaw (old-door), Aletra ekaye (window-latch), Richard Stachmann (drawer-knob), Alex Tyson (brass-hooks).
- The chrome and black door handle photos are cut from another company's pack photos (see Chrome and black door handles above). Shoot your own samples before showing them widely.
- The craft photos (artisan, moulds, crucible) are other workshops. Your own foundry, benches and packing room will say "made in our own factory" far better.
