import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { platform } from "../api/platform";
import { useAuth } from "../auth/AuthContext";
import { BrandLogo } from "../components/BrandLogo";
import { useAsync } from "../hooks/useAsync";
import { getAccent } from "../lib/designs";
import { useLocale } from "../i18n";

type Device = "desktop" | "tablet" | "mobile";

function trustedPreviewUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch { return null; }
}

function StudioIcon({ name }: { name: Device | "reload" | "close" | "external" | "chevron" }) {
  const paths = {
    desktop: <><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M8 21h8M12 17v4" /></>,
    tablet: <rect x="5" y="2" width="14" height="20" rx="2" />,
    mobile: <><rect x="7" y="2" width="10" height="20" rx="2" /><path d="M11 18h2" /></>,
    reload: <><path d="M20 11a8 8 0 1 0-2.3 5.7" /><path d="M20 4v7h-7" /></>,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    external: <><path d="M14 3h7v7M10 14 21 3" /><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" /></>,
    chevron: <path d="m8 10 4 4 4-4" />,
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>;
}

export default function ThemeStudio() {
  const { key = "" } = useParams<{ key: string }>();
  const navigate = useNavigate();
  const { locale, t } = useLocale();
  const { user } = useAuth();
  const { data: design, loading: registryLoading, error, refresh } = useAsync(
    () => platform.getThemePreview(key), [key],
  );
  const { data: designs } = useAsync(() => platform.listDesigns(), []);
  const [device, setDevice] = useState<Device>("desktop");
  const [frameKey, setFrameKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [pickerOpen, setPickerOpen] = useState<"themes" | "presets" | null>(null);
  const initialPreset = new URLSearchParams(window.location.search).get("preset") ?? "";
  const [preset, setPreset] = useState(initialPreset);
  const baseUrl = trustedPreviewUrl(design?.demo_url ?? null);
  const activePreset = design?.presets?.find((item) => item.key === preset) ?? design?.presets?.[0];
  const url = baseUrl && design?.preview_ticket ? baseUrl : null;

  const sendPreviewSession = (frame: HTMLIFrameElement) => {
    if (!url || !design?.preview_ticket) return;
    frame.contentWindow?.postMessage({
      type: "tijarago-preview-session",
      ticket: design.preview_ticket,
      preset: activePreset?.key ?? "",
      locale,
    }, new URL(url).origin);
  };

  useEffect(() => {
    if (!design?.presets?.length) return;
    if (!design.presets.some((item) => item.key === preset)) setPreset(design.presets[0].key);
  }, [design, preset]);

  useEffect(() => {
    if (!url || !loading) return;
    const timeout = window.setTimeout(() => { setLoading(false); setFailed(true); }, 12_000);
    return () => window.clearTimeout(timeout);
  }, [url, loading, frameKey]);

  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPickerOpen(null);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);

  const reload = () => {
    if (!url) { refresh(); return; }
    setLoading(true); setFailed(false); setFrameKey((value) => value + 1);
  };
  const presetParam = activePreset ? `&preset=${encodeURIComponent(activePreset.key)}` : "";
  const selectUrl = `${user ? "/create" : "/signup"}?design=${encodeURIComponent(key)}${presetParam}`;
  const showroomUrl = `/design/${encodeURIComponent(key)}/preview${activePreset ? `?preset=${encodeURIComponent(activePreset.key)}` : ""}`;

  if (registryLoading) return <main className="sr-theme-studio"><div className="sr-studio-unavailable"><span className="sr-studio-spinner" /><strong>{t("preview.loading")}</strong></div></main>;
  if (!design || error) return <main className="sr-theme-studio"><div className="sr-studio-unavailable"><h1>{t("preview.unavailable")}</h1><p>{t("preview.unavailableDesc")}</p><button className="sr-btn sr-btn-primary" type="button" onClick={refresh}>{t("preview.retry")}</button><Link to="/gallery" className="sr-btn sr-btn-outline">{t("studio.close")}</Link></div></main>;

  return <main className="sr-theme-studio" style={{ "--studio-accent": getAccent(design.key) } as React.CSSProperties}>
    <header className="sr-studio-bar">
      <div className="sr-studio-identity">
        <Link to="/" className="sr-studio-home" aria-label="TijaraGO"><BrandLogo className="sr-studio-brand" width={62} height={38} /></Link>
        <Link to="/gallery" className="sr-studio-back"><span aria-hidden="true">←</span><span>{t("studio.allThemes")}</span></Link>
        <div className="sr-studio-picker sr-studio-theme-picker">
          <button type="button" className="sr-studio-theme-trigger" onClick={() => setPickerOpen((value) => value === "themes" ? null : "themes")} aria-expanded={pickerOpen === "themes"} aria-haspopup="dialog">
            <span className="sr-studio-theme-thumb"><img src={`/gallery/current/${design.key}.png`} alt="" /></span>
            <span><small>{t("studio.previewing")}</small><strong>{design.name}</strong></span>
            <StudioIcon name="chevron" />
          </button>
          {pickerOpen === "themes" && <div className="sr-studio-picker-panel sr-studio-theme-panel" role="dialog" aria-label={t("studio.allThemes")}>
            <header><strong>{t("studio.allThemes")}</strong><button type="button" onClick={() => setPickerOpen(null)} aria-label={t("studio.close")}><StudioIcon name="close" /></button></header>
            <div>{(designs ?? [design]).filter((item) => item.preview_available).map((item) => <button type="button" className={item.key === key ? "active" : ""} key={item.key} onClick={() => { setPickerOpen(null); navigate(`/design/${item.key}/preview`); }}>
              <img src={`/gallery/current/${item.key}.png`} alt="" />
              <span><strong>{item.name}</strong><small>{item.tagline}</small></span>
              {item.key === key && <b aria-hidden="true">✓</b>}
            </button>)}</div>
          </div>}
        </div>
      </div>
      <div className="sr-studio-devices" role="group" aria-label={t("studio.deviceLabel")}>
        {(["desktop", "tablet", "mobile"] as Device[]).map((item) => <button key={item} type="button" className={device === item ? "active" : ""} onClick={() => setDevice(item)} aria-label={t(`studio.${item}`)} aria-pressed={device === item}><StudioIcon name={item} /><span>{t(`studio.${item}`).split(" ")[0]}</span></button>)}
      </div>
      <div className="sr-studio-actions">
        {!!design.presets?.length && <div className="sr-studio-picker sr-studio-edition-picker">
          <button type="button" className="sr-studio-edition-trigger" onClick={() => setPickerOpen((value) => value === "presets" ? null : "presets")} aria-expanded={pickerOpen === "presets"} aria-haspopup="dialog">
            <i style={{ background: `linear-gradient(135deg, ${activePreset?.surface} 50%, ${activePreset?.accent} 50%)` }} />
            <span><small>{t("studio.designPresets")}</small><strong>{activePreset?.name}</strong></span><StudioIcon name="chevron" />
          </button>
          {pickerOpen === "presets" && <div className="sr-studio-picker-panel sr-studio-edition-panel" role="dialog" aria-label={t("studio.designPresets")}>
            <header><strong>{design.name} · {t("studio.designPresets")}</strong><button type="button" onClick={() => setPickerOpen(null)} aria-label={t("studio.close")}><StudioIcon name="close" /></button></header>
            <div>{design.presets.map((item) => <button type="button" className={item.key === activePreset?.key ? "active" : ""} key={item.key} onClick={() => { setPreset(item.key); setPickerOpen(null); setLoading(true); setFailed(false); setFrameKey((value) => value + 1); }}>
              <i style={{ background: `linear-gradient(135deg, ${item.surface} 50%, ${item.accent} 50%)` }} />
              <span><strong>{item.name}</strong><small>{item.description}</small></span>{item.key === activePreset?.key && <b aria-hidden="true">✓</b>}
            </button>)}</div>
          </div>}
        </div>
        }
        <button type="button" className="sr-studio-icon-button" onClick={reload} aria-label={t("studio.reload")} disabled={!url}><StudioIcon name="reload" /></button>
      </div>
    </header>
    <section className={`sr-studio-stage device-${device}`} aria-label={t("studio.canvas")}>
      <div className="sr-studio-frame-wrap">
        {url && !failed ? <>
          {loading && <div className="sr-studio-loading"><span className="sr-studio-spinner" /><strong>{t("preview.loading")}</strong><small>{t("studio.loadingHint")}</small></div>}
          <iframe key={frameKey} className="sr-studio-frame" src={url} title={`${design.name} ${t("detail.livePreview")}`} sandbox="allow-same-origin allow-scripts" referrerPolicy="no-referrer" onLoad={(event) => { sendPreviewSession(event.currentTarget); setLoading(false); }} />
        </> : <div className="sr-studio-unavailable"><h1>{t("preview.unavailable")}</h1><p>{t("preview.unavailableDesc")}</p><small>{t("studio.unavailableHint")}</small><button className="sr-btn sr-btn-primary" type="button" onClick={reload}>{t("preview.retry")}</button></div>}
      </div>
      <p className="sr-studio-note">{t("studio.readOnly")}</p>
    </section>
    <aside className="sr-studio-dock" aria-label={design.name}>
      <div className="sr-studio-dock-identity"><span style={{ background: getAccent(design.key) }} /><div><strong>{design.name}</strong><small>{activePreset?.name ?? design.tagline}</small></div>{design.tier === "premium" && <b>{t("design.tier.premium")}</b>}</div>
      <div className="sr-studio-dock-actions"><a href={showroomUrl} target="_blank" rel="noopener noreferrer" className="sr-studio-demo-link"><StudioIcon name="external" />{t("studio.openTab")}</a><Link to={selectUrl} className="sr-studio-use-theme">{t(design.tier === "premium" ? "detail.unlockDesign" : "detail.chooseDesign")}</Link></div>
    </aside>
  </main>;
}
