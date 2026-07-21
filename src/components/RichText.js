// Minimal markdown renderer for admin-edited bodies. Supports a small, safe
// subset (no raw HTML): blank-line-separated paragraphs, "## "/"### " headings,
// "- " bullet lists, and "![alt](url)" images. Plain text only — nothing is
// dangerouslySet.

const IMAGE_LINE = /^!\[([^\]]*)\]\(([^)\s]+)\)$/;

// Only http(s), root-relative and inline image data URLs may reach an <img src>.
// Anything else (javascript:, vbscript:, ...) is dropped rather than rendered.
function safeUrl(url) {
  const trimmed = String(url).trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("/")) return trimmed;
  if (/^data:image\//i.test(trimmed)) return trimmed;
  return null;
}

// Parses the markdown subset into a flat block list. Consecutive image lines
// (no blank line between them) collapse into a single "images" block, which is
// what lets a renderer lay them out as a gallery row instead of stacked banners.
export function parseRichText(body = "") {
  const lines = String(body).replace(/\r\n/g, "\n").split("\n");
  const blocks = [];
  let paragraph = [];
  let bullets = [];
  let images = [];

  const flushParagraph = () => {
    if (paragraph.length) {
      // Keep the admin's line breaks: each typed line shows on its own line
      // (rendered with whitespace-pre-line), rather than merging into one
      // justified block of prose.
      blocks.push({ type: "p", text: paragraph.join("\n") });
      paragraph = [];
    }
  };
  const flushBullets = () => {
    if (bullets.length) {
      blocks.push({ type: "ul", items: [...bullets] });
      bullets = [];
    }
  };
  const flushImages = () => {
    if (images.length) {
      blocks.push({ type: "images", items: [...images] });
      images = [];
    }
  };
  const flushAll = () => {
    flushParagraph();
    flushBullets();
    flushImages();
  };

  for (const raw of lines) {
    const line = raw.trim();
    const image = line.match(IMAGE_LINE);

    if (!line) {
      flushAll();
    } else if (image) {
      flushParagraph();
      flushBullets();
      const url = safeUrl(image[2]);
      if (url) images.push({ url, alt: image[1] });
    } else if (line.startsWith("### ")) {
      flushAll();
      blocks.push({ type: "h4", text: line.slice(4) });
    } else if (line.startsWith("## ")) {
      flushAll();
      blocks.push({ type: "h3", text: line.slice(3) });
    } else if (line.startsWith("- ")) {
      flushParagraph();
      flushImages();
      bullets.push(line.slice(2));
    } else {
      flushBullets();
      flushImages();
      paragraph.push(line);
    }
  }
  flushAll();

  return blocks;
}

export function RichText({ body = "", className = "" }) {
  const blocks = parseRichText(body);

  return (
    <div className={className}>
      {blocks.map((block, idx) => {
        if (block.type === "h3") {
          return (
            <h3 key={idx} className="mt-8 text-base font-bold text-slate-950 first:mt-0">
              {block.text}
            </h3>
          );
        }
        if (block.type === "h4") {
          return (
            <h4 key={idx} className="mt-6 text-sm font-bold text-slate-900">
              {block.text}
            </h4>
          );
        }
        if (block.type === "ul") {
          return (
            <ul key={idx} className="mt-2 list-disc space-y-1 pl-5">
              {block.items.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          );
        }
        if (block.type === "images") {
          return (
            <div key={idx} className="mt-4 flex flex-wrap gap-3 first:mt-0">
              {block.items.map((img, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={i}
                  src={img.url}
                  alt={img.alt}
                  loading="lazy"
                  className="w-32 aspect-square rounded-md border border-slate-200 object-cover sm:w-40"
                />
              ))}
            </div>
          );
        }
        return (
          <p key={idx} className="mt-3 whitespace-pre-line first:mt-0">
            {block.text}
          </p>
        );
      })}
    </div>
  );
}
