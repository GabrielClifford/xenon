'use client';

import { useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  adjustReasons,
  chunk,
  inventoryError,
  itemLabel,
  parseCounts,
  qtyAt,
  reorderGroups,
  reorderToCsv,
  type CountParse,
  type Item,
  type Loc,
  type Reason,
} from '@/lib/inventory';
import { naira } from '@/lib/products';
import { Err, Modal, btn, field, ghost, labelCls } from '@/components/products/ui';
import { Thumb, downloadCsv, today } from '@/components/products/inventoryUi';

type Sb = ReturnType<typeof createClient>;

// Sends changes in groups of 500. Each group is all-or-nothing in the database.
async function runBatch(sb: Sb, fn: 'xenon_adjust_inventory_batch' | 'xenon_set_inventory_batch', location: string, payload: Record<string, unknown>[], reason: Reason, note: string | null): Promise<string> {
  for (const part of chunk(payload, 500)) {
    const { error } = await sb.rpc(fn, { p_location: location, p_items: part, p_reason: reason, p_note: note });
    if (error) return inventoryError(error.message);
  }
  return '';
}

const pid = (i: Item) => ({ product_id: i.productId, variant_id: i.variantId });

/* --------------------------- add, remove or set stock --------------------------- */

type Mode = 'add' | 'remove' | 'set';

export function AdjustModal({ items, locs, initialLoc, onClose, onDone }: { items: Item[]; locs: Loc[]; initialLoc: string; onClose: () => void; onDone: (msg: string) => void }) {
  const sb = useMemo(() => createClient(), []);
  const single = items.length === 1 ? items[0] : null;
  const [loc, setLoc] = useState(initialLoc);
  const [mode, setMode] = useState<Mode>('add');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState<Reason>('received');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const reasons: { v: Reason; t: string }[] =
    mode === 'set'
      ? [
          { v: 'recount', t: 'Stock count' },
          { v: 'correction', t: 'Correction' },
        ]
      : adjustReasons.filter((r) => r.sign === 'any' || (mode === 'add' ? r.sign === 'plus' : r.sign === 'minus'));

  function changeMode(m: Mode) {
    setMode(m);
    setReason(m === 'set' ? 'recount' : m === 'add' ? 'received' : 'damaged');
    setErr('');
  }

  const n = /^\d{1,9}$/.test(amount) ? Number(amount) : null;
  const here = single ? qtyAt(single, loc) : null;
  const after = single && n !== null ? (mode === 'add' ? here! + n : mode === 'remove' ? here! - n : n) : null;

  async function submit() {
    setErr('');
    if (n === null) return setErr('Enter a whole number.');
    if (mode !== 'set' && n === 0) return setErr('Enter a number above zero.');
    if (mode === 'remove') {
      const short = items.find((i) => qtyAt(i, loc) < n);
      if (short) return setErr(`Only ${qtyAt(short, loc)} of ${itemLabel(short)} at this location, so ${n} cannot be removed.`);
    }
    setBusy(true);
    const place = locs.find((l) => l.id === loc)?.name ?? 'location';
    const text = note.trim() || null;
    const e =
      mode === 'set'
        ? await runBatch(sb, 'xenon_set_inventory_batch', loc, items.map((i) => ({ ...pid(i), qty: n })), reason, text)
        : await runBatch(sb, 'xenon_adjust_inventory_batch', loc, items.map((i) => ({ ...pid(i), delta: mode === 'add' ? n : -n })), reason, text);
    if (e) {
      setErr(e);
      setBusy(false);
      return;
    }
    onDone(single ? `Stock updated for ${itemLabel(single)} at ${place}.` : `Stock updated for ${items.length} items at ${place}.`);
  }

  return (
    <Modal title={single ? 'Adjust stock' : `Adjust ${items.length} items`} onClose={onClose}>
      <div className="space-y-4">
        <Err text={err} />
        {single ? (
          <div className="flex items-center gap-3">
            <Thumb url={single.cover} />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-900">{itemLabel(single)}</p>
              {single.sku && <p className="text-xs text-slate-500">SKU {single.sku}</p>}
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-600">The same change is made to every selected item.</p>
        )}

        <div>
          <label className={labelCls}>Location</label>
          <select className={field} value={loc} onChange={(e) => setLoc(e.target.value)}>
            {locs.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-2">
          {(
            [
              ['add', 'Add'],
              ['remove', 'Remove'],
              ['set', 'Set to'],
            ] as [Mode, string][]
          ).map(([m, t]) => (
            <button key={m} type="button" onClick={() => changeMode(m)} className={`flex-1 rounded-xl border px-3 py-2 text-sm font-semibold ${mode === m ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
              {t}
            </button>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={labelCls}>{mode === 'set' ? 'New quantity' : 'Quantity'}</label>
            <input className={field} inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))} autoFocus />
          </div>
          <div>
            <label className={labelCls}>Reason</label>
            <select className={field} value={reason} onChange={(e) => setReason(e.target.value as Reason)}>
              {reasons.map((r) => (
                <option key={r.v} value={r.v}>
                  {r.t}
                </option>
              ))}
            </select>
          </div>
        </div>

        {single && (
          <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">
            Now <b>{here}</b>
            {after !== null && (
              <>
                {' '}
                → after <b className={after < 0 ? 'text-red-600' : ''}>{after}</b>
              </>
            )}
          </p>
        )}

        <div>
          <label className={labelCls}>Note (optional)</label>
          <input className={field} maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} placeholder="For example: delivery from supplier" />
        </div>

        <div className="flex gap-3">
          <button type="button" className={btn} onClick={submit} disabled={busy}>
            {busy ? 'Saving...' : 'Save'}
          </button>
          <button type="button" className={ghost} onClick={onClose} disabled={busy}>
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ---------------------------------- stock count ---------------------------------- */

export function StocktakeModal({ items, locs, initialLoc, onClose, onDone }: { items: Item[]; locs: Loc[]; initialLoc: string; onClose: () => void; onDone: (msg: string) => void }) {
  const sb = useMemo(() => createClient(), []);
  const [loc, setLoc] = useState(initialLoc);
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const term = q.trim().toLowerCase();
  const visible = items.filter((i) => !term || `${itemLabel(i)} ${i.sku ?? ''} ${i.barcode ?? ''}`.toLowerCase().includes(term));
  const shown = visible.slice(0, 200);

  const changes = items
    .map((i) => ({ i, raw: counts[`${loc}|${i.key}`] }))
    .filter((x) => x.raw !== undefined && /^\d{1,9}$/.test(x.raw) && Number(x.raw) !== qtyAt(x.i, loc))
    .map((x) => ({ i: x.i, qty: Number(x.raw), diff: Number(x.raw) - qtyAt(x.i, loc) }));
  const up = changes.filter((c) => c.diff > 0).reduce((s, c) => s + c.diff, 0);
  const down = changes.filter((c) => c.diff < 0).reduce((s, c) => s - c.diff, 0);
  const bad = Object.entries(counts).some(([k, v]) => k.startsWith(`${loc}|`) && v !== '' && !/^\d{1,9}$/.test(v));

  const setCount = (key: string, v: string) => setCounts((c) => ({ ...c, [`${loc}|${key}`]: v.replace(/\D/g, '') }));

  async function apply() {
    setErr('');
    if (changes.length === 0) return setErr('Type the quantities you counted. Only items that differ are changed.');
    setBusy(true);
    const e = await runBatch(sb, 'xenon_set_inventory_batch', loc, changes.map((c) => ({ ...pid(c.i), qty: c.qty })), 'recount', 'Stock count');
    if (e) {
      setErr(e);
      setBusy(false);
      return;
    }
    onDone(`Stock count saved: ${changes.length} item${changes.length === 1 ? '' : 's'} corrected at ${locs.find((l) => l.id === loc)?.name ?? 'this location'}.`);
  }

  return (
    <Modal title="Count stock" onClose={onClose} wide>
      <div className="space-y-4">
        <p className="text-sm text-slate-600">Count what is on the shelf and type it in. Leave an item blank to skip it. Only items that differ from the system are changed, and each change is kept in the history.</p>
        <Err text={err} />
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className={labelCls}>Location</label>
            <select className={`${field} w-auto`} value={loc} onChange={(e) => setLoc(e.target.value)}>
              {locs.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-[10rem] flex-1">
            <label className={labelCls}>Find an item</label>
            <input className={field} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, SKU or barcode" />
          </div>
          <button
            type="button"
            className={ghost}
            onClick={() =>
              setCounts((c) => {
                const next = { ...c };
                for (const i of shown) if (next[`${loc}|${i.key}`] === undefined) next[`${loc}|${i.key}`] = String(qtyAt(i, loc));
                return next;
              })
            }
          >
            Fill with current numbers
          </button>
        </div>

        <div className="max-h-[45vh] overflow-auto rounded-xl border border-slate-200">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">Item</th>
                <th className="px-2 py-2 text-right">In system</th>
                <th className="px-2 py-2">Counted</th>
                <th className="px-2 py-2 text-right">Difference</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {shown.map((i) => {
                const raw = counts[`${loc}|${i.key}`] ?? '';
                const have = qtyAt(i, loc);
                const diff = raw !== '' && /^\d+$/.test(raw) ? Number(raw) - have : null;
                return (
                  <tr key={i.key}>
                    <td className="px-3 py-2">
                      <span className="flex items-center gap-2">
                        <Thumb url={i.cover} size="h-8 w-8" />
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-slate-900">{itemLabel(i)}</span>
                          {i.sku && <span className="block text-xs text-slate-400">{i.sku}</span>}
                        </span>
                      </span>
                    </td>
                    <td className="px-2 py-2 text-right text-slate-700">{have}</td>
                    <td className="px-2 py-2">
                      <input className="w-24 rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-blue-600" inputMode="numeric" value={raw} onChange={(e) => setCount(i.key, e.target.value)} aria-label={`Counted ${itemLabel(i)}`} />
                    </td>
                    <td className={`px-2 py-2 text-right font-medium ${diff === null || diff === 0 ? 'text-slate-400' : diff > 0 ? 'text-green-700' : 'text-red-600'}`}>{diff === null ? '' : diff > 0 ? `+${diff}` : diff}</td>
                  </tr>
                );
              })}
              {shown.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-slate-500">
                    No items match.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {visible.length > shown.length && <p className="text-xs text-slate-500">Showing the first {shown.length} of {visible.length}. Search to narrow the list.</p>}

        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-slate-600">
            {changes.length} difference{changes.length === 1 ? '' : 's'} · <span className="text-green-700">+{up}</span> / <span className="text-red-600">-{down}</span> units
          </p>
          <button type="button" className={`${btn} sm:ml-auto`} onClick={apply} disabled={busy || bad || changes.length === 0}>
            {busy ? 'Saving...' : 'Apply counts'}
          </button>
          <button type="button" className={ghost} onClick={onClose} disabled={busy}>
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ---------------------------------- import counts ---------------------------------- */

export function ImportCountsModal({ items, locs, initialLoc, onClose, onDone }: { items: Item[]; locs: Loc[]; initialLoc: string; onClose: () => void; onDone: (msg: string) => void }) {
  const sb = useMemo(() => createClient(), []);
  const [fallback, setFallback] = useState(initialLoc);
  const [text, setText] = useState('');
  const [fileName, setFileName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const parsed: CountParse | null = useMemo(() => (text ? parseCounts(text, items, locs, locs.find((l) => l.id === fallback) ?? null) : null), [text, items, locs, fallback]);

  async function choose(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) return setErr('That file is over 5 MB.');
    setErr('');
    setFileName(f.name);
    setText(await f.text());
  }

  async function apply() {
    if (!parsed || parsed.counts.length === 0) return;
    setBusy(true);
    setErr('');
    const byLoc = new Map<string, typeof parsed.counts>();
    for (const c of parsed.counts) byLoc.set(c.locationId, [...(byLoc.get(c.locationId) ?? []), c]);
    for (const [locationId, list] of byLoc) {
      const e = await runBatch(sb, 'xenon_set_inventory_batch', locationId, list.map((c) => ({ ...pid(c.item), qty: c.qty })), 'recount', 'CSV import');
      if (e) {
        setErr(e);
        setBusy(false);
        return;
      }
    }
    onDone(`Imported counts: ${parsed.counts.length} change${parsed.counts.length === 1 ? '' : 's'} applied.`);
  }

  return (
    <Modal title="Import stock counts" onClose={onClose} wide>
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          Use a file exported from this page. Rows are matched by SKU, or by Handle and Variant. Put counts in columns named <b>On hand (Location name)</b>, or use one <b>On hand</b> column for the location below.
        </p>
        <Err text={err} />
        <div className="flex flex-wrap items-end gap-3">
          <label className={`${ghost} cursor-pointer`}>
            {fileName || 'Choose CSV file'}
            <input type="file" accept=".csv,text/csv" className="hidden" onChange={choose} />
          </label>
          <div>
            <label className={labelCls}>Location for a single quantity column</label>
            <select className={`${field} w-auto`} value={fallback} onChange={(e) => setFallback(e.target.value)}>
              {locs.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {parsed && (
          <div className="space-y-3">
            {parsed.errors.length > 0 && (
              <div className="max-h-40 overflow-auto rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
                <p className="font-semibold">{parsed.errors.length} problem{parsed.errors.length === 1 ? '' : 's'} found (these rows are skipped)</p>
                <ul className="mt-1 list-disc pl-5">
                  {parsed.errors.slice(0, 30).map((m, i) => (
                    <li key={i}>{m}</li>
                  ))}
                </ul>
              </div>
            )}
            <p className="text-sm text-slate-700">
              {parsed.counts.length} change{parsed.counts.length === 1 ? '' : 's'} to apply · {parsed.unchanged} already match
            </p>
            {parsed.counts.length > 0 && (
              <div className="max-h-56 overflow-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Item</th>
                      <th className="px-2 py-2">Location</th>
                      <th className="px-2 py-2 text-right">Now</th>
                      <th className="px-2 py-2 text-right">New</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {parsed.counts.slice(0, 100).map((c, i) => (
                      <tr key={i}>
                        <td className="px-3 py-1.5">{itemLabel(c.item)}</td>
                        <td className="px-2 py-1.5">{c.locationName}</td>
                        <td className="px-2 py-1.5 text-right">{c.before}</td>
                        <td className="px-2 py-1.5 text-right font-semibold">{c.qty}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {parsed.counts.length > 100 && <p className="text-xs text-slate-500">Showing the first 100 changes.</p>}
          </div>
        )}

        <div className="flex gap-3">
          <button type="button" className={btn} onClick={apply} disabled={busy || !parsed || parsed.counts.length === 0}>
            {busy ? 'Importing...' : 'Apply changes'}
          </button>
          <button type="button" className={ghost} onClick={onClose} disabled={busy}>
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ----------------------------------- reorder ----------------------------------- */

export function ReorderModal({ items, locIds, onClose }: { items: Item[]; locIds: string[]; onClose: () => void }) {
  const groups = useMemo(() => reorderGroups(items, locIds), [items, locIds]);
  const [copied, setCopied] = useState('');

  async function copy(vendor: string) {
    const g = groups.find((x) => x.vendor === vendor);
    if (!g) return;
    const lines = [`Order list${vendor ? ` for ${vendor}` : ''}`, ...g.rows.map((r) => `${r.suggest} x ${itemLabel(r.item)}${r.item.sku ? ` (${r.item.sku})` : ''}`)];
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopied(vendor);
      setTimeout(() => setCopied(''), 2000);
    } catch {
      setCopied('');
    }
  }

  const count = groups.reduce((s, g) => s + g.rows.length, 0);
  return (
    <Modal title="Reorder report" onClose={onClose} wide>
      <div className="space-y-4">
        {count === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">Nothing needs reordering. Every tracked item is above its warning level.</p>
        ) : (
          <>
            <p className="text-sm text-slate-600">
              {count} item{count === 1 ? '' : 's'} at or below the warning level, grouped by vendor. The suggested amount brings each item back to twice its warning level.
            </p>
            <button type="button" className={ghost} onClick={() => downloadCsv(`reorder-${today()}.csv`, reorderToCsv(groups))}>
              Download CSV
            </button>
            {groups.map((g) => (
              <div key={g.vendor || 'none'} className="rounded-xl border border-slate-200">
                <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-3 py-2">
                  <p className="font-semibold text-slate-900">{g.vendor || 'No vendor set'}</p>
                  <p className="text-xs text-slate-500">{g.rows.length} item{g.rows.length === 1 ? '' : 's'}{g.total !== null ? ` · about ${naira(g.total)}` : ''}</p>
                  <button type="button" onClick={() => copy(g.vendor)} className="ml-auto text-sm font-medium text-blue-600 hover:underline">
                    {copied === g.vendor ? 'Copied' : 'Copy list'}
                  </button>
                </div>
                <table className="w-full text-left text-sm">
                  <tbody className="divide-y divide-slate-100">
                    {g.rows.map((r) => (
                      <tr key={r.item.key}>
                        <td className="px-3 py-2">
                          <span className="block font-medium text-slate-900">{itemLabel(r.item)}</span>
                          {r.item.sku && <span className="block text-xs text-slate-400">{r.item.sku}</span>}
                        </td>
                        <td className="px-2 py-2 text-right text-slate-500">Have {r.qty}</td>
                        <td className="px-3 py-2 text-right font-semibold text-slate-900">Order {r.suggest}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </>
        )}
        <button type="button" className={ghost} onClick={onClose}>
          Close
        </button>
      </div>
    </Modal>
  );
}
