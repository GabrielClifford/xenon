// Shared logic for Purchase orders: totals, tax, landed cost, status, payments, CSV, WhatsApp text and print.
// Pure functions only (no database calls), so it is easy to test.
import { parseCsv, toCsv } from './products';
import { itemKey, itemLabel, qtyIn, reorderGroups, type Item } from './inventory';

/* --------------------------------- constants --------------------------------- */

export type PoStatus = 'draft' | 'ordered' | 'partial' | 'received' | 'closed' | 'cancelled';
export const poStatusLabel: Record<PoStatus, string> = {
  draft: 'Draft',
  ordered: 'Ordered',
  partial: 'Partially received',
  received: 'Received',
  closed: 'Closed',
  cancelled: 'Cancelled',
};

export type AdjType = 'shipping' | 'customs' | 'discount' | 'foreign_fee' | 'freight' | 'insurance' | 'rush' | 'surcharge' | 'tariffs' | 'other';
export const adjLabels: Record<AdjType, string> = {
  shipping: 'Shipping amount',
  customs: 'Customs duties',
  discount: 'Discount',
  foreign_fee: 'Foreign transaction fee',
  freight: 'Freight fee',
  insurance: 'Insurance',
  rush: 'Rush fee',
  surcharge: 'Surcharge',
  tariffs: 'Tariffs',
  other: 'Other',
};
export type Adjustment = { type: AdjType; amount: number };

export const currencies: { code: string; name: string }[] = [
  { code: 'NGN', name: 'Nigerian Naira (NGN ₦)' },
  { code: 'USD', name: 'US Dollar (USD $)' },
  { code: 'GBP', name: 'British Pound (GBP £)' },
  { code: 'EUR', name: 'Euro (EUR €)' },
  { code: 'CNY', name: 'Chinese Yuan (CNY ¥)' },
  { code: 'AED', name: 'UAE Dirham (AED)' },
  { code: 'INR', name: 'Indian Rupee (INR ₹)' },
  { code: 'GHS', name: 'Ghanaian Cedi (GHS)' },
  { code: 'ZAR', name: 'South African Rand (ZAR)' },
];

export const paymentTerms: { v: string; t: string }[] = [
  { v: '', t: 'None' },
  { v: 'due_on_receipt', t: 'Due on receipt' },
  { v: 'due_on_order', t: 'Due on order' },
  { v: 'net_7', t: 'Net 7' },
  { v: 'net_15', t: 'Net 15' },
  { v: 'net_30', t: 'Net 30' },
  { v: 'net_45', t: 'Net 45' },
  { v: 'net_60', t: 'Net 60' },
  { v: 'net_90', t: 'Net 90' },
];
export const termsLabel = (v: string | null) => paymentTerms.find((t) => t.v === (v ?? ''))?.t ?? 'None';

export const paymentMethods = ['Bank transfer', 'Cash', 'POS', 'Cheque', 'Mobile money', 'Other'];

export const MAX_LINES = 200;
export const MAX_TAGS = 20;
export const TAG_LEN = 40;

/* ---------------------------------- rows ---------------------------------- */

export type Supplier = {
  id: string;
  name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  country: string | null;
  currency: string;
  payment_terms: string | null;
  lead_time_days: number | null;
  notes: string | null;
  active: boolean;
};
export const SUPPLIER_COLS = 'id,name,contact_name,email,phone,address,country,currency,payment_terms,lead_time_days,notes,active';

export type Po = {
  id: string;
  number: number;
  supplier_id: string | null;
  supplier_name: string | null;
  destination_id: string | null;
  destination_name: string | null;
  status: PoStatus;
  currency: string;
  exchange_rate: number;
  tax_rate: number;
  tax_included: boolean;
  expected_at: string | null;
  ordered_at: string | null;
  received_at: string | null;
  reference: string | null;
  note: string | null;
  payment_terms: string | null;
  tags: string[];
  adjustments: Adjustment[];
  total: number;
  created_at: string;
};
export const PO_COLS = 'id,number,supplier_id,supplier_name,destination_id,destination_name,status,currency,exchange_rate,tax_rate,tax_included,expected_at,ordered_at,received_at,reference,note,payment_terms,tags,adjustments,total,created_at';

export type PoItem = {
  id: string;
  po_id: string;
  product_id: string | null;
  variant_id: string | null;
  name: string;
  sku: string | null;
  supplier_sku: string | null;
  quantity: number;
  received: number;
  rejected: number;
  unit_cost: number;
  position: number;
};
export const ITEM_COLS = 'id,po_id,product_id,variant_id,name,sku,supplier_sku,quantity,received,rejected,unit_cost,position';

export type Payment = { id: string; po_id: string; amount: number; paid_on: string; method: string | null; note: string | null; created_at: string };
export const PAYMENT_COLS = 'id,po_id,amount,paid_on,method,note,created_at';

const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);
const num = (v: unknown, d = 0): number => {
  const n = typeof v === 'string' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : d;
};
const STATUSES = Object.keys(poStatusLabel);
const ADJ = Object.keys(adjLabels);

export function readSupplier(r: Record<string, unknown>): Supplier {
  return {
    id: String(r.id ?? ''),
    name: str(r.name) ?? '',
    contact_name: str(r.contact_name),
    email: str(r.email),
    phone: str(r.phone),
    address: str(r.address),
    country: str(r.country),
    currency: str(r.currency) ?? 'NGN',
    payment_terms: str(r.payment_terms),
    lead_time_days: r.lead_time_days === null || r.lead_time_days === undefined ? null : Math.trunc(num(r.lead_time_days)),
    notes: str(r.notes),
    active: r.active !== false,
  };
}

export function readAdjustments(v: unknown): Adjustment[] {
  if (!Array.isArray(v)) return [];
  const out: Adjustment[] = [];
  for (const a of v) {
    if (a && typeof a === 'object') {
      const o = a as Record<string, unknown>;
      const type = String(o.type);
      const amount = num(o.amount, NaN);
      if (ADJ.includes(type) && Number.isFinite(amount) && amount >= 0) out.push({ type: type as AdjType, amount });
    }
  }
  return out;
}

export function readPo(r: Record<string, unknown>): Po {
  const status = String(r.status);
  return {
    id: String(r.id ?? ''),
    number: Math.trunc(num(r.number)),
    supplier_id: str(r.supplier_id),
    supplier_name: str(r.supplier_name),
    destination_id: str(r.destination_id),
    destination_name: str(r.destination_name),
    status: (STATUSES.includes(status) ? status : 'draft') as PoStatus,
    currency: str(r.currency) ?? 'NGN',
    exchange_rate: num(r.exchange_rate, 1) > 0 ? num(r.exchange_rate, 1) : 1,
    tax_rate: num(r.tax_rate),
    tax_included: r.tax_included !== false,
    expected_at: str(r.expected_at),
    ordered_at: str(r.ordered_at),
    received_at: str(r.received_at),
    reference: str(r.reference),
    note: str(r.note),
    payment_terms: str(r.payment_terms),
    tags: Array.isArray(r.tags) ? r.tags.filter((t): t is string => typeof t === 'string') : [],
    adjustments: readAdjustments(r.adjustments),
    total: num(r.total),
    created_at: str(r.created_at) ?? '',
  };
}

export function readPoItem(r: Record<string, unknown>): PoItem {
  return {
    id: String(r.id ?? ''),
    po_id: String(r.po_id ?? ''),
    product_id: str(r.product_id),
    variant_id: str(r.variant_id),
    name: str(r.name) ?? '',
    sku: str(r.sku),
    supplier_sku: str(r.supplier_sku),
    quantity: Math.trunc(num(r.quantity)),
    received: Math.trunc(num(r.received)),
    rejected: Math.trunc(num(r.rejected)),
    unit_cost: num(r.unit_cost),
    position: Math.trunc(num(r.position)),
  };
}

export function readPayment(r: Record<string, unknown>): Payment {
  return { id: String(r.id ?? ''), po_id: String(r.po_id ?? ''), amount: num(r.amount), paid_on: str(r.paid_on) ?? '', method: str(r.method), note: str(r.note), created_at: str(r.created_at) ?? '' };
}

/* --------------------------------- money --------------------------------- */

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function fmtMoney(n: number, currency = 'NGN'): string {
  const v = round2(n);
  if (currency === 'NGN') return `₦${v.toLocaleString('en-NG', { minimumFractionDigits: Number.isInteger(v) ? 0 : 2, maximumFractionDigits: 2 })}`;
  try {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency }).format(v);
  } catch {
    return `${currency} ${v.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
}

export type CostLine = { quantity: number; unit_cost: number };
export type Totals = { variants: number; units: number; subtotal: number; adjustments: number; tax: number; total: number };

// Discounts take money off, everything else adds to it. Tax is either already inside the prices or added on top.
export function calcTotals(lines: CostLine[], adjustments: Adjustment[], taxRate: number, taxIncluded: boolean): Totals {
  const subtotal = round2(lines.reduce((s, l) => s + l.quantity * l.unit_cost, 0));
  const adj = round2(adjustments.reduce((s, a) => s + (a.type === 'discount' ? -a.amount : a.amount), 0));
  const base = Math.max(round2(subtotal + adj), 0);
  const r = Math.max(taxRate, 0) / 100;
  const tax = round2(taxIncluded ? base - base / (1 + r) : base * r);
  const total = round2(taxIncluded ? base : base + tax);
  return { variants: lines.length, units: lines.reduce((s, l) => s + l.quantity, 0), subtotal, adjustments: adj, tax, total };
}

// What one unit really costs once shipping, duties and so on are spread over the lines by value.
export function landedUnitCost(line: CostLine, subtotal: number, adjustmentsNet: number): number {
  if (subtotal <= 0 || line.quantity <= 0) return line.unit_cost;
  return line.unit_cost + (adjustmentsNet * line.unit_cost) / subtotal;
}

export const toNaira = (amount: number, rate: number) => Math.max(Math.round(amount * rate), 0);

/* ------------------------------ status and dates ------------------------------ */

export const todayStr = (now = new Date()) => {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
};

export const isOpen = (s: PoStatus) => s === 'ordered' || s === 'partial';
export const canReceive = (s: PoStatus) => s === 'ordered' || s === 'partial';
export const linesEditable = (s: PoStatus) => s === 'draft' || s === 'ordered' || s === 'partial';
export const canDelete = (po: Pick<Po, 'status'>, items: Pick<PoItem, 'received' | 'rejected'>[]) => (po.status === 'draft' || po.status === 'cancelled') && items.every((i) => i.received === 0 && i.rejected === 0);

export function isLate(po: Pick<Po, 'status' | 'expected_at'>, today = todayStr()): boolean {
  return isOpen(po.status) && !!po.expected_at && po.expected_at < today;
}

export function progress(items: Pick<PoItem, 'quantity' | 'received' | 'rejected'>[]) {
  const ordered = items.reduce((s, i) => s + i.quantity, 0);
  const received = items.reduce((s, i) => s + i.received, 0);
  const rejected = items.reduce((s, i) => s + i.rejected, 0);
  return { ordered, received, rejected, left: Math.max(ordered - received - rejected, 0) };
}

export type PayState = 'none' | 'unpaid' | 'partial' | 'paid';
export const paidTotal = (pays: Pick<Payment, 'amount'>[]) => round2(pays.reduce((s, p) => s + p.amount, 0));
export const balanceOf = (total: number, paid: number) => Math.max(round2(total - paid), 0);
export function payState(total: number, paid: number): PayState {
  if (total <= 0) return 'none';
  if (paid <= 0) return 'unpaid';
  return paid >= total - 0.005 ? 'paid' : 'partial';
}
export const payLabel: Record<PayState, string> = { none: '', unpaid: 'Unpaid', partial: 'Part paid', paid: 'Paid' };

const termDays = (v: string | null): number | null => {
  const m = /^net_(\d+)$/.exec(v ?? '');
  return m ? Number(m[1]) : null;
};

// The day payment is due, worked out from the payment terms. Null when there are no terms.
export function dueDate(po: Pick<Po, 'payment_terms' | 'ordered_at' | 'received_at' | 'expected_at' | 'created_at'>): string | null {
  const t = po.payment_terms;
  if (!t) return null;
  const day = (iso: string | null) => (iso ? iso.slice(0, 10) : null);
  if (t === 'due_on_order') return day(po.ordered_at) ?? day(po.created_at);
  if (t === 'due_on_receipt') return day(po.received_at) ?? po.expected_at;
  const n = termDays(t);
  if (n === null) return null;
  const start = day(po.received_at) ?? day(po.ordered_at) ?? day(po.created_at);
  if (!start) return null;
  const d = new Date(`${start}T12:00:00`);
  d.setDate(d.getDate() + n);
  return todayStr(d);
}

export function isPaymentOverdue(po: Pick<Po, 'status' | 'payment_terms' | 'ordered_at' | 'received_at' | 'expected_at' | 'created_at' | 'total'>, paid: number, today = todayStr()): boolean {
  if (po.status === 'draft' || po.status === 'cancelled') return false;
  if (balanceOf(po.total, paid) <= 0) return false;
  const due = dueDate(po);
  return !!due && due < today;
}

/* ---------------------------------- checks ---------------------------------- */

export type FormLine = { quantity: string; unit_cost: string; received: number; rejected: number; name: string };
export type PoForm = {
  supplier_id: string;
  destination_id: string;
  currency: string;
  exchange_rate: string;
  tax_rate: string;
  tax_included: boolean;
  expected_at: string;
  reference: string;
  note: string;
  tags: string[];
  adjustments: Adjustment[];
  lines: FormLine[];
};

const isInt = (s: string) => /^\d{1,7}$/.test(s.trim());
const isMoney = (s: string) => /^\d{1,12}(\.\d{1,2})?$/.test(s.trim());

export function checkPo(f: PoForm): string {
  if (!f.supplier_id) return 'Choose a supplier.';
  if (!f.destination_id) return 'Choose where the stock will arrive.';
  if (f.lines.length === 0) return 'Add at least one product.';
  if (f.lines.length > MAX_LINES) return `An order can have up to ${MAX_LINES} lines.`;
  for (const l of f.lines) {
    if (!isInt(l.quantity) || Number(l.quantity) < 1) return `Enter a quantity of 1 or more for ${l.name}.`;
    if (Number(l.quantity) > 1000000) return `The quantity for ${l.name} is too large.`;
    if (Number(l.quantity) < l.received + l.rejected) return `${l.name}: ${l.received + l.rejected} units were already received, so the quantity cannot be lower than that.`;
    if (!isMoney(l.unit_cost)) return `Enter a cost for ${l.name}. Use numbers, with up to 2 decimals.`;
  }
  if (f.currency !== 'NGN') {
    const r = Number(f.exchange_rate);
    if (!Number.isFinite(r) || r <= 0) return `Enter how many naira one ${f.currency} is worth.`;
  }
  const tax = Number(f.tax_rate || 0);
  if (!Number.isFinite(tax) || tax < 0 || tax > 100) return 'The tax rate must be between 0 and 100.';
  if (f.expected_at && !/^\d{4}-\d{2}-\d{2}$/.test(f.expected_at)) return 'The estimated arrival date is not valid.';
  if (f.reference.length > 255) return 'The reference number can be up to 255 characters.';
  if (f.note.length > 5000) return 'The note can be up to 5000 characters.';
  if (f.tags.length > MAX_TAGS) return `Use up to ${MAX_TAGS} tags.`;
  if (f.tags.some((t) => t.length > TAG_LEN)) return `Each tag can be up to ${TAG_LEN} characters.`;
  if (f.adjustments.some((a) => !Number.isFinite(a.amount) || a.amount < 0)) return 'Cost adjustments must be zero or more.';
  return '';
}

export function parseTagInput(text: string, have: string[] = []): string[] {
  const seen = new Set(have.map((t) => t.toLowerCase()));
  const out: string[] = [];
  for (const raw of text.split(/[,\n]/)) {
    const t = raw.trim().replace(/\s+/g, ' ').slice(0, TAG_LEN);
    if (t && !seen.has(t.toLowerCase())) {
      seen.add(t.toLowerCase());
      out.push(t);
    }
  }
  return out;
}

/* ----------------------------- building order lines ----------------------------- */

export type LineSeed = { item: Item; quantity: number; unitCost: number | null };

// Cost is stored in naira on the product. On a foreign order it is turned into the supplier's currency.
export function defaultUnitCost(item: Pick<Item, 'cost'>, rate: number): number {
  if (item.cost === null || item.cost === undefined) return 0;
  return round2(rate > 0 ? item.cost / rate : item.cost);
}

// Items that are low or out of stock, ready to order. Pass a supplier name to keep to that vendor's products.
export function reorderSeeds(items: Item[], locationIds: string[], supplierName?: string): LineSeed[] {
  const want = supplierName?.trim().toLowerCase() ?? '';
  const seeds: LineSeed[] = [];
  for (const g of reorderGroups(items, locationIds)) {
    if (want && g.vendor.trim().toLowerCase() !== want) continue;
    for (const r of g.rows) seeds.push({ item: r.item, quantity: r.suggest, unitCost: null });
  }
  return seeds;
}

const norm = (s: string) => s.trim().toLowerCase();
const unsafeText = (v: string) => (/^'[=+\-@\t\r]/.test(v) ? v.slice(1) : v);

export type ImportResult = { seeds: LineSeed[]; errors: string[] };

// Reads a file of lines to order: SKU (or Handle + Variant), Quantity and optionally Cost.
export function parseLines(text: string, items: Item[]): ImportResult {
  const rows = parseCsv(text);
  const res: ImportResult = { seeds: [], errors: [] };
  if (rows.length < 2) {
    res.errors.push('The file needs a header row and at least one line.');
    return res;
  }
  const head = rows[0].map(norm);
  const col = (...n: string[]) => head.findIndex((h) => n.includes(h));
  const iSku = col('sku');
  const iHandle = col('handle');
  const iVariant = col('variant', 'variant title');
  const iQty = col('quantity', 'qty', 'order', 'order quantity');
  const iCost = col('cost', 'unit cost', 'cost per item', 'price');
  if (iSku < 0 && iHandle < 0) {
    res.errors.push('Add a SKU column or a Handle column so each row can be matched to a product.');
    return res;
  }
  if (iQty < 0) {
    res.errors.push('Add a Quantity column.');
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
      res.errors.push(`Row ${line}: no product matches ${sku ? `SKU "${sku}"` : `handle "${handle}"`}.`);
      continue;
    }
    const q = get(iQty);
    if (!/^\d{1,7}$/.test(q) || Number(q) < 1) {
      res.errors.push(`Row ${line}: "${q}" is not a valid quantity. Use a whole number of 1 or more.`);
      continue;
    }
    const c = get(iCost);
    if (c !== '' && !/^\d{1,12}(\.\d{1,2})?$/.test(c)) {
      res.errors.push(`Row ${line}: "${c}" is not a valid cost.`);
      continue;
    }
    if (seen.has(item.key)) {
      res.errors.push(`Row ${line}: ${itemLabel(item)} appears twice.`);
      continue;
    }
    seen.add(item.key);
    res.seeds.push({ item, quantity: Number(q), unitCost: c === '' ? null : Number(c) });
  }
  return res;
}

// What a scanner types: a barcode or SKU followed by Enter. Returns the one item it identifies.
export function findByCode(items: Item[], code: string): Item | null {
  const c = norm(code);
  if (!c) return null;
  const hit = items.filter((i) => (i.barcode && norm(i.barcode) === c) || (i.sku && norm(i.sku) === c));
  return hit.length === 1 ? hit[0] : null;
}

export { itemKey, qtyIn };

/* ----------------------------------- output ----------------------------------- */

const safeText = (v: string) => (/^[=+\-@\t\r]/.test(v) ? `'${v}` : v);

export function poToCsv(po: Po, items: PoItem[]): string {
  const head = ['PO', 'Supplier', 'SKU', 'Supplier SKU', 'Item', 'Ordered', 'Received', 'Rejected', 'Unit cost', 'Line total', 'Currency'];
  const rows = items.map((i) => [`#${po.number}`, safeText(po.supplier_name ?? ''), safeText(i.sku ?? ''), safeText(i.supplier_sku ?? ''), safeText(i.name), String(i.quantity), String(i.received), String(i.rejected), String(i.unit_cost), String(round2(i.quantity * i.unit_cost)), po.currency]);
  return toCsv([head, ...rows]);
}

export function listToCsv(pos: Po[], paidByPo: Record<string, number>): string {
  const head = ['PO', 'Supplier', 'Destination', 'Status', 'Ordered on', 'Expected', 'Reference', 'Currency', 'Total', 'Paid', 'Balance', 'Tags'];
  const rows = pos.map((p) => {
    const paid = paidByPo[p.id] ?? 0;
    return [`#${p.number}`, safeText(p.supplier_name ?? ''), safeText(p.destination_name ?? ''), poStatusLabel[p.status], p.ordered_at?.slice(0, 10) ?? '', p.expected_at ?? '', safeText(p.reference ?? ''), p.currency, String(p.total), String(paid), String(balanceOf(p.total, paid)), safeText(p.tags.join('; '))];
  });
  return toCsv([head, ...rows]);
}

export function whatsappText(po: Po, items: PoItem[], businessName: string): string {
  const lines = items.map((i) => `• ${i.quantity} x ${i.name}${i.supplier_sku ? ` (${i.supplier_sku})` : i.sku ? ` (${i.sku})` : ''} @ ${fmtMoney(i.unit_cost, po.currency)}`);
  const out = [`Hello${po.supplier_name ? ` ${po.supplier_name}` : ''}, this is a purchase order from ${businessName}.`, `PO #${po.number}${po.reference ? ` (ref ${po.reference})` : ''}`, '', ...lines, '', `Total: ${fmtMoney(po.total, po.currency)}`];
  if (po.expected_at) out.push(`Needed by: ${po.expected_at}`);
  if (po.destination_name) out.push(`Deliver to: ${po.destination_name}`);
  if (po.payment_terms) out.push(`Payment terms: ${termsLabel(po.payment_terms)}`);
  if (po.note?.trim()) out.push('', po.note.trim());
  return out.join('\n');
}

export const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

export function printHtml(po: Po, items: PoItem[], businessName: string, supplier: Supplier | null): string {
  const t = calcTotals(items, po.adjustments, po.tax_rate, po.tax_included);
  const e = escapeHtml;
  const money = (n: number) => e(fmtMoney(n, po.currency));
  const rows = items
    .map((i) => `<tr><td>${e(i.name)}${i.sku ? `<br><small>${e(i.sku)}</small>` : ''}</td><td>${e(i.supplier_sku ?? '')}</td><td class="r">${i.quantity}</td><td class="r">${money(i.unit_cost)}</td><td class="r">${money(i.quantity * i.unit_cost)}</td></tr>`)
    .join('');
  const adj = po.adjustments.map((a) => `<tr><td colspan="4" class="r">${e(adjLabels[a.type])}</td><td class="r">${a.type === 'discount' ? '-' : ''}${money(a.amount)}</td></tr>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>Purchase order #${po.number}</title>
<style>body{font-family:Arial,sans-serif;color:#111;margin:32px;font-size:14px}h1{font-size:22px;margin:0 0 4px}small{color:#555}table{width:100%;border-collapse:collapse;margin-top:16px}th,td{padding:8px;border-bottom:1px solid #ddd;text-align:left;vertical-align:top}th{background:#f5f5f5;font-size:12px;text-transform:uppercase}.r{text-align:right}.grid{display:flex;gap:40px;margin-top:16px}.grid div{flex:1}.tot td{font-weight:bold;border-bottom:0}</style></head><body>
<h1>Purchase order #${po.number}</h1><small>${e(businessName)}</small>
<div class="grid"><div><b>Supplier</b><br>${e(po.supplier_name ?? '')}${supplier?.contact_name ? `<br>${e(supplier.contact_name)}` : ''}${supplier?.phone ? `<br>${e(supplier.phone)}` : ''}${supplier?.email ? `<br>${e(supplier.email)}` : ''}${supplier?.address ? `<br>${e(supplier.address)}` : ''}</div>
<div><b>Deliver to</b><br>${e(po.destination_name ?? '')}<br><br><b>Needed by</b><br>${e(po.expected_at ?? 'Not set')}</div>
<div><b>Reference</b><br>${e(po.reference ?? 'None')}<br><br><b>Payment terms</b><br>${e(termsLabel(po.payment_terms))}</div></div>
<table><thead><tr><th>Item</th><th>Supplier SKU</th><th class="r">Qty</th><th class="r">Unit cost</th><th class="r">Total</th></tr></thead><tbody>${rows}${adj}
<tr><td colspan="4" class="r">Taxes ${po.tax_included ? '(included)' : `(${po.tax_rate}%)`}</td><td class="r">${money(t.tax)}</td></tr>
<tr class="tot"><td colspan="4" class="r">Total</td><td class="r">${money(t.total)}</td></tr></tbody></table>
${po.note?.trim() ? `<p><b>Note</b><br>${e(po.note.trim()).replace(/\n/g, '<br>')}</p>` : ''}
</body></html>`;
}

/* ---------------------------------- suppliers ---------------------------------- */

export type SupplierStats = { orders: number; spendNgn: number; owedNgn: number; open: number };

export function supplierStats(supplierId: string, pos: Po[], paidByPo: Record<string, number>): SupplierStats {
  const s: SupplierStats = { orders: 0, spendNgn: 0, owedNgn: 0, open: 0 };
  for (const p of pos) {
    if (p.supplier_id !== supplierId || p.status === 'draft' || p.status === 'cancelled') continue;
    s.orders += 1;
    if (isOpen(p.status)) s.open += 1;
    s.spendNgn += p.total * p.exchange_rate;
    s.owedNgn += balanceOf(p.total, paidByPo[p.id] ?? 0) * p.exchange_rate;
  }
  s.spendNgn = Math.round(s.spendNgn);
  s.owedNgn = Math.round(s.owedNgn);
  return s;
}

export function poError(msg: string): string {
  if (/does not exist|schema cache|Could not find the (function|table)/i.test(msg)) return 'Run purchase-orders.sql in the Supabase SQL Editor first, then reload this page.';
  if (/suppliers_name_idx|duplicate key/i.test(msg)) return 'You already have a supplier with that name.';
  return msg;
}
