import { useState } from "react";
import { FiArrowLeft, FiArrowRight } from "react-icons/fi";
import { api, IconMail, IconPhone, OptimizedImage, sectionLabel, SocialIcon, socialChannelLabels, TijaraGoPoweredBy, type SocialChannel, type StorefrontCatalogContext } from "@storefront/core";

const newsletterCopy = {
  en: { eyebrow: "A letter from Atelier", title: "Join the Atelier Journal", body: "New collections, inspiration, and exclusive updates.", placeholder: "Your email address", submit: "Subscribe", done: "Thank you. You are now subscribed.", error: "Subscription could not be completed. Please try again." },
  fr: { eyebrow: "Une lettre d’Atelier", title: "Rejoignez le journal Atelier", body: "Nouvelles collections, inspiration et actualités exclusives.", placeholder: "Votre adresse e-mail", submit: "S’inscrire", done: "Merci. Votre inscription est confirmée.", error: "L’inscription a échoué. Veuillez réessayer." },
  ar: { eyebrow: "رسالة من أتيليه", title: "انضم إلى مجلة أتيليه", body: "مجموعات جديدة وإلهام وأخبار حصرية.", placeholder: "بريدك الإلكتروني", submit: "اشترك", done: "شكراً. تم تأكيد اشتراكك.", error: "تعذر إتمام الاشتراك. حاول مرة أخرى." },
} as const;

const footerCopy = {
  en: { shop: "Shop", company: "Company", support: "Support", contact: "Contact us", intro: "Considered essentials for a life\nof effortless style.", signature: "The art of everyday.", rights: "All rights reserved." },
  fr: { shop: "Boutique", company: "Entreprise", support: "Assistance", contact: "Contactez-nous", intro: "Des essentiels choisis pour une vie\nau style naturel.", signature: "L’art du quotidien.", rights: "Tous droits réservés." },
  ar: { shop: "المتجر", company: "الشركة", support: "الدعم", contact: "اتصل بنا", intro: "أساسيات مختارة لحياة\nبأسلوب بلا تكلّف.", signature: "فن الحياة اليومية.", rights: "جميع الحقوق محفوظة." },
} as const;

export function AtelierNewsletter({ locale }: StorefrontCatalogContext) {
  const copy = newsletterCopy[locale];
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "submitting" | "done" | "error">("idle");
  return <section className="atelier-newsletter">
    <p className="atelier-eyebrow">{copy.eyebrow}</p>
    <h2>{copy.title}</h2>
    <p>{copy.body}</p>
    {state === "done" ? <p className="atelier-newsletter-result" role="status">{copy.done}</p> : <form aria-busy={state === "submitting"} onSubmit={async (event) => {
      event.preventDefault();
      if (!email.trim() || state === "submitting") return;
      setState("submitting");
      try { await api.subscribe(email.trim()); setState("done"); } catch { setState("error"); }
    }}>
      <label className="atelier-sr-only" htmlFor="atelier-email">{copy.placeholder}</label>
      <input id="atelier-email" type="email" name="email" dir="auto" value={email} placeholder={copy.placeholder} autoComplete="email" required onChange={(event) => { setEmail(event.target.value); setState("idle"); }} />
      <button type="submit" disabled={state === "submitting"}>{copy.submit}{locale === "ar" ? <FiArrowLeft aria-hidden="true" /> : <FiArrowRight aria-hidden="true" />}</button>
    </form>}
    <p className="atelier-newsletter-note" role="status">{state === "error" ? copy.error : ""}</p>
  </section>;
}

export function AtelierFooter({ config, locale, sections }: StorefrontCatalogContext) {
  const copy = footerCopy[locale];
  const pages = Object.entries(config.pages ?? {});
  const contentPages = pages.filter(([key, page]) => page.type === "content" && key !== "contact" && !/^contact(?:-us)?$/i.test(page.route.replace(/^\/+|\/+$/g, ""))).slice(0, 4);
  const policyPages = pages.filter(([, page]) => page.type === "policy").slice(0, 4);
  const contactPage = pages.find(([key, page]) => key === "contact" || /^contact(?:-us)?$/i.test(page.route.replace(/^\/+|\/+$/g, "")));
  const label = (key: string, title: Record<string, string>) => title[locale]?.trim() || title.en?.trim() || key;
  const socialLinks = Object.entries(config.socialLinks ?? {}).filter((entry): entry is [SocialChannel, string] => Boolean(entry[1]));
  const showSocialLinks = config.appearance?.footer?.show_social_links ?? true;
  const showContact = config.appearance?.footer?.show_contact ?? true;
  const copyright = config.appearance?.footer?.copyright?.[locale]?.trim() || config.appearance?.footer?.copyright?.en?.trim();
  return <>
  <footer className="atelier-footer">
    <div className="atelier-shell">
      <div className="atelier-footer-grid">
        <div className="atelier-footer-brand-column"><a className={`atelier-wordmark${config.logoUrl ? " has-logo" : ""}`} href="/" aria-label={config.storeName}>{config.logoUrl ? <OptimizedImage className="atelier-footer-logo" src={config.logoUrl} widthHint={480} widths={[240, 320, 480]} sizes="(max-width: 600px) 180px, 240px" alt="" /> : config.storeName}</a><p>{copy.intro}</p><span className="atelier-footer-signature">{copy.signature}</span></div>
        <div><h2>{copy.shop}</h2><a href="/collections/all">{locale === "fr" ? "Tous les produits" : locale === "ar" ? "كل المنتجات" : "All products"}</a>{sections.slice(0, 3).map((section) => <a key={section.key} href={`/collections/${encodeURIComponent(section.key)}`}>{sectionLabel(locale, section.label)}</a>)}</div>
        <div><h2>{copy.company}</h2>{contentPages.length > 0 ? contentPages.map(([key, page]) => <a key={key} href={`/${page.route}`}>{label(key, page.title)}</a>) : <a href="/">{config.storeName}</a>}</div>
        <div><h2>{copy.support}</h2>{policyPages.map(([key, page]) => <a key={key} href={`/${page.route}`}>{label(key, page.title)}</a>)}</div>
        {(showContact && Boolean(config.contactEmail || config.phone || config.whatsappPhone) || showSocialLinks && socialLinks.length > 0) && <div className="atelier-footer-social-column"><h2>{copy.contact}</h2>{contactPage && <a className="atelier-contact-page-link" href={`/${contactPage[1].route}`}>{label(contactPage[0], contactPage[1].title)} <span aria-hidden="true">→</span></a>}{showContact && config.contactEmail && <a className="atelier-email" href={`mailto:${config.contactEmail}`}><IconMail />{config.contactEmail}</a>}{showContact && config.phone && <a href={`tel:${config.phone}`}><IconPhone /><bdi dir="ltr">{config.phone}</bdi></a>}{showContact && config.whatsappPhone && <a href={`https://wa.me/${config.whatsappPhone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer"><SocialIcon channel="whatsapp" />WhatsApp</a>}{showSocialLinks && socialLinks.length > 0 && <div className="atelier-social-list">{socialLinks.map(([channel, url]) => <a key={channel} className={`atelier-social sf-social-${channel}`} href={url} target="_blank" rel="noopener noreferrer" aria-label={socialChannelLabels[channel]} title={socialChannelLabels[channel]}><span className="sf-social-mark"><SocialIcon channel={channel} /></span><span className="sf-social-label">{socialChannelLabels[channel]}</span></a>)}</div>}</div>}
      </div>
      <div className="atelier-footer-bottom"><span>{copyright || `© ${new Date().getFullYear()} ${config.storeName}. ${copy.rights}`}</span><span>{locale.toUpperCase()} / {config.currency}</span></div>
    </div>
  </footer>
  <TijaraGoPoweredBy locale={locale} />
  </>;
}
