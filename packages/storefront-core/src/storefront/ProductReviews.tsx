import { useEffect, useState, type FormEvent } from "react";
import { api, ApiError, type ProductReview } from "../api/client";
import { t, type Locale } from "../i18n";

export function ProductReviews({ slug, locale, readOnly = false }: { slug: string; locale: Locale; readOnly?: boolean }) {
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<"sent" | "failed" | "limited" | "">("");
  useEffect(() => {
    let active = true;
    setLoading(true); setLoadError(false); setReviews([]);
    api.getProductReviews(slug).then(value => { if (active) setReviews(value); })
      .catch(() => { if (active) setLoadError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [slug, reload]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true); setResult("");
    try {
      await api.submitProductReview(slug, {
        customer_name: String(data.get("customer_name") ?? "").trim(),
        rating: Number(data.get("rating")), title: String(data.get("title") ?? "").trim(),
        content: String(data.get("content") ?? "").trim(),
      });
      form.reset(); setResult("sent");
    } catch (error) { setResult(error instanceof ApiError && error.status === 429 ? "limited" : "failed"); }
    finally { setBusy(false); }
  }

  return <section className="sf-product-reviews" aria-label={t(locale, "reviews.title")}>
    <h2>{t(locale, "reviews.title")}</h2>
    {loading ? <p role="status">{t(locale, "reviews.loading")}</p> : loadError ? <p role="alert">{t(locale, "reviews.loadFailed")} <button className="ds-btn ds-btn-secondary" onClick={() => setReload(value => value + 1)}>{t(locale, "reviews.retry")}</button></p> : reviews.length === 0 ? <p>{t(locale, "reviews.empty")}</p> : <div className="sf-product-review-list">
      {reviews.map(review => <article key={review.id}>
        <div><strong>{review.customer_name}</strong><span>{review.rating} / 5</span></div>
        {review.title && <h3>{review.title}</h3>}
        {review.content && <p>{review.content}</p>}
      </article>)}
    </div>}
    {!readOnly && <details>
      <summary>{t(locale, "reviews.write")}</summary>
      <p>{t(locale, "reviews.moderation")}</p>
      <form onSubmit={submit}>
        <fieldset disabled={busy}>
          <label>{t(locale, "reviews.name")}<input name="customer_name" autoComplete="name" required maxLength={100} /></label>
          <label>{t(locale, "reviews.rating")}<select name="rating" defaultValue="" required><option value="" disabled>{t(locale, "reviews.chooseRating")}</option>{[5,4,3,2,1].map(value => <option key={value} value={value}>{value} / 5</option>)}</select></label>
          <label>{t(locale, "reviews.reviewTitle")}<input name="title" maxLength={160} /></label>
          <label>{t(locale, "reviews.content")}<textarea name="content" rows={4} maxLength={5000} /></label>
          <button type="submit" className="ds-btn ds-btn-primary">{t(locale, busy ? "reviews.sending" : "reviews.submit")}</button>
        </fieldset>
        {result && <p role={result === "sent" ? "status" : "alert"}>{t(locale, `reviews.${result}`)}</p>}
      </form>
    </details>}
  </section>;
}
