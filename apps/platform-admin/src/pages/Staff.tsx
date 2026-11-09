import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { FiAlertTriangle, FiCheck, FiKey, FiLoader, FiPlus, FiSave, FiShield, FiUserCheck, FiUsers, FiX } from "react-icons/fi";
import { adminApi, type StaffCatalog, type StaffMember } from "../api";
import { ConfirmDialog, ErrorState, Loading, PageHeader, formatDate } from "../components/Ui";
import { useI18n } from "../i18n";

type StaffDraft = { role: string; is_active: boolean };

export function StaffPage() {
  const { locale, tr } = useI18n();
  const [catalog, setCatalog] = useState<StaffCatalog | null>(null);
  const [drafts, setDrafts] = useState<Record<number, StaffDraft>>({});
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState<number | "new" | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pendingSuspension, setPendingSuspension] = useState<StaffMember | null>(null);
  const [form, setForm] = useState({ email: "", first_name: "", last_name: "", password: "", role: "merchant_support" });

  const hydrate = useCallback((next: StaffCatalog) => {
    setCatalog(next);
    setDrafts(Object.fromEntries(next.staff.map((member) => [member.id, {
      role: member.role || "analyst",
      is_active: member.is_active,
    }])));
  }, []);

  const load = useCallback(() => {
    setError("");
    return adminApi.staff().then(hydrate).catch(() => setError(tr("staff.saveFailed")));
  }, [hydrate]);

  useEffect(() => { void load(); }, [load]);

  const rolesBySlug = useMemo(
    () => Object.fromEntries((catalog?.roles ?? []).map((role) => [role.slug, role])),
    [catalog],
  );
  const roleName = (slug: string, _fallback: string) => tr(`staff.role.${slug}.name`, {}, tr("staff.role.other.name"));
  const roleDescription = (slug: string, _fallback: string) => tr(`staff.role.${slug}.detail`, {}, tr("staff.role.other.detail"));

  async function createStaff(event: FormEvent) {
    event.preventDefault(); setSaving("new"); setError(""); setNotice("");
    try {
      await adminApi.createStaff(form);
      setForm({ email: "", first_name: "", last_name: "", password: "", role: "merchant_support" });
      setCreating(false); setNotice(tr("staff.created")); await load();
    } catch { setError(tr("staff.saveFailed")); }
    finally { setSaving(null); }
  }

  async function commitMember(member: StaffMember) {
    const draft = drafts[member.id];
    if (!draft) return;
    setSaving(member.id); setError(""); setNotice("");
    try {
      await adminApi.updateStaff(member.id, draft);
      setNotice(tr("staff.saved")); await load();
    } catch { setError(tr("staff.saveFailed")); }
    finally { setSaving(null); }
  }

  async function saveMember(member: StaffMember) {
    const draft = drafts[member.id];
    if (!draft) return;
    if (member.is_active && !draft.is_active) { setPendingSuspension(member); return; }
    await commitMember(member);
  }

  if (!catalog && !error) return <Loading />;
  if (!catalog) return <ErrorState message={error} retry={() => void load()} />;
  const activeCount = catalog.staff.filter((member) => member.is_active).length;
  const ownerCount = catalog.staff.filter((member) => member.is_superuser).length;

  return <>
    <PageHeader
      eyebrow={tr("staff.eyebrow")}
      title={tr("nav.staff")}
      detail={tr("staff.detail")}
      actions={<button className="button" onClick={() => setCreating((value) => !value)}>{creating ? <FiX /> : <FiPlus />} {tr(creating ? "staff.cancel" : "staff.add")}</button>}
    />

    <section className="staff-summary">
      <article><FiUsers /><div><strong>{catalog.staff.length}</strong><span>{tr("staff.total")}</span></div></article>
      <article><FiUserCheck /><div><strong>{activeCount}</strong><span>{tr("staff.active")}</span></div></article>
      <article><FiShield /><div><strong>{ownerCount}</strong><span>{tr("staff.owners")}</span></div></article>
      <article><FiKey /><div><strong>{catalog.roles.length}</strong><span>{tr("staff.rolesTitle")}</span></div></article>
    </section>

    {creating && <form className="panel staff-create" onSubmit={createStaff}>
      <div className="panel-head"><div><h2>{tr("staff.newTitle")}</h2><p>{tr("staff.newDetail")}</p></div></div>
      <div className="staff-form-grid">
        <label><span>{tr("staff.firstName")}</span><input value={form.first_name} onChange={(event) => setForm({ ...form, first_name: event.target.value })} /></label>
        <label><span>{tr("staff.lastName")}</span><input value={form.last_name} onChange={(event) => setForm({ ...form, last_name: event.target.value })} /></label>
        <label><span>{tr("staff.email")}</span><input type="email" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
        <label><span>{tr("staff.temporaryPassword")}</span><input type="password" required autoComplete="new-password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></label>
        <label className="staff-form-wide"><span>{tr("staff.role")}</span><select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}>
          {catalog.roles.filter((role) => role.assignable).map((role) => <option key={role.slug} value={role.slug}>{roleName(role.slug, role.name)}</option>)}
        </select><small>{roleDescription(form.role, rolesBySlug[form.role]?.description || "")}</small></label>
      </div>
      <footer className="staff-form-footer"><span><FiShield /> {tr("staff.dedicatedHint")}</span><button className="button" disabled={saving === "new"}>{saving === "new" ? <FiLoader className="spin" aria-hidden="true" /> : <FiPlus />} {tr(saving === "new" ? "staff.creating" : "staff.create")}</button></footer>
    </form>}

    {error && <div className="pricing-message error staff-message" role="alert"><FiAlertTriangle /> {error}</div>}
    {notice && <div className="pricing-message success staff-message"><FiCheck /> {notice}</div>}

    <section className="panel staff-directory">
      <div className="panel-head"><div><h2>{tr("staff.directory")}</h2><p>{tr("staff.directoryDetail")}</p></div></div>
      <div className="staff-list">{catalog.staff.map((member) => {
        const draft = drafts[member.id] || { role: member.role || "analyst", is_active: member.is_active };
        const changed = draft.role !== member.role || draft.is_active !== member.is_active;
        return <article key={member.id} className={!member.is_active ? "inactive" : ""}>
          <div className="staff-avatar">{`${member.first_name[0] || ""}${member.last_name[0] || ""}`.toUpperCase() || member.email[0].toUpperCase()}</div>
          <div className="staff-identity"><strong>{`${member.first_name} ${member.last_name}`.trim() || member.email}</strong><span>{member.email}</span><small>{tr("staff.lastSeen", { date: formatDate(member.last_login, true, locale) })}</small></div>
          <div className="staff-role-field">
            <span>{tr("staff.role")}</span>
            {member.is_superuser ? <strong>{roleName("platform_owner", rolesBySlug.platform_owner?.name || tr("staff.owner"))}</strong> : <select value={draft.role} onChange={(event) => setDrafts({ ...drafts, [member.id]: { ...draft, role: event.target.value } })}>
              {catalog.roles.filter((role) => role.assignable).map((role) => <option key={role.slug} value={role.slug}>{roleName(role.slug, role.name)}</option>)}
            </select>}
          </div>
          <label className="staff-access"><input type="checkbox" disabled={member.is_superuser} checked={draft.is_active} onChange={(event) => setDrafts({ ...drafts, [member.id]: { ...draft, is_active: event.target.checked } })} /><span>{draft.is_active ? tr("staff.accessActive") : tr("staff.accessSuspended")}</span></label>
          <button className="icon-button" disabled={member.is_superuser || !changed || saving === member.id} title={tr("staff.save")} onClick={() => void saveMember(member)}>{saving === member.id ? <FiLoader className="spin" aria-hidden="true" /> : <FiSave />}</button>
          {member.identity_warnings.length > 0 && <div className="staff-warning"><FiAlertTriangle /><span>{member.identity_warnings.map((warning) => tr(`staff.warning.${warning}`, {}, tr("staff.warning.other"))).join(" · ")}</span></div>}
        </article>;
      })}</div>
    </section>

    <section className="staff-governance-grid">
      <div className="panel">
        <div className="panel-head"><div><h2>{tr("staff.rolesTitle")}</h2><p>{tr("staff.rolesDetail")}</p></div></div>
        <div className="role-cards">{catalog.roles.map((role) => <article key={role.slug}>
          <div><FiShield /><strong>{roleName(role.slug, role.name)}</strong>{!role.assignable && <span>{tr("staff.reserved")}</span>}</div>
          <p>{roleDescription(role.slug, role.description)}</p>
          <small>{role.permissions[0] === "*" ? tr("staff.fullAuthority") : tr("staff.permissionCount", { count: role.permissions.length })}</small>
        </article>)}</div>
      </div>
      <div className="panel">
        <div className="panel-head"><div><h2>{tr("staff.layersTitle")}</h2><p>{tr("staff.layersDetail")}</p></div></div>
        <div className="authorization-layers">{catalog.authorization_layers.map((layer, index) => <article key={layer.key}><span>{index + 1}</span><div><strong>{tr(`staff.layer.${layer.key}.name`, {}, tr("staff.layer.other.name"))}</strong><p>{tr(`staff.layer.${layer.key}.detail`, {}, tr("staff.layer.other.detail"))}</p></div></article>)}</div>
      </div>
    </section>

    <ConfirmDialog open={Boolean(pendingSuspension)} title={tr("staff.suspendTitle")} detail={tr("staff.suspendConfirm", { email: pendingSuspension?.email || "" })} confirmLabel={tr("staff.suspendAction")} busy={saving !== null} danger onCancel={() => setPendingSuspension(null)} onConfirm={() => { if (!pendingSuspension) return; const member = pendingSuspension; setPendingSuspension(null); void commitMember(member); }} />
  </>;
}
