'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { orderError } from '@/lib/orders';
import { Err, Grey, Ok, btn, card, field, ghost } from './ui';

type Preset = { title: string; fee: number; method: 'shipping' | 'local' | 'pickup' };
type Cfg = { deduct_on: string; restock_on_cancel: boolean; cod_paid_on_delivery: boolean; default_tax_rate: string; tax_included: boolean; tax_label: string; invoice_note: string; shipping_presets: Preset[] };
type Bank = { bank_name: string; account_number: string; account_name: string };

const str = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v));

export default function OrdersSettings({ businessId, bank, onBank }: { businessId: string; bank: Bank; onBank: (b: Bank) => void }) {
  const sb = useMemo(() => createClient(), []);
  const [cfg, setCfg] = useState<Cfg | null>(null);
  const [b, setB] = useState<Bank>(bank);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [bankMsg, setBankMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await sb.rpc('xenon_order_settings', { p_business: businessId });
    if (error) { setErr(orderError(error.message)); return; }
    const s = (data ?? {}) as Record<string, unknown>;
    setCfg({
      deduct_on: str(s.deduct_on) || 'preparing', restock_on_cancel: s.restock_on_cancel !== false, cod_paid_on_delivery: s.cod_paid_on_delivery !== false,
      default_tax_rate: String(Number(s.default_tax_rate) || 0), tax_included: s.tax_included === true, tax_label: str(s.tax_label) || 'VAT', invoice_note: str(s.invoice_note),
      shipping_presets: Array.isArray(s.shipping_presets) ? (s.shipping_presets as Preset[]) : [],
    });
  }, [sb, businessId]);
  useEffect(() => { load(); }, [load]);

  async function save() {
    if (!cfg) return;
    setBusy(true); setErr(''); setOk('');
    const cur = await sb.from('order_settings').select('data').eq('business_id', businessId).maybeSingle();
    const data = {
      ...((cur.data?.data as Record<string, unknown>) ?? {}),
      deduct_on: cfg.deduct_on, restock_on_cancel: cfg.restock_on_cancel, cod_paid_on_delivery: cfg.cod_paid_on_delivery,
      default_tax_rate: Math.min(Math.max(Number(cfg.default_tax_rate) || 0, 0), 100), tax_included: cfg.tax_included, tax_label: cfg.tax_label.trim() || 'VAT', invoice_note: cfg.invoice_note.trim().slice(0, 500),
      shipping_presets: cfg.shipping_presets.filter((p) => p.title.trim()).slice(0, 20).map((p) => ({ title: p.title.trim().slice(0, 120), fee: Math.max(Math.round(Number(p.fee) || 0), 0), method: p.method })),
    };
    const { error } = await sb.from('order_settings').upsert({ business_id: businessId, data, updated_at: new Date().toISOString() }, { onConflict: 'business_id' });
    setBusy(false);
    if (error) return setErr(orderError(error.message));
    setOk('Order settings saved.');
  }

  async function saveBank() {
    const { error } = await sb.from('businesses').update({ bank_name: b.bank_name.trim() || null, account_number: b.account_number.trim() || null, account_name: b.account_name.trim() || null }).eq('id', businessId);
    if (error) return setBankMsg(error.message);
    onBank(b);
    setBankMsg('Saved. Bank transfer is now offered at checkout and on invoices.');
  }

  if (!cfg) return err ? <Err>{err}</Err> : <div className="space-y-3"><Grey className="h-40 w-full" /><Grey className="h-40 w-full" /></div>;
  const set = (p: Partial<Cfg>) => setCfg({ ...cfg, ...p });

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Err>{err}</Err>
      <Ok>{ok}</Ok>

      <section className={`${card} space-y-3 p-5`}>
        <h2 className="text-base font-semibold">Stock</h2>
        <p className="text-sm text-slate-500">When an order is placed, your Inventory counts drop automatically so you never sell what you do not have.</p>
        <label className="block text-sm font-medium">Take items out of stock when an order…
          <select className={`${field} mt-1`} value={cfg.deduct_on} onChange={(e) => set({ deduct_on: e.target.value })}>
            <option value="placed">is placed (safest — stops overselling)</option>
            <option value="preparing">starts being prepared</option>
            <option value="delivered">is delivered</option>
            <option value="never">never (I will adjust stock myself)</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={cfg.restock_on_cancel} onChange={(e) => set({ restock_on_cancel: e.target.checked })} /> Put items back in stock when an order is cancelled</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={cfg.cod_paid_on_delivery} onChange={(e) => set({ cod_paid_on_delivery: e.target.checked })} /> Mark &ldquo;pay on delivery&rdquo; orders as paid when delivered</label>
        <p className="text-xs text-slate-400">Orders you create here follow this exactly. Orders customers place on your shop are matched to your products by name, and their stock is taken out when you move them to Preparing or Delivered (&ldquo;is placed&rdquo; counts as Preparing for those).</p>
      </section>

      <section className={`${card} space-y-3 p-5`}>
        <h2 className="text-base font-semibold">Tax</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-medium">Name<input className={`${field} mt-1`} value={cfg.tax_label} maxLength={20} onChange={(e) => set({ tax_label: e.target.value })} /></label>
          <label className="text-sm font-medium">Default rate % (Nigeria VAT is 7.5)<input className={`${field} mt-1`} inputMode="decimal" value={cfg.default_tax_rate} onChange={(e) => set({ default_tax_rate: e.target.value.replace(/[^\d.]/g, '') })} /></label>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={cfg.tax_included} onChange={(e) => set({ tax_included: e.target.checked })} /> My prices already include tax</label>
      </section>

      <section className={`${card} space-y-3 p-5`}>
        <h2 className="text-base font-semibold">Delivery options for manual orders</h2>
        <p className="text-sm text-slate-500">Quick picks shown when you add shipping to an order.</p>
        {cfg.shipping_presets.map((p, i) => (
          <div key={i} className="grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[1fr_9rem_9rem_auto]">
            <input className={`${field} col-span-2 sm:col-span-1`} placeholder="Name" value={p.title} onChange={(e) => set({ shipping_presets: cfg.shipping_presets.map((x, k) => (k === i ? { ...x, title: e.target.value } : x)) })} />
            <select className={field} value={p.method} onChange={(e) => set({ shipping_presets: cfg.shipping_presets.map((x, k) => (k === i ? { ...x, method: e.target.value as Preset['method'] } : x)) })}>
              <option value="pickup">Pickup</option><option value="local">Local delivery</option><option value="shipping">Shipping</option>
            </select>
            <input className={field} inputMode="numeric" placeholder="Fee ₦" value={p.fee} onChange={(e) => set({ shipping_presets: cfg.shipping_presets.map((x, k) => (k === i ? { ...x, fee: Number(e.target.value.replace(/[^\d]/g, '')) || 0 } : x)) })} />
            <button aria-label="Remove" className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-red-600" onClick={() => set({ shipping_presets: cfg.shipping_presets.filter((_, k) => k !== i) })}><Trash2 size={16} /></button>
          </div>
        ))}
        <button className={ghost} onClick={() => set({ shipping_presets: [...cfg.shipping_presets, { title: '', fee: 0, method: 'local' }] })}><Plus size={15} /> Add option</button>
      </section>

      <section className={`${card} space-y-3 p-5`}>
        <h2 className="text-base font-semibold">Invoice message</h2>
        <textarea className={`${field} min-h-[70px]`} maxLength={500} placeholder="Shown at the bottom of every invoice" value={cfg.invoice_note} onChange={(e) => set({ invoice_note: e.target.value })} />
      </section>

      <button className={btn} disabled={busy} onClick={save}>Save settings</button>

      <section className={`${card} p-5`}>
        <h2 className="text-base font-semibold">Bank transfer details</h2>
        <p className="mt-1 text-sm text-slate-500">Fill these in to let customers choose bank transfer at checkout and see where to pay on invoices. Leave them empty for pay on delivery only.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <input className={field} placeholder="Bank name" value={b.bank_name} onChange={(e) => setB({ ...b, bank_name: e.target.value })} />
          <input className={field} placeholder="Account number" inputMode="numeric" value={b.account_number} onChange={(e) => setB({ ...b, account_number: e.target.value })} />
          <input className={field} placeholder="Account name" value={b.account_name} onChange={(e) => setB({ ...b, account_name: e.target.value })} />
        </div>
        <button className={`${btn} mt-4`} onClick={saveBank}>Save details</button>
        {bankMsg && <p className="mt-2 text-sm text-slate-600">{bankMsg}</p>}
      </section>
    </div>
  );
}
