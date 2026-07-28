// Compress product videos before uploading them to the media bucket.
//
// Why: an unprocessed set of ten clips totalled 101 MB — one was 15.5 MB for a
// single product. Delivered video is the single biggest driver of media data
// transfer. Re-encoded with the settings below the same clips land at roughly
// 0.5-1.5 MB each with no visible quality loss at the sizes this site displays
// them. Run this on the ORIGINAL files before they ever reach the bucket.
//
//   node scripts/compress-videos.mjs ./raw-videos ./compressed
//
// Then upload the files from ./compressed through the admin product form. Because
// `buildKey()` gives every upload a random segment, each re-upload gets a fresh
// URL — remember to delete the old oversized objects from the R2 dashboard
// afterwards so you stop paying to store them.

import { execFile } from "node:child_process";
import { mkdir, readdir, stat } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

const VIDEO_EXTENSIONS = new Set([".mp4", ".mov", ".webm", ".m4v", ".avi"]);

// Encoder settings, and why each one is here:
//
//   -vf scale=-2:1280   Cap the long edge at 1280px. These are shot 1080x1920;
//                       nothing on the site shows a clip larger than ~600px, so
//                       full height is wasted bytes. `-2` keeps the aspect ratio
//                       and guarantees an even width (h264 requires even dims).
//   -c:v libx264        Universally playable. H.265/AV1 compress better but
//                       Safari/older Android support is patchier.
//   -crf 28             Quality-targeted encoding (lower = better). 28 is a good
//                       trade for short muted product loops; 23 is near-visually
//                       lossless if you want more headroom.
//   -preset slow        Spend encode time once to save bytes on every view.
//   -profile:v main     Broad device compatibility.
//   -pix_fmt yuv420p    Required for playback in Safari / QuickTime.
//   -movflags +faststart
//                       Moves the moov atom to the front. This is what makes
//                       `preload="metadata"` cheap — the browser can paint a
//                       first frame from the first few KB instead of fetching the
//                       tail of the file. CardVideo depends on it.
//   -an                 Strip audio entirely. Every one of these plays muted, so
//                       the audio track is pure waste.
const FFMPEG_ARGS = [
  "-vf", "scale=-2:1280",
  "-c:v", "libx264",
  "-crf", "28",
  "-preset", "slow",
  "-profile:v", "main",
  "-pix_fmt", "yuv420p",
  "-movflags", "+faststart",
  "-an",
];

const mb = (bytes) => `${(bytes / 1048576).toFixed(2)} MB`;

async function main() {
  const [inputDir, outputDir = "./compressed"] = process.argv.slice(2);

  if (!inputDir) {
    console.error(
      "Usage: node scripts/compress-videos.mjs <input-dir> [output-dir]"
    );
    process.exit(1);
  }

  await mkdir(outputDir, { recursive: true });

  const entries = await readdir(inputDir);
  const videos = entries.filter((name) =>
    VIDEO_EXTENSIONS.has(extname(name).toLowerCase())
  );

  if (videos.length === 0) {
    console.error(`No video files found in ${inputDir}`);
    process.exit(1);
  }

  let totalBefore = 0;
  let totalAfter = 0;

  for (const name of videos) {
    const inputPath = join(inputDir, name);
    // Always .mp4 out, whatever went in.
    const outputPath = join(outputDir, `${basename(name, extname(name))}.mp4`);

    const before = (await stat(inputPath)).size;
    process.stdout.write(`${name} (${mb(before)}) → `);

    try {
      await run("ffmpeg", ["-y", "-i", inputPath, ...FFMPEG_ARGS, outputPath]);
    } catch (error) {
      console.log(`FAILED\n  ${error.stderr?.split("\n").slice(-3).join("\n  ")}`);
      continue;
    }

    const after = (await stat(outputPath)).size;
    totalBefore += before;
    totalAfter += after;

    const saved = before > 0 ? Math.round((1 - after / before) * 100) : 0;
    console.log(`${mb(after)}  (−${saved}%)`);
  }

  if (totalBefore > 0) {
    console.log(
      `\nTotal: ${mb(totalBefore)} → ${mb(totalAfter)} ` +
        `(−${Math.round((1 - totalAfter / totalBefore) * 100)}%)`
    );
    console.log(
      "\nUpload the compressed files via the admin product form, then delete the\n" +
        "old objects in the R2 dashboard so you stop paying to store them."
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
