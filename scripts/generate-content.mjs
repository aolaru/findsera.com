import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const AMAZON_TAG = "kreativauto-20";
const root = process.cwd();

const sourceProductsPath = path.join(root, "src/data/source/products.source.json");
const sourceRoundupsPath = path.join(root, "src/data/source/roundups.source.json");
const generatedDir = path.join(root, "src/data/generated");
const generatedProductsPath = path.join(generatedDir, "products.generated.json");
const generatedRoundupsPath = path.join(generatedDir, "roundups.generated.json");
const generatedTopicsPath = path.join(generatedDir, "topics.generated.json");
const generatedClustersPath = path.join(generatedDir, "clusters.generated.json");

const categorySet = new Set(["gadgets", "kitchen", "home"]);

const readJson = async (filePath) => JSON.parse(await readFile(filePath, "utf8"));

const slugify = (value) =>
  value
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const startCase = (value) =>
  value
    .split("-")
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");

const formatPrice = (price) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: price % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2
  }).format(price);

const createAmazonAffiliateUrl = (rawUrl) => {
  const url = new URL(rawUrl);
  url.searchParams.set("tag", AMAZON_TAG);
  return url.toString();
};

const createSearchAffiliateUrl = (amazonQuery) => {
  const url = new URL("https://www.amazon.com/s");
  url.searchParams.set("k", amazonQuery);
  url.searchParams.set("tag", AMAZON_TAG);
  return url.toString();
};

const fail = (message) => {
  console.error(message);
  process.exit(1);
};

const sourceProducts = await readJson(sourceProductsPath);
const sourceRoundups = await readJson(sourceRoundupsPath);

const seenProductIds = new Set();
const warnings = [];

const generatedProducts = sourceProducts.map((product) => {
  if (seenProductIds.has(product.id)) {
    fail(`Duplicate product id: ${product.id}`);
  }

  seenProductIds.add(product.id);

  if (!categorySet.has(product.category)) {
    fail(`Invalid product category for ${product.id}: ${product.category}`);
  }

  const exactAmazonUrl = product.amazonUrl ? createAmazonAffiliateUrl(product.amazonUrl) : null;
  if (!exactAmazonUrl && !product.amazonQuery) {
    fail(`Missing amazonQuery fallback for ${product.id}`);
  }

  if (!exactAmazonUrl) {
    warnings.push(`Missing exact Amazon URL for ${product.id}; using search affiliate fallback.`);
  }

  return {
    ...product,
    slug: slugify(product.id),
    priceLabel: formatPrice(product.price),
    affiliateUrl: exactAmazonUrl ?? createSearchAffiliateUrl(product.amazonQuery),
    affiliateMode: exactAmazonUrl ? "exact" : "search"
  };
});

const productIdSet = new Set(generatedProducts.map((product) => product.id));
const seenRoundupSlugs = new Set();

const generatedRoundups = sourceRoundups.map((roundup) => {
  if (seenRoundupSlugs.has(roundup.slug)) {
    fail(`Duplicate roundup slug: ${roundup.slug}`);
  }

  seenRoundupSlugs.add(roundup.slug);

  for (const productId of roundup.productIds) {
    if (!productIdSet.has(productId)) {
      fail(`Roundup ${roundup.slug} references missing product: ${productId}`);
    }
  }

  if (roundup.category !== null && !categorySet.has(roundup.category)) {
    fail(`Invalid roundup category for ${roundup.slug}: ${roundup.category}`);
  }

  return {
    ...roundup,
    productCount: roundup.productIds.length
  };
});

const topicMap = new Map();

for (const product of generatedProducts) {
  for (const tag of product.tags) {
    const slug = slugify(tag);
    const current = topicMap.get(slug) ?? {
      slug,
      title: startCase(slug),
      description: `Findsera content related to ${tag}.`,
      productIds: [],
      roundupSlugs: [],
      categoryCounts: {}
    };

    current.productIds.push(product.id);
    current.categoryCounts[product.category] = (current.categoryCounts[product.category] ?? 0) + 1;
    topicMap.set(slug, current);
  }
}

for (const roundup of generatedRoundups) {
  const topic = topicMap.get(slugify(roundup.cluster)) ?? {
    slug: slugify(roundup.cluster),
    title: startCase(slugify(roundup.cluster)),
    description: `Findsera content related to ${roundup.cluster}.`,
    productIds: [],
    roundupSlugs: [],
    categoryCounts: {}
  };

  topic.roundupSlugs.push(roundup.slug);
  topic.description = `${startCase(slugify(roundup.cluster))} guides, products, and roundup pages on Findsera.`;
  topicMap.set(topic.slug, topic);
}

const generatedTopics = [...topicMap.values()]
  .map((topic) => ({
    ...topic,
    productIds: [...new Set(topic.productIds)],
    roundupSlugs: [...new Set(topic.roundupSlugs)],
    productCount: [...new Set(topic.productIds)].length,
    roundupCount: [...new Set(topic.roundupSlugs)].length
  }))
  .sort((a, b) => a.slug.localeCompare(b.slug));

const clusterMap = new Map();

for (const roundup of generatedRoundups) {
  const slug = slugify(roundup.cluster);
  const current = clusterMap.get(slug) ?? {
    slug,
    title: startCase(slug),
    description: `${startCase(slug)} cluster pages on Findsera.`,
    roundupSlugs: [],
    categories: []
  };

  current.roundupSlugs.push(roundup.slug);
  if (roundup.category && !current.categories.includes(roundup.category)) {
    current.categories.push(roundup.category);
  }

  clusterMap.set(slug, current);
}

const generatedClusters = [...clusterMap.values()]
  .map((cluster) => ({
    ...cluster,
    roundupSlugs: [...new Set(cluster.roundupSlugs)],
    roundupCount: [...new Set(cluster.roundupSlugs)].length
  }))
  .sort((a, b) => a.slug.localeCompare(b.slug));

await mkdir(generatedDir, { recursive: true });
await writeFile(generatedProductsPath, `${JSON.stringify(generatedProducts, null, 2)}\n`);
await writeFile(generatedRoundupsPath, `${JSON.stringify(generatedRoundups, null, 2)}\n`);
await writeFile(generatedTopicsPath, `${JSON.stringify(generatedTopics, null, 2)}\n`);
await writeFile(generatedClustersPath, `${JSON.stringify(generatedClusters, null, 2)}\n`);

if (warnings.length > 0) {
  console.warn(warnings.join("\n"));
}

console.log(
  `Generated ${generatedProducts.length} products, ${generatedRoundups.length} roundups, ${generatedTopics.length} topics, and ${generatedClusters.length} clusters with Amazon tag ${AMAZON_TAG}.`
);
