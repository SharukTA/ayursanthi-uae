import { parseRichText } from "@/components/RichText";
import { DescriptionCollapse } from "@/components/DescriptionCollapse";

// ─────────────────────────────────────────────────────────────────────────────
// Amazon "From the manufacturer" (A+ content) renderer for a product's full
// description.
//
// The description is plain markdown (the subset in RichText: "## "/"### "
// headings, "- " bullets, paragraphs and "![alt](url)" images), authored in
// /admin/products. Each "## " heading opens a MODULE. Modules render as
// borderless stacked sections separated by hairline dividers (never boxed
// cards), and any single accompanying image renders LARGE beside the text,
// alternating side per module — mirroring Amazon's A+ image+text bands. Runs of
// images render as full-width banners / large galleries rather than thumbnails.
//
// Colours are hardcoded hex to match the rest of the product page and to dodge
// the global class-name colour remapping.
// ─────────────────────────────────────────────────────────────────────────────

const INK = "text-[#0f1111]";
const BODY = "text-[#3f4545]";

// Splits the flat block list into modules, each opened by a "## " heading.
function toModules(blocks) {
  const modules = [];
  let current = { heading: null, blocks: [] };

  for (const block of blocks) {
    if (block.type === "h3") {
      if (current.heading || current.blocks.length) modules.push(current);
      current = { heading: block.text, blocks: [] };
    } else {
      current.blocks.push(block);
    }
  }
  if (current.heading || current.blocks.length) modules.push(current);

  return modules;
}

// Flatten every bullet in the body into a single list — the source for the
// "About this item" summary shown in the buy-box column (Amazon puts the key
// selling points as bullets high up, above the prose description).
export function collectBullets(body, limit = 8) {
  const blocks = parseRichText(body || "");
  const items = [];
  for (const block of blocks) {
    if (block.type === "ul") items.push(...block.items);
    if (items.length >= limit) break;
  }
  return items.slice(0, limit);
}

// Amazon-style "About this item" bullet summary. Renders nothing when the
// description carries no bullet points.
export function AboutThisItem({ body }) {
  const bullets = collectBullets(body);
  if (bullets.length === 0) return null;

  return (
    <div className="mt-6 border-t border-slate-100 pt-5">
      <h2 className={`text-base font-bold ${INK}`}>About this item</h2>
      <ul className="mt-3 space-y-2">
        {bullets.map((item, i) => (
          <li key={i} className={`flex gap-2.5 text-sm leading-6 ${BODY}`}>
            <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-emerald-700" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// A large image with an optional caption underneath. `wide` fills the column
// width (banners / side images); the default keeps a pleasant 4:3 crop.
function Figure({ img, className = "", ratio = "aspect-[4/3]" }) {
  return (
    <figure className={className}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={img.url}
        alt={img.alt}
        loading="lazy"
        className={`w-full ${ratio} rounded-lg border border-slate-200 bg-slate-50 object-cover`}
      />
      {img.alt ? (
        <figcaption className={`mt-2 text-xs font-medium leading-5 text-[#565959]`}>
          {img.alt}
        </figcaption>
      ) : null}
    </figure>
  );
}

function Block({ block }) {
  if (block.type === "h4") {
    return <h4 className={`mt-6 text-base font-bold first:mt-0 ${INK}`}>{block.text}</h4>;
  }
  if (block.type === "ul") {
    return (
      <ul className="mt-3 space-y-2 first:mt-0">
        {block.items.map((item, i) => (
          <li key={i} className={`flex gap-2.5 text-sm leading-6 sm:text-[15px] ${BODY}`}>
            <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-emerald-700" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    );
  }
  if (block.type === "images") {
    // A run of images with no accompanying text. One image → full-width banner;
    // several → a large responsive gallery (A+ style, not thumbnails).
    if (block.items.length === 1) {
      return (
        <div className="mt-6 first:mt-0">
          <Figure img={block.items[0]} ratio="aspect-[16/9]" />
        </div>
      );
    }
    return (
      <div className="mt-6 grid grid-cols-2 gap-4 first:mt-0 sm:grid-cols-3">
        {block.items.map((img, i) => (
          <Figure key={i} img={img} ratio="aspect-square" />
        ))}
      </div>
    );
  }
  return (
    <p className={`mt-4 whitespace-pre-line text-sm leading-7 first:mt-0 sm:text-[15px] ${BODY}`}>
      {block.text}
    </p>
  );
}

function Module({ heading, blocks, index }) {
  // If the module has exactly one image alongside text, lay it out as an A+
  // image+text band: the text on one side and a LARGE image on the other,
  // alternating side per module. Otherwise the blocks stack in reading flow.
  const imageBlocks = blocks.filter((b) => b.type === "images");
  const textBlocks = blocks.filter((b) => b.type !== "images");
  const sideImg =
    imageBlocks.length === 1 && imageBlocks[0].items.length === 1 && textBlocks.length > 0
      ? imageBlocks[0].items[0]
      : null;
  const reverse = index % 2 === 1; // alternate the image side per module

  return (
    // Borderless section separated from the next by a hairline divider — never a
    // boxed card. The first module has no top rule.
    <section className="border-t border-slate-100 pt-10 first:border-0 first:pt-0">
      {heading ? (
        <div className="mb-5 sm:mb-6">
          <h3 className={`text-xl font-bold tracking-tight sm:text-2xl ${INK}`}>{heading}</h3>
          <span aria-hidden className="mt-2 block h-0.5 w-14 rounded-full bg-emerald-700" />
        </div>
      ) : null}

      {sideImg ? (
        <div
          className={`flex flex-col gap-6 sm:gap-10 sm:items-center ${
            reverse ? "sm:flex-row-reverse" : "sm:flex-row"
          }`}
        >
          <div className="min-w-0 sm:flex-1">
            {textBlocks.map((block, i) => (
              <Block key={i} block={block} />
            ))}
          </div>
          <Figure img={sideImg} className="w-full sm:w-1/2 sm:shrink-0" />
        </div>
      ) : (
        blocks.map((block, i) => <Block key={i} block={block} />)
      )}
    </section>
  );
}

export function ProductDescription({ body }) {
  const blocks = parseRichText(body || "");

  if (blocks.length === 0) {
    return <p className={`mt-4 text-sm leading-7 ${BODY}`}>No full description available.</p>;
  }

  const modules = toModules(blocks);

  return (
    <DescriptionCollapse collapsedHeight={560}>
      <div className="mt-6 space-y-10 sm:space-y-14">
        {modules.map((mod, i) => (
          <Module key={i} heading={mod.heading} blocks={mod.blocks} index={i} />
        ))}
      </div>
    </DescriptionCollapse>
  );
}
