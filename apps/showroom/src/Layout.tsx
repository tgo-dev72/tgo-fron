import { useEffect, useRef, useState } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useAuth } from "./auth/AuthContext";
import { useTheme } from "./hooks/useTheme";
import { useLocale } from "./i18n";
import { LanguageSwitcher } from "./components/LanguageSwitcher";
import { IconCard, IconChevronDown, IconLogout, IconMoon, IconStore, IconSun, IconUser } from "./components/ShowroomIcons";
import { BrandLogo } from "./components/BrandLogo";
import { platform, type PlatformPresentation, type SubscriptionStatus } from "./api/platform";
import { SUBSCRIPTION_STATUS_EVENT } from "../../shared/paymentReturn";
import { SignOutDialog } from "./components/SignOutDialog";
import { getMarketingCopy } from "./marketingCopy";

const SOCIAL_LABELS: Record<string, string> = {
  facebook: "Facebook", instagram: "Instagram", linkedin: "LinkedIn",
  tiktok: "TikTok", x: "X", youtube: "YouTube",
};

function SocialLogo({ channel }: { channel: string }) {
  return <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    {channel === "facebook" && <path d="M13.5 21v-8h2.75l.41-3.1H13.5V7.92c0-.9.25-1.51 1.58-1.51h1.69V3.64a22.7 22.7 0 0 0-2.46-.13c-2.44 0-4.11 1.49-4.11 4.22V9.9H7.44V13h2.76v8h3.3Z" />}
    {channel === "instagram" && <><path fillRule="evenodd" d="M7.1 2h9.8A5.1 5.1 0 0 1 22 7.1v9.8a5.1 5.1 0 0 1-5.1 5.1H7.1A5.1 5.1 0 0 1 2 16.9V7.1A5.1 5.1 0 0 1 7.1 2Zm-.18 2A2.92 2.92 0 0 0 4 6.92v10.16A2.92 2.92 0 0 0 6.92 20h10.16A2.92 2.92 0 0 0 20 17.08V6.92A2.92 2.92 0 0 0 17.08 4H6.92ZM12 7.1A4.9 4.9 0 1 1 12 16.9 4.9 4.9 0 0 1 12 7.1Zm0 2a2.9 2.9 0 1 0 0 5.8 2.9 2.9 0 0 0 0-5.8Z" /><circle cx="17.45" cy="6.55" r="1.15" /></>}
    {channel === "linkedin" && <path d="M5.25 8.35H2.18V21h3.07V8.35ZM3.72 2A1.79 1.79 0 1 0 3.7 5.58 1.79 1.79 0 0 0 3.72 2ZM21.82 13.75c0-3.81-2.03-5.59-4.75-5.59a4.1 4.1 0 0 0-3.73 2.05V8.35h-3.07V21h3.07v-6.26c0-1.65.31-3.25 2.36-3.25 2.02 0 2.05 1.89 2.05 3.36V21h3.07v-7.25Z" />}
    {channel === "tiktok" && <path d="M15.7 2c.17 1.49 1 2.83 2.28 3.61A6.1 6.1 0 0 0 21 6.5v3.15a9.18 9.18 0 0 1-5.23-1.62v7.3A6.68 6.68 0 1 1 10 8.72v3.2a3.5 3.5 0 1 0 2.58 3.38V2h3.12Z" />}
    {channel === "x" && <path d="M4.04 3h4.91l3.83 5.11L17.34 3h1.62l-5.43 6.26L20.57 21h-4.9l-4.4-5.87L6.17 21H4.55l5.97-7.03L4.04 3Zm3.85 1.4H6.83l9.78 15.2h1.06L7.89 4.4Z" />}
    {channel === "youtube" && <path d="M21.58 7.19a2.5 2.5 0 0 0-1.76-1.77C18.26 5 12 5 12 5s-6.26 0-7.82.42a2.5 2.5 0 0 0-1.76 1.77A26.05 26.05 0 0 0 2 12a26.05 26.05 0 0 0 .42 4.81 2.5 2.5 0 0 0 1.76 1.77C5.74 19 12 19 12 19s6.26 0 7.82-.42a2.5 2.5 0 0 0 1.76-1.77A26.05 26.05 0 0 0 22 12a26.05 26.05 0 0 0-.42-4.81ZM10 15V9l5.2 3L10 15Z" />}
  </svg>;
}

function ContactLogo({ kind }: { kind: "email" | "phone" | "whatsapp" }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {kind === "email" && <><rect x="3" y="5" width="18" height="14" rx="3" /><path d="m4 7 8 6 8-6" /></>}
    {kind === "phone" && <path d="M7.1 3.5 9.7 7l-2 2.3a15 15 0 0 0 7 7l2.3-2 3.5 2.6-1.2 3a2.4 2.4 0 0 1-2.5 1.5A16.2 16.2 0 0 1 2.6 7.2a2.4 2.4 0 0 1 1.5-2.5l3-1.2Z" />}
    {kind === "whatsapp" && <><path d="M20.5 11.7a8.5 8.5 0 0 1-12.6 7.4L3 20.5l1.4-4.7A8.5 8.5 0 1 1 20.5 11.7Z" /><path d="M8.3 7.8c.6 3.8 2.2 5.5 6 6.2" /></>}
  </svg>;
}

const SUPPORT_EMAIL = (import.meta.env.VITE_SUPPORT_EMAIL as string | undefined)?.trim() || "";

export default function Layout() {
  const location = useLocation();
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [headerScrolled, setHeaderScrolled] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLElement>(null);
  const menuToggleRef = useRef<HTMLButtonElement>(null);
  const menuScrollYRef = useRef(0);
  const { theme, toggle } = useTheme();
  const { t, locale } = useLocale();
  const marketing = getMarketingCopy(locale);
  const [billingStatus, setBillingStatus] = useState<SubscriptionStatus | null>(null);
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingUnavailable, setBillingUnavailable] = useState(false);
  const [billingRevision, setBillingRevision] = useState(0);
  const [presentation, setPresentation] = useState<PlatformPresentation | null>(null);
  const reduceMotion = useReducedMotion();
  const isAuthPage = location.pathname === "/login" || location.pathname === "/signup";

  const NAV = [
    { to: "/#product", label: marketing.nav.product },
    { to: "/gallery", label: marketing.nav.themes },
    { to: "/how-it-works", label: marketing.nav.how },
    { to: "/pricing", label: marketing.nav.pricing },
  ];

  const isMobileNavActive = (to: string) => to.startsWith("/#")
    ? location.pathname === "/" && (location.hash === to.slice(1) || (!location.hash && to === "/#product"))
    : location.pathname === to;

  useEffect(() => {
    let active = true;
    platform.presentation().then((value) => { if (active) setPresentation(value); }).catch(() => {});
    return () => { active = false; };
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [location.pathname]);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      setHeaderScrolled((current) => {
        const next = window.scrollY > 12;
        return current === next ? current : next;
      });
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setBillingStatus(null);
      setBillingLoading(false);
      setBillingUnavailable(false);
      return;
    }
    let active = true;
    setBillingLoading(true);
    setBillingUnavailable(false);
    platform.subscriptionStatus().then((value) => {
      if (active) setBillingStatus(value);
    }).catch(() => {
      if (active) setBillingUnavailable(true);
    }).finally(() => {
      if (active) setBillingLoading(false);
    });
    return () => { active = false; };
  }, [user, location.pathname, billingRevision]);

  useEffect(() => {
    const refresh = () => setBillingRevision((revision) => revision + 1);
    window.addEventListener(SUBSCRIPTION_STATUS_EVENT, refresh);
    return () => window.removeEventListener(SUBSCRIPTION_STATUS_EVENT, refresh);
  }, []);

  const balances = billingStatus?.balances ?? [];
  const formatBalance = (value: string) => Math.floor(Number(value) || 0).toLocaleString(
    locale === "ar" ? "en-US" : locale,
    { maximumFractionDigits: 0 },
  );

  useEffect(() => {
    setMenuOpen(false);
    setAccountOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!menuOpen && !accountOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (menuOpen) window.requestAnimationFrame(() => menuToggleRef.current?.focus());
        setMenuOpen(false);
        setAccountOpen(false);
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [accountOpen, menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const previousOverflow = document.body.style.overflow;
    const previousPaddingInlineEnd = document.body.style.paddingInlineEnd;
    const previousPosition = document.body.style.position;
    const previousTop = document.body.style.top;
    const previousWidth = document.body.style.width;
    menuScrollYRef.current = window.scrollY;
    const scrollbarWidth = Math.max(0, window.innerWidth - document.documentElement.clientWidth);
    if (scrollbarWidth) document.body.style.paddingInlineEnd = `${scrollbarWidth}px`;
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${menuScrollYRef.current}px`;
    document.body.style.width = "100%";
    const focusable = () => Array.from(menuRef.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])') ?? []);
    window.requestAnimationFrame(() => focusable()[0]?.focus());
    const keepFocusInside = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const elements = focusable();
      if (!elements.length) return;
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", keepFocusInside);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingInlineEnd = previousPaddingInlineEnd;
      document.body.style.position = previousPosition;
      document.body.style.top = previousTop;
      document.body.style.width = previousWidth;
      window.scrollTo({ top: menuScrollYRef.current, behavior: "instant" });
      window.removeEventListener("keydown", keepFocusInside);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!accountOpen) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!accountRef.current?.contains(event.target as Node)) setAccountOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [accountOpen]);

  const signOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await logout();
      setSignOutOpen(false);
    } finally {
      setSigningOut(false);
    }
  };

  const requestSignOut = () => {
    setAccountOpen(false);
    setMenuOpen(false);
    setSignOutOpen(true);
  };

  return (
    <div className="sr-app">
      {!isAuthPage && (
        <>
        <header className={`sr-header${headerScrolled ? " is-scrolled" : ""}`}>
          <div className="sr-header-inner">
            <Link to="/" className="sr-logo" onClick={() => setMenuOpen(false)} aria-label={t("layout.home")}>
              <BrandLogo alt="" className="sr-logo-img" width={48} height={48} />
            </Link>

            <nav className="sr-nav" aria-label={t("layout.primary")}>
              {NAV.map((n) => n.to.startsWith("/#") ? (
                <a key={n.to} href={n.to}>{n.label}</a>
              ) : (
                <Link key={n.to} to={n.to} className={location.pathname === n.to ? "active" : ""}>{n.label}</Link>
              ))}
              {user && <Link to="/dashboard" className={location.pathname === "/dashboard" ? "active" : ""}>{t("nav.stores")}</Link>}
            </nav>

            <div className="sr-header-right">
              <LanguageSwitcher />
              <button
                type="button"
                className="sr-theme-toggle"
                onClick={toggle}
                aria-label={theme === "light" ? t("layout.theme.dark") : t("layout.theme.light")}
                title={theme === "light" ? t("layout.theme.dark") : t("layout.theme.light")}
              >
                {theme === "light" ? <IconMoon /> : <IconSun />}
              </button>
              {user && (
                <Link to="/membership" className="sr-header-balance" title={t("nav.balance")}>
                  <span>{t("nav.balance")}</span>
                  <strong>{billingLoading && !billingStatus
                    ? "…"
                    : billingUnavailable && !billingStatus
                      ? "—"
                      : balances.length
                        ? balances.map((item) => `${formatBalance(item.balance)} ${item.currency}`).join(" · ")
                        : `0 MAD`}</strong>
                  {balances.some((item) => Number(item.reserved) > 0) && (
                    <small>{t("nav.balanceReserved").replace("{amount}", balances.filter((item) => Number(item.reserved) > 0).map((item) => `${formatBalance(item.reserved)} ${item.currency}`).join(" · "))}</small>
                  )}
                </Link>
              )}
              {user ? (
                <div className="sr-account" ref={accountRef}>
                  <button
                    type="button"
                    className={`sr-account-trigger${accountOpen ? " open" : ""}`}
                    onClick={() => setAccountOpen((open) => !open)}
                    aria-haspopup="menu"
                    aria-expanded={accountOpen}
                    aria-label={t("nav.account")}
                  >
                    <span className="sr-user-avatar">{user.name.charAt(0).toUpperCase()}</span>
                    <span className="sr-account-trigger-copy">
                      <strong>{user.name}</strong>
                      <small>{t("nav.account")}</small>
                    </span>
                    <span className="sr-account-chevron"><IconChevronDown /></span>
                  </button>
                  <AnimatePresence>
                    {accountOpen && (
                      <motion.div
                        className="sr-account-menu"
                        role="menu"
                        initial={reduceMotion ? false : { opacity: 0, y: -6, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -4, scale: 0.98 }}
                        transition={{ duration: reduceMotion ? 0 : 0.16 }}
                      >
                        <div className="sr-account-identity">
                          <span className="sr-user-avatar sr-user-avatar-lg">{user.name.charAt(0).toUpperCase()}</span>
                          <span><strong>{user.name}</strong><small>{user.email}</small></span>
                        </div>
                        <div className="sr-account-menu-rule" />
                        <Link to="/dashboard" role="menuitem"><IconStore /><span>{t("nav.stores")}</span></Link>
                        <Link to="/profile" role="menuitem"><IconUser /><span>{t("nav.profile")}</span></Link>
                        <Link to="/membership" role="menuitem"><IconCard /><span>{t("nav.billing")}</span></Link>
                        <div className="sr-account-menu-rule" />
                        <button type="button" role="menuitem" onClick={requestSignOut}><IconLogout /><span>{t("nav.signOut")}</span></button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ) : (
                <>
                  <Link to="/login" className="sr-btn sr-btn-ghost sr-btn-sm">{marketing.nav.login}</Link>
                  <Link to="/signup" className="sr-btn sr-btn-primary sr-btn-sm">{marketing.nav.cta}</Link>
                </>
              )}
              <button
                type="button"
                ref={menuToggleRef}
                className={`sr-menu-toggle ${menuOpen ? "open" : ""}`}
                onClick={() => setMenuOpen((o) => !o)}
                aria-expanded={menuOpen}
                aria-controls="showroom-mobile-navigation"
                aria-label={t("layout.menu")}
              >
                <span /><span /><span />
              </button>
            </div>
          </div>
        </header>
          <AnimatePresence>
            {menuOpen && (
              <motion.div className="sr-mobile-nav-layer" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduceMotion ? 0 : .24, ease: [0.22, 1, 0.36, 1] }} onPointerDown={(event) => { if (event.target === event.currentTarget) { setMenuOpen(false); menuToggleRef.current?.focus(); } }}>
              <motion.nav
                ref={menuRef}
                id="showroom-mobile-navigation"
                className="sr-mobile-nav"
                initial={reduceMotion ? false : { opacity: 0, x: locale === "ar" ? 44 : -44 }}
                animate={{ opacity: 1, x: 0 }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: locale === "ar" ? 34 : -34, transition: { duration: .24, ease: [0.4, 0, 1, 1] } }}
                transition={reduceMotion ? { duration: 0 } : { duration: .32, ease: [0.22, 1, 0.36, 1] }}
                aria-label={t("layout.mobile")}
                aria-modal="true"
                role="dialog"
              >
                <div className="sr-mobile-nav-head">
                  <span className="sr-mobile-nav-brand"><BrandLogo alt="" width={46} height={38} /><span><strong>TijaraGO</strong><small>{t("layout.collection")}</small></span></span>
                  <button type="button" className="sr-mobile-nav-close" onClick={() => { setMenuOpen(false); menuToggleRef.current?.focus(); }} aria-label={t("layout.menu")}>
                    <span aria-hidden="true" />
                    <span aria-hidden="true" />
                  </button>
                </div>
                <motion.div className="sr-mobile-nav-content" initial={reduceMotion ? false : "hidden"} animate="visible" variants={{ hidden: {}, visible: { transition: { delayChildren: .08, staggerChildren: .045 } } }}>
                <section className="sr-mobile-nav-section" aria-labelledby="mobile-explore-heading">
                <strong className="sr-mobile-nav-label" id="mobile-explore-heading">{t("layout.explore")}</strong>
                <div className="sr-mobile-nav-links">
                  {NAV.map((n) => n.to.startsWith("/#") ? (
                    <motion.a key={n.to} href={n.to} className={isMobileNavActive(n.to) ? "active" : ""} aria-current={isMobileNavActive(n.to) ? "page" : undefined} onClick={() => setMenuOpen(false)} variants={{ hidden: { opacity: 0, x: locale === "ar" ? 14 : -14 }, visible: { opacity: 1, x: 0 } }} transition={{ duration: .22 }}><span>{n.label}</span><small aria-hidden="true">{locale === "ar" ? "←" : "→"}</small></motion.a>
                  ) : (
                    <motion.div key={n.to} variants={{ hidden: { opacity: 0, x: locale === "ar" ? 14 : -14 }, visible: { opacity: 1, x: 0 } }} transition={{ duration: .22 }}><Link to={n.to} className={isMobileNavActive(n.to) ? "active" : ""} aria-current={isMobileNavActive(n.to) ? "page" : undefined} onClick={() => setMenuOpen(false)}><span>{n.label}</span><small aria-hidden="true">{locale === "ar" ? "←" : "→"}</small></Link></motion.div>
                  ))}
                </div>
                </section>
                {user ? (
                  <motion.section className="sr-mobile-nav-section sr-mobile-account" variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } }}>
                    <strong className="sr-mobile-nav-label">{t("nav.account")}</strong>
                    <div className="sr-mobile-account-identity">
                      <span className="sr-user-avatar">{user.name.charAt(0).toUpperCase()}</span>
                      <span><strong>{user.name}</strong><small>{user.email}</small></span>
                    </div>
                    <Link to="/dashboard" onClick={() => setMenuOpen(false)}><IconStore />{t("nav.stores")}</Link>
                    <Link to="/profile" onClick={() => setMenuOpen(false)}><IconUser />{t("nav.profile")}</Link>
                    <Link to="/membership" onClick={() => setMenuOpen(false)}><IconCard />{t("nav.billing")}</Link>
                    <button type="button" onClick={requestSignOut}><IconLogout />{t("nav.signOut")}</button>
                  </motion.section>
                ) : (
                  <motion.div className="sr-mobile-auth" variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } }}>
                    <Link to="/login" className="sr-btn sr-btn-ghost" onClick={() => setMenuOpen(false)}>{marketing.nav.login}</Link>
                  </motion.div>
                )}
                <motion.section className="sr-mobile-nav-section sr-mobile-settings-section" variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } }}>
                  <strong className="sr-mobile-nav-label">{t("layout.preferences")}</strong>
                  <div className="sr-mobile-preferences">
                    <div><span>{t("account.language")}</span><LanguageSwitcher /></div>
                    <button type="button" className="sr-mobile-theme" onClick={toggle} aria-label={theme === "light" ? t("layout.theme.dark") : t("layout.theme.light")}>
                      <span>{theme === "light" ? t("layout.theme.dark") : t("layout.theme.light")}</span>{theme === "light" ? <IconMoon /> : <IconSun />}
                    </button>
                  </div>
                </motion.section>
                <motion.div className="sr-mobile-nav-cta" variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } }}>
                  <Link to={user ? "/create" : "/signup"} className="sr-btn sr-btn-primary" onClick={() => setMenuOpen(false)}>{marketing.nav.cta}</Link>
                </motion.div>
                </motion.div>
              </motion.nav>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}

      <motion.main
        className="sr-main sr-route-stage"
        id="main-content"
        initial={reduceMotion ? false : { opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduceMotion ? 0 : 0.2, ease: [0.22, 1, 0.36, 1] }}
      >
        <Outlet />
      </motion.main>

      {!isAuthPage && (
        <footer className="sr-footer">
          <div className="sr-container">
            <div className="sr-footer-brand">
              <BrandLogo className="sr-footer-logo" width={72} height={58} />
              <p>{marketing.footer.summary}</p>
            </div>
            <div className="sr-footer-columns">
              <div><strong>{marketing.footer.product}</strong><a href="/#product">{marketing.footer.productLinks[0]}</a><a href="/#product">{marketing.footer.productLinks[1]}</a><a href="/#languages">{marketing.footer.productLinks[2]}</a></div>
              <div><strong>{marketing.footer.explore}</strong><Link to="/gallery">{marketing.footer.gallery}</Link><Link to="/pricing">{marketing.footer.pricing}</Link>{(presentation?.contact_email || SUPPORT_EMAIL) && <a href={`mailto:${presentation?.contact_email || SUPPORT_EMAIL}`}>{marketing.footer.support}</a>}</div>
              <div><strong>{marketing.footer.account}</strong>{!user && <Link to="/login">{marketing.footer.login}</Link>}{!user && <Link to="/signup">{marketing.footer.signup}</Link>}<Link to="/privacy">{marketing.footer.privacy}</Link><Link to="/terms">{marketing.footer.terms}</Link></div>
              {presentation && (presentation.contact_email || presentation.support_phone || presentation.whatsapp_phone || Object.keys(presentation.social_links).length > 0) && <div className="sr-footer-contact"><strong>{t("layout.contact")}</strong><div className="sr-footer-contact-rows">{presentation.contact_email && <a href={`mailto:${presentation.contact_email}`}><span>{presentation.contact_email}</span><i><ContactLogo kind="email" /></i></a>}{presentation.support_phone && <a dir="ltr" href={`tel:${presentation.support_phone.replace(/\s/g, "")}`}><span>{presentation.support_phone}</span><i><ContactLogo kind="phone" /></i></a>}{presentation.whatsapp_phone && <a href={`https://wa.me/${presentation.whatsapp_phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer"><span>WhatsApp</span><i className="is-whatsapp"><ContactLogo kind="whatsapp" /></i></a>}</div>{Object.keys(presentation.social_links).length > 0 && <span className="sr-footer-socials">{Object.entries(presentation.social_links).map(([channel, url]) => <a className={`sr-social-link sr-social-${channel}`} key={channel} href={url} target="_blank" rel="noreferrer" aria-label={SOCIAL_LABELS[channel] || channel} title={SOCIAL_LABELS[channel] || channel}><span className="sr-social-mark"><SocialLogo channel={channel} /></span></a>)}</span>}</div>}
            </div>
            <p className="sr-footer-legal">© {new Date().getFullYear()} {marketing.footer.rights}</p>
          </div>
        </footer>
      )}
      <SignOutDialog
        open={signOutOpen}
        title={t("signOut.title")}
        body={t("signOut.body")}
        cancelLabel={t("signOut.cancel")}
        confirmLabel={t("nav.signOut")}
        busy={signingOut}
        onCancel={() => setSignOutOpen(false)}
        onConfirm={() => void signOut()}
      />
    </div>
  );
}
