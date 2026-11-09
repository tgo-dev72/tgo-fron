import { useMemo, useState } from "react";
import { FiCheckCircle, FiGlobe, FiMail, FiMapPin, FiPhone, FiSearch, FiUser, FiUsers, FiXCircle } from "react-icons/fi";
import { api, type Customer } from "../api/client";
import { useStore } from "../Layout";
import { useAsync } from "../hooks/useAsync";
import { EmptyState, PageLoader, Skeleton } from "../components/Skeleton";
import { t, fmtMoney, timeAgo, useLocale } from "../i18n";
import { ModalShell, useLastPresent } from "../components/ModalShell";

export function CustomersPage() {
  const { store } = useStore();
  const locale = useLocale();
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Customer | null>(null);
  const renderedCustomer = useLastPresent(selected);

  const { data: customers, loading, error, reload } = useAsync<Customer[]>(
    () => (store ? api.listCustomers(store.id) : Promise.resolve([])),
    [store?.id],
  );

  const filtered = useMemo(() => {
    let list = customers ?? [];
    if (q.trim()) {
      const needle = q.toLowerCase();
      list = list.filter((c) => c.name.toLowerCase().includes(needle) || c.email.toLowerCase().includes(needle) || (c.city ?? "").toLowerCase().includes(needle));
    }
    return list;
  }, [customers, q]);

  const totalSpent = (customers ?? []).reduce((s, c) => s + c.total_spent, 0);

  if (error) {
    return <EmptyState icon={<FiUsers />} title={t(locale, "customers.loadError")} sub={error} action={<button className="btn btn-secondary" onClick={reload}>{t(locale, "errors.tryAgain")}</button>} />;
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="d-title">{t(locale, "customers.title")}</h1>
          <p className="d-subtitle">{loading ? <Skeleton style={{ height: 16, width: 200 }} /> : <>{t(locale, "customers.subtitle", customers?.length ?? 0, fmtMoney(totalSpent, undefined, locale))}.</>}</p>
        </div>
      </div>

      <div className="toolbar">
        <div className="search-box">
          <FiSearch />
          <input className="input" placeholder={t(locale, "customers.search")} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      {loading ? (
        <div className="card"><PageLoader /></div>
      ) : filtered.length === 0 ? (
        <div className="card">
          <EmptyState icon={<FiUsers />} title={t(locale, "customers.none")} sub={q ? t(locale, "customers.noMatch") : t(locale, "customers.noneSub")} />
        </div>
      ) : (
        <div className="card table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t(locale, "customers.thCustomer")}</th>
                <th>{t(locale, "customers.thContact")}</th>
                <th>{t(locale, "customers.thLocation")}</th>
                <th>{t(locale, "customers.thOrders")}</th>
                <th>{t(locale, "customers.thTotalSpent")}</th>
                <th>{t(locale, "customers.thLoyalty")}</th>
                <th>{t(locale, "customers.thJoined")}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, i) => (
                <tr key={c.id || c.email + i} className="clickable-row" onClick={() => setSelected(c)}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div className="avatar">{c.name[0] || "?"}</div>
                      <div>
                        <div className="row-main">{c.name}</div>
                        <div className="row-sub">{c.email}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ color: "var(--ink-muted)", fontSize: 13 }}>{c.phone || "—"}</td>
                  <td style={{ color: "var(--ink-muted)", fontSize: 13 }}>{[c.city, c.country].filter(Boolean).join(", ") || "—"}</td>
                  <td className="tnum">{c.orders_count}</td>
                  <td className="tnum" style={{ fontWeight: 600 }}>{fmtMoney(c.total_spent, undefined, locale)}</td>
                  <td>{c.loyalty_points > 0 ? <span className="badge badge-brand">{t(locale, "customers.pts", c.loyalty_points)}</span> : <span className="badge badge-neutral">0</span>}</td>
                  <td style={{ color: "var(--ink-muted)", fontSize: 12.5 }}>{timeAgo(c.created_at, locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* ── Mobile cards ─────────────────────────────── */}
          <div className="m-cards">
            {filtered.map((c, i) => (
              <div className="m-card" key={c.id || c.email + i} onClick={() => setSelected(c)}>
                <div className="m-card-head">
                  <div className="avatar" style={{ width: 32, height: 32, fontSize: 11 }}>{c.name[0] || "?"}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="m-card-title">{c.name}</div>
                    <div className="m-card-sub">{c.email}</div>
                  </div>
                  {c.loyalty_points > 0 && <span className="badge badge-brand">{t(locale, "customers.pts", c.loyalty_points)}</span>}
                </div>
                <div className="m-card-row">
                  <span className="m-card-label">{c.phone || "—"}</span>
                  <span className="m-card-label">{[c.city, c.country].filter(Boolean).join(", ") || "—"}</span>
                </div>
                <div className="m-card-row">
                  <span className="m-card-value">{fmtMoney(c.total_spent, undefined, locale)}</span>
                  <span className="m-card-label">{t(locale, "customers.thOrders")}: {c.orders_count}</span>
                </div>
                <div className="m-card-row">
                  <span className="m-card-label">{timeAgo(c.created_at, locale)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {renderedCustomer && <CustomerDetails customer={renderedCustomer} open={Boolean(selected)} onClose={() => setSelected(null)} />}
    </div>
  );
}

function CustomerDetails({ customer, open, onClose }: { customer: Customer; open: boolean; onClose: () => void }) {
  const locale = useLocale();
  return <ModalShell open={open} onClose={onClose} labelledBy="customer-detail-title" panelClassName="customer-detail-modal">
      <div className="modal-head">
        <div className="customer-detail-heading"><div className="avatar">{customer.name[0] || "?"}</div><div><div id="customer-detail-title" className="d-card-title">{customer.name}</div><div className="row-sub">{t(locale, "customers.registeredCustomer")}</div></div></div>
        <button className="danger-icon-button is-neutral" onClick={onClose} aria-label={t(locale, "orders.close")}><FiXCircle /></button>
      </div>
      <div className="modal-body customer-detail-body">
        <div className="customer-contact-grid">
          <div><FiMail /><span><small>{t(locale, "customers.email")}</small><strong>{customer.email}</strong></span>{customer.email_verified ? <FiCheckCircle className="verified-mark" /> : <span className="badge badge-warning">{t(locale, "customers.unverified")}</span>}</div>
          <div><FiPhone /><span><small>{t(locale, "customers.phone")}</small><strong>{customer.phone || "—"}</strong></span>{customer.phone_verified ? <FiCheckCircle className="verified-mark" /> : <span className="badge badge-neutral">{t(locale, "customers.unverified")}</span>}</div>
          <div><FiMapPin /><span><small>{t(locale, "customers.address")}</small><strong>{[customer.address, customer.city, customer.country].filter(Boolean).join(", ") || "—"}</strong></span></div>
          <div><FiGlobe /><span><small>{t(locale, "customers.language")}</small><strong>{customer.preferred_language.toUpperCase()}</strong></span></div>
        </div>
        <div className="customer-stat-grid"><div><small>{t(locale, "customers.thOrders")}</small><strong>{customer.orders_count}</strong></div><div><small>{t(locale, "customers.thTotalSpent")}</small><strong>{fmtMoney(customer.total_spent, undefined, locale)}</strong></div><div><small>{t(locale, "customers.thLoyalty")}</small><strong>{t(locale, "customers.pts", customer.loyalty_points)}</strong></div></div>
        <div className="customer-consent-row"><FiUser /><div><strong>{t(locale, "customers.marketing")}</strong><p>{customer.marketing_subscribed ? t(locale, "customers.marketingActive") : t(locale, "customers.marketingInactive")}</p></div><span className={`badge ${customer.marketing_subscribed ? "badge-success" : "badge-neutral"}`}>{customer.marketing_subscribed ? t(locale, "customers.subscribed") : t(locale, "customers.notSubscribed")}</span></div>
        <dl className="detail-list"><div><dt>{t(locale, "customers.thJoined")}</dt><dd>{new Date(customer.created_at).toLocaleString(locale)}</dd></div><div><dt>{t(locale, "customers.lastOrder")}</dt><dd>{customer.last_order_at ? new Date(customer.last_order_at).toLocaleString(locale) : "—"}</dd></div></dl>
      </div>
      <div className="modal-foot"><button className="btn btn-secondary" onClick={onClose}>{t(locale, "orders.close")}</button></div>
  </ModalShell>;
}
