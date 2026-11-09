/** Fictional tenant catalogs for local previews. Production never imports this file. */
const label = (en, fr = en, ar = en) => ({ en, fr, ar });
const field = (id, key, en, values = []) => ({ id, key, label: label(en), type: "select", level: "product", options: values.map((value) => ({ value, labels: label(value) })), required: false, sort_order: id });
const section = (id, key, en, attrs) => ({ id, key, label: label(en), icon: "bag", sort_order: id, attribute_defs: attrs });
const careFields = [field(301,"concern","Concern",["Hydration","Radiance","Sensitive skin"]),field(302,"ingredients","Ingredients",["Hyaluronic Acid","Vitamin C","Niacinamide","Ceramides"]),field(303,"benefits","Benefits"),field(304,"usage","How to use"),field(305,"suitable_for","Suitable for"),field(306,"routine_step","Routine step",["Cleanse","Treat","Moisturize","Protect"])];
const techFields = [field(401,"brand","Brand"),field(402,"storage","Storage"),field(403,"ram","Memory"),field(404,"display","Display"),field(405,"connectivity","Connectivity"),field(406,"warranty","Warranty")];
const catalogs = {
  beauty: {
    sections: [section(31,"skincare","Skincare",careFields),section(32,"body-care","Body care",careFields),section(33,"wellness","Wellness",careFields)],
    items: [
      [31,"Daily Hydration Serum",249,{concern:"Hydration",ingredients:"Hyaluronic Acid",benefits:"Lightweight hydration",usage:"Apply after cleansing",suitable_for:"All skin types",routine_step:"Treat"}],
      [31,"Vitamin C Glow Drops",299,{concern:"Radiance",ingredients:"Vitamin C",benefits:"Bright-looking finish",usage:"Apply before moisturizer",suitable_for:"Normal skin",routine_step:"Treat"}],
      [31,"Barrier Cream",229,{concern:"Sensitive skin",ingredients:"Ceramides",benefits:"Comforting moisture",usage:"Use as final care step",suitable_for:"Sensitive skin",routine_step:"Moisturize"}],
      [31,"Niacinamide Balance Serum",275,{concern:"Sensitive skin",ingredients:"Niacinamide",benefits:"Balanced feel",usage:"Apply to clean skin",suitable_for:"Combination skin",routine_step:"Treat"}],
      [32,"Soft Body Cleanser",159,{concern:"Hydration",ingredients:"Glycerin",benefits:"Gentle cleansing",usage:"Rinse with water",suitable_for:"All skin types",routine_step:"Cleanse"}],
      [32,"Hand Renewal Balm",139,{concern:"Hydration",ingredients:"Shea butter",benefits:"Soft-feeling hands",usage:"Apply as needed",suitable_for:"Dry hands",routine_step:"Moisturize"}],
      [33,"Evening Face Oil",329,{concern:"Radiance",ingredients:"Squalane",benefits:"Nourished feel",usage:"Use after serum",suitable_for:"Normal to dry skin",routine_step:"Moisturize"}],
      [33,"Calm Mist",189,{concern:"Sensitive skin",ingredients:"Aloe",benefits:"Refreshing feel",usage:"Mist over face",suitable_for:"All skin types",routine_step:"Treat"}],
    ],
    media: ["beauty-campaign.png","beauty-routine.png"],
  },
  atelier: {
    sections: [section(51,"living","Living",[]),section(52,"accessories","Accessories",[]),section(53,"wardrobe","Wardrobe",[])],
    items: [
      [51,"Sculpted Oak Chair",1290,{material:"Oak"}],
      [52,"Everyday Leather Bag",890,{material:"Leather"}],
      [51,"Handmade Ceramic Vase",340,{material:"Ceramic"}],
      [52,"Classic Steel Watch",1190,{material:"Stainless steel"}],
      [53,"Linen Shirt",390,{material:"Linen"}],
      [52,"Sunglasses",290,{material:"Acetate"}],
      [51,"Soft Living Room Edit",690,{}],
      [52,"Fine Fragrance",450,{}],
    ],
    media: ["atelier-hero.jpg","atelier-home.jpg"],
  },
  electronics: {
    sections: [section(41,"audio","Audio",techFields),section(42,"computers","Computers",techFields),section(43,"mobile","Mobile",techFields)],
    items: [
      [41,"Studio Wireless Headphones",899,{brand:"Auralis",connectivity:"Bluetooth 5.3",warranty:"12 months",storage:"—"}],
      [42,"Arc 14 Laptop",7499,{brand:"Voltix",storage:"512 GB",ram:"16 GB",display:"14-inch",warranty:"12 months"}],
      [43,"Nova Smartphone",4299,{brand:"Voltix",storage:"256 GB",ram:"8 GB",display:"6.4-inch",warranty:"12 months"}],
      [41,"Pocket Earbuds",549,{brand:"Auralis",connectivity:"Bluetooth 5.3",warranty:"12 months"}],
      [42,"Workstation Tablet",3199,{brand:"Voltix",storage:"128 GB",ram:"8 GB",display:"11-inch",warranty:"12 months"}],
      [43,"Magnetic Charger",229,{brand:"Voltix",connectivity:"USB-C",warranty:"12 months"}],
      [41,"Desktop Speaker Pair",1199,{brand:"Auralis",connectivity:"Bluetooth 5.2",warranty:"12 months"}],
      [42,"Portable SSD",699,{brand:"Voltix",storage:"1 TB",connectivity:"USB-C",warranty:"12 months"}],
    ],
    media: ["electronics-campaign.png","electronics-products.png"],
  },
};

export function themeCatalog(catalogKey, port) {
  const fixture = catalogs[catalogKey];
  if (!fixture) return null;
  const featuredMedia = catalogKey === "beauty"
    ? { 1: "beauty-vitamin-c.png", 2: "beauty-cream.png", 4: "beauty-cleanser.png" }
    : catalogKey === "atelier"
      ? { 0: "atelier-hero.jpg", 1: "atelier-bag.jpg", 2: "atelier-ceramics.jpg", 3: "atelier-watch.jpg", 4: "atelier-shirt.jpg", 5: "atelier-sunglasses.jpg", 6: "atelier-home.jpg", 7: "atelier-fragrance.jpg" }
      : { 0: "electronics-headphones.png", 1: "electronics-laptop.png", 2: "electronics-smartphone.png" };
  const products = fixture.items.map(([sectionId, productName, price, attributes], index) => ({
    id: (catalogKey === "beauty" ? 300 : catalogKey === "atelier" ? 500 : 400) + index + 1,
    section: sectionId,
    ref: `${catalogKey === "beauty" ? "BEA" : catalogKey === "atelier" ? "ATL" : "TEC"}-${String(index + 1).padStart(3,"0")}`,
    slug: String(productName).toLowerCase().replace(/[^a-z0-9]+/g,"-"),
    name: label(productName), description: label(catalogKey === "beauty"
      ? `${attributes.benefits || "Everyday care"} with ${attributes.ingredients || "considered ingredients"}. ${attributes.usage || "Use as directed"}.`
      : catalogKey === "atelier"
        ? `${productName}${attributes.material ? ` · ${attributes.material}` : ""}. Explore the details and available options.`
        : `${attributes.brand || "Thoughtful technology"} ${productName}. ${[attributes.display, attributes.ram, attributes.storage, attributes.connectivity].filter((item) => item && item !== "—").join(" · ")}.`),
    price, compare_at_price: index % 3 === 0 ? Math.round(price * 1.12) : null,
    promo: 0, loyalty_points: 0, rating: 0, reviews_count: 0,
    is_featured: index < 4, uses_variants: false, track_inventory: true, inventory: 25,
    show_related_products: true,
    attributes, extra: {},
    images: (featuredMedia[index] ? [featuredMedia[index], fixture.media[0]] : fixture.media).map((file, mediaIndex) => ({ id: 1000 + index * 10 + mediaIndex, image: `http://localhost:${port}/mock-media/${file}`, alt_text: productName, is_primary: mediaIndex === (featuredMedia[index] ? 0 : index % 2), order: mediaIndex })),
    variants: [{ id: 1000 + (catalogKey === "beauty" ? 300 : catalogKey === "atelier" ? 500 : 400) + index, attributes: {}, price, quantity: 25, reserved: 0, available_quantity: 25, extra: {} }],
    created_at: new Date("2026-08-01T12:00:00Z").toISOString(),
  }));
  return { sections: fixture.sections, products };
}
