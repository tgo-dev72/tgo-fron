import { lazy, Suspense, useState, type FormEvent, type ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { FiArrowRight, FiLock } from "react-icons/fi";
import { AuthProvider, useAuth } from "./AuthContext";
import { Shell } from "./components/Shell";
import { BrandMark, LoadingBrand } from "./components/BrandMark";
import { LanguageSwitcher } from "./components/LanguageSwitcher";
import { LocaleProvider, useI18n } from "./i18n";
import { ResourcePage } from "./pages/Resources";
import { SystemPage } from "./pages/System";
import { PricingPage } from "./pages/Pricing";
import { StaffPage } from "./pages/Staff";
import { CapabilitiesPage } from "./pages/Capabilities";
import { PresentationPage } from "./pages/Presentation";
import { MonitoringPage } from "./pages/Monitoring";
import { ThemeProvider } from "./theme";
import { ThemeToggle } from "./components/ThemeToggle";
import { Loading } from "./components/Ui";
import { safeAdminReturnPath } from "./adminNavigation";

const Overview = lazy(() => import("./pages/Overview").then((module) => ({ default: module.Overview })));

function AppRoutes() {
  const { user, ready } = useAuth();
  const { tr } = useI18n();
  if (!ready) return <main className="boot" aria-busy="true"><LoadingBrand label={tr("common.opening")} /></main>;
  return <Routes>
    <Route path="/login" element={user ? <LoggedInRedirect /> : <Login />} />
    <Route path="*" element={user ? <ShellRoutes /> : <RequireLogin />} />
  </Routes>;
}

function RequireLogin() {
  const location = useLocation();
  return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
}

function LoggedInRedirect() {
  const location = useLocation();
  const requested = location.state?.from;
  return <Navigate to={safeAdminReturnPath(requested)} replace />;
}

function RequireAccess({ access, children }: { access: keyof NonNullable<ReturnType<typeof useAuth>["user"]>["access"]; children: ReactNode }) {
  const { user } = useAuth();
  const { tr } = useI18n();
  if (user?.access[access]) return children;
  return <section className="state-card access-denied" role="alert"><span className="state-mark">!</span><h2>{tr("common.areaUnavailable")}</h2><p>{tr("common.areaUnavailableDetail")}</p></section>;
}

function ShellRoutes() {
  return <Shell><Suspense fallback={<Loading />}><Routes>
    <Route index element={<RequireAccess access="overview"><Overview /></RequireAccess>} />
    <Route path="stores" element={<RequireAccess access="stores"><ResourcePage resource="stores" /></RequireAccess>} />
    <Route path="users" element={<RequireAccess access="users"><ResourcePage resource="users" /></RequireAccess>} />
    <Route path="staff" element={<RequireAccess access="staff"><StaffPage /></RequireAccess>} />
    <Route path="orders" element={<RequireAccess access="orders"><ResourcePage resource="orders" /></RequireAccess>} />
    <Route path="payments" element={<RequireAccess access="billing"><ResourcePage resource="payments" /></RequireAccess>} />
    <Route path="plans" element={<RequireAccess access="pricing"><PricingPage /></RequireAccess>} />
    <Route path="plans/capabilities" element={<RequireAccess access="pricing"><CapabilitiesPage /></RequireAccess>} />
    <Route path="pricing" element={<Navigate to="/plans" replace />} />
    <Route path="deployments" element={<RequireAccess access="deployments"><ResourcePage resource="deployments" /></RequireAccess>} />
    <Route path="presentation" element={<RequireAccess access="presentation"><PresentationPage /></RequireAccess>} />
    <Route path="monitoring" element={<RequireAccess access="monitoring"><MonitoringPage /></RequireAccess>} />
    <Route path="system" element={<RequireAccess access="system"><SystemPage /></RequireAccess>} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes></Suspense></Shell>;
}

function Login() {
  const { login } = useAuth();
  const { locale, tr } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true); setError("");
    try {
      await login(email.trim(), password);
      const requested = location.state?.from;
      navigate(safeAdminReturnPath(requested), { replace: true });
    }
    catch { setError(tr("auth.failed")); setSubmitting(false); }
  }

  return <div className="login-page" dir={locale === "ar" ? "rtl" : "ltr"}>
    <header className="login-topbar">
      <div className="brand-lockup login-brand"><BrandMark /><div><strong>TijaraGO</strong><small>{tr("brand.control")}</small></div></div>
      <div className="login-language"><ThemeToggle /><LanguageSwitcher /></div>
    </header>
    <main className="login-main">
      <section className="login-context"><span className="eyebrow">{tr("auth.private")}</span><h1>{tr("auth.headline1")}</h1><p>{tr("auth.story")}</p></section>
      <form className={`login-card panel${submitting ? " auth-processing" : ""}`} onSubmit={submit} aria-busy={submitting}>
        <span className="login-icon"><FiLock /></span><h2>{tr("auth.signIn")}</h2><p>{tr("auth.instructions")}</p>
        {location.state?.from && <div className="session-note">{tr("auth.continue")}</div>}
        <label><span>{tr("auth.email")}</span><input type="email" required autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="operator@example.com" disabled={submitting} /></label>
        <label><span>{tr("auth.password")}</span><input type="password" required autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="••••••••••••" disabled={submitting} /></label>
        {error && <div className="login-error" role="alert">{error}</div>}
        <button className={`login-submit${submitting ? " is-processing" : ""}`} disabled={submitting}><span className="login-submit-content" aria-live="polite">{submitting ? <><span className="login-spinner" aria-hidden="true" /> {tr("auth.verifying")}</> : <>{tr("auth.enter")} <FiArrowRight /></>}</span></button>
        <small className="login-footnote">{tr("auth.footnote")}</small>
      </form>
    </main>
  </div>;
}

export default function App() {
  return <ThemeProvider><BrowserRouter><LocaleProvider><AuthProvider><AppRoutes /></AuthProvider></LocaleProvider></BrowserRouter></ThemeProvider>;
}
