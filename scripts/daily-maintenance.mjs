import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const productsPath = path.join(root, "src/data/source/products.source.json");
const roundupsPath = path.join(root, "src/data/source/roundups.source.json");
const productBacklogPath = path.join(root, "src/data/source/product-backlog.json");
const productRefreshBacklogPath = path.join(root, "src/data/source/product-refresh-backlog.json");
const guideBacklogPath = path.join(root, "src/data/source/guide-backlog.json");
const reportDir = path.join(root, "reports");
const reportPath = path.join(reportDir, "daily-maintenance.md");

const MAX_NEW_PRODUCTS = Number(process.env.MAX_NEW_PRODUCTS ?? 2);
const MAX_PRODUCT_REFRESHES = Number(process.env.MAX_PRODUCT_REFRESHES ?? 2);
const MAX_NEW_GUIDES = Number(process.env.MAX_NEW_GUIDES ?? 1);
const STALE_AFTER_DAYS = Number(process.env.STALE_AFTER_DAYS ?? 14);
const MIN_GUIDE_PRODUCTS = Number(process.env.MIN_GUIDE_PRODUCTS ?? 2);
const MIN_INTRO_LENGTH = Number(process.env.MIN_INTRO_LENGTH ?? 120);

const readJson = async (filePath) => JSON.parse(await readFile(filePath, "utf8"));
const writeJson = async (filePath, value) => writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);

const dateOverride = process.env.DAILY_MAINTENANCE_DATE;
const now = dateOverride ? new Date(`${dateOverride}T00:00:00Z`) : new Date();
const today = now.toISOString().slice(0, 10);

const products = await readJson(productsPath);
const roundups = await readJson(roundupsPath);
const productBacklog = await readJson(productBacklogPath);
const productRefreshBacklog = await readJson(productRefreshBacklogPath);
const guideBacklog = await readJson(guideBacklogPath);

const existingProductIds = new Set(products.map((product) => product.id));
const existingGuideSlugs = new Set(roundups.map((roundup) => roundup.slug));

const newProducts = [];
const remainingProductBacklog = [];

for (const entry of productBacklog) {
  if (existingProductIds.has(entry.id) || newProducts.length >= MAX_NEW_PRODUCTS) {
    remainingProductBacklog.push(entry);
    continue;
  }

  newProducts.push(entry);
  existingProductIds.add(entry.id);
}

const productsWithNewItems = [...products, ...newProducts];
const productsById = new Map(productsWithNewItems.map((product) => [product.id, product]));
const appliedRefreshes = [];
const remainingProductRefreshBacklog = [];
const refreshableFields = new Set([
  "price",
  "priceCheckedAt",
  "amazonUrl",
  "description",
  "highlights",
  "isTrending",
  "image",
  "amazonQuery"
]);

for (const entry of productRefreshBacklog) {
  const target = productsById.get(entry.id);

  if (!target || appliedRefreshes.length >= MAX_PRODUCT_REFRESHES) {
    remainingProductRefreshBacklog.push(entry);
    continue;
  }

  const updates = {};

  for (const [key, value] of Object.entries(entry)) {
    if (key === "id" || !refreshableFields.has(key)) {
      continue;
    }
    updates[key] = value;
  }

  if (Object.keys(updates).length === 0) {
    continue;
  }

  productsById.set(entry.id, {
    ...target,
    ...updates
  });

  appliedRefreshes.push({
    id: entry.id,
    title: target.title,
    updatedFields: Object.keys(updates).sort()
  });
}

const mergedProducts = [...productsById.values()].sort((a, b) => a.id.localeCompare(b.id));
const mergedProductIdSet = new Set(mergedProducts.map((product) => product.id));

const newGuides = [];
const remainingGuideBacklog = [];

for (const entry of guideBacklog) {
  const referencesMissingProduct = entry.productIds.some((id) => !mergedProductIdSet.has(id));

  if (existingGuideSlugs.has(entry.slug) || newGuides.length >= MAX_NEW_GUIDES || referencesMissingProduct) {
    remainingGuideBacklog.push(entry);
    continue;
  }

  newGuides.push(entry);
  existingGuideSlugs.add(entry.slug);
}

const mergedRoundups = [...roundups, ...newGuides].sort((a, b) => a.slug.localeCompare(b.slug));

const staleProducts = mergedProducts
  .filter((product) => {
    const checkedAt = new Date(`${product.priceCheckedAt}T00:00:00Z`);
    const ageInDays = Math.floor((now.getTime() - checkedAt.getTime()) / 86_400_000);
    return ageInDays > STALE_AFTER_DAYS;
  })
  .map((product) => ({
    id: product.id,
    title: product.title,
    priceCheckedAt: product.priceCheckedAt
  }));

const productsMissingExactAmazonUrl = mergedProducts
  .filter((product) => !product.amazonUrl)
  .map((product) => ({ id: product.id, title: product.title }));

const unusedProducts = mergedProducts
  .filter((product) => !mergedRoundups.some((roundup) => roundup.productIds.includes(product.id)))
  .map((product) => ({ id: product.id, title: product.title }));

const thinGuides = mergedRoundups
  .filter((roundup) => roundup.intro.trim().length < MIN_INTRO_LENGTH)
  .map((roundup) => ({ slug: roundup.slug, title: roundup.title, introLength: roundup.intro.trim().length }));

const underfilledGuides = mergedRoundups
  .filter((roundup) => roundup.productIds.length < MIN_GUIDE_PRODUCTS)
  .map((roundup) => ({ slug: roundup.slug, title: roundup.title, productCount: roundup.productIds.length }));

const brokenGuideRefs = mergedRoundups
  .flatMap((roundup) =>
    roundup.productIds
      .filter((id) => !mergedProductIdSet.has(id))
      .map((id) => ({ roundupSlug: roundup.slug, missingProductId: id }))
  );

const invalidProducts = mergedProducts.filter(
  (product) =>
    !product.title ||
    !product.image ||
    !product.description ||
    !product.priceCheckedAt ||
    (!product.amazonUrl && !product.amazonQuery) ||
    (product.amazonUrl &&
      !["amazon.com", "www.amazon.com"].includes(new URL(product.amazonUrl).hostname))
);

const validationFailures = [
  ...brokenGuideRefs.map(({ roundupSlug, missingProductId }) => `Guide ${roundupSlug} references missing product ${missingProductId}.`),
  ...invalidProducts.map((product) => `Product ${product.id} is missing required fields.`)
];

if (newProducts.length > 0 || appliedRefreshes.length > 0) {
  await writeJson(productsPath, mergedProducts);
}

if (remainingProductBacklog.length !== productBacklog.length) {
  await writeJson(productBacklogPath, remainingProductBacklog);
}

if (remainingProductRefreshBacklog.length !== productRefreshBacklog.length) {
  await writeJson(productRefreshBacklogPath, remainingProductRefreshBacklog);
}

if (newGuides.length > 0) {
  await writeJson(roundupsPath, mergedRoundups);
}

if (remainingGuideBacklog.length !== guideBacklog.length) {
  await writeJson(guideBacklogPath, remainingGuideBacklog);
}

await mkdir(reportDir, { recursive: true });

const addSection = (lines, title, items) => {
  lines.push(`## ${title}`, "");
  if (items.length === 0) {
    lines.push("- None", "");
    return;
  }

  for (const item of items) {
    lines.push(`- ${item}`);
  }
  lines.push("");
};

const reportLines = [
  "# Daily maintenance report",
  "",
  `- Run date: ${today}`,
  `- New products added: ${newProducts.length}`,
  `- Existing products refreshed: ${appliedRefreshes.length}`,
  `- New guides added: ${newGuides.length}`,
  `- Remaining product backlog: ${remainingProductBacklog.length}`,
  `- Remaining product refresh backlog: ${remainingProductRefreshBacklog.length}`,
  `- Remaining guide backlog: ${remainingGuideBacklog.length}`,
  `- Products with stale price checks: ${staleProducts.length}`,
  `- Validation failures: ${validationFailures.length}`,
  ""
];

addSection(
  reportLines,
  "Added products today",
  newProducts.map((product) => `${product.title} (\`${product.id}\`)`)
);

addSection(
  reportLines,
  "Refreshed products today",
  appliedRefreshes.map((product) => `${product.title} (\`${product.id}\`) updated: ${product.updatedFields.join(", ")}`)
);

addSection(
  reportLines,
  "Added guides today",
  newGuides.map((guide) => `${guide.title} (\`${guide.slug}\`)`)
);

addSection(
  reportLines,
  "Price checks to refresh",
  staleProducts.map((product) => `${product.title} last checked on ${product.priceCheckedAt}`)
);

addSection(
  reportLines,
  "Products missing exact Amazon URLs",
  productsMissingExactAmazonUrl.map((product) => `${product.title} (\`${product.id}\`)`)
);

addSection(
  reportLines,
  "Unused products",
  unusedProducts.map((product) => `${product.title} (\`${product.id}\`)`)
);

addSection(
  reportLines,
  "Guides with short intros",
  thinGuides.map((guide) => `${guide.title} (\`${guide.slug}\`) intro length: ${guide.introLength}`)
);

addSection(
  reportLines,
  "Guides with too few products",
  underfilledGuides.map((guide) => `${guide.title} (\`${guide.slug}\`) product count: ${guide.productCount}`)
);

addSection(reportLines, "Validation failures", validationFailures);

await writeFile(reportPath, `${reportLines.join("\n")}\n`);

if (validationFailures.length > 0) {
  console.error(validationFailures.join("\n"));
  process.exit(1);
}

console.log(
  `Daily maintenance complete: added ${newProducts.length} product(s), refreshed ${appliedRefreshes.length} product(s), added ${newGuides.length} guide(s), ${staleProducts.length} stale price check(s), ${validationFailures.length} validation failure(s).`
);
