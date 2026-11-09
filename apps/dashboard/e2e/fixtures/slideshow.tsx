import React from "react";
import { createRoot } from "react-dom/client";
import { Slideshow } from "../../../../packages/storefront-core/src/storefront/Slideshow";
import type { StorefrontSlide } from "../../../../packages/storefront-core/src/config";

const text = (en: string) => ({ en, fr: en, ar: en });
const slides: StorefrontSlide[] = ["First offer", "Second offer"].map((title, index) => ({
  id: `slide-${index}`, title: text(title), body: text("A description of the collection."), cta_label: text("Explore"),
  cta_url: "#collection", alt: text("Collection image"), image_url: "https://images.example.test/desktop.png", mobile_image_url: "https://images.example.test/mobile.png",
}));
createRoot(document.getElementById("root")!).render(<><button type="button">Before slideshow</button><Slideshow slides={slides} locale="en" autoplay interval={5} /><button type="button">After slideshow</button></>);
