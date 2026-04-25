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
- `content:maintain` adds up to 2 products and 1 guide from backlog queues, then writes a richer maintenance report

## Deployment notes

- Build command: `npm run build`
- Output directory: `dist`
- Target platform: Cloudflare Pages

## Content model

Source content lives in `src/data/source/`. Generated runtime data is written to `src/data/generated/`, which powers the homepage, roundup routes, category pages, topic pages, and SEO cluster landing pages.

## Daily automation

- Product queue: `src/data/source/product-backlog.json`
- Guide queue: `src/data/source/guide-backlog.json`
- Report output: `reports/daily-maintenance.md`
- Workflow: `.github/workflows/daily-content-maintenance.yml`
- Schedule: daily at `05:15 UTC`
- Weekly guide workflow: `.github/workflows/weekly-guide-publish.yml`
- Weekly guide schedule: Mondays at `05:30 UTC`

The workflow:
- adds up to 2 products per run from the backlog queue
- daily workflow adds 0 guides by default
- weekly workflow adds up to 1 guide per run from the guide backlog queue
- regenerates the content catalog
- builds the site to catch broken content references
- commits the changes automatically when there is a diff

Important:
- It does not scrape live prices yet
- It flags stale `priceCheckedAt` values so you know which products need manual refreshes or a later provider/API integration
- It also reports unused products, guides with short intros, guides with too few products, and validation failures before commit
