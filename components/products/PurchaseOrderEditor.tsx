'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Download, Pencil, Plus, Search, Trash2, Upload, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { itemLabel, qtyIn, readMovement, MOVE_COLS, fmtDate, type Item, type Loc, type Movement } from '@/lib/inventory';
import { Badge, Err, ListSkeleton, Modal, btn, card, danger, field, ghost, labelCls } from '@/components/products/ui';
import { Thumb, downloadCsv, today } from '@/components/products/inventoryUi';
import { CostSummaryModal, DetailsModal, PaymentModal, ReceiveModal, SupplierModal, type Details } from '@/components/products/PoModals';
import {
  ITEM_COLS, MAX_LINES, PAYMENT_COLS, PO_COLS, adjLabels, balanceOf, calcTotals, canDelete, canReceive, checkPo, currencies, defaultUnitCost, dueDate, findByCode, fmtMoney, isLate,
  isPaymentOverdue, landedUnitCost, linesEditable, paidTotal, parseLines, parseTagInput, payLabel, payState, poError, poStatusLabel, poToCsv, printHtml, progress, readPayment, readPo, readPoItem,
  reorderSeeds, termsLabel, toNaira, whatsappText, round2, MAX_TAGS,
  type Adjustment, type LineSeed, type Payment, type Po, type PoItem, type Supplier,
} from '@/lib/purchaseOrders';

type Line = { id: string | null; key: string; product_id: string | null; variant_id: string | null; name: string; sku: string | null; supplier_sku: string; quantity: string; unit_cost: string; received: number; rejected: number; cover: string | null };

const blankDetails = (s?: Supplier | null): Details => ({ expected_at: '', reference: '', note: '', terms: s?.payment_terms ?? '', currency: s?.currency ?? 'NGN', exchange_rate: '1', tax_rate: '0', tax_included: true });

export default function PurchaseOrderEditor({ businessId, businessName, poId, locs, items, suppliers, onBack, onChanged, onSuppliersChanged }: {
  businessId: string; businessName: string; poId: string | 'new'; locs: Loc[]; items: Item[]; suppliers: Supplier[]; onBack: () => void; onChanged: () => void; onSuppliersChanged: (s: Supplier) => void;
}) {
  const sb = useMemo(() => createClient(), []);
  const [id, setId] = useState<string | 'new'>(poId);
  const [po, setPo] = useState<Po | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [receipts, setReceipts] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(poId !== 'new');
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [notice, setNotice] = useState('');
  const [dirty, setDirty] = useState(false);

  const activeLocs = locs.filter((l) => l.active);
  const [supplierId, setSupplierId] = useState('');
  const [destId, setDestId] = useState(activeLocs.find((l) => l.is_default)?.id ?? activeLocs[0]?.id ?? '');
  const [det, setDet] = useState<Details>(blankDetails());
  const [tags, setTags] = useState<string[]>([]);
  const [tagText, setTagText] = useState('');
  const [adj, setAdj] = useState<Adjustment[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [modal, setModal] = useState<'' | 'cost' | 'details' | 'receive' | 'pay' | 'supplier' | 'import'>('');
  const [q, setQ] = useState('');
  const [pickOpen, setPickOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const status = po?.status ?? 'draft';
  const locked = !linesEditable(status);
  const supplier = suppliers.find((s) => s.id === supplierId) ?? null;
  const rate = det.currency === 'NGN' ? 1 : Number(det.exchange_rate) > 0 ? Number(det.exchange_rate) : 1;

  const itemByKey = useMemo(() => new Map(items.map((i) => [i.key, i])), [items]);

  const load = useCallback(async (target: string) => {
    setLoading(true);
    const [p, it, pay, mv] = await Promise.all([
      sb.from('purchase_orders').select(PO_COLS).eq('id', target).eq('business_id', businessId).single(),
      sb.from('purchase_order_items').select(ITEM_COLS).eq('po_id', target).eq('business_id', businessId).order('position', { ascending: true }),
      sb.from('purchase_order_payments').select(PAYMENT_COLS).eq('po_id', target).eq('business_id', businessId).order('paid_on', { ascending: true }),
      sb.from('inventory_movements').select(MOVE_COLS).eq('business_id', businessId).eq('ref_type', 'purchase_order').eq('ref_id', target).order('created_at', { ascending: false }).limit(200),
    ]);
    const msg = p.error?.message || it.error?.message || pay.error?.message;
    if (msg) {
      setErr(poError(msg));
      setLoading(false);
      return;
    }
    const row = readPo(p.data as Record<string, unknown>);
    setPo(row);
    setSupplierId(row.supplier_id ?? '');
    setDestId(row.destination_id ?? '');
    setDet({ expected_at: row.expected_at ?? '', reference: row.reference ?? '', note: row.note ?? '', terms: row.payment_terms ?? '', currency: row.currency, exchange_rate: String(row.exchange_rate), tax_rate: String(row.tax_rate), tax_included: row.tax_included });
    setTags(row.tags);
    setAdj(row.adjustments);
    setLines(((it.data ?? []) as Record<string, unknown>[]).map(readPoItem).map((i) => ({ id: i.id, key: `${i.product_id}:${i.variant_id ?? ''}`, product_id: i.product_id, variant_id: i.variant_id, name: i.name, sku: i.sku, supplier_sku: i.supplier_sku ?? '', quantity: String(i.quantity), unit_cost: String(i.unit_cost), received: i.received, rejected: i.rejected, cover: null })));
    setPayments(((pay.data ?? []) as Record<string, unknown>[]).map(readPayment));
    setReceipts(((mv.data ?? []) as Record<string, unknown>[]).map(readMovement));
    setDirty(false);
    setLoading(false);
  }, [sb, businessId]);

  useEffect(() => {
    if (id !== 'new') load(id);
  }, [id, load]);

  // Warn before leaving with unsaved changes
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  const touch = () => setDirty(true);
  const num = (s: string) => (Number.isFinite(Number(s)) ? Number(s) : 0);
  const costLines = lines.map((l) => ({ quantity: Math.max(Math.trunc(num(l.quantity)), 0), unit_cost: num(l.unit_cost) }));
  const totals = calcTotals(costLines, adj, num(det.tax_rate), det.tax_included);
  const adjNet = totals.adjustments;
  const paid = paidTotal(payments);
  const balance = balanceOf(po ? po.total : totals.total, paid);
  const pState = payState(po ? po.total : totals.total, paid);
  const prog = progress(lines.map((l) => ({ quantity: Math.trunc(num(l.quantity)), received: l.received, rejected: l.rejected })));

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
        next.push({ id: null, key: s.item.key, product_id: s.item.productId, variant_id: s.item.variantId, name: itemLabel(s.item), sku: s.item.sku, supplier_sku: '', quantity: String(Math.max(s.quantity, 1)), unit_cost: String(s.unitCost ?? defaultUnitCost(s.item, rate)), received: 0, rejected: 0, cover: s.item.cover });
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
    return items
      .filter((i) => i.status !== 'archived' && !have.has(i.key) && (itemLabel(i).toLowerCase().includes(t) || (i.sku ?? '').toLowerCase().includes(t) || (i.barcode ?? '').toLowerCase().includes(t)))
      .slice(0, 8);
  }, [q, items, lines]);

  function onSearchKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const hit = findByCode(items, q) ?? (matches.length === 1 ? matches[0] : null);
    if (hit && !lines.some((l) => l.key === hit.key)) {
      addSeeds([{ item: hit, quantity: 1, unitCost: null }]);
      setQ('');
    } else if (hit) {
      setErr(`${itemLabel(hit)} is already on this order.`);
    }
  }

  function addReorder() {
    const seeds = reorderSeeds(items, activeLocs.map((l) => l.id), supplier?.name);
    if (seeds.length === 0) return setNotice(supplier ? `Nothing from ${supplier.name} is low on stock right now.` : 'Nothing is low on stock right now.');
    const n = addSeeds(seeds);
    setNotice(n ? `Added ${n} low-stock item${n === 1 ? '' : 's'} with suggested quantities.` : 'Those items are already on the order.');
  }

  function importLines(text: string) {
    const r = parseLines(text, items);
    const n = r.seeds.length ? addSeeds(r.seeds) : 0;
    setModal('');
    setImportText('');
    setErr(r.errors.length ? `${r.errors.slice(0, 4).join(' ')}${r.errors.length > 4 ? ` And ${r.errors.length - 4} more.` : ''}` : '');
    setNotice(n ? `Imported ${n} line${n === 1 ? '' : 's'}.` : '');
  }

  const setLine = (idx: number, patch: Partial<Line>) => {
    setLines((cur) => cur.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
    touch();
  };

  function changeSupplier(v: string) {
    if (v === '__new') return setModal('supplier');
    setSupplierId(v);
    const s = suppliers.find((x) => x.id === v);
    if (s && !locked) {
      // A new supplier brings its usual currency and terms along
      setDet((d) => (lines.length === 0 ? { ...d, currency: s.currency, exchange_rate: s.currency === 'NGN' ? '1' : d.exchange_rate, terms: s.payment_terms ?? d.terms } : { ...d, terms: d.terms || (s.payment_terms ?? '') }));
    }
    touch();
  }

  /* ------------------------------ saving ------------------------------ */

  async function persist(): Promise<string | null> {
    setErr('');
    const form = { supplier_id: supplierId, destination_id: destId, currency: det.currency, exchange_rate: det.exchange_rate, tax_rate: det.tax_rate, tax_included: det.tax_included, expected_at: det.expected_at, reference: det.reference, note: det.note, tags, adjustments: adj, lines };
    const bad = checkPo(form);
    if (bad) {
      setErr(bad);
      return null;
    }
    const dest = locs.find((l) => l.id === destId);
    const base = {
      supplier_id: supplierId, supplier_name: supplier?.name ?? po?.supplier_name ?? null,
      destination_id: destId, destination_name: dest?.name ?? null,
      currency: det.currency, exchange_rate: det.currency === 'NGN' ? 1 : Number(det.exchange_rate),
      tax_rate: num(det.tax_rate), tax_included: det.tax_included,
      expected_at: det.expected_at || null, reference: det.reference.trim() || null, note: det.note.trim() || null,
      payment_terms: det.terms || null, tags, adjustments: adj, total: totals.total,
    };
    let target = id;
    if (id === 'new') {
      const { data, error } = await sb.from('purchase_orders').insert({ ...base, business_id: businessId, status: 'draft' }).select(PO_COLS).single();
      if (error) {
        setErr(poError(error.message));
        return null;
      }
      target = readPo(data as Record<string, unknown>).id;
    } else {
      const patch = locked ? { reference: base.reference, note: base.note, tags: base.tags, payment_terms: base.payment_terms, expected_at: base.expected_at } : base;
      const { error } = await sb.from('purchase_orders').update(patch).eq('id', id).eq('business_id', businessId);
      if (error) {
        setErr(poError(error.message));
        return null;
      }
    }
    if (!locked) {
      const { data: have, error: e1 } = await sb.from('purchase_order_items').select('id').eq('po_id', target).eq('business_id', businessId);
      if (e1) {
        setErr(poError(e1.message));
        return null;
      }
      const keep = new Set(lines.map((l) => l.id).filter((x): x is string => !!x));
      const gone = ((have ?? []) as { id: string }[]).map((r) => r.id).filter((x) => !keep.has(x));
      if (gone.length) {
        const { error } = await sb.from('purchase_order_items').delete().in('id', gone).eq('business_id', businessId);
        if (error) {
          setErr(poError(error.message));
          return null;
        }
      }
      for (let i = 0; i < lines.length; i += 1) {
        const l = lines[i];
        const row = { name: l.name, sku: l.sku, supplier_sku: l.supplier_sku.trim() || null, quantity: Math.trunc(num(l.quantity)), unit_cost: num(l.unit_cost), position: i };
        const r = l.id
          ? await sb.from('purchase_order_items').update(row).eq('id', l.id).eq('business_id', businessId)
          : await sb.from('purchase_order_items').insert({ ...row, po_id: target, business_id: businessId, product_id: l.product_id, variant_id: l.variant_id });
        if (r.error) {
          setErr(poError(r.error.message));
          return null;
        }
      }
    }
    setDirty(false);
    return target;
  }

  async function save(then?: 'ordered') {
    setBusy('save');
    const target = await persist();
    if (!target) return setBusy('');
    if (then === 'ordered') {
      const { error } = await sb.from('purchase_orders').update({ status: 'ordered', ordered_at: new Date().toISOString() }).eq('id', target).eq('business_id', businessId);
      if (error) {
        setBusy('');
        setErr(poError(error.message));
        if (id === 'new') setId(target);
        return;
      }
    }
    setBusy('');
    onChanged();
    setNotice(then === 'ordered' ? 'Marked as ordered. You can receive stock when it arrives.' : 'Saved.');
    if (id === 'new') setId(target);
    else await load(target);
  }

  async function setStatus(s: 'draft' | 'ordered' | 'closed' | 'cancelled', msg: string, confirm?: string) {
    if (!po) return;
    if (confirm && !window.confirm(confirm)) return;
    setErr('');
    setBusy(s);
    const patch: Record<string, unknown> = { status: s };
    if (s === 'ordered') patch.ordered_at = po.ordered_at ?? new Date().toISOString();
    const { error } = await sb.from('purchase_orders').update(patch).eq('id', po.id).eq('business_id', businessId);
    setBusy('');
    if (error) return setErr(poError(error.message));
    setNotice(msg);
    onChanged();
    await load(po.id);
  }

  // Closing a part-received order, or reopening it, keeps the right status
  const reopenStatus = prog.received + prog.rejected > 0 ? 'partial' : 'ordered';

  async function reopen() {
    if (!po) return;
    setBusy('reopen');
    const { error } = await sb.from('purchase_orders').update({ status: reopenStatus }).eq('id', po.id).eq('business_id', businessId);
    setBusy('');
    if (error) return setErr(poError(error.message));
    setNotice('Order reopened.');
    onChanged();
    await load(po.id);
  }

  async function remove() {
    if (!po || !window.confirm(`Delete PO #${po.number}? This cannot be undone.`)) return;
    setBusy('delete');
    const { error } = await sb.from('purchase_orders').delete().eq('id', po.id).eq('business_id', businessId);
    setBusy('');
    if (error) return setErr(poError(error.message));
    onChanged();
    onBack();
  }

  async function duplicate() {
    if (!po) return;
    setBusy('dup');
    const { data, error } = await sb.from('purchase_orders').insert({
      business_id: businessId, status: 'draft', supplier_id: po.supplier_id, supplier_name: po.supplier_name, destination_id: po.destination_id, destination_name: po.destination_name,
      currency: po.currency, exchange_rate: po.exchange_rate, tax_rate: po.tax_rate, tax_included: po.tax_included, payment_terms: po.payment_terms, tags: po.tags, adjustments: po.adjustments, total: po.total, note: po.note,
    }).select(PO_COLS).single();
    if (error) {
      setBusy('');
      return setErr(poError(error.message));
    }
    const copy = readPo(data as Record<string, unknown>);
    const rows = lines.map((l, i) => ({ po_id: copy.id, business_id: businessId, product_id: l.product_id, variant_id: l.variant_id, name: l.name, sku: l.sku, supplier_sku: l.supplier_sku.trim() || null, quantity: Math.trunc(num(l.quantity)), unit_cost: num(l.unit_cost), position: i }));
    if (rows.length) {
      const r = await sb.from('purchase_order_items').insert(rows);
      if (r.error) {
        setBusy('');
        return setErr(poError(r.error.message));
      }
    }
    setBusy('');
    onChanged();
    setNotice(`Copied as draft PO #${copy.number}.`);
    setId(copy.id);
  }

  async function removePayment(p: Payment) {
    if (!window.confirm('Remove this payment?')) return;
    const { error } = await sb.from('purchase_order_payments').delete().eq('id', p.id).eq('business_id', businessId);
    if (error) return setErr(poError(error.message));
    if (po) await load(po.id);
  }

  /* ----------------------------- output ----------------------------- */

  const asItems = (): PoItem[] => lines.map((l, i) => ({ id: l.id ?? String(i), po_id: po?.id ?? '', product_id: l.product_id, variant_id: l.variant_id, name: l.name, sku: l.sku, supplier_sku: l.supplier_sku || null, quantity: Math.trunc(num(l.quantity)), received: l.received, rejected: l.rejected, unit_cost: num(l.unit_cost), position: i }));

  function print() {
    if (!po) return;
    const w = window.open('', '_blank');
    if (!w) return setErr('Your browser blocked the print window. Allow pop-ups for this site and try again.');
    w.document.write(printHtml({ ...po, adjustments: adj, tax_rate: num(det.tax_rate), tax_included: det.tax_included, note: det.note }, asItems(), businessName, supplier));
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  }

  function whatsapp() {
    if (!po) return;
    const text = whatsappText({ ...po, adjustments: adj, total: totals.total, note: det.note }, asItems(), businessName);
    const digits = (supplier?.phone ?? '').replace(/\D/g, '');
    const intl = digits.startsWith('0') ? `234${digits.slice(1)}` : digits;
    window.open(`https://wa.me/${intl}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  }

  function email() {
    if (!po) return;
    const text = whatsappText({ ...po, adjustments: adj, total: totals.total, note: det.note }, asItems(), businessName);
    window.location.href = `mailto:${supplier?.email ?? ''}?subject=${encodeURIComponent(`Purchase order #${po.number} from ${businessName}`)}&body=${encodeURIComponent(text)}`;
  }

  /* ------------------------------ render ------------------------------ */

  if (loading) return <ListSkeleton rows={4} />;
  if (id !== 'new' && !po) return (
    <div className="space-y-3">
      <button type="button" className={ghost} onClick={onBack}>Back to purchase orders</button>
      <Err text={err || 'This purchase order could not be found.'} />
    </div>
  );

  const late = po ? isLate({ status: po.status, expected_at: det.expected_at || null }) : false;
  const payLate = po ? isPaymentOverdue({ ...po, payment_terms: det.terms || null }, paid) : false;
  const due = po ? dueDate({ ...po, payment_terms: det.terms || null }) : null;
  const statusTone = status === 'received' ? 'green' : status === 'cancelled' ? 'red' : status === 'draft' ? 'grey' : status === 'closed' ? 'grey' : 'blue';
  const editedUnsaved = id !== 'new' && dirty;
  const wantsAdjustedCost = adj.length > 0 || totals.tax > 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className={`${ghost} inline-flex items-center gap-1.5 px-3`} onClick={() => { if (!dirty || window.confirm('You have unsaved changes. Leave without saving?')) onBack(); }}>
          <ArrowLeft className="h-4 w-4" /> Purchase orders
        </button>
        <h2 className="font-display text-xl font-bold text-slate-900">{po ? `PO #${po.number}` : 'Create purchase order'}</h2>
        {po && <Badge tone={statusTone}>{poStatusLabel[status]}</Badge>}
        {po && pState !== 'none' && status !== 'draft' && status !== 'cancelled' && <Badge tone={pState === 'paid' ? 'green' : pState === 'partial' ? 'amber' : 'grey'}>{payLabel[pState]}</Badge>}
        {late && <Badge tone="red">Late</Badge>}
        {payLate && <Badge tone="red">Payment overdue</Badge>}
        <div className="ml-auto flex flex-wrap gap-2">
          {po && <button type="button" className={ghost} onClick={print}>Print</button>}
          {po && <button type="button" className={`${ghost} inline-flex items-center gap-1.5`} onClick={() => downloadCsv(`PO-${po.number}.csv`, poToCsv({ ...po, supplier_name: supplier?.name ?? po.supplier_name }, asItems()))}><Download className="h-4 w-4" /> Export</button>}
          {po && <button type="button" className={ghost} onClick={duplicate} disabled={busy === 'dup' || dirty}>Duplicate</button>}
        </div>
      </div>

      {notice && <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">{notice}</p>}
      <Err text={err} />

      <div className="grid gap-5 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-5">
          {/* supplier + destination */}
          <section className={`${card} grid gap-4 sm:grid-cols-2`}>
            <div>
              <label className={labelCls}>Supplier</label>
              <select className={field} value={supplierId} disabled={locked || (!!po && prog.received + prog.rejected > 0)} onChange={(e) => changeSupplier(e.target.value)}>
                <option value="">Select a supplier</option>
                {suppliers.filter((s) => s.active || s.id === supplierId).map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
                <option value="__new">+ Add a new supplier</option>
              </select>
              {supplier && (supplier.lead_time_days || supplier.phone) && <p className="mt-1 text-xs text-slate-500">{supplier.lead_time_days ? `Usually delivers in ${supplier.lead_time_days} days. ` : ''}{supplier.phone ?? ''}</p>}
            </div>
            <div>
              <label className={labelCls}>Destination</label>
              <select className={field} value={destId} disabled={locked || (!!po && prog.received + prog.rejected > 0)} onChange={(e) => { setDestId(e.target.value); touch(); }}>
                {activeLocs.map((l) => (<option key={l.id} value={l.id}>{l.name}</option>))}
              </select>
              {det.expected_at && <p className="mt-1 text-xs text-slate-500">Expected {fmtDate(det.expected_at)}</p>}
            </div>
          </section>

          {/* products */}
          <section className={card}>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-display font-bold text-slate-900">Add products</h3>
              {!locked && (
                <div className="ml-auto flex flex-wrap gap-2">
                  <button type="button" className={`${ghost} px-3 py-1.5 text-xs`} onClick={addReorder}>Add low-stock items</button>
                  <button type="button" className={`${ghost} inline-flex items-center gap-1 px-3 py-1.5 text-xs`} onClick={() => setModal('import')}><Upload className="h-3.5 w-3.5" /> Import lines</button>
                </div>
              )}
            </div>
            {!locked && (
              <div className="relative mt-3">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input className={`${field} pl-9`} placeholder="Search by name or SKU, or scan a barcode and press Enter" value={q} onChange={(e) => { setQ(e.target.value); setPickOpen(true); }} onKeyDown={onSearchKey} onFocus={() => setPickOpen(true)} onBlur={() => setTimeout(() => setPickOpen(false), 150)} />
                {pickOpen && matches.length > 0 && (
                  <ul className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
                    {matches.map((i) => (
                      <li key={i.key}>
                        <button type="button" className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-slate-50" onMouseDown={(e) => e.preventDefault()} onClick={() => { addSeeds([{ item: i, quantity: 1, unitCost: null }]); setQ(''); }}>
                          <Thumb url={i.cover} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-slate-900">{itemLabel(i)}</span>
                            <span className="block text-xs text-slate-500">{i.sku ?? 'No SKU'} · {qtyIn(i, activeLocs.map((l) => l.id))} in stock</span>
                          </span>
                          <Plus className="h-4 w-4 text-slate-400" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {q.trim() && pickOpen && matches.length === 0 && <p className="mt-2 text-xs text-slate-500">No products match. Items already on the order are hidden.</p>}
              </div>
            )}

            {lines.length === 0 ? (
              <p className="mt-4 rounded-xl border border-dashed border-slate-300 py-10 text-center text-sm text-slate-500">Search for products to order, or add everything that is running low in one click.</p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="py-2 pr-2">Product</th>
                      <th className="px-2 py-2">Supplier SKU</th>
                      <th className="px-2 py-2">Qty</th>
                      <th className="px-2 py-2">Cost ({det.currency})</th>
                      <th className="px-2 py-2 text-right">Total</th>
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {lines.map((l, idx) => {
                      const it = itemByKey.get(l.key);
                      const lineTotal = round2(Math.trunc(num(l.quantity)) * num(l.unit_cost));
                      const landed = landedUnitCost({ quantity: Math.trunc(num(l.quantity)), unit_cost: num(l.unit_cost) }, totals.subtotal, adjNet);
                      const left = Math.trunc(num(l.quantity)) - l.received - l.rejected;
                      return (
                        <tr key={l.key} className="align-top">
                          <td className="py-2 pr-2">
                            <div className="flex items-center gap-2">
                              <Thumb url={l.cover ?? it?.cover ?? null} />
                              <div className="min-w-0">
                                <p className="truncate font-medium text-slate-900">{l.name}</p>
                                <p className="text-xs text-slate-500">{l.sku ?? 'No SKU'}{it ? ` · ${qtyIn(it, activeLocs.map((x) => x.id))} in stock` : ''}</p>
                                {(l.received > 0 || l.rejected > 0) && <p className="text-xs text-green-700">{l.received} received{l.rejected ? `, ${l.rejected} rejected` : ''}{left > 0 ? ` · ${left} left` : ''}</p>}
                              </div>
                            </div>
                          </td>
                          <td className="px-2 py-2"><input className={`${field} w-28 py-1.5`} maxLength={60} disabled={locked} value={l.supplier_sku} aria-label={`Supplier SKU for ${l.name}`} onChange={(e) => setLine(idx, { supplier_sku: e.target.value })} /></td>
                          <td className="px-2 py-2"><input className={`${field} w-20 py-1.5`} inputMode="numeric" disabled={locked} value={l.quantity} aria-label={`Quantity for ${l.name}`} onChange={(e) => setLine(idx, { quantity: e.target.value.replace(/\D/g, '') })} /></td>
                          <td className="px-2 py-2">
                            <input className={`${field} w-28 py-1.5`} inputMode="decimal" disabled={locked} value={l.unit_cost} aria-label={`Cost for ${l.name}`} onChange={(e) => setLine(idx, { unit_cost: e.target.value.replace(/[^\d.]/g, '') })} />
                            {wantsAdjustedCost && adjNet !== 0 && <p className="mt-0.5 text-[11px] text-slate-400">Landed {fmtMoney(landed, det.currency)}</p>}
                          </td>
                          <td className="px-2 py-2 text-right font-medium text-slate-900">{fmtMoney(lineTotal, det.currency)}</td>
                          <td className="py-2 text-right">
                            {!locked && l.received === 0 && l.rejected === 0 && (
                              <button type="button" aria-label={`Remove ${l.name}`} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" onClick={() => { setLines((c) => c.filter((_, i) => i !== idx)); touch(); }}><X className="h-4 w-4" /></button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* receiving progress and history */}
          {po && status !== 'draft' && (
            <section className={card}>
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="font-display font-bold text-slate-900">Receiving</h3>
                <p className="text-sm text-slate-600">{prog.received} of {prog.ordered} units received{prog.rejected ? `, ${prog.rejected} rejected` : ''}</p>
                {canReceive(status) && !dirty && <button type="button" className={`${btn} ml-auto`} onClick={() => setModal('receive')}>Receive items</button>}
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={prog.received} aria-valuemin={0} aria-valuemax={prog.ordered}>
                <div className="h-full rounded-full bg-green-500" style={{ width: `${prog.ordered ? Math.min(100, ((prog.received + prog.rejected) / prog.ordered) * 100) : 0}%` }} />
              </div>
              {dirty && canReceive(status) && <p className="mt-2 text-xs text-amber-700">Save your changes before receiving items.</p>}
              {receipts.length > 0 && (
                <ul className="mt-4 divide-y divide-slate-100 text-sm">
                  {receipts.map((m) => (
                    <li key={m.id} className="flex items-center gap-3 py-2">
                      <span className="w-36 shrink-0 text-slate-500">{fmtDate(m.created_at)}</span>
                      <span className="min-w-0 flex-1 truncate text-slate-800">{m.item_name ?? 'Deleted item'}</span>
                      <span className="font-semibold text-green-700">+{m.delta}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {/* payments */}
          {po && status !== 'draft' && status !== 'cancelled' && (
            <section className={card}>
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="font-display font-bold text-slate-900">Payments</h3>
                <p className="text-sm text-slate-600">Paid {fmtMoney(paid, po.currency)} · Balance {fmtMoney(balance, po.currency)}{due ? ` · Due ${fmtDate(due)}` : ''}</p>
                {balance > 0 && !dirty && <button type="button" className={`${ghost} ml-auto`} onClick={() => setModal('pay')}>Record payment</button>}
              </div>
              {payments.length > 0 && (
                <ul className="mt-3 divide-y divide-slate-100 text-sm">
                  {payments.map((p) => (
                    <li key={p.id} className="flex items-center gap-3 py-2">
                      <span className="w-28 shrink-0 text-slate-500">{fmtDate(p.paid_on)}</span>
                      <span className="min-w-0 flex-1 truncate text-slate-700">{p.method ?? 'Payment'}{p.note ? ` · ${p.note}` : ''}</span>
                      <span className="font-semibold text-slate-900">{fmtMoney(p.amount, po.currency)}</span>
                      <button type="button" aria-label="Remove payment" className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" onClick={() => removePayment(p)}><Trash2 className="h-4 w-4" /></button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>

        {/* side column */}
        <div className="space-y-5">
          <section className={card}>
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-slate-900">Cost summary</h3>
              {!locked && <button type="button" aria-label="Manage cost summary" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100" onClick={() => setModal('cost')}><Pencil className="h-4 w-4" /></button>}
            </div>
            <dl className="mt-3 space-y-2 text-sm">
              <Row k={`Items (${totals.units} unit${totals.units === 1 ? '' : 's'})`} v={fmtMoney(totals.subtotal, det.currency)} />
              {adj.map((a) => (<Row key={a.type} k={adjLabels[a.type]} v={`${a.type === 'discount' ? '-' : ''}${fmtMoney(a.amount, det.currency)}`} />))}
              <Row k={`Taxes ${det.tax_included ? '(included)' : `(${det.tax_rate || 0}%)`}`} v={fmtMoney(totals.tax, det.currency)} />
              <div className="border-t border-slate-100 pt-2"><Row k="Total" v={fmtMoney(totals.total, det.currency)} bold /></div>
              {det.currency !== 'NGN' && <Row k="In naira" v={fmtMoney(toNaira(totals.total, rate), 'NGN')} />}
            </dl>
            {adjNet !== 0 && <p className="mt-3 text-xs text-slate-500">Extra costs are shared across items by value when you receive stock, so each item&apos;s cost shows what it really cost you.</p>}
          </section>

          <section className={card}>
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-slate-900">Purchase order details</h3>
              <button type="button" aria-label="Edit details" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100" onClick={() => setModal('details')}><Pencil className="h-4 w-4" /></button>
            </div>
            <dl className="mt-3 space-y-2 text-sm">
              <Row k="Estimated arrival" v={det.expected_at ? fmtDate(det.expected_at) : '—'} />
              <Row k="Reference" v={det.reference || '—'} />
              <Row k="Payment terms" v={termsLabel(det.terms || null)} />
              <Row k="Currency" v={currencies.find((c) => c.code === det.currency)?.code ?? det.currency} />
              {det.currency !== 'NGN' && <Row k="Exchange rate" v={`₦${det.exchange_rate}`} />}
              <Row k="Note to supplier" v={det.note ? (det.note.length > 60 ? `${det.note.slice(0, 60)}…` : det.note) : '—'} />
            </dl>
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

      {/* action bar */}
      <div className="sticky bottom-3 z-10 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur">
        {!po && (<>
          <button type="button" className={ghost} onClick={() => save()} disabled={!!busy}>{busy === 'save' ? 'Saving...' : 'Save as draft'}</button>
          <button type="button" className={btn} onClick={() => save('ordered')} disabled={!!busy}>Save and mark as ordered</button>
        </>)}
        {po && (<>
          <button type="button" className={editedUnsaved ? btn : ghost} onClick={() => save()} disabled={!!busy || !dirty}>{busy === 'save' ? 'Saving...' : 'Save changes'}</button>
          {status === 'draft' && <button type="button" className={btn} disabled={!!busy || dirty} onClick={() => setStatus('ordered', 'Marked as ordered. You can receive stock when it arrives.')}>Mark as ordered</button>}
          {(status === 'ordered' || status === 'partial') && <button type="button" className={ghost} onClick={whatsapp}>Send on WhatsApp</button>}
          {(status === 'ordered' || status === 'partial' || status === 'draft') && <button type="button" className={ghost} onClick={email}>Email</button>}
          {status === 'partial' && <button type="button" className={ghost} disabled={!!busy} onClick={() => setStatus('closed', 'Order closed. The remaining units will not be received.', 'Close this order? The units that have not arrived will no longer be expected.')}>Close order</button>}
          {(status === 'closed' || status === 'received' || status === 'cancelled') && status !== 'received' && <button type="button" className={ghost} disabled={!!busy} onClick={status === 'cancelled' ? () => setStatus('draft', 'Order is back to draft.') : reopen}>{status === 'cancelled' ? 'Back to draft' : 'Reopen'}</button>}
          {(status === 'draft' || status === 'ordered') && prog.received === 0 && <button type="button" className={danger} disabled={!!busy} onClick={() => setStatus('cancelled', 'Order cancelled.', `Cancel PO #${po.number}?`)}>Cancel order</button>}
          {canDelete({ status }, lines) && <button type="button" className={danger} disabled={!!busy} onClick={remove}>Delete</button>}
        </>)}
        {dirty && <span className="ml-auto text-xs text-amber-700">Unsaved changes</span>}
      </div>

      {modal === 'cost' && <CostSummaryModal adjustments={adj} currency={det.currency} onClose={() => setModal('')} onApply={(a) => { setAdj(a); setModal(''); touch(); }} />}
      {modal === 'details' && <DetailsModal value={det} lockMoney={!!po && prog.received + prog.rejected > 0} onClose={() => setModal('')} onApply={(d) => { setDet(d); setModal(''); touch(); }} />}
      {modal === 'receive' && po && <ReceiveModal po={po} items={asItems()} onClose={() => setModal('')} onDone={(m) => { setModal(''); setNotice(m); onChanged(); load(po.id); }} />}
      {modal === 'pay' && po && <PaymentModal businessId={businessId} po={po} balance={balance} onClose={() => setModal('')} onDone={(m) => { setModal(''); setNotice(m); load(po.id); }} />}
      {modal === 'supplier' && <SupplierModal businessId={businessId} supplier={null} onClose={() => setModal('')} onSaved={(s) => { onSuppliersChanged(s); setSupplierId(s.id); setModal(''); setDet((d) => (lines.length === 0 ? { ...d, currency: s.currency, terms: s.payment_terms ?? d.terms } : d)); touch(); }} />}
      {modal === 'import' && (
        <ImportLinesModal text={importText} setText={setImportText} fileRef={fileRef} onClose={() => setModal('')} onGo={() => importLines(importText)} />
      )}
    </div>
  );
}

function Row({ k, v, bold = false }: { k: string; v: string; bold?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className={bold ? 'font-semibold text-slate-900' : 'text-slate-500'}>{k}</dt>
      <dd className={`text-right ${bold ? 'font-bold text-slate-900' : 'text-slate-800'}`}>{v}</dd>
    </div>
  );
}

function ImportLinesModal({ text, setText, fileRef, onClose, onGo }: { text: string; setText: (s: string) => void; fileRef: React.RefObject<HTMLInputElement | null>; onClose: () => void; onGo: () => void }) {
  return (
    <Modal title="Import order lines" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-slate-600">Upload a CSV with <b>SKU</b> (or <b>Handle</b> and <b>Variant</b>), <b>Quantity</b> and optionally <b>Cost</b>. Handy for repeat orders from the same supplier.</p>
        <input ref={fileRef} type="file" accept=".csv,text/csv" className="block w-full text-sm" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setText(await f.text()); }} />
        <textarea className={field} rows={5} value={text} onChange={(e) => setText(e.target.value)} placeholder={'SKU,Quantity,Cost\nSHIRT-RED-M,24,3500'} />
        <div className="flex gap-3">
          <button type="button" className={btn} onClick={onGo} disabled={!text.trim()}>Add to order</button>
          <button type="button" className={ghost} onClick={onClose}>Cancel</button>
        </div>
      </div>
    </Modal>
  );
}
