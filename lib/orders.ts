// Pure logic for the Orders section: types, safe readers, money maths, filters, CSV, message texts.
// Nothing in here talks to the database.

export const naira = (n: number) => '₦' + Math.round(Number(n) || 0).toLocaleString('en-NG');

export type OrderStatus = 'new' | 'preparing' | 'delivered' | 'cancelled';
export type PayStatus = 'pending' | 'partial' | 'paid' | 'refunded' | 'voided';
export const STATUSES: OrderStatus[] = ['new', 'preparing', 'delivered', 'cancelled'];
export const PAY_STATUSES: PayStatus[] = ['pending', 'partial', 'paid', 'refunded'];
export const statusLabel: Record<OrderStatus, string> = { new: 'New', preparing: 'Preparing', delivered: 'Delivered', cancelled: 'Cancelled' };
export const payLabel: Record<PayStatus, string> = { pending: 'Payment pending', partial: 'Partly paid', paid: 'Paid', refunded: 'Refunded', voided: 'Voided' };
export const statusTone: Record<OrderStatus, string> = {
  new: 'bg-blue-100 text-blue-800',
  preparing: 'bg-amber-100 text-amber-800',
  delivered: 'bg-green-100 text-green-800',
  cancelled: 'bg-slate-200 text-slate-600',
};
export const payTone: Record<PayStatus, string> = {
  pending: 'bg-orange-100 text-orange-800',
  partial: 'bg-yellow-100 text-yellow-800',
  paid: 'bg-green-100 text-green-800',
  refunded: 'bg-slate-200 text-slate-600',
  voided: 'bg-slate-200 text-slate-600',
};

const s = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v));
const sn = (v: unknown): string | null => {
  const t = s(v).trim();
  return t ? t : null;
};
const n = (v: unknown, d = 0): number => {
  const x = Number(v);
  return Number.isFinite(x) ? x : d;
};
const b = (v: unknown): boolean => v === true || v === 'true';
const arr = (v: unknown): string[] => (Array.isArray(v) ? v.map((x) => s(x)).filter(Boolean) : []);

export type OrderItem = {
  id: string;
  name: string;
  price: number;
  quantity: number;
  product_id: string | null;
  variant_id: string | null;
  variant_title: string | null;
  sku: string | null;
  image_url: string | null;
  stock_deducted: number;
  is_custom: boolean;
};

export type Order = {
  id: string;
  order_number: number;
  customer_name: string;
  phone: string;
  email: string | null;
  company: string | null;
  address: string | null;
  address2: string | null;
  alt_phone: string | null;
  note: string | null;
  staff_note: string | null;
  payment_method: 'cod' | 'transfer';
  status: OrderStatus;
  payment_status: PayStatus;
  amount_paid: number;
  refunded_amount: number;
  total: number;
  delivery_method: 'shipping' | 'local' | 'pickup' | null;
  delivery_zone: string | null;
  delivery_fee: number;
  delivery_eta: string | null;
  courier: string | null;
  tracking_number: string | null;
  tax_amount: number;
  tax_included: boolean;
  tax_label: string | null;
  credit_used: number;
  tip: number;
  discount_code: string | null;
  discount_amount: number;
  request_type: 'cancel' | 'return' | null;
  request_note: string | null;
  request_fee: number;
  opt_email: boolean;
  opt_sms: boolean;
  opt_whatsapp: boolean;
  optin_confirmed: boolean;
  source: string;
  tags: string[];
  stock_committed: boolean;
  cancel_reason: string | null;
  archived: boolean;
  created_at: string;
  delivered_at: string | null;
  items: OrderItem[];
};

export function readItem(r: Record<string, unknown>): OrderItem {
  return {
    id: s(r.id),
    name: s(r.name),
    price: n(r.price),
    quantity: n(r.quantity, 1),
    product_id: sn(r.product_id),
    variant_id: sn(r.variant_id),
    variant_title: sn(r.variant_title),
    sku: sn(r.sku),
    image_url: sn(r.image_url),
    stock_deducted: n(r.stock_deducted),
    is_custom: b(r.is_custom),
  };
}

export function readOrder(r: Record<string, unknown>): Order {
  const st = s(r.status) as OrderStatus;
  const ps = s(r.payment_status) as PayStatus;
  const dm = s(r.delivery_method);
  const rt = s(r.request_type);
  const rawItems = Array.isArray(r.order_items) ? (r.order_items as Record<string, unknown>[]) : [];
  const total = n(r.total);
  // Shops that have not run orders.sql yet have no payment columns: treat delivered orders as paid.
  const hasPay = 'payment_status' in r;
  const pay: PayStatus = hasPay && PAY_STATUSES.concat(['voided']).includes(ps) ? ps : st === 'delivered' ? 'paid' : 'pending';
  return {
    id: s(r.id),
    order_number: n(r.order_number),
    customer_name: s(r.customer_name),
    phone: s(r.phone),
    email: sn(r.email),
    company: sn(r.company),
    address: sn(r.address),
    address2: sn(r.address2),
    alt_phone: sn(r.alt_phone),
    note: sn(r.note),
    staff_note: sn(r.staff_note),
    payment_method: s(r.payment_method) === 'cod' ? 'cod' : 'transfer',
    status: STATUSES.includes(st) ? st : 'new',
    payment_status: pay,
    amount_paid: hasPay ? n(r.amount_paid) : pay === 'paid' ? total : 0,
    refunded_amount: n(r.refunded_amount),
    total,
    delivery_method: dm === 'shipping' || dm === 'local' || dm === 'pickup' ? dm : null,
    delivery_zone: sn(r.delivery_zone),
    delivery_fee: n(r.delivery_fee),
    delivery_eta: sn(r.delivery_eta),
    courier: sn(r.courier),
    tracking_number: sn(r.tracking_number),
    tax_amount: n(r.tax_amount),
    tax_included: b(r.tax_included),
    tax_label: sn(r.tax_label),
    credit_used: n(r.credit_used),
    tip: n(r.tip),
    discount_code: sn(r.discount_code),
    discount_amount: n(r.discount_amount),
    request_type: rt === 'cancel' || rt === 'return' ? rt : null,
    request_note: sn(r.request_note),
    request_fee: n(r.request_fee),
    opt_email: b(r.opt_email),
    opt_sms: b(r.opt_sms),
    opt_whatsapp: b(r.opt_whatsapp),
    optin_confirmed: b(r.optin_confirmed),
    source: s(r.source) || 'online',
    tags: arr(r.tags),
    stock_committed: !!r.stock_committed_at,
    cancel_reason: sn(r.cancel_reason),
    archived: b(r.archived),
    created_at: s(r.created_at),
    delivered_at: sn(r.delivered_at),
    items: rawItems.map(readItem),
  };
}

export const sourceLabel = (src: string) =>
  ({ online: 'Online shop', manual: 'Created by you', draft: 'From a draft', whatsapp: 'WhatsApp' } as Record<string, string>)[src] ?? src;

export const balanceOf = (o: Pick<Order, 'total' | 'amount_paid' | 'refunded_amount' | 'status' | 'payment_status'>) =>
  o.status === 'cancelled' || o.payment_status === 'refunded' || o.payment_status === 'voided' ? 0 : Math.max(o.total - o.amount_paid, 0);

// ---------------------------------------------------------------- money (mirrors xenon_calc in orders.sql)
export type Line = { name: string; price: number; quantity: number };
export type Totals = { subtotal: number; discount: number; tax: number; total: number };

export function calcTotals(items: Line[], dtype: 'percent' | 'amount' | '', dvalue: number, ship: number, rate: number, included: boolean): Totals {
  let sub = 0;
  for (const it of items) sub += Math.round(Number(it.price) || 0) * (Number(it.quantity) || 0);
  let disc = 0;
  if (dtype === 'percent') disc = Math.round((sub * Math.min(Math.max(dvalue || 0, 0), 100)) / 100);
  else if (dtype === 'amount') disc = Math.min(Math.round(Math.max(dvalue || 0, 0)), sub);
  const taxable = sub - disc;
  let tax = 0;
  if (rate > 0) tax = included ? Math.round(taxable - taxable / (1 + rate / 100)) : Math.round((taxable * rate) / 100);
  const total = taxable + Math.max(Math.round(ship || 0), 0) + (included ? 0 : tax);
  return { subtotal: sub, discount: disc, tax, total };
}

// ---------------------------------------------------------------- filters, stats
export type OrderFilter = { q: string; status: 'all' | OrderStatus; pay: 'all' | PayStatus | 'unpaid'; source: string; tag: string; from: string; to: string; attention: boolean };
export const emptyFilter: OrderFilter = { q: '', status: 'all', pay: 'all', source: '', tag: '', from: '', to: '', attention: false };

export const hoursSince = (iso: string, now = Date.now()) => (now - new Date(iso).getTime()) / 36e5;

/** Orders that need you: new for more than a day, a customer request waiting, or delivered but not paid. */
export function needsAttention(o: Order, now = Date.now()): string | null {
  if (o.request_type) return o.request_type === 'cancel' ? 'Customer wants to cancel' : 'Customer wants to return';
  if (o.status === 'new' && hoursSince(o.created_at, now) >= 24) return 'Waiting for more than a day';
  if (o.status === 'delivered' && balanceOf(o) > 0) return 'Delivered but not fully paid';
  if (o.status === 'preparing' && hoursSince(o.created_at, now) >= 72) return 'Preparing for 3+ days';
  return null;
}

export function filterOrders(list: Order[], f: OrderFilter, now = Date.now()): Order[] {
  const q = f.q.trim().toLowerCase();
  const qd = q.replace(/\D/g, '');
  const from = f.from ? new Date(f.from + 'T00:00:00').getTime() : 0;
  const to = f.to ? new Date(f.to + 'T23:59:59').getTime() : Infinity;
  return list.filter((o) => {
    if (o.archived && f.status !== 'cancelled') return false;
    if (f.status !== 'all' && o.status !== f.status) return false;
    if (f.pay === 'unpaid') {
      if (balanceOf(o) <= 0) return false;
    } else if (f.pay !== 'all' && o.payment_status !== f.pay) return false;
    if (f.source && o.source !== f.source) return false;
    if (f.tag && !o.tags.includes(f.tag)) return false;
    const t = new Date(o.created_at).getTime();
    if (t < from || t > to) return false;
    if (f.attention && !needsAttention(o, now)) return false;
    if (q) {
      const hay = [String(o.order_number), o.customer_name, o.phone, o.email ?? '', o.company ?? '', o.tracking_number ?? '', ...o.tags, ...o.items.map((i) => i.name)].join(' ').toLowerCase();
      if (!hay.includes(q) && !(qd.length >= 4 && o.phone.replace(/\D/g, '').includes(qd))) return false;
    }
    return true;
  });
}

export function orderStats(list: Order[], now = Date.now()) {
  const live = list.filter((o) => o.status !== 'cancelled');
  const today = new Date(now).toDateString();
  const paid = live.reduce((a, o) => a + Math.max(o.amount_paid - o.refunded_amount, 0), 0);
  const owed = live.reduce((a, o) => a + balanceOf(o), 0);
  return {
    count: list.length,
    open: list.filter((o) => o.status === 'new' || o.status === 'preparing').length,
    today: list.filter((o) => new Date(o.created_at).toDateString() === today).length,
    revenue: paid,
    owed,
    average: live.length ? Math.round(live.reduce((a, o) => a + o.total, 0) / live.length) : 0,
    attention: list.filter((o) => needsAttention(o, now)).length,
  };
}

export function allTags(list: { tags: string[] }[]): string[] {
  const m = new Set<string>();
  for (const o of list) for (const t of o.tags) m.add(t);
  return [...m].sort((a, c) => a.localeCompare(c));
}

export function parseTags(text: string, have: string[] = []): string[] {
  const out = [...have];
  for (const raw of text.split(/[,\n]/)) {
    const t = raw.trim().slice(0, 40);
    if (t && !out.some((x) => x.toLowerCase() === t.toLowerCase()) && out.length < 20) out.push(t);
  }
  return out;
}

// ---------------------------------------------------------------- customers (built from past orders)
export type Customer = { key: string; name: string; phone: string; email: string; company: string; address: string; address2: string; orders: number; spent: number; last: string };

export const phoneKey = (p: string) => p.replace(/\D/g, '').slice(-10);

export function customersFrom(list: Order[]): Customer[] {
  const m = new Map<string, Customer>();
  for (const o of list) {
    const key = phoneKey(o.phone) || (o.email ?? '').toLowerCase() || o.customer_name.toLowerCase();
    if (!key) continue;
    const c = m.get(key);
    if (!c) {
      m.set(key, { key, name: o.customer_name, phone: o.phone, email: o.email ?? '', company: o.company ?? '', address: o.address ?? '', address2: o.address2 ?? '', orders: 1, spent: o.status === 'cancelled' ? 0 : o.total, last: o.created_at });
    } else {
      c.orders += 1;
      if (o.status !== 'cancelled') c.spent += o.total;
      if (o.created_at > c.last) {
        c.last = o.created_at;
        c.name = o.customer_name || c.name;
        c.phone = o.phone || c.phone;
        c.email = o.email ?? c.email;
        c.address = o.address ?? c.address;
        c.address2 = o.address2 ?? c.address2;
        c.company = o.company ?? c.company;
      }
    }
  }
  return [...m.values()].sort((a, c) => (a.last < c.last ? 1 : -1));
}

export function searchCustomers(list: Customer[], q: string, max = 6): Customer[] {
  const t = q.trim().toLowerCase();
  if (!t) return list.slice(0, max);
  const d = t.replace(/\D/g, '');
  return list
    .filter((c) => c.name.toLowerCase().includes(t) || (c.email && c.email.toLowerCase().includes(t)) || (d.length >= 3 && c.phone.replace(/\D/g, '').includes(d)))
    .slice(0, max);
}

// ---------------------------------------------------------------- contact / messages
export function waNumber(phone: string): string {
  let d = phone.replace(/\D/g, '');
  if (d.startsWith('0')) d = '234' + d.slice(1);
  return d;
}
export const waLink = (phone: string, text: string) => `https://wa.me/${waNumber(phone)}?text=${encodeURIComponent(text)}`;
export const mailLink = (email: string, subject: string, body: string) => `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

export function fillTemplate(t: string, v: Record<string, string>): string {
  return t.replace(/\{(\w+)\}/g, (m, k: string) => (k in v ? v[k] : m));
}

export const itemsText = (items: { name: string; quantity: number; variant_title?: string | null }[]) =>
  items.map((i) => `• ${i.quantity} × ${i.name}${i.variant_title ? ` (${i.variant_title})` : ''}`).join('\n');

export function statusMessage(o: Order, store: string): string {
  const hi = `Hi ${o.customer_name.split(' ')[0] || 'there'}, `;
  const no = `order #${o.order_number}`;
  if (o.status === 'preparing') return `${hi}we are now preparing your ${no} at ${store}. We will tell you when it is on its way.`;
  if (o.status === 'delivered') return `${hi}your ${no} from ${store} has been delivered. Thank you for shopping with us!`;
  if (o.status === 'cancelled') return `${hi}your ${no} at ${store} has been cancelled.${o.cancel_reason ? ' Reason: ' + o.cancel_reason + '.' : ''} Please reply if you have any question.`;
  return `${hi}we received your ${no} at ${store} (${naira(o.total)}). We will confirm it shortly.`;
}

export function paymentReminder(o: Order, store: string, bank: { bank_name: string; account_number: string; account_name: string }): string {
  const owed = balanceOf(o);
  let t = `Hi ${o.customer_name.split(' ')[0] || 'there'}, a friendly reminder about ${`order #${o.order_number}`} at ${store}. ${naira(owed)} is still unpaid.`;
  if (bank.account_number) t += `\n\nPay to: ${bank.bank_name} ${bank.account_number} (${bank.account_name}).`;
  return t + '\n\nPlease reply once you have paid. Thank you!';
}

export function trackingMessage(o: Order, store: string): string {
  return `Hi ${o.customer_name.split(' ')[0] || 'there'}, your order #${o.order_number} from ${store} is on its way${o.courier ? ' with ' + o.courier : ''}${o.tracking_number ? '. Tracking: ' + o.tracking_number : ''}.`;
}

export function invoiceText(store: string, num: number, total: number, link: string): string {
  return `Hello, here is your invoice #${num} from ${store} for ${naira(total)}.\n\nView it and pay here: ${link}`;
}

// ---------------------------------------------------------------- CSV and print
const guard = (v: string) => (/^[=+\-@\t\r]/.test(v) ? "'" + v : v);
const cell = (v: unknown) => {
  const t = guard(String(v ?? ''));
  return /[",\n\r]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t;
};

export function ordersToCsv(list: Order[]): string {
  const head = ['Order', 'Date', 'Customer', 'Phone', 'Email', 'Address', 'Status', 'Payment status', 'Payment method', 'Items', 'Subtotal', 'Discount', 'Delivery', 'Tax', 'Total', 'Paid', 'Refunded', 'Source', 'Tags', 'Tracking'];
  const rows = list.map((o) => {
    const sub = o.items.reduce((a, i) => a + i.price * i.quantity, 0);
    return [
      o.order_number, o.created_at.slice(0, 10), o.customer_name, o.phone, o.email ?? '', [o.address, o.address2].filter(Boolean).join(', '), o.status, o.payment_status,
      o.payment_method === 'cod' ? 'Pay on delivery' : 'Bank transfer', o.items.map((i) => `${i.quantity}x ${i.name}${i.variant_title ? ' (' + i.variant_title + ')' : ''}`).join('; '),
      sub, o.discount_amount, o.delivery_fee, o.tax_amount, o.total, o.amount_paid, o.refunded_amount, sourceLabel(o.source), o.tags.join('; '), o.tracking_number ?? '',
    ].map(cell).join(',');
  });
  return [head.join(','), ...rows].join('\r\n');
}

const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

export function printOrdersHtml(list: Order[], store: string, kind: 'invoice' | 'packing'): string {
  const pages = list
    .map((o) => {
      const rows = o.items
        .map((i) => `<tr><td>${esc(i.name)}${i.variant_title ? `<br><small>${esc(i.variant_title)}</small>` : ''}${i.sku ? `<br><small>SKU ${esc(i.sku)}</small>` : ''}</td><td class="r">${i.quantity}</td>${kind === 'invoice' ? `<td class="r">${esc(naira(i.price))}</td><td class="r">${esc(naira(i.price * i.quantity))}</td>` : '<td class="r">☐</td>'}</tr>`)
        .join('');
      const money =
        kind === 'invoice'
          ? `<table class="t"><tr><td>Subtotal</td><td class="r">${esc(naira(o.items.reduce((a, i) => a + i.price * i.quantity, 0)))}</td></tr>${o.discount_amount ? `<tr><td>Discount</td><td class="r">-${esc(naira(o.discount_amount))}</td></tr>` : ''}${o.delivery_fee ? `<tr><td>Delivery</td><td class="r">${esc(naira(o.delivery_fee))}</td></tr>` : ''}${o.tax_amount ? `<tr><td>${esc(o.tax_label || 'VAT')}${o.tax_included ? ' (included)' : ''}</td><td class="r">${esc(naira(o.tax_amount))}</td></tr>` : ''}<tr><th>Total</th><th class="r">${esc(naira(o.total))}</th></tr><tr><td>Paid</td><td class="r">${esc(naira(o.amount_paid))}</td></tr></table>`
          : '';
      return `<section><h1>${kind === 'invoice' ? 'Invoice' : 'Packing slip'} #${o.order_number}</h1><p class="m">${esc(store)} · ${esc(new Date(o.created_at).toLocaleDateString('en-NG', { dateStyle: 'medium' }))}</p>
<p><b>${esc(o.customer_name)}</b><br>${esc(o.phone)}${o.email ? '<br>' + esc(o.email) : ''}${o.address ? '<br>' + esc([o.address, o.address2].filter(Boolean).join(', ')) : ''}</p>
${o.delivery_method ? `<p class="m">${o.delivery_method === 'pickup' ? 'Pickup in store' : 'Delivery'}${o.delivery_zone ? ' · ' + esc(o.delivery_zone) : ''}</p>` : ''}
<table class="i"><thead><tr><th>Item</th><th class="r">Qty</th>${kind === 'invoice' ? '<th class="r">Price</th><th class="r">Amount</th>' : '<th class="r">Packed</th>'}</tr></thead><tbody>${rows}</tbody></table>${money}
${o.note ? `<p class="m">Customer note: ${esc(o.note)}</p>` : ''}</section>`;
    })
    .join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>${kind === 'invoice' ? 'Invoices' : 'Packing slips'}</title><style>
body{font:14px system-ui,Arial,sans-serif;color:#111;margin:0}section{padding:32px;page-break-after:always;max-width:720px;margin:auto}h1{font-size:22px;margin:0 0 4px}.m{color:#666;margin:2px 0 12px}
table{border-collapse:collapse;width:100%}.i th,.i td{border-bottom:1px solid #ddd;padding:8px 6px;text-align:left}.r{text-align:right!important}.t{width:260px;margin:14px 0 0 auto}.t td,.t th{padding:4px 6px}small{color:#666}
</style></head><body>${pages}<script>window.onload=function(){window.print()}</script></body></html>`;
}

// ---------------------------------------------------------------- errors
export const SQL_HINT = 'Run orders.sql in the Supabase SQL Editor first (Orders needs it), then refresh this page.';
export const needsSql = (msg: string) =>
  /does not exist|schema cache|could not find|relation .* does not exist|function .* does not exist|column .* does not exist/i.test(msg);
export const orderError = (msg: string) => (needsSql(msg) ? SQL_HINT : msg);
