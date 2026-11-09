import "./basic.css";
import { Storefront, shippingText, t, useLocale, useStoreConfig } from "@storefront/core";
import type { StoreConfig } from "@storefront/core";

function BasicSpec() {
  const locale = useLocale();
  const config = useStoreConfig();
  const cells = [
    [t(locale, "trust.shipping"), shippingText(config, locale)],
    [t(locale, "brand.details"), t(locale, "brand.choice")],
    [t(locale, "trust.support"), config.contactEmail || t(locale, "trust.support")],
  ];
  return (
    <section className="basic-spec">
      <div className="basic-spec-inner">
        {cells.map(([k, label]) => (
          <div key={k} className="basic-spec-cell">
            <span className="basic-spec-key">{k}</span>
            <span className="basic-spec-value">{label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function BasicApp({ config }: { config: StoreConfig }) {
  return <Storefront config={config} extraBand={<BasicSpec />} />;
}
