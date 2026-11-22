'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Plus, Search } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { PRODUCT_COLS, VARIANT_COLS, readProduct, readVariant } from '@/lib/products';
import { LOC_COLS, buildItems, fmtDate, readLevel, readLoc, type Item, type Loc } from '@/lib/inventory';
import { Badge, Err, ListSkeleton, btn, card, field, ghost, fetchAll, needsSql } from '@/components/products/ui';
import { Stat, downloadCsv, today } from '@/components/products/inventoryUi';
import { SupplierModal } from '@/components/products/PoModals';
import PurchaseOrderEditor from '@/components/products/PurchaseOrderEditor';
import {
  PO_COLS, SUPPLIER_COLS, balanceOf, fmtMoney, isLate, isOpen, isPaymentOverdue, listToCsv, payLabel, payState, poError, poStatusLabel, progress, readPo, readSupplier, supplierStats, termsLabel,
  type PayState, type Po, type PoStatus, type Supplier,
} from '@/lib/purchaseOrders';

type Sub = 'orders' | 'suppliers';
type Agg = { quantity: number; received: number; rejected: number };

export default function PurchaseOrdersPage({ businessId }: { businessId: string }) {
  const sb = useMemo(() => createClient(), []);
  const [sub, setSub] = useState<Sub>('orders');
  const [loading, setLoading] = useState(true);
  const [fatal, setFatal] = useState('');
  const [locs, setLocs] = useState<Loc[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [pos, setPos] = useState<Po[]>([]);
  const [paid, setPaid] = useState<Record<string, number>>({});
  const [aggs, setAggs] = useState<Record<string, Agg>>({});
  const [bizName, setBizName] = useState('My shop');
  const [open, setOpen] = useState<string | 'new' | null>(null);

  const load = useCallback(async () => {
    const [l, p, v, lv, s, o, pay, it, b] = await Promise.all([
      sb.from('inventory_locations').select(LOC_COLS).eq('business_id', businessId).order('created_at', { ascending: true }),
      fetchAll<Record<string, unknown>>((a, z) => sb.from('products').select(PRODUCT_COLS).eq('business_id', businessId).order('created_at', { ascending: false }).range(a, z)),
      fetchAll<Record<string, unknown>>((a, z) => sb.from('product_variants').select(VARIANT_COLS).eq('business_id', businessId).order('position', { ascending: true }).range(a, z)),
      fetchAll<Record<string, unknown>>((a, z) => sb.from('inventory_levels').select('location_id,product_id,variant_id,on_hand').eq('business_id', businessId).range(a, z)),
      sb.from('suppliers').select(SUPPLIER_COLS).eq('business_id', businessId).order('name', { ascending: true }),
      fetchAll<Record<string, unknown>>((a, z) => sb.from('purchase_orders').select(PO_COLS).eq('business_id', businessId).order('number', { ascending: false }).range(a, z)),
      fetchAll<Record<string, unknown>>((a, z) => sb.from('purchase_order_payments').select('po_id,amount').eq('business_id', businessId).range(a, z)),
      fetchAll<Record<string, unknown>>((a, z) => sb.from('purchase_order_items').select('po_id,quantity,received,rejected').eq('business_id', businessId).range(a, z)),
      sb.from('businesses').select('name').eq('id', businessId).maybeSingle(),
    ]);
    const msg = l.error?.message || p.error || v.error || lv.error || s.error?.message || o.error || pay.error || it.error;
    if (msg) {
      setFatal(needsSql(msg) ? poError('does not exist') : msg);
      setLoading(false);
      return;
    }
    setFatal('');
    const locRows = ((l.data ?? []) as Record<string, unknown>[]).map(readLoc);
    if (locRows.length === 0) {
      // New shops get their first location on demand
      await sb.rpc('xenon_default_location', { p_business: businessId });
      const again = await sb.from('inventory_locations').select(LOC_COLS).eq('business_id', businessId).order('created_at', { ascending: true });
      setLocs(((again.data ?? []) as Record<string, unknown>[]).map(readLoc));
    } else setLocs(locRows);
    setItems(buildItems(p.data.map(readProduct), v.data.map(readVariant), lv.data.map(readLevel)));
    setSuppliers(((s.data ?? []) as Record<string, unknown>[]).map(readSupplier));
    setPos(o.data.map(readPo));
    const pm: Record<string, number> = {};
    for (const r of pay.data) pm[String(r.po_id)] = (pm[String(r.po_id)] ?? 0) + Number(r.amount ?? 0);
    setPaid(pm);
    const am: Record<string, Agg> = {};
    for (const r of it.data) {
      const k = String(r.po_id);
      const a = (am[k] ??= { quantity: 0, received: 0, rejected: 0 });
      a.quantity += Number(r.quantity ?? 0);
      a.received += Number(r.received ?? 0);
      a.rejected += Number(r.rejected ?? 0);
    }
    setAggs(am);
    const nm = (b.data as { name?: unknown } | null)?.name;
    if (typeof nm === 'string' && nm.trim()) setBizName(nm.trim());
    setLoading(false);
  }, [sb, businessId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <ListSkeleton rows={5} />;
  if (fatal) return <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">{fatal}</p>;

  if (open) {
    return (
      <PurchaseOrderEditor
        key={open}
        businessId={businessId}
        businessName={bizName}
        poId={open}
        locs={locs}
        items={items}
        suppliers={suppliers}
        onBack={() => { setOpen(null); load(); }}
        onChanged={load}
        onSuppliersChanged={(s) => setSuppliers((cur) => [...cur.filter((x) => x.id !== s.id), s].sort((a, b) => a.name.localeCompare(b.name)))}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <nav className="flex gap-2" aria-label="Purchase order sections">
          {(['orders', 'suppliers'] as Sub[]).map((s) => (
            <button key={s} type="button" onClick={() => setSub(s)} aria-current={sub === s ? 'page' : undefined} className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${sub === s ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              {s === 'orders' ? 'Orders' : 'Suppliers'}
            </button>
          ))}
        </nav>
        {sub === 'orders' && pos.length > 0 && (
          <button type="button" className={`${btn} ml-auto inline-flex items-center gap-1.5`} onClick={() => setOpen('new')}>
            <Plus className="h-4 w-4" /> Create purchase order
          </button>
        )}
      </div>
      {sub === 'orders' ? (
        <OrdersList pos={pos} suppliers={suppliers} paid={paid} aggs={aggs} onOpen={setOpen} />
      ) : (
        <SuppliersList businessId={businessId} suppliers={suppliers} pos={pos} paid={paid} onChanged={load} />
      )}
    </div>
  );
}

function OrdersList({ pos, suppliers, paid, aggs, onOpen }: { pos: Po[]; suppliers: Supplier[]; paid: Record<string, number>; aggs: Record<string, Agg>; onOpen: (id: string | 'new') => void }) {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'' | PoStatus | 'late' | 'unpaid'>('');
  const [sup, setSup] = useState('');
  const t = today();

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase().replace(/^#/, '');
    return pos.filter((p) => {
      if (sup && p.supplier_id !== sup) return false;
      if (status === 'late') { if (!isLate(p, t)) return false; }
      else if (status === 'unpaid') { if (['draft', 'cancelled'].includes(p.status) || balanceOf(p.total, paid[p.id] ?? 0) <= 0) return false; }
      else if (status && p.status !== status) return false;
      if (!term) return true;
      return String(p.number).includes(term) || (p.supplier_name ?? '').toLowerCase().includes(term) || (p.reference ?? '').toLowerCase().includes(term) || p.tags.some((x) => x.toLowerCase().includes(term));
    });
  }, [pos, q, status, sup, paid, t]);

  const openCount = pos.filter((p) => isOpen(p.status)).length;
  const lateCount = pos.filter((p) => isLate(p, t)).length;
  const owed = Math.round(pos.filter((p) => !['draft', 'cancelled'].includes(p.status)).reduce((s, p) => s + balanceOf(p.total, paid[p.id] ?? 0) * p.exchange_rate, 0));
  const onWay = Math.round(pos.filter((p) => isOpen(p.status)).reduce((s, p) => s + p.total * p.exchange_rate, 0));

  if (pos.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
        <h3 className="font-display text-lg font-bold text-slate-900">Manage your purchase orders</h3>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">Track and receive inventory ordered from suppliers. Receiving an order adds the stock for you and keeps your costs up to date.</p>
        <button type="button" className={`${btn} mt-5`} onClick={() => onOpen('new')}>Create purchase order</button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Open orders" value={String(openCount)} onClick={() => setStatus(status === 'ordered' ? '' : 'ordered')} active={status === 'ordered'} />
        <Stat label="Running late" value={String(lateCount)} onClick={() => setStatus(status === 'late' ? '' : 'late')} active={status === 'late'} />
        <Stat label="On the way (₦)" value={fmtMoney(onWay)} hint="Value of open orders" />
        <Stat label="You owe suppliers" value={fmtMoney(owed)} onClick={() => setStatus(status === 'unpaid' ? '' : 'unpaid')} active={status === 'unpaid'} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[12rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input className={`${field} pl-9`} placeholder="Search by number, supplier, reference or tag" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className={`${field} w-auto`} value={status} onChange={(e) => setStatus(e.target.value as typeof status)} aria-label="Status">
          <option value="">All statuses</option>
          {(Object.keys(poStatusLabel) as PoStatus[]).map((s) => (<option key={s} value={s}>{poStatusLabel[s]}</option>))}
          <option value="late">Running late</option>
          <option value="unpaid">Unpaid</option>
        </select>
        <select className={`${field} w-auto`} value={sup} onChange={(e) => setSup(e.target.value)} aria-label="Supplier">
          <option value="">All suppliers</option>
          {suppliers.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
        </select>
        <button type="button" className={`${ghost} inline-flex items-center gap-1.5`} disabled={shown.length === 0} onClick={() => downloadCsv(`purchase-orders-${t}.csv`, listToCsv(shown, paid))}>
          <Download className="h-4 w-4" /> Export
        </button>
      </div>

      {shown.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 py-12 text-center text-sm text-slate-500">No purchase orders match.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2.5">PO</th>
                <th className="px-2 py-2.5">Supplier</th>
                <th className="px-2 py-2.5">Status</th>
                <th className="px-2 py-2.5">Payment</th>
                <th className="px-2 py-2.5">Received</th>
                <th className="px-2 py-2.5">Expected</th>
                <th className="px-3 py-2.5 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {shown.map((p) => {
                const a = aggs[p.id] ?? { quantity: 0, received: 0, rejected: 0 };
                const pr = progress([a]);
                const ps: PayState = payState(p.total, paid[p.id] ?? 0);
                const showPay = !['draft', 'cancelled'].includes(p.status) && ps !== 'none';
                return (
                  <tr key={p.id} className="cursor-pointer hover:bg-slate-50" onClick={() => onOpen(p.id)}>
                    <td className="px-3 py-3">
                      <button type="button" className="font-semibold text-blue-700 hover:underline" onClick={(e) => { e.stopPropagation(); onOpen(p.id); }}>#{p.number}</button>
                      {p.tags.length > 0 && <span className="block text-xs text-slate-400">{p.tags.slice(0, 2).join(', ')}</span>}
                    </td>
                    <td className="px-2 py-3 text-slate-800">{p.supplier_name ?? 'Removed supplier'}<span className="block text-xs text-slate-400">{p.destination_name ?? ''}</span></td>
                    <td className="px-2 py-3"><Badge tone={p.status === 'received' ? 'green' : p.status === 'cancelled' ? 'red' : p.status === 'draft' || p.status === 'closed' ? 'grey' : 'blue'}>{poStatusLabel[p.status]}</Badge></td>
                    <td className="px-2 py-3">{showPay ? <Badge tone={ps === 'paid' ? 'green' : ps === 'partial' ? 'amber' : 'grey'}>{payLabel[ps]}</Badge> : <span className="text-slate-300">—</span>}{isPaymentOverdue(p, paid[p.id] ?? 0, t) && <span className="ml-1 text-xs font-medium text-red-600">overdue</span>}</td>
                    <td className="px-2 py-3 text-slate-600">{p.status === 'draft' ? '—' : `${pr.received} of ${pr.ordered}`}</td>
                    <td className={`px-2 py-3 ${isLate(p, t) ? 'font-medium text-red-600' : 'text-slate-600'}`}>{p.expected_at ? fmtDate(p.expected_at) : '—'}{isLate(p, t) ? ' · late' : ''}</td>
                    <td className="px-3 py-3 text-right font-medium text-slate-900">{fmtMoney(p.total, p.currency)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SuppliersList({ businessId, suppliers, pos, paid, onChanged }: { businessId: string; suppliers: Supplier[]; pos: Po[]; paid: Record<string, number>; onChanged: () => void }) {
  const sb = useMemo(() => createClient(), []);
  const [editing, setEditing] = useState<Supplier | 'new' | null>(null);
  const [showOff, setShowOff] = useState(false);
  const [err, setErr] = useState('');
  const list = suppliers.filter((s) => showOff || s.active);

  async function remove(s: Supplier) {
    const used = pos.some((p) => p.supplier_id === s.id);
    if (!window.confirm(used ? `"${s.name}" has purchase orders. Their history stays, but the supplier will be deleted. Continue?` : `Delete the supplier "${s.name}"?`)) return;
    const { error } = await sb.from('suppliers').delete().eq('id', s.id).eq('business_id', businessId);
    if (error) return setErr(poError(error.message));
    onChanged();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <p className="min-w-0 flex-1 text-sm text-slate-500">The people and companies you buy stock from. Their currency, payment terms and delivery time fill in automatically on new orders.</p>
        <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={showOff} onChange={(e) => setShowOff(e.target.checked)} /> Show inactive</label>
        <button type="button" className={`${btn} inline-flex items-center gap-1.5`} onClick={() => setEditing('new')}><Plus className="h-4 w-4" /> Add supplier</button>
      </div>
      <Err text={err} />
      {list.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 py-12 text-center text-sm text-slate-500">No suppliers yet. Add one, then create a purchase order for them.</p>
      ) : (
        <ul className="space-y-3">
          {list.map((s) => {
            const st = supplierStats(s.id, pos, paid);
            return (
              <li key={s.id} className={`${card} ${s.active ? '' : 'opacity-70'}`}>
                <div className="flex flex-wrap items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-display font-bold text-slate-900">{s.name}</p>
                      {!s.active && <Badge tone="grey">Inactive</Badge>}
                      {s.currency !== 'NGN' && <Badge tone="blue">{s.currency}</Badge>}
                    </div>
                    <p className="mt-0.5 text-sm text-slate-500">{[s.contact_name, s.phone, s.email].filter(Boolean).join(' · ') || 'No contact details'}</p>
                    <p className="mt-1 text-sm text-slate-600">
                      {st.orders} order{st.orders === 1 ? '' : 's'} · {fmtMoney(st.spendNgn)} ordered · {st.owedNgn > 0 ? <span className="font-medium text-amber-700">{fmtMoney(st.owedNgn)} owed</span> : 'nothing owed'}
                      {s.payment_terms ? ` · ${termsLabel(s.payment_terms)}` : ''}{s.lead_time_days ? ` · ${s.lead_time_days} day delivery` : ''}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className={ghost} onClick={() => setEditing(s)}>Edit</button>
                    <button type="button" className="rounded-xl border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50" onClick={() => remove(s)}>Delete</button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {editing && <SupplierModal businessId={businessId} supplier={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); onChanged(); }} />}
    </div>
  );
}
