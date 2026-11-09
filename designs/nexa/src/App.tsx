import { useMemo } from "react";
import { Storefront, ThemeHero, renderThemeProduct, renderThemeSections } from "@storefront/core";
import type { StoreConfig } from "@storefront/core";
import { nexaPresentationConfig } from "./appearance";
import "./nexa.css";

/** Core owns data, routing, providers, published sections and every commerce action. */
export default function App({ config }: { config: StoreConfig }) {
  const presentation = useMemo(() => nexaPresentationConfig(config), [config]);
  return (
    <div className="nexa-storefront">
      <Storefront
        config={presentation}
        hero={(context) => <ThemeHero theme="nexa" context={context} />}
        extraBand={(context) => renderThemeSections("nexa", context)}
        themeSection={(section, context) => renderThemeSections("nexa", context, {
          title: typeof section.settings.title === "object" ? String((section.settings.title as Record<string, string>)[context.locale] || (section.settings.title as Record<string, string>).en || "") : "",
          body: typeof section.settings.body === "object" ? String((section.settings.body as Record<string, string>)[context.locale] || (section.settings.body as Record<string, string>).en || "") : "",
          limit: Number(section.settings.limit) || 4,
        })}
        productExtras={(product, context) => renderThemeProduct("nexa", product, context)}
      />
    </div>
  );
}
