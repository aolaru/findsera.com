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

const categorySet = new Set(["gadgets", "kitchen", "home"]);

const readJson = async (filePath) => JSON.parse(await readFile(filePath, "utf8"));

const slugify = (value) =>
  value
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const formatPrice = (price) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: price % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2
  }).format(price);

const createAffiliateUrl = (amazonQuery) => {
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
const generatedProducts = sourceProducts.map((product) => {
  if (seenProductIds.has(product.id)) {
    fail(`Duplicate product id: ${product.id}`);
  }

  seenProductIds.add(product.id);

  if (!categorySet.has(product.category)) {
    fail(`Invalid product category for ${product.id}: ${product.category}`);
  }

  if (!product.amazonQuery) {
    fail(`Missing amazonQuery for ${product.id}`);
  }

  return {
    ...product,
    slug: slugify(product.id),
    priceLabel: formatPrice(product.price),
    affiliateUrl: createAffiliateUrl(product.amazonQuery)
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

await mkdir(generatedDir, { recursive: true });
await writeFile(generatedProductsPath, `${JSON.stringify(generatedProducts, null, 2)}\n`);
await writeFile(generatedRoundupsPath, `${JSON.stringify(generatedRoundups, null, 2)}\n`);

console.log(
  `Generated ${generatedProducts.length} products and ${generatedRoundups.length} roundups with Amazon tag ${AMAZON_TAG}.`
);
