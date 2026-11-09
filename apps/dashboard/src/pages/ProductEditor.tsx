import { useEffect, useMemo, useRef, useState, type FormEvent, type DragEvent, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  FiArrowLeft, FiImage, FiLayers, FiPlus, FiSave, FiTrash2, FiX, FiPackage, FiUploadCloud,
  FiCheck, FiChevronDown, FiLink2, FiSearch,
} from "react-icons/fi";
import {
  api,
  ApiError,
  type AttributeDef,
  type CatalogSection,
  type Product,
  type ProductVariantOption,
  type ProductVariantValue,
  type ProductVendor,
  type RetailFieldConfig,
  type RetailType,
  type StockVariant,
} from "../api/client";
import { merchantVariants as visibleMerchantVariants, productPublicationReady } from "../lib/catalog";
import { useStore } from "../Layout";
import { useAsync } from "../hooks/useAsync";
import { useToast } from "../components/Toast";
import { EmptyState, PageLoader } from "../components/Skeleton";
import { ConfirmModal } from "../components/ConfirmModal";
import { ModalShell, useLastPresent } from "../components/ModalShell";
import { RichTextEditor, richTextLabels } from "../components/RichTextEditor";
import { t, useLocale, type Locale } from "../i18n";
import { friendlyError } from "../utils/errors";
import { OptimizedImage } from "@storefront/core/media";

function sectionDefs(sections: CatalogSection[], sectionId: number): AttributeDef[] {
  return sections.find((s) => s.id === sectionId)?.attribute_defs ?? [];
}

function optValue(opt: unknown): string {
  return opt && typeof opt === "object" ? (opt as { value: string }).value : String(opt);
}
function optLabel(opt: unknown): string {
  return opt && typeof opt === "object" ? (opt as { label?: string }).label ?? optValue(opt) : String(opt);
}

function optSwatch(opt: unknown): string | undefined {
  if (!opt || typeof opt !== "object") return /^#[0-9a-f]{6}$/i.test(String(opt ?? "")) ? String(opt) : undefined;
  const swatch = (opt as { swatch?: string }).swatch;
  return swatch && /^#[0-9a-f]{6}$/i.test(swatch) ? swatch : undefined;
}

type RgbColor = { r: number; g: number; b: number };
type HsvColor = { h: number; s: number; v: number };

const COLOR_PRESETS = [
  "#111827", "#ffffff", "#ef4444", "#f97316", "#facc15", "#22c55e",
  "#14b8a6", "#06b6d4", "#3b82f6", "#6366f1", "#8b5cf6", "#a855f7",
  "#ec4899", "#be123c", "#78716c", "#94a3b8",
];

function clampColorChannel(value: number): number {
  return Math.max(0, Math.min(255, Math.round(Number.isFinite(value) ? value : 0)));
}

function rgbToHex({ r, g, b }: RgbColor): string {
  return `#${[r, g, b].map((value) => clampColorChannel(value).toString(16).padStart(2, "0")).join("")}`;
}

function hexToRgb(hex: string): RgbColor | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  return {
    r: parseInt(match[1].slice(0, 2), 16),
    g: parseInt(match[1].slice(2, 4), 16),
    b: parseInt(match[1].slice(4, 6), 16),
  };
}

function rgbToHsv({ r, g, b }: RgbColor): HsvColor {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  let h = 0;
  if (delta !== 0) {
    if (max === red) h = 60 * (((green - blue) / delta) % 6);
    else if (max === green) h = 60 * ((blue - red) / delta + 2);
    else h = 60 * ((red - green) / delta + 4);
  }
  return { h: h < 0 ? h + 360 : h, s: max === 0 ? 0 : (delta / max) * 100, v: max * 100 };
}

function hsvToRgb({ h, s, v }: HsvColor): RgbColor {
  const saturation = s / 100;
  const brightness = v / 100;
  const chroma = brightness * saturation;
  const segment = ((h % 360) + 360) % 360 / 60;
  const x = chroma * (1 - Math.abs((segment % 2) - 1));
  const m = brightness - chroma;
  let red = 0;
  let green = 0;
  let blue = 0;
  if (segment < 1) [red, green] = [chroma, x];
  else if (segment < 2) [red, green] = [x, chroma];
  else if (segment < 3) [green, blue] = [chroma, x];
  else if (segment < 4) [green, blue] = [x, chroma];
  else if (segment < 5) [red, blue] = [x, chroma];
  else [red, blue] = [chroma, x];
  return { r: (red + m) * 255, g: (green + m) * 255, b: (blue + m) * 255 };
}

function ColorPickerDialog({
  open,
  color,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  color: string;
  onCancel: () => void;
  onConfirm: (color: string) => void;
}) {
  const locale = useLocale();
  const initialRgb = hexToRgb(color) ?? { r: 17, g: 24, b: 39 };
  const [hsv, setHsv] = useState<HsvColor>(() => rgbToHsv(initialRgb));
  const [hexDraft, setHexDraft] = useState(() => rgbToHex(initialRgb).toUpperCase());
  const dragging = useRef(false);
  const rgb = hsvToRgb(hsv);
  const selectedHex = rgbToHex(rgb);

  const commitHsv = (next: HsvColor) => {
    setHsv(next);
    setHexDraft(rgbToHex(hsvToRgb(next)).toUpperCase());
  };

  const commitRgb = (next: RgbColor) => {
    const normalized = {
      r: clampColorChannel(next.r),
      g: clampColorChannel(next.g),
      b: clampColorChannel(next.b),
    };
    setHsv(rgbToHsv(normalized));
    setHexDraft(rgbToHex(normalized).toUpperCase());
  };

  const updateSaturationValue = (event: ReactPointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const s = Math.max(0, Math.min(100, ((event.clientX - bounds.left) / bounds.width) * 100));
    const v = Math.max(0, Math.min(100, 100 - ((event.clientY - bounds.top) / bounds.height) * 100));
    commitHsv({ ...hsv, s, v });
  };

  return <ModalShell open={open} onClose={onCancel} labelledBy="variant-color-picker-title" overlayClassName="color-picker-overlay" panelClassName="color-picker-modal">
        <div className="modal-head">
          <h2 id="variant-color-picker-title">{t(locale, "editor.chooseColor")}</h2>
          <button type="button" className="color-picker-close" aria-label={t(locale, "editor.cancel")} onClick={onCancel}><FiX /></button>
        </div>
        <div className="modal-body color-picker-body">
          <div
            className="color-picker-plane"
            style={{ backgroundColor: `hsl(${hsv.h} 100% 50%)` }}
            onPointerDown={(event) => {
              dragging.current = true;
              event.currentTarget.setPointerCapture(event.pointerId);
              updateSaturationValue(event);
            }}
            onPointerMove={(event) => { if (dragging.current) updateSaturationValue(event); }}
            onPointerUp={(event) => {
              dragging.current = false;
              event.currentTarget.releasePointerCapture(event.pointerId);
            }}
          >
            <span className="color-picker-marker" style={{ left: `${hsv.s}%`, top: `${100 - hsv.v}%`, background: selectedHex }} />
          </div>
          <div className="color-picker-hue-row">
            <span className="color-picker-preview" style={{ background: selectedHex }} />
            <input
              className="color-picker-hue"
              type="range"
              min="0"
              max="359"
              value={Math.round(hsv.h)}
              aria-label={t(locale, "editor.colorHue")}
              onChange={(event) => commitHsv({ ...hsv, h: Number(event.target.value) })}
            />
          </div>
          <div className="color-picker-values">
            <label><input value={hexDraft} maxLength={7} onChange={(event) => {
              const next = event.target.value.startsWith("#") ? event.target.value : `#${event.target.value}`;
              setHexDraft(next.toUpperCase());
              const nextRgb = hexToRgb(next);
              if (nextRgb) setHsv(rgbToHsv(nextRgb));
            }} onBlur={() => setHexDraft(selectedHex.toUpperCase())} /><span>HEX</span></label>
            {(["r", "g", "b"] as const).map((channel) => (
              <label key={channel}>
                <input type="number" min="0" max="255" value={clampColorChannel(rgb[channel])} onChange={(event) => commitRgb({ ...rgb, [channel]: Number(event.target.value) })} />
                <span>{channel.toUpperCase()}</span>
              </label>
            ))}
          </div>
          <div className="color-picker-presets" aria-label={t(locale, "editor.commonColors")}>
            {COLOR_PRESETS.map((preset) => (
              <button
                type="button"
                key={preset}
                className={selectedHex.toLocaleLowerCase() === preset ? "is-selected" : ""}
                style={{ background: preset }}
                aria-label={preset.toUpperCase()}
                title={preset.toUpperCase()}
                onClick={() => commitRgb(hexToRgb(preset) as RgbColor)}
              />
            ))}
          </div>
        </div>
        <div className="modal-foot">
          <button type="button" className="btn btn-secondary" onClick={onCancel}>{t(locale, "editor.cancel")}</button>
          <button type="button" className="btn btn-primary" onClick={() => onConfirm(selectedHex.toLocaleLowerCase())}><FiCheck /> {t(locale, "editor.saveColor")}</button>
        </div>
  </ModalShell>;
}

function valueText(value: unknown): string {
  if (Array.isArray(value)) return value.join(", ");
  return value == null ? "" : String(value);
}

function isFilled(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  return value !== null && value !== undefined && String(value).trim() !== "";
}

function displayValue(value: unknown, locale: Locale): string {
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "boolean") return t(locale, value ? "editor.yes" : "editor.no");
  return value == null || value === "" ? "—" : String(value);
}

function optionKey(label: string): string {
  return label.trim().toLocaleLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 50);
}

function VariantValuesInput({
  values,
  onChange,
  placeholder,
}: {
  values: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
}) {
  const locale = useLocale();
  const [draft, setDraft] = useState("");

  const addValues = (raw: string) => {
    const candidates = raw.split(/[\n,]+/).map((value) => value.trim()).filter(Boolean);
    if (candidates.length === 0) return;
    const next = [...values];
    const normalized = new Set(values.map((value) => value.toLocaleLowerCase()));
    for (const value of candidates) {
      const key = value.toLocaleLowerCase();
      if (!normalized.has(key)) {
        next.push(value);
        normalized.add(key);
      }
    }
    onChange(next);
    setDraft("");
  };

  return (
    <div className="variant-values-control" onClick={(event) => event.currentTarget.querySelector("input")?.focus()}>
      {values.map((value) => (
        <span className="variant-value-chip" key={value.toLocaleLowerCase()}>
          <span>{value}</span>
          <button
            type="button"
            aria-label={t(locale, "editor.removeChoiceValue", value)}
            onClick={(event) => {
              event.stopPropagation();
              onChange(values.filter((candidate) => candidate !== value));
            }}
          >
            <FiX />
          </button>
        </span>
      ))}
      <input
        value={draft}
        placeholder={values.length === 0 ? placeholder : ""}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => addValues(draft)}
        onPaste={(event) => {
          const pasted = event.clipboardData.getData("text");
          if (/[\n,]/.test(pasted)) {
            event.preventDefault();
            addValues(`${draft}${pasted}`);
          }
        }}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing) return;
          if (event.key === "Enter" || event.key === ",") {
            event.preventDefault();
            addValues(draft);
          } else if (event.key === "Backspace" && draft === "" && values.length > 0) {
            event.preventDefault();
            onChange(values.slice(0, -1));
          }
        }}
      />
    </div>
  );
}

function VariantColorValuesInput({
  values,
  onChange,
}: {
  values: ProductVariantValue[];
  onChange: (values: ProductVariantValue[]) => void;
}) {
  const locale = useLocale();
  const [label, setLabel] = useState("");
  const [swatch, setSwatch] = useState("#111827");
  const [pickerTarget, setPickerTarget] = useState<number | "new" | null>(null);
  const renderedPickerTarget = useLastPresent(pickerTarget);

  const addColor = () => {
    const cleanLabel = label.trim();
    if (!cleanLabel) return;
    const duplicate = values.some((item) => optValue(item).toLocaleLowerCase() === cleanLabel.toLocaleLowerCase());
    if (duplicate) return;
    onChange([...values, { value: cleanLabel, label: cleanLabel, swatch: swatch.toLocaleLowerCase() }]);
    setLabel("");
  };

  return (
    <div className="variant-color-builder">
      {values.length > 0 && (
        <div className="variant-color-list">
          {values.map((item, itemIndex) => {
            const value = optValue(item);
            const itemSwatch = optSwatch(item) ?? "#111827";
            return (
              <div className="variant-color-chip" key={`${value}-${itemIndex}`}>
                <button
                  type="button"
                  className="variant-color-trigger"
                  style={{ background: itemSwatch }}
                  aria-label={t(locale, "editor.editColorValue", optLabel(item))}
                  onClick={() => setPickerTarget(itemIndex)}
                />
                <span>{optLabel(item)}</span>
                <code>{itemSwatch.toLocaleUpperCase()}</code>
                <button type="button" aria-label={t(locale, "editor.removeChoiceValue", optLabel(item))} onClick={() => onChange(values.filter((_, candidateIndex) => candidateIndex !== itemIndex))}>
                  <FiX />
                </button>
              </div>
            );
          })}
        </div>
      )}
      <div className="variant-color-add">
        <button
          type="button"
          className="variant-color-trigger"
          style={{ background: swatch }}
          aria-label={t(locale, "editor.colorValue")}
          onClick={() => setPickerTarget("new")}
        />
        <input
          className="input"
          value={label}
          placeholder={t(locale, "editor.colorNamePlaceholder")}
          onChange={(event) => setLabel(event.target.value)}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing) return;
            if (event.key === "Enter") {
              event.preventDefault();
              addColor();
            }
          }}
        />
        <button type="button" className="btn btn-secondary" onClick={addColor} disabled={!label.trim()}>
          <FiPlus /> {t(locale, "editor.addColor")}
        </button>
      </div>
      <span className="field-hint">{t(locale, "editor.colorChoiceHint")}</span>
      {renderedPickerTarget !== null && (
        <ColorPickerDialog
          open={pickerTarget !== null}
          key={`${renderedPickerTarget}-${renderedPickerTarget === "new" ? swatch : optSwatch(values[renderedPickerTarget]) ?? "#111827"}`}
          color={renderedPickerTarget === "new" ? swatch : optSwatch(values[renderedPickerTarget]) ?? "#111827"}
          onCancel={() => setPickerTarget(null)}
          onConfirm={(nextSwatch) => {
            if (renderedPickerTarget === "new") setSwatch(nextSwatch);
            else onChange(values.map((candidate, candidateIndex) => candidateIndex === renderedPickerTarget
              ? { value: optValue(candidate), label: optLabel(candidate), swatch: nextSwatch }
              : candidate));
            setPickerTarget(null);
          }}
        />
      )}
    </div>
  );
}

function AttrInput({
  def,
  value,
  onChange,
  sizeSystem = "",
}: {
  def: AttributeDef;
  value: unknown;
  onChange: (v: unknown) => void;
  sizeSystem?: string;
}) {
  const locale = useLocale();
  const options = (def.options ?? []) as Array<{ value: string; label: string; swatch?: string } | string>;
  const textValue = valueText(value);

  if (def.key === "size" && options.length === 0 && sizeSystem.toLocaleLowerCase() === "numeric") {
    return <input className="input" type="number" min="0" step="any" inputMode="decimal" value={textValue} onChange={(e) => onChange(e.target.value)} placeholder="36 / 42.5" required={def.required} />;
  }

  if (def.key === "size" && options.length === 0 && sizeSystem.toLocaleLowerCase() === "letters") {
    return <input className="input" type="text" value={textValue} onChange={(e) => onChange(e.target.value.toLocaleUpperCase())} placeholder="S / M / XL / 2Y" required={def.required} />;
  }

  if ((def.type === "select" || def.type === "text") && options.length > 0) {
    return (
      <div className="select-wrap">
        <select className="select" value={textValue} onChange={(e) => onChange(e.target.value)} required={def.required}>
          <option value="">{t(locale, "editor.choose")}</option>
          {options.map((o, i) => (
            <option key={i} value={optValue(o)}>{optLabel(o)}</option>
          ))}
        </select>
      </div>
    );
  }

  if (def.type === "multi") {
    const selected = new Set(Array.isArray(value) ? value.map(String) : []);
    return (
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        {options.map((option, i) => {
          const optionValue = optValue(option);
          return (
            <label key={i} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <input
                type="checkbox"
                checked={selected.has(optionValue)}
                onChange={(e) => {
                  const next = new Set(selected);
                  if (e.target.checked) next.add(optionValue);
                  else next.delete(optionValue);
                  onChange(Array.from(next));
                }}
              />
              {optLabel(option)}
            </label>
          );
        })}
      </div>
    );
  }

  if (def.type === "color") {
    if (options.length > 0) {
      const selectedSwatch = optSwatch(options.find((option) => optValue(option) === textValue)) ?? textValue;
      return (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ width: 32, height: 32, borderRadius: "50%", background: selectedSwatch || "transparent", border: "1px solid var(--hairline)", flexShrink: 0 }} />
          <div className="select-wrap" style={{ flex: 1 }}>
            <select className="select" value={textValue} onChange={(e) => onChange(e.target.value)} required={def.required}>
              <option value="">{t(locale, "editor.choose")}</option>
              {options.map((o, i) => (
                <option key={i} value={optValue(o)}>{optLabel(o)}</option>
              ))}
            </select>
          </div>
        </div>
      );
    }
    const colorValue = /^#[0-9a-f]{6}$/i.test(textValue) ? textValue : "#000000";
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <input type="color" value={colorValue} onChange={(e) => onChange(e.target.value)}
          style={{ width: 40, height: 36, border: "1px solid var(--hairline)", borderRadius: "var(--r-sm)", cursor: "pointer", padding: 2 }} />
        <input className="input" value={textValue} onChange={(e) => onChange(e.target.value)} placeholder="#000000" pattern="#[0-9a-fA-F]{6}" required={def.required} style={{ flex: 1 }} />
      </div>
    );
  }

  if (def.type === "number") {
    return <input className="input" type="number" step="any" value={textValue} onChange={(e) => onChange(e.target.value)} placeholder={t(locale, "editor.enterValue")} required={def.required} />;
  }

  if (def.type === "boolean") {
    return (
      <select className="select" value={textValue} onChange={(e) => onChange(e.target.value)} required={def.required}>
        <option value="">{t(locale, "editor.choose")}</option>
        <option value="true">{t(locale, "editor.yes")}</option>
        <option value="false">{t(locale, "editor.no")}</option>
      </select>
    );
  }

  if (def.type === "date") {
    return <input className="input" type="date" value={textValue} onChange={(e) => onChange(e.target.value)} required={def.required} />;
  }

  return <input className="input" value={textValue} onChange={(e) => onChange(e.target.value)} placeholder={t(locale, "editor.enterValue")} required={def.required} />;
}

/* ── Extra field definitions: what each key maps to in the UI ─────────── */
interface ExtraFieldDef {
  key: string;
  label: string;
  type: "text" | "number" | "select" | "date" | "url" | "string_list";
  placeholder?: string;
  options?: string[];
  unit?: string;
}

const ALL_EXTRA_FIELDS: ExtraFieldDef[] = [
  { key: "sku", label: "SKU", type: "text", placeholder: "SKU-001" },
  { key: "barcode", label: "Barcode", type: "text", placeholder: "EAN-13, UPC-A…" },
  { key: "product_type", label: "Product Type", type: "select", options: ["standard", "digital", "service"] },
  { key: "weight", label: "Weight", type: "number", placeholder: "—" },
  { key: "weight_unit", label: "Weight Unit", type: "select", options: ["g", "kg", "oz", "lb"] },
  { key: "length", label: "Length", type: "number", placeholder: "L" },
  { key: "width", label: "Width", type: "number", placeholder: "W" },
  { key: "height", label: "Height", type: "number", placeholder: "H" },
  { key: "dimension_unit", label: "Dim. Unit", type: "select", options: ["mm", "cm", "in"] },
  { key: "unit", label: "Unit", type: "select", options: ["piece", "kg", "g", "lb", "oz", "m", "m2", "l", "ml", "yd", "ft", "roll", "box", "pair"] },
  { key: "unit_price", label: "Price per unit", type: "number" },
  { key: "meta_title", label: "SEO Title", type: "text", placeholder: "Page title for search engines…" },
  { key: "meta_description", label: "SEO Description", type: "text", placeholder: "Brief description for search engines…" },
  { key: "tags", label: "Tags", type: "text", placeholder: "summer, new-arrival, sale…" },
  { key: "expiry_date", label: "Expiry Date", type: "date" },
  { key: "batch_number", label: "Batch / Lot #", type: "text" },
  { key: "download_url", label: "Download URL", type: "url", placeholder: "https://…" },
  { key: "min_quantity", label: "Min. Order Qty", type: "number" },
  { key: "step", label: "Order Step", type: "number" },
];

function getExtraFields(config: Record<string, RetailFieldConfig | undefined>, units: string[] = []): ExtraFieldDef[] {
  if (!config) return [];
  const promotedFields = new Set(["meta_title", "meta_description", "tags"]);
  return ALL_EXTRA_FIELDS
    .filter((f) => config[f.key]?.enabled !== false && config[f.key]?.visible && !promotedFields.has(f.key))
    .sort((a, b) => (config[a.key]?.sort_order ?? 0) - (config[b.key]?.sort_order ?? 0))
    .map((field) => {
      const fieldConfig = config[field.key];
      return {
        ...field,
        type: fieldConfig?.type ?? field.type,
        options: fieldConfig?.choices ?? (field.key === "unit" && units.length ? units : field.options),
      };
    });
}

function renderExtraField(
  f: ExtraFieldDef,
  value: unknown,
  onChange: (v: string) => void,
  _locale: string,
  required?: boolean,
) {
  const textValue = valueText(value);
  if (f.type === "select" && f.options) {
    return (
      <div className="select-wrap">
        <select className="select" value={textValue} onChange={(e) => onChange(e.target.value)} required={required}>
          <option value="">—</option>
          {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
    );
  }
  return (
    <input className="input"
      type={f.type === "number" ? "number" : f.type === "date" ? "date" : f.type === "url" ? "url" : "text"}
      step={f.type === "number" ? "any" : undefined}
      min={f.type === "number" ? "0" : undefined}
      value={textValue}
      onChange={(e) => onChange(e.target.value)}
      placeholder={f.placeholder}
      required={required}
    />
  );
}

const EXTRA_GROUPS = [
  { label: "Identification", keys: ["sku", "barcode", "product_type"] },
  { label: "Shipping", keys: ["weight", "weight_unit", "length", "width", "height", "dimension_unit"] },
  { label: "Unit Pricing", keys: ["unit", "unit_price"] },
  { label: "Perishable / Batch", keys: ["expiry_date", "batch_number"] },
  { label: "Digital", keys: ["download_url"] },
  { label: "Weight-Based", keys: ["min_quantity", "step"] },
  { label: "SEO & Tags", keys: ["meta_title", "meta_description", "tags"] },
];

interface ProductEditorDraft {
  storeId: number;
  name: string;
  slug: string;
  ref: string;
  section: number | "";
  price: string;
  compareAtPrice: string;
  costPrice: string;
  promo: string;
  loyalty: string;
  description: string;
  tags: string;
  seoTitle: string;
  seoDescription: string;
  seoSocialImage: string;
  categoryIds: number[];
  vendorIds: number[];
  relatedProductIds: number[];
  variantsEnabled: boolean;
  relatedProductsEnabled: boolean;
  simpleQuantity: string;
  variantOptions: ProductVariantOption[];
  trackInventory: boolean;
  isActive: boolean;
  isFeatured: boolean;
  merchandisingOrder: string;
  extra: Record<string, unknown>;
  productAttrs: Record<string, unknown>;
}

interface ProductEditorReturnState {
  productDraftKey?: string;
  createdSectionId?: number;
}

export function ProductEditorPage() {
  const { id } = useParams();
  const productId = id && id !== "new" ? Number(id) : null;
  const { store } = useStore();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const locale = useLocale();
  const coverFileRef = useRef<HTMLInputElement>(null);
  const galleryFileRef = useRef<HTMLInputElement>(null);
  const draftRestoredRef = useRef(false);

  const [tab, setTab] = useState<"details" | "variants" | "images">(
    new URLSearchParams(location.search).get("tab") === "variants" ? "variants" : "details",
  );

  useEffect(() => {
    if (new URLSearchParams(location.search).get("tab") === "variants" && productId) setTab("variants");
  }, [location.search, productId]);

  /* ── Core product fields ──────────────────────────────── */
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [ref, setRef] = useState("");
  const [referenceError, setReferenceError] = useState(false);
  const [choiceError, setChoiceError] = useState(false);
  const [section, setSection] = useState<number | "">("");
  const [price, setPrice] = useState("");
  const [compareAtPrice, setCompareAtPrice] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [promo, setPromo] = useState("");
  const [loyalty, setLoyalty] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [seoSocialImage, setSeoSocialImage] = useState("");
  const [categoryIds, setCategoryIds] = useState<number[]>([]);
  const [vendorIds, setVendorIds] = useState<number[]>([]);
  const [relatedProductIds, setRelatedProductIds] = useState<number[]>([]);
  const [variantsEnabled, setVariantsEnabled] = useState(false);
  const [relatedProductsEnabled, setRelatedProductsEnabled] = useState(false);
  const [clearVariantsOnSave, setClearVariantsOnSave] = useState(false);
  const [showDisableVariantsConfirm, setShowDisableVariantsConfirm] = useState(false);
  const [showDisableRelatedConfirm, setShowDisableRelatedConfirm] = useState(false);
  const [relatedQuery, setRelatedQuery] = useState("");
  const [simpleQuantity, setSimpleQuantity] = useState("0");
  const [variantOptions, setVariantOptions] = useState<ProductVariantOption[]>([]);
  const [trackInventory, setTrackInventory] = useState(true);
  const [isActive, setIsActive] = useState(true);
  const [isFeatured, setIsFeatured] = useState(false);
  const [merchandisingOrder, setMerchandisingOrder] = useState("0");
  const [saving, setSaving] = useState(false);

  /* ── Config-driven extra ──────────────────────────────── */
  const [extra, setExtra] = useState<Record<string, unknown>>({});

  /* ── Product-level attributes ─────────────────────────── */
  const [productAttrs, setProductAttrs] = useState<Record<string, unknown>>({});

  /* ── Variants ────────────────────────────────────────── */
  const [variants, setVariants] = useState<StockVariant[]>([]);
  const [imgBusy, setImgBusy] = useState(false);
  const [imgBusyText, setImgBusyText] = useState("");
  const [imgProgress, setImgProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const renderedDeleteTarget = useLastPresent(deleteTarget);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [showVariantModal, setShowVariantModal] = useState(false);
  const [variantAttrs, setVariantAttrs] = useState<Record<string, unknown>>({});
  const [variantPrice, setVariantPrice] = useState("");
  const [variantQty, setVariantQty] = useState("0");
  const [variantExtra, setVariantExtra] = useState<Record<string, unknown>>({});
  const [variantSaving, setVariantSaving] = useState(false);
  const [variantFieldErrors, setVariantFieldErrors] = useState<Record<string, string>>({});
  const [variantImageErrors, setVariantImageErrors] = useState<Record<number, boolean>>({});

  /* ── Data fetching ───────────────────────────────────── */
  const { data: sections, loading: sectionsLoading, error: sectionsError, reload: reloadSections } = useAsync<CatalogSection[]>(
    () => (store ? api.listSections(store.id) : Promise.resolve([])),
    [store?.id],
  );

  const { data: retailTypes, loading: retailTypesLoading, error: retailTypesError, reload: reloadRetailTypes } = useAsync<RetailType[]>(
    () => (store?.retail_type_detail ? Promise.resolve([]) : api.listRetailTypes()),
    [store?.retail_type_detail?.id],
  );

  const { data: vendors } = useAsync<ProductVendor[]>(
    () => (store ? api.listProductVendors(store.id) : Promise.resolve([])),
    [store?.id],
  );

  const { data: catalogProducts } = useAsync<Product[]>(
    () => (store ? api.listProducts(store.id) : Promise.resolve([])),
    [store?.id, productId],
  );

  const { data: product, loading, error: productError, reload } = useAsync<Product | null>(
    () => (productId && store ? api.listProducts(store.id).then((ps) => ps.find((p) => p.id === productId) ?? null) : Promise.resolve(null)),
    [store?.id, productId],
  );

  /* ── Derive config from store.retail_type ────── */
  const retailType = useMemo(() => {
    if (store?.retail_type_detail) return store.retail_type_detail;
    if (retailTypes?.length) return retailTypes.find((type) => type.key === "general") ?? null;
    return null;
  }, [store?.retail_type_detail, retailTypes]);

  const catalogConfig = store?.catalog_config ?? retailType?.config;
  const productFieldsCfg = useMemo(() => catalogConfig?.product_fields ?? {}, [catalogConfig]);
  const variantFieldsCfg = useMemo(() => catalogConfig?.variant_fields ?? {}, [catalogConfig]);
  const features = useMemo(() => catalogConfig?.features ?? {}, [catalogConfig]);
  const units = useMemo(() => catalogConfig?.units ?? [], [catalogConfig]);
  const visibleProductFields = useMemo(() => getExtraFields(productFieldsCfg, units), [productFieldsCfg, units]);
  const visibleVariantFields = useMemo(() => getExtraFields(variantFieldsCfg, units), [variantFieldsCfg, units]);

  /* ── Prefill ──────────────────────────────────────────── */
  useEffect(() => {
    if (!product) return;
    setName(product.name);
    setSlug(product.slug ?? "");
    setRef(product.ref);
    setReferenceError(false);
    setChoiceError(false);
    setSection(product.section);
    setPrice(String(product.price));
    setCompareAtPrice(product.compare_at_price == null ? "" : String(product.compare_at_price));
    setCostPrice(product.cost_price == null ? "" : String(product.cost_price));
    setPromo(product.promo ? String(product.promo) : "");
    setLoyalty(String(product.loyalty_points ?? 0));
    setDescription(product.description);
    setTags((product.tags ?? []).join(", "));
    setSeoTitle(product.seo_title ?? "");
    setSeoDescription(product.seo_description ?? "");
    setSeoSocialImage(product.seo_social_image ?? "");
    setCategoryIds((product.categories ?? []).map((category) => category.id));
    setVendorIds((product.vendors ?? []).map((vendor) => vendor.id));
    setRelatedProductIds(product.related_product_ids ?? []);
    setVariantsEnabled(product.uses_variants ?? visibleMerchantVariants(product.variants ?? []).length > 0);
    setRelatedProductsEnabled(product.show_related_products ?? (product.related_product_ids ?? []).length > 0);
    setClearVariantsOnSave(false);
    setTrackInventory(product.track_inventory !== false);
    setIsActive(product.is_active);
    setIsFeatured(product.is_featured);
    setMerchandisingOrder(String(product.merchandising_order ?? 0));
    // Load extra fields into state
    const e: Record<string, unknown> = {};
    for (const f of visibleProductFields) {
      const v = product.extra?.[f.key];
      e[f.key] = v ?? "";
    }
    setExtra(e);
    setProductAttrs(product.attributes ?? {});
    setVariantOptions(product.variant_options ?? []);
  }, [product, visibleProductFields]);

  useEffect(() => {
    if (product) {
      setVariants(product.variants ?? []);
      setVariantImageErrors({});
      const simpleInventory = (product.variants ?? []).find((variant) => Object.keys(variant.attributes ?? {}).length === 0);
      setSimpleQuantity(String(simpleInventory?.quantity ?? 0));
    }
  }, [product]);

  useEffect(() => {
    const returnState = location.state as ProductEditorReturnState | null;
    if (draftRestoredRef.current || !returnState?.productDraftKey || !store) return;
    if (productId && !product) return;
    try {
      const raw = sessionStorage.getItem(returnState.productDraftKey);
      const draft = raw ? JSON.parse(raw) as ProductEditorDraft : null;
      if (draft?.storeId === store.id) {
        setName(draft.name);
        setSlug(draft.slug);
        setRef(draft.ref);
        setSection(returnState.createdSectionId ?? draft.section);
        setPrice(draft.price);
        setCompareAtPrice(draft.compareAtPrice);
        setCostPrice(draft.costPrice);
        setPromo(draft.promo);
        setLoyalty(draft.loyalty);
        setDescription(draft.description);
        setTags(draft.tags);
        setSeoTitle(draft.seoTitle);
        setSeoDescription(draft.seoDescription);
        setSeoSocialImage(draft.seoSocialImage ?? "");
        setCategoryIds(draft.categoryIds);
        setVendorIds(draft.vendorIds);
        setRelatedProductIds(draft.relatedProductIds);
        setVariantsEnabled(draft.variantsEnabled);
        setRelatedProductsEnabled(draft.relatedProductsEnabled);
        setSimpleQuantity(draft.simpleQuantity);
        setVariantOptions(draft.variantOptions);
        setTrackInventory(draft.trackInventory);
        setIsActive(draft.isActive);
        setIsFeatured(draft.isFeatured);
        setMerchandisingOrder(draft.merchandisingOrder);
        setExtra(draft.extra);
        setProductAttrs(draft.productAttrs);
        setTab("details");
      }
      sessionStorage.removeItem(returnState.productDraftKey);
    } catch {
      // Storage can be unavailable; returning to the editor must still work.
    }
    draftRestoredRef.current = true;
    navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
  }, [location.pathname, location.search, location.state, navigate, product, productId, store]);

  const allDefs = useMemo(() => sectionDefs(sections ?? [], section as number), [sections, section]);
  const categoryVariantDefs = useMemo(() => allDefs.filter((d) => d.level !== "product"), [allDefs]);
  const variantDefs = useMemo<AttributeDef[]>(() => {
    if (variantOptions.length === 0) return categoryVariantDefs;
    return variantOptions.map((option, index) => ({
      id: -(index + 1),
      key: option.key,
      label: option.label,
      type: option.type,
      level: "variant",
      options: option.values.map((value) => ({ value: optValue(value), label: optLabel(value), swatch: optSwatch(value) })),
      required: true,
      sort_order: index,
    }));
  }, [categoryVariantDefs, variantOptions]);
  const productDefs = useMemo(() => allDefs.filter((d) => d.level === "product"), [allDefs]);
  const merchantVariants = useMemo(
    () => visibleMerchantVariants(variants),
    [variants],
  );
  const requiresMerchantVariant = variantsEnabled;
  const inventoryReady = Boolean(product?.inventory_ready || variants.length > 0);
  const publicationReady = productPublicationReady(requiresMerchantVariant, inventoryReady, variants, variantsEnabled);
  const images = product?.images ?? [];
  const coverImage = images.find((image) => image.is_primary) ?? null;
  const galleryImages = images.filter((image) => !image.is_primary);
  const sectionLocked = Boolean(productId && merchantVariants.length > 0);
  const variantOptionsSaved = Boolean(productId)
    && JSON.stringify(product?.variant_options ?? []) === JSON.stringify(variantOptions);
  const suggestedProductOptions = useMemo<ProductVariantOption[]>(() => categoryVariantDefs.map((definition) => ({
    key: definition.key,
    label: definition.label,
    type: definition.type === "color" ? "color" : definition.type === "text" ? "text" : "select",
    values: (definition.options ?? []).map((option) => definition.type === "color" && optSwatch(option)
      ? { value: optValue(option), label: optLabel(option), swatch: optSwatch(option) }
      : optValue(option)).filter((value) => Boolean(optValue(value))),
  })), [categoryVariantDefs]);
  const variantOptionsComplete = !variantsEnabled || (
    variantOptions.length > 0
      ? variantOptions.every((option) => option.label.trim() && option.key && option.values.length > 0)
        && new Set(variantOptions.map((option) => option.key)).size === variantOptions.length
      : categoryVariantDefs.length > 0
  );
  const productComplete = productDefs.filter((d) => d.required).every((d) => isFilled(productAttrs[d.key]))
    && visibleProductFields.every((f) => !productFieldsCfg[f.key]?.required || isFilled(extra[f.key]));
  const saveDisabled = saving || !name.trim() || !ref.trim() || section === "" || !productComplete || !variantOptionsComplete;

  function enableVariants() {
    if (variantOptions.length === 0 && merchantVariants.length === 0) {
      setVariantOptions(suggestedProductOptions.length > 0
        ? suggestedProductOptions
        : [{ key: "option", label: "", type: "select", values: [] }]);
    }
    setVariantsEnabled(true);
    setClearVariantsOnSave(false);
    setIsActive(false);
    if (productId) setTab("variants");
  }
  const relatedChoices = useMemo(() => {
    const normalized = relatedQuery.trim().toLocaleLowerCase();
    return (catalogProducts ?? [])
      .filter((item) => item.id !== productId)
      .filter((item) => !normalized || `${item.name} ${item.ref}`.toLocaleLowerCase().includes(normalized));
  }, [catalogProducts, productId, relatedQuery]);

  function createSection() {
    if (!store || sectionLocked) return;
    const draftKey = `dashboard.product-draft:${store.id}:${productId ?? "new"}`;
    const draft: ProductEditorDraft = {
      storeId: store.id,
      name,
      slug,
      ref,
      section,
      price,
      compareAtPrice,
      costPrice,
      promo,
      loyalty,
      description,
      tags,
      seoTitle,
      seoDescription,
      seoSocialImage,
      categoryIds,
      vendorIds,
      relatedProductIds,
      variantsEnabled,
      relatedProductsEnabled,
      simpleQuantity,
      variantOptions,
      trackInventory,
      isActive,
      isFeatured,
      merchandisingOrder,
      extra,
      productAttrs,
    };
    try {
      sessionStorage.setItem(draftKey, JSON.stringify(draft));
    } catch {
      // Navigation remains available when private storage is disabled.
    }
    navigate("/sections", {
      state: {
        createSection: true,
        returnTo: `${location.pathname}${location.search}`,
        productDraftKey: draftKey,
      },
    });
  }

  /* ── Save ────────────────────────────────────────────── */
  async function save(e?: FormEvent, publicationOverride?: boolean) {
    if (e) e.preventDefault();
    if (!store) return;
    const form = document.querySelector<HTMLFormElement>("form.editor-pane");
    if (form && !form.reportValidity()) return;
    setSaving(true);
    setReferenceError(false);
    setChoiceError(false);
    try {
      const payload: Record<string, unknown> = {
        name, slug, ref, section,
        price: Number(price) || 0,
        compare_at_price: compareAtPrice === "" ? null : Number(compareAtPrice),
        cost_price: costPrice === "" ? null : Number(costPrice),
        description,
        tags: tags.split(",").map((tag) => tag.trim()).filter(Boolean),
        seo_title: seoTitle,
        seo_description: seoDescription,
        seo_social_image: seoSocialImage,
        category_ids: Array.from(new Set([...(section === "" ? [] : [section]), ...categoryIds])),
        vendor_ids: vendorIds,
        related_product_ids: relatedProductsEnabled ? relatedProductIds : [],
        uses_variants: variantsEnabled,
        clear_variants: clearVariantsOnSave,
        show_related_products: relatedProductsEnabled,
        track_inventory: trackInventory,
        is_active: (publicationOverride ?? isActive) && publicationReady,
        is_featured: isFeatured,
        merchandising_order: Number(merchandisingOrder) || 0,
        attributes: productAttrs,
        variant_options: variantsEnabled ? variantOptions : [],
        extra: { ...extra },
      };
      if (promo !== "" && Number(promo) > 0) payload.promo = Number(promo);
      if (loyalty !== "") payload.loyalty_points = Number(loyalty) || 0;
      // Coerce number fields
      for (const f of visibleProductFields) {
        if (f.type === "number" && isFilled(extra[f.key])) {
          (payload.extra as Record<string, unknown>)[f.key] = Number(extra[f.key]);
        }
      }

      if (productId) {
        const updatedProduct = await api.updateProduct(store.id, productId, payload);
        if (!variantsEnabled && trackInventory) {
          const simpleInventory = updatedProduct.variants.find((variant) => Object.keys(variant.attributes ?? {}).length === 0);
          if (simpleInventory && Number(simpleQuantity) !== simpleInventory.quantity) {
            await api.updateVariant(store.id, productId, simpleInventory.id, { quantity: Number(simpleQuantity) || 0 });
          }
        }
        setClearVariantsOnSave(false);
        if (publicationOverride !== undefined) {
          setIsActive(publicationOverride);
          toast.push("success", t(locale, publicationOverride ? "editor.published" : "editor.unpublished"));
        } else {
          toast.push("success", t(locale, "editor.updated"));
        }
        reload();
      } else {
        const created = await api.createProduct(store.id, payload);
        if (!variantsEnabled && trackInventory) {
          const simpleInventory = created.variants.find((variant) => Object.keys(variant.attributes ?? {}).length === 0);
          if (simpleInventory && Number(simpleQuantity) !== simpleInventory.quantity) {
            await api.updateVariant(store.id, created.id, simpleInventory.id, { quantity: Number(simpleQuantity) || 0 });
          }
        }
        const needsVariants = created.uses_variants && !created.inventory_ready;
        toast.push("success", t(locale, needsVariants ? "editor.createdDraft" : "editor.created"));
        navigate(`/products/${created.id}${needsVariants ? "?tab=variants" : ""}`, { replace: true });
      }
    } catch (err) {
      const referenceMessages = err instanceof ApiError && err.status === 400 ? err.payload?.ref : null;
      if (Array.isArray(referenceMessages) && referenceMessages.includes("This reference is already used in this store.")) {
        setReferenceError(true);
        setTab("details");
      } else if (err instanceof ApiError && err.status === 400 && Array.isArray(err.payload?.uses_variants)
        && err.payload.uses_variants.some(message => typeof message === "string" && message.includes("reserved"))) {
        setChoiceError(true);
        setTab("details");
      } else {
        toast.push("error", friendlyError(err, locale, "editor.saveFailed"));
      }
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!store || !productId) return;
    setDeleting(true);
    try {
      await api.deleteProduct(store.id, productId);
      toast.push("success", t(locale, "editor.deleted"));
      setShowDeleteConfirm(false);
      navigate("/products", { replace: true });
    } catch (err) {
      toast.push("error", friendlyError(err, locale, "editor.deleteFailed"));
    } finally {
      setDeleting(false);
    }
  }

  /* ── Variant helpers ─────────────────────────────────── */
  function openAddVariant() {
    setVariantFieldErrors({});
    const initial: Record<string, unknown> = {};
    for (const d of variantDefs) initial[d.key] = "";
    setVariantAttrs(initial);
    setVariantPrice(price);
    setVariantQty("0");
    const ve: Record<string, unknown> = {};
    for (const f of visibleVariantFields) ve[f.key] = "";
    setVariantExtra(ve);
    setShowVariantModal(true);
  }

  async function saveVariant() {
    if (!store || !productId) return;
    setVariantSaving(true);
    setVariantFieldErrors({});
    try {
      const extraPayload: Record<string, unknown> = {};
      for (const f of visibleVariantFields) {
        if (isFilled(variantExtra[f.key])) {
          extraPayload[f.key] = f.type === "number" ? Number(variantExtra[f.key]) : variantExtra[f.key];
        }
      }
      const v = await api.createVariant(store.id, productId, {
        attributes: variantAttrs,
        price: variantPrice !== "" ? Number(variantPrice) : null,
        quantity: Number(variantQty) || 0,
        extra: extraPayload,
      });
      setVariants((prev) => prev.some((item) => item.id === v.id)
        ? prev.map((item) => (item.id === v.id ? v : item))
        : [...prev, v]);
      setShowVariantModal(false);
      toast.push("success", t(locale, "editor.variantAdded"));
    } catch (err) {
      const extra = err instanceof ApiError && err.status === 400 ? err.payload?.extra : null;
      const errors: Record<string, string> = {};
      if (extra && typeof extra === "object" && !Array.isArray(extra)) {
        for (const [field, messages] of Object.entries(extra)) {
          if (!visibleVariantFields.some((item) => item.key === field)) continue;
          const duplicate = Array.isArray(messages) && messages.includes(`This ${field} is already used in this store.`);
          errors[field] = duplicate && field === "sku" ? "editor.duplicateSku"
            : duplicate && field === "barcode" ? "editor.duplicateBarcode" : "editor.checkVariantField";
        }
      }
      setVariantFieldErrors(errors);
      if (Object.keys(errors).length === 0) toast.push("error", friendlyError(err, locale, "editor.variantAddFailed"));
    } finally {
      setVariantSaving(false);
    }
  }

  async function patchVariant(v: StockVariant, patch: Record<string, unknown>) {
    if (!store || !productId) return;
    setVariantImageErrors(current => ({ ...current, [v.id]: false }));
    try {
      const updated = await api.updateVariant(store.id, productId, v.id, patch);
      setVariants((prev) => prev.map((x) => (x.id === v.id ? { ...x, ...updated } : x)));
    } catch (err) {
      if (err instanceof ApiError && err.status === 400 && err.payload?.image_id) {
        setVariantImageErrors(current => ({ ...current, [v.id]: true }));
      } else {
        toast.push("error", friendlyError(err, locale, "editor.variantSaveFailed"));
      }
    }
  }

  async function deleteVariant(v: StockVariant) {
    if (!store || !productId) return;
    try {
      await api.deleteVariant(store.id, productId, v.id);
      setVariants((prev) => prev.filter((x) => x.id !== v.id));
      toast.push("success", t(locale, "editor.variantRemoved"));
    } catch (err) {
      toast.push("error", friendlyError(err, locale, "editor.variantDeleteFailed"));
    }
  }

  /* ── Image helpers ───────────────────────────────────── */
  async function uploadImage(files: FileList | null, asCover = false) {
    if (!store || !productId || !files?.length) return;
    setImgBusy(true);
    setImgProgress(0);
    setImgBusyText(t(locale, "editor.uploading"));
    try {
      const pending = Array.from(files);
      const progress = pending.map(() => 0);
      let nextIndex = 0;
      let completed = 0;
      const worker = async () => {
        while (nextIndex < pending.length) {
          const index = nextIndex++;
          await api.uploadImage(store.id, productId, pending[index], asCover && index === 0, (fileProgress) => {
            progress[index] = fileProgress;
            setImgProgress(Math.round(progress.reduce((sum, value) => sum + value, 0) / pending.length));
          });
          completed += 1;
          setImgBusyText(`${t(locale, "editor.uploading")} (${completed}/${pending.length})`);
        }
      };
      await Promise.all(Array.from({ length: Math.min(3, pending.length) }, worker));
      toast.push("success", files.length === 1 ? t(locale, "editor.imageUploaded") : t(locale, "editor.imagesUploaded", files.length));
      reload();
    } catch (err) {
      toast.push("error", friendlyError(err, locale, "editor.imageUploadFailed"));
    } finally {
      setImgBusy(false);
      setImgBusyText("");
      setImgProgress(0);
      if (coverFileRef.current) coverFileRef.current.value = "";
      if (galleryFileRef.current) galleryFileRef.current.value = "";
    }
  }

  async function confirmDeleteImage(imageId: number) {
    if (!store || !productId) return;
    setDeleteTarget(null);
    setImgBusy(true);
    setImgBusyText(t(locale, "editor.removing"));
    try {
      await api.deleteImage(store.id, productId, imageId);
      toast.push("success", t(locale, "editor.imageRemoved"));
      reload();
    } catch (err) {
      toast.push("error", friendlyError(err, locale, "editor.imageRemoveFailed"));
    } finally {
      setImgBusy(false);
      setImgBusyText("");
    }
  }

  function onDrop(e: DragEvent) { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files.length) uploadImage(e.dataTransfer.files, false); }
  function onDragOver(e: DragEvent) { e.preventDefault(); setDragOver(true); }
  function onDragLeave() { setDragOver(false); }

  const variantComplete = variantDefs.filter((d) => d.required).every((d) => isFilled(variantAttrs[d.key]))
    && visibleVariantFields.every((f) => !variantFieldsCfg[f.key]?.required || isFilled(variantExtra[f.key]));

  const schemaLoading = sectionsLoading || (!store?.retail_type_detail && retailTypesLoading);
  const loadError = sectionsError || productError || (!store?.retail_type_detail ? retailTypesError : null);

  if (loading || schemaLoading) return <div className="card"><PageLoader /></div>;

  if (loadError) {
    return (
      <EmptyState
        icon={<FiPackage />}
        title={t(locale, "products.loadError")}
        sub={loadError}
        action={(
          <button className="btn btn-secondary" onClick={() => { reloadSections(); reloadRetailTypes(); reload(); }}>
            {t(locale, "errors.tryAgain")}
          </button>
        )}
      />
    );
  }

  if (productId && !product) {
    return (
      <EmptyState
        icon={<FiPackage />}
        title={t(locale, "products.loadError")}
        sub={`Product #${productId} was not found.`}
        action={<button className="btn btn-secondary" onClick={() => navigate("/products")}><FiArrowLeft /> {t(locale, "storeCreate.back")}</button>}
      />
    );
  }

  return (
    <div>
      <div className="page-head">
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <button className="btn btn-ghost" onClick={() => navigate("/products")}><FiArrowLeft /></button>
          <div>
            <h1 className="d-title">{productId ? name || t(locale, "editor.editTitle") : t(locale, "editor.newTitle")}</h1>
            <p className="d-subtitle">{productId ? t(locale, "editor.ref", ref || "—") : t(locale, "editor.newSub")}</p>
          </div>
        </div>
        <div className="page-head-actions">
          {productId && publicationReady && (
            <button
              className={isActive ? "btn btn-secondary" : "btn btn-primary"}
              onClick={() => void save(undefined, !isActive)}
              disabled={saving || (!isActive && saveDisabled)}
            >
              {saving ? <span className="spin" /> : <FiCheck />}
              {t(locale, isActive ? "editor.unpublish" : "editor.publish")}
            </button>
          )}
        </div>
      </div>

      {productId && variantsEnabled && !publicationReady && (
        <div className="product-readiness is-draft product-draft-notice" role="status">
          <FiLayers />
          <div>
            <strong>{t(locale, "editor.draftNotVisible")}</strong>
            <span>{t(locale, "editor.draftNeedsVariant")}</span>
          </div>
          {tab !== "variants" && (
            <button className="btn btn-secondary btn-sm" type="button" onClick={() => setTab("variants")}>
              {t(locale, "editor.setUpOptions")}
            </button>
          )}
        </div>
      )}

      <div className="editor-layout">
        <div className="editor-tabs">
          <button className={`editor-tab${tab === "details" ? " active" : ""}`} onClick={() => setTab("details")}><FiPackage /> {t(locale, "editor.details")}</button>
          {features.has_variants !== false && variantsEnabled && (
            <button className={`editor-tab${tab === "variants" ? " active" : ""}`} onClick={() => setTab("variants")}>
              <FiLayers /> {t(locale, "editor.variants")} {merchantVariants.length > 0 && <span className="nav-count">{merchantVariants.length}</span>}
            </button>
          )}
          <button className={`editor-tab${tab === "images" ? " active" : ""}`} onClick={() => setTab("images")}>
            <FiImage /> {t(locale, "editor.images")} {images.length > 0 && <span className="nav-count">{images.length}</span>}
          </button>
        </div>

        {/* ── DETAILS TAB ──────────────────────────────────── */}
        {tab === "details" && (
          <form className="editor-pane product-editor-form" onSubmit={save}>
            {choiceError && <p className="field-error" role="alert">{t(locale, "editor.choicesReserved")}</p>}
            <section className="product-form-card" aria-labelledby="product-essentials-title">
              <div className="product-form-card-head">
                <div>
                  <h2 id="product-essentials-title">{t(locale, "editor.essentialsTitle")}</h2>
                  <p>{t(locale, "editor.essentialsHint")}</p>
                </div>
              </div>
              <div className="editor-row">
                <div className="field product-name-field">
                  <label className="field-label">{t(locale, "editor.nameLabel")}</label>
                  <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder={t(locale, "editor.namePh")} required />
                </div>
                <div className="field">
                  <label className="field-label">{t(locale, "editor.refLabel")}</label>
                  <input className="input" value={ref} onChange={(e) => { setRef(e.target.value); setReferenceError(false); }} placeholder={t(locale, "editor.refPh")} required aria-invalid={referenceError || undefined} aria-describedby={referenceError ? "product-reference-error" : undefined} />
                  {referenceError && <span id="product-reference-error" className="field-error" role="alert">{t(locale, "editor.duplicateReference")}</span>}
                </div>
                <div className="field">
                  <label className="field-label">{t(locale, "editor.sectionLabel")}</label>
                  <div className="select-wrap">
                    <select
                      className="select"
                      value={section}
                      onChange={(e) => {
                        if (e.target.value === "__create_section__") {
                          createSection();
                          return;
                        }
                        const nextSection = e.target.value === "" ? "" : Number(e.target.value);
                        setSection(nextSection);
                        setProductAttrs({});
                        if (merchantVariants.length === 0) {
                          setVariantOptions([]);
                          setVariantsEnabled(false);
                          setClearVariantsOnSave(false);
                        }
                      }}
                      required
                      disabled={sectionLocked}
                      title={sectionLocked ? "Remove existing variants before changing the section." : undefined}
                    >
                      <option value="" disabled>{t(locale, "editor.chooseSection")}</option>
                      {(sections ?? []).map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                      {!sectionLocked && <option value="__create_section__">＋ {t(locale, "editor.createSectionOption")}</option>}
                    </select>
                  </div>
                  {!sectionLocked && (sections ?? []).length === 0 && (
                    <button type="button" className="product-section-empty-action" onClick={createSection}>
                      <FiPlus />
                      <span><strong>{t(locale, "editor.createFirstSection")}</strong><small>{t(locale, "editor.createFirstSectionHint")}</small></span>
                    </button>
                  )}
                </div>
              </div>
              <div className="field">
                <label className="field-label">{t(locale, "editor.descLabel")}</label>
                <RichTextEditor
                  value={description}
                  onChange={setDescription}
                  placeholder={t(locale, "editor.descPh")}
                  labels={richTextLabels(locale)}
                />
              </div>
            </section>

            <section className="product-form-card" aria-labelledby="product-pricing-title">
              <div className="product-form-card-head">
                <div>
                  <h2 id="product-pricing-title">{t(locale, "editor.pricingTitle")}</h2>
                  <p>{t(locale, "editor.pricingHint")}</p>
                </div>
              </div>
              <div className="editor-row product-pricing-grid">
                <div className="field">
                  <label className="field-label">{t(locale, "editor.priceLabel")}</label>
                  <input className="input" type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} required />
                </div>
                <div className="field">
                  <label className="field-label">{t(locale, "editor.compareAtLabel")}</label>
                  <input className="input" type="number" min="0" step="0.01" value={compareAtPrice} onChange={(e) => setCompareAtPrice(e.target.value)} placeholder={t(locale, "editor.optional")} />
                  <div className="field-hint">{t(locale, "editor.compareAtHint")}</div>
                </div>
                <div className="field">
                  <label className="field-label">{t(locale, "editor.costPriceLabel")}</label>
                  <input className="input" type="number" min="0" step="0.01" value={costPrice} onChange={(e) => setCostPrice(e.target.value)} placeholder={t(locale, "editor.optional")} />
                  <div className="field-hint">{t(locale, "editor.costPriceHint")}</div>
                </div>
                <div className="field">
                  <label className="field-label">{t(locale, "editor.loyaltyLabel")}</label>
                  <input className="input" type="number" min="0" value={loyalty} onChange={(e) => setLoyalty(e.target.value)} />
                </div>
              </div>
            </section>

            <section className="product-form-card product-selling-setup" aria-labelledby="product-selling-setup-title">
              <div className="product-selling-setup-head">
                <div>
                  <h2 id="product-selling-setup-title">{t(locale, "editor.sellingSetupTitle")}</h2>
                  <p>{t(locale, "editor.sellingSetupHint")}</p>
                </div>
              </div>
              <div className="product-choice-cards">
                {features.has_variants !== false && (
                  <div className={`product-choice-card${variantsEnabled ? " is-enabled" : ""}`}>
                    <div className="product-choice-icon"><FiLayers /></div>
                    <div className="product-choice-copy">
                      <strong>{t(locale, "editor.variantsChoiceTitle")}</strong>
                      <span>{t(locale, variantsEnabled ? "editor.variantsChoiceOn" : "editor.variantsChoiceOff")}</span>
                    </div>
                    <label className="toggle product-choice-toggle">
                      <input
                        type="checkbox"
                        checked={variantsEnabled}
                        onChange={(event) => {
                          if (event.target.checked) {
                            enableVariants();
                          } else if (merchantVariants.length > 0) {
                            setShowDisableVariantsConfirm(true);
                          } else {
                            setVariantsEnabled(false);
                            setClearVariantsOnSave(false);
                            setTab("details");
                          }
                        }}
                      />
                      <span className="toggle-track" />
                      <span className="sr-only">{t(locale, "editor.variantsChoiceTitle")}</span>
                    </label>
                    {variantsEnabled && (
                      <button type="button" className="product-choice-action" onClick={() => setTab("variants")}>
                        {merchantVariants.length > 0
                          ? t(locale, "editor.manageVariants", merchantVariants.length)
                          : t(locale, productId ? "editor.addFirstVariant" : "editor.saveToAddVariants")}
                      </button>
                    )}
                  </div>
                )}

                <div className={`product-choice-card${relatedProductsEnabled ? " is-enabled" : ""}`}>
                  <div className="product-choice-icon"><FiLink2 /></div>
                  <div className="product-choice-copy">
                    <strong>{t(locale, "editor.relatedChoiceTitle")}</strong>
                    <span>{t(locale, relatedProductsEnabled ? "editor.relatedChoiceOn" : "editor.relatedChoiceOff")}</span>
                  </div>
                  <label className="toggle product-choice-toggle">
                    <input
                      type="checkbox"
                      checked={relatedProductsEnabled}
                      onChange={(event) => {
                        if (event.target.checked) setRelatedProductsEnabled(true);
                        else if (relatedProductIds.length > 0) setShowDisableRelatedConfirm(true);
                        else setRelatedProductsEnabled(false);
                      }}
                    />
                    <span className="toggle-track" />
                    <span className="sr-only">{t(locale, "editor.relatedChoiceTitle")}</span>
                  </label>
                  {relatedProductsEnabled && (
                    <span className="product-choice-status">
                      {relatedProductIds.length > 0
                        ? t(locale, "editor.relatedSelected", relatedProductIds.length)
                        : t(locale, "editor.relatedNoneSelected")}
                    </span>
                  )}
                </div>
              </div>
              {relatedProductsEnabled && (
                <div className="related-product-picker">
                <div className="related-product-picker-head">
                  <div>
                    <h3>{t(locale, "editor.chooseRelatedTitle")}</h3>
                    <p>{t(locale, "editor.chooseRelatedHint")}</p>
                  </div>
                  <span className="badge badge-neutral">{relatedProductIds.length}</span>
                </div>
                <label className="related-product-search">
                  <FiSearch />
                  <input value={relatedQuery} onChange={(event) => setRelatedQuery(event.target.value)} placeholder={t(locale, "editor.searchRelated")} />
                </label>
                {relatedChoices.length > 0 ? (
                  <div className="related-product-results">
                    {relatedChoices.map((item) => {
                      const selected = relatedProductIds.includes(item.id);
                      const image = item.images.find((candidate) => candidate.is_primary) ?? item.images[0];
                      return (
                        <label key={item.id} className={`related-product-option${selected ? " is-selected" : ""}`}>
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => setRelatedProductIds((current) => selected ? current.filter((value) => value !== item.id) : [...current, item.id])}
                          />
                          <span className="related-product-thumb">{image?.image ? <OptimizedImage src={api.assetUrl(image.image)} widthHint={160} widths={[80, 120, 160]} sizes="64px" alt="" /> : <FiPackage />}</span>
                          <span className="related-product-copy"><strong>{item.name}</strong><small>{item.ref}</small></span>
                          <span className="related-product-check"><FiCheck /></span>
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <p className="related-product-empty">{t(locale, relatedQuery ? "editor.noRelatedMatch" : "editor.noRelatedProducts")}</p>
                )}
                </div>
              )}
            </section>

            <section className="product-form-card" aria-labelledby="product-organization-title">
              <div className="product-form-card-head">
                <div>
                  <h2 id="product-organization-title">{t(locale, "editor.organizationTitle")}</h2>
                  <p>{t(locale, "editor.organizationHint")}</p>
                </div>
              </div>
              <div className="editor-row">
                <div className="field">
                  <label className="field-label">{t(locale, "editor.tagsLabel")}</label>
                  <input className="input" value={tags} onChange={(e) => setTags(e.target.value)} placeholder={t(locale, "editor.tagsPh")} />
                </div>
                <div className="field">
                  <label className="field-label">{t(locale, "editor.vendorLabel")}</label>
                  <div className="select-wrap">
                    <select className="select" value={vendorIds[0] ?? ""} onChange={(e) => setVendorIds(e.target.value ? [Number(e.target.value)] : [])}>
                      <option value="">{t(locale, "editor.noVendor")}</option>
                      {(vendors ?? []).map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}
                    </select>
                  </div>
                </div>
              </div>
              {(sections ?? []).length > 1 && (
                <div className="field">
                  <label className="field-label">{t(locale, "editor.additionalCategories")}</label>
                  <div className="coupon-target-grid">
                    {(sections ?? []).filter((item) => item.id !== section).map((item) => (
                      <label key={item.id} className={categoryIds.includes(item.id) ? "selected" : ""}>
                        <input type="checkbox" checked={categoryIds.includes(item.id)} onChange={() => setCategoryIds((current) => current.includes(item.id) ? current.filter((id) => id !== item.id) : [...current, item.id])} />
                        <span>{item.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </section>

            <details className="product-form-card product-form-details">
              <summary>
                <span><strong>{t(locale, "editor.discoverabilityTitle")}</strong><small>{t(locale, "editor.discoverabilityHint")}</small></span>
                <FiChevronDown />
              </summary>
              <div className="product-form-details-body">
                <div className="editor-row">
                  <div className="field">
                    <label className="field-label">{t(locale, "editor.slugLabel")}</label>
                    <input className="input" value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, "-"))} placeholder={t(locale, "editor.slugPh")} />
                    <div className="field-hint">{t(locale, "editor.slugHint")}</div>
                  </div>
                  <div className="field">
                    <label className="field-label">{t(locale, "editor.seoTitle")}</label>
                    <input className="input" value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} />
                  </div>
                </div>
                <div className="field">
                  <label className="field-label">{t(locale, "editor.seoDescription")}</label>
                  <textarea className="textarea" value={seoDescription} onChange={(e) => setSeoDescription(e.target.value)} />
                </div>
                <div className="field">
                  <label className="field-label">Social sharing image URL</label>
                  <input className="input" type="url" maxLength={500} value={seoSocialImage} onChange={(e) => setSeoSocialImage(e.target.value)} placeholder="https://…" />
                </div>
              </div>
            </details>

            {(visibleProductFields.length > 0 || productDefs.length > 0) && (
              <details className="product-form-card product-form-details" open={visibleProductFields.some((field) => productFieldsCfg[field.key]?.required) || productDefs.some((definition) => definition.required) || undefined}>
                <summary>
                  <span><strong>{t(locale, "editor.advancedTitle")}</strong><small>{t(locale, "editor.advancedHint")}</small></span>
                  <FiChevronDown />
                </summary>
                <div className="product-form-details-body product-advanced-fields">
                  {/* ── Config-driven extra fields ─────────────────── */}
                  {visibleProductFields.length > 0 && (
                    <>
                {EXTRA_GROUPS.map((group) => {
                  const groupFields = visibleProductFields.filter((f) => group.keys.includes(f.key));
                  if (groupFields.length === 0) return null;
                  return (
                    <section key={group.label} className="product-field-group">
                      <h3>{group.label}</h3>
                      <div className="editor-row">
                        {groupFields.map((f) => {
                          const cfg = productFieldsCfg[f.key];
                          return (
                            <div className="field" key={f.key}>
                              <label className="field-label">{f.label}{cfg?.required ? " *" : ""}</label>
                              {renderExtraField(f, extra[f.key] ?? "", (v) => setExtra((e) => ({ ...e, [f.key]: v })), locale, cfg?.required)}
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  );
                })}
                    </>
                  )}

                  {/* ── Product-level attributes ───────────────────── */}
                  {productDefs.length > 0 && (
                    <section className="product-field-group">
                      <h3>{t(locale, "editor.productAttrs")}</h3>
                      <div className="editor-row">
                        {productDefs.map((d) => (
                          <div className="field" key={d.id}>
                            <label className="field-label">
                              {d.label}{d.required ? " *" : ""}
                              <span className="product-field-type">({t(locale, `editor.attrType.${d.type}`)})</span>
                            </label>
                            <AttrInput def={d} value={productAttrs[d.key] ?? ""} onChange={(v) => setProductAttrs((a) => ({ ...a, [d.key]: v }))} />
                          </div>
                        ))}
                      </div>
                    </section>
                  )}
                </div>
              </details>
            )}

            <section className="product-form-card" aria-labelledby="product-visibility-title">
              <div className="product-form-card-head">
                <div>
                  <h2 id="product-visibility-title">{t(locale, "editor.visibilityTitle")}</h2>
                  <p>{t(locale, "editor.visibilityHint")}</p>
                </div>
              </div>
              {variantsEnabled && (
                <div className={`product-readiness ${publicationReady ? "is-ready" : "is-draft"}`}>
                  <FiCheck />
                  <div>
                    <strong>{t(locale, publicationReady ? "editor.readyToPublish" : "editor.variantRequired")}</strong>
                    <span>{t(locale, publicationReady ? "editor.readyToPublishHint" : "editor.variantRequiredHint")}</span>
                  </div>
                </div>
              )}
              <div className="product-toggle-list">
                <label className={`toggle product-toggle-row${!publicationReady ? " is-disabled" : ""}`}>
                  <input type="checkbox" checked={isActive && publicationReady} disabled={!publicationReady} onChange={(e) => setIsActive(e.target.checked)} />
                  <span className="toggle-track" />
                  <span className="toggle-label">{t(locale, "editor.visible")}</span>
                </label>
                <label className="toggle product-toggle-row">
                  <input type="checkbox" checked={trackInventory} onChange={(e) => setTrackInventory(e.target.checked)} />
                  <span className="toggle-track" />
                  <span className="toggle-label">{t(locale, "editor.trackInventory")}</span>
                </label>
                <label className="toggle product-toggle-row">
                  <input type="checkbox" checked={isFeatured} onChange={(e) => setIsFeatured(e.target.checked)} />
                  <span className="toggle-track" />
                  <span className="toggle-label">{t(locale, "editor.featured")}</span>
                </label>
              </div>
              {!variantsEnabled && trackInventory && (
                <div className="simple-inventory-field">
                  <div>
                    <strong>{t(locale, "editor.simpleStockTitle")}</strong>
                    <span>{t(locale, "editor.simpleStockHint")}</span>
                  </div>
                  <input className="input tnum" type="number" min="0" step="1" value={simpleQuantity} onChange={(event) => setSimpleQuantity(event.target.value)} aria-label={t(locale, "editor.simpleStockTitle")} />
                </div>
              )}
              {isFeatured && (
                <div className="field product-merchandising-order">
                  <label className="field-label">{t(locale, "editor.merchandisingOrder")}</label>
                  <input className="input" type="number" min="0" value={merchandisingOrder} onChange={(e) => setMerchandisingOrder(e.target.value)} />
                  <div className="field-hint">{t(locale, "editor.merchandisingOrderHint")}</div>
                </div>
              )}
            </section>
          </form>
        )}

        {/* ── VARIANTS TAB ─────────────────────────────────── */}
        {tab === "variants" && (
          <div className="editor-pane">
            <div className="variant-workspace-head">
              <div>
                <h2>{t(locale, "editor.variantWorkspaceTitle")}</h2>
                <p>{t(locale, "editor.variantWorkspaceHint")}</p>
              </div>
              <label className="toggle">
                <input type="checkbox" checked={variantsEnabled} onChange={() => {
                  if (merchantVariants.length > 0) setShowDisableVariantsConfirm(true);
                  else { setVariantsEnabled(false); setTab("details"); }
                }} />
                <span className="toggle-track" />
                <span className="toggle-label">{t(locale, "editor.variantsEnabled")}</span>
              </label>
            </div>
            <section className="variant-option-builder">
              <div className="variant-option-builder-head">
                <div>
                  <h3>{t(locale, "editor.choiceTypesTitle")}</h3>
                  <p>{t(locale, "editor.choiceTypesHint")}</p>
                </div>
                {merchantVariants.length === 0 && variantOptions.length < 3 && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setVariantOptions((current) => [...current, { key: `option_${current.length + 1}`, label: "", type: "select", values: [] }])}
                  >
                    <FiPlus /> {t(locale, "editor.addChoiceType")}
                  </button>
                )}
              </div>
              {merchantVariants.length > 0 ? (
                <div className="variant-option-summary">
                  {variantDefs.map((definition) => (
                    <div key={definition.key}>
                      <strong>{definition.label}</strong>
                      <span>{definition.options.map(optLabel).join(" · ") || t(locale, "editor.valuesFromCombinations")}</span>
                    </div>
                  ))}
                  <p>{t(locale, "editor.choiceTypesLocked")}</p>
                </div>
              ) : variantOptions.length > 0 ? (
                <div className="variant-option-list">
                  {variantOptions.map((option, index) => (
                    <div className="variant-option-row" key={index}>
                      <div className="field">
                        <label className="field-label">{t(locale, "editor.choiceName")}</label>
                        <input
                          className="input"
                          value={option.label}
                          placeholder={t(locale, "editor.choiceNamePlaceholder")}
                          onChange={(event) => setVariantOptions((current) => current.map((item, itemIndex) => itemIndex === index
                            ? { ...item, label: event.target.value, key: optionKey(event.target.value) || `option_${index + 1}` }
                            : item))}
                        />
                      </div>
                      <div className="field">
                        <label className="field-label">{t(locale, "editor.choiceDisplay")}</label>
                        <div className="select-wrap">
                          <select className="select" value={option.type} onChange={(event) => {
                            const nextType = event.target.value as ProductVariantOption["type"];
                            setVariantOptions((current) => current.map((item, itemIndex) => itemIndex === index
                              ? { ...item, type: nextType, values: nextType === "color" ? item.values : item.values.map(optValue) }
                              : item));
                          }}>
                            <option value="select">{t(locale, "editor.choiceDisplayButtons")}</option>
                            <option value="color">{t(locale, "editor.choiceDisplayColors")}</option>
                            <option value="text">{t(locale, "editor.choiceDisplayDropdown")}</option>
                          </select>
                        </div>
                      </div>
                      <div className="field variant-option-values">
                        <label className="field-label">{t(locale, "editor.choiceValues")}</label>
                        {option.type === "color" ? (
                          <VariantColorValuesInput
                            values={option.values}
                            onChange={(values) => setVariantOptions((current) => current.map((item, itemIndex) => itemIndex === index
                              ? { ...item, values }
                              : item))}
                          />
                        ) : (
                          <>
                            <VariantValuesInput
                              values={option.values.map(optValue)}
                              placeholder={t(locale, "editor.choiceValuesPlaceholder")}
                              onChange={(values) => setVariantOptions((current) => current.map((item, itemIndex) => itemIndex === index
                                ? { ...item, values }
                                : item))}
                            />
                            <span className="field-hint">{t(locale, "editor.choiceValuesHint")}</span>
                          </>
                        )}
                      </div>
                      <button type="button" className="danger-icon-button variant-option-remove" aria-label={t(locale, "editor.delete")} onClick={() => setVariantOptions((current) => current.filter((_, itemIndex) => itemIndex !== index))}><FiTrash2 /></button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="variant-option-empty">{t(locale, "editor.choiceTypesEmpty")}</p>
              )}
              {!variantOptionsComplete && <p className="variant-option-validation">{t(locale, "editor.completeChoiceTypes")}</p>}
              {productId && !variantOptionsSaved && variantOptionsComplete && (
                <p className="variant-option-unsaved">{t(locale, "editor.saveChoicesBeforeCombinations")}</p>
              )}
            </section>
            {!productId ? (
              <EmptyState icon={<FiLayers />} title={t(locale, "editor.saveFirstTitle")} sub={t(locale, "editor.saveFirstSub")} />
            ) : merchantVariants.length === 0 ? (
              <EmptyState
                icon={<FiLayers />}
                title={t(locale, "editor.noVariants")}
                sub={variantDefs.length ? t(locale, "editor.noVariantsSubDefs") : t(locale, "editor.noVariantsSubNoDefs")}
                action={<button className="btn btn-primary" onClick={openAddVariant} disabled={!variantOptionsSaved}><FiPlus /> {t(locale, "editor.addVariant")}</button>}
              />
            ) : (
              <>
                <div className="table-wrap variant-table-wrap" tabIndex={0} style={{ border: "1px solid var(--hairline)", borderRadius: 12 }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>#</th>
                        {variantDefs.map((d) => <th key={d.id}>{d.label}</th>)}
                        <th>{t(locale, "products.thPrice")}</th>
                        <th>{t(locale, "editor.thQty")}</th>
                        <th>{t(locale, "editor.thAvail")}</th>
                        <th>{t(locale, "editor.variantImage")}</th>
                        <th style={{ textAlign: "end" }} />
                      </tr>
                    </thead>
                    <tbody>
                      {merchantVariants.map((v, i) => (
                        <tr key={v.id}>
                          <td style={{ color: "var(--ink-faint)", fontSize: 12.5, fontFamily: "var(--mono)" }}>{i + 1}</td>
                          {variantDefs.map((d) => (
                            <td key={d.id}>
                              {d.type === "color" && v.attributes?.[d.key] ? (
                                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                                  <span style={{ width: 14, height: 14, borderRadius: "50%", background: optSwatch(d.options.find((option) => optValue(option) === valueText(v.attributes[d.key]))) ?? valueText(v.attributes[d.key]), border: "1px solid var(--hairline)", flexShrink: 0 }} />
                                  {displayValue(v.attributes[d.key], locale)}
                                </span>
                              ) : (
                                <span className="row-main">{displayValue(v.attributes?.[d.key], locale)}</span>
                              )}
                            </td>
                          ))}
                          <td>
                            <input className="input tnum" type="number" step="0.01" min="0" style={{ width: 96, height: 32 }}
                              key={`price-${v.id}-${v.price ?? "base"}`}
                              defaultValue={v.price ?? ""}
                              onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                              onBlur={(e) => {
                                const next = e.target.value !== "" ? Number(e.target.value) : null;
                                if (next !== v.price) void patchVariant(v, { price: next });
                              }} />
                          </td>
                          <td>
                            <input className="input tnum" type="number" step="1" min="0" style={{ width: 76, height: 32 }}
                              key={`quantity-${v.id}-${v.quantity}`}
                              defaultValue={v.quantity}
                              onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                              onBlur={(e) => {
                                const next = Number(e.target.value) || 0;
                                if (next !== v.quantity) void patchVariant(v, { quantity: next });
                              }} />
                          </td>
                          <td className="tnum" style={{ fontWeight: 600, color: v.available_quantity > 0 ? "var(--success)" : "var(--danger)" }}>
                            {v.available_quantity}
                          </td>
                          <td style={{ minWidth: 180 }}>
                            <select className="input" aria-label={t(locale, "editor.variantImageFor", i + 1)} value={v.image?.id ?? ""}
                              aria-invalid={variantImageErrors[v.id] || undefined}
                              aria-describedby={variantImageErrors[v.id] ? `variant-image-error-${v.id}` : undefined}
                              onChange={event => void patchVariant(v, { image_id: event.target.value ? Number(event.target.value) : null })}>
                              <option value="">{t(locale, "editor.useProductCover")}</option>
                              {images.filter(image => !image.media_type || image.media_type === "image").map((image, index) => <option key={image.id} value={image.id}>{image.is_primary ? t(locale, "editor.coverImage") : t(locale, "editor.variantImageNumber", index + 1)}</option>)}
                            </select>
                            {variantImageErrors[v.id] && <span id={`variant-image-error-${v.id}`} className="field-error" role="alert">{t(locale, "editor.variantImageInvalid")}</span>}
                          </td>
                          <td className="table-actions">
                            <button className="danger-icon-button" aria-label={t(locale, "editor.delete")} onClick={() => deleteVariant(v)}><FiTrash2 /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button className="btn btn-secondary" style={{ marginTop: 14 }} onClick={openAddVariant} disabled={!variantOptionsSaved}><FiPlus /> {t(locale, "editor.addVariant")}</button>
              </>
            )}
          </div>
        )}

        {/* ── IMAGES TAB ───────────────────────────────────── */}
        {tab === "images" && (
          <div className="editor-pane">
            {!productId ? (
              <EmptyState icon={<FiImage />} title={t(locale, "editor.saveFirstTitle")} sub={t(locale, "editor.imageSaveFirstSub")} />
            ) : (
              <>
                <section className="product-image-section">
                  <div className="product-image-section-head"><div><h3>{t(locale, "editor.coverImage")}</h3><p>{t(locale, "editor.coverImageHint")}</p></div></div>
                  <div className={`cover-image-field${imgBusy ? " is-busy" : ""}`} onClick={() => !imgBusy && coverFileRef.current?.click()}>
                    {coverImage ? <OptimizedImage src={api.assetUrl(coverImage.image)} widthHint={960} widths={[480, 720, 960]} sizes="(max-width: 760px) 100vw, 55vw" alt={name} priority /> : <div className="cover-image-placeholder"><FiImage /><strong>{t(locale, "editor.addCover")}</strong></div>}
                    <div className="cover-image-actions"><span className="btn btn-secondary btn-sm"><FiUploadCloud /> {coverImage ? t(locale, "editor.replaceCover") : t(locale, "editor.addCover")}</span>{coverImage && <button type="button" className="danger-icon-button" disabled={imgBusy} aria-label={t(locale, "editor.removeImage")} onClick={(event) => { event.stopPropagation(); setDeleteTarget(coverImage.id); }}><FiTrash2 /></button>}</div>
                  </div>
                  <input ref={coverFileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden onChange={(event) => uploadImage(event.target.files, true)} />
                </section>

                <section className="product-image-section">
                  <div className="product-image-section-head"><div><h3>{t(locale, "editor.galleryImages")}</h3><p>{t(locale, "editor.galleryImagesHint")}</p></div><span className="badge badge-neutral">{galleryImages.length}</span></div>
                <div className={`image-uploader${dragOver ? " drag-over" : ""}${imgBusy ? " disabled" : ""}`}
                  onClick={() => !imgBusy && galleryFileRef.current?.click()} onDrop={onDrop} onDragOver={onDragOver} onDragLeave={onDragLeave}>
                  {imgBusy ? (
                    <><div className="img-upload-spinner" /><b>{imgBusyText}</b><span>{imgProgress}%</span><span className="img-upload-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={imgProgress}><i style={{ width: `${imgProgress}%` }} /></span></>
                  ) : (
                    <><FiUploadCloud /><b>{t(locale, "editor.upload")}</b><span>{t(locale, "editor.uploadSubMulti")}</span></>
                  )}
                </div>
                <input ref={galleryFileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple hidden onChange={(e) => uploadImage(e.target.files, false)} />
                <div className="thumb-row">
                  {galleryImages.map((img) => (
                    <div key={img.id} className={`thumb-item${imgBusy ? " thumb-busy" : ""}`}>
                      <OptimizedImage src={api.assetUrl(img.image)} widthHint={240} widths={[120, 180, 240]} sizes="120px" alt="" />
                      <button className="danger-icon-button image-remove-button" disabled={imgBusy} aria-label={t(locale, "editor.removeImage")} onClick={(e) => { e.stopPropagation(); setDeleteTarget(img.id); }}><FiTrash2 /></button>
                    </div>
                  ))}
                </div>
                {galleryImages.length === 0 && !imgBusy && <p className="img-empty-hint">{t(locale, "editor.noImagesHint")}</p>}
                </section>
              </>
            )}
          </div>
        )}
      </div>

      {typeof document !== "undefined" && createPortal(
        <div className="product-editor-savebar" role="region" aria-label={t(locale, "editor.saveBarTitle")}>
          <div className="product-editor-savebar-copy">
            <strong>{t(locale, "editor.saveBarTitle")}</strong>
            <span>{t(locale, saveDisabled && !saving ? "editor.saveBarRequired" : "editor.saveBarHint")}</span>
          </div>
          <div className="product-editor-savebar-actions">
            {productId && (
              <button
                className="btn btn-danger-ghost product-editor-delete"
                type="button"
                aria-haspopup="dialog"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={deleting || saving}
              >
                <FiTrash2 /> {t(locale, "editor.delete")}
              </button>
            )}
            <button className="btn btn-primary" type="button" onClick={() => void save()} disabled={saveDisabled}>
              {saving ? <span className="spin" /> : <FiSave />} {t(locale, saving ? "editor.saving" : "editor.save")}
            </button>
          </div>
        </div>,
        document.body,
      )}

      {/* ── Add variant modal ──────────────────────────────── */}
      <ModalShell open={showVariantModal} onClose={() => setShowVariantModal(false)} busy={variantSaving} labelledBy="add-variant-title" maxWidth={520}>
            <div className="modal-head">
              <div id="add-variant-title" className="d-card-title">{t(locale, "editor.addVariant")}</div>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowVariantModal(false)} style={{ padding: "6px 8px" }}><FiX size={16} /></button>
            </div>
            <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {variantDefs.map((d) => (
                <div className="field" key={d.id}>
                  <label className="field-label">
                    {d.label}{d.required ? " *" : ""}
                    <span style={{ fontWeight: 400, color: "var(--ink-faint)", fontSize: 11, marginInlineStart: 6 }}>
                      ({t(locale, `editor.attrType.${d.type}`)})
                    </span>
                  </label>
                  <AttrInput def={d} value={variantAttrs[d.key] ?? ""} sizeSystem={valueText(productAttrs.size_system)} onChange={(v) => setVariantAttrs((a) => ({ ...a, [d.key]: v }))} />
                </div>
              ))}

              <div className="editor-row" style={{ marginBottom: 0 }}>
                <div className="field">
                  <label className="field-label">{t(locale, "editor.variantPrice")}</label>
                  <input className="input" type="number" min="0" step="0.01" value={variantPrice} onChange={(e) => setVariantPrice(e.target.value)} />
                </div>
                <div className="field">
                  <label className="field-label">{t(locale, "editor.variantQty")}</label>
                  <input className="input" type="number" min="0" step="1" value={variantQty} onChange={(e) => setVariantQty(e.target.value)} />
                </div>
              </div>

              {visibleVariantFields.map((f) => {
                const cfg = variantFieldsCfg[f.key];
                return (
                  <div className="field" key={f.key}>
                    <label className="field-label">{f.label}{cfg?.required ? " *" : ""}</label>
                    {renderExtraField(f, variantExtra[f.key] ?? "", (v) => {
                      setVariantExtra((e) => ({ ...e, [f.key]: v }));
                      setVariantFieldErrors((errors) => { const next = { ...errors }; delete next[f.key]; return next; });
                    }, locale, cfg?.required)}
                    {variantFieldErrors[f.key] && <span className="field-error" role="alert">{t(locale, variantFieldErrors[f.key])}</span>}
                  </div>
                );
              })}
            </div>
            <div className="modal-foot">
              <button className="btn btn-secondary" onClick={() => setShowVariantModal(false)} disabled={variantSaving}>{t(locale, "confirm.cancel")}</button>
              <button className="btn btn-primary" onClick={saveVariant} disabled={variantSaving || !variantComplete}>
                {variantSaving && <span className="spin" />}
                <FiCheck /> {t(locale, "editor.addVariant")}
              </button>
            </div>
      </ModalShell>

      {renderedDeleteTarget !== null && (
        <ModalShell open={deleteTarget !== null} onClose={() => setDeleteTarget(null)} labelledBy="delete-image-title">
            <div className="modal-head">
              <div id="delete-image-title" className="d-card-title">{t(locale, "editor.confirmDeleteImageTitle")}</div>
              <button className="icon-btn" onClick={() => setDeleteTarget(null)}><FiX /></button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 14, color: "var(--ink-muted)" }}>{t(locale, "editor.confirmDeleteImageSub")}</p>
            </div>
            <div className="modal-foot">
              <button className="btn btn-secondary" onClick={() => setDeleteTarget(null)}>{t(locale, "editor.cancel")}</button>
              <button className="btn btn-danger" onClick={() => confirmDeleteImage(renderedDeleteTarget)}>
                <FiTrash2 /> {t(locale, "editor.removeImage")}
              </button>
            </div>
        </ModalShell>
      )}

      <ConfirmModal
        open={showDeleteConfirm}
        title={t(locale, "editor.deleteTitle")}
        body={t(locale, "editor.deleteConfirm", name || ref || t(locale, "editor.editTitle"))}
        confirmLabel={t(locale, "editor.delete")}
        danger
        loading={deleting}
        onConfirm={remove}
        onClose={() => { setShowDeleteConfirm(false); setDeleting(false); }}
      />
      <ConfirmModal
        open={showDisableVariantsConfirm}
        title={t(locale, "editor.disableVariantsTitle")}
        body={t(locale, "editor.disableVariantsBody", merchantVariants.length)}
        confirmLabel={t(locale, "editor.disableVariantsConfirm")}
        danger
        onClose={() => setShowDisableVariantsConfirm(false)}
        onConfirm={() => {
          setVariantsEnabled(false);
          setClearVariantsOnSave(true);
          setIsActive(false);
          setShowDisableVariantsConfirm(false);
          setTab("details");
        }}
      />
      <ConfirmModal
        open={showDisableRelatedConfirm}
        title={t(locale, "editor.disableRelatedTitle")}
        body={t(locale, "editor.disableRelatedBody", relatedProductIds.length)}
        confirmLabel={t(locale, "editor.disableRelatedConfirm")}
        onClose={() => setShowDisableRelatedConfirm(false)}
        onConfirm={() => {
          setRelatedProductsEnabled(false);
          setRelatedProductIds([]);
          setShowDisableRelatedConfirm(false);
        }}
      />
    </div>
  );
}
