import type { StoreConfig } from "@storefront/core";
import { Storefront, ThemeHero, renderThemeProduct, renderThemeSections } from "@storefront/core";
import "./electronics.css";

export default function App({ config }: { config: StoreConfig }) {
  return <Storefront
    config={config}
    hero={(context) => <ThemeHero theme="electronics" context={context} />}
    extraBand={(context) => renderThemeSections("electronics", context)}
    themeSection={(section, context) => renderThemeSections("electronics", context, {
      title: typeof section.settings.title === "object" ? String((section.settings.title as Record<string, string>)[context.locale] || (section.settings.title as Record<string, string>).en || "") : "",
      body: typeof section.settings.body === "object" ? String((section.settings.body as Record<string, string>)[context.locale] || (section.settings.body as Record<string, string>).en || "") : "",
      limit: Number(section.settings.limit) || 4,
    })}
    productExtras={(product, context) => renderThemeProduct("electronics", product, context)}
  />;
}
