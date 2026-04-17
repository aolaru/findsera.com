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
```

- `content:import` upserts products into the source catalog from a JSON file
- `content:refresh` applies price/image/Amazon URL overrides in bulk
- `content:report` lists products still missing exact Amazon product URLs

## Deployment notes

- Build command: `npm run build`
- Output directory: `dist`
- Target platform: Cloudflare Pages

## Content model

Source content lives in `src/data/source/`. Generated runtime data is written to `src/data/generated/`, which powers the homepage, roundup routes, category pages, topic pages, and SEO cluster landing pages.
