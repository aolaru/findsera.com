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

const readWebpDimensions = (buffer) => {
  if (buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WEBP") {
    return null;
  }

  const chunkType = buffer.toString("ascii", 12, 16);

  if (chunkType === "VP8X" && buffer.length >= 30) {
    const width = 1 + buffer.readUIntLE(24, 3);
    const height = 1 + buffer.readUIntLE(27, 3);
    return { width, height };
  }

  if (chunkType === "VP8L" && buffer.length >= 25 && buffer[20] === 0x2f) {
    const b0 = buffer[21];
    const b1 = buffer[22];
    const b2 = buffer[23];
    const b3 = buffer[24];
    const width = 1 + (((b1 & 0x3f) << 8) | b0);
    const height = 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6));
    return { width, height };
  }

  if (chunkType === "VP8 " && buffer.length >= 30 && buffer[23] === 0x9d && buffer[24] === 0x01 && buffer[25] === 0x2a) {
    const width = buffer.readUInt16LE(26) & 0x3fff;
    const height = buffer.readUInt16LE(28) & 0x3fff;
    return { width, height };
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

  if (extension === ".webp") {
    return readWebpDimensions(buffer);
  }

  return null;
};

for (const product of products) {
  const imagePath = path.join(root, "public", product.image.replace(/^\//, ""));
  const extension = path.extname(product.image).toLowerCase();

  if (extension === ".svg" || ![".png", ".jpg", ".jpeg", ".webp"].includes(extension)) {
    unsupported.push(`${product.title} (${product.id}) must use a raster PNG/JPG/WebP product image: ${product.image}`);
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
