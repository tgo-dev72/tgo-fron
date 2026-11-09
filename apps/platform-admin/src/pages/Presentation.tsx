import { useEffect, useState, type FormEvent } from "react";
import { FiExternalLink, FiMessageCircle, FiSave } from "react-icons/fi";
import { adminApi, type PlatformPresentation } from "../api";
import { useI18n } from "../i18n";
import { Loading } from "../components/Ui";
import { useAuth } from "../AuthContext";

const channels = ["facebook", "instagram", "linkedin", "tiktok", "x", "youtube"] as const;
const empty: PlatformPresentation = { contact_email: "", support_phone: "", whatsapp_phone: "", social_links: {}, updated_at: "" };

export function PresentationPage() {
  const { tr } = useI18n();
  const { user } = useAuth();
  const canEdit = Boolean(user?.permissions.manage_staff);
  const [form, setForm] = useState(empty);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    adminApi.presentation().then(setForm).catch((reason) => setError(reason.message)).finally(() => setLoading(false));
  }, []);

  async function save(event: FormEvent) {
    event.preventDefault(); setSaving(true); setMessage(""); setError("");
    if (!canEdit) { setSaving(false); return; }
    try {
      const saved = await adminApi.updatePresentation({
        contact_email: form.contact_email.trim(),
        support_phone: form.support_phone.trim(),
        whatsapp_phone: form.whatsapp_phone.trim(),
        social_links: Object.fromEntries(Object.entries(form.social_links).filter(([, value]) => value.trim()).map(([key, value]) => [key, value.trim()])),
      });
      setForm(saved); setMessage(tr("presentation.saved"));
    } catch (reason) { setError(reason instanceof Error ? reason.message : tr("presentation.failed")); }
    finally { setSaving(false); }
  }

  if (loading) return <Loading />;
  return <>
    <header className="page-header"><div><span className="eyebrow">{tr("presentation.eyebrow")}</span><h1>{tr("presentation.title")}</h1><p>{tr("presentation.detail")}</p></div></header>
    <form className="panel presentation-form" onSubmit={save}>
      {!canEdit && <div className="presentation-readonly">{tr("presentation.readonly")}</div>}
      <section className="presentation-section">
        <div className="presentation-section-title"><FiMessageCircle /><span><strong>{tr("presentation.contact")}</strong><small>{tr("presentation.contactHelp")}</small></span></div>
        <div className="presentation-fields">
          <label><span>{tr("presentation.email")}</span><input disabled={!canEdit} dir="ltr" type="email" value={form.contact_email} onChange={(event) => setForm({ ...form, contact_email: event.target.value })} placeholder="hello@tijarago.com" /></label>
          <label><span>{tr("presentation.phone")}</span><input disabled={!canEdit} dir="ltr" type="tel" value={form.support_phone} onChange={(event) => setForm({ ...form, support_phone: event.target.value })} placeholder="+212 5…" /></label>
          <label><span>{tr("presentation.whatsapp")}</span><input disabled={!canEdit} dir="ltr" type="tel" value={form.whatsapp_phone} onChange={(event) => setForm({ ...form, whatsapp_phone: event.target.value })} placeholder="+212 6…" /></label>
        </div>
      </section>
      <section className="presentation-section">
        <div className="presentation-section-title"><FiExternalLink /><span><strong>{tr("presentation.social")}</strong><small>{tr("presentation.socialHelp")}</small></span></div>
        <div className="presentation-fields social-fields">{channels.map((channel) => <label key={channel}><span>{channel === "x" ? "X" : channel[0].toUpperCase() + channel.slice(1)}</span><input disabled={!canEdit} dir="ltr" type="url" value={form.social_links[channel] || ""} onChange={(event) => setForm({ ...form, social_links: { ...form.social_links, [channel]: event.target.value } })} placeholder={`https://${channel}.com/tijarago`} /></label>)}</div>
      </section>
      {canEdit && <footer className="presentation-actions"><span aria-live="polite" className={error ? "danger-text" : "success-text"}>{error || message}</span><button className="button" disabled={saving}><FiSave /> {tr(saving ? "presentation.saving" : "presentation.save")}</button></footer>}
    </form>
  </>;
}
