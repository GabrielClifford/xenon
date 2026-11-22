'use client';

import { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Err, Modal, Toggle, btn, field, ghost, labelCls } from '@/components/products/ui';
import { today } from '@/components/products/inventoryUi';
import {
  PAYMENT_COLS, SUPPLIER_COLS, adjLabels, currencies, fmtMoney, paymentMethods, paymentTerms, poError, readSupplier, round2,
  type AdjType, type Adjustment, type Po, type PoItem, type Supplier,
} from '@/lib/purchaseOrders';

/* ------------------------------- supplier ------------------------------- */

export function SupplierModal({ businessId, supplier, onClose, onSaved }: { businessId: string; supplier: Supplier | null; onClose: () => void; onSaved: (s: Supplier) => void }) {
  const sb = useMemo(() => createClient(), []);
  const [f, setF] = useState({
    name: supplier?.name ?? '',
    contact_name: supplier?.contact_name ?? '',
    email: supplier?.email ?? '',
    phone: supplier?.phone ?? '',
    address: supplier?.address ?? '',
    country: supplier?.country ?? 'Nigeria',
    currency: supplier?.currency ?? 'NGN',
    payment_terms: supplier?.payment_terms ?? '',
    lead_time_days: supplier?.lead_time_days?.toString() ?? '',
    notes: supplier?.notes ?? '',
    active: supplier?.active ?? true,
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));

  async function save() {
    setErr('');
    const name = f.name.trim().replace(/\s+/g, ' ');
    if (!name) return setErr('Enter the supplier name.');
    if (f.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) return setErr('That email address does not look right.');
    if (f.lead_time_days.trim() && !/^\d{1,3}$/.test(f.lead_time_days.trim())) return setErr('Lead time is a number of days, like 14.');
    setBusy(true);
    const payload = {
      name,
      contact_name: f.contact_name.trim() || null,
      email: f.email.trim() || null,
      phone: f.phone.trim() || null,
      address: f.address.trim() || null,
      country: f.country.trim() || null,
      currency: f.currency,
      payment_terms: f.payment_terms || null,
      lead_time_days: f.lead_time_days.trim() ? Number(f.lead_time_days) : null,
      notes: f.notes.trim() || null,
      active: f.active,
    };
    const q = supplier ? sb.from('suppliers').update(payload).eq('id', supplier.id).eq('business_id', businessId) : sb.from('suppliers').insert({ ...payload, business_id: businessId });
    const { data, error } = await q.select(SUPPLIER_COLS).single();
    setBusy(false);
    if (error) return setErr(poError(error.message));
    onSaved(readSupplier(data as Record<string, unknown>));
  }

  return (
    <Modal title={supplier ? 'Edit supplier' : 'Add supplier'} onClose={onClose} wide>
      <div className="space-y-4">
        <Err text={err} />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={labelCls}>Company name</label>
            <input className={field} maxLength={120} value={f.name} onChange={(e) => set('name', e.target.value)} autoFocus />
          </div>
          <div>
            <label className={labelCls}>Contact person</label>
            <input className={field} maxLength={120} value={f.contact_name} onChange={(e) => set('contact_name', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Phone / WhatsApp</label>
            <input className={field} maxLength={30} inputMode="tel" value={f.phone} onChange={(e) => set('phone', e.target.value)} placeholder="08012345678" />
          </div>
          <div>
            <label className={labelCls}>Email</label>
            <input className={field} maxLength={160} inputMode="email" value={f.email} onChange={(e) => set('email', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Country</label>
            <input className={field} maxLength={80} value={f.country} onChange={(e) => set('country', e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Address</label>
            <input className={field} maxLength={300} value={f.address} onChange={(e) => set('address', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Currency they bill in</label>
            <select className={field} value={f.currency} onChange={(e) => set('currency', e.target.value)}>
              {currencies.map((c) => (
                <option key={c.code} value={c.code}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Payment terms</label>
            <select className={field} value={f.payment_terms} onChange={(e) => set('payment_terms', e.target.value)}>
              {paymentTerms.map((t) => (
                <option key={t.v} value={t.v}>{t.t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Usual delivery time (days)</label>
            <input className={field} inputMode="numeric" maxLength={3} value={f.lead_time_days} onChange={(e) => set('lead_time_days', e.target.value.replace(/\D/g, ''))} placeholder="14" />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Notes</label>
            <textarea className={field} rows={2} maxLength={2000} value={f.notes} onChange={(e) => set('notes', e.target.value)} />
          </div>
        </div>
        {supplier && <Toggle on={f.active} onChange={(v) => set('active', v)} label="Supplier is active" hint="Turn off suppliers you no longer buy from. Their old orders stay." />}
        <div className="flex gap-3">
          <button type="button" className={btn} onClick={save} disabled={busy}>{busy ? 'Saving...' : 'Save supplier'}</button>
          <button type="button" className={ghost} onClick={onClose} disabled={busy}>Cancel</button>
        </div>
      </div>
    </Modal>
  );
}

/* -------------------------------- receive -------------------------------- */

export function ReceiveModal({ po, items, onClose, onDone }: { po: Po; items: PoItem[]; onClose: () => void; onDone: (msg: string) => void }) {
  const sb = useMemo(() => createClient(), []);
  const open = items.filter((i) => i.quantity - i.received - i.rejected > 0);
  const [acc, setAcc] = useState<Record<string, string>>(() => Object.fromEntries(open.map((i) => [i.id, '0'])));
  const [rej, setRej] = useState<Record<string, string>>({});
  const [mode, setMode] = useState<'none' | 'last' | 'average'>('none');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const n = (s: string | undefined) => (/^\d{1,7}$/.test((s ?? '').trim()) ? Number(s) : 0);

  const totalAccept = open.reduce((s, i) => s + n(acc[i.id]), 0);

  function all() {
    setAcc(Object.fromEntries(open.map((i) => [i.id, String(i.quantity - i.received - i.rejected)])));
    setRej({});
  }

  async function go() {
    setErr('');
    const lines: { item_id: string; accept: number; reject: number }[] = [];
    for (const i of open) {
      const a = n(acc[i.id]);
      const r = n(rej[i.id]);
      if (a + r > i.quantity - i.received - i.rejected) return setErr(`${i.name}: only ${i.quantity - i.received - i.rejected} left to receive.`);
      if (a + r > 0) lines.push({ item_id: i.id, accept: a, reject: r });
    }
    if (lines.length === 0) return setErr('Enter how many units arrived for at least one item.');
    setBusy(true);
    const { data, error } = await sb.rpc('xenon_receive_po', { p_po: po.id, p_lines: lines, p_cost_mode: mode });
    setBusy(false);
    if (error) return setErr(poError(error.message));
    const d = (data ?? {}) as { units?: number; status?: string };
    onDone(`${d.units ?? totalAccept} unit${(d.units ?? totalAccept) === 1 ? '' : 's'} added to ${po.destination_name ?? 'your stock'}.${d.status === 'received' ? ' The order is complete.' : ''}`);
  }

  return (
    <Modal title={`Receive items for PO #${po.number}`} onClose={onClose} wide>
      <div className="space-y-4">
        <p className="text-sm text-slate-600">Count what actually arrived. Accepted units go into {po.destination_name ?? 'your stock'} straight away. Rejected units (damaged or wrong) are recorded but not added.</p>
        <Err text={err} />
        <div className="flex justify-end">
          <button type="button" className={ghost} onClick={all}>Receive everything left</button>
        </div>
        <div className="max-h-[45vh] overflow-auto rounded-xl border border-slate-200">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr><th className="px-3 py-2">Item</th><th className="px-2 py-2 text-right">Left</th><th className="px-2 py-2">Accept</th><th className="px-2 py-2">Reject</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {open.map((i) => (
                <tr key={i.id}>
                  <td className="px-3 py-2 font-medium text-slate-900">{i.name}</td>
                  <td className="px-2 py-2 text-right text-slate-600">{i.quantity - i.received - i.rejected}</td>
                  <td className="px-2 py-2"><input className={`${field} w-20 py-1.5`} inputMode="numeric" aria-label={`Accept ${i.name}`} value={acc[i.id] ?? ''} onChange={(e) => setAcc((a) => ({ ...a, [i.id]: e.target.value.replace(/\D/g, '') }))} /></td>
                  <td className="px-2 py-2"><input className={`${field} w-20 py-1.5`} inputMode="numeric" aria-label={`Reject ${i.name}`} value={rej[i.id] ?? ''} placeholder="0" onChange={(e) => setRej((a) => ({ ...a, [i.id]: e.target.value.replace(/\D/g, '') }))} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <label className={labelCls}>Update product cost from this order</label>
          <select className={field} value={mode} onChange={(e) => setMode(e.target.value as typeof mode)}>
            <option value="none">Do not change costs</option>
            <option value="last">Use this order&apos;s landed cost</option>
            <option value="average">Average with the stock I already have</option>
          </select>
          <p className="mt-1 text-xs text-slate-500">Landed cost includes shipping, duties and other fees, shared across items by value, in naira. It keeps your profit figures honest.</p>
        </div>
        <div className="flex gap-3">
          <button type="button" className={btn} onClick={go} disabled={busy}>{busy ? 'Receiving...' : `Receive ${totalAccept || ''} unit${totalAccept === 1 ? '' : 's'}`.replace('  ', ' ')}</button>
          <button type="button" className={ghost} onClick={onClose} disabled={busy}>Cancel</button>
        </div>
      </div>
    </Modal>
  );
}

/* -------------------------------- payment -------------------------------- */

export function PaymentModal({ businessId, po, balance, onClose, onDone }: { businessId: string; po: Po; balance: number; onClose: () => void; onDone: (msg: string) => void }) {
  const sb = useMemo(() => createClient(), []);
  const [amount, setAmount] = useState(balance > 0 ? String(round2(balance)) : '');
  const [date, setDate] = useState(today());
  const [method, setMethod] = useState(paymentMethods[0]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function save() {
    setErr('');
    if (!/^\d{1,12}(\.\d{1,2})?$/.test(amount.trim()) || Number(amount) <= 0) return setErr('Enter the amount paid, like 25000 or 120.50.');
    if (Number(amount) > balance + 0.005) return setErr(`That is more than the ${fmtMoney(balance, po.currency)} still owed.`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return setErr('Choose the date you paid.');
    setBusy(true);
    const { error } = await sb.from('purchase_order_payments').insert({ business_id: businessId, po_id: po.id, amount: Number(amount), paid_on: date, method, note: note.trim() || null }).select(PAYMENT_COLS);
    setBusy(false);
    if (error) return setErr(poError(error.message));
    onDone(`Payment of ${fmtMoney(Number(amount), po.currency)} recorded.`);
  }

  return (
    <Modal title="Record a payment" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-slate-600">Balance due: <span className="font-semibold text-slate-900">{fmtMoney(balance, po.currency)}</span></p>
        <Err text={err} />
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Amount ({po.currency})</label>
            <input className={field} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
          </div>
          <div>
            <label className={labelCls}>Date paid</label>
            <input type="date" className={field} value={date} max={today()} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Method</label>
            <select className={field} value={method} onChange={(e) => setMethod(e.target.value)}>
              {paymentMethods.map((m) => (<option key={m}>{m}</option>))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Note (optional)</label>
            <input className={field} maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Transfer ref" />
          </div>
        </div>
        <div className="flex gap-3">
          <button type="button" className={btn} onClick={save} disabled={busy}>{busy ? 'Saving...' : 'Record payment'}</button>
          <button type="button" className={ghost} onClick={onClose} disabled={busy}>Cancel</button>
        </div>
      </div>
    </Modal>
  );
}

/* ------------------------------ cost summary ------------------------------ */

export function CostSummaryModal({ adjustments, currency, onClose, onApply }: { adjustments: Adjustment[]; currency: string; onClose: () => void; onApply: (a: Adjustment[]) => void }) {
  const [rows, setRows] = useState<{ type: AdjType; amount: string }[]>(adjustments.map((a) => ({ type: a.type, amount: String(a.amount) })));
  const [err, setErr] = useState('');
  const used = new Set(rows.map((r) => r.type));
  const free = (Object.keys(adjLabels) as AdjType[]).filter((t) => !used.has(t));

  function apply() {
    const out: Adjustment[] = [];
    for (const r of rows) {
      if (r.amount.trim() === '') continue;
      if (!/^\d{1,12}(\.\d{1,2})?$/.test(r.amount.trim())) return setErr(`"${r.amount}" is not a valid amount for ${adjLabels[r.type]}.`);
      out.push({ type: r.type, amount: Number(r.amount) });
    }
    onApply(out);
  }

  return (
    <Modal title="Manage cost summary" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-slate-600">Add the extra costs on this order, in {currency}. Fees are spread across the items by value, so each item&apos;s real cost reflects them once you receive stock. A discount lowers the total.</p>
        <Err text={err} />
        {rows.map((r, idx) => (
          <div key={r.type} className="flex items-end gap-2">
            <div className="flex-1">
              <label className={labelCls}>{adjLabels[r.type]}</label>
              <input className={field} inputMode="decimal" value={r.amount} placeholder="0" onChange={(e) => setRows((x) => x.map((y, j) => (j === idx ? { ...y, amount: e.target.value } : y)))} />
            </div>
            <button type="button" aria-label={`Remove ${adjLabels[r.type]}`} className={`${ghost} px-3`} onClick={() => setRows((x) => x.filter((_, j) => j !== idx))}>
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
        {free.length > 0 && rows.length < 20 && (
          <div className="flex flex-wrap gap-2">
            {free.map((t) => (
              <button key={t} type="button" className={`${ghost} inline-flex items-center gap-1 px-3 py-1.5 text-xs`} onClick={() => setRows((x) => [...x, { type: t, amount: '' }])}>
                <Plus className="h-3.5 w-3.5" /> {adjLabels[t]}
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-3">
          <button type="button" className={btn} onClick={apply}>Done</button>
          <button type="button" className={ghost} onClick={onClose}>Cancel</button>
        </div>
      </div>
    </Modal>
  );
}

/* --------------------------------- details --------------------------------- */

export type Details = { expected_at: string; reference: string; note: string; terms: string; currency: string; exchange_rate: string; tax_rate: string; tax_included: boolean };

export function DetailsModal({ value, lockMoney, onClose, onApply }: { value: Details; lockMoney: boolean; onClose: () => void; onApply: (d: Details) => void }) {
  const [d, setD] = useState(value);
  const [err, setErr] = useState('');
  const set = <K extends keyof Details>(k: K, v: Details[K]) => setD((p) => ({ ...p, [k]: v }));

  function apply() {
    if (d.currency !== 'NGN' && !(Number(d.exchange_rate) > 0)) return setErr(`Enter how many naira one ${d.currency} is worth.`);
    const t = Number(d.tax_rate || 0);
    if (!Number.isFinite(t) || t < 0 || t > 100) return setErr('The tax rate must be between 0 and 100.');
    onApply({ ...d, exchange_rate: d.currency === 'NGN' ? '1' : d.exchange_rate, tax_rate: String(t) });
  }

  return (
    <Modal title="Purchase order details" onClose={onClose} wide>
      <div className="space-y-4">
        <Err text={err} />
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Estimated arrival</label>
            <input type="date" className={field} value={d.expected_at} onChange={(e) => set('expected_at', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Reference number</label>
            <input className={field} maxLength={255} value={d.reference} onChange={(e) => set('reference', e.target.value)} placeholder="Supplier invoice or tracking number" />
          </div>
          <div>
            <label className={labelCls}>Payment terms</label>
            <select className={field} value={d.terms} onChange={(e) => set('terms', e.target.value)}>
              {paymentTerms.map((t) => (<option key={t.v} value={t.v}>{t.t}</option>))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Supplier currency</label>
            <select className={field} value={d.currency} disabled={lockMoney} onChange={(e) => set('currency', e.target.value)}>
              {currencies.map((c) => (<option key={c.code} value={c.code}>{c.name}</option>))}
            </select>
          </div>
          {d.currency !== 'NGN' && (
            <div>
              <label className={labelCls}>1 {d.currency} = how many naira?</label>
              <input className={field} inputMode="decimal" disabled={lockMoney} value={d.exchange_rate} onChange={(e) => set('exchange_rate', e.target.value)} placeholder="1500" />
            </div>
          )}
          <div>
            <label className={labelCls}>Tax rate (%)</label>
            <input className={field} inputMode="decimal" value={d.tax_rate} onChange={(e) => set('tax_rate', e.target.value)} placeholder="0" />
          </div>
          <div className="sm:col-span-2">
            <Toggle on={d.tax_included} onChange={(v) => set('tax_included', v)} label="Supplier prices already include tax" hint="When off, tax is added on top of the total." />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Note to supplier</label>
            <textarea className={field} rows={3} maxLength={5000} value={d.note} onChange={(e) => set('note', e.target.value)} />
          </div>
        </div>
        {lockMoney && <p className="text-xs text-slate-500">Currency and exchange rate are locked because stock has already been received.</p>}
        <div className="flex gap-3">
          <button type="button" className={btn} onClick={apply}>Done</button>
          <button type="button" className={ghost} onClick={onClose}>Cancel</button>
        </div>
      </div>
    </Modal>
  );
}
