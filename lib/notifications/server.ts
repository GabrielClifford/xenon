// Server only. Never import this from a 'use client' file.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createHmac, timingSafeEqual } from 'crypto';
import {
  blankSettings,
  mergeTpl,
  orderPayload,
  renderCustomer,
  renderFulfillment,
  renderStaffOrder,
  staffOn,
  toXml,
  type CustomerKey,
  type NItem,
  type NOrder,
  type OrderEvent,
  type Settings,
} from './templates';

export type Biz = { id: string; name: string; slug: string; phone: string | null; owner_id: string };

export const BIZ_COLUMNS = 'id,name,slug,phone,owner_id';

export function admin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set in Vercel.');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL || 'https://xenon-neon.vercel.app').replace(/\/+$/, '');

export function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/* ------------------------------------------------------------------ */
/* Orders. If your orders table uses other column names, edit ONLY     */
/* the lists of names in readOrder below.                              */
/* ------------------------------------------------------------------ */

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const str = (v: unknown) => (typeof v === 'string' ? v.trim() : v == null ? '' : String(v));

function first(r: Record<string, unknown>, keys: string[]): unknown {
  for (const k of keys) if (r[k] !== undefined && r[k] !== null && r[k] !== '') return r[k];
  return undefined;
}

function readItems(raw: unknown): NItem[] {
  let v = raw;
  if (typeof v === 'string') {
    try {
      v = JSON.parse(v);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(v)) return [];
  return v
    .filter((x) => x && typeof x === 'object')
    .map((x) => {
      const r = x as Record<string, unknown>;
      return {
        name: str(first(r, ['name', 'title', 'product_name', 'product'])) || 'Item',
        qty: Math.max(1, num(first(r, ['qty', 'quantity', 'count'])) || 1),
        price: num(first(r, ['price', 'unit_price', 'amount'])),
      };
    });
}

function readAddress(v: unknown): string {
  if (typeof v === 'string') return v.trim();
  if (v && typeof v === 'object') {
    return Object.values(v as Record<string, unknown>)
      .map(str)
      .filter(Boolean)
      .join(', ');
  }
  return '';
}

export function readOrder(r: Record<string, unknown>): NOrder {
  const id = str(r.id);
  const items = readItems(first(r, ['items', 'line_items', 'cart', 'products']));
  const itemsSum = items.reduce((n, i) => n + i.price * i.qty, 0);
  const subtotal = num(first(r, ['subtotal', 'sub_total'])) || itemsSum;
  const discount = num(first(r, ['discount', 'discount_amount']));
  const shipping = num(first(r, ['shipping', 'shipping_fee', 'delivery_fee', 'shipping_cost']));
  const tax = num(first(r, ['tax', 'tax_amount', 'vat']));
  const total = num(first(r, ['total', 'total_amount', 'grand_total'])) || subtotal - discount + shipping + tax;
  const raw = str(first(r, ['order_number', 'number', 'reference', 'ref', 'code'])) || id.slice(0, 8).toUpperCase();
  return {
    id,
    number: raw.startsWith('#') ? raw : `#${raw}`,
    status: str(r.status).toLowerCase(),
    createdAt: str(r.created_at) || new Date().toISOString(),
    name: str(first(r, ['customer_name', 'name', 'full_name'])),
    email: str(first(r, ['customer_email', 'email'])),
    phone: str(first(r, ['customer_phone', 'phone', 'whatsapp'])),
    items,
    subtotal,
    discount,
    shipping,
    tax,
    total,
    address: readAddress(first(r, ['address', 'delivery_address', 'shipping_address'])),
    method: str(first(r, ['shipping_method', 'delivery_method', 'fulfillment', 'delivery'])),
    note: str(first(r, ['note', 'notes', 'customer_note'])),
  };
}

const FULFILLED = ['fulfilled', 'completed', 'complete', 'delivered', 'shipped', 'dispatched', 'ready', 'ready_for_pickup', 'out_for_delivery'];
const CANCELLED = ['cancelled', 'canceled', 'void'];

export function eventFromStatus(status: string): OrderEvent | null {
  const s = status.toLowerCase().replace(/[\s-]+/g, '_');
  if (FULFILLED.includes(s)) return 'order_fulfilled';
  if (CANCELLED.includes(s)) return 'order_cancelled';
  return null;
}

/* ------------------------------------------------------------------ */
/* Settings, sender, email                                             */
/* ------------------------------------------------------------------ */

export async function loadSettings(db: SupabaseClient, businessId: string): Promise<Settings> {
  const { data } = await db.from('notification_settings').select('*').eq('business_id', businessId).maybeSingle();
  const r = (data ?? {}) as Partial<Settings>;
  return {
    sender_name: r.sender_name ?? blankSettings.sender_name,
    sender_local: r.sender_local || blankSettings.sender_local,
    reply_to: r.reply_to ?? '',
    customer: r.customer ?? {},
    staff: r.staff ?? {},
    fulfillment: r.fulfillment ?? {},
  };
}

const cleanName = (s: string) => s.replace(/[\r\n"<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
const cleanLocal = (s: string) => s.toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 40) || 'orders';

export async function senderFor(
  db: SupabaseClient,
  biz: Biz,
  settings: Settings
): Promise<{ from: string; replyTo?: string } | null> {
  const name = cleanName(settings.sender_name || biz.name) || 'Store';
  const { data: d } = await db.from('notification_domains').select('domain,status').eq('business_id', biz.id).maybeSingle();
  const replyTo = settings.reply_to || undefined;
  if (d && d.status === 'verified') {
    return { from: `${name} <${cleanLocal(settings.sender_local)}@${d.domain}>`, replyTo };
  }
  const fallback = process.env.NOTIFY_FROM_EMAIL;
  if (!fallback) return null;
  return { from: `${name} <${fallback}>`, replyTo };
}

export async function sendEmail(o: {
  from: string;
  to: string[];
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, error: 'RESEND_API_KEY is not set in Vercel.' };
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: o.from,
        to: o.to,
        subject: o.subject,
        html: o.html,
        text: o.text,
        reply_to: o.replyTo,
      }),
    });
    if (!res.ok) return { ok: false, error: `Email provider said ${res.status}: ${(await res.text()).slice(0, 300)}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Could not reach the email provider.' };
  }
}

type Result = { ok: boolean; error?: string; skipped?: boolean };

// Records every send in notification_log. The dedupe key stops the same
// notification going out twice for one order, even if the trigger fires twice.
export async function logged(
  db: SupabaseClient,
  rec: { business_id: string; event: string; channel: 'email' | 'webhook'; target: string; order_id?: string; dedupe?: string },
  run: () => Promise<Result>
): Promise<Result> {
  const ins = await db
    .from('notification_log')
    .insert({
      business_id: rec.business_id,
      event: rec.event,
      channel: rec.channel,
      target: rec.target.slice(0, 300),
      order_id: rec.order_id ?? null,
      dedupe_key: rec.dedupe ?? null,
      status: 'pending',
    })
    .select('id')
    .single();
  if (ins.error) {
    if (ins.error.code === '23505') return { ok: true, skipped: true };
    return { ok: false, error: ins.error.message };
  }
  let r: Result;
  try {
    r = await run();
  } catch (e) {
    r = { ok: false, error: e instanceof Error ? e.message : 'Unexpected error' };
  }
  await db
    .from('notification_log')
    .update({ status: r.ok ? 'sent' : 'failed', error: r.ok ? null : (r.error ?? '').slice(0, 500), ...(r.ok ? {} : { dedupe_key: null }) })
    .eq('id', ins.data.id);
  return r;
}

export async function staffRecipients(db: SupabaseClient, biz: Biz): Promise<string[]> {
  const { data } = await db.from('notification_recipients').select('email').eq('business_id', biz.id);
  const list = (data ?? []).map((r: { email: string }) => r.email);
  if (list.length) return list;
  const u = await db.auth.admin.getUserById(biz.owner_id);
  return u.data.user?.email ? [u.data.user.email] : [];
}

/* ------------------------------------------------------------------ */
/* Webhooks                                                            */
/* ------------------------------------------------------------------ */

export type Hook = {
  id: string;
  business_id: string;
  url: string;
  format: 'json' | 'xml';
  events: string[];
  secret: string;
  active: boolean;
};

export function isSafeUrl(u: string): boolean {
  try {
    const x = new URL(u);
    if (x.protocol !== 'https:') return false;
    const h = x.hostname.toLowerCase();
    if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.internal') || h.endsWith('.local')) return false;
    if (h.startsWith('[')) return false;
    if (/^\d+\.\d+\.\d+\.\d+$/.test(h)) {
      const [a, b] = h.split('.').map(Number);
      if (a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)) return false;
    }
    return true;
  } catch {
    return false;
  }
}

export async function postWebhook(db: SupabaseClient, h: Hook, event: string, payload: object): Promise<Result> {
  if (!isSafeUrl(h.url)) return { ok: false, error: 'The webhook URL must be a public https address.' };
  const body = h.format === 'xml' ? toXml(payload) : JSON.stringify(payload);
  const sig = createHmac('sha256', h.secret).update(body).digest('hex');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  let status = 0;
  let error: string | undefined;
  try {
    const res = await fetch(h.url, {
      method: 'POST',
      redirect: 'manual',
      signal: ctrl.signal,
      headers: {
        'Content-Type': h.format === 'xml' ? 'application/xml' : 'application/json',
        'X-Xenon-Event': event,
        'X-Xenon-Signature': `sha256=${sig}`,
        'User-Agent': 'Xenon-Webhooks/1.0',
      },
      body,
    });
    status = res.status;
    if (!res.ok) error = `Your server answered HTTP ${res.status}`;
  } catch (e) {
    error = e instanceof Error && e.name === 'AbortError' ? 'Your server took too long to answer.' : 'Could not reach your server.';
  } finally {
    clearTimeout(timer);
  }
  await db.from('notification_webhooks').update({ last_status: status, last_at: new Date().toISOString() }).eq('id', h.id);
  return error ? { ok: false, error } : { ok: true };
}

/* ------------------------------------------------------------------ */
/* Order events                                                        */
/* ------------------------------------------------------------------ */

const KEY_FOR: Record<OrderEvent, CustomerKey> = {
  order_placed: 'order_confirmation',
  order_fulfilled: 'order_fulfilled',
  order_cancelled: 'order_cancelled',
};

export async function dispatchOrder(
  db: SupabaseClient,
  biz: Biz,
  order: NOrder,
  event: OrderEvent | null,
  statusChanged: boolean
) {
  const settings = await loadSettings(db, biz.id);
  const sender = await senderFor(db, biz, settings);
  const storeUrl = `${siteUrl()}/b/${biz.slug}`;
  const jobs: Promise<unknown>[] = [];
  const base = { business_id: biz.id, order_id: order.id };

  if (event) {
    // customer email
    const tpl = mergeTpl(settings.customer, KEY_FOR[event]);
    if (tpl.enabled && order.email && sender) {
      const m = renderCustomer(tpl, { store: biz.name, storeUrl, contact: settings.reply_to, order });
      jobs.push(
        logged(db, { ...base, event, channel: 'email', target: order.email, dedupe: `${order.id}:${event}:customer:${order.email}` }, () =>
          sendEmail({ from: sender.from, to: [order.email], subject: m.subject, html: m.html, text: m.text, replyTo: sender.replyTo })
        )
      );
    }

    // staff email
    const staffKey = event === 'order_placed' ? 'new_order' : event === 'order_cancelled' ? 'order_cancelled' : null;
    if (staffKey && staffOn(settings.staff, staffKey) && sender) {
      const to = await staffRecipients(db, biz);
      if (to.length) {
        const m = renderStaffOrder(staffKey === 'new_order' ? 'new' : 'cancelled', {
          store: biz.name,
          dashboardUrl: `${siteUrl()}/dashboard`,
          order,
        });
        jobs.push(
          logged(db, { ...base, event: `staff_${staffKey}`, channel: 'email', target: to.join(', '), dedupe: `${order.id}:staff_${staffKey}` }, () =>
            sendEmail({ from: sender.from, to, subject: m.subject, html: m.html, text: m.text, replyTo: sender.replyTo })
          )
        );
      }
    }

    // webhooks
    const { data: hooks } = await db.from('notification_webhooks').select('*').eq('business_id', biz.id).eq('active', true);
    for (const h of (hooks ?? []) as Hook[]) {
      if (!h.events.includes(event)) continue;
      const payload = {
        event,
        created_at: new Date().toISOString(),
        store: { id: biz.id, name: biz.name, slug: biz.slug },
        order: orderPayload(order),
      };
      jobs.push(
        logged(db, { ...base, event, channel: 'webhook', target: h.url, dedupe: `${order.id}:${event}:webhook:${h.id}` }, () =>
          postWebhook(db, h, event, payload)
        )
      );
    }
  }

  // fulfillment request: sent when an order reaches the status the owner chose
  const f = settings.fulfillment;
  const trigger = (f.trigger_status || 'processing').toLowerCase().replace(/[\s-]+/g, '_');
  if (statusChanged && f.enabled && f.email && sender && order.status.replace(/[\s-]+/g, '_') === trigger) {
    const m = renderFulfillment({ store: biz.name, order });
    jobs.push(
      logged(db, { ...base, event: 'fulfillment_request', channel: 'email', target: f.email, dedupe: `${order.id}:fulfillment_request` }, () =>
        sendEmail({ from: sender.from, to: [f.email as string], subject: m.subject, html: m.html, text: m.text, replyTo: sender.replyTo })
      )
    );
  }

  await Promise.allSettled(jobs);
}
