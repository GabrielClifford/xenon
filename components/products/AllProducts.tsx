'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, ImagePlus, Plus, Search, Upload } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import {
  PRODUCT_COLS,
  VARIANT_COLS,
  applyPriceOp,
  coverOf,
  isLive,
  isWhole,
  marginOf,
  naira,
  parseImport,
  parseTags,
  productsToCsv,
  readProduct,
  readVariant,
  statusLabel,
  stockState,
  totalStock,
  uniqueHandle,
  variantTitle,
  type ImportItem,
  type ImportResult,
  type OptionDef,
  type PriceOp,
  type Product,
  type Status,
  type VariantRow,
} from '@/lib/products';
import ProductEditor from '@/components/products/ProductEditor';
import { Badge, Err, ListSkeleton, Modal, SQL_HINT, btn, card, danger, fetchAll, field, ghost, inChunks, labelCls, needsSql } from '@/components/products/ui';

type Sb = ReturnType<typeof createClient>;
type SortKey = 'newest' | 'name' | 'price_asc' | 'price_desc' | 'stock_asc';
type Coll = { id: string; title: string; kind: string };

const PAGE = 50;
const MAX_BULK = 500;

function download(name: string, csv: string) {
  const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ------------------------------ import one row ------------------------------ */

async function applyItem(sb: Sb, businessId: string, item: ImportItem, existing: Product | undefined): Promise<'created' | 'updated'> {
  const hasVariants = item.options !== null && item.variants.length > 0;
  const patch: Record<string, unknown> = { ...item.patch };
  const prices = item.variants.map((v) => v.price ?? item.patch.price ?? existing?.price).filter((n): n is number => typeof n === 'number');
  const fallback = item.patch.price ?? existing?.price ?? (prices.length ? Math.min(...prices) : undefined);
  if (hasVariants) {
    if (!prices.length) throw new Error('needs a price');
    patch.price = Math.min(...prices);
    patch.stock = item.variants.reduce((s, v) => s + v.stock, 0);
  }
  if (item.images) {
    patch.images = item.images;
    patch.photo_url = item.images[0] ?? null;
  }
  if (item.options !== null) patch.options = item.options;

  let id: string;
  if (existing) {
    if (Object.keys(patch).length) {
      const { error } = await sb.from('products').update(patch).eq('id', existing.id).eq('business_id', businessId);
      if (error) throw new Error(error.message);
    }
    id = existing.id;
  } else {
    if (!item.patch.name) throw new Error('a new product needs a title');
    if (patch.price === undefined) throw new Error('a new product needs a price');
    const { data, error } = await sb.from('products').insert({ business_id: businessId, handle: item.handle, ...patch }).select('id').single();
    if (error) throw new Error(error.message);
    id = (data as { id: string }).id;
  }

  if (item.options !== null) {
    const { error: de } = await sb.from('product_variants').delete().eq('product_id', id).eq('business_id', businessId);
    if (de) throw new Error(de.message);
    if (hasVariants) {
      const opts = item.options as OptionDef[];
      const rows = item.variants.map((v, i) => ({
        business_id: businessId,
        product_id: id,
        title: variantTitle(v.option_values, opts),
        option_values: v.option_values,
        price: v.price ?? (fallback as number),
        compare_at_price: v.compare_at_price,
        cost: v.cost,
        sku: v.sku,
        barcode: v.barcode,
        stock: v.stock,
        position: i,
      }));
      const { error } = await sb.from('product_variants').insert(rows);
      if (error) throw new Error(error.message);
    }
  }
  return existing ? 'updated' : 'created';
}

/* ------------------------------- import window ------------------------------ */

function ImportModal({ products, businessId, onClose, onDone }: { products: Product[]; businessId: string; onClose: () => void; onDone: () => void }) {
  const sb = useMemo(() => createClient(), []);
  const [name, setName] = useState('');
  const [result, setResult] = useState<ImportResult | null>(null);
  const [err, setErr] = useState('');
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [report, setReport] = useState<{ created: number; updated: number; failed: string[] } | null>(null);
  const byHandle = useMemo(() => new Map(products.filter((p) => p.handle).map((p) => [p.handle as string, p])), [products]);

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setErr('');
    setReport(null);
    setResult(null);
    if (f.size > 5 * 1024 * 1024) return setErr('That file is over 5 MB. Split it into smaller files.');
    setName(f.name);
    setResult(parseImport(await f.text()));
  }

  function sample() {
    const demo = readProduct({
      id: 'x',
      name: 'Ankara Dress',
      description: 'Bright print, cotton.',
      price: 15000,
      category: 'Dresses',
      images: ['https://example.com/photo.jpg'],
      handle: 'ankara-dress',
      cost: 9000,
      sku: 'AD-1',
      track_stock: true,
      stock: 0,
      tags: ['new', 'sale'],
      options: [{ name: 'Size', values: ['S', 'M'] }],
      created_at: '',
    });
    const vs: VariantRow[] = ['S', 'M'].map((s, i) => ({ id: `v${i}`, product_id: 'x', business_id: businessId, title: s, option_values: { Size: s }, price: 15000 + i * 1000, compare_at_price: null, cost: 9000, sku: `AD-${s}`, barcode: null, stock: 5, position: i }));
    download('products-example.csv', productsToCsv([demo], vs));
  }

  async function run() {
    if (!result || result.items.length === 0) return;
    setRunning(true);
    setProgress(0);
    let created = 0;
    let updated = 0;
    let done = 0;
    const failed: string[] = [];
    await inChunks(result.items, 4, async (item) => {
      try {
        const r = await applyItem(sb, businessId, item, byHandle.get(item.handle));
        if (r === 'created') created += 1;
        else updated += 1;
      } catch (e) {
        failed.push(`${item.handle}: ${e instanceof Error ? e.message : 'could not be saved'}`);
      }
      done += 1;
      setProgress(done);
    });
    setRunning(false);
    setReport({ created, updated, failed });
    onDone();
  }

  const fresh = result ? result.items.filter((i) => !byHandle.has(i.handle)).length : 0;
  const updates = result ? result.items.length - fresh : 0;

  return (
    <Modal title="Import products from CSV" onClose={() => !running && onClose()} wide>
      <div className="space-y-4 text-sm text-slate-700">
        <p>
          Upload a CSV file to add or update products in one go. Products are matched by their <b>handle</b>: a matching handle updates that product, a new one creates it. Columns you leave out are not touched.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <label className={`${btn} cursor-pointer`}>
            Choose CSV file
            <input type="file" accept=".csv,text/csv" onChange={pick} className="hidden" disabled={running} />
          </label>
          <button type="button" className={ghost} onClick={sample}>
            Download an example
          </button>
          {name && <span className="truncate text-xs text-slate-500">{name}</span>}
        </div>
        <Err text={err} />

        {result && (
          <div className="space-y-3 rounded-xl border border-slate-200 p-4">
            {result.items.length > 0 ? (
              <p className="font-medium text-slate-900">
                {result.items.length} product{result.items.length === 1 ? '' : 's'} ready: {fresh} new, {updates} to update
                {result.skipped > 0 ? `, ${result.skipped} row${result.skipped === 1 ? '' : 's'} skipped` : ''}.
              </p>
            ) : (
              <p className="font-medium text-red-700">Nothing can be imported from this file.</p>
            )}
            {!result.hasVariantColumns && result.items.length > 0 && <p className="text-xs text-slate-500">This file has no variant columns, so existing variants stay as they are.</p>}
            {result.errors.length > 0 && (
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Problems</p>
                <ul className="max-h-40 list-disc space-y-1 overflow-y-auto pl-5 text-xs text-red-700">
                  {result.errors.slice(0, 50).map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                  {result.errors.length > 50 && <li>and {result.errors.length - 50} more</li>}
                </ul>
              </div>
            )}
          </div>
        )}

        {running && (
          <div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full bg-blue-600 transition-all" style={{ width: `${result ? Math.round((progress / result.items.length) * 100) : 0}%` }} />
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Importing {progress} of {result?.items.length}
            </p>
          </div>
        )}

        {report && (
          <div className="space-y-2 rounded-xl bg-green-50 p-4 text-green-900">
            <p className="font-medium">
              Done: {report.created} created, {report.updated} updated{report.failed.length ? `, ${report.failed.length} failed` : ''}.
            </p>
            {report.failed.length > 0 && (
              <ul className="max-h-32 list-disc space-y-1 overflow-y-auto pl-5 text-xs text-red-700">
                {report.failed.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button type="button" className={ghost} onClick={onClose} disabled={running}>
            {report ? 'Close' : 'Cancel'}
          </button>
          {!report && (
            <button type="button" className={btn} onClick={run} disabled={running || !result || result.items.length === 0}>
              {running ? 'Importing...' : result && result.items.length ? `Import ${result.items.length}` : 'Import'}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}

/* -------------------------------- bulk window ------------------------------ */

type BulkAction = 'status' | 'available' | 'price' | 'tags_add' | 'tags_remove' | 'category' | 'type' | 'vendor' | 'collection' | 'delete';

const bulkLabels: Record<BulkAction, string> = {
  status: 'Change status',
  available: 'Mark sold out or available',
  price: 'Change prices',
  tags_add: 'Add tags',
  tags_remove: 'Remove tags',
  category: 'Set category',
  type: 'Set product type',
  vendor: 'Set vendor',
  collection: 'Add to a collection',
  delete: 'Delete products',
};

function BulkModal({ ids, products, variants, colls, businessId, onClose, onDone, onReload }: { ids: Set<string>; products: Product[]; variants: VariantRow[]; colls: Coll[]; businessId: string; onClose: () => void; onDone: () => void; onReload: () => void }) {
  const sb = useMemo(() => createClient(), []);
  const manual = colls.filter((c) => c.kind === 'manual');
  const [action, setAction] = useState<BulkAction>('status');
  const [status, setStatus] = useState<Status>('active');
  const [avail, setAvail] = useState<'available' | 'sold'>('sold');
  const [op, setOp] = useState<PriceOp>('inc_pct');
  const [amount, setAmount] = useState('');
  const [value, setValue] = useState('');
  const [coll, setColl] = useState(manual[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const targets = useMemo(() => products.filter((p) => ids.has(p.id)), [products, ids]);

  async function upd(id: string, patch: Record<string, unknown>) {
    const { error } = await sb.from('products').update(patch).eq('id', id).eq('business_id', businessId);
    if (error) throw new Error(error.message);
  }

  async function apply() {
    setErr('');
    if (targets.length === 0) return setErr('Nothing is selected.');
    if (targets.length > MAX_BULK) return setErr(`Select at most ${MAX_BULK} products at a time.`);
    if (action === 'price') {
      if (!isWhole(amount) || (Number(amount) === 0 && op !== 'set')) return setErr('Enter a whole number greater than 0.');
      if ((op === 'dec_pct' || op === 'inc_pct') && Number(amount) > 1000) return setErr('That percentage is too large.');
      if (op === 'dec_pct' && Number(amount) > 100) return setErr('You cannot reduce a price by more than 100%.');
    }
    if ((action === 'tags_add' || action === 'tags_remove') && parseTags(value).length === 0) return setErr('Enter at least one tag.');
    if (action === 'collection' && !coll) return setErr('Choose a collection.');
    if (action === 'delete' && !window.confirm(`Delete ${targets.length} product${targets.length === 1 ? '' : 's'}? This cannot be undone.`)) return;

    setBusy(true);
    try {
      if (action === 'status') await inChunks(targets, 10, (p) => upd(p.id, { status }));
      else if (action === 'available') await inChunks(targets, 10, (p) => upd(p.id, { available: avail === 'available' }));
      else if (action === 'tags_add') {
        const add = parseTags(value);
        await inChunks(targets, 10, (p) => upd(p.id, { tags: parseTags([...p.tags, ...add].join(',')) }));
      } else if (action === 'tags_remove') {
        const drop = new Set(parseTags(value).map((t) => t.toLowerCase()));
        await inChunks(targets, 10, (p) => upd(p.id, { tags: p.tags.filter((t) => !drop.has(t.toLowerCase())) }));
      } else if (action === 'category' || action === 'type' || action === 'vendor') {
        const col = action === 'category' ? 'category' : action === 'type' ? 'product_type' : 'vendor';
        await inChunks(targets, 10, (p) => upd(p.id, { [col]: value.trim().slice(0, 100) || null }));
      } else if (action === 'price') {
        const n = Number(amount);
        await inChunks(targets, 5, async (p) => {
          const vs = variants.filter((v) => v.product_id === p.id);
          const fix = (price: number, cap: number | null) => (cap !== null && cap <= price ? null : cap);
          if (vs.length) {
            const rows = vs.map((v) => {
              const price = applyPriceOp(v.price, op, n);
              return { ...v, price, compare_at_price: fix(price, v.compare_at_price) };
            });
            const { error } = await sb.from('product_variants').upsert(rows, { onConflict: 'id' });
            if (error) throw new Error(error.message);
            const low = Math.min(...rows.map((r) => r.price));
            await upd(p.id, { price: low });
          } else {
            const price = applyPriceOp(p.price, op, n);
            await upd(p.id, { price, compare_at_price: fix(price, p.compare_at_price) });
          }
        });
      } else if (action === 'collection') {
        const { data: last } = await sb.from('collection_products').select('position').eq('collection_id', coll).order('position', { ascending: false }).limit(1);
        const start = ((last as { position: number }[] | null)?.[0]?.position ?? -1) + 1;
        const rows = targets.map((p, i) => ({ collection_id: coll, product_id: p.id, business_id: businessId, position: start + i }));
        const { error } = await sb.from('collection_products').upsert(rows, { onConflict: 'collection_id,product_id', ignoreDuplicates: true });
        if (error) throw new Error(error.message);
      } else if (action === 'delete') {
        const list = targets.map((p) => p.id);
        for (let i = 0; i < list.length; i += 100) {
          const { error } = await sb.from('products').delete().in('id', list.slice(i, i + 100)).eq('business_id', businessId);
          if (error) throw new Error(error.message);
        }
      }
      onDone();
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Something went wrong.');
      setBusy(false);
      onReload(); // some rows may have changed before the failure
    }
  }

  return (
    <Modal title={`Edit ${targets.length} product${targets.length === 1 ? '' : 's'}`} onClose={() => !busy && onClose()}>
      <div className="space-y-4">
        <div>
          <label className={labelCls}>What do you want to do?</label>
          <select className={field} value={action} onChange={(e) => setAction(e.target.value as BulkAction)}>
            {(Object.keys(bulkLabels) as BulkAction[]).map((a) => (
              <option key={a} value={a}>
                {bulkLabels[a]}
              </option>
            ))}
          </select>
        </div>

        {action === 'status' && (
          <select className={field} value={status} onChange={(e) => setStatus(e.target.value as Status)}>
            {(['active', 'draft', 'archived'] as Status[]).map((s) => (
              <option key={s} value={s}>
                {statusLabel[s]}
              </option>
            ))}
          </select>
        )}
        {action === 'available' && (
          <select className={field} value={avail} onChange={(e) => setAvail(e.target.value as 'available' | 'sold')}>
            <option value="sold">Mark as sold out</option>
            <option value="available">Mark as available</option>
          </select>
        )}
        {action === 'price' && (
          <div className="space-y-3">
            <select className={field} value={op} onChange={(e) => setOp(e.target.value as PriceOp)}>
              <option value="inc_pct">Increase by a percentage</option>
              <option value="dec_pct">Decrease by a percentage</option>
              <option value="inc_amt">Increase by an amount (₦)</option>
              <option value="dec_amt">Decrease by an amount (₦)</option>
              <option value="set">Set every price to (₦)</option>
            </select>
            <input className={field} inputMode="numeric" placeholder={op.endsWith('pct') ? 'Percentage, for example 10' : 'Amount in naira'} value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))} />
            <p className="text-xs text-slate-500">Variant prices change too. A compare-at price that is no longer higher than the new price is cleared.</p>
          </div>
        )}
        {(action === 'tags_add' || action === 'tags_remove') && <input className={field} placeholder="Tags, separated by commas" value={value} onChange={(e) => setValue(e.target.value)} />}
        {(action === 'category' || action === 'type' || action === 'vendor') && (
          <div>
            <input className={field} maxLength={100} placeholder={`New ${action === 'type' ? 'product type' : action} (leave empty to clear it)`} value={value} onChange={(e) => setValue(e.target.value)} />
          </div>
        )}
        {action === 'collection' &&
          (manual.length === 0 ? (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">You have no manual collections yet. Create one in the Collections tab first.</p>
          ) : (
            <select className={field} value={coll} onChange={(e) => setColl(e.target.value)}>
              {manual.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          ))}
        {action === 'delete' && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">The selected products, their variants and their place in collections will be removed for good.</p>}

        <Err text={err} />
        <div className="flex justify-end gap-3">
          <button type="button" className={ghost} onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" className={action === 'delete' ? danger : btn} onClick={apply} disabled={busy || (action === 'collection' && manual.length === 0)}>
            {busy ? 'Working...' : action === 'delete' ? 'Delete' : 'Apply'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ----------------------------------- page ---------------------------------- */

export default function AllProducts({ businessId }: { businessId: string }) {
  const sb = useMemo(() => createClient(), []);
  const [products, setProducts] = useState<Product[]>([]);
  const [variants, setVariants] = useState<VariantRow[]>([]);
  const [colls, setColls] = useState<Coll[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [statusF, setStatusF] = useState<'all' | Status>('all');
  const [stockF, setStockF] = useState<'all' | 'low' | 'out'>('all');
  const [sort, setSort] = useState<SortKey>('newest');
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [shown, setShown] = useState(PAGE);
  const [editing, setEditing] = useState<string | null>(null);
  const [modal, setModal] = useState<null | 'import' | 'bulk'>(null);

  const load = useCallback(async () => {
    const p = await fetchAll<Record<string, unknown>>((from, to) => sb.from('products').select(PRODUCT_COLS).eq('business_id', businessId).order('created_at', { ascending: false }).range(from, to));
    if (p.error) {
      setError(needsSql(p.error) ? SQL_HINT : p.error);
      setLoading(false);
      return;
    }
    const [v, c] = await Promise.all([
      fetchAll<Record<string, unknown>>((from, to) => sb.from('product_variants').select(VARIANT_COLS).eq('business_id', businessId).range(from, to)),
      sb.from('collections').select('id,title,kind').eq('business_id', businessId).order('title'),
    ]);
    if (v.error || c.error) {
      const m = v.error || c.error?.message || '';
      setError(needsSql(m) ? SQL_HINT : m);
      setLoading(false);
      return;
    }
    let list = p.data.map(readProduct);

    // Older products have no URL handle yet: give each one a unique handle (needed for CSV import and export).
    const missing = list.filter((x) => !x.handle);
    if (missing.length) {
      const taken = new Set(list.map((x) => x.handle).filter((h): h is string => !!h));
      const fixes = missing.map((m) => {
        const h = uniqueHandle(m.name, taken);
        taken.add(h);
        return { id: m.id, handle: h };
      });
      await inChunks(fixes, 10, async (f) => {
        await sb.from('products').update({ handle: f.handle }).eq('id', f.id).eq('business_id', businessId);
      });
      const map = new Map(fixes.map((f) => [f.id, f.handle]));
      list = list.map((x) => (map.has(x.id) ? { ...x, handle: map.get(x.id) as string } : x));
    }

    setProducts(list);
    setVariants(v.data.map(readVariant));
    setColls(((c.data ?? []) as Coll[]).map((x) => ({ id: x.id, title: x.title, kind: x.kind })));
    setError('');
    setLoading(false);
  }, [sb, businessId]);

  useEffect(() => {
    load();
  }, [load]);

  const vBy = useMemo(() => {
    const m = new Map<string, VariantRow[]>();
    for (const v of variants) m.set(v.product_id, [...(m.get(v.product_id) ?? []), v]);
    return m;
  }, [variants]);

  const alerts = useMemo(() => {
    let low = 0;
    let out = 0;
    for (const p of products) {
      if (p.status === 'archived') continue;
      const s = stockState(p, vBy.get(p.id) ?? []);
      if (s === 'low') low += 1;
      if (s === 'out') out += 1;
    }
    return { low, out };
  }, [products, vBy]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = products.filter((p) => {
      if (statusF !== 'all' && p.status !== statusF) return false;
      const vs = vBy.get(p.id) ?? [];
      if (stockF !== 'all' && stockState(p, vs) !== stockF) return false;
      if (!needle) return true;
      return [p.name, p.sku ?? '', p.vendor ?? '', p.product_type ?? '', p.category ?? '', p.tags.join(' '), vs.map((v) => v.sku ?? '').join(' ')].join(' ').toLowerCase().includes(needle);
    });
    if (sort === 'name') list.sort((a, b) => a.name.localeCompare(b.name));
    else if (sort === 'price_asc') list.sort((a, b) => a.price - b.price);
    else if (sort === 'price_desc') list.sort((a, b) => b.price - a.price);
    else if (sort === 'stock_asc') list.sort((a, b) => totalStock(a, vBy.get(a.id) ?? []) - totalStock(b, vBy.get(b.id) ?? []));
    return list;
  }, [products, vBy, q, statusF, stockF, sort]);

  const allSelected = rows.length > 0 && rows.every((p) => sel.has(p.id));

  function toggle(id: string) {
    setSel((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function exportRows(list: Product[]) {
    const ids = new Set(list.map((p) => p.id));
    download(`products-${new Date().toISOString().slice(0, 10)}.csv`, productsToCsv(list, variants.filter((v) => ids.has(v.product_id))));
  }

  if (editing !== null) {
    return (
      <ProductEditor
        businessId={businessId}
        productId={editing === 'new' ? null : editing}
        onClose={(changed) => {
          setEditing(null);
          if (changed) load();
        }}
      />
    );
  }

  if (loading) return <ListSkeleton />;
  if (error) return <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">{error}</p>;

  const stockCell = (p: Product) => {
    const vs = vBy.get(p.id) ?? [];
    const s = stockState(p, vs);
    const n = totalStock(p, vs);
    if (s === 'untracked') return <span className="text-xs text-slate-400">Stock not tracked</span>;
    if (s === 'out') return <Badge tone="red">Out of stock</Badge>;
    if (s === 'low') return <Badge tone="amber">Low: {n} left</Badge>;
    return <span className="text-xs text-slate-600">{n} in stock</span>;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={`${btn} inline-flex items-center gap-2`} onClick={() => setEditing('new')}>
          <Plus className="h-4 w-4" /> Add product
        </button>
        <button type="button" className={`${ghost} inline-flex items-center gap-2`} onClick={() => setModal('import')}>
          <Upload className="h-4 w-4" /> Import
        </button>
        <button type="button" className={`${ghost} inline-flex items-center gap-2`} onClick={() => exportRows(rows)} disabled={rows.length === 0}>
          <Download className="h-4 w-4" /> Export {rows.length !== products.length ? `(${rows.length})` : ''}
        </button>
      </div>

      {(alerts.low > 0 || alerts.out > 0) && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <span className="flex-1">
            {alerts.out > 0 && <b>{alerts.out} out of stock</b>}
            {alerts.out > 0 && alerts.low > 0 && ' · '}
            {alerts.low > 0 && <b>{alerts.low} running low</b>}
          </span>
          {alerts.out > 0 && (
            <button type="button" className="font-semibold underline" onClick={() => setStockF('out')}>
              Show out of stock
            </button>
          )}
          {alerts.low > 0 && (
            <button type="button" className="font-semibold underline" onClick={() => setStockF('low')}>
              Show low stock
            </button>
          )}
        </div>
      )}

      <div className={`${card} space-y-3 p-4`}>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input className={`${field} pl-9`} placeholder="Search by name, SKU, tag, vendor or category" value={q} onChange={(e) => { setQ(e.target.value); setShown(PAGE); }} />
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <select className={field} aria-label="Status" value={statusF} onChange={(e) => { setStatusF(e.target.value as 'all' | Status); setShown(PAGE); }}>
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="draft">Draft</option>
            <option value="archived">Archived</option>
          </select>
          <select className={field} aria-label="Stock" value={stockF} onChange={(e) => { setStockF(e.target.value as 'all' | 'low' | 'out'); setShown(PAGE); }}>
            <option value="all">All stock levels</option>
            <option value="low">Low stock</option>
            <option value="out">Out of stock</option>
          </select>
          <select className={field} aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
            <option value="newest">Newest first</option>
            <option value="name">Name, A to Z</option>
            <option value="price_asc">Price, low to high</option>
            <option value="price_desc">Price, high to low</option>
            <option value="stock_asc">Stock, lowest first</option>
          </select>
        </div>
      </div>

      {sel.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm text-white">
          <span className="flex-1 font-semibold">{sel.size} selected</span>
          <button type="button" className="rounded-lg bg-white px-3 py-1.5 font-semibold text-slate-900" onClick={() => setModal('bulk')}>
            Edit
          </button>
          <button type="button" className="rounded-lg border border-white/30 px-3 py-1.5 font-semibold" onClick={() => exportRows(products.filter((p) => sel.has(p.id)))}>
            Export
          </button>
          <button type="button" className="rounded-lg px-3 py-1.5 text-slate-300 hover:text-white" onClick={() => setSel(new Set())}>
            Clear
          </button>
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        {products.length === 0 ? (
          <div className="p-8 text-center">
            <p className="font-semibold text-slate-900">No products yet</p>
            <p className="mt-1 text-sm text-slate-500">Add your first product, or import many at once from a CSV file.</p>
            <button type="button" className={`${btn} mt-4`} onClick={() => setEditing('new')}>
              Add product
            </button>
          </div>
        ) : rows.length === 0 ? (
          <p className="p-5 text-sm text-slate-500">No products match these filters.</p>
        ) : (
          <>
            <label className="flex items-center gap-3 border-b border-slate-100 px-4 py-2.5 text-xs font-medium text-slate-500">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={() => setSel(allSelected ? new Set() : new Set(rows.map((p) => p.id)))}
                aria-label="Select all"
              />
              {allSelected ? `All ${rows.length} selected` : `${rows.length} product${rows.length === 1 ? '' : 's'}`}
            </label>
            <ul className="divide-y divide-slate-100">
              {rows.slice(0, shown).map((p) => {
                const cover = coverOf(p);
                const vs = vBy.get(p.id) ?? [];
                const prices = vs.map((v) => v.price);
                const from = vs.length > 1 && Math.min(...prices) !== Math.max(...prices);
                const m = vs.length === 0 ? marginOf(p.price, p.cost) : null;
                const scheduled = p.status === 'active' && !isLive(p);
                return (
                  <li key={p.id} className="flex items-center gap-3 px-4 py-3">
                    <input type="checkbox" checked={sel.has(p.id)} onChange={() => toggle(p.id)} aria-label={`Select ${p.name}`} />
                    <button type="button" onClick={() => setEditing(p.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                      {cover ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={cover} alt="" className="h-12 w-12 shrink-0 rounded-lg border border-slate-200 object-cover" />
                      ) : (
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
                          <ImagePlus className="h-5 w-5" />
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-slate-900">{p.name}</span>
                        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                          <Badge tone={scheduled ? 'blue' : p.status === 'active' ? 'green' : p.status === 'draft' ? 'grey' : 'amber'}>{scheduled ? 'Scheduled' : statusLabel[p.status]}</Badge>
                          {!p.available && <Badge tone="grey">Sold out</Badge>}
                          {vs.length > 0 && <span>{vs.length} variants</span>}
                          {(p.category || p.product_type) && <span>{p.category || p.product_type}</span>}
                          {stockCell(p)}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block text-sm font-semibold text-slate-900">
                          {from ? 'From ' : ''}
                          {naira(p.price)}
                        </span>
                        {m && <span className={`block text-xs ${m.pct < 0 ? 'text-red-600' : 'text-slate-500'}`}>Margin {m.pct}%</span>}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {rows.length > shown && (
              <div className="border-t border-slate-100 p-3 text-center">
                <button type="button" className={ghost} onClick={() => setShown((n) => n + PAGE)}>
                  Show more ({rows.length - shown} left)
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {modal === 'import' && <ImportModal products={products} businessId={businessId} onClose={() => setModal(null)} onDone={load} />}
      {modal === 'bulk' && (
        <BulkModal
          ids={sel}
          products={products}
          variants={variants}
          colls={colls}
          businessId={businessId}
          onClose={() => setModal(null)}
          onReload={load}
          onDone={() => {
            setSel(new Set());
            load();
          }}
        />
      )}
    </div>
  );
}
