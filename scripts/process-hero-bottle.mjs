import sharp from "sharp";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pub = path.join(__dirname, "..", "public");
const SRC = path.join(pub, "homepage image.png");

// ---- Load raw RGB ----
const img = sharp(SRC).ensureAlpha();
const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
const { width: W, height: H, channels: C } = info; // C === 4
const px = (x, y) => (y * W + x) * C;

// near-white test: all channels high and low saturation
function isBg(x, y) {
  const i = px(x, y);
  const r = data[i], g = data[i + 1], b = data[i + 2];
  const min = Math.min(r, g, b);
  const max = Math.max(r, g, b);
  return min >= 232 && max - min <= 18; // bright + nearly grey
}

// ---- BFS flood fill from the border ----
const visited = new Uint8Array(W * H);
const stack = [];
const seed = (x, y) => {
  const k = y * W + x;
  if (!visited[k] && isBg(x, y)) {
    visited[k] = 1;
    stack.push(k);
  }
};
for (let x = 0; x < W; x++) { seed(x, 0); seed(x, H - 1); }
for (let y = 0; y < H; y++) { seed(0, y); seed(W - 1, y); }

while (stack.length) {
  const k = stack.pop();
  const x = k % W, y = (k - x) / W;
  if (x > 0) seed(x - 1, y);
  if (x < W - 1) seed(x + 1, y);
  if (y > 0) seed(x, y - 1);
  if (y < H - 1) seed(x, y + 1);
}

// background pixels -> alpha 0
for (let k = 0; k < W * H; k++) {
  if (visited[k]) data[k * C + 3] = 0;
}

// ---- Feather edges: soften alpha 1px around the cut for anti-aliasing ----
const alphaCopy = new Uint8Array(W * H);
for (let k = 0; k < W * H; k++) alphaCopy[k] = data[k * C + 3];
for (let y = 1; y < H - 1; y++) {
  for (let x = 1; x < W - 1; x++) {
    const k = y * W + x;
    if (alphaCopy[k] === 0) continue;
    // count transparent neighbours
    let t = 0;
    if (alphaCopy[k - 1] === 0) t++;
    if (alphaCopy[k + 1] === 0) t++;
    if (alphaCopy[k - W] === 0) t++;
    if (alphaCopy[k + W] === 0) t++;
    if (t >= 1) data[k * C + 3] = Math.min(data[k * C + 3], 200 - t * 30);
  }
}

// ---- Tight bounding box of opaque content ----
let minX = W, minY = H, maxX = 0, maxY = 0;
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    if (data[(y * W + x) * C + 3] > 10) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
}
console.log("bbox", { minX, minY, maxX, maxY, w: maxX - minX + 1, h: maxY - minY + 1 });

// ---- Detect cap/body split: scan rows for the gold->dark transition ----
// gold cap = warm (r>g>b, bright-ish). Find last row (from top) that is mostly gold.
function rowGoldFraction(y) {
  let gold = 0, total = 0;
  for (let x = minX; x <= maxX; x++) {
    const i = px(x, y);
    if (data[i + 3] < 10) continue;
    total++;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    if (r > 120 && r > b + 30 && g > b && r - g < 90) gold++;
  }
  return total ? gold / total : 0;
}
// Walk down from the top: find where the contiguous gold-lid band first ends.
let splitY = minY;
let seenGold = false;
let nonGoldRun = 0;
for (let y = minY; y <= minY + (maxY - minY) * 0.5; y++) {
  const frac = rowGoldFraction(y);
  if (frac > 0.5) {
    seenGold = true;
    nonGoldRun = 0;
    splitY = y;
  } else if (seenGold) {
    nonGoldRun++;
    if (nonGoldRun > 8) break; // lid has clearly ended
  }
}
console.log("splitY", splitY, "frac of height", ((splitY - minY) / (maxY - minY)).toFixed(3));

const out = sharp(Buffer.from(data), { raw: { width: W, height: H, channels: C } });

// Full transparent bottle (cropped tight)
await out
  .clone()
  .extract({ left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 })
  .png()
  .toFile(path.join(pub, "hero-bottle.png"));

// Cap layer (top, includes a little overlap below split for a clean seam when closed)
// Exported as WebP — the hero uses these for a light mobile payload.
const capBottom = Math.min(maxY, splitY + 6);
await out
  .clone()
  .extract({ left: minX, top: minY, width: maxX - minX + 1, height: capBottom - minY + 1 })
  .webp({ quality: 84, effort: 6 })
  .toFile(path.join(pub, "hero-bottle-cap.webp"));

// Body layer (from split down)
await out
  .clone()
  .extract({ left: minX, top: splitY + 1, width: maxX - minX + 1, height: maxY - splitY })
  .webp({ quality: 84, effort: 6 })
  .toFile(path.join(pub, "hero-bottle-body.webp"));

const fullW = maxX - minX + 1, fullH = maxY - minY + 1;
console.log("LAYOUT", JSON.stringify({
  fullW, fullH,
  capH: capBottom - minY + 1,
  bodyTop: splitY + 1 - minY,
  bodyH: maxY - splitY,
  capHeightPct: +(((capBottom - minY + 1) / fullH) * 100).toFixed(2),
  bodyTopPct: +(((splitY + 1 - minY) / fullH) * 100).toFixed(2),
}));
