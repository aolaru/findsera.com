import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const productsPath = path.join(root, "src/data/source/products.source.json");
const roundupsPath = path.join(root, "src/data/source/roundups.source.json");
const contentMapPath = path.join(root, "src/data/source/content-map.json");
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
const REQUIRE_EXACT_AMAZON_URLS = process.env.REQUIRE_EXACT_AMAZON_URLS === "true";

const readJson = async (filePath) => JSON.parse(await readFile(filePath, "utf8"));
const writeJson = async (filePath, value) => writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
const allowedCategories = new Set(["gadgets", "kitchen", "home"]);
const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const dateOverride = process.env.DAILY_MAINTENANCE_DATE;
const now = dateOverride ? new Date(`${dateOverride}T00:00:00Z`) : new Date();
const today = now.toISOString().slice(0, 10);

const products = await readJson(productsPath);
const roundups = await readJson(roundupsPath);
const contentMap = await readJson(contentMapPath);
const productBacklog = await readJson(productBacklogPath);
const productRefreshBacklog = await readJson(productRefreshBacklogPath);
const guideBacklog = await readJson(guideBacklogPath);

const validationFailures = [];

const ensureArrayOfStrings = (value) => Array.isArray(value) && value.every((item) => typeof item === "string" && item.trim().length > 0);

const validateAmazonUrl = (amazonUrl, label) => {
  try {
    const hostname = new URL(amazonUrl).hostname;
    if (!["amazon.com", "www.amazon.com"].includes(hostname)) {
      validationFailures.push(`${label} has invalid Amazon hostname: ${amazonUrl}`);
    }
  } catch {
    validationFailures.push(`${label} has invalid Amazon URL: ${amazonUrl}`);
  }
};

const validateProductRecord = (product, label, { requireAmazonUrl = false } = {}) => {
  if (!product.id || typeof product.id !== "string" || !slugPattern.test(product.id)) {
    validationFailures.push(`${label} must have a valid slug-style id.`);
  }

  if (!product.title || typeof product.title !== "string") {
    validationFailures.push(`${label} is missing title.`);
  }

  if (!product.brand || typeof product.brand !== "string") {
    validationFailures.push(`${label} is missing brand.`);
  }

  if (!allowedCategories.has(product.category)) {
    validationFailures.push(`${label} has invalid category: ${product.category}.`);
  }

  if (typeof product.price !== "number" || Number.isNaN(product.price) || product.price <= 0) {
    validationFailures.push(`${label} has invalid price.`);
  }

  if (!product.image || typeof product.image !== "string" || !product.image.startsWith("/images/")) {
    validationFailures.push(`${label} must use a local /images/ path.`);
  }

  if (!product.description || typeof product.description !== "string" || product.description.trim().length < 40) {
    validationFailures.push(`${label} needs a longer description.`);
  }

  if (!product.priceCheckedAt || !isoDatePattern.test(product.priceCheckedAt)) {
    validationFailures.push(`${label} must have a valid YYYY-MM-DD priceCheckedAt value.`);
  }

  if (!ensureArrayOfStrings(product.tags) || product.tags.length < 2) {
    validationFailures.push(`${label} must have at least 2 tags.`);
  }

  if (!ensureArrayOfStrings(product.highlights) || product.highlights.length < 2) {
    validationFailures.push(`${label} must have at least 2 highlights.`);
  }

  if (typeof product.isTrending !== "boolean") {
    validationFailures.push(`${label} must set isTrending to true or false.`);
  }

  if (product.amazonUrl) {
    validateAmazonUrl(product.amazonUrl, label);
  }

  if (!product.amazonUrl && (!product.amazonQuery || typeof product.amazonQuery !== "string")) {
    validationFailures.push(`${label} must include amazonQuery when amazonUrl is missing.`);
  }

  if (requireAmazonUrl && !product.amazonUrl) {
    validationFailures.push(`${label} requires an exact amazonUrl before promotion.`);
  }
};

const validateGuideRecord = (guide, label, knownProductIds = new Set(), { requireExistingProducts = false } = {}) => {
  if (!guide.slug || typeof guide.slug !== "string" || !slugPattern.test(guide.slug)) {
    validationFailures.push(`${label} must have a valid slug.`);
  }

  if (!guide.title || typeof guide.title !== "string") {
    validationFailures.push(`${label} is missing title.`);
  }

  if (!guide.seoTitle || typeof guide.seoTitle !== "string") {
    validationFailures.push(`${label} is missing seoTitle.`);
  }

  if (!guide.description || typeof guide.description !== "string" || guide.description.trim().length < 40) {
    validationFailures.push(`${label} needs a longer description.`);
  }

  if (guide.category !== null && !allowedCategories.has(guide.category)) {
    validationFailures.push(`${label} has invalid category: ${guide.category}.`);
  }

  if (!guide.cluster || typeof guide.cluster !== "string" || !slugPattern.test(guide.cluster)) {
    validationFailures.push(`${label} must have a valid cluster slug.`);
  }

  if (!guide.updatedAt || !isoDatePattern.test(guide.updatedAt)) {
    validationFailures.push(`${label} must have a valid YYYY-MM-DD updatedAt value.`);
  }

  if (!guide.intro || typeof guide.intro !== "string" || guide.intro.trim().length < MIN_INTRO_LENGTH) {
    validationFailures.push(`${label} intro is too short.`);
  }

  if (!Array.isArray(guide.productIds) || guide.productIds.length < MIN_GUIDE_PRODUCTS) {
    validationFailures.push(`${label} must include at least ${MIN_GUIDE_PRODUCTS} products.`);
  } else if (new Set(guide.productIds).size !== guide.productIds.length) {
    validationFailures.push(`${label} contains duplicate productIds.`);
  } else if (requireExistingProducts && guide.productIds.some((id) => !knownProductIds.has(id))) {
    validationFailures.push(`${label} references products not in the current catalog or queue.`);
  }

  if (
    !Array.isArray(guide.sections) ||
    guide.sections.length === 0 ||
    guide.sections.some(
      (section) =>
        !section ||
        typeof section.title !== "string" ||
        !section.title.trim() ||
        typeof section.body !== "string" ||
        section.body.trim().length < 40
    )
  ) {
    validationFailures.push(`${label} must include fully populated sections.`);
  }

  if (
    !Array.isArray(guide.faqs) ||
    guide.faqs.length === 0 ||
    guide.faqs.some(
      (faq) =>
        !faq ||
        typeof faq.question !== "string" ||
        !faq.question.trim() ||
        typeof faq.answer !== "string" ||
        faq.answer.trim().length < 20
    )
  ) {
    validationFailures.push(`${label} must include valid FAQs.`);
  }
};

const sourceProductIds = new Set(products.map((product) => product.id));
const sourceGuideSlugs = new Set(roundups.map((roundup) => roundup.slug));
const queuedProductIds = new Set();
const queuedGuideSlugs = new Set();

for (const product of products) {
  validateProductRecord(product, `Source product ${product.id}`);
}

for (const entry of productBacklog) {
  validateProductRecord(entry, `Queued product ${entry.id}`, { requireAmazonUrl: REQUIRE_EXACT_AMAZON_URLS });
  if (sourceProductIds.has(entry.id)) {
    validationFailures.push(`Queued product ${entry.id} already exists in the live product catalog.`);
  }
  if (queuedProductIds.has(entry.id)) {
    validationFailures.push(`Queued product ${entry.id} appears more than once in product-backlog.json.`);
  }
  queuedProductIds.add(entry.id);
}

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
  if (!entry.id || typeof entry.id !== "string") {
    validationFailures.push("Product refresh entries must include an id.");
    continue;
  }

  if (!sourceProductIds.has(entry.id) && !queuedProductIds.has(entry.id)) {
    validationFailures.push(`Product refresh entry ${entry.id} does not target a known live or queued product.`);
  }

  const keys = Object.keys(entry).filter((key) => key !== "id");
  if (keys.length === 0) {
    validationFailures.push(`Product refresh entry ${entry.id} does not update any fields.`);
  }

  for (const key of keys) {
    if (!refreshableFields.has(key)) {
      validationFailures.push(`Product refresh entry ${entry.id} updates unsupported field ${key}.`);
    }
  }

  if (entry.amazonUrl) {
    validateAmazonUrl(entry.amazonUrl, `Product refresh entry ${entry.id}`);
  }

  if (entry.priceCheckedAt && !isoDatePattern.test(entry.priceCheckedAt)) {
    validationFailures.push(`Product refresh entry ${entry.id} has invalid priceCheckedAt.`);
  }
}

const knownProductIdsForGuides = new Set([...sourceProductIds, ...queuedProductIds]);

for (const roundup of roundups) {
  validateGuideRecord(roundup, `Source guide ${roundup.slug}`, knownProductIdsForGuides, {
    requireExistingProducts: true
  });
}

for (const entry of guideBacklog) {
  validateGuideRecord(entry, `Queued guide ${entry.slug}`, knownProductIdsForGuides, {
    requireExistingProducts: true
  });
  if (sourceGuideSlugs.has(entry.slug)) {
    validationFailures.push(`Queued guide ${entry.slug} already exists in the live guide catalog.`);
  }
  if (queuedGuideSlugs.has(entry.slug)) {
    validationFailures.push(`Queued guide ${entry.slug} appears more than once in guide-backlog.json.`);
  }
  queuedGuideSlugs.add(entry.slug);
}

const knownGuideSlugsForContentMap = new Set([...sourceGuideSlugs, ...queuedGuideSlugs]);

if (!contentMap || Array.isArray(contentMap) || typeof contentMap !== "object") {
  validationFailures.push("content-map.json must be an object keyed by product id.");
} else {
  for (const [productId, entry] of Object.entries(contentMap)) {
    if (!sourceProductIds.has(productId) && !queuedProductIds.has(productId)) {
      validationFailures.push(`Content map entry ${productId} does not match a live or queued product.`);
      continue;
    }

    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      validationFailures.push(`Content map entry ${productId} must be an object.`);
      continue;
    }

    if (!entry.primaryGuide || typeof entry.primaryGuide !== "string") {
      validationFailures.push(`Content map entry ${productId} must include a primaryGuide.`);
    } else if (!knownGuideSlugsForContentMap.has(entry.primaryGuide)) {
      validationFailures.push(`Content map entry ${productId} references unknown primaryGuide ${entry.primaryGuide}.`);
    }

    for (const field of ["supportingGuides", "comparisonGuides", "buyerIntents", "nextContentIdeas"]) {
      if (!ensureArrayOfStrings(entry[field])) {
        validationFailures.push(`Content map entry ${productId} must include ${field} as an array of strings.`);
      }
    }

    for (const field of ["supportingGuides", "comparisonGuides"]) {
      for (const guideSlug of entry[field] ?? []) {
        if (!knownGuideSlugsForContentMap.has(guideSlug)) {
          validationFailures.push(`Content map entry ${productId} references unknown ${field} guide ${guideSlug}.`);
        }
      }
    }
  }
}

if (validationFailures.length > 0) {
  console.error(validationFailures.join("\n"));
  process.exit(1);
}

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

const contentMapGaps = mergedProducts
  .filter((product) => !contentMap[product.id])
  .map((product) => ({ id: product.id, title: product.title }));

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

const postMergeValidationFailures = [
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
  `- Products missing content-map coverage: ${contentMapGaps.length}`,
  `- Validation failures: ${postMergeValidationFailures.length}`,
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
  "Products missing content-map coverage",
  contentMapGaps.map((product) => `${product.title} (\`${product.id}\`)`)
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

addSection(reportLines, "Validation failures", postMergeValidationFailures);

await writeFile(reportPath, `${reportLines.join("\n")}\n`);

if (postMergeValidationFailures.length > 0) {
  console.error(postMergeValidationFailures.join("\n"));
  process.exit(1);
}

console.log(
  `Daily maintenance complete: added ${newProducts.length} product(s), refreshed ${appliedRefreshes.length} product(s), added ${newGuides.length} guide(s), ${staleProducts.length} stale price check(s), ${postMergeValidationFailures.length} validation failure(s).`
);
