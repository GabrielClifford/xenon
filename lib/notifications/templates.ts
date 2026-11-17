// Shared by the dashboard (live preview) and the server (sending).
// Keep this file free of server-only imports.

export type CustomerKey = 'order_confirmation' | 'order_fulfilled' | 'order_cancelled';
export type OrderEvent = 'order_placed' | 'order_fulfilled' | 'order_cancelled';

export type NItem = { name: string; qty: number; price: number };

export type NOrder = {
  id: string;
  number: string;
  status: string;
  createdAt: string;
  name: string;
  email: string;
  phone: string;
  items: NItem[];
  subtotal: number;
  discount: number;
  shipping: number;
  tax: number;
  total: number;
  address: string;
  method: string;
  note: string;
};

export type Tpl = { enabled: boolean; subject: string; body: string };

export type Fulfil = { enabled?: boolean; email?: string; trigger_status?: string };

export type Settings = {
  sender_name: string;
  sender_local: string;
  reply_to: string;
  customer: Record<string, Partial<Tpl>>;
  staff: Record<string, boolean>;
  fulfillment: Fulfil;
};

export const blankSettings: Settings = {
  sender_name: '',
  sender_local: 'orders',
  reply_to: '',
  customer: {},
  staff: {},
  fulfillment: {},
};

export const staffDefaults = { new_order: true, order_cancelled: true, weekly_summary: false };
export type StaffKey = keyof typeof staffDefaults;
export const staffOn = (s: Record<string, boolean>, k: StaffKey) => s[k] ?? staffDefaults[k];

export const customerEvents: { key: CustomerKey; event: OrderEvent; title: string; hint: string }[] = [
  { key: 'order_confirmation', event: 'order_placed', title: 'Order confirmation', hint: 'Sent when a customer places an order' },
  { key: 'order_fulfilled', event: 'order_fulfilled', title: 'Order fulfilled', hint: 'Sent when you mark an order as fulfilled' },
  { key: 'order_cancelled', event: 'order_cancelled', title: 'Order cancelled', hint: 'Sent when an order is cancelled' },
];

export const defaultTemplates: Record<CustomerKey, Tpl> = {
  order_confirmation: {
    enabled: true,
    subject: 'Order {{order_number}} confirmed',
    body: "Hi {{customer_name}},\n\nThank you for your order! We've received it and will be in touch about payment and delivery.\n\nIf you have any questions, just reply to this email.",
  },
  order_fulfilled: {
    enabled: true,
    subject: 'Your order {{order_number}} is ready',
    body: 'Hi {{customer_name}},\n\nGood news! Your order {{order_number}} has been fulfilled. If you ordered for delivery it is on its way, and for pickup you can collect it now.',
  },
  order_cancelled: {
    enabled: true,
    subject: 'Order {{order_number}} was cancelled',
    body: "Hi {{customer_name}},\n\nYour order {{order_number}} has been cancelled. If you did not expect this, reply to this email and we'll help.",
  },
};

export const variableList = ['store_name', 'customer_name', 'order_number', 'order_total', 'store_url', 'contact_email'];

export function mergeTpl(stored: Record<string, Partial<Tpl>> | undefined, key: CustomerKey): Tpl {
  const d = defaultTemplates[key];
  const s = stored?.[key] ?? {};
  return {
    enabled: s.enabled ?? d.enabled,
    subject: s.subject && s.subject.trim() ? s.subject : d.subject,
    body: s.body && s.body.trim() ? s.body : d.body,
  };
}

export const naira = (n: number) => `₦${Math.round(n).toLocaleString('en-NG')}`;

export const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function fill(t: string, v: Record<string, string>) {
  return t.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (_, k: string) => v[k] ?? '');
}

const paragraphs = (text: string) =>
  text
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#0f172a">${esc(p.trim()).replace(/\n/g, '<br>')}</p>`)
    .join('');

const button = (href: string, text: string) =>
  `<p style="margin:18px 0"><a href="${esc(href)}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:bold;font-size:14px;padding:12px 22px;border-radius:10px">${esc(text)}</a></p>`;

function layout(o: { store: string; title: string; body: string }) {
  return `<!doctype html><html><body style="margin:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px">
<tr><td style="padding:28px">
<p style="margin:0 0 6px;font-size:13px;font-weight:bold;color:#2563eb">${esc(o.store)}</p>
<h1 style="margin:0 0 18px;font-size:22px;line-height:1.3">${esc(o.title)}</h1>
${o.body}
</td></tr></table>
<p style="max-width:560px;margin:14px 0 0;font-size:12px;color:#64748b;text-align:center">Sent by ${esc(o.store)}</p>
</td></tr></table></body></html>`;
}

function summaryHtml(o: NOrder) {
  const line = (a: string, b: string, bold = false) =>
    `<tr><td style="padding:6px 0;font-size:14px;${bold ? 'font-weight:bold;' : 'color:#475569;'}">${a}</td><td align="right" style="padding:6px 0;font-size:14px;${bold ? 'font-weight:bold;' : 'color:#475569;'}">${b}</td></tr>`;
  const items = o.items
    .map(
      (i) =>
        `<tr><td style="padding:9px 0;border-bottom:1px solid #e2e8f0;font-size:14px">${esc(i.name)} × ${i.qty}</td><td align="right" style="padding:9px 0;border-bottom:1px solid #e2e8f0;font-size:14px">${naira(i.price * i.qty)}</td></tr>`
    )
    .join('');
  const details = [
    o.method ? `<p style="margin:14px 0 0;font-size:13px;color:#475569"><b>Delivery:</b> ${esc(o.method)}</p>` : '',
    o.address ? `<p style="margin:6px 0 0;font-size:13px;color:#475569"><b>Address:</b> ${esc(o.address)}</p>` : '',
    o.note ? `<p style="margin:6px 0 0;font-size:13px;color:#475569"><b>Note:</b> ${esc(o.note)}</p>` : '',
  ].join('');
  return `<h2 style="margin:22px 0 6px;font-size:16px">Order ${esc(o.number)}</h2>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${items}
${line('Subtotal', naira(o.subtotal))}
${o.discount > 0 ? line('Discount', '-' + naira(o.discount)) : ''}
${o.shipping > 0 ? line('Shipping', naira(o.shipping)) : ''}
${o.tax > 0 ? line('Tax', naira(o.tax)) : ''}
${line('Total', naira(o.total), true)}
</table>${details}`;
}

function summaryText(o: NOrder) {
  const lines = o.items.map((i) => `- ${i.name} x ${i.qty}  ${naira(i.price * i.qty)}`);
  lines.push(`Subtotal: ${naira(o.subtotal)}`);
  if (o.discount > 0) lines.push(`Discount: -${naira(o.discount)}`);
  if (o.shipping > 0) lines.push(`Shipping: ${naira(o.shipping)}`);
  if (o.tax > 0) lines.push(`Tax: ${naira(o.tax)}`);
  lines.push(`Total: ${naira(o.total)}`);
  if (o.method) lines.push(`Delivery: ${o.method}`);
  if (o.address) lines.push(`Address: ${o.address}`);
  if (o.note) lines.push(`Note: ${o.note}`);
  return `Order ${o.number}\n` + lines.join('\n');
}

export type Rendered = { subject: string; html: string; text: string };

export function renderCustomer(
  tpl: Tpl,
  c: { store: string; storeUrl: string; contact: string; order: NOrder }
): Rendered {
  const vars = {
    store_name: c.store,
    customer_name: c.order.name || 'there',
    order_number: c.order.number,
    order_total: naira(c.order.total),
    store_url: c.storeUrl,
    contact_email: c.contact,
  };
  const subject = fill(tpl.subject, vars).replace(/[\r\n]+/g, ' ').trim();
  const intro = fill(tpl.body, vars);
  const html = layout({
    store: c.store,
    title: subject,
    body: paragraphs(intro) + button(c.storeUrl, 'Visit our store') + summaryHtml(c.order),
  });
  const text = `${intro}\n\n${summaryText(c.order)}\n\nVisit our store: ${c.storeUrl}`;
  return { subject, html, text };
}

export function renderStaffOrder(
  kind: 'new' | 'cancelled',
  c: { store: string; dashboardUrl: string; order: NOrder }
): Rendered {
  const o = c.order;
  const title = kind === 'new' ? `New order ${o.number}` : `Order ${o.number} was cancelled`;
  const subject = `${title} (${naira(o.total)})`;
  const who = [o.name, o.phone, o.email].filter(Boolean);
  const html = layout({
    store: c.store,
    title,
    body:
      `<p style="margin:0 0 6px;font-size:14px"><b>Customer:</b> ${esc(who.join(' · ') || 'Not given')}</p>` +
      summaryHtml(o) +
      button(c.dashboardUrl, 'Open dashboard'),
  });
  const text = `${title}\nCustomer: ${who.join(' | ') || 'Not given'}\n\n${summaryText(o)}\n\nDashboard: ${c.dashboardUrl}`;
  return { subject, html, text };
}

export function renderFulfillment(c: { store: string; order: NOrder }): Rendered {
  const o = c.order;
  const count = o.items.reduce((n, i) => n + i.qty, 0);
  const subject = `Order fulfillment request for ${c.store}`;
  const items = o.items.map((i) => `<li style="margin:4px 0;font-size:14px">${esc(i.name)} × ${i.qty}</li>`).join('');
  const html = layout({
    store: c.store,
    title: `Please fulfill order ${o.number}`,
    body:
      `<p style="margin:0 0 6px;font-size:14px"><b>Total number of items:</b> ${count}</p>` +
      `<p style="margin:0 0 6px;font-size:14px"><b>Unique items:</b> ${o.items.length}</p>` +
      `<p style="margin:14px 0 4px;font-size:14px"><b>Items to fulfill:</b></p><ul style="margin:0;padding-left:20px">${items}</ul>` +
      `<p style="margin:14px 0 4px;font-size:14px"><b>Shipping address:</b></p><p style="margin:0;font-size:14px">${esc(o.name)}<br>${esc(o.address || 'No address given')}<br>${esc(o.phone)}</p>` +
      `<p style="margin:14px 0 4px;font-size:14px"><b>Shipping method:</b> ${esc(o.method || 'Not given')}</p>` +
      `<p style="margin:0;font-size:14px"><b>Customer email:</b> ${esc(o.email || 'Not given')}</p>`,
  });
  const text =
    `Please fulfill order ${o.number}.\nTotal number of items: ${count}\nUnique items: ${o.items.length}\n\nItems to fulfill:\n` +
    o.items.map((i) => `- ${i.name} x ${i.qty}`).join('\n') +
    `\n\nShipping address:\n${o.name}\n${o.address || 'No address given'}\n${o.phone}\n\nShipping method: ${o.method || 'Not given'}\nCustomer email: ${o.email || 'Not given'}`;
  return { subject, html, text };
}

export function renderWeekly(c: {
  store: string;
  from: string;
  to: string;
  count: number;
  revenue: number;
  top: { name: string; qty: number }[];
  dashboardUrl: string;
}): Rendered {
  const subject = `${c.store}: your weekly order summary`;
  const top = c.top.map((t) => `<li style="margin:4px 0;font-size:14px">${esc(t.name)} × ${t.qty}</li>`).join('');
  const html = layout({
    store: c.store,
    title: 'Your weekly order summary',
    body:
      `<p style="margin:0 0 14px;font-size:14px;color:#475569">${esc(c.from)} to ${esc(c.to)}</p>` +
      `<p style="margin:0 0 6px;font-size:15px"><b>Orders:</b> ${c.count}</p>` +
      `<p style="margin:0 0 14px;font-size:15px"><b>Sales:</b> ${naira(c.revenue)}</p>` +
      (c.top.length ? `<p style="margin:0 0 4px;font-size:14px"><b>Top items</b></p><ul style="margin:0;padding-left:20px">${top}</ul>` : '<p style="font-size:14px;color:#475569">No orders this week.</p>') +
      button(c.dashboardUrl, 'Open dashboard'),
  });
  const text =
    `Your weekly order summary (${c.from} to ${c.to})\nOrders: ${c.count}\nSales: ${naira(c.revenue)}\n` +
    c.top.map((t) => `- ${t.name} x ${t.qty}`).join('\n');
  return { subject, html, text };
}

export const sampleOrder: NOrder = {
  id: '00000000-0000-0000-0000-000000000000',
  number: '#1001',
  status: 'pending',
  createdAt: new Date().toISOString(),
  name: 'Ada Okafor',
  email: 'ada@example.com',
  phone: '0803 123 4567',
  items: [
    { name: 'Jollof rice pack', qty: 2, price: 3500 },
    { name: 'Chapman', qty: 1, price: 1500 },
  ],
  subtotal: 8500,
  discount: 500,
  shipping: 1000,
  tax: 0,
  total: 9000,
  address: '12 Allen Avenue, Ikeja, Lagos',
  method: 'Home delivery',
  note: 'Please call when you arrive.',
};

export function orderPayload(o: NOrder) {
  return {
    id: o.id,
    number: o.number,
    status: o.status,
    created_at: o.createdAt,
    customer: { name: o.name, email: o.email, phone: o.phone },
    items: o.items,
    subtotal: o.subtotal,
    discount: o.discount,
    shipping: o.shipping,
    tax: o.tax,
    total: o.total,
    shipping_address: o.address,
    delivery_method: o.method,
    note: o.note,
  };
}

const tagName = (s: string) => s.replace(/[^a-zA-Z0-9_]/g, '_');

export function toXml(v: unknown, tag = 'webhook', root = true): string {
  const t = tagName(tag);
  let inner: string;
  if (v === null || v === undefined) inner = '';
  else if (Array.isArray(v)) inner = v.map((x) => toXml(x, 'item', false)).join('');
  else if (typeof v === 'object') {
    inner = Object.entries(v as Record<string, unknown>)
      .map(([k, x]) => toXml(x, k, false))
      .join('');
  } else inner = esc(String(v));
  const out = `<${t}>${inner}</${t}>`;
  return root ? `<?xml version="1.0" encoding="UTF-8"?>${out}` : out;
}

export const webhookEvents: { v: OrderEvent; t: string }[] = [
  { v: 'order_placed', t: 'Order placed' },
  { v: 'order_fulfilled', t: 'Order fulfilled' },
  { v: 'order_cancelled', t: 'Order cancelled' },
];
