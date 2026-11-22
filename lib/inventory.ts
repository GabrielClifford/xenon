// Shared logic for Inventory: locations, stock rows, value, reorder suggestions and CSV counts.
// Pure functions only (no database calls), so it is easy to test.
import { parseCsv, toCsv, type Product, type VariantRow } from './products';

export type Reason = 'initial' | 'received' | 'correction' | 'recount' | 'damaged' | 'lost' | 'returned' | 'sold' | 'transfer_in' | 'transfer_out' | 'purchase_received' | 'other';

export const reasonLabel: Record<Reason, string> = {
  initial: 'Opening stock',
  received: 'Received',
  correction: 'Correction',
  recount: 'Stock count',
  damaged: 'Damaged',
  lost: 'Lost or stolen',
  returned: 'Customer return',
  sold: 'Sold',
  transfer_in: 'Transfer in',
  transfer_out: 'Transfer out',
  purchase_received: 'Purchase order received',
  other: 'Other',
};

// Reasons a person can pick when adding or removing stock by hand
export const adjustReasons: { v: Reason; t: string; sign: 'any' | 'plus' | 'minus' }[] = [
  { v: 'received', t: 'Received new stock', sign: 'plus' },
  { v: 'returned', t: 'Customer return', sign: 'plus' },
  { v: 'damaged', t: 'Damaged', sign: 'minus' },
  { v: 'lost', t: 'Lost or stolen', sign: 'minus' },
  { v: 'correction', t: 'Correction', sign: 'any' },
  { v: 'other', t: 'Other', sign: 'any' },
];

export type Loc = { id: string; name: string; address: string | null; phone: string | null; is_default: boolean; active: boolean; sells_online: boolean };
export type Level = { location_id: string; product_id: string; variant_id: string | null; on_hand: number };
export type Movement = {
  id: string;
  location_id: string | null;
  product_id: string | null;
  variant_id: string | null;
  location_name: string | null;
  item_name: string | null;
  delta: number;
  quantity_after: number;
  reason: Reason;
  note: string | null;
  created_at: string;
};

export const LOC_COLS = 'id,name,address,phone,is_default,active,sells_online';
export const MOVE_COLS = 'id,location_id,product_id,variant_id,location_name,item_name,delta,quantity_after,reason,note,created_at';

const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);
const whole = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? Math.trunc(v) : 0);

export function readLoc(r: Record<string, unknown>): Loc {
  return {
    id: String(r.id ?? ''),
    name: str(r.name) ?? '',
    address: str(r.address),
    phone: str(r.phone),
    is_default: r.is_default === true,
    active: r.active !== false,
    sells_online: r.sells_online !== false,
  };
}

export function readLevel(r: Record<string, unknown>): Level {
  return { location_id: String(r.location_id ?? ''), product_id: String(r.product_id ?? ''), variant_id: str(r.variant_id), on_hand: whole(r.on_hand) };
}

const REASONS = Object.keys(reasonLabel);
export function readMovement(r: Record<string, unknown>): Movement {
  const reason = String(r.reason);
  return {
    id: String(r.id ?? ''),
    location_id: str(r.location_id),
    product_id: str(r.product_id),
    variant_id: str(r.variant_id),
    location_name: str(r.location_name),
    item_name: str(r.item_name),
    delta: whole(r.delta),
    quantity_after: whole(r.quantity_after),
    reason: (REASONS.includes(reason) ? reason : 'other') as Reason,
    note: str(r.note),
    created_at: str(r.created_at) ?? '',
  };
}

/* ------------------------------- stock rows ------------------------------- */

export type Item = {
  key: string;
  productId: string;
  variantId: string | null;
  name: string;
  variantTitle: string | null;
  handle: string | null;
  sku: string | null;
  barcode: string | null;
  vendor: string | null;
  category: string | null;
  cover: string | null;
  track: boolean;
  threshold: number;
  cost: number | null;
  price: number;
  continueSelling: boolean;
  status: Product['status'];
  levels: Record<string, number>;
};

export const itemKey = (productId: string, variantId: string | null) => `${productId}:${variantId ?? ''}`;
export const itemLabel = (i: Pick<Item, 'name' | 'variantTitle'>) => (i.variantTitle ? `${i.name} / ${i.variantTitle}` : i.name);

// One row per product, or one row per variant when the product has variants.
export function buildItems(products: Product[], variants: VariantRow[], levels: Level[]): Item[] {
  const lv = new Map<string, Record<string, number>>();
  for (const l of levels) {
    const k = itemKey(l.product_id, l.variant_id);
    const rec = lv.get(k) ?? {};
    rec[l.location_id] = (rec[l.location_id] ?? 0) + l.on_hand;
    lv.set(k, rec);
  }
  const byProduct = new Map<string, VariantRow[]>();
  for (const v of variants) byProduct.set(v.product_id, [...(byProduct.get(v.product_id) ?? []), v]);

  const out: Item[] = [];
  for (const p of products) {
    const cover = p.images?.[0] ?? p.photo_url ?? null;
    const base = { productId: p.id, name: p.name, handle: p.handle, vendor: p.vendor, category: p.category, cover, track: p.track_stock, threshold: p.low_stock_threshold, continueSelling: p.continue_selling, status: p.status };
    const vs = p.options.length > 0 ? (byProduct.get(p.id) ?? []).slice().sort((a, b) => a.position - b.position) : [];
    if (vs.length > 0) {
      for (const v of vs) {
        out.push({ ...base, key: itemKey(p.id, v.id), variantId: v.id, variantTitle: v.title, sku: v.sku, barcode: v.barcode, cost: v.cost ?? p.cost, price: v.price, levels: lv.get(itemKey(p.id, v.id)) ?? {} });
      }
    } else {
      out.push({ ...base, key: itemKey(p.id, null), variantId: null, variantTitle: null, sku: p.sku, barcode: p.barcode, cost: p.cost, price: p.price, levels: lv.get(itemKey(p.id, null)) ?? {} });
    }
  }
  return out;
}

export const qtyAt = (i: Item, locationId: string) => i.levels[locationId] ?? 0;
export const qtyIn = (i: Item, locationIds: string[]) => locationIds.reduce((s, id) => s + qtyAt(i, id), 0);

export type State = 'untracked' | 'out' | 'low' | 'ok';
export function stateOf(i: Pick<Item, 'track' | 'threshold'>, qty: number): State {
  if (!i.track) return 'untracked';
  if (qty <= 0) return 'out';
  if (qty <= i.threshold) return 'low';
  return 'ok';
}

/* -------------------------------- summaries -------------------------------- */

export type Summary = { units: number; costValue: number; retailValue: number; profit: number; low: number; out: number; missingCost: number; items: number };

export function summarize(items: Item[], locationIds: string[]): Summary {
  const s: Summary = { units: 0, costValue: 0, retailValue: 0, profit: 0, low: 0, out: 0, missingCost: 0, items: 0 };
  for (const i of items) {
    const q = qtyIn(i, locationIds);
    s.items += 1;
    s.units += q;
    s.retailValue += q * i.price;
    if (q > 0) {
      if (i.cost === null) s.missingCost += 1;
      else s.costValue += q * i.cost;
    }
    const st = stateOf(i, q);
    if (st === 'low') s.low += 1;
    if (st === 'out') s.out += 1;
  }
  s.profit = s.retailValue - s.costValue;
  return s;
}

/* ------------------------------ reorder report ------------------------------ */

// Aim for twice the warning level, and never suggest less than one unit.
export function suggestedReorder(i: Pick<Item, 'threshold'>, qty: number): number {
  const target = Math.max(i.threshold * 2, i.threshold + 1, 2);
  return Math.max(target - qty, 1);
}

export type ReorderRow = { item: Item; qty: number; suggest: number; cost: number | null };
export type ReorderGroup = { vendor: string; rows: ReorderRow[]; total: number | null };

export function reorderGroups(items: Item[], locationIds: string[]): ReorderGroup[] {
  const map = new Map<string, ReorderRow[]>();
  for (const i of items) {
    if (!i.track || i.status === 'archived') continue;
    const q = qtyIn(i, locationIds);
    const st = stateOf(i, q);
    if (st !== 'low' && st !== 'out') continue;
    const suggest = suggestedReorder(i, q);
    const key = i.vendor?.trim() || '';
    map.set(key, [...(map.get(key) ?? []), { item: i, qty: q, suggest, cost: i.cost }]);
  }
  const groups: ReorderGroup[] = [];
  for (const [vendor, rows] of map) {
    rows.sort((a, b) => a.qty - b.qty || itemLabel(a.item).localeCompare(itemLabel(b.item)));
    const known = rows.every((r) => r.cost !== null);
    groups.push({ vendor, rows, total: known ? rows.reduce((s, r) => s + r.suggest * (r.cost as number), 0) : null });
  }
  return groups.sort((a, b) => (a.vendor === '' ? 1 : b.vendor === '' ? -1 : a.vendor.localeCompare(b.vendor)));
}

/* ----------------------------------- CSV ----------------------------------- */

// Cells that start with = + - @ can run as formulas in Excel. Text columns get a leading apostrophe on export.
const safeText = (v: string) => (/^[=+\-@\t\r]/.test(v) ? `'${v}` : v);
const unsafeText = (v: string) => (/^'[=+\-@\t\r]/.test(v) ? v.slice(1) : v);

export function inventoryToCsv(items: Item[], locations: Loc[]): string {
  const head = ['Handle', 'Name', 'Variant', 'SKU', 'Barcode', 'Vendor', 'Category', 'Cost', 'Price', ...locations.map((l) => `On hand (${l.name})`), 'Total'];
  const rows = items.map((i) => [
    safeText(i.handle ?? ''),
    safeText(i.name),
    safeText(i.variantTitle ?? ''),
    safeText(i.sku ?? ''),
    safeText(i.barcode ?? ''),
    safeText(i.vendor ?? ''),
    safeText(i.category ?? ''),
    i.cost === null ? '' : String(i.cost),
    String(i.price),
    ...locations.map((l) => String(qtyAt(i, l.id))),
    String(qtyIn(i, locations.map((l) => l.id))),
  ]);
  return toCsv([head, ...rows]);
}

export function reorderToCsv(groups: ReorderGroup[]): string {
  const head = ['Vendor', 'Name', 'Variant', 'SKU', 'In stock', 'Warn at', 'Suggested order', 'Cost each', 'Line cost'];
  const rows: string[][] = [];
  for (const g of groups) {
    for (const r of g.rows) {
      rows.push([
        safeText(g.vendor),
        safeText(r.item.name),
        safeText(r.item.variantTitle ?? ''),
        safeText(r.item.sku ?? ''),
        String(r.qty),
        String(r.item.threshold),
        String(r.suggest),
        r.cost === null ? '' : String(r.cost),
        r.cost === null ? '' : String(r.cost * r.suggest),
      ]);
    }
  }
  return toCsv([head, ...rows]);
}

export function movementsToCsv(list: Movement[]): string {
  const head = ['Date', 'Item', 'Location', 'Change', 'Quantity after', 'Reason', 'Note'];
  const rows = list.map((m) => [m.created_at, safeText(m.item_name ?? ''), safeText(m.location_name ?? ''), String(m.delta), String(m.quantity_after), reasonLabel[m.reason], safeText(m.note ?? '')]);
  return toCsv([head, ...rows]);
}

export type Count = { locationId: string; locationName: string; item: Item; qty: number; before: number };
export type CountParse = { counts: Count[]; errors: string[]; unchanged: number };

const norm = (s: string) => s.trim().toLowerCase();

// Reads a file of counts. Rows are matched by SKU, or by product handle plus variant name.
// Quantities come from columns named "On hand (Location)", or a single "On hand" / "Quantity" column that goes to `fallback`.
export function parseCounts(text: string, items: Item[], locations: Loc[], fallback: Loc | null): CountParse {
  const rows = parseCsv(text);
  const res: CountParse = { counts: [], errors: [], unchanged: 0 };
  if (rows.length < 2) {
    res.errors.push('The file needs a header row and at least one item.');
    return res;
  }
  const head = rows[0].map(norm);
  const col = (...names: string[]) => head.findIndex((h) => names.includes(h));
  const iSku = col('sku');
  const iHandle = col('handle');
  const iVariant = col('variant', 'variant title');
  const iName = col('name', 'title');
  if (iSku < 0 && iHandle < 0) {
    res.errors.push('Add a SKU column or a Handle column so each row can be matched to a product.');
    return res;
  }

  const qtyCols: { index: number; loc: Loc }[] = [];
  head.forEach((h, index) => {
    const m = /^on hand \((.+)\)$/.exec(h);
    if (m) {
      const loc = locations.find((l) => norm(l.name) === m[1].trim());
      if (loc) qtyCols.push({ index, loc });
    }
  });
  if (qtyCols.length === 0) {
    const plain = col('on hand', 'quantity', 'qty', 'available');
    if (plain >= 0 && fallback) qtyCols.push({ index: plain, loc: fallback });
  }
  if (qtyCols.length === 0) {
    res.errors.push('No quantity column found. Use "On hand (Location name)", or a column called "On hand" or "Quantity".');
    return res;
  }

  const bySku = new Map<string, Item[]>();
  const byHandle = new Map<string, Item[]>();
  for (const i of items) {
    if (i.sku) bySku.set(norm(i.sku), [...(bySku.get(norm(i.sku)) ?? []), i]);
    if (i.handle) byHandle.set(norm(i.handle), [...(byHandle.get(norm(i.handle)) ?? []), i]);
  }

  const seen = new Set<string>();
  for (let r = 1; r < rows.length; r += 1) {
    const cells = rows[r];
    const get = (idx: number) => (idx >= 0 ? unsafeText((cells[idx] ?? '').trim()) : '');
    const line = r + 1;
    const sku = get(iSku);
    const handle = get(iHandle);
    const variant = get(iVariant);
    let item: Item | undefined;
    if (sku) {
      const hit = bySku.get(norm(sku)) ?? [];
      if (hit.length > 1) {
        res.errors.push(`Row ${line}: the SKU "${sku}" is used by more than one item.`);
        continue;
      }
      item = hit[0];
    } else if (handle) {
      const hit = (byHandle.get(norm(handle)) ?? []).filter((i) => (variant ? norm(i.variantTitle ?? '') === norm(variant) : true));
      if (hit.length > 1) {
        res.errors.push(`Row ${line}: "${handle}" has variants, so add a Variant column to say which one.`);
        continue;
      }
      item = hit[0];
    }
    if (!item) {
      res.errors.push(`Row ${line}: no product matches ${sku ? `SKU "${sku}"` : `handle "${handle}"`}${iName >= 0 && get(iName) ? ` (${get(iName)})` : ''}.`);
      continue;
    }
    for (const { index, loc } of qtyCols) {
      const raw = (cells[index] ?? '').trim();
      if (raw === '') continue;
      if (!/^\d{1,9}$/.test(raw)) {
        res.errors.push(`Row ${line}: "${raw}" is not a valid quantity. Use whole numbers, zero or more.`);
        continue;
      }
      const dup = `${item.key}|${loc.id}`;
      if (seen.has(dup)) {
        res.errors.push(`Row ${line}: ${itemLabel(item)} appears twice for ${loc.name}.`);
        continue;
      }
      seen.add(dup);
      const qty = Number(raw);
      const before = qtyAt(item, loc.id);
      if (qty === before) res.unchanged += 1;
      else res.counts.push({ locationId: loc.id, locationName: loc.name, item, qty, before });
    }
  }
  return res;
}

/* --------------------------------- helpers --------------------------------- */

export function chunk<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

export const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('en-NG', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
};

// Friendly text for database errors raised by the inventory functions
export function inventoryError(msg: string): string {
  if (/does not exist|schema cache|Could not find the function|Could not find the table/i.test(msg)) return 'Run inventory.sql in the Supabase SQL Editor first, then reload this page.';
  return msg;
}
