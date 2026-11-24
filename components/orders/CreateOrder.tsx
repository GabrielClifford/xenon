'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeft, Minus, Plus, Search, Trash2, X, Check } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { calcTotals, customersFrom, invoiceText, mailLink, naira, orderError, parseTags, readOrder, searchCustomers, waLink, type Customer, type Order } from '@/lib/orders';
import { Err, Grey, Modal, btn, card, field, ghost, small, fetchAll } from './ui';

type Line = {
  key: string;
  product_id: string | null;
  variant_id: string | null;
  name: string;
  variant_title: string;
  price: string;
  quantity: string;
  custom: boolean;
  image_url: string;
  sku: string;
  cost: number | null;
  available: number | null; // null = not tracked
};

type Prod = { id: string; name: string; price: number; image: string; stock: number; track: boolean; sku: string; cost: number | null; archived: boolean; variants: Var[] };
type Var = { id: string; title: string; price: number; stock: number; sku: string; cost: number | null; image: string };

type Settings = {
  deduct_on: string; tax_rate: number; tax_included: boolean; tax_label: string; invoice_note: string;
  shipping_presets: { title: string; fee: number; method: 'shipping' | 'local' | 'pickup' }[];
};

const str = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v));
const num = (v: unknown, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const firstImage = (r: Record<string, unknown>): string => {
  if (typeof r.photo_url === 'string' && r.photo_url) return r.photo_url;
  const im = r.images;
  if (Array.isArray(im) && im.length) {
    const f = im[0];
    if (typeof f === 'string') return f;
    if (f && typeof f === 'object' && typeof (f as { url?: unknown }).url === 'string') return (f as { url: string }).url;
  }
  return '';
};
let seq = 0;
const key = () => `l${Date.now().toString(36)}${seq++}`;

const DEFAULTS: Settings = {
  deduct_on: 'preparing', tax_rate: 0, tax_included: false, tax_label: 'VAT', invoice_note: '',
  shipping_presets: [{ title: 'Pickup in store', fee: 0, method: 'pickup' }, { title: 'Local delivery', fee: 1500, method: 'local' }],
};

export default function CreateOrder({
  businessId, storeName, draftId, seed, onClose,
}: { businessId: string; storeName: string; draftId?: string | null; seed?: Order | null; onClose: (changed: boolean, message?: string) => void }) {
  const sb = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [fatal, setFatal] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [prods, setProds] = useState<Prod[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [cfg, setCfg] = useState<Settings>(DEFAULTS);

  const [draft, setDraft] = useState<{ id: string; number: number; token: string; status: string } | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [cust, setCust] = useState({ name: '', phone: '', email: '', company: '', address: '', address2: '' });
  const [custOpen, setCustOpen] = useState(false); // fields visible (existing customer chosen or creating new)
  const [q, setQ] = useState('');
  const [dtype, setDtype] = useState<'' | 'percent' | 'amount'>('');
  const [dvalue, setDvalue] = useState('');
  const [dreason, setDreason] = useState('');
  const [method, setMethod] = useState<'' | 'shipping' | 'local' | 'pickup'>('');
  const [shipTitle, setShipTitle] = useState('');
  const [shipFee, setShipFee] = useState('0');
  const [rate, setRate] = useState('0');
  const [incl, setIncl] = useState(false);
  const [pay, setPay] = useState<'cod' | 'transfer'>('transfer');
  const [note, setNote] = useState('');
  const [staffNote, setStaffNote] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagText, setTagText] = useState('');
  const [due, setDue] = useState('');
  const [deduct, setDeduct] = useState(false);

  const [picker, setPicker] = useState(false);
  const [customItem, setCustomItem] = useState(false);
  const [discountModal, setDiscountModal] = useState(false);
  const [shipModal, setShipModal] = useState(false);
  const [taxModal, setTaxModal] = useState(false);
  const [sendModal, setSendModal] = useState(false);
  const [finish, setFinish] = useState(false);

  const load = useCallback(async () => {
    const [p, v, o, st, dr] = await Promise.all([
      fetchAll<Record<string, unknown>>((a, z) => sb.from('products').select('*').eq('business_id', businessId).order('created_at', { ascending: false }).range(a, z)),
      fetchAll<Record<string, unknown>>((a, z) => sb.from('product_variants').select('*').eq('business_id', businessId).range(a, z)),
      sb.from('orders').select('customer_name,phone,email,company,address,address2,total,status,created_at').eq('business_id', businessId).order('created_at', { ascending: false }).limit(1500),
      sb.rpc('xenon_order_settings', { p_business: businessId }),
      draftId ? sb.from('draft_orders').select('*').eq('id', draftId).eq('business_id', businessId).maybeSingle() : Promise.resolve({ data: null, error: null }),
    ]);
    if (st.error) { setFatal(orderError(st.error.message)); setLoading(false); return; }
    if (p.error && !/relation|exist/i.test(p.error)) { setFatal(orderError(p.error)); setLoading(false); return; }
    const vm = new Map<string, Var[]>();
    for (const r of v.data) {
      const opt = r.options && typeof r.options === 'object' ? Object.values(r.options as Record<string, unknown>).map(str).filter(Boolean).join(' / ') : '';
      const title = str(r.title) || str(r.name) || opt || 'Variant';
      const pid = str(r.product_id);
      const arr = vm.get(pid) ?? [];
      arr.push({ id: str(r.id), title, price: num(r.price, NaN), stock: num(r.stock), sku: str(r.sku), cost: r.cost == null ? null : num(r.cost), image: firstImage(r) || str(r.image_url) });
      vm.set(pid, arr);
    }
    setProds(
      p.data.map((r) => {
        const base = num(r.price);
        const vs = (vm.get(str(r.id)) ?? []).map((x) => ({ ...x, price: Number.isFinite(x.price) ? x.price : base }));
        return { id: str(r.id), name: str(r.name), price: base, image: firstImage(r), stock: num(r.stock), track: r.track_stock !== false, sku: str(r.sku), cost: r.cost == null ? null : num(r.cost), archived: str(r.status) === 'archived', variants: vs };
      }),
    );
    if (!o.error) setCustomers(customersFrom(((o.data ?? []) as Record<string, unknown>[]).map((r) => readOrder(r))));
    const s = (st.data ?? {}) as Record<string, unknown>;
    const merged: Settings = {
      deduct_on: str(s.deduct_on) || DEFAULTS.deduct_on, tax_rate: num(s.default_tax_rate), tax_included: s.tax_included === true, tax_label: str(s.tax_label) || 'VAT', invoice_note: str(s.invoice_note),
      shipping_presets: Array.isArray(s.shipping_presets) && s.shipping_presets.length ? (s.shipping_presets as Settings['shipping_presets']) : DEFAULTS.shipping_presets,
    };
    setCfg(merged);

    const d = dr.data as Record<string, unknown> | null;
    if (d) {
      setDraft({ id: str(d.id), number: num(d.number), token: str(d.invoice_token), status: str(d.status) });
      setLines((Array.isArray(d.items) ? (d.items as Record<string, unknown>[]) : []).map((it) => ({
        key: key(), product_id: str(it.product_id) || null, variant_id: str(it.variant_id) || null, name: str(it.name), variant_title: str(it.variant_title), price: String(num(it.price)), quantity: String(num(it.quantity, 1)),
        custom: it.custom === true, image_url: str(it.image_url), sku: str(it.sku), cost: it.cost == null || it.cost === '' ? null : num(it.cost), available: null,
      })));
      setCust({ name: str(d.customer_name), phone: str(d.phone), email: str(d.email), company: str(d.company), address: str(d.address), address2: str(d.address2) });
      setCustOpen(true);
      setDtype(d.discount_type === 'percent' || d.discount_type === 'amount' ? d.discount_type : '');
      setDvalue(num(d.discount_value) ? String(num(d.discount_value)) : '');
      setDreason(str(d.discount_reason));
      setMethod(d.delivery_method === 'shipping' || d.delivery_method === 'local' || d.delivery_method === 'pickup' ? d.delivery_method : '');
      setShipTitle(str(d.shipping_title)); setShipFee(String(num(d.shipping_fee)));
      setRate(String(num(d.tax_rate))); setIncl(d.tax_included === true);
      setPay(d.payment_method === 'cod' ? 'cod' : 'transfer');
      setNote(str(d.note)); setStaffNote(str(d.staff_note));
      setTags(Array.isArray(d.tags) ? (d.tags as unknown[]).map(str) : []);
      setDue(str(d.due_date));
    } else {
      setRate(String(merged.tax_rate)); setIncl(merged.tax_included);
      if (seed) {
        setCust({ name: seed.customer_name, phone: seed.phone, email: seed.email ?? '', company: seed.company ?? '', address: seed.address ?? '', address2: seed.address2 ?? '' });
        setCustOpen(true);
        setPay(seed.payment_method);
        setLines(seed.items.map((i) => {
          const pr = p.data.find((x) => str(x.id) === i.product_id);
          return { key: key(), product_id: i.product_id, variant_id: i.variant_id, name: i.name, variant_title: i.variant_title ?? '', price: String(i.price), quantity: String(i.quantity), custom: i.is_custom || !i.product_id, image_url: i.image_url ?? (pr ? firstImage(pr) : ''), sku: i.sku ?? '', cost: null, available: null };
        }));
      }
    }
    setDeduct(merged.deduct_on === 'placed');
    setLoading(false);
  }, [sb, businessId, draftId, seed]);

  useEffect(() => { load(); }, [load]);

  const items = useMemo(() => lines.map((l) => ({ name: l.name, price: Number(l.price) || 0, quantity: Number(l.quantity) || 0 })), [lines]);
  const ship = Math.max(Math.round(Number(shipFee) || 0), 0);
  const totals = useMemo(() => calcTotals(items, dtype, Number(dvalue) || 0, ship, Number(rate) || 0, incl), [items, dtype, dvalue, ship, rate, incl]);
  const cost = lines.reduce((a, l) => a + (l.cost ?? 0) * (Number(l.quantity) || 0), 0);
  const costKnown = lines.length > 0 && lines.every((l) => l.cost != null);
  const profit = totals.subtotal - totals.discount - cost;
  const shortLines = lines.filter((l) => l.available != null && (Number(l.quantity) || 0) > (l.available ?? 0));

  // Refresh availability labels from the product list whenever it loads.
  useEffect(() => {
    if (!prods.length) return;
    setLines((ls) => ls.map((l) => {
      if (!l.product_id || l.custom) return l;
      const p = prods.find((x) => x.id === l.product_id);
      if (!p || !p.track) return { ...l, available: null };
      const v = l.variant_id ? p.variants.find((x) => x.id === l.variant_id) : null;
      const avail = v ? v.stock : p.stock;
      return l.available === avail ? l : { ...l, available: avail, cost: l.cost ?? (v?.cost ?? p.cost) };
    }));
  }, [prods]);

  function addFromPicker(picks: { p: Prod; v: Var | null }[]) {
    setLines((ls) => {
      const out = [...ls];
      for (const { p, v } of picks) {
        const at = out.findIndex((l) => l.product_id === p.id && (l.variant_id ?? null) === (v?.id ?? null) && !l.custom);
        if (at >= 0) { out[at] = { ...out[at], quantity: String((Number(out[at].quantity) || 0) + 1) }; continue; }
        out.push({ key: key(), product_id: p.id, variant_id: v?.id ?? null, name: p.name, variant_title: v?.title ?? '', price: String(v ? v.price : p.price), quantity: '1', custom: false, image_url: v?.image || p.image, sku: v?.sku || p.sku, cost: v?.cost ?? p.cost, available: p.track ? (v ? v.stock : p.stock) : null });
      }
      return out;
    });
    setPicker(false);
  }

  const setLine = (k: string, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === k ? { ...l, ...patch } : l)));
  const removeLine = (k: string) => setLines((ls) => ls.filter((l) => l.key !== k));

  function chooseCustomer(c: Customer) {
    setCust({ name: c.name, phone: c.phone, email: c.email, company: c.company, address: c.address, address2: c.address2 });
    setCustOpen(true); setQ('');
  }

  const payload = () => ({
    customer_name: cust.name.trim(), phone: cust.phone.trim(), email: cust.email.trim() || null, company: cust.company.trim() || null, address: cust.address.trim() || null, address2: cust.address2.trim() || null,
    items: lines.map((l) => ({ name: l.name.trim(), price: Math.round(Number(l.price) || 0), quantity: Math.round(Number(l.quantity) || 0), product_id: l.product_id, variant_id: l.variant_id, variant_title: l.variant_title || null, sku: l.sku || null, image_url: l.image_url || null, cost: l.cost, custom: l.custom })),
    discount_type: dtype || null, discount_value: Number(dvalue) || 0, discount_reason: dreason.trim() || null,
    delivery_method: method || null, shipping_title: shipTitle.trim() || null, shipping_fee: ship,
    tax_rate: Number(rate) || 0, tax_included: incl, payment_method: pay, note: note.trim() || null, staff_note: staffNote.trim() || null, tags,
  });

  function problem(forOrder: boolean): string {
    if (forOrder && !cust.name.trim()) return "Add the customer's name first.";
    if (lines.length === 0) return 'Add at least one product or custom item.';
    for (const l of lines) {
      if (!l.name.trim()) return 'Every item needs a name.';
      const q2 = Number(l.quantity);
      if (!Number.isInteger(q2) || q2 < 1) return `Check the quantity on "${l.name || 'an item'}".`;
      if (!(Number(l.price) >= 0)) return `Check the price on "${l.name}".`;
    }
    return '';
  }

  /** Saves the draft row; returns it. */
  async function saveDraft(status?: 'invoiced'): Promise<{ id: string; number: number; token: string } | null> {
    const pl = payload();
    const row = {
      business_id: businessId, customer_name: pl.customer_name, phone: pl.phone, email: pl.email, company: pl.company, address: pl.address, address2: pl.address2, items: pl.items,
      discount_type: pl.discount_type, discount_value: pl.discount_value, discount_reason: pl.discount_reason, delivery_method: pl.delivery_method, shipping_title: pl.shipping_title, shipping_fee: pl.shipping_fee,
      tax_rate: pl.tax_rate, tax_included: pl.tax_included, payment_method: pl.payment_method, note: pl.note, staff_note: pl.staff_note, tags: pl.tags, due_date: due || null,
      subtotal: totals.subtotal, discount_amount: totals.discount, tax_amount: totals.tax, total: totals.total,
      ...(status === 'invoiced' ? { status: 'invoiced', invoice_sent_at: new Date().toISOString() } : {}),
    };
    if (draft) {
      const { error } = await sb.from('draft_orders').update(row).eq('id', draft.id).eq('business_id', businessId);
      if (error) { setErr(orderError(error.message)); return null; }
      return { id: draft.id, number: draft.number, token: draft.token };
    }
    const { data, error } = await sb.from('draft_orders').insert(row).select('id,number,invoice_token').single();
    if (error || !data) { setErr(orderError(error?.message ?? 'Could not save the draft.')); return null; }
    const d = { id: str(data.id), number: num(data.number), token: str(data.invoice_token) };
    setDraft({ ...d, status: status ?? 'open' });
    return d;
  }

  async function onSaveDraft() {
    setErr('');
    const m = problem(false);
    if (m) return setErr(m);
    setBusy(true);
    const d = await saveDraft();
    setBusy(false);
    if (d) onClose(true, `Draft #${d.number} saved.`);
  }

  async function createOrder(markPaid: boolean, deductNow: boolean) {
    setErr('');
    const m = problem(true);
    if (m) return setErr(m);
    setBusy(true);
    let res;
    if (draft) {
      const d = await saveDraft();
      if (!d) { setBusy(false); return; }
      res = await sb.rpc('xenon_complete_draft', { p_draft: d.id, p_mark_paid: markPaid, p_deduct: deductNow });
    } else {
      res = await sb.rpc('xenon_create_order', { p_business: businessId, p: { ...payload(), mark_paid: markPaid, deduct_stock: deductNow, source: 'manual' } });
    }
    setBusy(false);
    if (res.error) return setErr(orderError(res.error.message));
    const r = (res.data ?? {}) as { order_number?: number; stock?: { short?: unknown[] } | null };
    const short = r.stock?.short?.length ?? 0;
    setFinish(false);
    onClose(true, `Order #${r.order_number ?? ''} created.${short ? ` ${short} item(s) did not have enough stock — check Inventory.` : ''}`);
  }

  async function openSend() {
    setErr('');
    const m = problem(true);
    if (m) return setErr(m);
    if (!cust.phone.trim() && !cust.email.trim()) return setErr('Add a phone number or email so we know where to send the invoice.');
    setBusy(true);
    const d = await saveDraft('invoiced');
    setBusy(false);
    if (d) setSendModal(true);
  }

  const invoiceLink = draft ? `${typeof window !== 'undefined' ? window.location.origin : ''}/invoice/${draft.token}` : '';

  if (loading) return <div className="space-y-4"><Grey className="h-10 w-48" /><Grey className="h-28 w-full" /><Grey className="h-48 w-full" /><Grey className="h-64 w-full" /></div>;
  if (fatal) return <div className="space-y-4"><button className={ghost} onClick={() => onClose(false)}><ArrowLeft size={16} /> Back</button><Err>{fatal}</Err></div>;

  const matches = searchCustomers(customers, q);
  const showCreate = q.trim().length > 0;

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-28">
      <div className="flex items-center gap-3">
        <button onClick={() => onClose(false)} aria-label="Back" className="rounded-full border border-slate-300 bg-white p-2.5 hover:bg-slate-50"><ArrowLeft size={18} /></button>
        <h1 className="text-2xl font-bold">{draft ? `Draft #${draft.number}` : 'Create order'}</h1>
      </div>
      <Err>{err}</Err>

      {/* Customer */}
      <section>
        <h2 className="mb-2 text-base font-semibold">Customer</h2>
        <div className={`${card} space-y-3 p-4`}>
          {!custOpen ? (
            <div className="relative">
              <Search size={16} className="pointer-events-none absolute left-3.5 top-3.5 text-slate-400" />
              <input className={`${field} pl-10`} placeholder="Search or create a customer" value={q} onChange={(e) => setQ(e.target.value)} />
              {(q || customers.length > 0) && (
                <div className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200">
                  {matches.map((c) => (
                    <button key={c.key} onClick={() => chooseCustomer(c)} className="flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left hover:bg-slate-50">
                      <span><span className="block text-sm font-medium">{c.name || 'No name'}</span><span className="block text-xs text-slate-500">{[c.phone, c.email].filter(Boolean).join(' · ')}</span></span>
                      <span className="shrink-0 text-xs text-slate-500">{c.orders} order{c.orders === 1 ? '' : 's'} · {naira(c.spent)}</span>
                    </button>
                  ))}
                  {showCreate && (
                    <button onClick={() => { setCust((c) => ({ ...c, name: /\d{5,}/.test(q) ? c.name : q.trim(), phone: /\d{5,}/.test(q) ? q.trim() : c.phone })); setCustOpen(true); setQ(''); }} className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-sm font-medium text-blue-700 hover:bg-blue-50">
                      <Plus size={16} /> Create a new customer &ldquo;{q.trim()}&rdquo;
                    </button>
                  )}
                  {!showCreate && matches.length === 0 && <p className="px-3.5 py-3 text-sm text-slate-500">No customers yet. Type a name or phone number to add one.</p>}
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Customer details</p>
                {!draft && <button className="text-xs font-semibold text-blue-700 underline" onClick={() => { setCustOpen(false); setCust({ name: '', phone: '', email: '', company: '', address: '', address2: '' }); }}>Change customer</button>}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <input className={field} placeholder="Full name *" value={cust.name} onChange={(e) => setCust({ ...cust, name: e.target.value })} />
                <input className={field} placeholder="Phone (08012345678)" inputMode="tel" value={cust.phone} onChange={(e) => setCust({ ...cust, phone: e.target.value })} />
                <input className={field} placeholder="Email (optional)" inputMode="email" value={cust.email} onChange={(e) => setCust({ ...cust, email: e.target.value })} />
                <input className={field} placeholder="Company (optional)" value={cust.company} onChange={(e) => setCust({ ...cust, company: e.target.value })} />
                <input className={`${field} sm:col-span-2`} placeholder="Delivery address" value={cust.address} onChange={(e) => setCust({ ...cust, address: e.target.value })} />
                <input className={`${field} sm:col-span-2`} placeholder="Apartment, landmark, etc. (optional)" value={cust.address2} onChange={(e) => setCust({ ...cust, address2: e.target.value })} />
              </div>
            </>
          )}
        </div>
      </section>

      {/* Products */}
      <section>
        <h2 className="mb-2 text-base font-semibold">Products</h2>
        <div className={`${card} space-y-3 p-4`}>
          {lines.map((l) => {
            const q2 = Number(l.quantity) || 0;
            const over = l.available != null && q2 > l.available;
            return (
              <div key={l.key} className="rounded-xl border border-slate-200 p-3">
                <div className="flex gap-3">
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                    {l.image_url ? <img src={l.image_url} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-400">{l.custom ? 'Custom' : 'No photo'}</div>}
                  </div>
                  <div className="min-w-0 flex-1">
                    {l.custom ? <input className={`${field} py-1.5`} value={l.name} onChange={(e) => setLine(l.key, { name: e.target.value })} /> : <p className="truncate text-sm font-semibold">{l.name}</p>}
                    {l.variant_title && <p className="text-xs text-slate-500">{l.variant_title}</p>}
                    {l.available != null && <p className={`mt-0.5 text-xs ${over ? 'font-semibold text-red-600' : l.available <= 3 ? 'text-orange-600' : 'text-slate-500'}`}>{l.available} available{over ? ' — not enough' : ''}</p>}
                  </div>
                  <button onClick={() => removeLine(l.key)} aria-label="Remove" className="h-8 w-8 shrink-0 rounded-full text-slate-400 hover:bg-slate-100 hover:text-red-600"><Trash2 size={16} className="mx-auto" /></button>
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <label className="flex items-center gap-2 text-xs text-slate-500">₦
                    <input className={`${field} w-28 py-1.5`} inputMode="numeric" value={l.price} onChange={(e) => setLine(l.key, { price: e.target.value.replace(/[^\d]/g, '') })} />
                  </label>
                  <div className="flex items-center gap-1">
                    <button className={small} onClick={() => setLine(l.key, { quantity: String(Math.max(1, q2 - 1)) })}><Minus size={14} /></button>
                    <input className={`${field} w-14 py-1.5 text-center`} inputMode="numeric" value={l.quantity} onChange={(e) => setLine(l.key, { quantity: e.target.value.replace(/[^\d]/g, '') })} />
                    <button className={small} onClick={() => setLine(l.key, { quantity: String(q2 + 1) })}><Plus size={14} /></button>
                  </div>
                  <p className="w-28 text-right text-sm font-semibold">{naira((Number(l.price) || 0) * q2)}</p>
                </div>
              </div>
            );
          })}
          {shortLines.length > 0 && (
            <div className="flex gap-2 rounded-xl bg-orange-50 p-3 text-sm text-orange-900">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <p>{shortLines.map((l) => l.name).join(', ')} {shortLines.length === 1 ? 'has' : 'have'} less stock than you added. You can still create the order, then restock from Purchase orders.</p>
            </div>
          )}
          <button className={`${btn} w-full`} onClick={() => setPicker(true)}><Plus size={16} /> Add product</button>
          <button className={`${ghost} w-full bg-slate-100`} onClick={() => setCustomItem(true)}>Add custom item</button>
        </div>
      </section>

      {/* Payment */}
      <section>
        <h2 className="mb-2 text-base font-semibold">Payment</h2>
        <div className={`${card} divide-y divide-slate-100 text-sm`}>
          <Row label="Subtotal" value={naira(totals.subtotal)} />
          <Row label="Discount" value={totals.discount ? '−' + naira(totals.discount) : naira(0)} action={dtype ? `${dtype === 'percent' ? dvalue + '%' : naira(Number(dvalue) || 0)}${dreason ? ' · ' + dreason : ''} (edit)` : 'Add discount'} onAction={() => setDiscountModal(true)} />
          <Row label="Shipping" value={naira(ship)} action={method ? `${shipTitle || method} (edit)` : 'Add shipping or delivery'} onAction={() => setShipModal(true)} />
          <Row label={Number(rate) > 0 ? `${cfg.tax_label} ${rate}%${incl ? ' (included)' : ''}` : 'Tax'} value={lines.length === 0 ? 'Not calculated' : naira(totals.tax)} action={Number(rate) > 0 ? 'Edit tax' : 'Add tax'} onAction={() => setTaxModal(true)} />
          <div className="flex items-center justify-between px-4 py-3 text-base font-bold"><span>Total</span><span>{naira(totals.total)} NGN</span></div>
          <div className="space-y-3 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            {lines.length === 0 ? 'Add a product to calculate total and view payment options' : (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-slate-700">Customer will pay by</span>
                  <select className={`${field} w-auto py-1.5`} value={pay} onChange={(e) => setPay(e.target.value as 'cod' | 'transfer')}>
                    <option value="transfer">Bank transfer</option>
                    <option value="cod">Pay on delivery</option>
                  </select>
                  <span className="text-slate-700">Invoice due</span>
                  <input type="date" className={`${field} w-auto py-1.5`} value={due} onChange={(e) => setDue(e.target.value)} />
                </div>
                {costKnown && <p className="text-xs">Estimated profit on this order: <b className={profit >= 0 ? 'text-green-700' : 'text-red-600'}>{naira(profit)}</b> ({totals.subtotal - totals.discount > 0 ? Math.round((profit / (totals.subtotal - totals.discount)) * 100) : 0}% margin)</p>}
              </>
            )}
          </div>
        </div>
      </section>

      {/* Markets */}
      <section>
        <h2 className="mb-2 text-base font-semibold">Markets</h2>
        <span className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium">🌍 Nigeria</span>
        <div className="mt-3 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5"><p className="text-xs text-slate-500">Currency</p><p className="text-sm">Nigerian Naira (NGN ₦)</p></div>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">Notes</h2>
        <textarea className={`${field} min-h-[72px]`} placeholder="Note for the customer (shows on the invoice and order)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} />
        <textarea className={`${field} min-h-[60px]`} placeholder="Private staff note (only you see this)" value={staffNote} onChange={(e) => setStaffNote(e.target.value)} maxLength={2000} />
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">Tags</h2>
        <div className="flex flex-wrap gap-2">
          {tags.map((t) => <span key={t} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium">{t}<button onClick={() => setTags(tags.filter((x) => x !== t))} aria-label={`Remove ${t}`}><X size={12} /></button></span>)}
        </div>
        <input className={field} placeholder="Add tags like VIP, wholesale, gift (press Enter)" value={tagText} onChange={(e) => setTagText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); setTags(parseTags(tagText, tags)); setTagText(''); } }} onBlur={() => { if (tagText.trim()) { setTags(parseTags(tagText, tags)); setTagText(''); } }} />
      </section>

      {/* Action bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-2">
          <p className="text-sm"><span className="text-slate-500">Total </span><b>{naira(totals.total)}</b></p>
          <div className="flex flex-wrap gap-2">
            <button className={ghost} disabled={busy} onClick={onSaveDraft}>Save as draft</button>
            <button className={ghost} disabled={busy} onClick={openSend}>Send invoice</button>
            <button className={btn} disabled={busy} onClick={() => { const m = problem(true); if (m) setErr(m); else { setErr(''); setFinish(true); } }}>Create order</button>
          </div>
        </div>
      </div>

      {picker && <ProductPicker prods={prods} onClose={() => setPicker(false)} onAdd={addFromPicker} />}
      {customItem && <CustomItemModal onClose={() => setCustomItem(false)} onAdd={(name, price, qty) => { setLines((ls) => [...ls, { key: key(), product_id: null, variant_id: null, name, variant_title: '', price: String(price), quantity: String(qty), custom: true, image_url: '', sku: '', cost: null, available: null }]); setCustomItem(false); }} />}
      {discountModal && <DiscountModal type={dtype} value={dvalue} reason={dreason} sub={totals.subtotal} onClose={() => setDiscountModal(false)} onSave={(t, v, r) => { setDtype(t); setDvalue(v); setDreason(r); setDiscountModal(false); }} />}
      {shipModal && <ShippingModal presets={cfg.shipping_presets} method={method} title={shipTitle} fee={shipFee} onClose={() => setShipModal(false)} onSave={(m, t, f) => { setMethod(m); setShipTitle(t); setShipFee(f); setShipModal(false); }} />}
      {taxModal && <TaxModal label={cfg.tax_label} rate={rate} incl={incl} onClose={() => setTaxModal(false)} onSave={(r, i) => { setRate(r); setIncl(i); setTaxModal(false); }} />}
      {sendModal && draft && (
        <Modal title={`Invoice #${draft.number}`} onClose={() => { setSendModal(false); onClose(true, `Invoice #${draft.number} ready.`); }}>
          <p className="text-sm text-slate-600">Your customer opens the link, sees the invoice and bank details, and taps &ldquo;I have paid&rdquo;. You then confirm and turn the draft into an order.</p>
          <input readOnly className={`${field} mt-3 text-xs`} value={invoiceLink} onFocus={(e) => e.currentTarget.select()} />
          <div className="mt-3 flex flex-wrap gap-2">
            {cust.phone.trim() && <a className={btn} target="_blank" rel="noopener noreferrer" href={waLink(cust.phone, invoiceText(storeName, draft.number, totals.total, invoiceLink))}>Send on WhatsApp</a>}
            {cust.email.trim() && <a className={ghost} href={mailLink(cust.email, `Invoice #${draft.number} from ${storeName}`, invoiceText(storeName, draft.number, totals.total, invoiceLink))}>Send by email</a>}
            <button className={ghost} onClick={() => navigator.clipboard?.writeText(invoiceLink)}>Copy link</button>
          </div>
        </Modal>
      )}
      {finish && (
        <Modal title="Create order" onClose={() => setFinish(false)}>
          <p className="text-sm text-slate-600">Total <b>{naira(totals.total)}</b> for {cust.name || 'this customer'}.</p>
          <label className="mt-4 flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={deduct} onChange={(e) => setDeduct(e.target.checked)} /><span><b>Take items out of stock now</b><br /><span className="text-slate-500">Otherwise stock is taken out when you start preparing the order (change this in Orders settings).</span></span></label>
          <div className="mt-5 grid gap-2">
            <button className={btn} disabled={busy} onClick={() => createOrder(true, deduct)}><Check size={16} /> Create order — already paid</button>
            <button className={ghost} disabled={busy} onClick={() => createOrder(false, deduct)}>Create order — payment pending</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Row({ label, value, action, onAction }: { label: string; value: string; action?: string; onAction?: () => void }) {
  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between"><span>{label}</span><span>{value}</span></div>
      {action && <button onClick={onAction} className="mt-1 text-left text-sm text-slate-400 hover:text-blue-700">{action}</button>}
    </div>
  );
}

function ProductPicker({ prods, onClose, onAdd }: { prods: Prod[]; onClose: () => void; onAdd: (picks: { p: Prod; v: Var | null }[]) => void }) {
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<Record<string, boolean>>({});
  const [inStock, setInStock] = useState(false);
  const t = q.trim().toLowerCase();
  const rows = useMemo(() => {
    const out: { id: string; p: Prod; v: Var | null; label: string; price: number; avail: number | null; sku: string }[] = [];
    for (const p of prods) {
      if (p.archived) continue;
      const match = !t || p.name.toLowerCase().includes(t) || p.sku.toLowerCase().includes(t);
      if (p.variants.length === 0) {
        if (match) out.push({ id: p.id, p, v: null, label: p.name, price: p.price, avail: p.track ? p.stock : null, sku: p.sku });
      } else {
        for (const v of p.variants) {
          if (match || v.title.toLowerCase().includes(t) || v.sku.toLowerCase().includes(t)) out.push({ id: v.id, p, v, label: `${p.name} — ${v.title}`, price: v.price, avail: p.track ? v.stock : null, sku: v.sku });
        }
      }
    }
    return inStock ? out.filter((r) => r.avail == null || r.avail > 0) : out;
  }, [prods, t, inStock]);
  const count = Object.values(sel).filter(Boolean).length;
  return (
    <Modal title="Select products" onClose={onClose} wide footer={<><span className="mr-auto self-center text-sm text-slate-500">{count} selected</span><button className={ghost} onClick={onClose}>Cancel</button><button className={btn} disabled={!count} onClick={() => onAdd(rows.filter((r) => sel[r.id]).map((r) => ({ p: r.p, v: r.v })))}>Add</button></>}>
      <div className="space-y-3">
        <input autoFocus className={field} placeholder="Search products or SKU" value={q} onChange={(e) => setQ(e.target.value)} />
        <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={inStock} onChange={(e) => setInStock(e.target.checked)} /> Only show items in stock</label>
        {prods.length === 0 && <p className="text-sm text-slate-500">You have no products yet. Add some in Products, or use &ldquo;Add custom item&rdquo;.</p>}
        <div className="divide-y divide-slate-100">
          {rows.map((r) => (
            <label key={r.id} className="flex cursor-pointer items-center gap-3 py-2.5">
              <input type="checkbox" checked={!!sel[r.id]} onChange={(e) => setSel({ ...sel, [r.id]: e.target.checked })} />
              <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-slate-100">{(r.v?.image || r.p.image) && <img src={r.v?.image || r.p.image} alt="" className="h-full w-full object-cover" />}</div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{r.label}</p>
                {r.avail != null && <p className={`flex items-center gap-1 text-xs ${r.avail <= 0 ? 'text-orange-700' : 'text-slate-500'}`}>{r.avail <= 0 && <AlertTriangle size={12} />}{r.avail} available</p>}
              </div>
              <span className="shrink-0 text-sm">{naira(r.price)}</span>
            </label>
          ))}
          {rows.length === 0 && prods.length > 0 && <p className="py-6 text-center text-sm text-slate-500">Nothing matches.</p>}
        </div>
      </div>
    </Modal>
  );
}

function CustomItemModal({ onClose, onAdd }: { onClose: () => void; onAdd: (name: string, price: number, qty: number) => void }) {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [qty, setQty] = useState('1');
  const ok = name.trim() && Number(price) >= 0 && price !== '' && Number(qty) >= 1;
  return (
    <Modal title="Add custom item" onClose={onClose} footer={<><button className={ghost} onClick={onClose}>Cancel</button><button className={btn} disabled={!ok} onClick={() => onAdd(name.trim(), Math.round(Number(price)), Math.round(Number(qty)))}>Add item</button></>}>
      <div className="space-y-3">
        <p className="text-sm text-slate-500">For something that is not in your product list: a service, a special request, delivery packaging.</p>
        <input autoFocus className={field} placeholder="Item name" value={name} onChange={(e) => setName(e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <input className={field} placeholder="Price (₦)" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d]/g, ''))} />
          <input className={field} placeholder="Quantity" inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value.replace(/[^\d]/g, ''))} />
        </div>
      </div>
    </Modal>
  );
}

function DiscountModal({ type, value, reason, sub, onClose, onSave }: { type: '' | 'percent' | 'amount'; value: string; reason: string; sub: number; onClose: () => void; onSave: (t: '' | 'percent' | 'amount', v: string, r: string) => void }) {
  const [t, setT] = useState<'percent' | 'amount'>(type || 'percent');
  const [v, setV] = useState(value);
  const [r, setR] = useState(reason);
  const bad = t === 'percent' ? Number(v) > 100 : Number(v) > sub;
  return (
    <Modal title="Add discount" onClose={onClose} footer={<>{type && <button className={`${ghost} mr-auto`} onClick={() => onSave('', '', '')}>Remove</button>}<button className={ghost} onClick={onClose}>Cancel</button><button className={btn} disabled={!Number(v) || bad} onClick={() => onSave(t, v, r)}>Apply</button></>}>
      <div className="space-y-3">
        <div className="flex gap-2">
          <button className={t === 'percent' ? btn : ghost} onClick={() => setT('percent')}>Percentage %</button>
          <button className={t === 'amount' ? btn : ghost} onClick={() => setT('amount')}>Amount ₦</button>
        </div>
        <input autoFocus className={field} inputMode="decimal" placeholder={t === 'percent' ? 'e.g. 10' : 'e.g. 2000'} value={v} onChange={(e) => setV(e.target.value.replace(/[^\d.]/g, ''))} />
        {bad && <p className="text-xs text-red-600">{t === 'percent' ? 'A discount cannot be more than 100%.' : 'A discount cannot be more than the subtotal.'}</p>}
        <input className={field} placeholder="Reason (optional, e.g. loyal customer)" value={r} maxLength={200} onChange={(e) => setR(e.target.value)} />
      </div>
    </Modal>
  );
}

function ShippingModal({ presets, method, title, fee, onClose, onSave }: { presets: Settings['shipping_presets']; method: '' | 'shipping' | 'local' | 'pickup'; title: string; fee: string; onClose: () => void; onSave: (m: '' | 'shipping' | 'local' | 'pickup', t: string, f: string) => void }) {
  const [m, setM] = useState<'shipping' | 'local' | 'pickup'>(method || 'local');
  const [tt, setTt] = useState(title);
  const [f, setF] = useState(fee);
  return (
    <Modal title="Shipping or delivery" onClose={onClose} footer={<>{method && <button className={`${ghost} mr-auto`} onClick={() => onSave('', '', '0')}>Remove</button>}<button className={ghost} onClick={onClose}>Cancel</button><button className={btn} onClick={() => onSave(m, tt.trim() || (m === 'pickup' ? 'Pickup in store' : m === 'local' ? 'Local delivery' : 'Delivery'), f || '0')}>Apply</button></>}>
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {presets.map((p, i) => <button key={i} className={small} onClick={() => { setM(p.method); setTt(p.title); setF(String(p.fee)); }}>{p.title} · {naira(p.fee)}</button>)}
        </div>
        <select className={field} value={m} onChange={(e) => setM(e.target.value as 'shipping' | 'local' | 'pickup')}>
          <option value="pickup">Pickup in store</option><option value="local">Local delivery</option><option value="shipping">Shipping to another state</option>
        </select>
        <input className={field} placeholder="Name (e.g. Lagos Mainland rider)" value={tt} onChange={(e) => setTt(e.target.value)} />
        <input className={field} inputMode="numeric" placeholder="Fee (₦)" value={f} onChange={(e) => setF(e.target.value.replace(/[^\d]/g, ''))} />
      </div>
    </Modal>
  );
}

function TaxModal({ label, rate, incl, onClose, onSave }: { label: string; rate: string; incl: boolean; onClose: () => void; onSave: (r: string, i: boolean) => void }) {
  const [r, setR] = useState(rate);
  const [i, setI] = useState(incl);
  return (
    <Modal title={`Estimated ${label}`} onClose={onClose} footer={<><button className={ghost} onClick={onClose}>Cancel</button><button className={btn} disabled={Number(r) < 0 || Number(r) > 100} onClick={() => onSave(r || '0', i)}>Apply</button></>}>
      <div className="space-y-3">
        <input autoFocus className={field} inputMode="decimal" placeholder="Rate % (Nigeria VAT is 7.5)" value={r} onChange={(e) => setR(e.target.value.replace(/[^\d.]/g, ''))} />
        <button className={small} onClick={() => setR('7.5')}>Use 7.5% VAT</button>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={i} onChange={(e) => setI(e.target.checked)} /><span>Prices already include this tax<br /><span className="text-slate-500">The total stays the same; the tax is shown as part of it.</span></span></label>
      </div>
    </Modal>
  );
}

