// One-off audit: how many rows still point at Vercel Blob?
// Answers "is it safe to delete the Blob store yet". Read-only.
//   node scripts/count-blob-urls.mjs
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

for (const line of readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}

const prisma = new PrismaClient();
const BLOB = "blob.vercel-storage.com";
const like = { contains: BLOB };

const [productImages, categories, sectionImages, sectionVideos] = await Promise.all([
  prisma.productImage.findMany({ where: { url: like }, select: { url: true } }),
  prisma.category.findMany({ where: { imageUrl: like }, select: { imageUrl: true } }),
  prisma.homeSectionItem.findMany({ where: { imageUrl: like }, select: { imageUrl: true } }),
  prisma.homeSectionItem.findMany({ where: { videoUrl: like }, select: { videoUrl: true } }),
]);

console.log("ProductImage.url       :", productImages.length);
console.log("Category.imageUrl      :", categories.length);
console.log("HomeSectionItem.imageUrl:", sectionImages.length);
console.log("HomeSectionItem.videoUrl:", sectionVideos.length);
console.log(
  "\nTOTAL blob-backed rows :",
  productImages.length + categories.length + sectionImages.length + sectionVideos.length,
);

// Markdown/rich-text fields can embed an image URL inline (see
// MarkdownDescriptionField), so a plain URL-column sweep is not enough.
const [descs, shortDescs, pages, faqs, settings] = await Promise.all([
  prisma.product.count({ where: { description: like } }),
  prisma.product.count({ where: { shortDescription: like } }),
  prisma.page.count({ where: { body: like } }),
  prisma.faqItem.count({ where: { answer: like } }),
  prisma.siteSetting.count({ where: { value: like } }),
]);
console.log("\n-- embedded in text --");
console.log("Product.description    :", descs);
console.log("Product.shortDescription:", shortDescs);
console.log("Page.body              :", pages);
console.log("FaqItem.answer         :", faqs);
console.log("SiteSetting.value      :", settings);
console.log("TOTAL embedded         :", descs + shortDescs + pages + faqs + settings);

const sample = [
  ...productImages.map((r) => r.url),
  ...categories.map((r) => r.imageUrl),
  ...sectionImages.map((r) => r.imageUrl),
  ...sectionVideos.map((r) => r.videoUrl),
].slice(0, 10);
if (sample.length) console.log("\nSample:\n" + sample.join("\n"));

await prisma.$disconnect();
