import { useEffect, useState, type ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  FiActivity, FiBell, FiCloud, FiCreditCard, FiGrid, FiLogOut,
  FiMenu, FiMessageCircle, FiPackage, FiShield, FiShoppingBag, FiTag, FiUsers, FiX,
} from "react-icons/fi";
import { useAuth } from "../AuthContext";
import { BrandMark } from "./BrandMark";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { useI18n } from "../i18n";
import { ThemeToggle } from "./ThemeToggle";
import { ConfirmDialog } from "./Ui";

const links = [
  { to: "/", labelKey: "nav.controlRoom", icon: FiGrid, end: true, access: "overview", section: "overview" },
  { to: "/stores", labelKey: "nav.stores", icon: FiShoppingBag, end: false, access: "stores", section: "commerce" },
  { to: "/orders", labelKey: "nav.orders", icon: FiPackage, end: false, access: "orders", section: "commerce" },
  { to: "/payments", labelKey: "nav.payments", icon: FiCreditCard, end: false, access: "billing", section: "commerce" },
  { to: "/users", labelKey: "nav.users", icon: FiUsers, end: false, access: "users", section: "people" },
  { to: "/staff", labelKey: "nav.staff", icon: FiShield, end: false, access: "staff", section: "people" },
  { to: "/plans", labelKey: "nav.pricing", icon: FiTag, end: false, access: "pricing", section: "platform" },
  { to: "/deployments", labelKey: "nav.deployments", icon: FiCloud, end: false, access: "deployments", section: "platform" },
  { to: "/presentation", labelKey: "nav.presentation", icon: FiMessageCircle, end: false, access: "presentation", section: "platform" },
  { to: "/monitoring", labelKey: "nav.monitoring", icon: FiBell, end: false, access: "monitoring", section: "platform" },
  { to: "/system", labelKey: "nav.system", icon: FiActivity, end: false, access: "system", section: "platform" },
] as const;

const navigationSections = ["overview", "commerce", "people", "platform"] as const;

const SIDEBAR_COLLAPSED_KEY = "platformAdmin.sidebarCollapsed";

export function Shell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() =>
    typeof window !== "undefined" && window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true"
  );
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const { user, logout } = useAuth();
  const { tr } = useI18n();
  const location = useLocation();
  const visibleLinks = links.filter((item) => user?.access[item.access]);
  const currentLink = visibleLinks
    .filter((item) => item.to === "/" ? location.pathname === "/" : location.pathname.startsWith(item.to))
    .sort((left, right) => right.to.length - left.to.length)[0];
  const current = tr(currentLink?.labelKey || "brand.control");
  const initials = `${user?.first_name?.[0] || ""}${user?.last_name?.[0] || ""}` || user?.email[0] || "A";

  const toggleCollapsed = () => {
    setCollapsed((currentValue) => {
      const nextValue = !currentValue;
      window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(nextValue));
      return nextValue;
    });
  };

  useEffect(() => setOpen(false), [location.pathname]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return <div className={`admin-app${collapsed ? " sidebar-collapsed" : ""}`}>
    <button className={`nav-scrim ${open ? "show" : ""}`} aria-label={tr("common.closeMenu")} aria-hidden={!open} tabIndex={open ? 0 : -1} onClick={() => setOpen(false)} />
    <aside id="platform-sidebar" className={`sidebar${collapsed ? " collapsed" : ""}${open ? " open" : ""}`} aria-label={tr("nav.monitor")}>
      <div className="brand-lockup sidebar-brand">
        <BrandMark compact />
        <button
          className="sidebar-collapse"
          type="button"
          aria-label={tr(collapsed ? "nav.expandSidebar" : "nav.collapseSidebar")}
          title={tr(collapsed ? "nav.expandSidebar" : "nav.collapseSidebar")}
          aria-controls="platform-sidebar"
          aria-expanded={!collapsed}
          onClick={toggleCollapsed}
        >
          <FiMenu />
        </button>
        <button className="mobile-close" aria-label={tr("common.closeMenu")} onClick={() => setOpen(false)}><FiX /></button>
      </div>
      <div className="environment"><i /> {tr("nav.live")}</div>
      <nav>
        {navigationSections.map((section) => {
          const items = visibleLinks.filter((item) => item.section === section);
          if (!items.length) return null;
          return <div className="nav-group" key={section}>
            <span className="nav-label">{tr(`nav.section.${section}`)}</span>
            {items.map(({ to, labelKey, icon: Icon, end }) =>
              <NavLink key={to} to={to} end={end} aria-label={tr(labelKey)} title={collapsed ? tr(labelKey) : undefined} onClick={() => setOpen(false)} className={({ isActive }) => isActive ? "active" : ""}>
                <Icon /><span>{tr(labelKey)}</span>
              </NavLink>
            )}
          </div>;
        })}
      </nav>
      <div className="operator">
        <span className="operator-avatar" title={collapsed ? user?.email : undefined}>{initials.toUpperCase()}</span>
        <span><strong title={user?.first_name || tr("nav.operator")}>{user?.first_name || tr("nav.operator")}</strong><small title={user?.email}>{user?.email}</small></span>
        <button type="button" aria-label={tr("nav.signOut")} title={tr("nav.signOut")} onClick={() => setSignOutOpen(true)}><FiLogOut /></button>
      </div>
    </aside>
    <main className="main-column">
      <header className="topbar">
        <button className="menu-button" aria-label={tr("common.openMenu")} aria-controls="platform-sidebar" aria-expanded={open} onClick={() => setOpen(true)}><FiMenu /></button>
        <div><span>{tr("nav.operations")}</span><strong>{current}</strong></div>
        <ThemeToggle />
        <LanguageSwitcher compact />
        <span className="staff-badge">{tr("nav.staffOnly")}</span>
      </header>
      <div className="page route-content" key={location.pathname}>{children}</div>
    </main>
    <ConfirmDialog
      open={signOutOpen}
      title={tr("signOut.title")}
      detail={tr("signOut.body")}
      confirmLabel={tr("nav.signOut")}
      cancelLabel={tr("signOut.cancel")}
      busy={signingOut}
      onCancel={() => setSignOutOpen(false)}
      onConfirm={() => {
        if (signingOut) return;
        setSigningOut(true);
        void logout().finally(() => setSigningOut(false));
      }}
    />
  </div>;
}
