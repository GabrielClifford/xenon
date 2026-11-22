'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Download, Search, Upload } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { inventoryToCsv, itemLabel, qtyAt, qtyIn, reorderGroups, stateOf, summarize, inventoryError, type Item, type Loc, type State } from '@/lib/inventory';
import { naira } from '@/lib/products';
import { Badge, Err, btn, field, ghost } from '@/components/products/ui';
import { StateBadge, Stat, Thumb, downloadCsv, today } from '@/components/products/inventoryUi';
import { AdjustModal, ImportCountsModal, ReorderModal, StocktakeModal } from '@/components/products/StockModals';

type StateFilter = 'all' | 'attention' | 'low' | 'out' | 'ok' | 'untracked';
type SortKey = 'name' | 'qty_asc' | 'qty_desc' | 'value_desc';
const PAGE = 50;

export default function StockView({ businessId, locs, items, onChanged }: { businessId: string; locs: Loc[]; items: Item[]; onChanged: () => void }) {
  const sb = useMemo(() => createClient(), []);
  const [loc, setLoc] = useState('all');
  const [q, setQ] = useState('');
  const [state, setState] = useState<StateFilter>('all');
  const [vendor, setVendor] = useState('');
  const [category, setCategory] = useState('');
  const [sort, setSort] = useState<SortKey>('name');
  const [limit, setLimit] = useState(PAGE);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [edit, setEdit] = useState<{ key: string; loc: string } | null>(null);
  const [editVal, setEditVal] = useState('');
  const skipBlur = useRef(false);
  const [busyKey, setBusyKey] = useState('');
  const [err, setErr] = useState('');
  const [notice, setNotice] = useState('');
  const [modal, setModal] = useState<null | { type: 'adjust'; items: Item[] } | { type: 'count' } | { type: 'import' } | { type: 'reorder' }>(null);

  // If the chosen location is turned off or removed, go back to all locations.
  useEffect(() => {
    if (loc !== 'all' && !locs.some((l) => l.id === loc)) setLoc('all');
  }, [loc, locs]);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(''), 6000);
    return () => clearTimeout(t);
  }, [notice]);

  const scope = useMemo(() => (loc === 'all' ? locs.map((l) => l.id) : [loc]), [loc, locs]);
  const cols = loc === 'all' ? locs : locs.filter((l) => l.id === loc);

  const vendors = useMemo(() => Array.from(new Set(items.map((i) => i.vendor?.trim() ?? '').filter(Boolean))).sort(), [items]);
  const categories = useMemo(() => Array.from(new Set(items.map((i) => i.category?.trim() ?? '').filter(Boolean))).sort(), [items]);

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = items
      .map((i) => {
        const qty = qtyIn(i, scope);
        return { i, qty, st: stateOf(i, qty), value: i.cost === null ? 0 : qty * i.cost };
      })
      .filter((r) => {
        if (term && !`${itemLabel(r.i)} ${r.i.sku ?? ''} ${r.i.barcode ?? ''} ${r.i.vendor ?? ''}`.toLowerCase().includes(term)) return false;
        if (vendor && (r.i.vendor?.trim() ?? '') !== vendor) return false;
        if (category && (r.i.category?.trim() ?? '') !== category) return false;
        if (state === 'attention') return r.st === 'low' || r.st === 'out';
        if (state !== 'all') return r.st === state;
        return true;
      });
    if (sort === 'qty_asc') list.sort((a, b) => a.qty - b.qty);
    else if (sort === 'qty_desc') list.sort((a, b) => b.qty - a.qty);
    else if (sort === 'value_desc') list.sort((a, b) => b.value - a.value);
    else list.sort((a, b) => itemLabel(a.i).localeCompare(itemLabel(b.i)));
    return list;
  }, [items, scope, q, state, vendor, category, sort]);

  useEffect(() => setLimit(PAGE), [q, state, vendor, category, sort, loc]);

  const sum = useMemo(() => summarize(items, scope), [items, scope]);
  const needing = useMemo(() => reorderGroups(items, scope).reduce((s, g) => s + g.rows.length, 0), [items, scope]);
  const shown = rows.slice(0, limit);
  const allShown = shown.length > 0 && shown.every((r) => picked.has(r.i.key));
  const chosen = items.filter((i) => picked.has(i.key));
  const defaultLoc = loc !== 'all' ? loc : (locs.find((l) => l.is_default) ?? locs[0])?.id ?? '';

  function toggleAll() {
    setPicked((p) => {
      const n = new Set(p);
      if (allShown) for (const r of shown) n.delete(r.i.key);
      else for (const r of shown) n.add(r.i.key);
      return n;
    });
  }

  async function saveCell(item: Item, locationId: string) {
    setErr('');
    if (!/^\d{1,9}$/.test(editVal.trim())) return setErr('Enter a whole number, zero or more.');
    const next = Number(editVal.trim());
    if (next === qtyAt(item, locationId)) {
      setEdit(null);
      return;
    }
    setBusyKey(`${item.key}|${locationId}`);
    const { error } = await sb.rpc('xenon_set_inventory_batch', { p_location: locationId, p_items: [{ product_id: item.productId, variant_id: item.variantId, qty: next }], p_reason: 'correction', p_note: null });
    setBusyKey('');
    if (error) return setErr(inventoryError(error.message));
    setEdit(null);
    onChanged();
  }

  async function startTracking(item: Item) {
    setErr('');
    setBusyKey(item.key);
    const { error } = await sb.from('products').update({ track_stock: true }).eq('id', item.productId).eq('business_id', businessId);
    setBusyKey('');
    if (error) return setErr(error.message);
    setNotice(`Now tracking stock for ${item.name}.`);
    onChanged();
  }

  function done(msg: string) {
    setModal(null);
    setPicked(new Set());
    setNotice(msg);
    onChanged();
  }

  const exportRows = (picked.size ? chosen : rows.map((r) => r.i)).filter(Boolean);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <Stat label="Stock value (cost)" value={naira(sum.costValue)} hint={sum.missingCost ? `${sum.missingCost} item${sum.missingCost === 1 ? '' : 's'} have no cost set` : undefined} />
        <Stat label="Retail value" value={naira(sum.retailValue)} />
        <Stat label="Potential profit" value={naira(sum.profit)} />
        <Stat label="Units on hand" value={sum.units.toLocaleString('en-NG')} hint={`${sum.items} item${sum.items === 1 ? '' : 's'}`} />
        <Stat label="Low stock" value={String(sum.low)} onClick={() => setState(state === 'low' ? 'all' : 'low')} active={state === 'low'} />
        <Stat label="Out of stock" value={String(sum.out)} onClick={() => setState(state === 'out' ? 'all' : 'out')} active={state === 'out'} />
      </div>

      {notice && <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">{notice}</p>}
      <Err text={err} />

      <div className="flex flex-wrap items-center gap-2">
        {[{ id: 'all', name: 'All locations' }, ...locs].map((l) => (
          <button key={l.id} type="button" onClick={() => setLoc(l.id)} className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${loc === l.id ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'}`}>
            {l.name}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[12rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input className={`${field} pl-9`} placeholder="Search name, SKU, barcode or vendor" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className={`${field} w-auto`} value={state} onChange={(e) => setState(e.target.value as StateFilter)} aria-label="Filter by stock level">
          <option value="all">All items</option>
          <option value="attention">Low or out</option>
          <option value="low">Low stock</option>
          <option value="out">Out of stock</option>
          <option value="ok">In stock</option>
          <option value="untracked">Not tracked</option>
        </select>
        {vendors.length > 0 && (
          <select className={`${field} w-auto`} value={vendor} onChange={(e) => setVendor(e.target.value)} aria-label="Filter by vendor">
            <option value="">All vendors</option>
            {vendors.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        )}
        {categories.length > 0 && (
          <select className={`${field} w-auto`} value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Filter by category">
            <option value="">All categories</option>
            {categories.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        )}
        <select className={`${field} w-auto`} value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="Sort">
          <option value="name">Name</option>
          <option value="qty_asc">Stock, lowest first</option>
          <option value="qty_desc">Stock, highest first</option>
          <option value="value_desc">Value, highest first</option>
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={btn} onClick={() => setModal({ type: 'count' })} disabled={locs.length === 0 || items.length === 0}>
          Count stock
        </button>
        <button type="button" className={ghost} onClick={() => setModal({ type: 'reorder' })}>
          Reorder report{needing > 0 ? ` (${needing})` : ''}
        </button>
        <button type="button" className={`${ghost} inline-flex items-center gap-1.5`} onClick={() => setModal({ type: 'import' })} disabled={items.length === 0}>
          <Upload className="h-4 w-4" /> Import counts
        </button>
        <button type="button" className={`${ghost} inline-flex items-center gap-1.5`} onClick={() => downloadCsv(`inventory-${today()}.csv`, inventoryToCsv(exportRows, locs))} disabled={exportRows.length === 0}>
          <Download className="h-4 w-4" /> Export {picked.size ? 'selected' : 'list'}
        </button>
      </div>

      {picked.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl bg-blue-50 px-4 py-2.5">
          <p className="text-sm font-medium text-blue-900">{picked.size} selected</p>
          <button type="button" className="text-sm font-semibold text-blue-700 hover:underline" onClick={() => setModal({ type: 'adjust', items: chosen })}>
            Adjust stock
          </button>
          <button type="button" className="text-sm text-slate-600 hover:underline" onClick={() => setPicked(new Set())}>
            Clear
          </button>
        </div>
      )}

      {items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 py-12 text-center text-sm text-slate-500">Add products first, then manage their stock here.</p>
      ) : rows.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-500">No items match these filters.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="w-10 px-3 py-2.5">
                  <input type="checkbox" checked={allShown} onChange={toggleAll} aria-label="Select all shown" />
                </th>
                <th className="px-2 py-2.5">Item</th>
                <th className="px-2 py-2.5">Status</th>
                {cols.map((l) => (
                  <th key={l.id} className="px-2 py-2.5 text-right">
                    {l.name}
                  </th>
                ))}
                {cols.length > 1 && <th className="px-2 py-2.5 text-right">Total</th>}
                <th className="hidden px-2 py-2.5 text-right md:table-cell">Value</th>
                <th className="w-16 px-2 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {shown.map(({ i, qty, st, value }) => (
                <tr key={i.key} className={picked.has(i.key) ? 'bg-blue-50/50' : ''}>
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={picked.has(i.key)}
                      onChange={() =>
                        setPicked((p) => {
                          const n = new Set(p);
                          if (n.has(i.key)) n.delete(i.key);
                          else n.add(i.key);
                          return n;
                        })
                      }
                      aria-label={`Select ${itemLabel(i)}`}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <span className="flex items-center gap-3">
                      <Thumb url={i.cover} />
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-slate-900">
                          {i.name}
                          {i.variantTitle && <span className="font-normal text-slate-500"> / {i.variantTitle}</span>}
                        </span>
                        <span className="block truncate text-xs text-slate-400">
                          {i.sku ? `SKU ${i.sku}` : 'No SKU'}
                          {i.status !== 'active' && <span className="ml-2 uppercase">{i.status}</span>}
                        </span>
                      </span>
                    </span>
                  </td>
                  <td className="px-2 py-2">
                    {st === 'untracked' ? (
                      <button type="button" disabled={busyKey === i.key} onClick={() => startTracking(i)} className="group" title="Start tracking stock for this product">
                        <Badge tone="grey">Not tracked</Badge>
                        <span className="ml-1 hidden text-xs text-blue-600 group-hover:inline">Track</span>
                      </button>
                    ) : (
                      <StateBadge state={st as State} />
                    )}
                  </td>
                  {cols.map((l) => {
                    const editing = edit?.key === i.key && edit.loc === l.id;
                    const n = qtyAt(i, l.id);
                    return (
                      <td key={l.id} className="px-2 py-2 text-right">
                        {editing ? (
                          <input
                            autoFocus
                            className="w-20 rounded-lg border border-blue-600 px-2 py-1 text-right text-sm outline-none"
                            inputMode="numeric"
                            value={editVal}
                            disabled={busyKey === `${i.key}|${l.id}`}
                            onChange={(e) => setEditVal(e.target.value.replace(/\D/g, ''))}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                skipBlur.current = true;
                                saveCell(i, l.id);
                              }
                              if (e.key === 'Escape') {
                                skipBlur.current = true;
                                setEdit(null);
                              }
                            }}
                            onBlur={() => {
                              if (skipBlur.current) {
                                skipBlur.current = false;
                                return;
                              }
                              saveCell(i, l.id);
                            }}
                            aria-label={`Quantity of ${itemLabel(i)} at ${l.name}`}
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setErr('');
                              skipBlur.current = false;
                              setEdit({ key: i.key, loc: l.id });
                              setEditVal(String(n));
                            }}
                            className={`min-w-[3rem] rounded-lg px-2 py-1 text-right hover:bg-slate-100 ${n === 0 && i.track ? 'font-semibold text-red-600' : 'text-slate-800'}`}
                            title="Click to change the quantity"
                          >
                            {n}
                          </button>
                        )}
                      </td>
                    );
                  })}
                  {cols.length > 1 && <td className="px-2 py-2 text-right font-semibold text-slate-900">{qty}</td>}
                  <td className="hidden px-2 py-2 text-right text-slate-500 md:table-cell">{i.cost === null ? '—' : naira(value)}</td>
                  <td className="px-2 py-2 text-right">
                    <button type="button" className="text-sm font-medium text-blue-600 hover:underline" onClick={() => setModal({ type: 'adjust', items: [i] })}>
                      Adjust
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {rows.length > shown.length && (
        <div className="text-center">
          <button type="button" className={ghost} onClick={() => setLimit((n) => n + PAGE)}>
            Show more ({rows.length - shown.length} left)
          </button>
        </div>
      )}
      <p className="text-xs text-slate-400">
        Stock at locations that are on and sell online is what your website can sell. Click a number to change it. Every change is saved in History.
      </p>

      {modal?.type === 'adjust' && <AdjustModal items={modal.items} locs={locs} initialLoc={defaultLoc} onClose={() => setModal(null)} onDone={done} />}
      {modal?.type === 'count' && <StocktakeModal items={rows.map((r) => r.i)} locs={locs} initialLoc={defaultLoc} onClose={() => setModal(null)} onDone={done} />}
      {modal?.type === 'import' && <ImportCountsModal items={items} locs={locs} initialLoc={defaultLoc} onClose={() => setModal(null)} onDone={done} />}
      {modal?.type === 'reorder' && <ReorderModal items={items} locIds={scope} onClose={() => setModal(null)} />}
    </div>
  );
}
