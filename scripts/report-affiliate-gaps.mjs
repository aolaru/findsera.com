import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const sourcePath = path.join(root, "src/data/source/products.source.json");
const products = JSON.parse(await readFile(sourcePath, "utf8"));

const missingExact = products.filter((product) => !product.amazonUrl);

if (missingExact.length === 0) {
  console.log("All products have exact Amazon URLs.");
  process.exit(0);
}

console.log("Products still using Amazon search fallback:");
for (const product of missingExact) {
  console.log(`- ${product.id}: ${product.amazonQuery}`);
}
