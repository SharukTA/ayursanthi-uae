import Image from "next/image";
import { CardVideo } from "@/components/CardVideo";
import { isOptimizableSrc } from "@/lib/media";

// The single place product media is painted. Server component: it renders
// `next/image` directly and only drops to the `CardVideo` client component when
// the media really is a clip.
//
// Why this exists: cards used to paint stills with `style={{ backgroundImage }}`,
// which bypasses the image optimizer completely — every visitor got the untouched
// 376 KB-1.1 MB master out of Blob, at every size, forever. Going through
// `next/image` means one resize per breakpoint, cached on Vercel's CDN, with Blob
// touched only on a cache miss.
//
// `sizes` is not decoration — it decides which srcset entry the browser picks. Get
// it wrong (or omit it, which implies 100vw) and a 200px thumbnail downloads a
// 1200px file, undoing the optimization. Every caller passes a real value.
// A bare image URL painted to fill its (relative, sized) parent — the optimized
// replacement for `style={{ backgroundImage: url(...) }}`. Used by the homepage
// CMS sections and category tiles, whose items carry a plain `imageUrl` with no
// mediaType attached.
//
// The parent must be `relative` with a real height, exactly as a background-image
// container already had to be.
export function ImageFill({
  src,
  alt = "",
  fit = "cover",
  sizes,
  quality = 75,
  preload = false,
  className = "",
  // Fires when the file itself can't be loaded (deleted, 404, network). Callers
  // that can show a placeholder should pass this — a bare <Image> failure leaves
  // a broken-image icon, which looks like a bug to a customer.
  onError,
  // Fires once the file has decoded; the event's target is the <img>, so a
  // caller can read naturalWidth/naturalHeight off it.
  onLoad,
}) {
  if (!src) return null;

  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      quality={quality}
      preload={preload}
      onError={onError}
      onLoad={onLoad}
      unoptimized={!isOptimizableSrc(src)}
      className={`${fit === "contain" ? "object-contain" : "object-cover"} ${className}`}
    />
  );
}

export function ProductMedia({
  // { url, mediaType } — typically `product.images[0]`.
  media,
  alt,
  // "cover" crops to fill the frame; "contain" shows the whole product uncropped.
  fit = "cover",
  sizes,
  // Set true only for above-the-fold hero media (replaces the deprecated
  // `priority` prop in Next 16).
  preload = false,
  // 50 for small thumbnails where the difference is invisible; 75 elsewhere.
  quality = 75,
  // A still to show in place of a video's first frame, when one is available.
  poster,
  className = "",
}) {
  const url = media?.url;
  if (!url) return null;

  const objectFit = fit === "contain" ? "object-contain" : "object-cover";

  if (media.mediaType === "VIDEO") {
    return (
      <CardVideo
        src={url}
        poster={poster}
        className={`absolute inset-0 size-full ${objectFit} ${className}`}
      />
    );
  }

  return (
    <Image
      src={url}
      alt={alt}
      fill
      sizes={sizes}
      quality={quality}
      preload={preload}
      // Admin media fields accept a pasted URL from any domain, and the optimizer
      // answers 400 for a host missing from `remotePatterns` — which would blank
      // the image. Unknown hosts render untouched instead of breaking.
      unoptimized={!isOptimizableSrc(url)}
      className={`${objectFit} ${className}`}
    />
  );
}
