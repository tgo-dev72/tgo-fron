import { useEffect, useRef, useState } from "react";
import type { ImgHTMLAttributes, SyntheticEvent } from "react";
import { API_BASE } from "../api/client";

const CLOUDINARY_IMAGE_UPLOAD = /^(https?:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload)\/(.+)$/;
export const DEFAULT_IMAGE_WIDTHS = [320, 480, 640, 960, 1280] as const;

export interface ImageTransformOptions {
  width?: number;
  quality?: "auto" | number;
  format?: "auto" | "avif" | "webp" | "jpg" | "png";
  crop?: "limit" | "fill" | "fit" | "scale";
}

export function resolveImageUrl(url: string, baseUrl = API_BASE): string {
  if (!url) return "";
  if (/^(?:https?:|data:|blob:)/.test(url)) return url;
  return baseUrl ? `${baseUrl}${url}` : url;
}

export function optimizedImageUrl(
  url: string,
  options: ImageTransformOptions = {},
  baseUrl = API_BASE,
): string {
  const absolute = resolveImageUrl(url, baseUrl);
  const match = absolute.match(CLOUDINARY_IMAGE_UPLOAD);
  if (!match) return absolute;

  const width = options.width && Number.isFinite(options.width)
    ? Math.max(1, Math.round(options.width))
    : undefined;
  const transforms = [
    `f_${options.format ?? "auto"}`,
    `q_${options.quality ?? "auto"}`,
    width ? `c_${options.crop ?? "limit"}` : "",
    width ? `w_${width}` : "",
  ].filter(Boolean).join(",");
  return `${match[1]}/${transforms}/${match[2]}`;
}

export function optimizedImageSrcSet(
  url: string,
  widths: readonly number[] = DEFAULT_IMAGE_WIDTHS,
  options: Omit<ImageTransformOptions, "width"> = {},
  baseUrl = API_BASE,
): string | undefined {
  const absolute = resolveImageUrl(url, baseUrl);
  if (!CLOUDINARY_IMAGE_UPLOAD.test(absolute)) return undefined;
  const normalized = [...new Set(widths)]
    .filter((width) => Number.isFinite(width) && width > 0)
    .sort((left, right) => left - right);
  return normalized
    .map((width) => `${optimizedImageUrl(absolute, { ...options, width }, baseUrl)} ${width}w`)
    .join(", ");
}

export interface OptimizedImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "srcSet"> {
  src: string;
  widthHint?: number;
  widths?: readonly number[];
  transform?: Omit<ImageTransformOptions, "width">;
  priority?: boolean;
  baseUrl?: string;
}

export function OptimizedImage({
  src,
  widthHint,
  widths,
  transform,
  sizes,
  priority = false,
  loading,
  decoding,
  fetchPriority,
  baseUrl,
  className,
  onLoad,
  onError,
  ...props
}: OptimizedImageProps) {
  const imageRef = useRef<HTMLImageElement>(null);
  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading");
  const resolvedSrc = optimizedImageUrl(src, { ...transform, width: widthHint }, baseUrl);
  useEffect(() => {
    const image = imageRef.current;
    if (!image) return;
    if (image.complete) setStatus(image.naturalWidth > 0 ? "loaded" : "error");
  }, [resolvedSrc]);
  const loaded = (event: SyntheticEvent<HTMLImageElement>) => {
    setStatus("loaded");
    onLoad?.(event);
  };
  const failed = (event: SyntheticEvent<HTMLImageElement>) => {
    setStatus("error");
    onError?.(event);
  };
  return (
    <img
      {...props}
      ref={imageRef}
      className={`${className ?? ""} sf-optimized-image is-${status}`.trim()}
      src={resolvedSrc}
      srcSet={optimizedImageSrcSet(src, widths, transform, baseUrl)}
      sizes={sizes}
      loading={loading ?? (priority ? "eager" : "lazy")}
      decoding={decoding ?? "async"}
      fetchPriority={fetchPriority ?? (priority ? "high" : "auto")}
      onLoad={loaded}
      onError={failed}
    />
  );
}
