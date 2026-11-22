// Shared logic for Transfers: types, checks, restock suggestions, CSV, WhatsApp text and the printed packing slip.
// Pure functions only (no database calls), so it is easy to test.
import { toCsv } from './products';
import { itemLabel, qtyAt, stateOf, suggestedReorder, type Item } from './inventory';
import { escapeHtml, findByCode, parseLines, todayStr, type LineSeed } from './purchaseOrders';

export { findByCode, parseLines, todayStr, type LineSeed };

export type TransferStatus = 'draft' | 'in_transit' | 'partial' | 'received' | 'cancelled';
export const trStatusLabel: Record<TransferStatus, string> = {
  draft: 'Draft',
  in_transit: 'In transit',
  partial: 'Partially received',
  received: 'Received',
  cancelled: 'Cancelled',
};

export const MAX_LINES = 200;
export const MAX_TAGS = 20;
export const TAG_LEN = 40;

export type Transfer = {
  id: string;
  number: number;
  origin_id: string | null;
  origin_supplier_id: string | null;
  origin_name: string | null;
  destination_id: string | null;
  destination_name: string | null;
  status: TransferStatus;
  reference: string | null;
  note: string | null;
  tags: string[];
  po_id: string | null;
  expected_at: string | null;
  carrier: string | null;
  tracking: string | null;
  shipped_at: string | null;
  received_at: string | null;
  created_at: string;
};
export const TRANSFER_COLS = 'id,number,origin_id,origin_supplier_id,origin_name,destination_id,destination_name,status,reference,note,tags,po_id,expected_at,carrier,tracking,shipped_at,received_at,created_at';

export type TransferItem = {
  id: string;
  transfer_id: string;
  product_id: string | null;
  variant_id: string | null;
  name: string;
  sku: string | null;
  quantity: number;
  received: number;
  rejected: number;
  position: number;
};
export const TITEM_COLS = 'id,transfer_id,product_id,variant_id,name,sku,quantity,received,rejected,position';

const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);
const int = (v: unknown): number => {
  const n = typeof v === 'string' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? Math.trunc(n) : 0;
};
const STATUSES = Object.keys(trStatusLabel);

export function readTransfer(r: Record<string, unknown>): Transfer {
  const status = String(r.status);
  return {
    id: String(r.id ?? ''),
    number: int(r.number),
    origin_id: str(r.origin_id),
    origin_supplier_id: str(r.origin_supplier_id),
    origin_name: str(r.origin_name),
    destination_id: str(r.destination_id),
    destination_name: str(r.destination_name),
    status: (STATUSES.includes(status) ? status : 'draft') as TransferStatus,
    reference: str(r.reference),
    note: str(r.note),
    tags: Array.isArray(r.tags) ? r.tags.filter((t): t is string => typeof t === 'string') : [],
    po_id: str(r.po_id),
    expected_at: str(r.expected_at),
    carrier: str(r.carrier),
    tracking: str(r.tracking),
    shipped_at: str(r.shipped_at),
    received_at: str(r.received_at),
    created_at: str(r.created_at) ?? '',
  };
}

export function readTransferItem(r: Record<string, unknown>): TransferItem {
  return { id: String(r.id ?? ''), transfer_id: String(r.transfer_id ?? ''), product_id: str(r.product_id), variant_id: str(r.variant_id), name: str(r.name) ?? '', sku: str(r.sku), quantity: int(r.quantity), received: int(r.received), rejected: int(r.rejected), position: int(r.position) };
}

/* ------------------------------ status and dates ------------------------------ */

export const inTransit = (s: TransferStatus) => s === 'in_transit' || s === 'partial';
export const canReceive = inTransit;
export const canDelete = (s: TransferStatus) => s === 'draft' || s === 'cancelled';

export function isLate(t: Pick<Transfer, 'status' | 'expected_at'>, today = todayStr()): boolean {
  return inTransit(t.status) && !!t.expected_at && t.expected_at < today;
}

// Whole days a transfer has been on the road, for "in transit for 4 days".
export function daysOnRoad(t: Pick<Transfer, 'status' | 'shipped_at'>, now = new Date()): number | null {
  if (!inTransit(t.status) || !t.shipped_at) return null;
  const ms = now.getTime() - new Date(t.shipped_at).getTime();
  return Number.isFinite(ms) ? Math.max(Math.floor(ms / 86400000), 0) : null;
}

export function progress(items: Pick<TransferItem, 'quantity' | 'received' | 'rejected'>[]) {
  const sent = items.reduce((s, i) => s + i.quantity, 0);
  const received = items.reduce((s, i) => s + i.received, 0);
  const rejected = items.reduce((s, i) => s + i.rejected, 0);
  return { sent, received, rejected, left: Math.max(sent - received - rejected, 0) };
}

/* ---------------------------------- checks ---------------------------------- */

export type FormLine = { key: string; quantity: string; name: string };
export type TransferForm = {
  // 'loc:<id>' or 'sup:<id>' or ''
  origin: string;
  destination_id: string;
  reference: string;
  note: string;
  tags: string[];
  expected_at: string;
  carrier: string;
  tracking: string;
  lines: FormLine[];
};

export const originKind = (origin: string): 'location' | 'supplier' | '' => (origin.startsWith('loc:') ? 'location' : origin.startsWith('sup:') ? 'supplier' : '');
export const originId = (origin: string) => origin.slice(4);

// How many of an item the origin location holds right now
export function availableAt(items: Item[], locationId: string): Map<string, number> {
  const m = new Map<string, number>();
  for (const i of items) m.set(i.key, qtyAt(i, locationId));
  return m;
}

export function checkTransfer(f: TransferForm, avail: Map<string, number> | null, sendingNow: boolean): string {
  if (!f.origin) return 'Choose where the stock is coming from.';
  if (!f.destination_id) return 'Choose where the stock is going to.';
  if (originKind(f.origin) === 'location' && originId(f.origin) === f.destination_id) return 'The origin and destination must be different.';
  if (f.lines.length === 0) return 'Add at least one product.';
  if (f.lines.length > MAX_LINES) return `A transfer can have up to ${MAX_LINES} lines.`;
  for (const l of f.lines) {
    if (!/^\d{1,7}$/.test(l.quantity.trim()) || Number(l.quantity) < 1) return `Enter a quantity of 1 or more for ${l.name}.`;
    if (Number(l.quantity) > 1000000) return `The quantity for ${l.name} is too large.`;
    if (sendingNow && avail && originKind(f.origin) === 'location') {
      const have = avail.get(l.key) ?? 0;
      if (Number(l.quantity) > have) return `${l.name}: only ${have} in stock at the origin, but you are sending ${l.quantity}.`;
    }
  }
  if (f.expected_at && !/^\d{4}-\d{2}-\d{2}$/.test(f.expected_at)) return 'The estimated arrival date is not valid.';
  if (f.reference.length > 255) return 'The reference name can be up to 255 characters.';
  if (f.note.length > 5000) return 'The note can be up to 5000 characters.';
  if (f.carrier.length > 80) return 'The carrier name can be up to 80 characters.';
  if (f.tracking.length > 120) return 'The tracking number can be up to 120 characters.';
  if (f.tags.length > MAX_TAGS) return `Use up to ${MAX_TAGS} tags.`;
  if (f.tags.some((t) => t.length > TAG_LEN)) return `Each tag can be up to ${TAG_LEN} characters.`;
  return '';
}

// Lines that ask for more than the origin has. Used to warn while editing.
export function shortLines(f: Pick<TransferForm, 'origin' | 'lines'>, avail: Map<string, number> | null): { key: string; name: string; have: number; want: number }[] {
  if (!avail || originKind(f.origin) !== 'location') return [];
  const out: { key: string; name: string; have: number; want: number }[] = [];
  for (const l of f.lines) {
    const want = /^\d+$/.test(l.quantity) ? Number(l.quantity) : 0;
    const have = avail.get(l.key) ?? 0;
    if (want > have) out.push({ key: l.key, name: l.name, have, want });
  }
  return out;
}

/* ----------------------------- suggesting lines ----------------------------- */

// Items that are low or out at the destination while the origin has some. Quantity is what the
// destination needs, but never more than the origin holds.
export function restockSeeds(items: Item[], originLoc: string, destLoc: string): LineSeed[] {
  const seeds: LineSeed[] = [];
  for (const i of items) {
    if (!i.track || i.status === 'archived') continue;
    const dest = qtyAt(i, destLoc);
    const st = stateOf(i, dest);
    if (st !== 'low' && st !== 'out') continue;
    const have = qtyAt(i, originLoc);
    if (have <= 0) continue;
    seeds.push({ item: i, quantity: Math.min(suggestedReorder(i, dest), have), unitCost: null });
  }
  return seeds;
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

/* ----------------------------------- output ----------------------------------- */

const safeText = (v: string) => (/^[=+\-@\t\r]/.test(v) ? `'${v}` : v);

export function transferToCsv(t: Transfer, items: TransferItem[]): string {
  const head = ['Transfer', 'Origin', 'Destination', 'SKU', 'Item', 'Sent', 'Received', 'Rejected', 'Status'];
  const rows = items.map((i) => [`#${t.number}`, safeText(t.origin_name ?? ''), safeText(t.destination_name ?? ''), safeText(i.sku ?? ''), safeText(i.name), String(i.quantity), String(i.received), String(i.rejected), trStatusLabel[t.status]]);
  return toCsv([head, ...rows]);
}

export function listToCsv(list: Transfer[], units: Record<string, number>): string {
  const head = ['Transfer', 'Origin', 'Destination', 'Status', 'Units', 'Created', 'Shipped', 'Expected', 'Received', 'Reference', 'Carrier', 'Tracking', 'Tags'];
  const rows = list.map((t) => [`#${t.number}`, safeText(t.origin_name ?? ''), safeText(t.destination_name ?? ''), trStatusLabel[t.status], String(units[t.id] ?? 0), t.created_at.slice(0, 10), t.shipped_at?.slice(0, 10) ?? '', t.expected_at ?? '', t.received_at?.slice(0, 10) ?? '', safeText(t.reference ?? ''), safeText(t.carrier ?? ''), safeText(t.tracking ?? ''), safeText(t.tags.join('; '))]);
  return toCsv([head, ...rows]);
}

export function whatsappText(t: Transfer, items: TransferItem[], businessName: string): string {
  const lines = items.map((i) => `• ${i.quantity} x ${i.name}${i.sku ? ` (${i.sku})` : ''}`);
  const out = [`Transfer #${t.number} from ${businessName}`, `${t.origin_name ?? 'Origin'} → ${t.destination_name ?? 'Destination'}`, '', ...lines, '', `Total: ${items.reduce((s, i) => s + i.quantity, 0)} units`];
  if (t.carrier || t.tracking) out.push(`Carrier: ${[t.carrier, t.tracking].filter(Boolean).join(' · ')}`);
  if (t.expected_at) out.push(`Expected: ${t.expected_at}`);
  if (t.note?.trim()) out.push('', t.note.trim());
  return out.join('\n');
}

// A packing slip: the person loading the van ticks each line, the person receiving ticks them again.
export function printHtml(t: Transfer, items: TransferItem[], businessName: string): string {
  const e = escapeHtml;
  const rows = items.map((i) => `<tr><td class="c">☐</td><td>${e(i.name)}${i.sku ? `<br><small>${e(i.sku)}</small>` : ''}</td><td class="r">${i.quantity}</td><td class="c">☐</td></tr>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>Transfer #${t.number}</title>
<style>body{font-family:Arial,sans-serif;color:#111;margin:32px;font-size:14px}h1{font-size:22px;margin:0 0 4px}small{color:#555}table{width:100%;border-collapse:collapse;margin-top:16px}th,td{padding:8px;border-bottom:1px solid #ddd;text-align:left;vertical-align:top}th{background:#f5f5f5;font-size:12px;text-transform:uppercase}.r{text-align:right}.c{text-align:center;width:64px}.grid{display:flex;gap:40px;margin-top:16px}.grid div{flex:1}</style></head><body>
<h1>Transfer #${t.number}</h1><small>${e(businessName)}</small>
<div class="grid"><div><b>From</b><br>${e(t.origin_name ?? '')}</div><div><b>To</b><br>${e(t.destination_name ?? '')}</div>
<div><b>Reference</b><br>${e(t.reference ?? 'None')}<br><br><b>Carrier</b><br>${e([t.carrier, t.tracking].filter(Boolean).join(' · ') || 'None')}</div></div>
<table><thead><tr><th class="c">Packed</th><th>Item</th><th class="r">Qty</th><th class="c">Received</th></tr></thead><tbody>${rows}</tbody></table>
${t.note?.trim() ? `<p><b>Note</b><br>${e(t.note.trim()).replace(/\n/g, '<br>')}</p>` : ''}
<p style="margin-top:40px">Sent by: ________________ &nbsp;&nbsp;&nbsp; Received by: ________________</p>
</body></html>`;
}

export function transferError(msg: string): string {
  if (/does not exist|schema cache|Could not find the (function|table)/i.test(msg)) return 'Run transfers.sql in the Supabase SQL Editor first, then reload this page.';
  return msg;
}

export { itemLabel };
