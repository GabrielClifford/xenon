// Shared logic for Products: types, handles, variants, smart-collection rules, bulk price changes and CSV.
// Pure functions only (no database calls), so it is easy to test.

export type Status = 'active' | 'draft' | 'archived';
export type OptionDef = { name: string; values: string[] };

export type Product = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  category: string | null;
  photo_url: string | null;
  images: string[] | null;
  available: boolean;
  custom_fields: Record<string, unknown> | null;
  status: Status;
  handle: string | null;
  compare_at_price: number | null;
  cost: number | null;
  sku: string | null;
  barcode: string | null;
  track_stock: boolean;
  stock: number;
  continue_selling: boolean;
  low_stock_threshold: number;
  weight_grams: number | null;
  vendor: string | null;
  product_type: string | null;
  tags: string[];
  seo_title: string | null;
  seo_description: string | null;
  publish_at: string | null;
  options: OptionDef[];
  created_at: string;
};

export type VariantRow = {
  id: string;
  product_id: string;
  business_id: string;
  title: string;
  option_values: Record<string, string>;
  price: number;
  compare_at_price: number | null;
  cost: number | null;
  sku: string | null;
  barcode: string | null;
  stock: number;
  position: number;
};

export const PRODUCT_COLS =
  'id,name,description,price,category,photo_url,images,available,custom_fields,status,handle,compare_at_price,cost,sku,barcode,track_stock,stock,continue_selling,low_stock_threshold,weight_grams,vendor,product_type,tags,seo_title,seo_description,publish_at,options,created_at';
export const VARIANT_COLS = 'id,product_id,business_id,title,option_values,price,compare_at_price,cost,sku,barcode,stock,position';

export const MAX_VARIANTS = 100;
export const MAX_OPTIONS = 3;
export const MAX_IMAGES = 6;

export const statusLabel: Record<Status, string> = { active: 'Active', draft: 'Draft', archived: 'Archived' };

/* ------------------------------- reading rows ------------------------------ */

const text = (v: unknown): string | null => (typeof v === 'string' ? v : null);
const int = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : null);

export function readOptions(v: unknown): OptionDef[] {
  if (!Array.isArray(v)) return [];
  const out: OptionDef[] = [];
  for (const o of v) {
    if (o && typeof o === 'object') {
      const r = o as Record<string, unknown>;
      if (typeof r.name === 'string' && Array.isArray(r.values)) {
        const values = r.values.filter((x): x is string => typeof x === 'string');
        if (r.name.trim() && values.length) out.push({ name: r.name, values });
      }
    }
  }
  return out.slice(0, MAX_OPTIONS);
}

export function readProduct(r: Record<string, unknown>): Product {
  const status = r.status === 'draft' || r.status === 'archived' ? r.status : 'active';
  return {
    id: String(r.id ?? ''),
    name: text(r.name) ?? '',
    description: text(r.description),
    price: int(r.price) ?? 0,
    category: text(r.category),
    photo_url: text(r.photo_url),
    images: Array.isArray(r.images) ? r.images.filter((x): x is string => typeof x === 'string') : null,
    available: r.available !== false,
    custom_fields: r.custom_fields && typeof r.custom_fields === 'object' ? (r.custom_fields as Record<string, unknown>) : null,
    status,
    handle: text(r.handle),
    compare_at_price: int(r.compare_at_price),
    cost: int(r.cost),
    sku: text(r.sku),
    barcode: text(r.barcode),
    track_stock: r.track_stock === true,
    stock: Math.max(0, int(r.stock) ?? 0),
    continue_selling: r.continue_selling === true,
    low_stock_threshold: Math.max(0, int(r.low_stock_threshold) ?? 5),
    weight_grams: int(r.weight_grams),
    vendor: text(r.vendor),
    product_type: text(r.product_type),
    tags: Array.isArray(r.tags) ? r.tags.filter((x): x is string => typeof x === 'string') : [],
    seo_title: text(r.seo_title),
    seo_description: text(r.seo_description),
    publish_at: text(r.publish_at),
    options: readOptions(r.options),
    created_at: text(r.created_at) ?? '',
  };
}

export function readVariant(r: Record<string, unknown>): VariantRow {
  const ov: Record<string, string> = {};
  if (r.option_values && typeof r.option_values === 'object') {
    for (const [k, v] of Object.entries(r.option_values as Record<string, unknown>)) if (typeof v === 'string') ov[k] = v;
  }
  return {
    id: String(r.id ?? ''),
    product_id: String(r.product_id ?? ''),
    business_id: String(r.business_id ?? ''),
    title: text(r.title) ?? '',
    option_values: ov,
    price: int(r.price) ?? 0,
    compare_at_price: int(r.compare_at_price),
    cost: int(r.cost),
    sku: text(r.sku),
    barcode: text(r.barcode),
    stock: Math.max(0, int(r.stock) ?? 0),
    position: int(r.position) ?? 0,
  };
}

export const coverOf = (p: Pick<Product, 'images' | 'photo_url'>): string | null => p.images?.[0] ?? p.photo_url ?? null;

/* --------------------------------- helpers --------------------------------- */

export const naira = (n: number) => `₦${n.toLocaleString('en-NG')}`;

export function slugify(s: string, fallback = 'product'): string {
  const t = s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '');
  return t || fallback;
}

export function uniqueHandle(base: string, taken: Set<string>, fallback = 'product'): string {
  const h = slugify(base, fallback);
  if (!taken.has(h)) return h;
  let i = 2;
  while (taken.has(`${h}-${i}`)) i += 1;
  return `${h}-${i}`;
}

// Whole naira only. '' means "not set".
export const toInt = (s: string): number | null => {
  const t = s.trim();
  return t === '' ? null : Number(t);
};
export const isWhole = (s: string) => /^\d{1,9}$/.test(s.trim());

export function parseTags(s: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of s.split(/[,\n]/)) {
    const t = raw.trim().replace(/\s+/g, ' ').slice(0, 40);
    const k = t.toLowerCase();
    if (t && !seen.has(k)) {
      seen.add(k);
      out.push(t);
    }
  }
  return out.slice(0, 50);
}

export function marginOf(price: number, cost: number | null): { profit: number; pct: number } | null {
  if (cost === null || !Number.isFinite(cost) || price <= 0) return null;
  const profit = price - cost;
  return { profit, pct: Math.round((profit / price) * 1000) / 10 };
}

export type StockState = 'untracked' | 'out' | 'low' | 'ok';

export function totalStock(p: Pick<Product, 'stock'>, variants: Pick<VariantRow, 'stock'>[]): number {
  return variants.length ? variants.reduce((s, v) => s + v.stock, 0) : p.stock;
}

export function stockState(p: Pick<Product, 'track_stock' | 'stock' | 'low_stock_threshold'>, variants: Pick<VariantRow, 'stock'>[]): StockState {
  if (!p.track_stock) return 'untracked';
  const q = totalStock(p, variants);
  if (q <= 0) return 'out';
  return q <= p.low_stock_threshold ? 'low' : 'ok';
}

// A scheduled product is hidden until its date.
export const isLive = (p: Pick<Product, 'status' | 'publish_at'>, now = Date.now()) =>
  p.status === 'active' && (!p.publish_at || new Date(p.publish_at).getTime() <= now);

/* --------------------------------- variants -------------------------------- */

export function variantCombos(options: OptionDef[]): Record<string, string>[] {
  let out: Record<string, string>[] = [{}];
  for (const o of options) {
    const next: Record<string, string>[] = [];
    for (const base of out) for (const v of o.values) next.push({ ...base, [o.name]: v });
    out = next;
    if (out.length > MAX_VARIANTS) return out.slice(0, MAX_VARIANTS + 1);
  }
  return out;
}

export const comboKey = (ov: Record<string, string>, options: OptionDef[]) => options.map((o) => ov[o.name] ?? '').join('\u0001');
export const variantTitle = (ov: Record<string, string>, options: OptionDef[]) => options.map((o) => ov[o.name] ?? '').filter(Boolean).join(' / ') || 'Default';

// Checks option names and values; returns an error message or ''.
export function checkOptions(options: OptionDef[]): string {
  if (options.length > MAX_OPTIONS) return `Use at most ${MAX_OPTIONS} options.`;
  const names = new Set<string>();
  for (const o of options) {
    const n = o.name.trim();
    if (!n) return 'Give every option a name, for example Size or Colour.';
    if (n.length > 40) return 'Option names can be up to 40 characters.';
    if (names.has(n.toLowerCase())) return `The option "${n}" is listed twice.`;
    names.add(n.toLowerCase());
    if (o.values.length === 0) return `Add at least one value for ${n}.`;
    const vals = new Set<string>();
    for (const v of o.values) {
      if (!v.trim() || v.length > 60) return `Each ${n} value must be 1 to 60 characters.`;
      if (vals.has(v.toLowerCase())) return `The ${n} value "${v}" is listed twice.`;
      vals.add(v.toLowerCase());
    }
  }
  if (variantCombos(options).length > MAX_VARIANTS) return `That makes more than ${MAX_VARIANTS} variants. Remove some values.`;
  return '';
}

/* --------------------------- smart collection rules ------------------------- */

export type RuleField = 'tag' | 'category' | 'type' | 'vendor' | 'title' | 'price_gte' | 'price_lte' | 'stock_lte';
export type Rule = { field: RuleField; value: string };
export type Rules = { match: 'all' | 'any'; conditions: Rule[] };

export const ruleFields: { v: RuleField; t: string; number: boolean }[] = [
  { v: 'tag', t: 'Tag is', number: false },
  { v: 'category', t: 'Category is', number: false },
  { v: 'type', t: 'Product type is', number: false },
  { v: 'vendor', t: 'Vendor is', number: false },
  { v: 'title', t: 'Name contains', number: false },
  { v: 'price_gte', t: 'Price is at least (₦)', number: true },
  { v: 'price_lte', t: 'Price is at most (₦)', number: true },
  { v: 'stock_lte', t: 'Stock is at most', number: true },
];

export const emptyRules: Rules = { match: 'all', conditions: [] };

export function readRules(v: unknown): Rules {
  if (!v || typeof v !== 'object') return { ...emptyRules, conditions: [] };
  const r = v as Record<string, unknown>;
  const fields = ruleFields.map((f) => f.v as string);
  const conditions: Rule[] = [];
  if (Array.isArray(r.conditions)) {
    for (const c of r.conditions) {
      if (c && typeof c === 'object') {
        const o = c as Record<string, unknown>;
        if (typeof o.field === 'string' && fields.includes(o.field) && typeof o.value === 'string') conditions.push({ field: o.field as RuleField, value: o.value });
      }
    }
  }
  return { match: r.match === 'any' ? 'any' : 'all', conditions: conditions.slice(0, 10) };
}

type Subject = Pick<Product, 'name' | 'category' | 'product_type' | 'vendor' | 'tags' | 'price' | 'stock' | 'track_stock'>;

export function matchesRule(p: Subject, r: Rule): boolean {
  const v = r.value.trim().toLowerCase();
  if (!v) return false;
  const eq = (x: string | null) => (x ?? '').trim().toLowerCase() === v;
  switch (r.field) {
    case 'tag':
      return p.tags.some((t) => t.trim().toLowerCase() === v);
    case 'category':
      return eq(p.category);
    case 'type':
      return eq(p.product_type);
    case 'vendor':
      return eq(p.vendor);
    case 'title':
      return p.name.toLowerCase().includes(v);
    case 'price_gte':
      return Number.isFinite(Number(v)) && p.price >= Number(v);
    case 'price_lte':
      return Number.isFinite(Number(v)) && p.price <= Number(v);
    case 'stock_lte':
      return p.track_stock && Number.isFinite(Number(v)) && p.stock <= Number(v);
  }
}

export function matchesRules(p: Subject, rules: Rules): boolean {
  const usable = rules.conditions.filter((c) => c.value.trim());
  if (usable.length === 0) return false;
  return rules.match === 'all' ? usable.every((c) => matchesRule(p, c)) : usable.some((c) => matchesRule(p, c));
}

export type SortBy = 'manual' | 'newest' | 'price_asc' | 'price_desc' | 'title';
export const sortLabels: Record<SortBy, string> = { manual: 'Manually', newest: 'Newest first', price_asc: 'Price, low to high', price_desc: 'Price, high to low', title: 'Name, A to Z' };

export function sortProducts<T extends Pick<Product, 'id' | 'name' | 'price' | 'created_at'>>(list: T[], by: SortBy, order?: string[]): T[] {
  const copy = [...list];
  if (by === 'price_asc') return copy.sort((a, b) => a.price - b.price);
  if (by === 'price_desc') return copy.sort((a, b) => b.price - a.price);
  if (by === 'title') return copy.sort((a, b) => a.name.localeCompare(b.name));
  if (by === 'newest') return copy.sort((a, b) => b.created_at.localeCompare(a.created_at));
  const pos = new Map((order ?? []).map((id, i) => [id, i]));
  return copy.sort((a, b) => (pos.get(a.id) ?? 1e9) - (pos.get(b.id) ?? 1e9));
}

/* -------------------------------- bulk prices ------------------------------- */

export type PriceOp = 'set' | 'inc_pct' | 'dec_pct' | 'inc_amt' | 'dec_amt';

export function applyPriceOp(price: number, op: PriceOp, value: number): number {
  let n = price;
  if (op === 'set') n = value;
  else if (op === 'inc_pct') n = price * (1 + value / 100);
  else if (op === 'dec_pct') n = price * (1 - value / 100);
  else if (op === 'inc_amt') n = price + value;
  else n = price - value;
  return Math.max(0, Math.round(n));
}

/* ----------------------------------- CSV ----------------------------------- */

export function parseCsv(input: string): string[][] {
  const s = input.replace(/^﻿/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < s.length; i += 1) {
    const c = s[i];
    if (quoted) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else quoted = false;
      } else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(cell);
      cell = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i += 1;
      row.push(cell);
      cell = '';
      rows.push(row);
      row = [];
    } else cell += c;
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

const escCell = (v: string) => (/[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
export const toCsv = (rows: string[][]) => rows.map((r) => r.map(escCell).join(',')).join('\r\n');

// Cells that start with = + - @ can run as formulas in Excel. Text columns get a leading apostrophe on export.
const safeText = (v: string) => (/^[=+\-@\t\r]/.test(v) ? `'${v}` : v);
const unsafeText = (v: string) => (/^'[=+\-@\t\r]/.test(v) ? v.slice(1) : v);

export const CSV_COLUMNS = [
  'handle', 'title', 'description', 'status', 'vendor', 'type', 'category', 'tags',
  'price', 'compare_at_price', 'cost', 'sku', 'barcode', 'track_stock', 'stock', 'continue_selling', 'low_stock_threshold', 'weight_grams',
  'seo_title', 'seo_description', 'images', 'publish_at',
  'option1_name', 'option1_value', 'option2_name', 'option2_value', 'option3_name', 'option3_value',
  'variant_price', 'variant_compare_at_price', 'variant_cost', 'variant_sku', 'variant_barcode', 'variant_stock',
] as const;

const num = (n: number | null) => (n === null ? '' : String(n));

export function productsToCsv(products: Product[], variants: VariantRow[]): string {
  const by = new Map<string, VariantRow[]>();
  for (const v of variants) by.set(v.product_id, [...(by.get(v.product_id) ?? []), v].sort((a, b) => a.position - b.position));
  const taken = new Set(products.map((p) => p.handle).filter((h): h is string => !!h));
  const rows: string[][] = [[...CSV_COLUMNS]];
  for (const p of products) {
    const handle = p.handle || uniqueHandle(p.name, taken);
    taken.add(handle);
    const vs = by.get(p.id) ?? [];
    const imgs = p.images?.length ? p.images : p.photo_url ? [p.photo_url] : [];
    const first = (v: VariantRow | undefined): Record<string, string> => {
      const o: Record<string, string> = {};
      p.options.forEach((opt, i) => {
        o[`option${i + 1}_name`] = safeText(opt.name);
        o[`option${i + 1}_value`] = v ? safeText(v.option_values[opt.name] ?? '') : '';
      });
      if (v) {
        o.variant_price = String(v.price);
        o.variant_compare_at_price = num(v.compare_at_price);
        o.variant_cost = num(v.cost);
        o.variant_sku = safeText(v.sku ?? '');
        o.variant_barcode = safeText(v.barcode ?? '');
        o.variant_stock = String(v.stock);
      }
      return o;
    };
    const head: Record<string, string> = {
      handle,
      title: safeText(p.name),
      description: safeText(p.description ?? ''),
      status: p.status,
      vendor: safeText(p.vendor ?? ''),
      type: safeText(p.product_type ?? ''),
      category: safeText(p.category ?? ''),
      tags: safeText(p.tags.join(', ')),
      price: String(p.price),
      compare_at_price: num(p.compare_at_price),
      cost: num(p.cost),
      sku: safeText(p.sku ?? ''),
      barcode: safeText(p.barcode ?? ''),
      track_stock: p.track_stock ? 'true' : 'false',
      stock: String(p.stock),
      continue_selling: p.continue_selling ? 'true' : 'false',
      low_stock_threshold: String(p.low_stock_threshold),
      weight_grams: num(p.weight_grams),
      seo_title: safeText(p.seo_title ?? ''),
      seo_description: safeText(p.seo_description ?? ''),
      images: imgs.join(' | '),
      publish_at: p.publish_at ?? '',
    };
    const lines = vs.length ? vs : [undefined];
    lines.forEach((v, i) => {
      const cells: Record<string, string> = i === 0 ? { ...head, ...first(v) } : { handle, ...first(v) };
      rows.push(CSV_COLUMNS.map((c) => cells[c] ?? ''));
    });
  }
  return toCsv(rows);
}

export type ProductPatch = {
  name: string;
  description: string | null;
  status: Status;
  vendor: string | null;
  product_type: string | null;
  category: string | null;
  tags: string[];
  price: number;
  compare_at_price: number | null;
  cost: number | null;
  sku: string | null;
  barcode: string | null;
  track_stock: boolean;
  stock: number;
  continue_selling: boolean;
  low_stock_threshold: number;
  weight_grams: number | null;
  seo_title: string | null;
  seo_description: string | null;
  publish_at: string | null;
};

export type ImportVariant = { option_values: Record<string, string>; price: number | null; compare_at_price: number | null; cost: number | null; sku: string | null; barcode: string | null; stock: number };

export type ImportItem = {
  row: number;
  handle: string;
  patch: Partial<ProductPatch>;
  images: string[] | null; // null = leave images alone
  options: OptionDef[] | null; // null = leave variants alone
  variants: ImportVariant[];
};

export type ImportResult = { items: ImportItem[]; errors: string[]; skipped: number; total: number; hasVariantColumns: boolean };

const MAX_IMPORT_ROWS = 5000;
const TRUE = new Set(['true', 'yes', 'y', '1']);
const FALSE = new Set(['false', 'no', 'n', '0', '']);

export function parseImport(input: string): ImportResult {
  const out: ImportResult = { items: [], errors: [], skipped: 0, total: 0, hasVariantColumns: false };
  const rows = parseCsv(input);
  if (rows.length < 2) {
    out.errors.push('The file has no product rows. Export your products first to get the right layout.');
    return out;
  }
  if (rows.length - 1 > MAX_IMPORT_ROWS) {
    out.errors.push(`The file has more than ${MAX_IMPORT_ROWS} rows. Split it into smaller files.`);
    return out;
  }
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const col = (name: string) => header.indexOf(name);
  if (col('handle') < 0 && col('title') < 0) {
    out.errors.push('The file needs a "title" column (or a "handle" column to update existing products).');
    return out;
  }
  out.hasVariantColumns = ['option1_value', 'variant_price', 'variant_stock', 'variant_sku'].some((c) => col(c) >= 0);

  const byHandle = new Map<string, ImportItem>();
  const bad = new Set<string>();
  const optionNames = new Map<string, string[]>();
  const optionValues = new Map<string, string[][]>();
  out.total = rows.length - 1;

  for (let r = 1; r < rows.length; r += 1) {
    const line = rows[r];
    const n = r + 1;
    const get = (name: string): string => {
      const i = col(name);
      return i < 0 ? '' : (line[i] ?? '').trim();
    };
    const has = (name: string) => col(name) >= 0;
    const title = unsafeText(get('title'));
    const handle = get('handle') ? slugify(get('handle')) : title ? slugify(title) : '';
    if (!handle) {
      out.errors.push(`Row ${n}: needs a title or a handle.`);
      out.skipped += 1;
      continue;
    }
    if (bad.has(handle)) {
      out.skipped += 1;
      continue;
    }
    const errs: string[] = [];
    const whole = (name: string, allowEmpty: boolean): number | null | undefined => {
      const v = get(name);
      if (v === '') return allowEmpty ? null : undefined;
      if (!/^\d{1,9}$/.test(v)) {
        errs.push(`${name} must be a whole number of naira (no commas or symbols).`);
        return undefined;
      }
      return Number(v);
    };

    let item = byHandle.get(handle);
    const isNew = !item;
    if (!item) {
      item = { row: n, handle, patch: {}, images: null, options: null, variants: [] };
      const p = item.patch;
      if (has('title') && title) p.name = title.slice(0, 200);
      if (has('description')) p.description = unsafeText(get('description')).slice(0, 5000) || null;
      if (has('status')) {
        const s = get('status').toLowerCase() || 'active';
        if (s === 'active' || s === 'draft' || s === 'archived') p.status = s;
        else errs.push('status must be active, draft or archived.');
      }
      if (has('vendor')) p.vendor = unsafeText(get('vendor')).slice(0, 100) || null;
      if (has('type')) p.product_type = unsafeText(get('type')).slice(0, 100) || null;
      if (has('category')) p.category = unsafeText(get('category')).slice(0, 100) || null;
      if (has('tags')) p.tags = parseTags(unsafeText(get('tags')));
      const price = whole('price', false);
      if (price !== undefined && price !== null) p.price = price;
      if (has('compare_at_price')) {
        const v = whole('compare_at_price', true);
        if (v !== undefined) p.compare_at_price = v;
      }
      if (has('cost')) {
        const v = whole('cost', true);
        if (v !== undefined) p.cost = v;
      }
      if (has('sku')) p.sku = unsafeText(get('sku')).slice(0, 60) || null;
      if (has('barcode')) p.barcode = unsafeText(get('barcode')).slice(0, 60) || null;
      if (has('track_stock')) {
        const b = get('track_stock').toLowerCase();
        if (TRUE.has(b)) p.track_stock = true;
        else if (FALSE.has(b)) p.track_stock = false;
        else errs.push('track_stock must be true or false.');
      }
      if (has('stock')) {
        const v = whole('stock', false);
        if (v !== undefined && v !== null) p.stock = v;
      }
      if (has('continue_selling')) {
        const b = get('continue_selling').toLowerCase();
        if (TRUE.has(b)) p.continue_selling = true;
        else if (FALSE.has(b)) p.continue_selling = false;
        else errs.push('continue_selling must be true or false.');
      }
      if (has('low_stock_threshold')) {
        const v = whole('low_stock_threshold', false);
        if (v !== undefined && v !== null) p.low_stock_threshold = v;
      }
      if (has('weight_grams')) {
        const v = whole('weight_grams', true);
        if (v !== undefined) p.weight_grams = v;
      }
      if (has('seo_title')) p.seo_title = unsafeText(get('seo_title')).slice(0, 70) || null;
      if (has('seo_description')) p.seo_description = unsafeText(get('seo_description')).slice(0, 320) || null;
      if (has('publish_at')) {
        const v = get('publish_at');
        if (!v) p.publish_at = null;
        else if (Number.isNaN(new Date(v).getTime())) errs.push('publish_at is not a valid date. Use a format like 2026-12-01 09:00.');
        else p.publish_at = new Date(v).toISOString();
      }
      if (has('images')) {
        const list = get('images').split(/[|;\n]/).map((x) => x.trim()).filter(Boolean);
        if (list.some((u) => !/^https?:\/\/\S+$/i.test(u))) errs.push('images must be web addresses starting with http:// or https://.');
        else if (list.length > MAX_IMAGES) errs.push(`Use at most ${MAX_IMAGES} images.`);
        else item.images = list;
      }
      if (p.compare_at_price != null && p.price != null && p.compare_at_price <= p.price) errs.push('compare_at_price must be higher than price.');
    }

    // Variant data (the first row of a product and any rows that follow it)
    if (out.hasVariantColumns) {
      const names = optionNames.get(handle) ?? [];
      const vals = optionValues.get(handle) ?? [];
      const ov: Record<string, string> = {};
      let any = false;
      for (let k = 1; k <= MAX_OPTIONS; k += 1) {
        const nm = unsafeText(get(`option${k}_name`));
        const val = unsafeText(get(`option${k}_value`));
        if (nm && !names[k - 1]) names[k - 1] = nm.slice(0, 40);
        if (val) {
          if (!names[k - 1]) errs.push(`option${k}_value needs an option${k}_name.`);
          else {
            ov[names[k - 1]] = val.slice(0, 60);
            any = true;
            vals[k - 1] = [...(vals[k - 1] ?? []), val.slice(0, 60)];
          }
        }
      }
      optionNames.set(handle, names);
      optionValues.set(handle, vals);
      if (any) {
        const vp = get('variant_price');
        const price = vp === '' ? null : /^\d{1,9}$/.test(vp) ? Number(vp) : (errs.push('variant_price must be a whole number of naira.'), null);
        const cap = get('variant_compare_at_price');
        const cost = get('variant_cost');
        const stock = get('variant_stock');
        if (cap && !/^\d{1,9}$/.test(cap)) errs.push('variant_compare_at_price must be a whole number.');
        if (cost && !/^\d{1,9}$/.test(cost)) errs.push('variant_cost must be a whole number.');
        if (stock && !/^\d{1,9}$/.test(stock)) errs.push('variant_stock must be a whole number.');
        item.variants.push({
          option_values: ov,
          price,
          compare_at_price: /^\d{1,9}$/.test(cap) ? Number(cap) : null,
          cost: /^\d{1,9}$/.test(cost) ? Number(cost) : null,
          sku: unsafeText(get('variant_sku')).slice(0, 60) || null,
          barcode: unsafeText(get('variant_barcode')).slice(0, 60) || null,
          stock: /^\d{1,9}$/.test(stock) ? Number(stock) : 0,
        });
      }
    }

    if (errs.length) {
      out.errors.push(...errs.map((e) => `Row ${n} (${handle}): ${e}`));
      bad.add(handle);
      if (!isNew) {
        byHandle.delete(handle);
        out.items = out.items.filter((i) => i.handle !== handle);
      } else out.skipped += 1;
      continue;
    }
    if (isNew) {
      byHandle.set(handle, item);
      out.items.push(item);
    }
  }

  // Finish options and check variants
  for (const item of [...out.items]) {
    const drop = (msg: string) => {
      out.errors.push(`Row ${item.row} (${item.handle}): ${msg}`);
      out.items = out.items.filter((i) => i !== item);
      out.skipped += 1;
    };
    if (out.hasVariantColumns) {
      const names = (optionNames.get(item.handle) ?? []).filter(Boolean);
      if (item.variants.length) {
        const vals = optionValues.get(item.handle) ?? [];
        const options: OptionDef[] = names.map((nm, i) => ({ name: nm, values: Array.from(new Set(vals[i] ?? [])) }));
        const msg = checkOptions(options);
        if (msg) {
          drop(msg);
          continue;
        }
        if (item.variants.some((v) => options.some((o) => !v.option_values[o.name]))) {
          drop('every variant row needs a value for each option.');
          continue;
        }
        const keys = item.variants.map((v) => comboKey(v.option_values, options));
        if (new Set(keys).size !== keys.length) {
          drop('two variant rows have the same option values.');
          continue;
        }
        if (item.variants.length > MAX_VARIANTS) {
          drop(`more than ${MAX_VARIANTS} variants.`);
          continue;
        }
        item.options = options;
        if (item.patch.price === undefined) {
          const prices = item.variants.map((v) => v.price).filter((p): p is number => p !== null);
          if (prices.length) item.patch.price = Math.min(...prices);
        }
      } else {
        item.options = []; // the file has variant columns and this product has none
      }
    }
  }
  return out;
}
