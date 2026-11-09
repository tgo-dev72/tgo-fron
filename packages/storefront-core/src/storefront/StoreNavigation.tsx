import { useEffect, useRef, useState } from "react";
import type { FormEvent, MouseEvent } from "react";
import type { CatalogSection, Product } from "../api/types";
import { dir, sectionLabel, t, useLocale, useSetLocale, type Locale } from "../i18n";
import { Container } from "../system/primitives";
import { useStoreConfig } from "./context";
import { useAuth } from "./auth";
import { customerAccountHref } from "./accountNavigation";
import { trackStorefrontEvent } from "../api/analytics";
import { IconArrow, IconCart, IconClose, IconMenu, IconSearch, IconUser } from "./components";
import { OptimizedImage } from "../media/image";
import { buildStoreMenu, headerPreset, isMenuItemActive, type HeaderPreset, type MenuLink, type StoreMenuItem } from "./navigation";
import "./navigation.css";

const languages: Locale[] = ["en", "fr", "ar"];
const localeText = {
  en: { close: "Close", back: "Back", home: "Home", results: "View all results", search: "Search", menu: "Browse", categories: "Categories" },
  fr: { close: "Fermer", back: "Retour", home: "Accueil", results: "Voir tous les résultats", search: "Rechercher", menu: "Explorer", categories: "Catégories" },
  ar: { close: "إغلاق", back: "رجوع", home: "الرئيسية", results: "عرض كل النتائج", search: "بحث", menu: "تصفح", categories: "الفئات" },
};

function MenuBranch({ items, pathname, activePath, hash, onFollow, level = 1, openTop, setOpenTop, preset, featured, locale }: {
  items: StoreMenuItem[]; pathname: string; activePath: string; hash: string;
  onFollow: (event: MouseEvent<HTMLAnchorElement>, item: StoreMenuItem) => void;
  level?: number; openTop: string | null; setOpenTop: (id: string | null) => void;
  preset: HeaderPreset; featured?: Product; locale: Locale;
}) {
  const [openChild, setOpenChild] = useState<string | null>(null);
  const activeTopLevelCategory = level === 1 && items.some((item) => item.type === "category" && isMenuItemActive(item, activePath, hash));
  useEffect(() => { if (level > 1 && !openTop) setOpenChild(null); }, [level, openTop]);
  return <ul className={`sf-menu-list sf-menu-level-${level}`}>
    {items.map((item) => <li key={item.id} className={`sf-menu-item ${item.children?.length ? "has-children" : ""} ${(level === 1 ? openTop === item.id : openChild === item.id) ? "is-open" : ""}`}
      onMouseEnter={() => level === 1 ? setOpenTop(item.id) : setOpenChild(item.id)}
      onMouseLeave={() => level === 1 ? setOpenTop(null) : setOpenChild(null)}
      onFocus={() => level === 1 ? setOpenTop(item.id) : setOpenChild(item.id)}>
      <div className="sf-menu-label-row">{item.type === "group" ? <span className="sf-menu-group-label">{item.label}</span> : <a href={item.href} className={isMenuItemActive(item, activePath, hash) && !(activeTopLevelCategory && item.id === "shop") ? "is-active" : ""} aria-current={item.href === (item.href.startsWith("#/") ? hash : pathname) ? "page" : undefined} onClick={(event) => onFollow(event, item)}>{item.label}</a>}
        {item.children?.length ? <button type="button" className="sf-menu-expand" aria-label={`${item.label} menu`} aria-expanded={level === 1 ? openTop === item.id : openChild === item.id} onClick={() => level === 1 ? setOpenTop(item.id) : setOpenChild(item.id)}>⌄</button> : null}</div>
      {item.children?.length ? <div className={`sf-menu-dropdown ${level === 1 && item.id === "shop" && preset !== "compact" ? "is-mega" : ""}`}>
        <MenuBranch items={item.children} pathname={pathname} activePath={activePath} hash={hash} onFollow={onFollow} level={level + 1} openTop={openTop} setOpenTop={setOpenTop} preset={preset} locale={locale} />
        {level === 1 && item.id === "shop" && preset !== "compact" && featured?.images?.length ? <a className="sf-menu-featured" href={`/products/${encodeURIComponent(featured.slug || String(featured.id))}`}><OptimizedImage src={featured.images.find((image) => image.is_primary)?.image ?? featured.images[0].image} widthHint={480} widths={[240, 360, 480]} sizes="240px" alt="" /><span><small>{t(locale, "catalog.discover")}</small><strong>{featured.name}</strong><span>{{ en: "Explore", fr: "Découvrir", ar: "اكتشف" }[locale]} <IconArrow /></span></span></a> : null}
      </div> : null}
    </li>)}
  </ul>;
}

function LocaleSelector({ locale, onSelect }: { locale: Locale; onSelect: (locale: Locale) => void }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    rootRef.current?.querySelector<HTMLButtonElement>(".sf-locale-options button")?.focus();
    const onPointer = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setOpen(false); triggerRef.current?.focus(); }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onPointer); document.removeEventListener("keydown", onKey); };
  }, [open]);
  const names: Record<Locale, string> = { en: "English", fr: "Français", ar: "العربية" };
  return <div className="sf-locale-select" ref={rootRef}>
    <button type="button" ref={triggerRef} aria-label={t(locale, "nav.lang")} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((value) => !value)}>{locale.toUpperCase()} <span aria-hidden="true">⌄</span></button>
    {open && <div className="sf-locale-options" role="menu" aria-label={t(locale, "nav.lang")}>{languages.map((language) => <button type="button" key={language} role="menuitemradio" aria-checked={language === locale} onClick={() => { onSelect(language); setOpen(false); triggerRef.current?.focus(); }}>{names[language]}</button>)}</div>}
  </div>;
}

export function StoreNav({ cartCount, onOpenCart, navLinks = [], sections, products, pathname, hash, searchQuery = "" }: {
  cartCount: number;
  onOpenCart: () => void;
  navLinks?: MenuLink[];
  sections: CatalogSection[];
  products: Product[];
  pathname: string;
  hash: string;
  searchQuery?: string;
}) {
  const config = useStoreConfig();
  const locale = useLocale();
  const setLocale = useSetLocale();
  const { user, logout } = useAuth();
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);
  const accountButtonRef = useRef<HTMLButtonElement>(null);
  const labels = localeText[locale];
  const menu = buildStoreMenu(config, sections, locale, navLinks, products);
  const preset = headerPreset(config);
  const header = config.appearance?.header;
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [openTop, setOpenTop] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [trail, setTrail] = useState<StoreMenuItem[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchClosing, setSearchClosing] = useState(false);
  const [search, setSearch] = useState(searchQuery);
  const [searchFocused, setSearchFocused] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const searchButtonRef = useRef<HTMLButtonElement>(null);
  const mobileSearchButtonRef = useRef<HTMLButtonElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const searchCloseTimerRef = useRef<number | null>(null);
  const featured = products.find((product) => product.images?.length > 0);
  const focusSearchTrigger = () => (searchButtonRef.current?.offsetParent ? searchButtonRef.current : mobileSearchButtonRef.current)?.focus();
  const productIdentifier = pathname.startsWith("/products/") ? decodeURIComponent(pathname.split("/")[2] ?? "") : "";
  const currentProduct = productIdentifier ? products.find((product) => product.slug === productIdentifier || String(product.id) === productIdentifier) : undefined;
  const currentCategory = sections.find((section) => section.id === currentProduct?.section);
  const activePath = currentCategory ? `/collections/${encodeURIComponent(currentCategory.key)}` : pathname;
  const items = trail.length ? trail[trail.length - 1].children ?? [] : menu;
  const suggestions = search.trim().length < 2 ? [] : products.filter((product) => [product.name, product.description, ...Object.values(product.attributes ?? {})].some((value) => String(value).toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))).slice(0, 5);
  const matchingSections = search.trim().length < 2 ? [] : sections.filter((section) => sectionLabel(locale, section.label).toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())).slice(0, 3);

  const openSearch = () => {
    if (searchCloseTimerRef.current !== null) window.clearTimeout(searchCloseTimerRef.current);
    searchCloseTimerRef.current = null;
    setSearchClosing(false);
    setDrawerOpen(false);
    setSearchOpen(true);
  };
  const closeSearch = (restoreFocus = false) => {
    if (!searchOpen || searchClosing) return;
    setSearchClosing(true);
    searchCloseTimerRef.current = window.setTimeout(() => {
      searchCloseTimerRef.current = null;
      setSearchOpen(false);
      setSearchClosing(false);
      if (restoreFocus) focusSearchTrigger();
    }, 180);
  };

  useEffect(() => { setSearch(searchQuery); }, [searchQuery]);
  useEffect(() => () => {
    if (searchCloseTimerRef.current !== null) window.clearTimeout(searchCloseTimerRef.current);
  }, []);
  useEffect(() => { const update = () => setScrolled(window.scrollY > 32); update(); window.addEventListener("scroll", update, { passive: true }); return () => window.removeEventListener("scroll", update); }, []);
  useEffect(() => { if (drawerOpen) drawerRef.current?.querySelector<HTMLButtonElement>("button")?.focus(); }, [drawerOpen]);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("gallery") === "navigation") setDrawerOpen(true);
  }, []);
  useEffect(() => { if (searchOpen) searchInputRef.current?.focus(); }, [searchOpen]);
  useEffect(() => { if (!searchFocused) return; const onOutside = (event: PointerEvent) => { if (!(event.target instanceof Element) || !event.target.closest(".sf-header-search-main, .sf-inline-suggestions")) setSearchFocused(false); }; document.addEventListener("pointerdown", onOutside); return () => document.removeEventListener("pointerdown", onOutside); }, [searchFocused]);
  useEffect(() => {
    if (!drawerOpen && !searchOpen && !openTop) return;
    const before = document.body.style.overflow;
    if (drawerOpen || searchOpen) document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setDrawerOpen(false); setTrail([]); setOpenTop(null);
        if (searchOpen) closeSearch(true);
        else if (drawerOpen) menuButtonRef.current?.focus();
      }
      if (event.key !== "Tab") return;
      const root = searchOpen ? searchRef.current : drawerRef.current;
      const focusable = Array.from(root?.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled])') ?? []).filter((element) => element.offsetParent !== null);
      if (!focusable.length) return;
      if (event.shiftKey && document.activeElement === focusable[0]) { event.preventDefault(); focusable[focusable.length - 1]?.focus(); }
      if (!event.shiftKey && document.activeElement === focusable[focusable.length - 1]) { event.preventDefault(); focusable[0].focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = before; document.removeEventListener("keydown", onKey); };
  }, [drawerOpen, searchOpen, openTop]);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("gallery") === "navigation") return;
    setDrawerOpen(false); setSearchOpen(false); setTrail([]); setOpenTop(null); setAccountOpen(false);
  }, [pathname, hash]);
  useEffect(() => {
    if (!accountOpen) return;
    accountRef.current?.querySelector<HTMLElement>(".sf-account-popover a, .sf-account-popover button")?.focus();
    const onPointer = (event: PointerEvent) => {
      if (event.target instanceof Node && !accountRef.current?.contains(event.target)) setAccountOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setAccountOpen(false); accountButtonRef.current?.focus(); }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onPointer); document.removeEventListener("keydown", onKey); };
  }, [accountOpen]);

  const follow = (event: MouseEvent<HTMLAnchorElement>, item: StoreMenuItem) => {
    setDrawerOpen(false); setSearchOpen(false); setTrail([]); setOpenTop(null);
    if (!item.targetId) return;
    event.preventDefault();
    if (window.location.pathname !== "/" || window.location.hash.startsWith("#/")) {
      window.history.pushState(null, "", "/");
      window.dispatchEvent(new PopStateEvent("popstate"));
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    }
    window.setTimeout(() => document.getElementById(item.targetId!)?.scrollIntoView({ behavior: "smooth" }), 80);
  };
  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = search.trim();
    window.location.assign(`/collections/all${value ? `?search=${encodeURIComponent(value)}` : ""}`);
  };
  const overlay = (config.navigation?.transparentOnHero ?? preset === "editorial") && pathname === "/" && (!hash || hash === "#/");
  const premium = preset === "refined" || preset === "editorial";
  const composition = !header?.layout || header.layout === "logo_center" ? "centered" : header.layout === "logo_start" ? preset : premium ? "centered" : preset;
  const showSearch = (header?.show_search ?? true) && config.navigation?.showSearch !== false;
  const cartText = preset === "editorial" ? { en: "Bag", fr: "Panier", ar: "الحقيبة" }[locale] : t(locale, "nav.cart");
  const mainMenu = <MenuBranch items={menu} pathname={pathname} activePath={activePath} hash={hash} onFollow={follow} openTop={openTop} setOpenTop={setOpenTop} preset={preset} featured={featured} locale={locale} />;
  const searchTrigger = (mobile = false) => <button type="button" ref={mobile ? mobileSearchButtonRef : searchButtonRef} className={`sf-header-icon sf-search-trigger ${mobile ? "sf-search-mobile" : "sf-search-desktop"}`} aria-label={labels.search} aria-expanded={searchOpen} onClick={openSearch}><IconSearch /><span>{labels.search}</span></button>;
  useEffect(() => {
    const headerElement = headerRef.current;
    const root = headerElement?.closest<HTMLElement>(".sf-root");
    if (!headerElement || !root) return;
    const measure = () => {
      const height = Math.ceil(headerElement.getBoundingClientRect().height);
      if (height <= 0) return;
      root.style.setProperty("--sf-nav-height", `${height}px`);
      root.style.setProperty("--sf-tabs-top", `${height}px`);
    };
    measure();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(headerElement);
    return () => observer.disconnect();
  }, [composition, header?.logo_size, preset]);
  return <>
    <header ref={headerRef} className="ds-nav sf-nav" data-nav-preset={preset} data-composition={composition} data-header-width={header?.width ?? "contained"} data-logo-size={header?.logo_size ?? "standard"} data-nav-alignment={header?.nav_alignment ?? "center"} data-overlay={overlay} data-transparent={overlay && !scrolled}>
      <Container className="sf-header-main">
        <button type="button" ref={menuButtonRef} className="sf-nav-toggle" aria-label={t(locale, "nav.menu")} aria-expanded={drawerOpen} aria-controls="sf-mobile-navigation" onClick={() => { setSearchOpen(false); setDrawerOpen(true); }}><IconMenu /></button>
        {composition === "centered" && showSearch && searchTrigger()}
        <a className="ds-wordmark sf-wordmark" href="/" onClick={() => window.scrollTo({ top: 0 })}>
          {config.logoUrl ? <OptimizedImage className="sf-store-logo" src={config.logoUrl} widthHint={320} widths={[160, 240, 320]} sizes="160px" alt={config.storeName} priority /> : <span className="sf-store-name">{config.storeName}</span>}
        </a>
        {preset === "compact" && <nav className="sf-nav-links sf-inline-nav" aria-label={t(locale, "nav.menu")} onKeyDown={(event) => { if (event.key === "Escape") setOpenTop(null); }}>{mainMenu}</nav>}
        {preset === "search-first" && showSearch && <form className="sf-header-search-main" role="search" onSubmit={submitSearch}><IconSearch /><input type="search" value={search} onFocus={() => setSearchFocused(true)} onKeyDown={(event) => { if (event.key === "Escape") { setSearchFocused(false); event.currentTarget.blur(); } }} onChange={(event) => setSearch(event.target.value)} placeholder={t(locale, "catalog.search")} aria-label={t(locale, "catalog.search")} /><button type="submit" aria-label={labels.search}><IconArrow rtl={dir(locale) === "rtl"} /></button></form>}
        <div className="ds-nav-actions sf-header-actions">
          {composition !== "centered" && preset !== "search-first" && showSearch && searchTrigger()}
          {composition === "centered" && showSearch && searchTrigger(true)}
          {(header?.show_language ?? true) && config.navigation?.showLocale !== false && <LocaleSelector locale={locale} onSelect={setLocale} />}
          {(header?.show_account ?? true) && config.navigation?.showAccount !== false && <div className="sf-account-entry" ref={accountRef}>
            <button type="button" ref={accountButtonRef} className="sf-account-btn" aria-label={t(locale, "auth.account")} aria-haspopup="dialog" aria-expanded={accountOpen} onClick={() => {
              trackStorefrontEvent({ eventType: "account_entry_clicked" });
              if (window.matchMedia("(max-width: 1120px)").matches || preset === "compact") { window.location.assign(user ? "/account" : customerAccountHref()); return; }
              setAccountOpen((open) => !open);
            }}>{user ? <span className="sf-account-chip">{user.firstName.charAt(0).toUpperCase()}</span> : <IconUser />}</button>
            {accountOpen && <div className="sf-account-popover" role="dialog" aria-label={t(locale, "auth.account")}>
              {user ? <><strong>{t(locale, "auth.welcome", user.firstName)}</strong><a href="/account">{t(locale, "auth.account")}</a><a href="/account?tab=orders">{t(locale, "auth.tabs.orders")}</a><a href="/account?tab=profile">{t(locale, "auth.tabs.profile")}</a><button type="button" onClick={() => { setAccountOpen(false); void logout(); }}>{t(locale, "auth.logout")}</button></>
                : <><strong>{{ en: "Welcome", fr: "Bienvenue", ar: "مرحبًا" }[locale]}</strong><p>{{ en: "Sign in to see your orders and keep your details ready.", fr: "Connectez-vous pour suivre vos commandes et retrouver vos informations.", ar: "سجّل الدخول لمتابعة طلباتك والاحتفاظ ببياناتك." }[locale]}</p><a className="sf-account-popover-primary" href={customerAccountHref()}>{t(locale, "auth.signIn")}</a><a href={customerAccountHref("register")}>{t(locale, "auth.createAccount")}</a></>}
            </div>}
          </div>}
          {(header?.show_cart ?? true) && config.navigation?.showCart !== false && <button type="button" className="sf-cart-btn" onClick={onOpenCart} aria-label={`${cartText}${cartCount ? ` (${cartCount})` : ""}`}><IconCart /><span className="sf-cart-text">{cartText}</span>{cartCount > 0 && <span className="sf-cart-count" aria-live="polite">{cartCount > 99 ? "99+" : cartCount}</span>}</button>}
        </div>
      </Container>
      {preset !== "compact" && <nav className={`sf-nav-links ${preset === "search-first" ? "sf-departments" : "sf-primary-nav"}`} aria-label={t(locale, "nav.menu")} onKeyDown={(event) => { if (event.key === "Escape") setOpenTop(null); }}><Container>{mainMenu}</Container></nav>}
      {preset === "search-first" && searchFocused && search.trim().length >= 2 && <div className="sf-inline-suggestions"><SearchSuggestions sections={matchingSections} products={suggestions} locale={locale} query={search} onFollow={() => setSearch("")} /></div>}
    </header>
    {drawerOpen && <div className="sf-nav-scrim" onClick={() => setDrawerOpen(false)} aria-hidden="true" />}
    <div id="sf-mobile-navigation" ref={drawerRef} className={`sf-mobile-drawer ${drawerOpen ? "is-open" : ""}`} role="dialog" aria-modal={drawerOpen || undefined} aria-label={labels.menu}>
      <div className="sf-mobile-drawer-head"><strong>{trail.length ? trail[trail.length - 1]?.label : labels.menu}</strong><button type="button" aria-label={labels.close} onClick={() => { setDrawerOpen(false); setTrail([]); menuButtonRef.current?.focus(); }}>×</button></div>
      {trail.length > 0 && <button type="button" className="sf-mobile-back" onClick={() => setTrail((current) => current.slice(0, -1))}>← {labels.back}</button>}
      {trail.length > 0 && trail[trail.length - 1].type !== "group" && <a className="sf-mobile-view-all" href={trail[trail.length - 1].href} onClick={() => setDrawerOpen(false)}>{locale === "fr" ? "Voir tout" : locale === "ar" ? "عرض الكل" : "View all"} {trail[trail.length - 1].label}</a>}
      <nav aria-label={t(locale, "nav.menu")} className="sf-mobile-drawer-links">{items.map((item) => <div key={item.id} className="sf-mobile-drawer-row">{item.type === "group" ? <span className="sf-mobile-group-label">{item.label}</span> : <a href={item.href} onClick={(event) => follow(event, item)} aria-current={item.href === (item.href.startsWith("#/") ? hash : pathname) ? "page" : undefined}>{item.label}</a>}{item.children?.length ? <button type="button" aria-label={`${item.label}: ${labels.categories}`} onClick={() => setTrail((current) => [...current, item])}>›</button> : null}</div>)}</nav>
      <div className="sf-mobile-drawer-foot">{(header?.show_account ?? true) && config.navigation?.showAccount !== false && <a href={user ? "/account" : customerAccountHref()} onClick={() => { setDrawerOpen(false); trackStorefrontEvent({ eventType: "account_entry_clicked" }); }}>{user ? t(locale, "auth.account") : t(locale, "auth.signIn")}</a>}{(header?.show_language ?? true) && config.navigation?.showLocale !== false && <div role="group" aria-label={t(locale, "nav.lang")}>{languages.map((language) => <button type="button" key={language} aria-pressed={language === locale} className={language === locale ? "is-active" : ""} onClick={() => setLocale(language)}>{language.toUpperCase()}</button>)}</div>}</div>
    </div>
    {searchOpen && <div className={`sf-search-backdrop${searchClosing ? " is-closing" : ""}`} onClick={() => closeSearch()} aria-hidden="true" />}
    {searchOpen && <div ref={searchRef} className={`sf-search-dialog${searchClosing ? " is-closing" : ""}`} role="dialog" aria-modal="true" aria-label={labels.search}><div className="sf-search-dialog-head"><strong>{labels.search}</strong><button type="button" aria-label={labels.close} onClick={() => closeSearch(true)}><IconClose /></button></div><form role="search" onSubmit={submitSearch}><IconSearch /><input ref={searchInputRef} type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t(locale, "catalog.search")} aria-label={t(locale, "catalog.search")} /><button type="submit">{labels.search}</button></form><SearchSuggestions sections={matchingSections} products={suggestions} locale={locale} query={search} onFollow={() => setSearchOpen(false)} /></div>}
  </>;
}

function SearchSuggestions({ sections, products, locale, query, onFollow }: { sections: CatalogSection[]; products: Product[]; locale: Locale; query: string; onFollow: () => void }) {
  if (query.trim().length < 2) return null;
  return <div className="sf-nav-search-suggestions">{sections.map((section) => <a className="sf-search-section-result" key={section.id} href={`/collections/${encodeURIComponent(section.key)}`} onClick={onFollow}><span>{localeText[locale].categories}</span><strong>{sectionLabel(locale, section.label)}</strong></a>)}{products.map((product) => <a className="sf-search-product-result" key={product.id} href={`/products/${encodeURIComponent(product.slug || String(product.id))}`} onClick={onFollow}>{product.images?.[0]?.image ? <OptimizedImage src={product.images[0].image} widthHint={96} widths={[48, 72, 96]} sizes="48px" alt="" /> : <span className="sf-search-product-placeholder" aria-hidden="true"><IconSearch /></span>}<span><small>{t(locale, "catalog.suggestions")}</small><strong>{product.name}</strong></span><IconArrow rtl={dir(locale) === "rtl"} /></a>)}<a className="sf-search-all" href={`/collections/all?search=${encodeURIComponent(query.trim())}`} onClick={onFollow}>{localeText[locale].results} <IconArrow rtl={dir(locale) === "rtl"} /></a></div>;
}
