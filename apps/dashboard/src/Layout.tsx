import { createContext, forwardRef, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Navigate, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  FiChevronDown,
  FiLayout,
  FiLogOut,
  FiMenu,
  FiShoppingBag,
  FiShoppingCart,
  FiUsers,
  FiMail,
  FiLayers,
  FiSettings,
  FiBarChart2,
  FiExternalLink,
  FiPlus,
  FiCreditCard,
  FiDollarSign,
  FiTag,
  FiMessageSquare,
  FiCheck,
  FiX,
} from "react-icons/fi";
import { api, type Store, type StoreMember } from "./api/client";
import { useAuth } from "./auth/AuthContext";
import { useAsync } from "./hooks/useAsync";
import { t, useLocale } from "./i18n";
import { LangSwitcher } from "./components/LangSwitcher";
import { ThemeToggle } from "./components/ThemeToggle";
import { PageLoader } from "./components/Skeleton";
import { ConfirmModal } from "./components/ConfirmModal";
import { showroomDashboardUrl } from "./lib/appLinks";
import { parseRequestedStoreId } from "./lib/storeSelection";
import { SUBSCRIPTION_STATUS_EVENT } from "../../shared/paymentReturn";
import { PermissionGate, useEffectivePermissions } from "./access/AccessContext";

interface StoreCtx {
  store: Store | null;
  stores: Store[];
  loading: boolean;
  error: string | null;
  reload: () => void;
  updateMembers: (storeId: number, members: StoreMember[]) => void;
  updateStore: (store: Store) => void;
  setStoreId: (id: number) => void;
}

const StoreContext = createContext<StoreCtx>({
  store: null,
  stores: [],
  loading: true,
  error: null,
  reload: () => {},
  updateMembers: () => {},
  updateStore: () => {},
  setStoreId: () => {},
});

export function useStore() {
  return useContext(StoreContext);
}

const STORE_KEY = "dash.storeId";
const SIDEBAR_COLLAPSED_KEY = "dash.sidebarCollapsed";

export function StoreProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { data: stores, loading, error, reload, setData: setStores } = useAsync(
    () => (user ? api.listStores() : Promise.resolve([] as Store[])),
    [user?.email],
  );
  const [storeId, setStoreId] = useState<number | null>(() => {
    const requested = parseRequestedStoreId(window.location.search);
    if (requested !== null) return requested;
    const saved = Number(localStorage.getItem(STORE_KEY));
    return saved || null;
  });

  useEffect(() => {
    window.addEventListener(SUBSCRIPTION_STATUS_EVENT, reload);
    return () => window.removeEventListener(SUBSCRIPTION_STATUS_EVENT, reload);
  }, [reload]);

  const updateStore = useCallback((updated: Store) => {
    setStores(current => current?.map(entry => entry.id === updated.id ? updated : entry) ?? null);
  }, [setStores]);

  const updateMembers = useCallback((id: number, members: StoreMember[]) => {
    setStores((current) => current?.map((entry) => entry.id === id ? { ...entry, members } : entry) ?? null);
  }, [setStores]);

  const store = stores?.find((s) => s.id === storeId) ?? stores?.[0] ?? null;

  const set = useCallback((id: number) => {
    setStoreId(id);
    localStorage.setItem(STORE_KEY, String(id));
  }, []);

  useEffect(() => {
    if (store && store.id !== storeId) {
      localStorage.setItem(STORE_KEY, String(store.id));
    }
  }, [store, storeId]);

  useEffect(() => {
    if (!user || loading || !stores) return;

    const params = new URLSearchParams(location.search);
    if (!params.has("store")) return;

    const requestedStoreId = parseRequestedStoreId(location.search);
    if (requestedStoreId !== null && stores.some((candidate) => candidate.id === requestedStoreId)) {
      set(requestedStoreId);
    } else if (store) {
      set(store.id);
    }

    params.delete("store");
    navigate(
      {
        pathname: location.pathname,
        search: params.size ? `?${params.toString()}` : "",
        hash: location.hash,
      },
      { replace: true },
    );
  }, [loading, location.hash, location.pathname, location.search, navigate, set, store, stores, user]);

  return (
    <StoreContext.Provider value={{ store, stores: stores ?? [], loading, error, reload, updateMembers, updateStore, setStoreId: set }}>
      {children}
    </StoreContext.Provider>
  );
}

function NoStoreEmpty() {
  const locale = useLocale();
  return (
    <div className="no-store-empty">
      <div className="no-store-empty-inner">
        <div className="no-store-icon"><FiShoppingBag /></div>
        <h2>{t(locale, "storeCreate.emptyTitle")}</h2>
        <p>{t(locale, "storeCreate.emptyDesc")}</p>
        <a className="btn btn-primary" href={showroomDashboardUrl()}>
          <FiPlus /> {t(locale, "storeCreate.createFirst")}
        </a>
      </div>
    </div>
  );
}

const NAV: Array<{ key: string; to: string; icon: ReactNode; permission?: string }> = [
  { key: "overview", to: "/", icon: <FiLayout /> },
  { key: "analytics", to: "/analytics", icon: <FiBarChart2 />, permission: "analytics.view" },
  { key: "products", to: "/products", icon: <FiShoppingBag />, permission: "products.view" },
  { key: "sections", to: "/sections", icon: <FiLayers />, permission: "collections.view" },
  { key: "orders", to: "/orders", icon: <FiShoppingCart />, permission: "orders.view" },
  { key: "customers", to: "/customers", icon: <FiUsers />, permission: "customers.view" },
];

const ENGAGEMENT_NAV: Array<{ key: string; to: string; icon: ReactNode; permission?: string }> = [
  { key: "mailbox", to: "/mailbox", icon: <FiMail />, permission: "mailbox.view" },
  { key: "campaigns", to: "/campaigns", icon: <FiMail />, permission: "marketing.view" },
  { key: "reviews", to: "/reviews", icon: <FiMessageSquare /> },
  { key: "coupons", to: "/coupons", icon: <FiTag />, permission: "discounts.view" },
];

const Sidebar = forwardRef<HTMLElement, { className?: string; collapsed: boolean; onToggleCollapsed: () => void; onNavigate?: () => void }>(function Sidebar({ className = "", collapsed, onToggleCollapsed, onNavigate }, ref) {
  const { user, logout } = useAuth();
  const { store, stores, setStoreId } = useStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const locale = useLocale();
  const { permissions } = useEffectivePermissions();
  const engagementActive = ENGAGEMENT_NAV.some((item) => location.pathname.startsWith(item.to));
  const storeSetupActive = ["/design", "/settings", "/team-access", "/subscription"].some((path) => location.pathname.startsWith(path));
  const [engagementOpen, setEngagementOpen] = useState(engagementActive);
  const [storeSetupOpen, setStoreSetupOpen] = useState(storeSetupActive);

  const initials = (user?.first_name?.[0] ?? "") + (user?.last_name?.[0] ?? "");
  const displayName = user ? `${user.first_name} ${user.last_name}`.trim() || user.email : "";

  useEffect(() => {
    if (!switching) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSwitching(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [switching]);

  useEffect(() => { if (engagementActive) setEngagementOpen(true); }, [engagementActive]);
  useEffect(() => { if (storeSetupActive) setStoreSetupOpen(true); }, [storeSetupActive]);

  return (
    <>
      <aside ref={ref} id="merchant-sidebar" className={`sidebar${className}`} aria-label={t(locale, "nav.manage")}>
        <div className="sidebar-brand">
          <button
            type="button"
            className="sidebar-collapse"
            aria-label={t(locale, collapsed ? "nav.expandSidebar" : "nav.collapseSidebar")}
            title={t(locale, collapsed ? "nav.expandSidebar" : "nav.collapseSidebar")}
            aria-controls="merchant-sidebar"
            aria-expanded={!collapsed}
            onClick={onToggleCollapsed}
          >
            <FiMenu />
          </button>
          <img src="/brand/logos/tyjara-go-white.svg" alt="TijaraGO" className="sidebar-logo" width="126" height="88" />
        </div>

        <div className="store-switch">
          <button className="btn" aria-haspopup="dialog" aria-expanded={switching} onClick={() => { setMenuOpen(false); setSwitching(true); }}>
            {store ? (
              <span className="store-name">
                <b>{store.name}</b>
                <span>@{store.slug}</span>
              </span>
            ) : (
              <span className="store-name">
                <b>{t(locale, "nav.selectStore")}</b>
                <span>{t(locale, "nav.noStoreChosen")}</span>
              </span>
            )}
            <FiChevronDown />
          </button>
        </div>

        <nav className="nav">
          <div className="nav-section">
            <div className="nav-label">{t(locale, "nav.manage")}</div>
            {NAV.filter((item) => !item.permission || permissions.has(item.permission)).map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}
                onClick={onNavigate}
                aria-label={t(locale, `nav.${item.key}`)}
                title={collapsed ? t(locale, `nav.${item.key}`) : undefined}
              >
                {item.icon}
                <span>{t(locale, `nav.${item.key}`)}</span>
              </NavLink>
            ))}
            <div className={`nav-group${engagementActive ? " has-active" : ""}`}>
              <button type="button" className="nav-group-trigger" aria-expanded={engagementOpen || collapsed} aria-controls="sidebar-engagement" onClick={() => setEngagementOpen((value) => !value)}><FiUsers /><span>{t(locale, "nav.engagement")}</span><FiChevronDown className="nav-group-chevron" /></button>
              <div id="sidebar-engagement" className={`nav-group-items${engagementOpen || collapsed ? " is-open" : ""}`}>
                {ENGAGEMENT_NAV.filter((item) => !item.permission || permissions.has(item.permission)).map((item) => <NavLink key={item.to} to={item.to} className={({ isActive }) => `nav-item${isActive ? " active" : ""}`} onClick={onNavigate} aria-label={t(locale, `nav.${item.key}`)} title={collapsed ? t(locale, `nav.${item.key}`) : undefined}>{item.icon}<span>{t(locale, `nav.${item.key}`)}</span></NavLink>)}
              </div>
            </div>
            <div className={`nav-group${storeSetupActive ? " has-active" : ""}`}>
              <button type="button" className="nav-group-trigger" aria-expanded={storeSetupOpen || collapsed} aria-controls="sidebar-store-setup" onClick={() => setStoreSetupOpen((value) => !value)}><FiSettings /><span>{t(locale, "nav.storeSetup")}</span><FiChevronDown className="nav-group-chevron" /></button>
              <div id="sidebar-store-setup" className={`nav-group-items${storeSetupOpen || collapsed ? " is-open" : ""}`}>
            <PermissionGate permission="storefront.view"><NavLink to="/design" className={({ isActive }) => `nav-item${isActive ? " active" : ""}`} onClick={onNavigate} aria-label={t(locale, "nav.design")} title={collapsed ? t(locale, "nav.design") : undefined}>
              <FiLayout />
              <span>{t(locale, "nav.design")}</span>
            </NavLink></PermissionGate>
            <PermissionGate permission="settings.view"><NavLink to="/settings" className={({ isActive }) => `nav-item${isActive ? " active" : ""}`} onClick={onNavigate} aria-label={t(locale, "nav.settings")} title={collapsed ? t(locale, "nav.settings") : undefined}>
              <FiSettings />
              <span>{t(locale, "nav.settings")}</span>
            </NavLink></PermissionGate>
            <PermissionGate permission="staff.view"><NavLink to="/team-access" className={({ isActive }) => `nav-item${isActive ? " active" : ""}`} onClick={onNavigate} aria-label={t(locale, "nav.teamAccess")} title={collapsed ? t(locale, "nav.teamAccess") : undefined}>
              <FiUsers />
              <span>{t(locale, "nav.teamAccess")}</span>
            </NavLink></PermissionGate>
            <PermissionGate permission="billing.view"><NavLink to="/subscription" className={({ isActive }) => `nav-item${isActive ? " active" : ""}`} onClick={onNavigate} aria-label={t(locale, "nav.subscription")} title={collapsed ? t(locale, "nav.subscription") : undefined}>
              <FiCreditCard />
              <span>{t(locale, "nav.subscription")}</span>
            </NavLink></PermissionGate>
            <a className="nav-item" href={showroomDashboardUrl(store?.id)} onClick={onNavigate} aria-label={t(locale, "nav.storeBuilder")} title={collapsed ? t(locale, "nav.storeBuilder") : undefined}>
              <FiExternalLink />
              <span>{t(locale, "nav.storeBuilder")}</span>
            </a>
              </div>
            </div>
          </div>
        </nav>

        <div className="sidebar-foot">
          <button type="button" className="user-chip" onClick={() => setMenuOpen((v) => !v)} aria-haspopup="menu" aria-expanded={menuOpen} title={collapsed ? displayName || user?.email : undefined}>
            <div className="avatar">{initials || "U"}</div>
            <div className="user-meta">
              <b title={displayName || t(locale, "nav.account")}>{displayName || t(locale, "nav.account")}</b>
              <span title={user?.email}>{user?.email}</span>
            </div>
          </button>
        </div>

        {menuOpen && (
          <div className="user-menu">
            <div className="user-menu-head">{t(locale, "nav.signedInAs")}</div>
            <button
              onClick={() => { setMenuOpen(false); setSignOutOpen(true); }}
            >
              <FiLogOut />
              {t(locale, "nav.signOut")}
            </button>
          </div>
        )}
      </aside>

      <ConfirmModal
        open={signOutOpen}
        title={t(locale, "nav.signOutTitle")}
        body={t(locale, "nav.signOutBody")}
        confirmLabel={t(locale, "nav.signOut")}
        cancelLabel={t(locale, "nav.staySignedIn")}
        loading={signingOut}
        onClose={() => setSignOutOpen(false)}
        onConfirm={async () => {
          if (signingOut) return;
          setSigningOut(true);
          try {
            await logout();
            navigate("/login", { replace: true });
          } finally {
            setSigningOut(false);
          }
        }}
      />

      <>
          <button
            type="button"
            className={`drawer-overlay${switching ? " open" : ""}`}
            aria-label={t(locale, "nav.switchStore")}
            aria-hidden={!switching}
            tabIndex={switching ? 0 : -1}
            onClick={() => setSwitching(false)}
          />
          <div className={`switch-drawer${switching ? " open" : ""}`} role="dialog" aria-modal="true" aria-hidden={!switching} aria-labelledby="store-switcher-title">
            <header className="switch-drawer-head">
              <div>
                <span className="switch-drawer-eyebrow">{t(locale, "nav.store")}</span>
                <h3 id="store-switcher-title">{t(locale, "nav.switchStore")}</h3>
                <p>{t(locale, "nav.youManage", stores.length)}</p>
              </div>
              <button type="button" className="switch-drawer-close" aria-label={t(locale, "orders.close")} onClick={() => setSwitching(false)}><FiX /></button>
            </header>
            <div className="switch-drawer-list">
            {stores.map((s) => {
              const current = store?.id === s.id;
              return (
              <button
                key={s.id}
                className={`store-card${current ? " current" : ""}`}
                aria-current={current ? "true" : undefined}
                onClick={() => {
                  setStoreId(s.id);
                  setSwitching(false);
                }}
              >
                <div className="avatar">{s.name[0]}</div>
                <div>
                  <b>{s.name}</b>
                  <span>@{s.slug}</span>
                </div>
                {current && <span className="store-card-state" title={t(locale, "nav.currentStore")}><FiCheck /><span>{t(locale, "nav.currentStore")}</span></span>}
              </button>
            );})}
            </div>
            <a
              className="store-card store-card-create"
              href={showroomDashboardUrl(store?.id)}
              onClick={() => setSwitching(false)}
            >
              <div className="avatar"><FiPlus size={18} /></div>
              <div>
                <b>{t(locale, stores.length === 0 ? "storeCreate.createFirst" : "storeCreate.createAnother")}</b>
                <span>{t(locale, "nav.createStoreHint")}</span>
              </div>
            </a>
           </div>
        </>
    </>
  );
});

export function Layout() {
  const { store, stores, loading, error, reload } = useStore();
  const { user } = useAuth();
  const location = useLocation();
  const locale = useLocale();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => (
    typeof window !== "undefined" && window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true"
  ));
  const sidebarRef = useRef<HTMLElement>(null);
  const ownsAStore = stores.some((candidate) => candidate.members.some(
    (member) => member.email === user?.email && member.role === "owner",
  ));
  const canViewBilling = !loading && (stores.length === 0 || ownsAStore);
  const { data: billingStatus, loading: balanceLoading, error: balanceError, reload: reloadBalance } = useAsync(
    () => canViewBilling ? api.subscriptionStatus() : Promise.resolve(null),
    [canViewBilling, location.pathname, location.search],
  );

  useEffect(() => {
    window.addEventListener(SUBSCRIPTION_STATUS_EVENT, reloadBalance);
    return () => window.removeEventListener(SUBSCRIPTION_STATUS_EVENT, reloadBalance);
  }, [reloadBalance]);

  const sectionKey = (() => {
    const path = location.pathname;
    if (path.startsWith("/stores")) return "storeCreate";
    if (path.startsWith("/products")) return "products";
    if (path.startsWith("/analytics")) return "analytics";
    if (path.startsWith("/sections")) return "sections";
    if (path.startsWith("/orders")) return "orders";
    if (path.startsWith("/customers")) return "customers";
    if (path.startsWith("/campaigns")) return "campaigns";
    if (path.startsWith("/reviews")) return "reviews";
    if (path.startsWith("/design")) return "design";
    if (path.startsWith("/settings")) return "settings";
    if (path.startsWith("/subscription")) return "subscription";
    return "overview";
  })();
  const subscriptionRoute = location.pathname.startsWith("/subscription");
  const worksWithoutStore = location.pathname.startsWith("/stores/new") || subscriptionRoute;
  const paymentRequired = billingStatus?.access.allowed === false;
  const balances = billingStatus?.balances.length
    ? billingStatus.balances
    : [{
        currency: billingStatus?.subscription?.plan?.currency ?? "MAD",
        balance: "0.00",
        reserved: "0.00",
        available: "0.00",
      }];
  const formatBalance = (value: string) => new Intl.NumberFormat(locale === "ar" ? "en-US" : locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.floor(Number(value) || 0));

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!sidebarOpen) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSidebarOpen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [sidebarOpen]);

  const toggleSidebarCollapsed = useCallback(() => {
    setSidebarCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
      return next;
    });
  }, []);

  return (
    <div className={`app${sidebarCollapsed ? " sidebar-collapsed" : ""}`}>
      <button
        type="button"
        className={`sidebar-overlay${sidebarOpen ? " open" : ""}`}
        aria-label="Close navigation"
        aria-hidden={!sidebarOpen}
        tabIndex={sidebarOpen ? 0 : -1}
        onClick={() => setSidebarOpen(false)}
      />
      <Sidebar ref={sidebarRef} className={`${sidebarCollapsed ? " collapsed" : ""}${sidebarOpen ? " open" : ""}`} collapsed={sidebarCollapsed} onToggleCollapsed={toggleSidebarCollapsed} onNavigate={() => setSidebarOpen(false)} />
      <div className="main">
        <header className="topbar">
          <button type="button" className="topbar-menu" aria-label={t(locale, sidebarOpen ? "nav.closeNavigation" : "nav.openNavigation")} aria-controls="merchant-sidebar" aria-expanded={sidebarOpen} onClick={() => setSidebarOpen((v) => !v)}><FiMenu /></button>
          <div className="topbar-title">
            {store?.name ?? t(locale, "nav.dashboard")} <span className="crumb">/ {t(locale, `nav.${sectionKey}`)}</span>
          </div>
          <div className="topbar-actions">
            {canViewBilling && <NavLink
                to="/subscription"
                className="topbar-balance"
                aria-label={t(locale, "nav.availableBalance")}
                title={balanceError ? t(locale, "nav.balanceUnavailable") : t(locale, "nav.availableBalance")}
              >
                <span className="topbar-balance-icon" aria-hidden="true"><FiDollarSign /></span>
                <span className="topbar-balance-copy">
                  <small>{t(locale, "nav.balance")}</small>
                  {balanceLoading && !billingStatus ? (
                    <span className="topbar-balance-skeleton" aria-hidden="true" />
                  ) : balanceError && !billingStatus ? (
                    <strong className="tnum">—</strong>
                  ) : (
                    <strong className="tnum">
                      {balances.map((balance) => `${formatBalance(balance.balance)} ${balance.currency}`).join(" · ")}
                    </strong>
                  )}
                </span>
              </NavLink>}
            <LangSwitcher compact />
            <ThemeToggle />
            {store?.storefront_status === "live" && store.storefront_url && (
              <a
                className="btn btn-secondary btn-sm"
                href={store.storefront_url}
                target="_blank"
                rel="noreferrer"
              >
                {t(locale, "nav.viewStorefront")}
              </a>
            )}
          </div>
        </header>
        <main className="page">
          <div className="page-transition" key={location.pathname}>
            {subscriptionRoute ? (
              <Outlet />
            ) : paymentRequired ? (
              <Navigate to="/subscription" replace />
            ) : canViewBilling && balanceLoading && !billingStatus ? (
              <div className="card"><PageLoader /></div>
            ) : canViewBilling && balanceError && !billingStatus ? (
              <div className="no-store-empty">
                <div className="no-store-empty-inner">
                  <p>{balanceError}</p>
                  <button className="btn btn-secondary" onClick={reloadBalance}>{t(locale, "errors.tryAgain")}</button>
                </div>
              </div>
            ) : loading ? (
              <div className="card"><PageLoader /></div>
            ) : error ? (
              <div className="no-store-empty">
                <div className="no-store-empty-inner">
                  <p>{error}</p>
                  <button className="btn btn-secondary" onClick={reload}>{t(locale, "errors.tryAgain")}</button>
                </div>
              </div>
            ) : stores.length === 0 && !worksWithoutStore ? (
              <NoStoreEmpty />
            ) : (
              <Outlet />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
