'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Plus, Search } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { PRODUCT_COLS, VARIANT_COLS, readProduct, readVariant } from '@/lib/products';
import { LOC_COLS, buildItems, fmtDate, readLevel, readLoc, type Item, type Loc } from '@/lib/inventory';
import { SUPPLIER_COLS, readSupplier, type Supplier } from '@/lib/purchaseOrders';
import { TRANSFER_COLS, daysOnRoad, inTransit, isLate, listToCsv, readTransfer, todayStr, transferError, trStatusLabel, type Transfer, type TransferStatus } from '@/lib/transfers';
import { Badge, ListSkeleton, btn, field, ghost, fetchAll, needsSql } from '@/components/products/ui';
import { Stat, downloadCsv } from '@/components/products/inventoryUi';
import TransferEditor from '@/components/products/TransferEditor';

type Agg = { quantity: number; received: number; rejected: number };
type PoRef = { id: string; number: number; supplier_name: string | null; status: string; destination_name: string | null };

export default function TransfersPage({ businessId }: { businessId: string }) {
  const sb = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [fatal, setFatal] = useState('');
  const [locs, setLocs] = useState<Loc[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [list, setList] = useState<Transfer[]>([]);
  const [aggs, setAggs] = useState<Record<string, Agg>>({});
  const [pos, setPos] = useState<PoRef[]>([]);
  const [bizName, setBizName] = useState('My shop');
  const [open, setOpen] = useState<string | 'new' | null>(null);

  const load = useCallback(async () => {
    const [l, p, v, lv, s, t, ti, po, b] = await Promise.all([
      sb.from('inventory_locations').select(LOC_COLS).eq('business_id', businessId).order('created_at', { ascending: true }),
      fetchAll<Record<string, unknown>>((a, z) => sb.from('products').select(PRODUCT_COLS).eq('business_id', businessId).order('created_at', { ascending: false }).range(a, z)),
      fetchAll<Record<string, unknown>>((a, z) => sb.from('product_variants').select(VARIANT_COLS).eq('business_id', businessId).order('position', { ascending: true }).range(a, z)),
      fetchAll<Record<string, unknown>>((a, z) => sb.from('inventory_levels').select('location_id,product_id,variant_id,on_hand').eq('business_id', businessId).range(a, z)),
      sb.from('suppliers').select(SUPPLIER_COLS).eq('business_id', businessId).order('name', { ascending: true }),
      fetchAll<Record<string, unknown>>((a, z) => sb.from('transfers').select(TRANSFER_COLS).eq('business_id', businessId).order('number', { ascending: false }).range(a, z)),
      fetchAll<Record<string, unknown>>((a, z) => sb.from('transfer_items').select('transfer_id,quantity,received,rejected').eq('business_id', businessId).range(a, z)),
      fetchAll<Record<string, unknown>>((a, z) => sb.from('purchase_orders').select('id,number,supplier_name,status,destination_name').eq('business_id', businessId).order('number', { ascending: false }).range(a, z)),
      sb.from('businesses').select('name').eq('id', businessId).maybeSingle(),
    ]);
    const msg = l.error?.message || p.error || v.error || lv.error || s.error?.message || t.error || ti.error;
    if (msg) {
      setFatal(needsSql(msg) ? transferError('does not exist') : msg);
      setLoading(false);
      return;
    }
    setFatal('');
    let locRows = ((l.data ?? []) as Record<string, unknown>[]).map(readLoc);
    if (locRows.length === 0) {
      await sb.rpc('xenon_default_location', { p_business: businessId });
      const again = await sb.from('inventory_locations').select(LOC_COLS).eq('business_id', businessId).order('created_at', { ascending: true });
      locRows = ((again.data ?? []) as Record<string, unknown>[]).map(readLoc);
    }
    setLocs(locRows);
    setItems(buildItems(p.data.map(readProduct), v.data.map(readVariant), lv.data.map(readLevel)));
    setSuppliers(((s.data ?? []) as Record<string, unknown>[]).map(readSupplier));
    setList(t.data.map(readTransfer));
    const am: Record<string, Agg> = {};
    for (const r of ti.data) {
      const a = (am[String(r.transfer_id)] ??= { quantity: 0, received: 0, rejected: 0 });
      a.quantity += Number(r.quantity ?? 0);
      a.received += Number(r.received ?? 0);
      a.rejected += Number(r.rejected ?? 0);
    }
    setAggs(am);
    // purchase orders are optional; a shop that has not run purchase-orders.sql just sees an empty list
    setPos(po.error ? [] : po.data.map((r) => ({ id: String(r.id), number: Number(r.number), supplier_name: typeof r.supplier_name === 'string' ? r.supplier_name : null, status: String(r.status), destination_name: typeof r.destination_name === 'string' ? r.destination_name : null })));
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
    return <TransferEditor key={open} businessId={businessId} businessName={bizName} transferId={open} locs={locs} items={items} suppliers={suppliers} pos={pos} onBack={() => { setOpen(null); load(); }} onChanged={load} />;
  }

  return <TransfersList list={list} aggs={aggs} onOpen={setOpen} />;
}

function TransfersList({ list, aggs, onOpen }: { list: Transfer[]; aggs: Record<string, Agg>; onOpen: (id: string | 'new') => void }) {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'' | TransferStatus | 'late'>('');
  const t = todayStr();

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase().replace(/^#/, '');
    return list.filter((x) => {
      if (status === 'late') { if (!isLate(x, t)) return false; }
      else if (status && x.status !== status) return false;
      if (!term) return true;
      return String(x.number).includes(term) || (x.origin_name ?? '').toLowerCase().includes(term) || (x.destination_name ?? '').toLowerCase().includes(term) || (x.reference ?? '').toLowerCase().includes(term) || (x.tracking ?? '').toLowerCase().includes(term) || x.tags.some((g) => g.toLowerCase().includes(term));
    });
  }, [list, q, status, t]);

  const onRoad = list.filter((x) => inTransit(x.status));
  const unitsOnRoad = onRoad.reduce((s, x) => { const a = aggs[x.id]; return s + (a ? Math.max(a.quantity - a.received - a.rejected, 0) : 0); }, 0);
  const lateCount = list.filter((x) => isLate(x, t)).length;
  const draftCount = list.filter((x) => x.status === 'draft').length;
  const units: Record<string, number> = Object.fromEntries(Object.entries(aggs).map(([k, v]) => [k, v.quantity]));

  if (list.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
        <h3 className="font-display text-lg font-bold text-slate-900">Move inventory between locations</h3>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">Move and track inventory between your business locations. Stock leaves the origin when you send it and arrives when you receive it, so nothing goes missing on the way.</p>
        <button type="button" className={`${btn} mt-5`} onClick={() => onOpen('new')}>Create transfer</button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="In transit" value={String(onRoad.length)} hint={`${unitsOnRoad.toLocaleString('en-NG')} units on the road`} onClick={() => setStatus(status === 'in_transit' ? '' : 'in_transit')} active={status === 'in_transit'} />
        <Stat label="Running late" value={String(lateCount)} onClick={() => setStatus(status === 'late' ? '' : 'late')} active={status === 'late'} />
        <Stat label="Drafts" value={String(draftCount)} onClick={() => setStatus(status === 'draft' ? '' : 'draft')} active={status === 'draft'} />
        <button type="button" className={`${btn} inline-flex items-center justify-center gap-1.5`} onClick={() => onOpen('new')}><Plus className="h-4 w-4" /> Create transfer</button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[12rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input className={`${field} pl-9`} placeholder="Search by number, location, reference, tracking or tag" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className={`${field} w-auto`} value={status} onChange={(e) => setStatus(e.target.value as typeof status)} aria-label="Status">
          <option value="">All statuses</option>
          {(Object.keys(trStatusLabel) as TransferStatus[]).map((s) => (<option key={s} value={s}>{trStatusLabel[s]}</option>))}
          <option value="late">Running late</option>
        </select>
        <button type="button" className={`${ghost} inline-flex items-center gap-1.5`} disabled={shown.length === 0} onClick={() => downloadCsv(`transfers-${t}.csv`, listToCsv(shown, units))}>
          <Download className="h-4 w-4" /> Export
        </button>
      </div>

      {shown.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 py-12 text-center text-sm text-slate-500">No transfers match.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr><th className="px-3 py-2.5">Transfer</th><th className="px-2 py-2.5">Origin</th><th className="px-2 py-2.5">Destination</th><th className="px-2 py-2.5">Status</th><th className="px-2 py-2.5">Received</th><th className="px-3 py-2.5">Expected</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {shown.map((x) => {
                const a = aggs[x.id] ?? { quantity: 0, received: 0, rejected: 0 };
                const days = daysOnRoad(x);
                return (
                  <tr key={x.id} className="cursor-pointer hover:bg-slate-50" onClick={() => onOpen(x.id)}>
                    <td className="px-3 py-3">
                      <button type="button" className="font-semibold text-blue-700 hover:underline" onClick={(e) => { e.stopPropagation(); onOpen(x.id); }}>#{x.number}</button>
                      <span className="block text-xs text-slate-400">{x.reference ?? x.tags.slice(0, 2).join(', ')}</span>
                    </td>
                    <td className="px-2 py-3 text-slate-800">{x.origin_name ?? 'Removed'}</td>
                    <td className="px-2 py-3 text-slate-800">{x.destination_name ?? 'Removed'}</td>
                    <td className="px-2 py-3">
                      <Badge tone={x.status === 'received' ? 'green' : x.status === 'cancelled' ? 'red' : x.status === 'draft' ? 'grey' : 'blue'}>{trStatusLabel[x.status]}</Badge>
                      {days !== null && <span className="ml-1 text-xs text-slate-400">{days}d</span>}
                    </td>
                    <td className="px-2 py-3 text-slate-600">{x.status === 'draft' ? `${a.quantity} to send` : `${a.received} of ${a.quantity}`}</td>
                    <td className={`px-3 py-3 ${isLate(x, t) ? 'font-medium text-red-600' : 'text-slate-600'}`}>{x.expected_at ? fmtDate(x.expected_at) : '—'}{isLate(x, t) ? ' · late' : ''}</td>
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
