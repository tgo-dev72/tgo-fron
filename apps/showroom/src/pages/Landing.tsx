import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import rawManifest from "@manifest?raw";
import { PageTransition } from "../components/PageTransition";
import { useLocale, type Locale } from "../i18n";
import { useAuth } from "../auth/AuthContext";
import { currentDesigns, type Design, type Manifest } from "../lib/designs";
import { getMarketingCopy } from "../marketingCopy";
import { ScrollReveal } from "../motion/ScrollReveal";
import { StaggerContainer, StaggerItem } from "../motion/Stagger";
import { revealViewport } from "../motion/motionTokens";
import { IconExternalLink } from "../components/ShowroomIcons";

const heroStagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.13, delayChildren: 0.12 } },
};

const heroItem = {
  hidden: { opacity: 0, y: 34, scale: 0.985 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.72, ease: [0.22, 1, 0.36, 1] as const } },
};

const THEME_COPY: Record<Locale, Record<string, { description: string; best: string }>> = {
  en: {
    basic: { description: "A clear, adaptable storefront that keeps discovery and checkout simple.", best: "New stores · Mixed catalogs" },
    beauty: { description: "A calm, educational experience for routines, ingredients and care.", best: "Skincare · Cosmetics · Wellness" },
    fashion: { description: "An editorial, image-led storefront with confident variant selection.", best: "Clothing · Footwear · Accessories" },
    electronics: { description: "A structured catalog built for specifications and comparison.", best: "Electronics · Computers · Accessories" },
    nexa: { description: "A refined dark-and-gold experience for modern, curated products.", best: "Technology · Premium lifestyle" },
  },
  fr: {
    basic: { description: "Une vitrine claire et adaptable qui simplifie la découverte et l’achat.", best: "Nouvelles boutiques · Catalogues variés" },
    beauty: { description: "Une expérience calme et pédagogique pour les soins et les ingrédients.", best: "Soin · Cosmétique · Bien-être" },
    fashion: { description: "Une vitrine éditoriale et visuelle avec un choix de variantes limpide.", best: "Mode · Chaussures · Accessoires" },
    electronics: { description: "Un catalogue structuré pour les caractéristiques et la comparaison.", best: "Électronique · Informatique · Accessoires" },
    nexa: { description: "Une expérience noire et dorée pour des produits modernes et choisis.", best: "Technologie · Lifestyle premium" },
  },
  ar: {
    basic: { description: "واجهة واضحة ومرنة تجعل اكتشاف المنتجات وإتمام الطلب بسيطين.", best: "المتاجر الجديدة · الكتالوجات المتنوعة" },
    beauty: { description: "تجربة هادئة وتثقيفية لمنتجات العناية والمكونات والروتين.", best: "العناية · مستحضرات التجميل · الصحة" },
    fashion: { description: "واجهة تحريرية غنية بالصور مع اختيار واضح للمقاسات والألوان.", best: "الملابس · الأحذية · الإكسسوارات" },
    electronics: { description: "كتالوج منظم يسهّل قراءة المواصفات ومقارنة المنتجات.", best: "الإلكترونيات · الحواسيب · الملحقات" },
    nexa: { description: "تجربة راقية بالأسود والذهبي للمنتجات الحديثة المنتقاة.", best: "التقنية · منتجات الحياة الراقية" },
  },
};

export default function Landing() {
  const manifest = JSON.parse(rawManifest) as Manifest;
  const designs = currentDesigns(manifest.designs.filter((design) => design.status === "ready"));
  const { locale } = useLocale();
  const { user } = useAuth();
  const copy = getMarketingCopy(locale);
  const ctaTarget = user ? "/create" : "/signup";
  const reduceMotion = useReducedMotion();
  const [heroReady, setHeroReady] = useState(false);
  const [editorTab, setEditorTab] = useState(0);
  const [workspaceTab, setWorkspaceTab] = useState(0);
  const [languageTab, setLanguageTab] = useState(locale === "ar" ? 2 : locale === "fr" ? 1 : 0);
  const workspaceRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    if (reduceMotion) {
      setHeroReady(true);
      return;
    }
    let timer = 0;
    const frame = window.requestAnimationFrame(() => {
      timer = window.setTimeout(() => setHeroReady(true), 140);
    });
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [reduceMotion]);

  const selectWorkspaceTab = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const count = copy.workspace.tabs.length;
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % count;
    else if (event.key === "ArrowLeft") next = (index - 1 + count) % count;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = count - 1;
    else return;
    event.preventDefault();
    setWorkspaceTab(next);
    workspaceRefs.current[next]?.focus();
  };

  return (
    <PageTransition>
      <section id="product" className="mk-hero" aria-labelledby="mk-hero-title">
        <div className="sr-container mk-hero-grid">
          <motion.div className="mk-hero-copy" variants={heroStagger} initial={reduceMotion ? false : "hidden"} animate={heroReady ? "show" : "hidden"}>
            <motion.p variants={heroItem} className="mk-kicker">{copy.hero.eyebrow}</motion.p>
            <motion.h1 variants={heroItem} id="mk-hero-title">{copy.hero.title}</motion.h1>
            <motion.p variants={heroItem} className="mk-hero-lead">{copy.hero.body}</motion.p>
            <motion.div variants={heroItem} className="mk-actions">
              <Link to={ctaTarget} className="sr-btn sr-btn-primary sr-btn-lg">{copy.hero.primary}<span aria-hidden="true">→</span></Link>
              <a href="#themes" className="sr-btn sr-btn-outline sr-btn-lg">{copy.hero.secondary}</a>
              <Link to="/design/basic/preview" className="sr-btn sr-btn-outline sr-btn-lg">{copy.themes.preview}<IconExternalLink /></Link>
            </motion.div>
            <motion.p variants={heroItem} className="mk-hero-note"><span aria-hidden="true">✓</span>{copy.hero.note}</motion.p>
          </motion.div>

          <motion.div className="mk-hero-product" initial={reduceMotion ? false : { opacity: 0, y: 54, scale: .94 }} animate={heroReady ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 54, scale: .94 }} transition={{ duration: reduceMotion ? 0 : .9, delay: heroReady ? .28 : 0, ease: [0.22, 1, 0.36, 1] }}>
            <div className="mk-browser-frame">
              <div className="mk-browser-bar"><i /><i /><i /><span>{copy.hero.storefront}</span></div>
              <img src="/gallery/current/basic.png" alt={`${designs[0]?.name ?? "Essential"} ${copy.hero.storefront}`} width="1440" height="1080" fetchPriority="high" />
            </div>
          </motion.div>
        </div>
        <StaggerContainer className="sr-container mk-outcomes" aria-label={copy.workspace.title}>
          {copy.outcomes.map(([title, body], index) => <StaggerItem as="article" key={title}><span>0{index + 1}</span><div><h2>{title}</h2><p>{body}</p></div></StaggerItem>)}
        </StaggerContainer>
      </section>

      <ScrollReveal as="section" id="themes" className="mk-section mk-themes" aria-labelledby="mk-themes-title">
        <div className="sr-container">
          <SectionHeading eyebrow={copy.themes.eyebrow} title={copy.themes.title} body={copy.themes.body} id="mk-themes-title" />
          <div className="mk-theme-grid">
            {designs.map((design, index) => <ThemeCard key={design.key} design={design} index={index} locale={locale} copy={copy} />)}
          </div>
          <div className="mk-section-action"><Link to="/gallery" className="sr-btn sr-btn-outline">{copy.themes.all}<span aria-hidden="true">→</span></Link></div>
        </div>
      </ScrollReveal>

      <ScrollReveal as="section" id="how-it-works" className="mk-section mk-how" aria-labelledby="mk-how-title">
        <div className="sr-container">
          <SectionHeading eyebrow={copy.how.eyebrow} title={copy.how.title} id="mk-how-title" />
          <StaggerContainer as="ol" className="mk-steps">
            {copy.how.steps.map(([title, body], index) => <StaggerItem as="li" key={title}><span>{String(index + 1).padStart(2, "0")}</span><div><h3>{title}</h3><p>{body}</p></div></StaggerItem>)}
          </StaggerContainer>
        </div>
      </ScrollReveal>

      <ScrollReveal as="section" className="mk-section mk-editor" aria-labelledby="mk-editor-title" variant="fade-in">
        <div className="sr-container mk-split-heading">
          <SectionHeading eyebrow={copy.editor.eyebrow} title={copy.editor.title} body={copy.editor.body} id="mk-editor-title" />
          <p className="mk-demo-label"><span aria-hidden="true">●</span>{copy.editor.demo}</p>
        </div>
        <ScrollReveal className="sr-container mk-editor-shell" variant="scale">
          <div className="mk-editor-sidebar">
            <strong>{copy.editor.controls}</strong>
            <div className="mk-editor-options">
              {copy.editor.options.map((option, index) => <button type="button" key={option} className={editorTab === index ? "active" : ""} aria-pressed={editorTab === index} onClick={() => setEditorTab(index)}><span>{index + 1}</span><span>{option}<small>{copy.editor.labels[index]}</small></span></button>)}
            </div>
            <p>{copy.editor.publish}</p>
          </div>
          <div className={`mk-editor-preview mk-editor-preview-${editorTab}`}>
            <div className="mk-editor-preview-bar"><span>{copy.editor.preview} — {designs[editorTab]?.name ?? copy.editor.options[editorTab]}</span><i>1440 px</i></div>
            <img key={editorTab} src={`/gallery/current/${["basic", "beauty", "fashion", "electronics"][editorTab]}.png`} alt={`${copy.editor.preview} — ${designs[editorTab]?.name ?? copy.editor.options[editorTab]}`} width="1440" height="1080" loading="lazy" />
          </div>
        </ScrollReveal>
      </ScrollReveal>

      <ScrollReveal as="section" className="mk-section mk-workspace" aria-labelledby="mk-workspace-title">
        <div className="sr-container">
          <div className="mk-split-heading">
            <SectionHeading eyebrow={copy.workspace.eyebrow} title={copy.workspace.title} body={copy.workspace.body} id="mk-workspace-title" />
            <p className="mk-demo-label"><span aria-hidden="true">●</span>{copy.workspace.demo}</p>
          </div>
          <ScrollReveal className="mk-workspace-tour" variant="scale" delay={.08}>
            <div className="mk-tabs" role="tablist" aria-label={copy.workspace.title}>
              {copy.workspace.tabs.map((tab, index) => <button ref={(node) => { workspaceRefs.current[index] = node; }} key={tab} type="button" role="tab" id={`workspace-tab-${index}`} aria-controls="workspace-panel" aria-selected={workspaceTab === index} tabIndex={workspaceTab === index ? 0 : -1} onKeyDown={(event) => selectWorkspaceTab(event, index)} onClick={() => setWorkspaceTab(index)}>{tab}</button>)}
            </div>
            <WorkspacePanel copy={copy} index={workspaceTab} />
          </ScrollReveal>
        </div>
      </ScrollReveal>

      <ScrollReveal as="section" id="languages" className="mk-section mk-languages" aria-labelledby="mk-languages-title" variant="fade-in">
        <div className="sr-container mk-language-grid">
          <ScrollReveal className="mk-language-copy" variant={locale === "ar" ? "slide-left" : "slide-right"}>
            <SectionHeading eyebrow={copy.languages.eyebrow} title={copy.languages.title} body={copy.languages.body} id="mk-languages-title" />
            <p className="mk-language-note"><span aria-hidden="true">Aa</span>{copy.languages.note}</p>
          </ScrollReveal>
          <ScrollReveal className="mk-language-demo" variant={locale === "ar" ? "slide-right" : "slide-left"} delay={.08}>
            <div className="mk-language-tabs" role="tablist" aria-label={copy.languages.eyebrow}>
              {copy.languages.labels.map((label, index) => <button type="button" role="tab" key={label} aria-selected={languageTab === index} className={languageTab === index ? "active" : ""} onClick={() => setLanguageTab(index)}>{label}</button>)}
            </div>
            <div className="mk-language-store" lang={languageTab === 2 ? "ar" : languageTab === 1 ? "fr" : "en"} dir={languageTab === 2 ? "rtl" : "ltr"} role="tabpanel">
              <header><span className="mk-language-brand">NŪR</span><nav aria-label="Demo"><span>{languageTab === 2 ? "الجديد" : languageTab === 1 ? "Nouveautés" : "New"}</span><span>{languageTab === 2 ? "تسوق" : languageTab === 1 ? "Boutique" : "Shop"}</span></nav></header>
              <div><p>{copy.languages.samples[languageTab][0]}</p><h3>{copy.languages.samples[languageTab][1]}</h3><button type="button" tabIndex={-1}>{copy.languages.samples[languageTab][2]}</button></div>
            </div>
          </ScrollReveal>
        </div>
      </ScrollReveal>

      <ScrollReveal as="section" className="mk-section mk-faq" aria-labelledby="mk-faq-title">
        <div className="sr-container mk-faq-grid">
          <SectionHeading eyebrow={copy.faq.eyebrow} title={copy.faq.title} id="mk-faq-title" />
          <StaggerContainer className="mk-faq-list">
            {copy.faq.items.map(([question, answer], index) => <StaggerItem as="details" key={question} open={index === 0}><summary>{question}<span aria-hidden="true">+</span></summary><p>{answer}</p></StaggerItem>)}
          </StaggerContainer>
        </div>
      </ScrollReveal>

      <ScrollReveal as="section" className="mk-final" aria-labelledby="mk-final-title" variant="fade-in">
        <div className="sr-container"><p className="mk-kicker">{copy.final.eyebrow}</p><h2 id="mk-final-title">{copy.final.title}</h2><p>{copy.final.body}</p><div className="mk-actions"><Link to={ctaTarget} className="sr-btn sr-btn-primary sr-btn-lg">{copy.final.cta}<span aria-hidden="true">→</span></Link><Link to="/gallery" className="sr-btn sr-btn-outline sr-btn-lg">{copy.final.themes}</Link></div></div>
      </ScrollReveal>
    </PageTransition>
  );
}

function SectionHeading({ eyebrow, title, body, id }: { eyebrow: string; title: string; body?: string; id: string }) {
  return <ScrollReveal as="header" className="mk-section-heading"><p className="mk-kicker">{eyebrow}</p><h2 id={id}>{title}</h2>{body && <p>{body}</p>}</ScrollReveal>;
}

function ThemeCard({ design, index, locale, copy }: { design: Design; index: number; locale: Locale; copy: ReturnType<typeof getMarketingCopy> }) {
  const text = THEME_COPY[locale][design.key] ?? THEME_COPY.en.basic;
  return <ScrollReveal as="article" className={`mk-theme-card mk-theme-${design.key}`} variant="scale" delay={Math.min(index * .09, .32)} viewport={revealViewport}>
    <Link to={`/design/${design.key}`} className="mk-theme-image" aria-label={`${copy.themes.preview}: ${design.name}`}><img src={`/gallery/current/${design.key}.png`} alt={`${design.name} storefront preview`} width="1440" height="1080" loading="lazy" /><span>{design.tier === "premium" ? copy.themes.premium : copy.themes.standard}</span></Link>
    <div className="mk-theme-body"><div><p>{copy.themes.suits}</p><h3>{design.name}</h3></div><p>{text.description}</p><small>{text.best}</small><div className="mk-theme-actions"><Link to={`/design/${design.key}/preview`}>{copy.themes.preview}<IconExternalLink /></Link><Link to={`/create?design=${encodeURIComponent(design.key)}`}>{copy.themes.create}<span aria-hidden="true">→</span></Link></div></div>
  </ScrollReveal>;
}

function WorkspacePanel({ copy, index }: { copy: ReturnType<typeof getMarketingCopy>; index: number }) {
  const [title, body, ...rows] = copy.workspace.items[index];
  return <div id="workspace-panel" className="mk-workspace-panel" role="tabpanel" aria-labelledby={`workspace-tab-${index}`}>
    <div className="mk-workspace-story"><span>0{index + 1}</span><h3>{title}</h3><p>{body}</p></div>
    <div className="mk-workspace-ui" aria-hidden="true"><div className="mk-ui-top"><i /><strong>{copy.workspace.tabs[index]}</strong><b>+</b></div>{rows.map((row, rowIndex) => <div className="mk-ui-row" key={row}><i className={`tone-${rowIndex}`} /><span>{row}</span><em /></div>)}</div>
  </div>;
}
