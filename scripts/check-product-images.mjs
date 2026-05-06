import { access, readFile, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import products from "../src/data/source/products.source.json" with { type: "json" };

const root = process.cwd();
const missing = [];
const tiny = [];
const unsupported = [];
const lowResolution = [];
const placeholderLike = [];
const MIN_IMAGE_BYTES = 5_000;
const MIN_IMAGE_SIDE = 420;

const readPngDimensions = (buffer) => {
  if (buffer.toString("ascii", 1, 4) !== "PNG") {
    return null;
  }

  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20)
  };
};

const readJpegDimensions = (buffer) => {
  if (buffer[0] !== 0xff || buffer[1] !== 0xd8) {
    return null;
  }

  let offset = 2;
  const sofMarkers = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);

  while (offset < buffer.length - 9) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = buffer[offset + 1];
    const segmentLength = buffer.readUInt16BE(offset + 2);

    if (sofMarkers.has(marker)) {
      return {
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7)
      };
    }

    offset += 2 + segmentLength;
  }

  return null;
};

const readImageDimensions = (buffer, extension) => {
  if (extension === ".png") {
    return readPngDimensions(buffer);
  }

  if ([".jpg", ".jpeg"].includes(extension)) {
    return readJpegDimensions(buffer);
  }

  return null;
};

for (const product of products) {
  const imagePath = path.join(root, "public", product.image.replace(/^\//, ""));
  const extension = path.extname(product.image).toLowerCase();

  if (extension === ".svg" || ![".png", ".jpg", ".jpeg"].includes(extension)) {
    unsupported.push(`${product.title} (${product.id}) must use a raster PNG/JPG product image: ${product.image}`);
    continue;
  }

  if (/placeholder|fallback|coming-soon|sample/i.test(product.image)) {
    placeholderLike.push(`${product.title} (${product.id}) appears to use a placeholder image name: ${product.image}`);
  }

  try {
    await access(imagePath);
    const fileStat = await stat(imagePath);
    const buffer = await readFile(imagePath);
    const dimensions = readImageDimensions(buffer, extension);

    if (fileStat.size < MIN_IMAGE_BYTES) {
      tiny.push(`${product.title} (${product.id}) uses a very small image asset: ${product.image}`);
    }

    if (!dimensions || dimensions.width < MIN_IMAGE_SIDE || dimensions.height < MIN_IMAGE_SIDE) {
      lowResolution.push(
        `${product.title} (${product.id}) image should be at least ${MIN_IMAGE_SIDE}x${MIN_IMAGE_SIDE}: ${product.image}`
      );
    }
  } catch {
    missing.push(`${product.title} (${product.id}) is missing ${product.image}`);
  }
}

if (missing.length > 0 || tiny.length > 0 || unsupported.length > 0 || lowResolution.length > 0 || placeholderLike.length > 0) {
  for (const item of [...missing, ...unsupported, ...tiny, ...lowResolution, ...placeholderLike]) {
    console.error(`Image issue: ${item}`);
  }

  process.exit(1);
}

console.log(`Product image check passed for ${products.length} product(s).`);
