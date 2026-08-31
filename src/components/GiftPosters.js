import Link from "next/link";

// The gift campaign's posters, rendered as artwork and nothing else.
//
// Deliberately chrome-free: no card, no border, no caption, no overlaid text.
// A poster is a finished design — the prize, the qualifying spend, the draw date
// and the call to action are already set in it by whoever made it — so anything
// this component added would compete with the artwork and, worse, could
// contradict it the moment one of those figures changed in the image but not in
// the code. The page around it carries the mechanics; this carries the pitch.
//
// The image ratio is unknown and varies by poster (a wide banner, a square
// social tile), so height is never constrained. `w-full h-auto` lets each one
// keep its own proportions instead of being cropped into a shape the designer
// did not choose.
//
// Square corners on a phone, rounded from `sm:` up. On a narrow screen the
// poster runs edge to edge — a rounded corner against the screen edge looks like
// a rendering fault rather than a design, and the few pixels it clips are part
// of the artwork.

/**
 * @param {object} props
 * @param {Array<{id: string, title?: string|null, imageUrl: string, linkUrl?: string|null}>} props.posters
 * @param {boolean} [props.priority]  eager-load the first poster (above the fold)
 * @param {string} [props.className]
 */
export function GiftPosters({ posters, priority = false, className = "" }) {
  if (!posters || posters.length === 0) return null;

  return (
    <div className={`grid gap-2 sm:gap-4 ${className}`}>
      {posters.map((poster, index) => {
        const image = (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={poster.imageUrl}
            // The poster says everything in pixels, so with no title there is
            // genuinely nothing to announce — an empty alt marks it decorative
            // rather than making a screen reader read out a file name.
            alt={poster.title || ""}
            // The first poster is the hero of the page; the rest are below the
            // fold and can wait.
            loading={priority && index === 0 ? "eager" : "lazy"}
            fetchPriority={priority && index === 0 ? "high" : "auto"}
            className="h-auto w-full object-contain shadow-sm sm:rounded-xl"
          />
        );

        if (!poster.linkUrl) {
          return <div key={poster.id}>{image}</div>;
        }

        // An admin can point a poster anywhere, including off-site, and next/link
        // cannot prefetch or soft-navigate an external URL. Choosing the element
        // by the shape of the href keeps internal links fast without breaking
        // external ones.
        const external = /^https?:\/\//i.test(poster.linkUrl);

        return external ? (
          <a
            key={poster.id}
            href={poster.linkUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block transition hover:opacity-95"
          >
            {image}
          </a>
        ) : (
          <Link key={poster.id} href={poster.linkUrl} className="block transition hover:opacity-95">
            {image}
          </Link>
        );
      })}
    </div>
  );
}
