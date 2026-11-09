import { useEffect, useState } from "react";
import { FiMail, FiPlus, FiSend } from "react-icons/fi";
import { api, type Campaign } from "../api/client";
import { useStore } from "../Layout";
import { useAsync } from "../hooks/useAsync";
import { EmptyState, PageLoader } from "../components/Skeleton";
import { ConfirmModal } from "../components/ConfirmModal";
import { useToast } from "../components/Toast";
import { t, timeAgo, useLocale } from "../i18n";
import { friendlyError } from "../utils/errors";
import { RichTextEditor, richTextLabels, sanitizeRichText } from "../components/RichTextEditor";

type CampaignLanguage = "en" | "fr" | "ar";

function campaignPlainText(html: string) {
  const documentRoot = new DOMParser().parseFromString(html, "text/html");
  return (documentRoot.body.textContent ?? "").replace(/\s+\n/g, "\n").trim();
}

export function CampaignsPage() {
  const { store } = useStore();
  const toast = useToast();
  const locale = useLocale();
  const [creating, setCreating] = useState(false);
  const [subject, setSubject] = useState("");
  const [preview, setPreview] = useState("");
  const [body, setBody] = useState("");
  const [language, setLanguage] = useState<CampaignLanguage>(locale);
  const [busy, setBusy] = useState(false);
  const [sendTarget, setSendTarget] = useState<Campaign | null>(null);

  const { data: campaigns, loading, error, reload } = useAsync<Campaign[]>(
    () => (store ? api.listCampaigns(store.id) : Promise.resolve([])),
    [store?.id],
  );

  useEffect(() => {
    if (!(campaigns ?? []).some((campaign) => campaign.status === "sending")) return;
    const timer = window.setInterval(reload, 5000);
    return () => window.clearInterval(timer);
  }, [campaigns, reload]);

  async function create() {
    if (!store || !subject.trim()) return;
    setBusy(true);
    try {
      const bodyHtml = sanitizeRichText(body);
      await api.createCampaign(store.id, {
        subject,
        preview_text: preview,
        body_html: bodyHtml,
        body_text: campaignPlainText(bodyHtml),
        language,
      });
      toast.push("success", t(locale, "campaigns.savedDraft"));
      setCreating(false);
      setSubject(""); setPreview(""); setBody(""); setLanguage(locale);
      reload();
    } catch (err) {
      toast.push("error", friendlyError(err, locale, "campaigns.saveFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function send(c: Campaign) {
    if (!store) return;
    setBusy(true);
    try {
      const result = await api.sendCampaign(store.id, c.id);
      toast.push("success", t(locale, result.queued ? "campaigns.queuedToast" : "campaigns.sentToast"));
      setSendTarget(null);
      reload();
    } catch (err) {
      toast.push("error", friendlyError(err, locale, "campaigns.sendFailed"));
    } finally {
      setBusy(false);
    }
  }

  const statusBadge = (c: Campaign) => {
    const map: Record<string, string> = { draft: "badge-neutral", scheduled: "badge-info", sending: "badge-warning", sent: "badge-success", failed: "badge-danger" };
    const key = `status${c.status[0].toUpperCase() + c.status.slice(1)}` as "statusDraft" | "statusScheduled" | "statusSending" | "statusSent" | "statusFailed";
    return <span className={`badge ${map[c.status] ?? "badge-neutral"}`}>{t(locale, `campaigns.${key}`)}</span>;
  };

  if (error) {
    return <EmptyState icon={<FiMail />} title={t(locale, "campaigns.loadError")} sub={error} action={<button className="btn btn-secondary" onClick={reload}>{t(locale, "errors.tryAgain")}</button>} />;
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="d-title">{t(locale, "campaigns.title")}</h1>
          <p className="d-subtitle">{t(locale, "campaigns.subtitle")}</p>
        </div>
        <div className="page-head-actions">
          <button className="btn btn-primary" onClick={() => setCreating((v) => !v)}>
            <FiPlus /> {t(locale, "campaigns.newCampaign")}
          </button>
        </div>
      </div>

      {creating && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="d-card-head">
            <span className="d-card-title">{t(locale, "campaigns.newCampaign")}</span>
            <button className="btn btn-ghost btn-sm" onClick={() => setCreating(false)}>{t(locale, "sections.cancel")}</button>
          </div>
          <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="field campaign-language-field">
              <label className="field-label" htmlFor="campaign-language">{t(locale, "campaigns.language")}</label>
              <select id="campaign-language" className="select" value={language} onChange={(event) => setLanguage(event.target.value as CampaignLanguage)}>
                <option value="en">{t(locale, "campaigns.languageEn")}</option>
                <option value="fr">{t(locale, "campaigns.languageFr")}</option>
                <option value="ar">{t(locale, "campaigns.languageAr")}</option>
              </select>
              <span className="field-hint">{t(locale, "campaigns.languageHint")}</span>
            </div>
            <div className="field">
              <label className="field-label">{t(locale, "campaigns.subject")}</label>
              <input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={t(locale, "campaigns.subjectPh")} />
            </div>
            <div className="field">
              <label className="field-label">{t(locale, "campaigns.preview")}</label>
              <input className="input" value={preview} onChange={(e) => setPreview(e.target.value)} placeholder={t(locale, "campaigns.previewPh")} />
            </div>
            <div className="field">
              <label className="field-label">{t(locale, "campaigns.body")}</label>
              <RichTextEditor
                value={body}
                onChange={setBody}
                placeholder={t(locale, "campaigns.bodyPh")}
                labels={richTextLabels(locale)}
                direction={language === "ar" ? "rtl" : "ltr"}
              />
              <span className="field-hint">{t(locale, "campaigns.bodyHint")}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button className="btn btn-primary" onClick={create} disabled={!subject.trim() || busy}>
                {busy && <span className="spin" />}
                {t(locale, "campaigns.saveDraft")}
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="card"><PageLoader /></div>
      ) : (campaigns ?? []).length === 0 && !creating ? (
        <div className="card">
          <EmptyState icon={<FiMail />} title={t(locale, "campaigns.none")} sub={t(locale, "campaigns.noneSub")} action={<button className="btn btn-primary" onClick={() => setCreating(true)}><FiPlus /> {t(locale, "campaigns.newCampaign")}</button>} />
        </div>
      ) : (
        <div className="card">
          {(campaigns ?? []).map((c) => (
            <div className="campaign-tile" key={c.id}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="row-main" style={{ fontSize: 14.5 }}>{c.subject}</div>
                  <div className="row-sub" style={{ marginTop: 2 }}>{c.preview_text || t(locale, "campaigns.noPreview")} · {(c.language || "en").toUpperCase()} · {timeAgo(c.created_at, locale)}</div>
                </div>
                {statusBadge(c)}
                <button className="btn btn-secondary btn-sm" disabled={c.status !== "draft" || busy} onClick={() => setSendTarget(c)}>
                  {busy && sendTarget?.id === c.id ? <span className="spin spin-dark" /> : <FiSend />} {t(locale, "campaigns.send")}
                </button>
              </div>
              <div style={{ display: "flex", gap: 16, marginTop: 12, fontSize: 12, color: "var(--ink-muted)" }}>
                <span>{t(locale, "campaigns.recipients", c.recipients_count)}</span>
                <span>{t(locale, "campaigns.sent", c.sent_count)}</span>
                {c.failed_count > 0 && <span style={{ color: "var(--danger)" }}>{t(locale, "campaigns.failed", c.failed_count)}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmModal
        open={sendTarget !== null}
        title={t(locale, "campaigns.send")}
        body={sendTarget ? t(locale, "campaigns.sendConfirm", sendTarget.subject) : ""}
        loading={busy}
        onConfirm={() => { if (sendTarget) send(sendTarget); }}
        onClose={() => { setSendTarget(null); setBusy(false); }}
      />
    </div>
  );
}
