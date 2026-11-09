import { useEffect, useState } from "react";
import type { StorefrontSlide, StorefrontContentLocale } from "../config";
import { RichText } from "./components";
import { OptimizedImage, optimizedImageSrcSet, optimizedImageUrl } from "../media/image";
import "./slideshow.css";

const labels = {
  en: { banner: "Store highlights", slide: "Slide", previous: "Previous slide", next: "Next slide", play: "Play slideshow", pause: "Pause slideshow" },
  fr: { banner: "À découvrir", slide: "Diapositive", previous: "Diapositive précédente", next: "Diapositive suivante", play: "Lire le diaporama", pause: "Mettre le diaporama en pause" },
  ar: { banner: "اكتشف جديد المتجر", slide: "الشريحة", previous: "الشريحة السابقة", next: "الشريحة التالية", play: "تشغيل عرض الشرائح", pause: "إيقاف عرض الشرائح" },
};

function PlaybackIcon({ playing }: { playing: boolean }) {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {playing ? <><path d="M5.5 4v8" /><path d="M10.5 4v8" /></> : <path d="m5 3 7 5-7 5V3Z" />}
  </svg>;
}

function ChevronIcon({ direction }: { direction: "previous" | "next" }) {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={direction === "previous" ? "m10 3-5 5 5 5" : "m6 3 5 5-5 5"} />
  </svg>;
}

export function Slideshow({ slides, locale, autoplay = false, preview = false, mobilePreview = false }: {
  slides: StorefrontSlide[]; locale: StorefrontContentLocale; autoplay?: boolean; interval?: number; preview?: boolean; mobilePreview?: boolean;
}) {
  const [index, setIndex] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [reduced, setReduced] = useState(true);
  const [hidden, setHidden] = useState(false);
  const [paused, setPaused] = useState(false);
  const c = labels[locale];
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    const visibility = () => setHidden(document.hidden);
    update(); visibility();
    query.addEventListener("change", update);
    document.addEventListener("visibilitychange", visibility);
    return () => { query.removeEventListener("change", update); document.removeEventListener("visibilitychange", visibility); };
  }, []);
  useEffect(() => { setIndex(0); }, [slides.length]);
  const running = autoplay && !paused && !hovered && !focused && !reduced && !hidden && !preview && slides.length > 1;
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % slides.length), 3000);
    return () => window.clearInterval(timer);
  }, [running, slides.length]);
  const current = Math.min(index, slides.length - 1);
  if (!slides[current]) return null;
  return <section className="sf-slideshow sf-banner-fade" dir={locale === "ar" ? "rtl" : "ltr"} role="region" aria-label={c.banner}
    onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
    onFocusCapture={() => setFocused(true)} onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}>
    <div className="sf-slideshow-viewport" aria-live={running ? "off" : "polite"} aria-atomic="true">
      <div className="sf-slideshow-track" style={{ transform: `translate3d(-${current * 100}%, 0, 0)` }}>
        {slides.map((slide, slideIndex) => {
          const text = (field: "title" | "body" | "cta_label" | "alt") => slide[field][locale] || slide[field].en || slide[field].fr || slide[field].ar || "";
          const safeLink = /^(https:\/\/|\/(?!\/)|#)/.test(slide.cta_url) && !/[\\\u0000-\u0020]/.test(slide.cta_url);
          const image = mobilePreview && slide.mobile_image_url ? slide.mobile_image_url : slide.image_url;
          return <article className="sf-slide" dir={locale === "ar" ? "rtl" : "ltr"} aria-hidden={slideIndex !== current} key={slide.id}>
            {image && <picture className="sf-slide-media">
              {slide.mobile_image_url && <source media="(max-width: 600px)" srcSet={optimizedImageSrcSet(slide.mobile_image_url, [320, 480, 640]) ?? optimizedImageUrl(slide.mobile_image_url, { width: 640 })} />}
              <OptimizedImage src={image} widthHint={2000} widths={[640, 960, 1280, 1600, 2000]} sizes="100vw" alt={text("alt")} priority={slideIndex === 0} />
            </picture>}
            {safeLink && <a
              className="sf-slide-hit-area"
              href={slide.cta_url}
              aria-label={text("title") || text("cta_label") || text("alt") || `${c.slide} ${slideIndex + 1}`}
              tabIndex={slideIndex === current ? 0 : -1}
              onClick={preview ? (event) => event.preventDefault() : undefined}
            />}
            {(text("title") || text("body") || (text("cta_label") && safeLink)) && <div className="sf-slide-copy">
              {text("title") && <h2>{text("title")}</h2>}
              {text("body") && <RichText html={text("body")} className="sf-slide-body" />}
              {text("cta_label") && safeLink && <a href={slide.cta_url} tabIndex={slideIndex === current ? undefined : -1} onClick={preview ? (event) => event.preventDefault() : undefined}>{text("cta_label")}</a>}
            </div>}
          </article>;
        })}
      </div>
    </div>
    {slides.length > 1 && <div className="sf-slideshow-controls">
      <button type="button" className="sf-slideshow-previous" aria-label={c.previous} onClick={() => setIndex((currentIndex) => (currentIndex - 1 + slides.length) % slides.length)}>
        <ChevronIcon direction="previous" />
      </button>
      {autoplay && !reduced && !preview && <button type="button" className="sf-slideshow-toggle" aria-label={running ? c.pause : c.play} aria-pressed={!running} onClick={() => setPaused((value) => !value)}>
        <PlaybackIcon playing={running} />
      </button>}
      <div className="sf-slideshow-dots" role="group" aria-label={`${c.slide} ${current + 1} / ${slides.length}`}>
        {slides.map((slide, slideIndex) => <button type="button" className={slideIndex === current ? "is-active" : ""} aria-label={`${c.slide} ${slideIndex + 1}`} aria-current={slideIndex === current ? "true" : undefined} onClick={() => setIndex(slideIndex)} key={slide.id}><span aria-hidden="true" /></button>)}
      </div>
      <button type="button" className="sf-slideshow-next" aria-label={c.next} onClick={() => setIndex((currentIndex) => (currentIndex + 1) % slides.length)}>
        <ChevronIcon direction="next" />
      </button>
    </div>}
  </section>;
}
