import { Component, lazy, Suspense, useEffect, type ErrorInfo, type ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import { Layout, StoreProvider } from "./Layout";
import { ToastProvider } from "./components/Toast";
import { showroomDashboardUrl, showroomSignupUrl } from "./lib/appLinks";
import { BrandLoader } from "./components/BrandLoader";
import { PageLoader } from "./components/Skeleton";
import { useLocale } from "./i18n";
import { AccessProvider, ProtectedAdminRoute } from "./access/AccessContext";

const PasswordRecoveryPage = lazy(() => import("./pages/PasswordRecovery").then((module) => ({ default: module.PasswordRecoveryPage })));
const LoginPage = lazy(() => import("./pages/Login").then((module) => ({ default: module.LoginPage })));
const VerifyEmailPage = lazy(() => import("./pages/VerifyEmail").then((module) => ({ default: module.VerifyEmailPage })));
const VerificationPendingPage = lazy(() => import("./pages/VerificationPending").then((module) => ({ default: module.VerificationPendingPage })));
const OverviewPage = lazy(() => import("./pages/Overview").then((module) => ({ default: module.OverviewPage })));
const AnalyticsPage = lazy(() => import("./pages/Analytics").then((module) => ({ default: module.AnalyticsPage })));
const ProductsPage = lazy(() => import("./pages/Products").then((module) => ({ default: module.ProductsPage })));
const ProductEditorPage = lazy(() => import("./pages/ProductEditor").then((module) => ({ default: module.ProductEditorPage })));
const SectionsPage = lazy(() => import("./pages/Sections").then((module) => ({ default: module.SectionsPage })));
const OrdersPage = lazy(() => import("./pages/Orders").then((module) => ({ default: module.OrdersPage })));
const OrderDetailsPage = lazy(() => import("./pages/OrderDetails").then((module) => ({ default: module.OrderDetailsPage })));
const CustomersPage = lazy(() => import("./pages/Customers").then((module) => ({ default: module.CustomersPage })));
const CampaignsPage = lazy(() => import("./pages/Campaigns").then((module) => ({ default: module.CampaignsPage })));
const MailboxPage = lazy(() => import("./pages/Mailbox").then((module) => ({ default: module.MailboxPage })));
const ReviewsPage = lazy(() => import("./pages/Reviews").then((module) => ({ default: module.ReviewsPage })));
const CouponsPage = lazy(() => import("./pages/Coupons").then((module) => ({ default: module.CouponsPage })));
const DesignPage = lazy(() => import("./pages/Design").then((module) => ({ default: module.DesignPage })));
const ThemeEditorPage = lazy(() => import("./pages/ThemeEditor").then((module) => ({ default: module.ThemeEditorPage })));
const SettingsPage = lazy(() => import("./pages/Settings").then((module) => ({ default: module.SettingsPage })));
const SubscriptionPage = lazy(() => import("./pages/Subscription").then((module) => ({ default: module.SubscriptionPage })));
const TeamAccessPage = lazy(() => import("./pages/TeamAccess").then((module) => ({ default: module.TeamAccessPage })));
const AcceptInvitationPage = lazy(() => import("./pages/AcceptInvitation").then((module) => ({ default: module.AcceptInvitationPage })));

class ApplicationBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, _info: ErrorInfo) {
    const chunkFailure = /dynamically imported module|loading chunk|chunkloaderror/i.test(error.message);
    const lastRecovery = Number(sessionStorage.getItem("dash.chunk-recovery") ?? 0);
    if (chunkFailure && Date.now() - lastRecovery > 30_000) {
      sessionStorage.setItem("dash.chunk-recovery", String(Date.now()));
      window.location.reload();
    }
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return <div className="page-center"><div className="card" style={{ maxWidth: 420, padding: 28, textAlign: "center" }}><h1 className="d-title">We could not restore this page</h1><p className="d-subtitle" style={{ margin: "10px 0 18px" }}>Refresh to reopen your dashboard safely.</p><button className="btn btn-primary" onClick={() => window.location.reload()}>Refresh dashboard</button></div></div>;
  }
}

function Gate({ children }: { children: React.ReactNode }) {
  const { user, ready } = useAuth();
  const location = useLocation();

  if (!ready) {
    return <BrandLoader fullPage hideLabel label="Checking your session" />;
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <>{children}</>;
}

function PublicGate({ children }: { children: React.ReactNode }) {
  const { user, ready } = useAuth();

  if (!ready) {
    return <BrandLoader fullPage hideLabel label="Checking your session" />;
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function NavigationRecovery() {
  useEffect(() => {
    const restore = (event: PageTransitionEvent) => {
      if (event.persisted) window.location.reload();
    };
    window.addEventListener("pageshow", restore);
    return () => window.removeEventListener("pageshow", restore);
  }, []);
  return null;
}

function ShowroomRedirect() {
  useEffect(() => {
    window.location.replace(showroomDashboardUrl());
  }, []);

  return <div className="page-center"><BrandLoader label="Opening showroom" /></div>;
}

function ShowroomSignupRedirect() {
  const locale = useLocale();
  useEffect(() => {
    window.location.replace(showroomSignupUrl(locale));
  }, [locale]);

  return <BrandLoader fullPage label="Opening account creation" />;
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <StoreProvider>
            <ScrollToTop />
            <NavigationRecovery />
            <ApplicationBoundary><Suspense fallback={<main className="route-loading-shell"><div className="card"><PageLoader /></div></main>}>
              <Routes>
                <Route path="/login" element={<PublicGate><LoginPage /></PublicGate>} />
                <Route path="/forgot-password" element={<PasswordRecoveryPage />} />
                <Route path="/reset-password" element={<PasswordRecoveryPage />} />
                <Route path="/register" element={<PublicGate><ShowroomSignupRedirect /></PublicGate>} />
                <Route path="/verify-email-pending" element={<PublicGate><VerificationPendingPage /></PublicGate>} />
                <Route path="/verify-email" element={<VerifyEmailPage />} />
                <Route path="/accept-invitation" element={<AcceptInvitationPage />} />
                <Route element={<Gate><AccessProvider><Layout /></AccessProvider></Gate>}>
                  <Route path="/" element={<OverviewPage />} />
                  <Route path="/analytics" element={<ProtectedAdminRoute permission="analytics.view"><AnalyticsPage /></ProtectedAdminRoute>} />
                  <Route path="/products" element={<ProtectedAdminRoute permission="products.view"><ProductsPage /></ProtectedAdminRoute>} />
                  <Route path="/products/new" element={<ProtectedAdminRoute permission="products.create"><ProductEditorPage /></ProtectedAdminRoute>} />
                  <Route path="/products/:id" element={<ProtectedAdminRoute permission="products.view"><ProductEditorPage /></ProtectedAdminRoute>} />
                  <Route path="/sections" element={<ProtectedAdminRoute permission="collections.view"><SectionsPage /></ProtectedAdminRoute>} />
                  <Route path="/orders" element={<ProtectedAdminRoute permission="orders.view"><OrdersPage /></ProtectedAdminRoute>} />
                  <Route path="/orders/:orderId" element={<ProtectedAdminRoute permission="orders.view"><OrderDetailsPage /></ProtectedAdminRoute>} />
                  <Route path="/customers" element={<ProtectedAdminRoute permission="customers.view"><CustomersPage /></ProtectedAdminRoute>} />
                  <Route path="/campaigns" element={<ProtectedAdminRoute permission="marketing.view"><CampaignsPage /></ProtectedAdminRoute>} />
                  <Route path="/mailbox" element={<ProtectedAdminRoute permission="mailbox.view"><MailboxPage /></ProtectedAdminRoute>} />
                  <Route path="/reviews" element={<ProtectedAdminRoute permission="products.view"><ReviewsPage /></ProtectedAdminRoute>} />
                  <Route path="/coupons" element={<ProtectedAdminRoute permission="discounts.view"><CouponsPage /></ProtectedAdminRoute>} />
                  <Route path="/design" element={<ProtectedAdminRoute permission="storefront.view"><DesignPage /></ProtectedAdminRoute>} />
                  <Route path="/design/customize" element={<Navigate to="/design/pages/home" replace />} />
                  <Route path="/design/pages/:pageKey" element={<ProtectedAdminRoute permission="storefront.customize"><ThemeEditorPage /></ProtectedAdminRoute>} />
                  <Route path="/settings" element={<ProtectedAdminRoute permission="settings.view"><SettingsPage /></ProtectedAdminRoute>} />
                  <Route path="/subscription" element={<ProtectedAdminRoute permission="billing.view"><SubscriptionPage /></ProtectedAdminRoute>} />
                  <Route path="/team-access" element={<ProtectedAdminRoute permission="staff.view"><TeamAccessPage /></ProtectedAdminRoute>} />
                  <Route path="/stores/new" element={<ShowroomRedirect />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Route>
              </Routes>
            </Suspense></ApplicationBoundary>
          </StoreProvider>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
