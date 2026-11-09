import type { Locale } from "./i18n";

export type MarketingCopy = typeof marketingCopy.en;

export const marketingCopy = {
  en: {
    nav: { product: "Product", themes: "Themes", how: "How it works", previewer: "Previewer", pricing: "Pricing", login: "Log in", cta: "Create your store" },
    hero: {
      eyebrow: "Your store, built around your brand",
      title: "Your brand. Your online store. One place to run it.",
      body: "Build a multilingual storefront, manage products and orders, and stay connected with customers through TijaraGO.",
      primary: "Create your store", secondary: "Explore themes",
      note: "Designed for merchants ready to move beyond social-only selling.",
      storefront: "Live storefront", workspace: "Merchant workspace", workspaceNote: "Illustrative workspace preview",
    },
    outcomes: [
      ["Launch with your identity", "Choose a storefront, apply your brand and preview every change before publication."],
      ["Make buying feel effortless", "Give customers a clear journey across products, variants, cart and checkout."],
      ["Run the business in one place", "Keep products, orders, customers, campaigns and conversations together."],
    ],
    themes: {
      eyebrow: "Storefront collection", title: "A design for how you sell", body: "Every family is a distinct shopping experience—not the same template in another color.",
      standard: "Standard", premium: "Premium", preview: "Preview theme", create: "Create with this theme", all: "View all themes", suits: "Best for",
    },
    how: {
      eyebrow: "From idea to storefront", title: "A guided path to your own store",
      steps: [
        ["Choose a design and add your brand", "Start from a storefront built for your type of catalog, then set your logo, colors and identity."],
        ["Add products and shape your pages", "Build the catalog, organize collections and arrange the sections customers will explore."],
        ["Publish and manage the business", "Use the guided launch flow, then handle daily operations from your workspace."],
      ],
    },
    editor: {
      eyebrow: "Visual storefront editor", title: "See the store take shape before you publish", body: "Control the elements customers see, with a preview beside your settings.",
      demo: "Interactive demonstration — changes are not saved", preview: "Store preview", controls: "Design controls",
      options: ["Brand", "Homepage", "Collections", "Languages"],
      labels: ["Logo, colors & type", "Banners & section order", "Product sections", "Navigation & content"],
      publish: "Preview and publication stay separate, so you can review your work first.",
    },
    workspace: {
      eyebrow: "One connected workspace", title: "The work behind your storefront, organized", body: "Move from fulfillment to customer conversations without piecing together a different tool for every task.",
      demo: "Illustrative product tour",
      tabs: ["Products", "Orders", "Marketing", "Mailbox", "Analytics", "Team"],
      items: [
        ["Products and inventory", "Manage products, variants and stock from one catalog view.", "Catalog", "Variants", "Inventory status"],
        ["Orders and customers", "Follow orders and keep customer details close to the work.", "New orders", "Fulfillment", "Customers"],
        ["Marketing and discounts", "Create coupons and newsletter campaigns from the same workspace.", "Coupons", "Campaigns", "Audience"],
        ["Customer conversations", "Read and answer store messages in the integrated mailbox using your TijaraGO mail alias.", "Inbox", "Sent", "Conversations"],
        ["Business analytics", "Read the signals that help you understand store activity and make better decisions.", "Performance", "Products", "Orders"],
        ["Team access", "Add staff and control permissions as responsibilities grow.", "Members", "Roles", "Permissions"],
      ],
    },
    languages: {
      eyebrow: "Multilingual commerce", title: "Speak to customers in the language they use", body: "Present store navigation and content in English, French and Arabic, with a native right-to-left layout for Arabic.",
      note: "You remain in control of the content for each language.", labels: ["English", "Français", "العربية"],
      samples: [
        ["New collection", "Designed for everyday rituals.", "Shop the collection"],
        ["Nouvelle collection", "Pensée pour vos rituels quotidiens.", "Voir la collection"],
        ["تشكيلة جديدة", "مصمّمة لتفاصيل كل يوم.", "اكتشف التشكيلة"],
      ],
    },
    faq: {
      eyebrow: "Questions before you begin", title: "The essentials, clearly answered",
      items: [
        ["Do I need coding knowledge?", "No coding is required for the guided store setup and visual customization workflow."],
        ["Can I customize my storefront?", "Yes. You can control brand elements, homepage content, navigation, collections and the settings supported by your chosen design."],
        ["Does TijaraGO support Arabic and RTL?", "Yes. Storefronts support English, French and Arabic, including right-to-left presentation for Arabic."],
        ["Can I manage orders and inventory?", "Yes. The merchant workspace includes catalog, variants, stock, orders and customer management."],
        ["Which themes are available?", "The current collection includes Essential, Beauty, Fashion, Electronics and NEXA. Theme access depends on the selected plan."],
        ["How do payments work?", "Stores can support cash on delivery and online payments when those methods are enabled in the production configuration."],
        ["What is included in each plan?", "Plan prices and included benefits come directly from the current TijaraGO plan catalog. Review the pricing section for the authoritative details."],
      ],
    },
    final: { eyebrow: "Ready when you are", title: "Build a storefront that finally feels like your business.", body: "Choose your design, bring your catalog and run the next chapter from one workspace.", cta: "Create your store", themes: "Explore themes" },
    footer: { summary: "A commerce platform for building a branded store and running the business behind it.", product: "Product", explore: "Explore", account: "Account", productLinks: ["Store builder", "Operations workspace", "Multilingual commerce"], gallery: "Themes", pricing: "Pricing", login: "Log in", signup: "Create your store", support: "Support", privacy: "Privacy", terms: "Terms", rights: "TijaraGO. All rights reserved." },
  },
  fr: {
    nav: { product: "Produit", themes: "Thèmes", how: "Comment ça marche", previewer: "Aperçus", pricing: "Tarifs", login: "Connexion", cta: "Créer ma boutique" },
    hero: { eyebrow: "Votre boutique, pensée pour votre marque", title: "Votre marque. Votre boutique. Un seul espace pour tout gérer.", body: "Créez une vitrine multilingue, gérez vos produits et commandes, et restez proche de vos clients avec TijaraGO.", primary: "Créer ma boutique", secondary: "Explorer les thèmes", note: "Pour les commerçants prêts à aller au-delà de la vente uniquement sur les réseaux sociaux.", storefront: "Boutique en ligne", workspace: "Espace marchand", workspaceNote: "Aperçu illustratif de l’espace" },
    outcomes: [["Lancez votre propre univers", "Choisissez une vitrine, appliquez votre identité et prévisualisez chaque changement avant publication."], ["Simplifiez le parcours d’achat", "Offrez un parcours clair des produits et variantes jusqu’au panier et au paiement."], ["Pilotez tout au même endroit", "Réunissez produits, commandes, clients, campagnes et conversations."]],
    themes: { eyebrow: "Collection de vitrines", title: "Un design adapté à votre façon de vendre", body: "Chaque famille propose une véritable expérience d’achat, pas le même modèle recoloré.", standard: "Standard", premium: "Premium", preview: "Prévisualiser", create: "Créer avec ce thème", all: "Voir tous les thèmes", suits: "Idéal pour" },
    how: { eyebrow: "De l’idée à la boutique", title: "Un parcours guidé vers votre propre boutique", steps: [["Choisissez un design et ajoutez votre marque", "Partez d’une vitrine adaptée à votre catalogue, puis configurez logo, couleurs et identité."], ["Ajoutez vos produits et composez vos pages", "Construisez le catalogue, organisez les collections et agencez les sections visibles par vos clients."], ["Publiez et gérez votre activité", "Suivez le lancement guidé, puis gérez les opérations quotidiennes depuis votre espace."]] },
    editor: { eyebrow: "Éditeur visuel", title: "Voyez votre boutique prendre forme avant publication", body: "Contrôlez les éléments visibles par vos clients avec l’aperçu juste à côté.", demo: "Démonstration interactive — aucune modification n’est enregistrée", preview: "Aperçu boutique", controls: "Réglages du design", options: ["Marque", "Accueil", "Collections", "Langues"], labels: ["Logo, couleurs et typo", "Bannières et ordre des sections", "Sections produits", "Navigation et contenus"], publish: "Prévisualisation et publication restent séparées pour vous laisser le temps de vérifier." },
    workspace: { eyebrow: "Un espace connecté", title: "Tout le travail derrière la boutique, bien organisé", body: "Passez de la préparation des commandes aux échanges clients sans multiplier les outils.", demo: "Visite produit illustrative", tabs: ["Produits", "Commandes", "Marketing", "Messagerie", "Analyses", "Équipe"], items: [["Produits et stock", "Gérez produits, variantes et stock depuis une vue catalogue unique.", "Catalogue", "Variantes", "État du stock"], ["Commandes et clients", "Suivez les commandes et gardez les informations clients à portée de main.", "Nouvelles commandes", "Traitement", "Clients"], ["Marketing et remises", "Créez des coupons et campagnes newsletter depuis le même espace.", "Coupons", "Campagnes", "Audience"], ["Conversations clients", "Lisez et répondez aux messages dans la messagerie intégrée avec votre alias TijaraGO.", "Réception", "Envoyés", "Conversations"], ["Analyse de l’activité", "Lisez les signaux utiles pour comprendre l’activité de la boutique.", "Performance", "Produits", "Commandes"], ["Accès équipe", "Ajoutez des collaborateurs et contrôlez leurs permissions.", "Membres", "Rôles", "Permissions"]] },
    languages: { eyebrow: "Commerce multilingue", title: "Parlez à vos clients dans leur langue", body: "Présentez navigation et contenus en anglais, français et arabe, avec une vraie mise en page de droite à gauche pour l’arabe.", note: "Vous gardez le contrôle du contenu de chaque langue.", labels: ["English", "Français", "العربية"], samples: [["New collection", "Designed for everyday rituals.", "Shop the collection"], ["Nouvelle collection", "Pensée pour vos rituels quotidiens.", "Voir la collection"], ["تشكيلة جديدة", "مصمّمة لتفاصيل كل يوم.", "اكتشف التشكيلة"]] },
    faq: { eyebrow: "Avant de commencer", title: "L’essentiel, en toute clarté", items: [["Faut-il savoir coder ?", "Non. La création guidée et la personnalisation visuelle ne demandent pas de code."], ["Puis-je personnaliser ma boutique ?", "Oui. Vous pouvez régler l’identité, l’accueil, la navigation, les collections et les options prévues par votre design."], ["L’arabe et le RTL sont-ils pris en charge ?", "Oui. Les vitrines prennent en charge l’anglais, le français et l’arabe, avec une présentation de droite à gauche en arabe."], ["Puis-je gérer commandes et stock ?", "Oui. L’espace marchand regroupe catalogue, variantes, stock, commandes et clients."], ["Quels thèmes sont disponibles ?", "La collection actuelle comprend Essential, Beauty, Fashion, Electronics et NEXA. L’accès dépend du plan choisi."], ["Comment fonctionnent les paiements ?", "La boutique peut accepter le paiement à la livraison et le paiement en ligne lorsque ces moyens sont activés en production."], ["Que comprend chaque plan ?", "Les tarifs et avantages proviennent directement du catalogue TijaraGO actuel. Consultez la section tarifs pour les informations de référence."]] },
    final: { eyebrow: "Prêt quand vous l’êtes", title: "Créez une boutique qui ressemble enfin à votre entreprise.", body: "Choisissez votre design, ajoutez votre catalogue et gérez la suite depuis un seul espace.", cta: "Créer ma boutique", themes: "Explorer les thèmes" },
    footer: { summary: "Une plateforme commerce pour créer une boutique de marque et gérer l’activité qui l’anime.", product: "Produit", explore: "Explorer", account: "Compte", productLinks: ["Créateur de boutique", "Espace opérations", "Commerce multilingue"], gallery: "Thèmes", pricing: "Tarifs", login: "Connexion", signup: "Créer ma boutique", support: "Assistance", privacy: "Confidentialité", terms: "Conditions", rights: "TijaraGO. Tous droits réservés." },
  },
  ar: {
    nav: { product: "المنتج", themes: "التصاميم", how: "كيف يعمل", previewer: "المعاينة", pricing: "الأسعار", login: "تسجيل الدخول", cta: "أنشئ متجرك" },
    hero: { eyebrow: "متجرك مصمم حول علامتك", title: "علامتك. متجرك الإلكتروني. مكان واحد لإدارة كل شيء.", body: "أنشئ واجهة متجر متعددة اللغات، وأدر المنتجات والطلبات، وابقَ قريباً من عملائك عبر TijaraGO.", primary: "أنشئ متجرك", secondary: "استكشف التصاميم", note: "للتجار المستعدين للانتقال من البيع عبر الشبكات الاجتماعية إلى متجرهم الخاص.", storefront: "واجهة المتجر", workspace: "مساحة التاجر", workspaceNote: "عرض توضيحي لمساحة العمل" },
    outcomes: [["أطلق متجراً بهويتك", "اختر واجهة، أضف علامتك وعاين كل تغيير قبل النشر."], ["قدّم تجربة شراء واضحة", "امنح عملاءك مساراً سلساً من المنتجات والخيارات إلى السلة وإتمام الطلب."], ["أدر عملك من مكان واحد", "اجمع المنتجات والطلبات والعملاء والحملات والمحادثات في مساحة واحدة."]],
    themes: { eyebrow: "مجموعة واجهات المتاجر", title: "تصميم يناسب طريقة بيعك", body: "لكل عائلة تجربة تسوق خاصة، وليست القالب نفسه بلون مختلف.", standard: "قياسي", premium: "مميز", preview: "معاينة التصميم", create: "أنشئ بهذا التصميم", all: "عرض كل التصاميم", suits: "مناسب لـ" },
    how: { eyebrow: "من الفكرة إلى المتجر", title: "مسار واضح لإنشاء متجرك", steps: [["اختر تصميماً وأضف علامتك", "ابدأ بواجهة تناسب نوع كتالوجك، ثم أضف الشعار والألوان والهوية."], ["أضف المنتجات ونسّق الصفحات", "أنشئ الكتالوج، ونظّم المجموعات، ورتّب الأقسام التي سيشاهدها العملاء."], ["انشر وأدر نشاطك", "اتبع خطوات الإطلاق الموجهة، ثم تولّ العمليات اليومية من مساحة العمل."]] },
    editor: { eyebrow: "محرر مرئي للمتجر", title: "شاهد متجرك يتشكل قبل النشر", body: "تحكم في العناصر التي يراها العملاء، مع معاينة مباشرة بجوار الإعدادات.", demo: "عرض تفاعلي توضيحي — لا يتم حفظ التغييرات", preview: "معاينة المتجر", controls: "إعدادات التصميم", options: ["العلامة", "الرئيسية", "المجموعات", "اللغات"], labels: ["الشعار والألوان والخط", "اللافتات وترتيب الأقسام", "أقسام المنتجات", "التنقل والمحتوى"], publish: "المعاينة والنشر مرحلتان منفصلتان كي تراجع عملك أولاً." },
    workspace: { eyebrow: "مساحة عمل متصلة", title: "كل ما وراء متجرك، منظّم", body: "انتقل من تجهيز الطلبات إلى محادثات العملاء دون الحاجة إلى أداة مختلفة لكل مهمة.", demo: "جولة توضيحية في المنتج", tabs: ["المنتجات", "الطلبات", "التسويق", "البريد", "التحليلات", "الفريق"], items: [["المنتجات والمخزون", "أدر المنتجات والخيارات والمخزون من عرض كتالوج واحد.", "الكتالوج", "الخيارات", "حالة المخزون"], ["الطلبات والعملاء", "تابع الطلبات واجعل بيانات العملاء قريبة من العمل.", "طلبات جديدة", "التجهيز", "العملاء"], ["التسويق والتخفيضات", "أنشئ القسائم وحملات النشرات من مساحة العمل نفسها.", "القسائم", "الحملات", "الجمهور"], ["محادثات العملاء", "اقرأ رسائل المتجر وأجب عنها في البريد المدمج عبر عنوان TijaraGO الخاص بك.", "الوارد", "المرسل", "المحادثات"], ["تحليلات النشاط", "اقرأ المؤشرات التي تساعدك على فهم نشاط المتجر واتخاذ قرارات أفضل.", "الأداء", "المنتجات", "الطلبات"], ["صلاحيات الفريق", "أضف الموظفين وحدد الصلاحيات مع نمو المسؤوليات.", "الأعضاء", "الأدوار", "الصلاحيات"]] },
    languages: { eyebrow: "تجارة متعددة اللغات", title: "تحدث مع عملائك باللغة التي يستخدمونها", body: "اعرض التنقل والمحتوى بالإنجليزية والفرنسية والعربية، مع تخطيط أصيل من اليمين إلى اليسار للعربية.", note: "أنت من يتحكم في محتوى كل لغة.", labels: ["English", "Français", "العربية"], samples: [["New collection", "Designed for everyday rituals.", "Shop the collection"], ["Nouvelle collection", "Pensée pour vos rituels quotidiens.", "Voir la collection"], ["تشكيلة جديدة", "مصمّمة لتفاصيل كل يوم.", "اكتشف التشكيلة"]] },
    faq: { eyebrow: "أسئلة قبل البداية", title: "المهم، بإجابات واضحة", items: [["هل أحتاج إلى معرفة البرمجة؟", "لا. لا يتطلب إعداد المتجر الموجه والتخصيص المرئي كتابة الكود."], ["هل يمكنني تخصيص واجهة متجري؟", "نعم. يمكنك التحكم في الهوية والصفحة الرئيسية والتنقل والمجموعات والإعدادات التي يدعمها تصميمك."], ["هل يدعم العربية واتجاه RTL؟", "نعم. تدعم الواجهات الإنجليزية والفرنسية والعربية، مع عرض من اليمين إلى اليسار للعربية."], ["هل يمكنني إدارة الطلبات والمخزون؟", "نعم. تضم مساحة التاجر الكتالوج والخيارات والمخزون والطلبات والعملاء."], ["ما التصاميم المتاحة؟", "تضم المجموعة الحالية Essential وBeauty وFashion وElectronics وNEXA. يعتمد الوصول إلى التصاميم على الخطة المختارة."], ["كيف تعمل المدفوعات؟", "يمكن للمتاجر دعم الدفع عند الاستلام والدفع الإلكتروني عند تفعيل هذه الوسائل في إعدادات الإنتاج."], ["ماذا تتضمن كل خطة؟", "تأتي الأسعار والمزايا مباشرة من كتالوج خطط TijaraGO الحالي. راجع قسم الأسعار للتفاصيل المعتمدة."]] },
    final: { eyebrow: "جاهزون عندما تكون جاهزاً", title: "أنشئ متجراً يعكس نشاطك فعلاً.", body: "اختر تصميمك، أضف كتالوجك وأدر المرحلة القادمة من مساحة واحدة.", cta: "أنشئ متجرك", themes: "استكشف التصاميم" },
    footer: { summary: "منصة تجارة لبناء متجر بهوية علامتك وإدارة النشاط من خلفه.", product: "المنتج", explore: "استكشف", account: "الحساب", productLinks: ["منشئ المتجر", "مساحة العمليات", "تجارة متعددة اللغات"], gallery: "التصاميم", pricing: "الأسعار", login: "تسجيل الدخول", signup: "أنشئ متجرك", support: "الدعم", privacy: "الخصوصية", terms: "الشروط", rights: "TijaraGO. جميع الحقوق محفوظة." },
  },
} satisfies Record<Locale, unknown>;

export function getMarketingCopy(locale: Locale): MarketingCopy {
  return marketingCopy[locale] as MarketingCopy;
}
