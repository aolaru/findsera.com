import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const sourcePath = path.join(root, "src/data/source/products.source.json");
const overridesPath = process.argv[2];

if (!overridesPath) {
  console.error("Usage: node scripts/refresh-products.mjs <path-to-overrides-json>");
  process.exit(1);
}

const absoluteOverridesPath = path.resolve(root, overridesPath);
const sourceProducts = JSON.parse(await readFile(sourcePath, "utf8"));
const overrides = JSON.parse(await readFile(absoluteOverridesPath, "utf8"));
const overrideMap = new Map(overrides.map((entry) => [entry.id, entry]));

const refreshed = sourceProducts.map((product) => {
  const override = overrideMap.get(product.id);
  return override ? { ...product, ...override } : product;
});

await writeFile(sourcePath, `${JSON.stringify(refreshed, null, 2)}\n`);
console.log(`Applied ${overrides.length} refresh overrides to ${sourcePath}.`);
