import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const sourcePath = path.join(root, "src/data/source/products.source.json");
const importPath = process.argv[2];

if (!importPath) {
  console.error("Usage: node scripts/import-products.mjs <path-to-json>");
  process.exit(1);
}

const absoluteImportPath = path.resolve(root, importPath);
const existing = JSON.parse(await readFile(sourcePath, "utf8"));
const incoming = JSON.parse(await readFile(absoluteImportPath, "utf8"));

const map = new Map(existing.map((product) => [product.id, product]));

for (const product of incoming) {
  if (!product.id) {
    console.error("Each imported product must include an id.");
    process.exit(1);
  }

  map.set(product.id, { ...map.get(product.id), ...product });
}

const merged = [...map.values()].sort((a, b) => a.id.localeCompare(b.id));
await writeFile(sourcePath, `${JSON.stringify(merged, null, 2)}\n`);

console.log(`Imported ${incoming.length} products into ${sourcePath}.`);
