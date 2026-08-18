# Findsera Archive

Findsera is an archived Astro site for publishing a static, source-driven product catalogue and editorial guides. It is no longer operated as a shopping, affiliate, advertising, or analytics service.

The repository is retained as a reusable starter for teams that want an Astro site with structured content, static route generation, Tailwind styling, and local content-validation scripts. Fork it, replace the brand and content, and operate it under your own editorial and legal standards.

## What is included

- Astro 6 static site with Tailwind CSS 4
- JSON source files for products, guides, categories, and topics
- Content generator and validation scripts
- Product import, refresh, image-check, and maintenance utilities
- Cloudflare Pages-compatible static output

## Archive status

The checked-in site deliberately renders an archive notice and applies `noindex, nofollow` to every route. Advertising, analytics, affiliate links, structured data, and scheduled publishing are disabled.

This is intentional. Before using a fork as a public site, review the content and all third-party integrations, set your own domain, and change the archive mode in `src/layouts/Layout.astro`. Do not re-enable monetization or indexing until the resulting site is accurate, useful, and legally compliant for your audience.

## Quick start

Requirements: Node.js 22.12 or newer and npm.

```bash
git clone https://github.com/aolaru/findsera.com.git my-site
cd my-site
npm install
npm run dev
```

Open `http://localhost:4321`. Build the production output with:

```bash
npm run build
```

Astro writes the static site to `dist/`.

## Make it yours

1. Fork the repository and update the site name, domain, favicon, social image, and contact details.
2. Replace the example product and guide data in `src/data/source/` with content you have researched and can maintain.
3. Run `npm run content:build` after each source-data change, then run `npm run build` before deploying.
4. Review `src/layouts/Layout.astro`; the `archivedSite` flag is intentionally enabled in this archive.
5. Set your platform's build command to `npm run build` and output directory to `dist`.

The project has been used with Cloudflare Pages, but it produces ordinary static files and can be deployed to any compatible static host.

## Content commands

```bash
npm run content:build
npm run content:check
npm run content:import -- src/data/source/import-products.sample.json
npm run content:refresh -- src/data/source/refresh-overrides.sample.json
npm run content:images
npm run content:report
npm run content:maintain
```

The maintenance and affiliate-related commands remain for code-reference purposes. The GitHub Actions workflows are manual-only and should be reviewed before use in a fork. Never add retailer credentials or re-enable a workflow without understanding the data it changes and the destination it publishes to.

## Project structure

```text
src/
  components/      Shared UI
  data/source/     Hand-authored source content
  data/generated/  Generated runtime content
  layouts/         Page shell and metadata
  pages/           Astro routes
  styles/          Global styling
scripts/           Content import, validation, and generation tools
public/            Static assets
```

## Reuse and attribution

The code is available under the [MIT License](LICENSE). `Findsera`, its domain, and any third-party product names, logos, images, URLs, prices, or retailer data are not a grant to use another party's intellectual property. Replace those materials in any public fork and check the terms for every data source you use.

## Contributing

This archive is not an actively maintained product. Small fixes that make the starter easier to understand, build, or fork are welcome; see [CONTRIBUTING.md](CONTRIBUTING.md). Do not submit affiliate credentials, retailer data, generated buying advice, or changes intended to reactivate the original service.

## Security

Please use a private GitHub security advisory for vulnerabilities. See [SECURITY.md](SECURITY.md).
