import { parseRichText } from "@/components/RichText";
import { DescriptionCollapse } from "@/components/DescriptionCollapse";

// ─────────────────────────────────────────────────────────────────────────────
// Amazon-style renderer for a product's full description.
//
// The description is plain markdown (the subset in RichText: "## "/"### "
// headings, "- " bullets, paragraphs and "![alt](url)" images), authored in
// /admin/products. It renders as a clean reading column of headings, paragraphs
// and bullets — and any images are kept SMALL (card-sized thumbnails) that sit
// to the side with the text flowing around them, alternating side per module,
// rather than large full-width banners.
//
// Colours are hardcoded hex to match the rest of the product page and to dodge
// the global class-name colour remapping.
// ─────────────────────────────────────────────────────────────────────────────

const INK = "text-[#0f1111]";
const BODY = "text-[#3f4545]";

// Consistent side thumbnail — small on phones so it fits beside the text, and
// larger on wider screens.
const THUMB = "w-28 sm:w-48 lg:w-60";

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

// One small thumbnail with an optional caption underneath.
function Thumb({ img, className = "" }) {
  return (
    <figure className={className}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={img.url}
        alt={img.alt}
        loading="lazy"
        className={`${THUMB} aspect-square rounded-md border border-slate-200 bg-slate-50 object-cover`}
      />
      {img.alt ? (
        <figcaption className={`mt-1.5 ${THUMB} text-[11px] font-medium leading-4 text-[#565959]`}>
          {img.alt}
        </figcaption>
      ) : null}
    </figure>
  );
}

function Block({ block }) {
  if (block.type === "h4") {
    return <h4 className={`mt-6 text-sm font-bold first:mt-0 ${INK}`}>{block.text}</h4>;
  }
  if (block.type === "ul") {
    return (
      <ul className="mt-3 space-y-2 first:mt-0">
        {block.items.map((item, i) => (
          <li key={i} className={`flex gap-2.5 text-sm leading-6 ${BODY}`}>
            <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-emerald-700" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    );
  }
  if (block.type === "images") {
    // A run of images with no accompanying text: a small thumbnail strip.
    return (
      <div className="mt-4 flex flex-wrap gap-3 first:mt-0">
        {block.items.map((img, i) => (
          <Thumb key={i} img={img} />
        ))}
      </div>
    );
  }
  return (
    <p className={`mt-3 whitespace-pre-line text-sm leading-7 first:mt-0 ${BODY}`}>
      {block.text}
    </p>
  );
}

function Module({ heading, blocks }) {
  // If the module has a single image alongside text, lay it out as two columns:
  // the text (paragraphs and bullet points, each stacked one under another) on
  // the left, and the small thumbnail fixed to the right with a gap in between.
  // The image never sits above or below the text. Otherwise everything just
  // stacks in the normal reading flow.
  const imageBlocks = blocks.filter((b) => b.type === "images");
  const textBlocks = blocks.filter((b) => b.type !== "images");
  const sideImg =
    imageBlocks.length === 1 && imageBlocks[0].items.length === 1 && textBlocks.length > 0
      ? imageBlocks[0].items[0]
      : null;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 sm:p-7">
      {heading ? (
        <div className="mb-4 sm:mb-5">
          <h3 className={`text-lg font-bold tracking-tight sm:text-xl ${INK}`}>{heading}</h3>
          <span aria-hidden className="mt-2 block h-0.5 w-12 rounded-full bg-emerald-700" />
        </div>
      ) : null}

      {sideImg ? (
        // Image stays on the RIGHT beside the text at every breakpoint (small on
        // phones, larger on wider screens) — never stacked above or below.
        <div className="flex items-start gap-4 sm:gap-6 lg:gap-8">
          <div className="min-w-0 flex-1">
            {textBlocks.map((block, i) => (
              <Block key={i} block={block} />
            ))}
          </div>
          <Thumb img={sideImg} className="shrink-0" />
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
    <DescriptionCollapse>
      <div className="mt-6 grid gap-4 sm:gap-5">
        {modules.map((mod, i) => (
          <Module key={i} heading={mod.heading} blocks={mod.blocks} />
        ))}
      </div>
    </DescriptionCollapse>
  );
}
