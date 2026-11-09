import { useMemo } from "react";
import type { StoreConfig } from "@storefront/core";
import { Storefront, ThemeHero, renderThemeProduct, renderThemeSections } from "@storefront/core";
import "./atelier.css";
import { AtelierFooter, AtelierNewsletter } from "./AtelierChrome";

/** Atelier keeps the platform's live catalog, account, cart and checkout.
 *  Published merchant homepage sections supply all customer-facing copy and imagery. */
export default function App({ config }: { config: StoreConfig }) {
  const presentation = useMemo<StoreConfig>(() => ({
    ...config,
    navigation: {
      ...config.navigation,
      headerPreset: config.navigation?.headerPreset ?? "compact",
      transparentOnHero: config.navigation?.transparentOnHero ?? false,
    },
  }), [config]);
  return <Storefront
    config={presentation}
    hero={(context) => <ThemeHero theme="atelier" context={context} />}
    extraBand={(context) => renderThemeSections("atelier", context)}
    themeSection={(section, context) => renderThemeSections("atelier", context, {
      title: typeof section.settings.title === "object" ? String((section.settings.title as Record<string, string>)[context.locale] || (section.settings.title as Record<string, string>).en || "") : "",
      body: typeof section.settings.body === "object" ? String((section.settings.body as Record<string, string>)[context.locale] || (section.settings.body as Record<string, string>).en || "") : "",
      limit: Number(section.settings.limit) || 4,
    })}
    productExtras={(product, context) => renderThemeProduct("atelier", product, context)}
    newsletter={(context) => <AtelierNewsletter {...context} />}
    footer={(context) => <AtelierFooter {...context} />}
  />;
}
