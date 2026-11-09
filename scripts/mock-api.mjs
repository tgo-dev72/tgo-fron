#!/usr/bin/env node
/**
 * Mock store-platform API for local design development.
 *
 * Implements the exact backend contract the storefront-core client and
 * CheckoutService consume, so every design app renders a LIVE catalog,
 * run a real order+payment flow and subscribe to newsletters — without a
 * Django instance running.
 *
 *   GET  /api/catalog/sections/
 *   GET  /api/catalog/products/            (?section=<key>)
 *   GET  /api/catalog/products/:id/stock/
 *   GET  /api/storefront/config/           runtime storefront config (Option A)
 *   POST /api/subscribe/                   { email }
 *   POST /api/orders/                      { payment_mode, customer, items }
 *   GET  /api/orders/:id/
 *   POST /api/payments/                    { order_id, tokenParams }
 *   POST /api/payments/verify/             { order_id }
 *   POST /api/payments/cancel/             { order_id }
 *   POST /api/payments/retry/              { order_id, tokenParams }
 *   GET  /mock-pay?order_id=&success_url=  hosted payment gateway page
 *
 * All endpoints are CORS-open and JSON; latency is faked per request.
 *
 *   npm run mock:api
 */
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createHash, randomBytes } from "node:crypto";
import { themeCatalog } from "./mock-theme-catalog.mjs";

const PORT = Number(process.env.MOCK_API_PORT ?? 8090);

/* ------------------------------------------------------------------ */
/* deterministic seeding                                              */
/* ------------------------------------------------------------------ */

function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260809);

/* ------------------------------------------------------------------ */
/* seed catalog                                                        */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* seed catalog (trilingual)                                          */
/* ------------------------------------------------------------------ */

const LANGS = ["en", "fr", "ar"];

/** Pick the localized value for a field shaped as { en, fr, ar }. */
function l10n(lang, obj) {
  if (!obj || typeof obj !== "object") return obj;
  return obj[lang] ?? obj.en;
}

/** Normalize an Accept-Language header to one of our supported locales. */
function acceptLang(header) {
  if (!header) return "en";
  const primary = String(header).split(",")[0].trim().split(";")[0].toLowerCase();
  return LANGS.includes(primary) ? primary : "en";
}

const SECTIONS = [
  {
    id: 1,
    key: "men",
    label: { en: "Men", fr: "Hommes", ar: "رجال" },
    icon: "shirt",
    sort_order: 1,
    attribute_defs: [
      {
        id: 101,
        key: "size",
        label: { en: "Size", fr: "Taille", ar: "المقاس" },
        type: "select",
        options: [
          { value: "XS", labels: { en: "XS", fr: "XS", ar: "XS" } },
          { value: "S", labels: { en: "S", fr: "S", ar: "S" } },
          { value: "M", labels: { en: "M", fr: "M", ar: "M" } },
          { value: "L", labels: { en: "L", fr: "L", ar: "L" } },
          { value: "XL", labels: { en: "XL", fr: "XL", ar: "XL" } },
        ],
        required: true,
        sort_order: 1,
      },
      {
        id: 102,
        key: "color",
        label: { en: "Color", fr: "Couleur", ar: "اللون" },
        type: "color",
        options: [
          { value: "Black", labels: { en: "Black", fr: "Noir", ar: "أسود" } },
          { value: "Navy", labels: { en: "Navy", fr: "Bleu marine", ar: "كحلي" } },
          { value: "Olive", labels: { en: "Olive", fr: "Olive", ar: "زيتي" } },
          { value: "Wheat", labels: { en: "Wheat", fr: "Blé", ar: "قمحي" } },
        ],
        required: true,
        sort_order: 2,
      },
      {
        id: 103,
        key: "material",
        label: { en: "Material", fr: "Matière", ar: "الخامة" },
        type: "select",
        options: [
          { value: "Cotton", labels: { en: "Cotton", fr: "Coton", ar: "قطن" } },
          { value: "Linen", labels: { en: "Linen", fr: "Lin", ar: "كتان" } },
          { value: "Wool", labels: { en: "Wool", fr: "Laine", ar: "صوف" } },
          { value: "Denim", labels: { en: "Denim", fr: "Denim", ar: "دنم" } },
        ],
        required: false,
        sort_order: 3,
      },
    ],
  },
  {
    id: 2,
    key: "women",
    label: { en: "Women", fr: "Femmes", ar: "نساء" },
    icon: "dress",
    sort_order: 2,
    attribute_defs: [
      {
        id: 201,
        key: "size",
        label: { en: "Size", fr: "Taille", ar: "المقاس" },
        type: "select",
        options: [
          { value: "XS", labels: { en: "XS", fr: "XS", ar: "XS" } },
          { value: "S", labels: { en: "S", fr: "S", ar: "S" } },
          { value: "M", labels: { en: "M", fr: "M", ar: "M" } },
          { value: "L", labels: { en: "L", fr: "L", ar: "L" } },
          { value: "XL", labels: { en: "XL", fr: "XL", ar: "XL" } },
        ],
        required: true,
        sort_order: 1,
      },
      {
        id: 202,
        key: "color",
        label: { en: "Color", fr: "Couleur", ar: "اللون" },
        type: "color",
        options: [
          { value: "Black", labels: { en: "Black", fr: "Noir", ar: "أسود" } },
          { value: "Bordeaux", labels: { en: "Bordeaux", fr: "Bordeaux", ar: "بوردو" } },
          { value: "Blush", labels: { en: "Blush", fr: "Rose poudré", ar: "وردي فاتح" } },
          { value: "Ivory", labels: { en: "Ivory", fr: "Ivoire", ar: "عاجي" } },
        ],
        required: true,
        sort_order: 2,
      },
      {
        id: 203,
        key: "fit",
        label: { en: "Fit", fr: "Coupe", ar: "القَصّة" },
        type: "select",
        options: [
          { value: "Slim", labels: { en: "Slim", fr: "Ajusté", ar: "ضيّق" } },
          { value: "Regular", labels: { en: "Regular", fr: "Régulier", ar: "عادي" } },
          { value: "Relaxed", labels: { en: "Relaxed", fr: "Ample", ar: "واسع" } },
        ],
        required: false,
        sort_order: 3,
      },
    ],
  },
  {
    id: 3,
    key: "accessories",
    label: { en: "Accessories", fr: "Accessoires", ar: "إكسسوارات" },
    icon: "cap",
    sort_order: 3,
    attribute_defs: [
      {
        id: 301,
        key: "color",
        label: { en: "Color", fr: "Couleur", ar: "اللون" },
        type: "color",
        options: [
          { value: "Black", labels: { en: "Black", fr: "Noir", ar: "أسود" } },
          { value: "Tan", labels: { en: "Tan", fr: "Brun", ar: "بني" } },
          { value: "Navy", labels: { en: "Navy", fr: "Bleu marine", ar: "كحلي" } },
          { value: "Camel", labels: { en: "Camel", fr: "Chameau", ar: "جملي" } },
        ],
        required: true,
        sort_order: 1,
      },
      {
        id: 302,
        key: "material",
        label: { en: "Material", fr: "Matière", ar: "الخامة" },
        type: "select",
        options: [
          { value: "Leather", labels: { en: "Leather", fr: "Cuir", ar: "جلد" } },
          { value: "Canvas", labels: { en: "Canvas", fr: "Toile", ar: "كانفاس" } },
          { value: "Wool", labels: { en: "Wool", fr: "Laine", ar: "صوف" } },
          { value: "Metal", labels: { en: "Metal", fr: "Métal", ar: "معدن" } },
        ],
        required: false,
        sort_order: 2,
      },
    ],
  },
  {
    id: 4,
    key: "kids",
    label: { en: "Kids", fr: "Enfants", ar: "أطفال" },
    icon: "kid",
    sort_order: 4,
    attribute_defs: [
      {
        id: 401,
        key: "size",
        label: { en: "Size", fr: "Taille", ar: "المقاس" },
        type: "select",
        options: [
          { value: "2Y", labels: { en: "2Y", fr: "2Y", ar: "2Y" } },
          { value: "4Y", labels: { en: "4Y", fr: "4Y", ar: "4Y" } },
          { value: "6Y", labels: { en: "6Y", fr: "6Y", ar: "6Y" } },
          { value: "8Y", labels: { en: "8Y", fr: "8Y", ar: "8Y" } },
          { value: "10Y", labels: { en: "10Y", fr: "10Y", ar: "10Y" } },
        ],
        required: true,
        sort_order: 1,
      },
      {
        id: 402,
        key: "color",
        label: { en: "Color", fr: "Couleur", ar: "اللون" },
        type: "color",
        options: [
          { value: "Sky", labels: { en: "Sky", fr: "Bleu ciel", ar: "سماوي" } },
          { value: "Mint", labels: { en: "Mint", fr: "Menthe", ar: "نعناعي" } },
          { value: "Coral", labels: { en: "Coral", fr: "Corail", ar: "مرجاني" } },
          { value: "Lemon", labels: { en: "Lemon", fr: "Citron", ar: "ليموني" } },
        ],
        required: true,
        sort_order: 2,
      },
    ],
  },
];

// [sectionId, ref, localizedName, localizedDescription, basePrice, promo, loyalty, rating, reviews]
const PRODUCT_SEEDS = [
  [
    1, "MN-101",
    { en: "Garment-Dyed Oversized Tee", fr: "T-shirt oversize teinté en pièce", ar: "تيشيرت أفرسايز صبغ قطعة كاملة" },
    { en: "Heavyweight cotton, garment-dyed so the colour stays soft after washing. Dropped shoulder, clean rib collar — a fit that's meant to be lived in.",
      fr: "Coton lourd teinté en pièce, pour une couleur qui reste douce au lavage. Épaule tombée, col côtelé propre — une coupe faite pour la vie de tous les jours.",
      ar: "قطن ثقيل صُبغ كقطعة كاملة ليبقى لونه ناعمًا بعد الغسيل. كتف ساقط وياقة مضلعة نظيفة — مقاس يُعاش فيه." },
    180, 0, 10, 4.8, 214,
  ],
  [
    1, "MN-102",
    { en: "Selvedge Denim Jacket", fr: "Veste denim selvedge", ar: "سترة دنم سلفيدج" },
    { en: "Japanese selvedge denim with copper rivets that patina as you wear it. Fades your way — no two jackets age the same.",
      fr: "Denim selvedge japonais et rivets en cuivre qui patinent à l'usage. Déperle à votre façon — aucune veste ne vieillit pareil.",
      ar: "دنم سلفيدج ياباني ومسامير نحاسية تكتسب لونًا مع الاستخدام. البهتان على طريقتك — لا تشيخ سترتان بنفس الطريقة." },
    1200, 15, 20, 4.9, 97,
  ],
  [
    1, "MN-103",
    { en: "Merino Crewneck", fr: "Col rond en mérinos", ar: "كرو نيك ميرينو" },
    { en: "Extra-fine merino knit that breathes in the sun and holds up in a draft. Naturally odour-resistant, so it wears for days between washes.",
      fr: "Maille mérinos extra-fine qui respire au soleil et résiste aux courants d'air. Résiste naturellement aux odeurs — il se porte des jours entre deux lavages.",
      ar: "تريكو ميرينو فائق النعومة يتنفس في الشمس ويصمد في التيارات الهوائية. يقاوم الروائح طبيعيًا، فيُلبس أيامًا بين غسلتين." },
    890, 0, 10, 4.7, 158,
  ],
  [
    1, "MN-104",
    { en: "Linen Camp Shirt", fr: "Chemise camp en lin", ar: "قميص كامب كتاني" },
    { en: "European linen that crinkles with life and dries in an hour. Coconut buttons and a camp collar — the summer shirt you reach for every day.",
      fr: "Lin européen qui froisse avec charme et sèche en une heure. Boutons en coco, col camp — la chemise d'été de tous les jours.",
      ar: "كتان أوروبي يتجعّد بأناقة ويجف في ساعة. أزرار جوز هند وياقة كامب — قميص الصيف الذي تصل إليه كل يوم." },
    640, 25, 0, 4.6, 61,
  ],
  [
    2, "WN-201",
    { en: "Silk Slip Dress", fr: "Robe slip en soie", ar: "فستان سلِيب حريري" },
    { en: "Bias-cut mulberry silk that skims the body and moves like water. Falls just above the knee — dresses up or down in a gesture.",
      fr: "Soie de mûrier coupée dans le biais, fluide comme l'eau. Tombe au-dessus du genou — habillez-la ou détendez-la en un geste.",
      ar: "حرير موري بقطع انحيازي ينزلق على الجسم ويتحرك كالماء. بطول فوق الركبة — رسميًا أو يوميًا بلمسة." },
    1450, 0, 20, 4.9, 143,
  ],
  [
    2, "WN-202",
    { en: "Sand Trench Coat", fr: "Trench sable", ar: "ترنش رملي" },
    { en: "Double-faced cotton twill with a storm flap and buckled belt. Roomy through the shoulders, built for rain or shine.",
      fr: "Twill de coton double face, rabat anti-tempête et ceinture bouclée. Ample aux épaules, fait pour la pluie comme le beau temps.",
      ar: "تويل قطني مزدوج الوجه، رفرفة عاصفة وحزام مشبك. واسع عند الأكتاف، صُنع للمطر والشمس." },
    1890, 10, 30, 4.8, 86,
  ],
  [
    2, "WN-203",
    { en: "Pleated Midi Skirt", fr: "Jupe midi plissée", ar: "تنورة منتصفة ببليسيه" },
    { en: "High-twist crepe that holds its pleats through a full day of sitting, walking and dancing. Midi length, hidden back zip.",
      fr: "Crêpe haute torsion qui tient ses plis toute la journée — assise, en marche ou en danse. Longueur midi, zip invisible au dos.",
      ar: "كريب عالي اللي يحافظ على ثنياته طوال اليوم، جلوسًا ومشيًا ورقصًا. بطول منتصف الساق وسحاب خلفي مخفي." },
    720, 0, 0, 4.5, 72,
  ],
  [
    2, "WN-204",
    { en: "Ribbed Knit Top", fr: "Top en maille côtelée", ar: "توب تريكو مضلع" },
    { en: "Modal-blend rib that hugs without squeezing. Scoop neck, close fit — the quiet base layer that goes with everything.",
      fr: "Côtes en mélange modal qui épousent sans serrer. Encolure ronde, coupe près du corps — la pièce discrète qui va avec tout.",
      ar: "تريكو مضلع من المودال يلامس الجسم دون ضغط. رقبة دائرية وقصّة قريبة — القطعة الهادئة التي تناسب كل شيء." },
    390, 20, 10, 4.7, 129,
  ],
  [
    3, "AC-301",
    { en: "Weekender Duffel", fr: "Sac week-end", ar: "حقيبة نهاية الأسبوع" },
    { en: "Full-grain leather that softens with every trip. Brass hardware, a ventilated shoe pocket and room for two days plus a charger.",
      fr: "Cuir pleine fleur qui s'assouplit voyage après voyage. Fermoirs en laiton, poche à chaussures ventilée et de quoi tenir deux jours et plus.",
      ar: "جلد كامل الحبة يلين مع كل رحلة. إكسسوارات نحاسية وجيب أحذية مهوى ومساحة ليومين وأكثر." },
    1580, 0, 20, 4.8, 54,
  ],
  [
    3, "AC-302",
    { en: "Aviator Sunglasses", fr: "Lunettes aviateur", ar: "نظارة أفياتور" },
    { en: "Polarised lenses and a hand-polished acetate frame, cut, heated and shaped by hand. Hard case and cleaning cloth included.",
      fr: "Verres polarisés et monture en acétate polie à la main — découpée, chauffée et formée à la main. Boîtier rigide et chiffon inclus.",
      ar: "عدسات بولارايزد بإطار أسيتات مصقول يدويًا — قُطع وسُخن وشُكل باليد. مع علبة صلبة وقماشة تنظيف." },
    460, 0, 0, 4.6, 188,
  ],
  [
    3, "AC-303",
    { en: "Wool Beanie", fr: "Bonnet en laine", ar: "طاقية صوف" },
    { en: "Rib-knit lambswool that doesn't itch and doesn't lose its shape. Six heathered shades — one of them becomes yours.",
      fr: "Côtes en laine d'agneau qui ne gratte pas et garde sa forme. Six nuances chinées — l'une deviendra la vôtre.",
      ar: "صوف حمل مضلع لا يسبب حكة ولا يفقد شكله. ست درجات ممزوجة — إحداها ستصبح لك." },
    220, 30, 5, 4.4, 95,
  ],
  [
    3, "AC-304",
    { en: "Leather Belt", fr: "Ceinture en cuir", ar: "حزام جلدي" },
    { en: "Vegetable-tanned leather with a solid brass buckle. Cuts a clean line through denim or tailoring — and darkens beautifully with time.",
      fr: "Cuir tanné végétal, boucle en laiton massif. Trace une ligne nette sur un jean comme sur un costume — et fonce joliment avec le temps.",
      ar: "جلد مدبوغ نباتيًا وإبزيم نحاسي مصمت. يرسم خطًا نظيفًا مع الجينز أو الكلاسيكي — ويغمق بجمال مع الوقت." },
    340, 0, 5, 4.7, 108,
  ],
  [
    4, "KD-401",
    { en: "Denim Overalls", fr: "Salopette en denim", ar: "سربال دنم" },
    { en: "Double knees, adjustable straps and denim that softens fast. Room to grow, stains that wash out, knees that survive the playground.",
      fr: "Genoux doublés, bretelles ajustables et denim qui s'assouplit vite. De la marge pour grandir, des taches qui partent, des genoux qui survivent au terrain de jeu.",
      ar: "ركبتان مزدوجتان وأشرطة قابلة للتعديل ودنم يلين بسرعة. مساحة للنمو وبقع تزول وركبتان تتحملان الملعب." },
    480, 0, 10, 4.8, 77,
  ],
  [
    4, "KD-402",
    { en: "Colourblock Raincoat", fr: "Imperméable à blocs de couleur", ar: "معطف مطر ملون" },
    { en: "Colourblock rain shell with snap storm flaps and a hood that actually stays up. Bright enough to spot from across the street.",
      fr: "Veste de pluie à blocs de couleur, rabats anti-tempête et capuche qui reste en place. Assez vive pour être repérée de l'autre côté de la rue.",
      ar: "غلاف مطر بألوان متدرجة ورفاريف عاصفة وقلنسوة تبقى في مكانها. ساطع بما يكفي ليراه من الجهة الأخرى من الشارع." },
    390, 15, 0, 4.3, 41,
  ],
  [
    4, "KD-403",
    { en: "Graphic Hoodie", fr: "Hoodie à motif", ar: "هودي برسوم" },
    { en: "Brushed-back fleece, soft on the inside and tough on the outside. Drawstring hood and a graphic they'll be proud to wear.",
      fr: "Molleton brossé, doux à l'intérieur, costaud à l'extérieur. Capuche à cordon et un motif dont ils seront fiers.",
      ar: "صوف مقصوص ناعم من الداخل وقوي من الخارج. قلنسوة برباط ورسوم يفخرون بارتدائها." },
    320, 0, 5, 4.9, 167,
  ],
  [
    4, "KD-404",
    { en: "Bubble Puffer", fr: "Doudoune matelassée", ar: "دوفيه مبطنة" },
    { en: "Lightweight quilted warmth with a zip front and room for a layer underneath. Packs small and shrugs off the drizzle.",
      fr: "Chaleur matelassée et légère, fermeture zip et de la place pour une couche dessous. Se range petit et ignore la bruine.",
      ar: "دفء مبطن وخفيف بسحاب أمامي ومساحة لطبقة تحته. ينطوي صغيرًا ولا يتأثر بالرذاذ." },
    560, 10, 10, 4.6, 88,
  ],
];

const GRADIENTS = [
  ["#232a35", "#0e1116"],
  ["#3b2f2f", "#7a4a2b"],
  ["#1e3a5f", "#0e2a55"],
  ["#3f3a52", "#1a1f33"],
  ["#2c4a3b", "#16301f"],
  ["#4a2f3f", "#2b1624"],
  ["#333a3d", "#14181a"],
  ["#3d3a24", "#1c1a10"],
];

function art(productName, alternate = false) {
  const sample = alternate ? "fashion-campaign.png"
    : /denim jacket/i.test(productName) ? "denim-jacket.png"
    : /silk slip dress/i.test(productName) ? "silk-dress.png"
    : /trench coat/i.test(productName) ? "fashion-trench.png"
    : /puffer/i.test(productName) ? "fashion-puffer.png"
    : /linen camp shirt/i.test(productName) ? "fashion-linen-shirt.png"
    : /beanie/i.test(productName) ? "fashion-beanie.png"
    : /raincoat/i.test(productName) ? "fashion-raincoat.png"
    : /graphic hoodie/i.test(productName) ? "fashion-hoodie.png"
    : "linen-overshirt.png";
  return `http://localhost:${PORT}/mock-media/${sample}`;
}

function pick(arr) {
  return arr[Math.floor(rand() * arr.length)];
}

function buildProducts() {
  const products = [];
  let vid = 1;
  PRODUCT_SEEDS.forEach((seed, i) => {
    const [section, ref, name, description, basePrice, promo, loyalty, rating, reviews] = seed;
    const sectionDefs = SECTIONS.find((s) => s.id === section).attribute_defs;
    const variants = [];
    const sizeDef = sectionDefs.find((d) => d.key === "size");
    const colorDef = sectionDefs.find((d) => d.key === "color");
    const otherDefs = sectionDefs.filter((d) => d.key !== "size" && d.key !== "color");

    // Options are { value, labels }; variant attributes store the canonical value.
    const sizes = sizeDef ? sizeDef.options : [null];
    const colors = colorDef ? colorDef.options : [null];
    const val = (o) => (o && typeof o === "object" ? o.value : o);

    for (const size of sizes) {
      for (const color of colors) {
        const extra = { XS: 0, S: 0, M: 0, L: 20, XL: 30 }[size] ?? 0;
        const qty = Math.floor(rand() * 90) + 4;
        const reserved = Math.floor(rand() * 8);
        const attributes = {
          ...(size ? { size: val(size) } : {}),
          ...(color ? { color: val(color) } : {}),
        };
        for (const d of otherDefs) {
          attributes[d.key] = val(pick(d.options));
        }
        variants.push({
          id: vid++,
          attributes,
          price: basePrice + extra,
          quantity: qty,
          reserved,
          available_quantity: qty - reserved,
        });
      }
    }

    const images = [0, 1].map((k) => ({
      id: i * 10 + k,
      image: art(name.en, k === 1),
      is_primary: k === 0,
      order: k,
    }));

    products.push({
      id: i + 1,
      slug: name.en.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
      section,
      ref,
      name,
      description,
      price: basePrice,
      promo,
      loyalty_points: loyalty,
      show_related_products: true,
      rating,
      reviews_count: reviews,
      attributes: {},
      images,
      variants,
      created_at: new Date(Date.now() - (30 - i) * 864e5).toISOString(),
    });
  });
  return products;
}

const PRODUCTS = buildProducts();
const THEME_CATALOGS = {
  beauty: themeCatalog("beauty", PORT),
  atelier: themeCatalog("atelier", PORT),
  electronics: themeCatalog("electronics", PORT),
  fashion: { sections: SECTIONS, products: PRODUCTS.map((product, index) => index === 0 ? {
    ...product,
    images: [{ id: 9000, image: `http://localhost:${PORT}/mock-media/fashion-campaign.png`, is_primary: true, order: 0 }, ...product.images.map((image) => ({ ...image, is_primary: false }))],
  } : product) },
};
THEME_CATALOGS.nexa = THEME_CATALOGS.electronics;
THEME_CATALOGS.basic = {
  sections: [SECTIONS[0], THEME_CATALOGS.beauty.sections[0], THEME_CATALOGS.electronics.sections[0]],
  products: [PRODUCTS[0], PRODUCTS[1], THEME_CATALOGS.beauty.products[0], THEME_CATALOGS.beauty.products[2], THEME_CATALOGS.electronics.products[0], THEME_CATALOGS.electronics.products[3]],
};
function catalogFor(req) { return THEME_CATALOGS[req.headers["x-store-slug"]] ?? { sections: SECTIONS, products: PRODUCTS }; }
const ALL_DEMO_PRODUCTS = [...PRODUCTS, ...THEME_CATALOGS.beauty.products, ...THEME_CATALOGS.electronics.products, ...THEME_CATALOGS.atelier.products];

/* ------------------------------------------------------------------ */
/* localized responses                                                */
/* ------------------------------------------------------------------ */

/** Localize one section (labels + attribute labels/options) for a language. */
function localizeSection(section, lang) {
  return {
    ...section,
    label: l10n(lang, section.label),
    attribute_defs: section.attribute_defs.map((d) => ({
      ...d,
      level: d.level ?? "variant",
      label: l10n(lang, d.label),
      options: d.options.map((o) => ({ value: o.value, label: l10n(lang, o.labels) })),
    })),
  };
}

/** Localize a product (name + description) for a language. */
function localizeProduct(product, lang) {
  return {
    ...product,
    name: l10n(lang, product.name),
    description: l10n(lang, product.description),
  };
}

/* ------------------------------------------------------------------ */
/* runtime state                                                       */
/* ------------------------------------------------------------------ */

const orders = new Map();
let orderSeq = 1000;

/* ------------------------------------------------------------------ */
/* customer auth                                                       */
/* ------------------------------------------------------------------ */

const customers = new Map();
const tokens = new Map(); // token -> customer id
let customerSeq = 1;

function hashPassword(password) {
  return createHash("sha256").update(`store-demo::${password}`).digest("hex");
}

function publicCustomer(c) {
  return {
    id: c.id,
    email: c.email,
    firstName: c.firstName,
    lastName: c.lastName,
    createdAt: c.createdAt,
  };
}

function issueToken(customerId) {
  const token = `cst_${randomBytes(18).toString("hex")}`;
  tokens.set(token, customerId);
  return token;
}

// Demo account, discoverable from the storefront sign-in form.
const demoCustomer = {
  id: customerSeq++,
  email: "demo@example.com",
  firstName: "Demo",
  lastName: "Customer",
  passwordHash: hashPassword("demo1234"),
  createdAt: new Date("2026-01-05T09:30:00.000Z").toISOString(),
};
customers.set(demoCustomer.id, demoCustomer);
issueToken(demoCustomer.id); // pre-issued token is discarded; login issues a fresh one

function latency() {
  return 120 + Math.random() * 380;
}

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

const CORS_HEADERS = {
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Store-Slug, X-CSRFToken, Accept-Language, Authorization, Idempotency-Key",
  "Access-Control-Allow-Credentials": "true",
};

const MOCK_MEDIA = {
  "linen-overshirt.png": new URL("./mock-media/linen-overshirt.png", import.meta.url),
  "leather-sneakers.png": new URL("./mock-media/leather-sneakers.png", import.meta.url),
  "beauty-campaign.png": new URL("./mock-media/beauty-campaign.png", import.meta.url),
  "beauty-routine.png": new URL("./mock-media/beauty-routine.png", import.meta.url),
  "beauty-cream.png": new URL("./mock-media/beauty-cream.png", import.meta.url),
  "beauty-cleanser.png": new URL("./mock-media/beauty-cleanser.png", import.meta.url),
  "beauty-vitamin-c.png": new URL("./mock-media/beauty-vitamin-c.png", import.meta.url),
  "fashion-campaign.png": new URL("./mock-media/fashion-campaign.png", import.meta.url),
  "denim-jacket.png": new URL("./mock-media/denim-jacket.png", import.meta.url),
  "silk-dress.png": new URL("./mock-media/silk-dress.png", import.meta.url),
  "fashion-trench.png": new URL("./mock-media/fashion-trench.png", import.meta.url),
  "fashion-puffer.png": new URL("./mock-media/fashion-puffer.png", import.meta.url),
  "fashion-linen-shirt.png": new URL("./mock-media/fashion-linen-shirt.png", import.meta.url),
  "fashion-beanie.png": new URL("./mock-media/fashion-beanie.png", import.meta.url),
  "fashion-raincoat.png": new URL("./mock-media/fashion-raincoat.png", import.meta.url),
  "fashion-hoodie.png": new URL("./mock-media/fashion-hoodie.png", import.meta.url),
  "electronics-campaign.png": new URL("./mock-media/electronics-campaign.png", import.meta.url),
  "electronics-products.png": new URL("./mock-media/electronics-products.png", import.meta.url),
  "electronics-laptop.png": new URL("./mock-media/electronics-laptop.png", import.meta.url),
  "electronics-smartphone.png": new URL("./mock-media/electronics-smartphone.png", import.meta.url),
  "electronics-headphones.png": new URL("./mock-media/electronics-headphones.png", import.meta.url),
  "atelier-hero.jpg": new URL("./mock-media/atelier-hero.jpg", import.meta.url),
  "atelier-chair.jpg": new URL("./mock-media/atelier-chair.jpg", import.meta.url),
  "atelier-fragrance.jpg": new URL("./mock-media/atelier-fragrance.jpg", import.meta.url),
  "atelier-bag.jpg": new URL("./mock-media/atelier-bag.jpg", import.meta.url),
  "atelier-watch.jpg": new URL("./mock-media/atelier-watch.jpg", import.meta.url),
  "atelier-story.jpg": new URL("./mock-media/atelier-story.jpg", import.meta.url),
  "atelier-ceramics.jpg": new URL("./mock-media/atelier-ceramics.jpg", import.meta.url),
  "atelier-shirt.jpg": new URL("./mock-media/atelier-shirt.jpg", import.meta.url),
  "atelier-sunglasses.jpg": new URL("./mock-media/atelier-sunglasses.jpg", import.meta.url),
  "atelier-home.jpg": new URL("./mock-media/atelier-home.jpg", import.meta.url),
};

function serveMockMedia(res, name) {
  const file = MOCK_MEDIA[name];
  if (!file) return send(res, 404, { detail: "Media not found" });
  res.writeHead(200, { ...CORS_HEADERS, "Content-Type": name.endsWith(".jpg") ? "image/jpeg" : "image/png", "Cache-Control": "public, max-age=86400" });
  res.end(readFileSync(file));
}

function send(res, status, body) {
  res.writeHead(status, {
    ...CORS_HEADERS,
    "Content-Type": "application/json",
  });
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function orderRef() {
  return `SF-${String(orderSeq++).padStart(6, "0")}`;
}

function resolveItem(productId, variantId, qty) {
  const product = ALL_DEMO_PRODUCTS.find((p) => p.id === productId);
  if (!product) return null;
  let variant = null;
  if (product.variants.length > 0) {
    variant = product.variants.find((v) => v.id === variantId);
    if (!variant) return null;
  }
  const unitPrice = variant ? variant.price ?? product.price : product.price;
  const discount = Math.round((unitPrice * product.promo) / 100);
  const final = unitPrice - discount;
  return {
    product,
    variant,
    qty,
    unitPrice: final,
    available: variant ? variant.available_quantity >= qty : true,
    stockDeducted: false,
  };
}

/* ------------------------------------------------------------------ */
/* routes                                                              */
/* ------------------------------------------------------------------ */

function handleCatalog(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname;
  const lang = acceptLang(req.headers["accept-language"]);
  const { sections, products } = catalogFor(req);

  if (path === "/api/catalog/sections/" && req.method === "GET") {
    const list = sections.map((s) => localizeSection(s, lang));
    return setTimeout(() => send(res, 200, list), latency());
  }

  if (path === "/api/catalog/products/" && req.method === "GET") {
    const sectionKey = url.searchParams.get("section");
    const source = url.searchParams.get("source");
    let list = sectionKey
      ? products.filter((p) => p.section === sections.find((s) => s.key === sectionKey)?.id)
      : [...products];
    if (source === "featured") list = list.filter((p) => p.is_featured).sort((a, b) => (a.merchandising_order ?? 0) - (b.merchandising_order ?? 0));
    else if (source === "discounted") list = list.filter((p) => p.promo > 0 || (p.compare_at_price ?? 0) > p.price).sort((a, b) => b.promo - a.promo);
    else if (source === "top_rated") list = list.filter((p) => p.reviews_count > 0).sort((a, b) => b.rating - a.rating);
    else if (source === "newest") list = [...list].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
    else list = [...list].sort((a, b) => Number(b.is_featured) - Number(a.is_featured) || (a.merchandising_order ?? 0) - (b.merchandising_order ?? 0));
    if (url.searchParams.has("limit")) {
      const limit = Number(url.searchParams.get("limit"));
      const offset = Number(url.searchParams.get("offset") ?? 0);
      if (!Number.isInteger(limit) || limit < 1 || limit > 48 || !Number.isInteger(offset) || offset < 0) return send(res, 400, { detail: "Invalid pagination" });
      return setTimeout(() => send(res, 200, { count: list.length, results: list.slice(offset, offset + limit).map((p) => localizeProduct(p, lang)) }), latency());
    }
    return setTimeout(() => send(res, 200, list.map((p) => localizeProduct(p, lang))), latency());
  }

  const detailMatch = path.match(/^\/api\/catalog\/products\/([^/]+)\/$/);
  if (detailMatch && req.method === "GET") {
    const identifier = decodeURIComponent(detailMatch[1]);
    const product = products.find((p) => p.slug === identifier || String(p.id) === identifier);
    if (!product) return send(res, 404, { detail: "Product not found" });
    return setTimeout(() => send(res, 200, localizeProduct(product, lang)), latency());
  }

  const stockMatch = path.match(/^\/api\/catalog\/products\/(\d+)\/stock\/$/);
  if (stockMatch && req.method === "GET") {
    const product = products.find((p) => p.id === Number(stockMatch[1]));
    if (!product) return send(res, 404, { detail: "Product not found" });
    return setTimeout(() => send(res, 200, product.variants), latency());
  }

  return send(res, 404, { detail: `No route ${req.method} ${path}` });
}

async function handleSubscribe(req, res) {
  const body = await readBody(req);
  if (typeof body.email !== "string" || !body.email.includes("@")) {
    return send(res, 422, { detail: "A valid email is required." });
  }
  return setTimeout(
    () => send(res, 201, { detail: `Subscribed ${body.email}. Thanks for joining!` }),
    latency(),
  );
}

function bearerToken(req) {
  const header = req.headers.authorization ?? "";
  const m = header.match(/^Bearer\s+(\S+)$/i);
  return m ? m[1] : null;
}

async function handleAuth(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname;

  if (path === "/api/auth/register/" && req.method === "POST") {
    const body = await readBody(req);
    const email = String(body.email ?? "").trim().toLowerCase();
    const firstName = String(body.firstName ?? "").trim();
    const lastName = String(body.lastName ?? "").trim();
    const password = String(body.password ?? "");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return send(res, 422, { detail: "A valid email is required." });
    }
    if (password.length < 8) {
      return send(res, 422, { detail: "Password must be at least 8 characters." });
    }
    if (!firstName || !lastName) {
      return send(res, 422, { detail: "First and last name are required." });
    }
    const existing = [...customers.values()].find((c) => c.email === email);
    if (existing) {
      return send(res, 409, { detail: "An account with this email already exists." });
    }
    const customer = {
      id: customerSeq++,
      email,
      firstName,
      lastName,
      passwordHash: hashPassword(password),
      createdAt: new Date().toISOString(),
    };
    customers.set(customer.id, customer);
    const token = issueToken(customer.id);
    return setTimeout(
      () => send(res, 201, { token, customer: publicCustomer(customer) }),
      latency(),
    );
  }

  if (path === "/api/auth/login/" && req.method === "POST") {
    const body = await readBody(req);
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const customer = [...customers.values()].find((c) => c.email === email);
    if (!customer || customer.passwordHash !== hashPassword(password)) {
      return send(res, 401, { detail: "Invalid email or password." });
    }
    const token = issueToken(customer.id);
    return setTimeout(
      () => send(res, 200, { token, customer: publicCustomer(customer) }),
      latency(),
    );
  }

  const token = bearerToken(req);

  if (path === "/api/auth/logout/" && req.method === "POST") {
    if (token) tokens.delete(token);
    return send(res, 204, {});
  }

  if (path === "/api/auth/me/" && req.method === "GET") {
    const customerId = token ? tokens.get(token) : undefined;
    const customer = customerId ? customers.get(customerId) : undefined;
    if (!customer) return send(res, 401, { detail: "Not authenticated." });
    return setTimeout(() => send(res, 200, { customer: publicCustomer(customer) }), latency());
  }

  return send(res, 404, { detail: `No route ${req.method} ${path}` });
}

function handleStorefrontConfig(req, res) {
  const catalog = catalogFor(req);
  const theme = ["basic", "beauty", "fashion", "electronics", "atelier", "nexa"].includes(req.headers["x-store-slug"]) ? req.headers["x-store-slug"] : "basic";
  const sections = catalog.sections.map((s) => ({ key: s.key, label: s.label.en, icon: s.icon }));
  const brandName = ({ basic: "Northline Goods", beauty: "Aurelle", fashion: "Forma Studio", electronics: "Circuit & Co.", atelier: "Maison Atelier", nexa: "NEXA Select" })[theme];
  return setTimeout(
    () =>
      send(res, 200, {
        storeName: brandName,
        slug: `demo-${theme}`,
        domain: `https://${theme}.example`,
        contactEmail: `hello@${theme}.example`,
        phone: "",
        currency: "MAD",
        palette: {
          brand: ({ basic: "#287a52", beauty: "#8b5c55", fashion: "#a67c2e", electronics: "#1957d2", atelier: "#a88765", nexa: "#a67c2e" })[theme],
          brandDark: "#166365",
          brandDeep: "#0E3E3F",
          ink: "#104546",
          brandLight: "#84BFC0",
          brandLight1: "#DDEDEE",
          brandLight2: "#EFF7F7",
        },
        design: theme,
        freeShippingThreshold: 0,
        shippingFee: 0,
        defaultLocale: "en",
        payment: { online: true, acceptedCards: ["VISA", "Mastercard", "AMEX"] },
        ...(theme === "atelier" ? { pages: { home: {
          type: "system", route: "", title: { en: "Home", fr: "Accueil", ar: "الرئيسية" }, showInNavigation: false, revision: 1,
          sections: [
            { id: "atelier-hero", type: "hero", enabled: true, settings: {
              eyebrow: { en: "A considered way of living", fr: "L'art de vivre avec intention", ar: "أسلوب حياة مدروس" },
              title: { en: "Objects of\nEveryday Elegance", fr: "L'élégance au quotidien", ar: "أناقة كل يوم" },
              subtitle: { en: "A collection of objects for everyday living.", fr: "Une collection d'objets pour le quotidien.", ar: "مجموعة من القطع للحياة اليومية." },
              cta_label: { en: "Explore the collection", fr: "Découvrir la collection", ar: "اكتشف المجموعة" },
              cta_url: "/collections/all", image_url: `http://localhost:${PORT}/mock-media/atelier-hero.jpg`,
            } },
            { id: "atelier-collections", type: "collections", enabled: true, settings: {
              title: { en: "Explore by category", fr: "Explorer par catégorie", ar: "تصفح حسب الفئة" }, limit: 3,
            } },
            { id: "atelier-products", type: "products", enabled: true, settings: {
              title: { en: "The everyday edit", fr: "La sélection du quotidien", ar: "مختارات كل يوم" }, source: "featured", limit: 4, layout: "grid",
            } },
            { id: "atelier-story", type: "image_text", enabled: true, settings: {
              title: { en: "Made for modern living", fr: "Pensé pour la vie moderne", ar: "صُمم للحياة العصرية" },
              body: { en: "<p>Explore objects chosen for the spaces and moments you care about.</p>", fr: "<p>Découvrez des objets choisis pour vos espaces et vos moments.</p>", ar: "<p>اكتشف قطعًا مختارة لمساحاتك ولحظاتك.</p>" },
              cta_label: { en: "Browse products", fr: "Voir les produits", ar: "تصفح المنتجات" }, cta_url: "/collections/all",
              image_url: `http://localhost:${PORT}/mock-media/atelier-story.jpg`, alignment: "image_first",
            } },
            { id: "atelier-edit", type: "theme_feature", enabled: true, settings: {
              title: { en: "The Atelier edit", fr: "La sélection Atelier", ar: "مختارات أتيليه" },
              body: { en: "", fr: "", ar: "" }, kind: "atelier", limit: 4,
            } },
            { id: "atelier-newsletter", type: "newsletter", enabled: true, settings: {
              title: { en: "Stay inspired", fr: "Restez inspiré", ar: "ابقَ ملهمًا" },
              body: { en: "New pieces and notes from the store.", fr: "Nouveautés et nouvelles de la boutique.", ar: "قطع جديدة وأخبار المتجر." },
            } },
          ],
        } } } : {}),
        sections,
      }),
    latency(),
  );
}

async function handleOrders(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname;
  const single = path.match(/^\/api\/orders\/([^/]+)\/$/);

  if (single && req.method === "GET") {
    const order = orders.get(single[1]);
    if (!order) return send(res, 404, { detail: "Order not found" });
    return setTimeout(() => send(res, 200, order), latency());
  }

  if (path !== "/api/orders/" || req.method !== "POST") {
    return send(res, 404, { detail: `No route ${req.method} ${path}` });
  }

  const body = await readBody(req);
  const lang = acceptLang(req.headers["accept-language"]);
  const customer = body.customer ?? {};
  const rawItems = Array.isArray(body.items) ? body.items : [];

  const lines = rawItems
    .map((it) => {
      const r = resolveItem(it.product_id, it.variant_id, it.quantity);
      if (!r) return null;
      const variantSummary = r.variant
        ? Object.entries(r.variant.attributes)
            .map(([k, v]) => (Array.isArray(v) ? v.join(" / ") : String(v)))
            .join(" · ")
        : "";
      return {
        product_id: r.product.id,
        variant_id: r.variant?.id ?? 0,
        ref: r.product.ref,
        name: l10n(lang, r.product.name),
        attributes: r.variant?.attributes ?? {},
        quantity: r.qty,
        price: r.unitPrice,
        available: r.available,
        stock_deducted: r.stockDeducted,
        exception_id: r.available ? null : "OUT_OF_STOCK",
      };
    })
    .filter(Boolean);

  const amount = lines.reduce((sum, l) => sum + l.price * l.quantity, 0);
  const payment_mode = body.payment_mode === "cod" ? "cod" : "online";
  const id = orderRef();

  const order = {
    order_id: id,
    amount,
    status: lines.length > 0,
    exception: lines.some((l) => l.exception_id),
    payment_mode,
    is_paid: payment_mode === "cod" ? "yes" : "pending",
    currency: "MAD",
    customer_name: customer.name ?? "",
    customer_email: customer.email ?? "",
    customer_phone: customer.phone ?? "",
    customer_city: customer.city ?? "",
    customer_address: customer.address ?? "",
    created_at: new Date().toISOString(),
    items: lines,
  };
  orders.set(id, order);

  return setTimeout(() => send(res, 201, order), latency());
}

async function handlePayments(req, res) {
  const body = await readBody(req);
  const order = orders.get(body.order_id);
  if (!order) return send(res, 404, { detail: "Order not found" });

  if (req.url.startsWith("/api/payments/verify/")) {
    const verified = order.payment_mode === "cod" || order.is_paid === "yes" || Math.random() > 0.05;
    if (verified && order.is_paid !== "yes") {
      order.is_paid = "yes";
    }
    return setTimeout(
      () =>
        send(res, 200, {
          verified,
          status: verified ? "confirmed" : "pending",
        }),
      latency(),
    );
  }

  if (req.url.startsWith("/api/payments/cancel/")) {
    order.is_paid = "cancelled";
    return setTimeout(() => send(res, 200, { detail: "Order cancelled" }), latency());
  }

  // /api/payments/ (new) and /api/payments/retry/ both issue a gateway URL
  const successUrl = body.tokenParams?.success_url ?? "http://localhost:5173";
  const lang = body.tokenParams?.lang ?? "en";
  const scheme = process.env.MOCK_API_TLS === "1" ? "https" : "http";
  const payUrl =
    `${scheme}://localhost:${PORT}/mock-pay?` +
    new URLSearchParams({ order_id: order.order_id, success_url: successUrl, lang }).toString();

  return setTimeout(() => send(res, 201, { payment_url: payUrl, order_id: order.order_id }), latency());
}

/* ------------------------------------------------------------------ */
/* mock payment gateway page                                           */
/* ------------------------------------------------------------------ */

const GATEWAY_HTML = readFileSync(new URL("./mock-gateway.html", import.meta.url), "utf8");

function serveGateway(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  res.writeHead(200, {
    ...CORS_HEADERS,
    "Content-Type": "text/html; charset=utf-8",
  });
  res.end(GATEWAY_HTML);
}

/* ------------------------------------------------------------------ */
/* server                                                              */
/* ------------------------------------------------------------------ */

function handleRequest(req, res) {
  const path = (req.url ?? "").split("?")[0];
  const origin = req.headers.origin;
  res.setHeader("Access-Control-Allow-Origin", origin || "http://127.0.0.1");
  res.setHeader("Vary", "Origin");

  if (req.method === "OPTIONS") {
    res.writeHead(204, CORS_HEADERS);
    return res.end();
  }

  if (path.startsWith("/mock-media/")) return serveMockMedia(res, path.slice("/mock-media/".length));

  // Local previews show an honest empty review state when no reviews exist.
  if (/^\/api\/catalog\/products\/[^/]+\/reviews\/$/.test(path) && req.method === "GET") return send(res, 200, []);

  if (path === "/api/catalog/sections/" || path === "/api/catalog/products/" || /^\/api\/catalog\/products\/[^/]+\/$/.test(path) || /\/stock\/$/.test(path)) {
    return handleCatalog(req, res);
  }
  if (path.startsWith("/api/auth")) return handleAuth(req, res);
  if (path === "/api/storefront/config/") return handleStorefrontConfig(req, res);
  if (path === "/api/subscribe/") return handleSubscribe(req, res);
  if (path.startsWith("/api/orders")) return handleOrders(req, res);
  if (path.startsWith("/api/payments")) return handlePayments(req, res);
  if (path === "/mock-pay") return serveGateway(req, res);

  return send(res, 404, { detail: `No route ${req.method} ${path}` });
}

// Optional TLS: set MOCK_API_TLS=1 and point MOCK_API_CERT/MOCK_API_KEY at a
// cert pair (or let them default to <repo>/ssl/cert.pem + key.pem). The demo
// previews are served over HTTPS from the showroom, so the demo API they call
// must be HTTPS too — otherwise the browser blocks it as mixed content.
let listener;
let proto = "http";
if (process.env.MOCK_API_TLS === "1") {
  const { readFileSync } = await import("node:fs");
  const { createServer: createTlsServer } = await import("node:https");
  const { fileURLToPath } = await import("node:url");
  const { dirname, join } = await import("node:path");
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const cert = readFileSync(process.env.MOCK_API_CERT ?? join(root, "ssl", "cert.pem"));
  const key = readFileSync(process.env.MOCK_API_KEY ?? join(root, "ssl", "key.pem"));
  listener = createTlsServer({ cert, key }, handleRequest);
  proto = "https";
} else {
  listener = createServer(handleRequest);
}

listener.listen(PORT, () => {
  console.log(`mock-store-api listening on ${proto}://localhost:${PORT}`);
  console.log(`  catalog: ${PRODUCTS.length} products across ${SECTIONS.length} sections`);
});
