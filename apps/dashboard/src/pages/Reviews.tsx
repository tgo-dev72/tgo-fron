import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FiCheck, FiClock, FiMessageSquare, FiRefreshCw, FiShield, FiStar, FiX } from "react-icons/fi";
import { api, type Product, type ProductReview } from "../api/client";
import { useStore } from "../Layout";
import { useAsync } from "../hooks/useAsync";
import { EmptyState, PageLoader } from "../components/Skeleton";
import { t, useLocale } from "../i18n";

type ReviewFilter = "all" | ProductReview["status"];
const filters: ReviewFilter[] = ["all", "pending", "published", "rejected"];

export function ReviewsPage() {
  const { store } = useStore();
  const locale = useLocale();
  const [filter, setFilter] = useState<ReviewFilter>("all");
  const [busy, setBusy] = useState<number | null>(null);
  const [saveError, setSaveError] = useState(false);
  const {data, loading, error, reload, setData} = useAsync<[ProductReview[], Product[]]>(
    () => store ? Promise.all([api.listProductReviews(store.id), api.listProducts(store.id)]) : Promise.resolve([[], []]), [store?.id],
  );

  async function moderate(review: ProductReview, status: ProductReview["status"]) {
    if (!store || busy !== null) return;
    setBusy(review.id); setSaveError(false);
    try {
      const updated = await api.moderateProductReview(store.id, review.id, status);
      setData(current => current ? [current[0].map(item => item.id === updated.id ? updated : item), current[1]] : current);
    } catch { setSaveError(true); }
    finally { setBusy(null); }
  }

  const allReviews = data?.[0] ?? [];
  const products = useMemo(() => new Map((data?.[1] ?? []).map(product => [product.id, product])), [data]);
  const counts = useMemo(() => ({
    all: allReviews.length,
    pending: allReviews.filter(review => review.status === "pending").length,
    published: allReviews.filter(review => review.status === "published").length,
    rejected: allReviews.filter(review => review.status === "rejected").length,
  }), [allReviews]);
  const average = allReviews.length ? allReviews.reduce((sum, review) => sum + review.rating, 0) / allReviews.length : 0;
  const reviews = allReviews.filter(review => filter === "all" || review.status === filter);
  const dateFormatter = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" });
  const statusClass = (status: ProductReview["status"]) => status === "published" ? "badge-success" : status === "rejected" ? "badge-danger" : "badge-warning";

  return <div className="reviews-page">
    <div className="page-head reviews-page-head">
      <div><h1 className="d-title">{t(locale, "reviews.title")}</h1><p className="d-subtitle">{t(locale, "reviews.hint")}</p></div>
      <button className="btn btn-secondary" onClick={reload} disabled={busy !== null || loading}><FiRefreshCw /> {t(locale, "reviews.refresh")}</button>
    </div>

    {!loading && !error && <div className="reviews-metrics" aria-label={t(locale, "reviews.summary")}>
      <div className="review-metric"><span className="review-metric-icon"><FiMessageSquare /></span><div><small>{t(locale, "reviews.all")}</small><strong>{counts.all}</strong></div></div>
      <div className="review-metric"><span className="review-metric-icon is-pending"><FiClock /></span><div><small>{t(locale, "reviews.pending")}</small><strong>{counts.pending}</strong></div></div>
      <div className="review-metric"><span className="review-metric-icon is-published"><FiCheck /></span><div><small>{t(locale, "reviews.published")}</small><strong>{counts.published}</strong></div></div>
      <div className="review-metric"><span className="review-metric-icon is-rating"><FiStar /></span><div><small>{t(locale, "reviews.average")}</small><strong>{average.toFixed(1)}<em>/5</em></strong></div></div>
    </div>}

    {!loading && !error && <div className="reviews-tabs" role="group" aria-label={t(locale, "reviews.filter")}>
      {filters.map(value => <button key={value} type="button" className={filter === value ? "is-active" : ""} aria-pressed={filter === value} onClick={() => setFilter(value)}><span>{t(locale, `reviews.${value}`)}</span><b>{counts[value]}</b></button>)}
    </div>}

    {saveError && <div role="alert" className="reviews-alert"><FiX /> {t(locale, "reviews.failed")}</div>}
    {loading ? <div className="card"><PageLoader /></div> : error ? <div className="card reviews-empty"><EmptyState icon={<FiMessageSquare />} title={t(locale, "reviews.loadError")} sub={t(locale, "reviews.loadErrorSub")} action={<button className="btn btn-secondary" onClick={reload}>{t(locale, "reviews.refresh")}</button>} /></div> : reviews.length === 0 ? <div className="card reviews-empty"><EmptyState icon={<FiMessageSquare />} title={filter === "all" ? t(locale, "reviews.emptyTitle") : t(locale, "reviews.emptyFilterTitle")} sub={filter === "all" ? t(locale, "reviews.emptySub") : t(locale, "reviews.emptyFilterSub")} action={filter !== "all" ? <button className="btn btn-secondary" onClick={() => setFilter("all")}>{t(locale, "reviews.showAll")}</button> : undefined} /></div> : <div className="reviews-list">
      {reviews.map(review => {
        const product = products.get(review.product);
        return <article className="card review-card" key={review.id}>
          <header>
            <div className="review-author"><span>{review.customer_name.trim().slice(0, 1) || "?"}</span><div><strong>{review.customer_name}</strong><small>{dateFormatter.format(new Date(review.created_at))}{review.verified_purchase && <><i>·</i><FiShield /> {t(locale, "reviews.verified")}</>}</small></div></div>
            <span className={`badge ${statusClass(review.status)}`}>{t(locale, `reviews.${review.status}`)}</span>
          </header>
          <div className="review-card-body">
            <div className="review-rating" aria-label={`${review.rating} / 5`}>{Array.from({length: 5}, (_, index) => <FiStar key={index} className={index < review.rating ? "is-filled" : ""} />)}<b>{review.rating.toFixed(1)}</b></div>
            {review.title && <h2>{review.title}</h2>}
            {review.content && <p>{review.content}</p>}
            <Link className="review-product-link" to={`/products/${review.product}`}>{product?.name ?? t(locale, "reviews.product")}</Link>
          </div>
          <footer>
            {review.status !== "published" && <button className="btn btn-primary" disabled={busy !== null} onClick={() => moderate(review, "published")}><FiCheck /> {t(locale, busy === review.id ? "reviews.saving" : "reviews.action_published")}</button>}
            {review.status !== "rejected" && <button className="btn btn-secondary review-reject" disabled={busy !== null} onClick={() => moderate(review, "rejected")}><FiX /> {t(locale, busy === review.id ? "reviews.saving" : "reviews.action_rejected")}</button>}
            {review.status !== "pending" && <button className="btn btn-ghost" disabled={busy !== null} onClick={() => moderate(review, "pending")}><FiClock /> {t(locale, busy === review.id ? "reviews.saving" : "reviews.action_pending")}</button>}
          </footer>
        </article>;
      })}
    </div>}
  </div>;
}
