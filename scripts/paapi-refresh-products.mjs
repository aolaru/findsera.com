import { createHash, createHmac } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const productsPath = path.join(root, "src/data/source/products.source.json");
const reportDir = path.join(root, "reports");
const reportPath = path.join(reportDir, "paapi-refresh.md");
const imageDir = path.join(root, "public/images/products");

const host = process.env.AMAZON_PAAPI_HOST || "webservices.amazon.com";
const region = process.env.AMAZON_PAAPI_REGION || "us-east-1";
const marketplace = process.env.AMAZON_PAAPI_MARKETPLACE || "www.amazon.com";
const partnerTag = process.env.AMAZON_PAAPI_PARTNER_TAG || "kreativauto-20";
const accessKey = process.env.AMAZON_PAAPI_ACCESS_KEY;
const secretKey = process.env.AMAZON_PAAPI_SECRET_KEY;
const refreshLimit = Number(process.env.PAAPI_REFRESH_LIMIT ?? 8);
const selectedProductIds = (process.env.PAAPI_REFRESH_PRODUCT_IDS ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const updateEditorialTitles = process.env.PAAPI_OVERWRITE_TITLES === "true";
const updateLocalImages = process.env.PAAPI_UPDATE_LOCAL_IMAGES === "true";
const dryRun = process.env.PAAPI_DRY_RUN === "true";
const failOnError = process.env.PAAPI_FAIL_ON_ERROR === "true";

const service = "ProductAdvertisingAPI";
const target = "com.amazon.paapi5.v1.ProductAdvertisingAPIv1.GetItems";
const endpointPath = "/paapi5/getitems";
const resources = ["Images.Primary.Large", "ItemInfo.Title", "OffersV2.Listings.Price"];

const readJson = async (filePath) => JSON.parse(await readFile(filePath, "utf8"));
const writeJson = async (filePath, value) => writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
const hash = (value) => createHash("sha256").update(value, "utf8").digest("hex");
const hmac = (key, value, encoding) => createHmac("sha256", key).update(value, "utf8").digest(encoding);
const formatAmzDate = (date) => date.toISOString().replace(/[:-]|\.\d{3}/g, "");
const formatDateStamp = (date) => date.toISOString().slice(0, 10).replace(/-/g, "");
const today = new Date().toISOString().slice(0, 10);

const toPrice = (value) => {
  if (typeof value !== "number" || Number.isNaN(value) || value <= 0) {
    return null;
  }

  return Math.round(value * 100) / 100;
};

const extractAsin = (amazonUrl) => {
  if (!amazonUrl) {
    return null;
  }

  try {
    const url = new URL(amazonUrl);
    const match = url.pathname.match(/\/(?:dp|gp\/product|product)\/([A-Z0-9]{10})(?:[/?]|$)?/i);
    return match?.[1]?.toUpperCase() ?? null;
  } catch {
    return null;
  }
};

const getSigningKey = (dateStamp) => {
  const dateKey = hmac(`AWS4${secretKey}`, dateStamp);
  const dateRegionKey = hmac(dateKey, region);
  const dateRegionServiceKey = hmac(dateRegionKey, service);
  return hmac(dateRegionServiceKey, "aws4_request");
};

const signRequest = (body, date) => {
  const amzDate = formatAmzDate(date);
  const dateStamp = formatDateStamp(date);
  const canonicalHeaders = [
    "content-encoding:amz-1.0",
    "content-type:application/json; charset=utf-8",
    `host:${host}`,
    `x-amz-date:${amzDate}`,
    `x-amz-target:${target}`
  ].join("\n");
  const signedHeaders = "content-encoding;content-type;host;x-amz-date;x-amz-target";
  const canonicalRequest = ["POST", endpointPath, "", `${canonicalHeaders}\n`, signedHeaders, hash(body)].join("\n");
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, credentialScope, hash(canonicalRequest)].join("\n");
  const signature = hmac(getSigningKey(dateStamp), stringToSign, "hex");

  return {
    "Content-Encoding": "amz-1.0",
    "Content-Type": "application/json; charset=utf-8",
    Host: host,
    "X-Amz-Date": amzDate,
    "X-Amz-Target": target,
    Authorization: `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`
  };
};

const getItems = async (asins) => {
  const body = JSON.stringify({
    ItemIds: asins,
    Resources: resources,
    PartnerTag: partnerTag,
    PartnerType: "Associates",
    Marketplace: marketplace
  });
  const response = await fetch(`https://${host}${endpointPath}`, {
    method: "POST",
    headers: signRequest(body, new Date()),
    body
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = payload?.Errors?.map((error) => `${error.Code}: ${error.Message}`).join("; ");
    throw new Error(message || `PA-API request failed with HTTP ${response.status}`);
  }

  return payload;
};

const extensionForContentType = (contentType) => {
  if (contentType.includes("image/png")) {
    return ".png";
  }

  if (contentType.includes("image/webp")) {
    return ".webp";
  }

  return ".jpg";
};

const downloadProductImage = async (productId, imageUrl) => {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Image download failed with HTTP ${response.status}`);
  }

  const contentType = response.headers.get("content-type") ?? "image/jpeg";
  const filePath = path.join(imageDir, `${productId}${extensionForContentType(contentType)}`);
  const bytes = Buffer.from(await response.arrayBuffer());

  await mkdir(imageDir, { recursive: true });
  await writeFile(filePath, bytes);

  return `/images/products/${path.basename(filePath)}`;
};

const reportAndExit = async (lines, exitCode = 0) => {
  await mkdir(reportDir, { recursive: true });
  await writeFile(reportPath, `${lines.join("\n")}\n`);
  console.log(lines.filter(Boolean).slice(0, 8).join("\n"));
  process.exit(exitCode);
};

if (!accessKey || !secretKey) {
  await reportAndExit([
    "# Amazon PA-API refresh report",
    "",
    `- Run date: ${today}`,
    "- Status: skipped",
    "- Reason: missing AMAZON_PAAPI_ACCESS_KEY or AMAZON_PAAPI_SECRET_KEY",
    "",
    "Add the PA-API credentials as GitHub Actions secrets to enable automated price, title, and image refreshes."
  ]);
}

const products = await readJson(productsPath);
const candidates = products
  .map((product) => ({ product, asin: extractAsin(product.amazonUrl) }))
  .filter(({ product, asin }) => asin && (selectedProductIds.length === 0 || selectedProductIds.includes(product.id)))
  .sort((a, b) => a.product.priceCheckedAt.localeCompare(b.product.priceCheckedAt))
  .slice(0, Math.max(1, refreshLimit));

if (candidates.length === 0) {
  await reportAndExit([
    "# Amazon PA-API refresh report",
    "",
    `- Run date: ${today}`,
    "- Status: skipped",
    "- Reason: no products with parseable Amazon ASINs matched the refresh criteria"
  ]);
}

const errors = [];
const refreshed = [];
const itemsByAsin = new Map();

for (let index = 0; index < candidates.length; index += 10) {
  const batch = candidates.slice(index, index + 10).map(({ asin }) => asin);

  try {
    const payload = await getItems(batch);
    for (const item of payload?.ItemsResult?.Items ?? []) {
      itemsByAsin.set(item.ASIN, item);
    }

    for (const error of payload?.Errors ?? []) {
      errors.push(`${error.Code}: ${error.Message}`);
    }
  } catch (error) {
    errors.push(error.message);
  }
}

const updatedProducts = [];

for (const product of products) {
  const asin = extractAsin(product.amazonUrl);
  const item = asin ? itemsByAsin.get(asin) : null;

  if (!item) {
    updatedProducts.push(product);
    continue;
  }

  const retailerTitle = item.ItemInfo?.Title?.DisplayValue;
  const retailerImageUrl = item.Images?.Primary?.Large?.URL;
  const price = toPrice(item.OffersV2?.Listings?.[0]?.Price?.Amount ?? item.Offers?.Listings?.[0]?.Price?.Amount);
  const updates = {};

  if (retailerTitle) {
    updates.retailerTitle = retailerTitle;
    if (updateEditorialTitles) {
      updates.title = retailerTitle;
    }
  }

  if (retailerImageUrl) {
    updates.retailerImageUrl = retailerImageUrl;

    if (updateLocalImages) {
      try {
        updates.image = await downloadProductImage(product.id, retailerImageUrl);
      } catch (error) {
        errors.push(`${product.id}: ${error.message}`);
      }
    }
  }

  if (price) {
    updates.price = price;
    updates.priceCheckedAt = today;
  }

  if (asin) {
    updates.amazonUrl = `https://www.amazon.com/dp/${asin}`;
  }

  updatedProducts.push({ ...product, ...updates });
  refreshed.push({ id: product.id, title: product.title, asin, fields: Object.keys(updates).sort() });
}

if (!dryRun && refreshed.length > 0) {
  await writeJson(productsPath, updatedProducts);
}

const lines = [
  "# Amazon PA-API refresh report",
  "",
  `- Run date: ${today}`,
  `- Status: ${errors.length > 0 ? "completed with warnings" : "completed"}`,
  `- Products requested: ${candidates.length}`,
  `- Products refreshed: ${refreshed.length}`,
  `- Local image downloads: ${updateLocalImages ? "enabled" : "disabled"}`,
  `- Dry run: ${dryRun ? "yes" : "no"}`,
  "",
  "## Refreshed products",
  "",
  ...(refreshed.length === 0
    ? ["- None"]
    : refreshed.map((product) => `- ${product.title} (\`${product.id}\`, ${product.asin}) updated: ${product.fields.join(", ")}`)),
  "",
  "## Warnings",
  "",
  ...(errors.length === 0 ? ["- None"] : errors.map((error) => `- ${error}`))
];

await reportAndExit(lines, failOnError && errors.length > 0 ? 1 : 0);
