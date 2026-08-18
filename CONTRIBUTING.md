# Contributing

This repository is an archive and a reusable code reference, not an active Findsera service. Contributions should improve the starter without reactivating the original site.

## Good contributions

- Fix build, accessibility, or content-generation defects.
- Improve documentation for people creating their own fork.
- Add focused tests or validation that protect the static-site workflow.
- Keep changes scoped and include `npm run build` results in the pull request.

## Out of scope

- Adding retailer credentials, analytics, ads, or affiliate tags.
- Publishing product claims, price updates, or buying recommendations for Findsera.
- Re-enabling indexing, monetization, or scheduled publishing for the archived domain.
- Submitting third-party images, trademarks, or copyrighted copy without clear rights to use them.

## Development workflow

```bash
npm install
npm run content:build
npm run build
```

Open an issue before proposing a broad redesign. For code changes, use a branch, keep commits clear, and explain the user-facing effect and validation in the pull request.

## Conduct

Be respectful, specific, and constructive. Report security concerns through the private process in [SECURITY.md](SECURITY.md), not a public issue.
