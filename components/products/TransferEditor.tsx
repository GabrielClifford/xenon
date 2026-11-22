'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Download, Pencil, Plus, Search, Truck, Upload, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { MOVE_COLS, fmtDate, itemLabel, qtyAt, readMovement, type Item, type Loc, type Movement } from '@/lib/inventory';
import { Badge, Err, ListSkeleton, Modal, btn, card, danger, field, ghost, labelCls } from '@/components/products/ui';
import { Thumb, downloadCsv } from '@/components/products/inventoryUi';
import type { Supplier } from '@/lib/purchaseOrders';
import {
  MAX_LINES, MAX_TAGS, TITEM_COLS, TRANSFER_COLS, availableAt, canDelete, canReceive, checkTransfer, daysOnRoad, findByCode, inTransit, isLate, originId, originKind, parseLines, parseTagInput, printHtml,
  progress, readTransfer, readTransferItem, restockSeeds, shortLines, transferError, transferToCsv, trStatusLabel, whatsappText,
  type LineSeed, type Transfer, type TransferItem,
} from '@/lib/transfers';

type Line = { id: string | null; key: string; product_id: string | null; variant_id: string | null; name: string; sku: string | null; quantity: string; received: number; rejected: number; cover: string | null };
type PoRef = { id: string; number: number; supplier_name: string | null; status: string; destination_name: string | null };
type Details = { reference: string; note: string; expected_at: string; carrier: string; tracking: string };

export default function TransferEditor({ businessId, businessName, transferId, locs, items, suppliers, pos, onBack, onChanged }: {
  businessId: string; businessName: string; transferId: string | 'new'; locs: Loc[]; items: Item[]; suppliers: Supplier[]; pos: PoRef[]; onBack: () => void; onChanged: () => void;
}) {
  const sb = useMemo(() => createClient(), []);
  const [id, setId] = useState<string | 'new'>(transferId);
  const [tr, setTr] = useState<Transfer | null>(null);
  const [receipts, setReceipts] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(transferId !== 'new');
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [notice, setNotice] = useState('');
  const [dirty, setDirty] = useState(false);

  const activeLocs = locs.filter((l) => l.active);
  const [origin, setOrigin] = useState(''); // loc:<id> | sup:<id>
  const [destId, setDestId] = useState('');
  const [det, setDet] = useState<Details>({ reference: '', note: '', expected_at: '', carrier: '', tracking: '' });
  const [tags, setTags] = useState<string[]>([]);
  const [tagText, setTagText] = useState('');
  const [poId, setPoId] = useState<string | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [modal, setModal] = useState<'' | 'details' | 'receive' | 'po' | 'import'>('');
  const [q, setQ] = useState('');
  const [pickOpen, setPickOpen] = useState(false);
  const [importText, setImportText] = useState('');

  const status = tr?.status ?? 'draft';
  const locked = status !== 'draft';
  const itemByKey = useMemo(() => new Map(items.map((i) => [i.key, i])), [items]);
  const kind = originKind(origin);
  const originLoc = kind === 'location' ? originId(origin) : '';
  const avail = useMemo(() => (originLoc ? availableAt(items, originLoc) : null), [items, originLoc]);
  const originName = kind === 'location' ? locs.find((l) => l.id === originLoc)?.name : kind === 'supplier' ? suppliers.find((s) => s.id === originId(origin))?.name : undefined;
  const destName = locs.find((l) => l.id === destId)?.name;
  const linkedPo = pos.find((p) => p.id === poId) ?? null;

  const load = useCallback(async (target: string) => {
    setLoading(true);
    const [t, it, mv] = await Promise.all([
      sb.from('transfers').select(TRANSFER_COLS).eq('id', target).eq('business_id', businessId).single(),
      sb.from('transfer_items').select(TITEM_COLS).eq('transfer_id', target).eq('business_id', businessId).order('position', { ascending: true }),
      sb.from('inventory_movements').select(MOVE_COLS).eq('business_id', businessId).eq('ref_type', 'transfer').eq('ref_id', target).order('created_at', { ascending: false }).limit(300),
    ]);
    const msg = t.error?.message || it.error?.message;
    if (msg) {
      setErr(transferError(msg));
      setLoading(false);
      return;
    }
    const row = readTransfer(t.data as Record<string, unknown>);
    setTr(row);
    setOrigin(row.origin_id ? `loc:${row.origin_id}` : row.origin_supplier_id ? `sup:${row.origin_supplier_id}` : '');
    setDestId(row.destination_id ?? '');
    setDet({ reference: row.reference ?? '', note: row.note ?? '', expected_at: row.expected_at ?? '', carrier: row.carrier ?? '', tracking: row.tracking ?? '' });
    setTags(row.tags);
    setPoId(row.po_id);
    setLines(((it.data ?? []) as Record<string, unknown>[]).map(readTransferItem).map((i) => ({ id: i.id, key: `${i.product_id}:${i.variant_id ?? ''}`, product_id: i.product_id, variant_id: i.variant_id, name: i.name, sku: i.sku, quantity: String(i.quantity), received: i.received, rejected: i.rejected, cover: null })));
    setReceipts(((mv.data ?? []) as Record<string, unknown>[]).map(readMovement));
    setDirty(false);
    setLoading(false);
  }, [sb, businessId]);

  useEffect(() => {
    if (id !== 'new') load(id);
  }, [id, load]);

  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  const touch = () => setDirty(true);
  const form = { origin, destination_id: destId, reference: det.reference, note: det.note, tags, expected_at: det.expected_at, carrier: det.carrier, tracking: det.tracking, lines: lines.map((l) => ({ key: l.key, quantity: l.quantity, name: l.name })) };
  const short = shortLines(form, avail);
  const prog = progress(lines.map((l) => ({ quantity: Math.trunc(Number(l.quantity) || 0), received: l.received, rejected: l.rejected })));
  const units = lines.reduce((s, l) => s + (Number(l.quantity) || 0), 0);

  /* ------------------------------ lines ------------------------------ */

  function addSeeds(seeds: LineSeed[]): number {
    let added = 0;
    setLines((cur) => {
      const have = new Set(cur.map((l) => l.key));
      const next = [...cur];
      for (const s of seeds) {
        if (have.has(s.item.key) || next.length >= MAX_LINES) continue;
        have.add(s.item.key);
        added += 1;
        next.push({ id: null, key: s.item.key, product_id: s.item.productId, variant_id: s.item.variantId, name: itemLabel(s.item), sku: s.item.sku, quantity: String(Math.max(s.quantity, 1)), received: 0, rejected: 0, cover: s.item.cover });
      }
      return next;
    });
    touch();
    return added;
  }

  const matches = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return [];
    const have = new Set(lines.map((l) => l.key));
    return items.filter((i) => i.status !== 'archived' && !have.has(i.key) && (itemLabel(i).toLowerCase().includes(t) || (i.sku ?? '').toLowerCase().includes(t) || (i.barcode ?? '').toLowerCase().includes(t))).slice(0, 8);
  }, [q, items, lines]);

  function onSearchKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const hit = findByCode(items, q) ?? (matches.length === 1 ? matches[0] : null);
    if (hit && !lines.some((l) => l.key === hit.key)) {
      addSeeds([{ item: hit, quantity: 1, unitCost: null }]);
      setQ('');
    } else if (hit) setErr(`${itemLabel(hit)} is already on this transfer.`);
  }

  function restock() {
    if (!originLoc || !destId) return setNotice('Choose an origin location and a destination first.');
    const seeds = restockSeeds(items, originLoc, destId);
    if (seeds.length === 0) return setNotice(`Nothing is low at ${destName ?? 'the destination'} that ${originName ?? 'the origin'} can supply.`);
    const n = addSeeds(seeds);
    setNotice(n ? `Added ${n} item${n === 1 ? '' : 's'} that ${destName ?? 'the destination'} is running low on, limited to what ${originName ?? 'the origin'} has.` : 'Those items are already on the transfer.');
  }

  function fitToStock() {
    setLines((cur) => cur.map((l) => (avail && Number(l.quantity) > (avail.get(l.key) ?? 0) ? { ...l, quantity: String(Math.max(avail.get(l.key) ?? 0, 1)) } : l)).filter((l) => !(avail && (avail.get(l.key) ?? 0) === 0)));
    touch();
  }

  function importLines(text: string) {
    const r = parseLines(text, items);
    const n = r.seeds.length ? addSeeds(r.seeds) : 0;
    setModal('');
    setImportText('');
    setErr(r.errors.length ? `${r.errors.slice(0, 4).join(' ')}${r.errors.length > 4 ? ` And ${r.errors.length - 4} more.` : ''}` : '');
    setNotice(n ? `Imported ${n} line${n === 1 ? '' : 's'}.` : '');
  }

  /* ------------------------------ saving ------------------------------ */

  async function persist(sending: boolean): Promise<string | null> {
    setErr('');
    const bad = checkTransfer(form, avail, sending);
    if (bad) {
      setErr(bad);
      return null;
    }
    const base = {
      origin_id: kind === 'location' ? originLoc : null,
      origin_supplier_id: kind === 'supplier' ? originId(origin) : null,
      origin_name: originName ?? tr?.origin_name ?? null,
      destination_id: destId,
      destination_name: destName ?? null,
      reference: det.reference.trim() || null, note: det.note.trim() || null, tags, po_id: poId,
      expected_at: det.expected_at || null, carrier: det.carrier.trim() || null, tracking: det.tracking.trim() || null,
    };
    let target = id;
    if (id === 'new') {
      const { data, error } = await sb.from('transfers').insert({ ...base, business_id: businessId, status: 'draft' }).select(TRANSFER_COLS).single();
      if (error) {
        setErr(transferError(error.message));
        return null;
      }
      target = readTransfer(data as Record<string, unknown>).id;
    } else {
      const patch = locked ? { reference: base.reference, note: base.note, tags: base.tags, po_id: base.po_id, expected_at: base.expected_at, carrier: base.carrier, tracking: base.tracking } : base;
      const { error } = await sb.from('transfers').update(patch).eq('id', id).eq('business_id', businessId);
      if (error) {
        setErr(transferError(error.message));
        return null;
      }
    }
    if (!locked) {
      const { data: have, error: e1 } = await sb.from('transfer_items').select('id').eq('transfer_id', target).eq('business_id', businessId);
      if (e1) {
        setErr(transferError(e1.message));
        return null;
      }
      const keep = new Set(lines.map((l) => l.id).filter((x): x is string => !!x));
      const gone = ((have ?? []) as { id: string }[]).map((r) => r.id).filter((x) => !keep.has(x));
      if (gone.length) {
        const { error } = await sb.from('transfer_items').delete().in('id', gone).eq('business_id', businessId);
        if (error) {
          setErr(transferError(error.message));
          return null;
        }
      }
      for (let i = 0; i < lines.length; i += 1) {
        const l = lines[i];
        const row = { name: l.name, sku: l.sku, quantity: Math.trunc(Number(l.quantity)), position: i };
        const r = l.id ? await sb.from('transfer_items').update(row).eq('id', l.id).eq('business_id', businessId) : await sb.from('transfer_items').insert({ ...row, transfer_id: target, business_id: businessId, product_id: l.product_id, variant_id: l.variant_id });
        if (r.error) {
          setErr(transferError(r.error.message));
          return null;
        }
      }
    }
    setDirty(false);
    return target;
  }

  async function save(send = false) {
    setBusy('save');
    const target = await persist(send);
    if (!target) return setBusy('');
    if (send) {
      const { error } = await sb.rpc('xenon_ship_transfer', { p_transfer: target });
      if (error) {
        setBusy('');
        setErr(transferError(error.message));
        if (id === 'new') setId(target);
        else await load(target);
        return;
      }
    }
    setBusy('');
    onChanged();
    setNotice(send ? (kind === 'location' ? `Marked as in transit. The stock was taken out of ${originName ?? 'the origin'}.` : 'Marked as in transit. Receive it when it arrives.') : 'Saved.');
    if (id === 'new') setId(target);
    else await load(target);
  }

  async function cancel() {
    if (!tr) return;
    const msg = tr.status === 'draft' ? `Cancel transfer #${tr.number}?` : `Cancel transfer #${tr.number}? Units that have not arrived go back to ${tr.origin_name ?? 'the origin'}.`;
    if (!window.confirm(msg)) return;
    setBusy('cancel');
    const { data, error } = await sb.rpc('xenon_cancel_transfer', { p_transfer: tr.id });
    setBusy('');
    if (error) return setErr(transferError(error.message));
    const back = Number((data as { returned?: number } | null)?.returned ?? 0);
    setNotice(back > 0 ? `Transfer cancelled. ${back} unit${back === 1 ? '' : 's'} returned to ${tr.origin_name ?? 'the origin'}.` : 'Transfer cancelled.');
    onChanged();
    await load(tr.id);
  }

  async function remove() {
    if (!tr || !window.confirm(`Delete transfer #${tr.number}? This cannot be undone.`)) return;
    setBusy('delete');
    const { error } = await sb.from('transfers').delete().eq('id', tr.id).eq('business_id', businessId);
    setBusy('');
    if (error) return setErr(transferError(error.message));
    onChanged();
    onBack();
  }

  async function duplicate() {
    if (!tr) return;
    setBusy('dup');
    const { data, error } = await sb.from('transfers').insert({ business_id: businessId, status: 'draft', origin_id: tr.origin_id, origin_supplier_id: tr.origin_supplier_id, origin_name: tr.origin_name, destination_id: tr.destination_id, destination_name: tr.destination_name, note: tr.note, tags: tr.tags }).select(TRANSFER_COLS).single();
    if (error) {
      setBusy('');
      return setErr(transferError(error.message));
    }
    const copy = readTransfer(data as Record<string, unknown>);
    const rows = lines.map((l, i) => ({ transfer_id: copy.id, business_id: businessId, product_id: l.product_id, variant_id: l.variant_id, name: l.name, sku: l.sku, quantity: Math.max(Math.trunc(Number(l.quantity)), 1), position: i }));
    if (rows.length) {
      const r = await sb.from('transfer_items').insert(rows);
      if (r.error) {
        setBusy('');
        return setErr(transferError(r.error.message));
      }
    }
    setBusy('');
    onChanged();
    setNotice(`Copied as draft transfer #${copy.number}.`);
    setId(copy.id);
  }

  /* ----------------------------- output ----------------------------- */

  const asItems = (): TransferItem[] => lines.map((l, i) => ({ id: l.id ?? String(i), transfer_id: tr?.id ?? '', product_id: l.product_id, variant_id: l.variant_id, name: l.name, sku: l.sku, quantity: Math.trunc(Number(l.quantity) || 0), received: l.received, rejected: l.rejected, position: i }));
  const view = (): Transfer | null => (tr ? { ...tr, origin_name: originName ?? tr.origin_name, destination_name: destName ?? tr.destination_name, reference: det.reference || null, note: det.note || null, carrier: det.carrier || null, tracking: det.tracking || null, expected_at: det.expected_at || null } : null);

  function print() {
    const v = view();
    if (!v) return;
    const w = window.open('', '_blank');
    if (!w) return setErr('Your browser blocked the print window. Allow pop-ups for this site and try again.');
    w.document.write(printHtml(v, asItems(), businessName));
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  }

  function whatsapp() {
    const v = view();
    if (v) window.open(`https://wa.me/?text=${encodeURIComponent(whatsappText(v, asItems(), businessName))}`, '_blank', 'noopener');
  }

  /* ------------------------------ render ------------------------------ */

  if (loading) return <ListSkeleton rows={4} />;
  if (id !== 'new' && !tr) return (
    <div className="space-y-3">
      <button type="button" className={ghost} onClick={onBack}>Back to transfers</button>
      <Err text={err || 'This transfer could not be found.'} />
    </div>
  );

  const late = tr ? isLate({ status: tr.status, expected_at: det.expected_at || null }) : false;
  const days = tr ? daysOnRoad(tr) : null;
  const tone = status === 'received' ? 'green' : status === 'cancelled' ? 'red' : status === 'draft' ? 'grey' : 'blue';
  const lostOrigin = !!tr && !originName && !tr.origin_id && !tr.origin_supplier_id;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className={`${ghost} inline-flex items-center gap-1.5 px-3`} onClick={() => { if (!dirty || window.confirm('You have unsaved changes. Leave without saving?')) onBack(); }}>
          <ArrowLeft className="h-4 w-4" /> Transfers
        </button>
        <h2 className="font-display text-xl font-bold text-slate-900">{tr ? `Transfer #${tr.number}` : 'Create transfer'}</h2>
        {tr && <Badge tone={tone}>{trStatusLabel[status]}</Badge>}
        {late && <Badge tone="red">Late</Badge>}
        {days !== null && !late && <Badge tone="amber">{days === 0 ? 'Left today' : `${days} day${days === 1 ? '' : 's'} on the road`}</Badge>}
        <div className="ml-auto flex flex-wrap gap-2">
          {tr && <button type="button" className={ghost} onClick={print}>Print</button>}
          {tr && <button type="button" className={`${ghost} inline-flex items-center gap-1.5`} onClick={() => { const v = view(); if (v) downloadCsv(`transfer-${tr.number}.csv`, transferToCsv(v, asItems())); }}><Download className="h-4 w-4" /> Export</button>}
          {tr && <button type="button" className={ghost} onClick={duplicate} disabled={busy === 'dup' || dirty}>Duplicate</button>}
        </div>
      </div>

      {notice && <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">{notice}</p>}
      <Err text={err} />
      {lostOrigin && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">The origin was deleted. You can still receive this transfer, but cancelling cannot return stock.</p>}

      <div className="grid gap-5 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-5">
          <section className={card}>
            <div className="rounded-2xl border border-slate-200 p-4">
              <div className="flex items-start gap-3">
                <div className="flex flex-col items-center pt-2.5">
                  <span className="h-3 w-3 rounded-sm bg-slate-800" />
                  <span className="my-1 h-14 w-px bg-slate-300" />
                  <span className="h-3 w-3 rounded-full border-2 border-slate-800" />
                </div>
                <div className="min-w-0 flex-1 space-y-3">
                  <div>
                    <label className={labelCls}>Origin</label>
                    <select className={field} value={origin} disabled={locked} onChange={(e) => { setOrigin(e.target.value); if (e.target.value === `loc:${destId}`) setDestId(''); touch(); }}>
                      <option value="">Select origin</option>
                      <optgroup label="Locations">
                        {activeLocs.map((l) => (<option key={l.id} value={`loc:${l.id}`}>{l.name}</option>))}
                      </optgroup>
                      {suppliers.filter((s) => s.active).length > 0 && (
                        <optgroup label="Suppliers">
                          {suppliers.filter((s) => s.active).map((s) => (<option key={s.id} value={`sup:${s.id}`}>{s.name}</option>))}
                        </optgroup>
                      )}
                    </select>
                  </div>
                  <p className="flex items-center gap-2 text-sm text-slate-600"><Truck className="h-4 w-4" /> In transit{tr?.carrier ? ` · ${tr.carrier}` : ''}{tr?.tracking ? ` · ${tr.tracking}` : ''}</p>
                  <div>
                    <label className={labelCls}>Destination</label>
                    <select className={field} value={destId} disabled={locked} onChange={(e) => { setDestId(e.target.value); touch(); }}>
                      <option value="">Select destination</option>
                      {activeLocs.filter((l) => l.id !== originLoc).map((l) => (<option key={l.id} value={l.id}>{l.name}</option>))}
                    </select>
                  </div>
                </div>
              </div>
              {kind === 'supplier' && !locked && <p className="mt-3 text-xs text-slate-500">Stock from a supplier is not taken out of any location. It is added to the destination when you receive it.</p>}
            </div>

            {!locked && (
              <div className="mt-4">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-display font-bold text-slate-900">Products</h3>
                  <div className="ml-auto flex flex-wrap gap-2">
                    {kind === 'location' && <button type="button" className={`${ghost} px-3 py-1.5 text-xs`} onClick={restock}>Restock destination</button>}
                    <button type="button" className={`${ghost} inline-flex items-center gap-1 px-3 py-1.5 text-xs`} onClick={() => setModal('import')}><Upload className="h-3.5 w-3.5" /> Import lines</button>
                  </div>
                </div>
                <div className="relative mt-3">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input className={`${field} pl-9`} placeholder="Search products to add, or scan a barcode and press Enter" value={q} onChange={(e) => { setQ(e.target.value); setPickOpen(true); }} onKeyDown={onSearchKey} onFocus={() => setPickOpen(true)} onBlur={() => setTimeout(() => setPickOpen(false), 150)} />
                  {pickOpen && matches.length > 0 && (
                    <ul className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
                      {matches.map((i) => (
                        <li key={i.key}>
                          <button type="button" className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-slate-50" onMouseDown={(e) => e.preventDefault()} onClick={() => { addSeeds([{ item: i, quantity: 1, unitCost: null }]); setQ(''); }}>
                            <Thumb url={i.cover} />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium text-slate-900">{itemLabel(i)}</span>
                              <span className="block text-xs text-slate-500">{i.sku ?? 'No SKU'}{originLoc ? ` · ${qtyAt(i, originLoc)} at ${originName ?? 'origin'}` : ''}</span>
                            </span>
                            <Plus className="h-4 w-4 text-slate-400" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}

            {short.length > 0 && !locked && (
              <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
                <span>{short.length} item{short.length === 1 ? ' asks' : 's ask'} for more than {originName ?? 'the origin'} has.</span>
                <button type="button" className="font-semibold underline" onClick={fitToStock}>Fit to available stock</button>
              </div>
            )}

            {lines.length === 0 ? (
              <p className="mt-4 rounded-xl border border-dashed border-slate-300 py-10 text-center text-sm text-slate-500">Search for products to move, or use Restock destination to add what is running low there.</p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[520px] text-left text-sm">
                  <thead className="text-xs uppercase tracking-wide text-slate-500">
                    <tr><th className="py-2 pr-2">Product</th><th className="px-2 py-2">{originName ? `At ${originName}` : 'At origin'}</th><th className="px-2 py-2">{destName ? `At ${destName}` : 'At destination'}</th><th className="px-2 py-2">Quantity</th><th className="w-8" /></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {lines.map((l, idx) => {
                      const it = itemByKey.get(l.key);
                      const have = avail?.get(l.key);
                      const over = have !== undefined && Number(l.quantity) > have;
                      const left = Math.trunc(Number(l.quantity) || 0) - l.received - l.rejected;
                      return (
                        <tr key={l.key} className="align-top">
                          <td className="py-2 pr-2">
                            <div className="flex items-center gap-2">
                              <Thumb url={l.cover ?? it?.cover ?? null} />
                              <div className="min-w-0">
                                <p className="truncate font-medium text-slate-900">{l.name}</p>
                                <p className="text-xs text-slate-500">{l.sku ?? 'No SKU'}</p>
                                {(l.received > 0 || l.rejected > 0) && <p className="text-xs text-green-700">{l.received} received{l.rejected ? `, ${l.rejected} rejected` : ''}{left > 0 ? ` · ${left} left` : ''}</p>}
                              </div>
                            </div>
                          </td>
                          <td className={`px-2 py-2 ${over && !locked ? 'font-semibold text-red-600' : 'text-slate-600'}`}>{have ?? '—'}</td>
                          <td className="px-2 py-2 text-slate-600">{it && destId ? qtyAt(it, destId) : '—'}</td>
                          <td className="px-2 py-2"><input className={`${field} w-20 py-1.5 ${over && !locked ? 'border-red-300' : ''}`} inputMode="numeric" disabled={locked} value={l.quantity} aria-label={`Quantity for ${l.name}`} onChange={(e) => { const v = e.target.value.replace(/\D/g, ''); setLines((c) => c.map((x, i) => (i === idx ? { ...x, quantity: v } : x))); touch(); }} /></td>
                          <td className="py-2 text-right">
                            {!locked && <button type="button" aria-label={`Remove ${l.name}`} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" onClick={() => { setLines((c) => c.filter((_, i) => i !== idx)); touch(); }}><X className="h-4 w-4" /></button>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {lines.length > 0 && <p className="mt-3 text-sm text-slate-500">{lines.length} item{lines.length === 1 ? '' : 's'} · {units.toLocaleString('en-NG')} unit{units === 1 ? '' : 's'}</p>}
          </section>

          {tr && status !== 'draft' && (
            <section className={card}>
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="font-display font-bold text-slate-900">Receiving</h3>
                <p className="text-sm text-slate-600">{prog.received} of {prog.sent} units received{prog.rejected ? `, ${prog.rejected} rejected` : ''}</p>
                {canReceive(status) && !dirty && <button type="button" className={`${btn} ml-auto`} onClick={() => setModal('receive')}>Receive items</button>}
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={prog.received} aria-valuemin={0} aria-valuemax={prog.sent}>
                <div className="h-full rounded-full bg-green-500" style={{ width: `${prog.sent ? Math.min(100, ((prog.received + prog.rejected) / prog.sent) * 100) : 0}%` }} />
              </div>
              {dirty && canReceive(status) && <p className="mt-2 text-xs text-amber-700">Save your changes before receiving items.</p>}
              {receipts.length > 0 && (
                <ul className="mt-4 divide-y divide-slate-100 text-sm">
                  {receipts.map((m) => (
                    <li key={m.id} className="flex items-center gap-3 py-2">
                      <span className="w-36 shrink-0 text-slate-500">{fmtDate(m.created_at)}</span>
                      <span className="min-w-0 flex-1 truncate text-slate-800">{m.item_name ?? 'Deleted item'} <span className="text-xs text-slate-400">· {m.location_name ?? 'Removed location'}</span></span>
                      <span className={`font-semibold ${m.delta > 0 ? 'text-green-700' : 'text-red-600'}`}>{m.delta > 0 ? `+${m.delta}` : m.delta}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>

        <div className="space-y-5">
          <section className={card}>
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-slate-900">Transfer details</h3>
              <button type="button" aria-label="Edit details" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100" onClick={() => setModal('details')}><Pencil className="h-4 w-4" /></button>
            </div>
            <dl className="mt-3 space-y-2 text-sm">
              <Row k="Created at" v={fmtDate(tr?.created_at ?? new Date().toISOString())} />
              <Row k="Reference name" v={det.reference || 'None'} />
              <Row k="Estimated arrival" v={det.expected_at ? fmtDate(det.expected_at) : 'None'} />
              <Row k="Carrier" v={det.carrier || 'None'} />
              <Row k="Tracking number" v={det.tracking || 'None'} />
              <Row k="Note" v={det.note ? (det.note.length > 60 ? `${det.note.slice(0, 60)}…` : det.note) : 'None'} />
            </dl>
          </section>

          <section className={card}>
            <button type="button" className="flex w-full items-center justify-between text-left" onClick={() => setModal('po')}>
              <span>
                <span className="block font-display font-bold text-slate-900">Link purchase order</span>
                <span className="block text-sm text-slate-500">{linkedPo ? `PO #${linkedPo.number}${linkedPo.supplier_name ? ` · ${linkedPo.supplier_name}` : ''}` : 'Not linked'}</span>
              </span>
              <span className="text-slate-400">›</span>
            </button>
          </section>

          <section className={card}>
            <h3 className="font-display font-bold text-slate-900">Tags</h3>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {tags.map((t) => (
                <span key={t} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                  {t}
                  <button type="button" aria-label={`Remove tag ${t}`} onClick={() => { setTags((c) => c.filter((x) => x !== t)); touch(); }}><X className="h-3 w-3" /></button>
                </span>
              ))}
            </div>
            <input className={`${field} mt-3`} maxLength={80} value={tagText} placeholder="Add a tag and press Enter" disabled={tags.length >= MAX_TAGS}
              onChange={(e) => setTagText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); const add = parseTagInput(tagText, tags); if (add.length) { setTags((c) => [...c, ...add].slice(0, MAX_TAGS)); touch(); } setTagText(''); } }} />
          </section>
        </div>
      </div>

      <div className="sticky bottom-3 z-10 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur">
        {!tr && (<>
          <button type="button" className={ghost} onClick={() => save(false)} disabled={!!busy}>{busy === 'save' ? 'Saving...' : 'Save as draft'}</button>
          <button type="button" className={btn} onClick={() => save(true)} disabled={!!busy}>Save and mark in transit</button>
        </>)}
        {tr && (<>
          <button type="button" className={dirty ? btn : ghost} onClick={() => save(false)} disabled={!!busy || !dirty}>{busy === 'save' ? 'Saving...' : 'Save changes'}</button>
          {status === 'draft' && <button type="button" className={btn} onClick={() => save(true)} disabled={!!busy}>Mark in transit</button>}
          {inTransit(status) && <button type="button" className={ghost} onClick={whatsapp}>Send on WhatsApp</button>}
          {status !== 'received' && status !== 'cancelled' && <button type="button" className={danger} disabled={!!busy} onClick={cancel}>{status === 'draft' ? 'Cancel transfer' : 'Cancel and return stock'}</button>}
          {canDelete(status) && <button type="button" className={danger} disabled={!!busy} onClick={remove}>Delete</button>}
        </>)}
        {dirty && <span className="ml-auto text-xs text-amber-700">Unsaved changes</span>}
      </div>

      {modal === 'details' && <DetailsModal value={det} onClose={() => setModal('')} onApply={(d) => { setDet(d); setModal(''); touch(); }} />}
      {modal === 'receive' && tr && <ReceiveModal tr={{ ...tr, origin_name: originName ?? tr.origin_name }} items={asItems()} canReturn={!!tr.origin_id} onClose={() => setModal('')} onDone={(m) => { setModal(''); setNotice(m); onChanged(); load(tr.id); }} />}
      {modal === 'po' && <PoModal pos={pos} current={poId} onClose={() => setModal('')} onPick={(p) => { setPoId(p); setModal(''); touch(); }} />}
      {modal === 'import' && (
        <Modal title="Import transfer lines" onClose={() => setModal('')}>
          <div className="space-y-4">
            <p className="text-sm text-slate-600">Upload a CSV with <b>SKU</b> (or <b>Handle</b> and <b>Variant</b>) and <b>Quantity</b>.</p>
            <input type="file" accept=".csv,text/csv" className="block w-full text-sm" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setImportText(await f.text()); }} />
            <textarea className={field} rows={5} value={importText} onChange={(e) => setImportText(e.target.value)} placeholder={'SKU,Quantity\nSHIRT-RED-M,12'} />
            <div className="flex gap-3">
              <button type="button" className={btn} onClick={() => importLines(importText)} disabled={!importText.trim()}>Add to transfer</button>
              <button type="button" className={ghost} onClick={() => setModal('')}>Cancel</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-slate-500">{k}</dt>
      <dd className="text-slate-900">{v}</dd>
    </div>
  );
}

function DetailsModal({ value, onClose, onApply }: { value: Details; onClose: () => void; onApply: (d: Details) => void }) {
  const [d, setD] = useState(value);
  const [err, setErr] = useState('');
  const set = <K extends keyof Details>(k: K, v: Details[K]) => setD((p) => ({ ...p, [k]: v }));
  return (
    <Modal title="Edit transfer details" onClose={onClose}>
      <div className="space-y-4">
        <Err text={err} />
        <div>
          <label className={labelCls}>Reference name</label>
          <input className={field} maxLength={255} value={d.reference} onChange={(e) => set('reference', e.target.value)} placeholder="Weekend restock" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Estimated arrival</label>
            <input type="date" className={field} value={d.expected_at} onChange={(e) => set('expected_at', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Carrier</label>
            <input className={field} maxLength={80} value={d.carrier} onChange={(e) => set('carrier', e.target.value)} placeholder="GIG Logistics, own van..." />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Tracking number</label>
            <input className={field} maxLength={120} value={d.tracking} onChange={(e) => set('tracking', e.target.value)} />
          </div>
        </div>
        <div>
          <label className={labelCls}>Note</label>
          <textarea className={field} rows={4} maxLength={5000} value={d.note} onChange={(e) => set('note', e.target.value)} />
          <p className="mt-1 text-right text-xs text-slate-400">{d.note.length}/5000</p>
        </div>
        <div className="flex gap-3">
          <button type="button" className={btn} onClick={() => (d.expected_at && !/^\d{4}-\d{2}-\d{2}$/.test(d.expected_at) ? setErr('That date is not valid.') : onApply(d))}>Save</button>
          <button type="button" className={ghost} onClick={onClose}>Cancel</button>
        </div>
      </div>
    </Modal>
  );
}

function PoModal({ pos, current, onClose, onPick }: { pos: PoRef[]; current: string | null; onClose: () => void; onPick: (id: string | null) => void }) {
  const [q, setQ] = useState('');
  const t = q.trim().toLowerCase().replace(/^#/, '');
  const list = pos.filter((p) => ['ordered', 'partial', 'received'].includes(p.status)).filter((p) => !t || String(p.number).includes(t) || (p.supplier_name ?? '').toLowerCase().includes(t));
  return (
    <Modal title="Link purchase order" onClose={onClose}>
      <div className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input className={`${field} pl-9`} placeholder="Search purchase orders" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
        </div>
        {list.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">No linkable purchase orders</p>
        ) : (
          <ul className="max-h-72 divide-y divide-slate-100 overflow-auto">
            {list.map((p) => (
              <li key={p.id}>
                <button type="button" className="flex w-full items-center gap-3 px-1 py-2.5 text-left hover:bg-slate-50" onClick={() => onPick(p.id)}>
                  <span className="font-semibold text-slate-900">PO #{p.number}</span>
                  <span className="min-w-0 flex-1 truncate text-sm text-slate-500">{p.supplier_name ?? 'No supplier'}{p.destination_name ? ` → ${p.destination_name}` : ''}</span>
                  {current === p.id && <Badge tone="blue">Linked</Badge>}
                </button>
              </li>
            ))}
          </ul>
        )}
        {current && <button type="button" className={danger} onClick={() => onPick(null)}>Remove link</button>}
      </div>
    </Modal>
  );
}

function ReceiveModal({ tr, items, canReturn, onClose, onDone }: { tr: Transfer; items: TransferItem[]; canReturn: boolean; onClose: () => void; onDone: (msg: string) => void }) {
  const sb = useMemo(() => createClient(), []);
  const open = items.filter((i) => i.quantity - i.received - i.rejected > 0);
  const [acc, setAcc] = useState<Record<string, string>>(() => Object.fromEntries(open.map((i) => [i.id, '0'])));
  const [rej, setRej] = useState<Record<string, string>>({});
  const [back, setBack] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const n = (s: string | undefined) => (/^\d{1,7}$/.test((s ?? '').trim()) ? Number(s) : 0);
  const total = open.reduce((s, i) => s + n(acc[i.id]), 0);
  const anyReject = open.some((i) => n(rej[i.id]) > 0);

  async function go() {
    setErr('');
    const lines: { item_id: string; accept: number; reject: number }[] = [];
    for (const i of open) {
      const a = n(acc[i.id]);
      const r = n(rej[i.id]);
      const left = i.quantity - i.received - i.rejected;
      if (a + r > left) return setErr(`${i.name}: only ${left} left to receive.`);
      if (a + r > 0) lines.push({ item_id: i.id, accept: a, reject: r });
    }
    if (lines.length === 0) return setErr('Enter how many units arrived for at least one item.');
    setBusy(true);
    const { data, error } = await sb.rpc('xenon_receive_transfer', { p_transfer: tr.id, p_lines: lines, p_return_rejected: back && canReturn });
    setBusy(false);
    if (error) return setErr(transferError(error.message));
    const d = (data ?? {}) as { units?: number; status?: string };
    const u = d.units ?? total;
    onDone(`${u} unit${u === 1 ? '' : 's'} added to ${tr.destination_name ?? 'the destination'}.${d.status === 'received' ? ' The transfer is complete.' : ''}`);
  }

  return (
    <Modal title={`Receive items for transfer #${tr.number}`} onClose={onClose} wide>
      <div className="space-y-4">
        <p className="text-sm text-slate-600">Count what actually arrived. Accepted units go into {tr.destination_name ?? 'the destination'}. Rejected units (damaged or wrong) are recorded but not added.</p>
        <Err text={err} />
        <div className="flex justify-end">
          <button type="button" className={ghost} onClick={() => { setAcc(Object.fromEntries(open.map((i) => [i.id, String(i.quantity - i.received - i.rejected)]))); setRej({}); }}>Receive everything left</button>
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
        {anyReject && canReturn && (
          <label className="flex items-start gap-2 text-sm text-slate-700">
            <input type="checkbox" className="mt-1" checked={back} onChange={(e) => setBack(e.target.checked)} />
            <span>Put rejected units back at {tr.origin_name ?? 'the origin'}. Leave this off for damaged goods, so they are not counted as stock.</span>
          </label>
        )}
        <div className="flex gap-3">
          <button type="button" className={btn} onClick={go} disabled={busy}>{busy ? 'Receiving...' : `Receive ${total} unit${total === 1 ? '' : 's'}`}</button>
          <button type="button" className={ghost} onClick={onClose} disabled={busy}>Cancel</button>
        </div>
      </div>
    </Modal>
  );
}
