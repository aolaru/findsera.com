# Findsera

Production-ready Astro MVP for an affiliate product discovery site focused on SEO, static generation, and source-driven affiliate content publishing.

## Stack

- Astro
- Tailwind CSS 4 via the Vite plugin
- Static site generation
- Source-to-catalog JSON content pipeline
- Cloudflare Pages-friendly output

## Project structure

```text
/
├── public/
│   ├── images/
│   └── robots.txt
├── src/
│   ├── components/
│   ├── data/
│   │   ├── generated/
│   │   └── source/
│   ├── layouts/
│   ├── pages/
│   └── styles/
├── scripts/
├── astro.config.mjs
└── package.json
```

## Local development

```bash
npm install
npm run dev
```

Open `http://localhost:4321`.

## Production build

```bash
npm run build
```

The production output is generated into `dist/`.

## Content workflow

```bash
npm run content:build
```

Edit `src/data/source/products.source.json` and `src/data/source/roundups.source.json`, then regenerate the catalog. The generator validates references and builds Amazon affiliate search links using `tag=kreativauto-20`.

## Import and refresh workflow

```bash
npm run content:import -- src/data/source/import-products.sample.json
npm run content:refresh -- src/data/source/refresh-overrides.sample.json
npm run content:report
npm run content:maintain
```

- `content:import` upserts products into the source catalog from a JSON file
- `content:refresh` applies price/image/Amazon URL overrides in bulk
- `content:report` lists products still missing exact Amazon product URLs
- `content:maintain` adds queued products, applies queued product refreshes, optionally adds queued guides, then writes a richer maintenance report

## Deployment notes

- Build command: `npm run build`
- Output directory: `dist`
- Target platform: Cloudflare Pages

## Search Console

To enable Google Search Console verification through the site markup, set:

```bash
PUBLIC_GOOGLE_SITE_VERIFICATION=your-verification-token
```

The layout will emit the corresponding `google-site-verification` meta tag automatically. After deployment:

- add `https://findsera.com` as a property in Google Search Console
- confirm the meta-tag verification method
- submit `https://findsera.com/sitemap-index.xml`
- use the query and performance reports to improve titles, meta descriptions, and underperforming pages

## Content model

Source content lives in `src/data/source/`. Generated runtime data is written to `src/data/generated/`, which powers the homepage, roundup routes, category pages, topic pages, and SEO cluster landing pages.

## Daily automation

- Product queue: `src/data/source/product-backlog.json`
- Product refresh queue: `src/data/source/product-refresh-backlog.json`
- Guide queue: `src/data/source/guide-backlog.json`
- Report output: `reports/daily-maintenance.md`
- Workflow: `.github/workflows/daily-content-maintenance.yml`
- Schedule: daily at `05:15 UTC`
- Weekly guide workflow: `.github/workflows/weekly-guide-publish.yml`
- Weekly guide schedule: Mondays at `05:30 UTC`

The workflow:
- adds 1 product per daily run from the backlog queue
- applies up to 2 existing-product refreshes per daily run from the refresh queue
- daily workflow adds 0 guides by default
- weekly workflow adds up to 1 guide per run from the guide backlog queue
- regenerates the content catalog
- builds the site to catch broken content references
- commits the changes automatically when there is a diff

Important:
- It does not scrape live prices yet
- It can apply pre-queued refreshes to existing products, but it still does not discover live price changes on its own
- It flags stale `priceCheckedAt` values so you know which products still need manual refreshes or a later provider/API integration
- It also reports unused products, guides with short intros, guides with too few products, and validation failures before commit

## Automation hardening

- Daily and weekly content workflows now share a single concurrency group so they do not mutate the same files at the same time.
- Both workflows rebase on the latest `origin/main` before pushing, which reduces fast-forward push failures.
- The weekly workflow supports manual review mode through `workflow_dispatch` input `review_mode=true`, which opens a pull request instead of pushing directly to `main`.
- The maintenance script now validates queued products, queued refreshes, and queued guides before writing any files.
- If you want to require exact Amazon URLs before queued products can be promoted, run maintenance with:

```bash
REQUIRE_EXACT_AMAZON_URLS=true npm run content:maintain
```
