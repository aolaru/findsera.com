import { access, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import products from "../src/data/source/products.source.json" with { type: "json" };

const root = process.cwd();
const missing = [];
const tiny = [];

for (const product of products) {
  const imagePath = path.join(root, "public", product.image.replace(/^\//, ""));

  try {
    await access(imagePath);
    const fileStat = await stat(imagePath);

    if (fileStat.size < 700) {
      tiny.push(`${product.title} (${product.id}) uses a very small image asset: ${product.image}`);
    }
  } catch {
    missing.push(`${product.title} (${product.id}) is missing ${product.image}`);
  }
}

if (missing.length > 0 || tiny.length > 0) {
  for (const item of missing) {
    console.error(`Missing: ${item}`);
  }

  for (const item of tiny) {
    console.error(`Review: ${item}`);
  }

  process.exit(1);
}

console.log(`Product image check passed for ${products.length} product(s).`);
