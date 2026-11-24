'use client';

import { useMemo, useState } from 'react';
import { Download, Printer, Search } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import {
  PAY_STATUSES, STATUSES, allTags, emptyFilter, filterOrders, naira, needsAttention, orderError, orderStats, ordersToCsv, payLabel, payTone, printOrdersHtml, sourceLabel, statusLabel, statusTone,
  type Order, type OrderFilter, type OrderStatus,
} from '@/lib/orders';
import OrderDetail from './OrderDetail';
import { Empty, Err, Modal, Ok, Pill, Stat, btn, card, download, field, fmtDate, ghost, openPrint, small } from './ui';

type Bank = { bank_name: string; account_number: string; account_name: string };

export default function AllOrders({
  orders, businessId, storeName, bank, doubleOptIn, onReload, onCreate, onDuplicate,
}: { orders: Order[]; businessId: string; storeName: string; bank: Bank; doubleOptIn: boolean; onReload: () => Promise<void> | void; onCreate: () => void; onDuplicate: (o: Order) => void }) {
  const sb = useMemo(() => createClient(), []);
  const [f, setF] = useState<OrderFilter>(emptyFilter);
  const [more, setMore] = useState(false);
  const [sel, setSel] = useState<Record<string, boolean>>({});
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [bulkTag, setBulkTag] = useState(false);
  const [tagText, setTagText] = useState('');

  const now = Date.now();
  const stats = useMemo(() => orderStats(orders, now), [orders]); // eslint-disable-line react-hooks/exhaustive-deps
  const tags = useMemo(() => allTags(orders), [orders]);
  const sources = useMemo(() => [...new Set(orders.map((o) => o.source))], [orders]);
  const shown = useMemo(() => filterOrders(orders, f, now), [orders, f]); // eslint-disable-line react-hooks/exhaustive-deps
  const picked = shown.filter((o) => sel[o.id]);
  const counts = (s: OrderStatus) => orders.filter((o) => o.status === s && !o.archived).length;
  const current = open ? orders.find((o) => o.id === open) ?? null : null;

  function toggleAll(v: boolean) {
    const m: Record<string, boolean> = {};
    if (v) for (const o of shown) m[o.id] = true;
    setSel(m);
  }

  async function bulkStatus(status: OrderStatus) {
    setErr(''); setMsg(''); setBusy(true);
    let done = 0; let failed = '';
    for (const o of picked) {
      if (o.status === status) continue;
      const { error } = await sb.rpc('xenon_set_order_status', { p_order: o.id, p_status: status, p_reason: status === 'cancelled' ? 'Cancelled in bulk' : null });
      if (error) { failed = orderError(error.message); break; }
      done++;
    }
    setBusy(false);
    setSel({});
    await onReload();
    if (failed) setErr(`${done} updated, then stopped: ${failed}`);
    else setMsg(`${done} order${done === 1 ? '' : 's'} marked as ${statusLabel[status].toLowerCase()}.`);
  }

  async function bulkAddTag() {
    const t = tagText.trim().slice(0, 40);
    if (!t) return;
    setBusy(true); setErr('');
    for (const o of picked) {
      if (o.tags.includes(t)) continue;
      const { error } = await sb.from('orders').update({ tags: [...o.tags, t].slice(0, 20) }).eq('id', o.id);
      if (error) { setErr(orderError(error.message)); break; }
    }
    setBusy(false); setBulkTag(false); setTagText(''); setSel({});
    await onReload();
    setMsg(`Tag "${t}" added.`);
  }

  const print = (kind: 'invoice' | 'packing') => {
    if (!openPrint(printOrdersHtml(picked, storeName, kind))) setErr('Allow pop-ups to print.');
  };

  if (orders.length === 0) {
    return <Empty title="Your orders will show here" body="This is where you'll fulfill orders, collect payments, and track order progress." action={<button className={btn} onClick={onCreate}>Create order</button>} />;
  }

  const chip = (active: boolean) => `rounded-full px-3.5 py-1.5 text-xs font-semibold ${active ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Open orders" value={stats.open} />
        <Stat label="Orders today" value={stats.today} />
        <Stat label="Money received" value={naira(stats.revenue)} tone="text-green-700" />
        <Stat label="Still owed to you" value={naira(stats.owed)} tone={stats.owed > 0 ? 'text-orange-600' : ''} />
      </div>

      {stats.attention > 0 && (
        <button onClick={() => setF({ ...emptyFilter, attention: !f.attention })} className={`w-full rounded-xl px-4 py-3 text-left text-sm ${f.attention ? 'bg-amber-200 text-amber-950' : 'bg-amber-50 text-amber-900 hover:bg-amber-100'}`}>
          ⚠ <b>{stats.attention}</b> order{stats.attention === 1 ? '' : 's'} need{stats.attention === 1 ? 's' : ''} you — {f.attention ? 'showing them now. Tap to show all.' : 'unanswered for a day, waiting on a customer request, or delivered but unpaid. Tap to see.'}
        </button>
      )}

      <Err>{err}</Err>
      <Ok>{msg}</Ok>

      <div className="flex flex-wrap items-center gap-2">
        <button className={chip(f.status === 'all')} onClick={() => setF({ ...f, status: 'all' })}>All</button>
        {STATUSES.map((s) => <button key={s} className={chip(f.status === s)} onClick={() => setF({ ...f, status: s })}>{statusLabel[s]} ({counts(s)})</button>)}
        <button className={chip(f.pay === 'unpaid')} onClick={() => setF({ ...f, pay: f.pay === 'unpaid' ? 'all' : 'unpaid' })}>Unpaid</button>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search size={16} className="pointer-events-none absolute left-3.5 top-3 text-slate-400" />
          <input className={`${field} pl-10`} placeholder="Search order number, name, phone, item, tag…" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} />
        </div>
        <button className={ghost} onClick={() => setMore(!more)}>Filters{(f.source || f.tag || f.from || f.to || (f.pay !== 'all' && f.pay !== 'unpaid')) ? ' •' : ''}</button>
        <button className={ghost} onClick={() => download(`orders-${new Date().toISOString().slice(0, 10)}.csv`, ordersToCsv(picked.length ? picked : shown))}><Download size={15} /> Export{picked.length ? ` (${picked.length})` : ''}</button>
      </div>

      {more && (
        <div className={`${card} grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4`}>
          <label className="text-xs text-slate-500">Payment
            <select className={`${field} mt-1`} value={f.pay} onChange={(e) => setF({ ...f, pay: e.target.value as OrderFilter['pay'] })}>
              <option value="all">Any</option><option value="unpaid">Unpaid (owes money)</option>
              {PAY_STATUSES.map((p) => <option key={p} value={p}>{payLabel[p]}</option>)}
            </select>
          </label>
          <label className="text-xs text-slate-500">Where it came from
            <select className={`${field} mt-1`} value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })}>
              <option value="">Anywhere</option>{sources.map((s) => <option key={s} value={s}>{sourceLabel(s)}</option>)}
            </select>
          </label>
          <label className="text-xs text-slate-500">Tag
            <select className={`${field} mt-1`} value={f.tag} onChange={(e) => setF({ ...f, tag: e.target.value })}>
              <option value="">Any tag</option>{tags.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-slate-500">From<input type="date" className={`${field} mt-1`} value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></label>
            <label className="text-xs text-slate-500">To<input type="date" className={`${field} mt-1`} value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></label>
          </div>
          <button className={`${small} w-fit`} onClick={() => setF(emptyFilter)}>Clear all filters</button>
        </div>
      )}

      {picked.length > 0 && (
        <div className="sticky top-2 z-20 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-md">
          <b className="text-sm">{picked.length} selected</b>
          <button className={small} disabled={busy} onClick={() => bulkStatus('preparing')}>Mark preparing</button>
          <button className={small} disabled={busy} onClick={() => bulkStatus('delivered')}>Mark delivered</button>
          <button className={small} disabled={busy} onClick={() => bulkStatus('cancelled')}>Cancel</button>
          <button className={small} disabled={busy} onClick={() => setBulkTag(true)}>Add tag</button>
          <button className={small} onClick={() => print('packing')}><Printer size={13} /> Packing slips</button>
          <button className={small} onClick={() => print('invoice')}><Printer size={13} /> Invoices</button>
          <button className="ml-auto text-xs font-semibold text-slate-500 underline" onClick={() => setSel({})}>Clear</button>
        </div>
      )}

      {shown.length === 0 ? (
        <div className={`${card} p-10 text-center text-sm text-slate-500`}>No orders match. <button className="font-semibold text-blue-700 underline" onClick={() => setF(emptyFilter)}>Clear filters</button></div>
      ) : (
        <div className={`${card} divide-y divide-slate-100 overflow-hidden`}>
          <label className="flex items-center gap-3 bg-slate-50 px-4 py-2 text-xs font-medium text-slate-500">
            <input type="checkbox" checked={picked.length === shown.length && shown.length > 0} onChange={(e) => toggleAll(e.target.checked)} /> Select all {shown.length}
          </label>
          {shown.map((o) => {
            const attn = needsAttention(o, now);
            return (
              <div key={o.id} className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50">
                <input type="checkbox" className="mt-1.5" checked={!!sel[o.id]} onChange={(e) => setSel({ ...sel, [o.id]: e.target.checked })} aria-label={`Select order ${o.order_number}`} />
                <button className="min-w-0 flex-1 text-left" onClick={() => setOpen(o.id)}>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="font-bold">#{o.order_number}</span>
                    <span className="truncate font-medium">{o.customer_name}</span>
                    <Pill tone={statusTone[o.status]}>{statusLabel[o.status]}</Pill>
                    <Pill tone={payTone[o.payment_status]}>{payLabel[o.payment_status]}</Pill>
                    {o.request_type && <Pill tone="bg-amber-100 text-amber-800">{o.request_type === 'cancel' ? 'Wants to cancel' : 'Wants to return'}</Pill>}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-slate-500">
                    {fmtDate(o.created_at)} · {o.items.reduce((a, i) => a + i.quantity, 0)} item{o.items.reduce((a, i) => a + i.quantity, 0) === 1 ? '' : 's'}: {o.items.map((i) => i.name).join(', ')}
                  </p>
                  {(o.tags.length > 0 || attn) && (
                    <p className="mt-1 flex flex-wrap gap-1.5 text-[11px]">
                      {attn && <span className="text-amber-700">⚠ {attn}</span>}
                      {o.tags.map((t) => <span key={t} className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-600">{t}</span>)}
                    </p>
                  )}
                </button>
                <span className="shrink-0 text-right text-sm font-semibold">{naira(o.total)}</span>
              </div>
            );
          })}
        </div>
      )}

      {current && (
        <OrderDetail key={current.id} order={current} businessId={businessId} storeName={storeName} bank={bank} doubleOptIn={doubleOptIn} onClose={() => setOpen(null)}
          onChanged={() => { void onReload(); }} onDuplicate={(o) => { setOpen(null); onDuplicate(o); }} />
      )}
      {bulkTag && (
        <Modal title="Add a tag" onClose={() => setBulkTag(false)} footer={<><button className={ghost} onClick={() => setBulkTag(false)}>Cancel</button><button className={btn} disabled={!tagText.trim() || busy} onClick={bulkAddTag}>Add to {picked.length}</button></>}>
          <input autoFocus className={field} placeholder="e.g. wholesale" value={tagText} maxLength={40} onChange={(e) => setTagText(e.target.value)} />
        </Modal>
      )}
    </div>
  );
}
