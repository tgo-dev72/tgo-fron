import { useEffect, useState, type FormEvent } from "react";
import { FiBell, FiCheckCircle, FiMail, FiSave, FiSend } from "react-icons/fi";
import { adminApi, type PlatformMonitoring } from "../api";
import { useAuth } from "../AuthContext";
import { useI18n } from "../i18n";
import { Loading } from "../components/Ui";

const fallback: PlatformMonitoring = {
  enabled: true,
  alert_email: "tijarago.services@gmail.com",
  reminder_minutes: 60,
  last_alert_sent_at: null,
  last_test_sent_at: null,
  updated_at: "",
  incidents: [],
};

export function MonitoringPage() {
  const { user } = useAuth();
  const { tr, locale } = useI18n();
  const [form, setForm] = useState(fallback);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const canEdit = Boolean(user?.is_superuser);

  useEffect(() => {
    adminApi.monitoring().then(setForm).catch((reason) => setError(reason.message)).finally(() => setLoading(false));
  }, []);

  const date = (value: string | null) => value
    ? new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
    : tr("monitoring.never");

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!canEdit || saving) return;
    setSaving(true); setError(""); setMessage("");
    try {
      const saved = await adminApi.updateMonitoring({
        enabled: form.enabled,
        alert_email: form.alert_email.trim(),
        reminder_minutes: form.reminder_minutes,
      });
      setForm(saved); setMessage(tr("monitoring.saved"));
    } catch (reason) { setError(reason instanceof Error ? reason.message : tr("monitoring.failed")); }
    finally { setSaving(false); }
  }

  async function sendTest() {
    if (!canEdit || testing) return;
    setTesting(true); setError(""); setMessage("");
    try {
      const tested = await adminApi.testMonitoring();
      setForm((current) => ({ ...current, ...tested }));
      setMessage(tr("monitoring.testSent"));
    } catch (reason) { setError(reason instanceof Error ? reason.message : tr("monitoring.testFailed")); }
    finally { setTesting(false); }
  }

  if (loading) return <Loading />;
  return <>
    <header className="page-header"><div><span className="eyebrow">{tr("monitoring.eyebrow")}</span><h1>{tr("monitoring.title")}</h1><p>{tr("monitoring.detail")}</p></div></header>
    <form className="panel monitoring-form" onSubmit={save}>
      {!canEdit && <div className="presentation-readonly">{tr("monitoring.readonly")}</div>}
      <section className="monitoring-status-grid">
        <article><FiBell /><span>{tr("monitoring.delivery")}</span><strong>{form.enabled ? tr("monitoring.enabled") : tr("monitoring.disabled")}</strong></article>
        <article><FiMail /><span>{tr("monitoring.lastAlert")}</span><strong>{date(form.last_alert_sent_at)}</strong></article>
        <article><FiCheckCircle /><span>{tr("monitoring.lastTest")}</span><strong>{date(form.last_test_sent_at)}</strong></article>
      </section>
      <section className="presentation-section">
        <div className="presentation-section-title"><FiMail /><span><strong>{tr("monitoring.recipient")}</strong><small>{tr("monitoring.recipientHelp")}</small></span></div>
        <div className="presentation-fields monitoring-fields">
          <label><span>{tr("monitoring.email")}</span><input disabled={!canEdit} dir="ltr" type="email" required value={form.alert_email} onChange={(event) => setForm({ ...form, alert_email: event.target.value })} /></label>
          <label><span>{tr("monitoring.reminder")}</span><select disabled={!canEdit} value={form.reminder_minutes} onChange={(event) => setForm({ ...form, reminder_minutes: Number(event.target.value) })}>{[15, 30, 60, 180, 360, 720, 1440].map((minutes) => <option value={minutes} key={minutes}>{tr(`monitoring.interval.${minutes}`)}</option>)}</select></label>
          <label className="monitoring-toggle"><span>{tr("monitoring.active")}</span><input disabled={!canEdit} type="checkbox" checked={form.enabled} onChange={(event) => setForm({ ...form, enabled: event.target.checked })} /><small>{tr("monitoring.activeHelp")}</small></label>
        </div>
      </section>
      <section className="presentation-section">
        <div className="presentation-section-title"><FiBell /><span><strong>{tr("monitoring.signals")}</strong><small>{tr("monitoring.signalsHelp")}</small></span></div>
        {form.incidents.length ? <div className="monitoring-incidents">{form.incidents.map((item) => <article key={item.key}><span>{item.label}</span><strong>{item.count}</strong></article>)}</div> : <div className="monitoring-healthy"><FiCheckCircle /> {tr("monitoring.healthy")}</div>}
      </section>
      <footer className="presentation-actions monitoring-actions">
        <span aria-live="polite" className={error ? "danger-text" : "success-text"}>{error || message}</span>
        {canEdit && <button className="button secondary" type="button" disabled={testing || saving} onClick={sendTest}><FiSend /> {tr(testing ? "monitoring.testing" : "monitoring.test")}</button>}
        {canEdit && <button className="button" disabled={saving || testing}><FiSave /> {tr(saving ? "monitoring.saving" : "monitoring.save")}</button>}
      </footer>
    </form>
  </>;
}
