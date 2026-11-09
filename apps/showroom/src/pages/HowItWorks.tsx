import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { PageTransition } from "../components/PageTransition";
import { useLocale } from "../i18n";
import { getMarketingCopy } from "../marketingCopy";
import { ScrollReveal } from "../motion/ScrollReveal";
import { StaggerContainer, StaggerItem } from "../motion/Stagger";

const pageCopy = {
  en: { eyebrow: "A simple path", title: "From an idea to a store you can run", intro: "TijaraGO guides you through three clear steps. You choose the look, add what you sell, then publish and manage everything from one place.", choose: "Explore designs", pricing: "See pricing", outcome: "What you get", outcomes: ["A storefront shaped around your brand", "Products ready for customers to browse", "One workspace for daily operations"], next: "Ready to see the designs?" },
  fr: { eyebrow: "Un parcours simple", title: "De l’idée à une boutique que vous pouvez gérer", intro: "TijaraGO vous guide en trois étapes claires. Choisissez le style, ajoutez ce que vous vendez, puis publiez et gérez tout au même endroit.", choose: "Explorer les designs", pricing: "Voir les tarifs", outcome: "Ce que vous obtenez", outcomes: ["Une vitrine adaptée à votre marque", "Des produits prêts à être découverts", "Un seul espace pour les opérations quotidiennes"], next: "Prêt à découvrir les designs ?" },
  ar: { eyebrow: "مسار بسيط", title: "من الفكرة إلى متجر يمكنك إدارته", intro: "يرشدك TijaraGO عبر ثلاث خطوات واضحة: اختر الشكل، أضف ما تبيعه، ثم انشر متجرك وأدر كل شيء من مكان واحد.", choose: "استكشف التصاميم", pricing: "شاهد الأسعار", outcome: "ما الذي ستحصل عليه", outcomes: ["واجهة متجر تعكس علامتك", "منتجات جاهزة ليتصفحها العملاء", "مساحة واحدة لإدارة العمل اليومي"], next: "هل أنت جاهز لاستكشاف التصاميم؟" },
} as const;

function StepVisual({ index }: { index: number }) {
  if (index === 0) return <div className="sr-how-visual is-design" aria-hidden="true"><div className="sr-how-window"><span /><span /><span /></div><div className="sr-how-theme-grid"><i /><i className="active" /><i /></div><div className="sr-how-palette"><b /><b /><b /></div></div>;
  if (index === 1) return <div className="sr-how-visual is-catalog" aria-hidden="true"><div className="sr-how-product"><i /><span><b /><b /></span></div><div className="sr-how-product"><i /><span><b /><b /></span></div><div className="sr-how-add">+</div></div>;
  return <div className="sr-how-visual is-launch" aria-hidden="true"><div className="sr-how-status"><i />Live</div><div className="sr-how-chart"><b /><b /><b /><b /></div><div className="sr-how-orders"><span /><span /><span /></div></div>;
}

export default function HowItWorks() {
  const { locale } = useLocale();
  const reducedMotion = useReducedMotion();
  const marketing = getMarketingCopy(locale);
  const copy = pageCopy[locale];
  return <PageTransition>
    <main className="sr-how-page">
      <section className="sr-how-hero">
        <div className="sr-container">
          <motion.span className="sr-membership-kicker" initial={reducedMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>{copy.eyebrow}</motion.span>
          <motion.h1 initial={reducedMotion ? false : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>{copy.title}</motion.h1>
          <motion.p initial={reducedMotion ? false : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>{copy.intro}</motion.p>
          <div className="sr-how-actions"><Link className="sr-btn sr-btn-primary" to="/gallery">{copy.choose}</Link><Link className="sr-btn sr-btn-ghost" to="/pricing">{copy.pricing}</Link></div>
        </div>
      </section>

      <StaggerContainer as="section" className="sr-container sr-how-steps">
        {marketing.how.steps.map(([title, body], index) => <StaggerItem as="article" key={title}>
          <div className="sr-how-step-copy"><span>0{index + 1}</span><h2>{title}</h2><p>{body}</p></div>
          <StepVisual index={index} />
        </StaggerItem>)}
      </StaggerContainer>

      <ScrollReveal as="section" className="sr-how-outcome"><div className="sr-container"><div><span className="sr-membership-kicker">{copy.outcome}</span><h2>{copy.next}</h2></div><ul>{copy.outcomes.map((item) => <li key={item}><span>✓</span>{item}</li>)}</ul><Link className="sr-btn sr-btn-primary" to="/gallery">{copy.choose}</Link></div></ScrollReveal>
    </main>
  </PageTransition>;
}
