import { useEffect, useMemo, useState } from "react";
import { FiArchive, FiArrowLeft, FiInbox, FiMail, FiPlus, FiRefreshCw, FiSearch, FiSend, FiX } from "react-icons/fi";
import { api, type MailConversation, type MailboxSummary } from "../api/client";
import { EmptyState, PageLoader } from "../components/Skeleton";
import { useToast } from "../components/Toast";
import { useStore } from "../Layout";
import { friendlyError } from "../utils/errors";
import { t, timeAgo, useLocale } from "../i18n";
import { ModalShell } from "../components/ModalShell";

type Folder = "inbox" | "sent" | "archived";

function initials(name: string, email: string) {
  return (name || email).split(/[\s@._-]+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
}

export function MailboxPage() {
  const { store } = useStore();
  const locale = useLocale();
  const toast = useToast();
  const [summary, setSummary] = useState<MailboxSummary | null>(null);
  const [conversations, setConversations] = useState<MailConversation[]>([]);
  const [selected, setSelected] = useState<MailConversation | null>(null);
  const [folder, setFolder] = useState<Folder>("inbox");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [compose, setCompose] = useState(false);
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [reply, setReply] = useState("");

  const load = async (preserve = true) => {
    if (!store) return;
    setLoading(true);
    try {
      const [nextSummary, page] = await Promise.all([
        api.getMailboxSummary(store.id), api.listMailConversations(store.id, folder, query.trim()),
      ]);
      setSummary(nextSummary);
      setConversations(page.results);
      if (preserve && selected) {
        const found = page.results.find((item) => item.public_id === selected.public_id);
        if (!found) setSelected(null);
      }
    } catch (error) {
      toast.push("error", friendlyError(error, locale, "mailbox.loadFailed"));
    } finally { setLoading(false); }
  };

  useEffect(() => { setSelected(null); void load(false); }, [store?.id, folder]);
  useEffect(() => {
    const timer = window.setTimeout(() => { if (store) void load(); }, 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  async function open(item: MailConversation) {
    if (!store) return;
    try {
      const detail = await api.getMailConversation(store.id, item.public_id);
      setSelected(detail);
      setConversations((current) => current.map((entry) => entry.public_id === item.public_id ? { ...entry, unread_count: 0 } : entry));
      setSummary((current) => current ? { ...current, unread: Math.max(0, current.unread - item.unread_count) } : current);
    } catch (error) { toast.push("error", friendlyError(error, locale, "mailbox.loadFailed")); }
  }

  async function toggleMailbox() {
    if (!store || !summary) return;
    setBusy(true);
    try {
      const next = await api.setMailboxEnabled(store.id, !summary.enabled);
      setSummary(next);
      toast.push("success", t(locale, next.enabled ? "mailbox.enabledToast" : "mailbox.disabledToast"));
    } catch (error) { toast.push("error", friendlyError(error, locale, "mailbox.setupFailed")); }
    finally { setBusy(false); }
  }

  async function sendCompose() {
    if (!store || !to.trim() || !subject.trim() || !body.trim()) return;
    setBusy(true);
    try {
      await api.composeMail(store.id, { to: to.trim(), subject: subject.trim(), text: body.trim() });
      toast.push("success", t(locale, "mailbox.sentToast"));
      setCompose(false); setTo(""); setSubject(""); setBody(""); setFolder("sent");
    } catch (error) { toast.push("error", friendlyError(error, locale, "mailbox.sendFailed")); }
    finally { setBusy(false); }
  }

  async function sendReply() {
    if (!store || !selected || !reply.trim()) return;
    setBusy(true);
    try {
      await api.replyMail(store.id, selected.public_id, { text: reply.trim() });
      setReply("");
      await open(selected);
      toast.push("success", t(locale, "mailbox.sentToast"));
    } catch (error) { toast.push("error", friendlyError(error, locale, "mailbox.sendFailed")); }
    finally { setBusy(false); }
  }

  async function archive() {
    if (!store || !selected) return;
    const action = selected.status === "archived" ? "restore" : "archive";
    await api.updateMailConversation(store.id, selected.public_id, action);
    setSelected(null); void load(false);
  }

  const emptyCopy = useMemo(() => folder === "sent" ? "mailbox.noSent" : folder === "archived" ? "mailbox.noArchived" : "mailbox.noInbox", [folder]);

  if (!store) return <EmptyState icon={<FiMail />} title={t(locale, "mailbox.noStore")} sub={t(locale, "mailbox.noStoreSub")} />;

  return <div>
    <div className="page-head mailbox-page-head">
      <div><h1 className="d-title">{t(locale, "mailbox.title")}</h1><p className="d-subtitle">{summary?.address ?? `${store.slug}@mail.tijarago.com`}</p></div>
      <div className="page-head-actions">
        <button className="btn btn-secondary" onClick={() => void load()} disabled={loading}><FiRefreshCw /> {t(locale, "mailbox.refresh")}</button>
        <button className="btn btn-primary" onClick={() => setCompose(true)} disabled={!summary?.enabled}><FiPlus /> {t(locale, "mailbox.compose")}</button>
      </div>
    </div>

    {summary && (!summary.configured || !summary.enabled) && <div className="mailbox-setup card">
      <div><strong>{t(locale, "mailbox.setupTitle")}</strong><p>{t(locale, summary.configured ? "mailbox.setupReady" : "mailbox.setupUnavailable")}</p></div>
      <button className="btn btn-primary" disabled={!summary.configured || busy} onClick={toggleMailbox}>{busy && <span className="spin" />}{t(locale, "mailbox.enable")}</button>
    </div>}

    <div className={`mailbox-shell card${selected ? " has-thread" : ""}`}>
      <aside className="mailbox-rail">
        <button className={folder === "inbox" ? "active" : ""} onClick={() => setFolder("inbox")}><FiInbox /> {t(locale, "mailbox.inbox")} {summary?.unread ? <b>{summary.unread}</b> : null}</button>
        <button className={folder === "sent" ? "active" : ""} onClick={() => setFolder("sent")}><FiSend /> {t(locale, "mailbox.sent")}</button>
        <button className={folder === "archived" ? "active" : ""} onClick={() => setFolder("archived")}><FiArchive /> {t(locale, "mailbox.archived")}</button>
      </aside>
      <section className="mailbox-list">
        <label className="mailbox-search"><FiSearch /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t(locale, "mailbox.search")} /></label>
        {loading ? <PageLoader /> : conversations.length === 0 ? <div className="mailbox-empty"><FiMail /><p>{t(locale, emptyCopy)}</p></div> : conversations.map((item) => <button key={item.public_id} className={`mailbox-row${item.unread_count ? " unread" : ""}${selected?.public_id === item.public_id ? " selected" : ""}`} onClick={() => void open(item)}>
          <span className="mailbox-avatar">{initials(item.correspondent_name, item.correspondent_email)}</span>
          <span className="mailbox-row-copy"><span><strong>{item.correspondent_name || item.correspondent_email}</strong><time>{timeAgo(item.last_message_at, locale)}</time></span><b>{item.subject || t(locale, "mailbox.noSubject")}</b><small>{item.latest_message?.text_body || t(locale, "mailbox.htmlMessage")}</small></span>
          {item.unread_count > 0 && <i>{item.unread_count}</i>}
        </button>)}
      </section>
      <section className="mailbox-thread">
        {!selected ? <div className="mailbox-thread-empty"><FiMail /><h2>{t(locale, "mailbox.selectTitle")}</h2><p>{t(locale, "mailbox.selectHint")}</p></div> : <>
          <header><button className="btn btn-ghost btn-sm mailbox-back" onClick={() => setSelected(null)}><FiArrowLeft /></button><div><h2>{selected.subject || t(locale, "mailbox.noSubject")}</h2><p>{selected.correspondent_name || selected.correspondent_email} · {selected.correspondent_email}</p></div><button className="btn btn-ghost btn-sm" onClick={() => void archive()}><FiArchive /> {t(locale, selected.status === "archived" ? "mailbox.restore" : "mailbox.archive")}</button></header>
          <div className="mailbox-messages">{(selected.messages ?? []).map((message) => <article key={message.public_id} className={`mail-message ${message.direction}`}>
            <div className="mail-message-meta"><strong>{message.direction === "outbound" ? store.name : (message.sender_name || message.sender_email)}</strong><span>{new Date(message.created_at).toLocaleString(locale)} · {t(locale, `mailbox.status.${message.status}`)}</span></div>
            {message.text_body && <div className="mail-message-text">{message.text_body}</div>}
            {!message.text_body && message.html_body && <iframe title={message.subject} sandbox="" srcDoc={message.html_body} />}
            {message.attachments.length > 0 && <div className="mail-attachments">{message.attachments.map((file) => <a key={file.id} href={file.url} target="_blank" rel="noreferrer">{file.filename} <small>{Math.ceil(file.size / 1024)} KB</small></a>)}</div>}
          </article>)}</div>
          <div className="mailbox-reply"><textarea className="textarea" value={reply} onChange={(event) => setReply(event.target.value)} placeholder={t(locale, "mailbox.replyPlaceholder")} /><button className="btn btn-primary" disabled={!reply.trim() || busy} onClick={() => void sendReply()}>{busy ? <span className="spin" /> : <FiSend />} {t(locale, "mailbox.reply")}</button></div>
        </>}
      </section>
    </div>

    <ModalShell open={compose} onClose={() => setCompose(false)} busy={busy} labelledBy="mailbox-compose-title" panelClassName="mailbox-compose"><div className="modal-head"><div><span className="d-eyebrow">{summary?.address}</span><h2 id="mailbox-compose-title" className="d-card-title">{t(locale, "mailbox.newMessage")}</h2></div><button type="button" className="icon-btn modal-close" aria-label={t(locale, "mailbox.cancel")} title={t(locale, "mailbox.cancel")} onClick={() => setCompose(false)} disabled={busy}><FiX /></button></div><div className="modal-body">
      <label className="field"><span className="field-label">{t(locale, "mailbox.to")}</span><input className="input" type="email" value={to} onChange={(event) => setTo(event.target.value)} /></label>
      <label className="field"><span className="field-label">{t(locale, "mailbox.subject")}</span><input className="input" value={subject} onChange={(event) => setSubject(event.target.value)} /></label>
      <label className="field"><span className="field-label">{t(locale, "mailbox.message")}</span><textarea className="textarea" rows={9} value={body} onChange={(event) => setBody(event.target.value)} /></label>
    </div><div className="modal-actions"><button className="btn btn-secondary" onClick={() => setCompose(false)} disabled={busy}>{t(locale, "mailbox.cancel")}</button><button className="btn btn-primary" disabled={!to.trim() || !subject.trim() || !body.trim() || busy} onClick={() => void sendCompose()}>{busy ? <span className="spin" /> : <FiSend />} {t(locale, "mailbox.send")}</button></div></ModalShell>
  </div>;
}
