'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ImagePlus, Plus, Search, Trash2, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import {
  PRODUCT_COLS,
  coverOf,
  emptyRules,
  matchesRules,
  naira,
  readProduct,
  readRules,
  ruleFields,
  slugify,
  sortLabels,
  sortProducts,
  uniqueHandle,
  type Product,
  type Rule,
  type Rules,
  type RuleField,
  type SortBy,
} from '@/lib/products';
import { Badge, Err, ListSkeleton, Modal, SQL_HINT, Toggle, btn, card, danger, fetchAll, field, ghost, labelCls, needsSql } from '@/components/products/ui';

type Coll = {
  id: string;
  title: string;
  handle: string;
  description: string | null;
  image_url: string | null;
  kind: 'manual' | 'smart';
  rules: Rules;
  sort_by: SortBy;
  published: boolean;
  seo_title: string | null;
  seo_description: string | null;
};

const COLS = 'id,title,handle,description,image_url,kind,rules,sort_by,published,seo_title,seo_description';
const BUCKET = 'product-images';
const MAX_BYTES = 5 * 1024 * 1024;
const TYPES = ['image/jpeg', 'image/png', 'image/webp'];

function readColl(r: Record<string, unknown>): Coll {
  const s = (v: unknown) => (typeof v === 'string' ? v : null);
  const sort = String(r.sort_by) as SortBy;
  return {
    id: String(r.id),
    title: s(r.title) ?? '',
    handle: s(r.handle) ?? '',
    description: s(r.description),
    image_url: s(r.image_url),
    kind: r.kind === 'smart' ? 'smart' : 'manual',
    rules: readRules(r.rules),
    sort_by: sort in sortLabels ? sort : 'manual',
    published: r.published !== false,
    seo_title: s(r.seo_title),
    seo_description: s(r.seo_description),
  };
}

export default function CollectionsPage({ businessId }: { businessId: string }) {
  const sb = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [fatal, setFatal] = useState('');
  const [colls, setColls] = useState<Coll[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [editing, setEditing] = useState<Coll | 'new' | null>(null);
  const [q, setQ] = useState('');

  const load = useCallback(async () => {
    const [c, p, m] = await Promise.all([
      sb.from('collections').select(COLS).eq('business_id', businessId).order('created_at', { ascending: false }),
      fetchAll<Record<string, unknown>>((a, b) => sb.from('products').select(PRODUCT_COLS).eq('business_id', businessId).order('created_at', { ascending: false }).range(a, b)),
      fetchAll<{ collection_id: string }>((a, b) => sb.from('collection_products').select('collection_id').eq('business_id', businessId).range(a, b)),
    ]);
    const msg = c.error?.message || p.error || m.error;
    if (msg) {
      setFatal(needsSql(msg) ? SQL_HINT : msg);
      setLoading(false);
      return;
    }
    setFatal('');
    setColls(((c.data ?? []) as Record<string, unknown>[]).map(readColl));
    setProducts(p.data.map(readProduct));
    const n: Record<string, number> = {};
    for (const r of m.data) n[r.collection_id] = (n[r.collection_id] ?? 0) + 1;
    setCounts(n);
    setLoading(false);
  }, [sb, businessId]);

  useEffect(() => {
    load();
  }, [load]);

  const countOf = (c: Coll) => (c.kind === 'smart' ? products.filter((p) => matchesRules(p, c.rules)).length : counts[c.id] ?? 0);
  const shown = colls.filter((c) => !q.trim() || c.title.toLowerCase().includes(q.trim().toLowerCase()));

  if (loading) return <ListSkeleton rows={4} />;
  if (fatal) return <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">{fatal}</p>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[12rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input className={`${field} pl-9`} placeholder="Search collections" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <button type="button" className={`${btn} inline-flex items-center gap-1.5`} onClick={() => setEditing('new')}>
          <Plus className="h-4 w-4" /> Create collection
        </button>
      </div>

      {colls.length === 0 ? (
        <div className={`${card} py-12 text-center`}>
          <p className="font-display text-lg font-bold text-slate-900">Group your products</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">Collections like “New arrivals” or “Under ₦10,000” help customers find things. Pick products yourself, or set rules and let Xenon fill it.</p>
          <button type="button" className={`${btn} mt-4`} onClick={() => setEditing('new')}>
            Create collection
          </button>
        </div>
      ) : shown.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500">No collection matches your search.</p>
      ) : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {shown.map((c) => (
            <li key={c.id}>
              <button type="button" onClick={() => setEditing(c)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50">
                <span className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {c.image_url && <img src={c.image_url} alt="" className="h-full w-full object-cover" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-slate-900">{c.title}</span>
                  <span className="block text-xs text-slate-500">
                    {countOf(c)} product{countOf(c) === 1 ? '' : 's'} · {c.kind === 'smart' ? 'Smart' : 'Manual'}
                  </span>
                </span>
                <Badge tone={c.published ? 'green' : 'grey'}>{c.published ? 'Visible' : 'Hidden'}</Badge>
              </button>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <CollectionEditor
          key={editing === 'new' ? 'new' : editing.id}
          businessId={businessId}
          coll={editing === 'new' ? null : editing}
          products={products}
          allHandles={colls.filter((c) => editing === 'new' || c.id !== editing.id).map((c) => c.handle)}
          onClose={(changed) => {
            setEditing(null);
            if (changed) load();
          }}
        />
      )}
    </div>
  );
}

/* --------------------------------- editor --------------------------------- */

function CollectionEditor({ businessId, coll, products, allHandles, onClose }: { businessId: string; coll: Coll | null; products: Product[]; allHandles: string[]; onClose: (changed: boolean) => void }) {
  const sb = useMemo(() => createClient(), []);
  const [title, setTitle] = useState(coll?.title ?? '');
  const [handle, setHandle] = useState(coll?.handle ?? '');
  const [touched, setTouched] = useState(!!coll);
  const [description, setDescription] = useState(coll?.description ?? '');
  const [image, setImage] = useState<string | null>(coll?.image_url ?? null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [kind, setKind] = useState<'manual' | 'smart'>(coll?.kind ?? 'manual');
  const [rules, setRules] = useState<Rules>(coll?.rules ?? { ...emptyRules, conditions: [{ field: 'tag', value: '' }] });
  const [sortBy, setSortBy] = useState<SortBy>(coll?.sort_by ?? 'manual');
  const [published, setPublished] = useState(coll?.published ?? true);
  const [seoTitle, setSeoTitle] = useState(coll?.seo_title ?? '');
  const [seoDesc, setSeoDesc] = useState(coll?.seo_description ?? '');
  const [members, setMembers] = useState<string[]>([]);
  const [members0, setMembers0] = useState<string[]>([]);
  const [ready, setReady] = useState(!coll || coll.kind === 'smart');
  const [pick, setPick] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  // Manual collections load their saved order. Smart ones need nothing.
  useEffect(() => {
    if (!coll) return;
    let alive = true;
    (async () => {
      const { data, error } = await sb.from('collection_products').select('product_id,position').eq('collection_id', coll.id).order('position', { ascending: true });
      if (!alive) return;
      if (error) {
        setErr(error.message);
        return;
      }
      const ids = ((data ?? []) as { product_id: string }[]).map((r) => r.product_id).filter((id) => byId.has(id));
      setMembers(ids);
      setMembers0(ids);
      setReady(true);
    })();
    return () => {
      alive = false;
    };
  }, [sb, coll, byId]);

  const matched = useMemo(() => (kind === 'smart' ? sortProducts(products.filter((p) => matchesRules(p, rules)), sortBy) : []), [kind, products, rules, sortBy]);

  function setRule(i: number, patch: Partial<Rule>) {
    setRules((r) => ({ ...r, conditions: r.conditions.map((c, j) => (j === i ? { ...c, ...patch } : c)) }));
  }
  function move(i: number, d: number) {
    setMembers((l) => {
      const j = i + d;
      if (j < 0 || j >= l.length) return l;
      const n = [...l];
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });
  }
  function chooseFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (!TYPES.includes(f.type)) return setErr('Use a JPG, PNG or WebP image.');
    if (f.size > MAX_BYTES) return setErr('The image is over 5 MB.');
    setErr('');
    if (preview) URL.revokeObjectURL(preview);
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  const candidates = products.filter((p) => !members.includes(p.id) && (!pick.trim() || p.name.toLowerCase().includes(pick.trim().toLowerCase()))).slice(0, 8);

  async function save() {
    setErr('');
    const t = title.trim();
    if (!t) return setErr('Enter a collection title.');
    let h = touched && handle.trim() ? slugify(handle, 'collection') : '';
    const taken = new Set(allHandles);
    if (h && taken.has(h)) return setErr('Another collection already uses that URL handle.');
    if (!h) h = uniqueHandle(t, taken, 'collection');
    if (kind === 'smart' && !rules.conditions.some((c) => c.value.trim())) return setErr('Add at least one condition with a value, or switch to a manual collection.');
    for (const c of rules.conditions) {
      const f = ruleFields.find((x) => x.v === c.field);
      if (f?.number && c.value.trim() && !/^\d{1,9}$/.test(c.value.trim())) return setErr(`“${f.t}” needs a whole number.`);
    }

    setSaving(true);
    try {
      let url = image;
      if (file) {
        const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
        const path = `${businessId}/collection-${crypto.randomUUID()}.${ext}`;
        const up = await sb.storage.from(BUCKET).upload(path, file, { contentType: file.type, cacheControl: '31536000' });
        if (up.error) throw new Error('Could not upload the image: ' + up.error.message);
        url = sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
      }
      const payload = {
        title: t,
        handle: h,
        description: description.trim() || null,
        image_url: url,
        kind,
        rules: { match: rules.match, conditions: rules.conditions.filter((c) => c.value.trim()).map((c) => ({ field: c.field, value: c.value.trim() })) },
        sort_by: sortBy,
        published,
        seo_title: seoTitle.trim().slice(0, 70) || null,
        seo_description: seoDesc.trim().slice(0, 320) || null,
      };
      let id = coll?.id ?? '';
      if (coll) {
        const { error } = await sb.from('collections').update(payload).eq('id', coll.id).eq('business_id', businessId);
        if (error) throw new Error(error.message);
      } else {
        const { data, error } = await sb.from('collections').insert({ ...payload, business_id: businessId }).select('id').single();
        if (error) throw new Error(error.message);
        id = (data as { id: string }).id;
      }

      if (kind === 'manual') {
        const drop = members0.filter((m) => !members.includes(m));
        if (drop.length) {
          const { error } = await sb.from('collection_products').delete().eq('collection_id', id).in('product_id', drop);
          if (error) throw new Error(error.message);
        }
        if (members.length) {
          const rows = members.map((product_id, position) => ({ collection_id: id, product_id, business_id: businessId, position }));
          const { error } = await sb.from('collection_products').upsert(rows, { onConflict: 'collection_id,product_id' });
          if (error) throw new Error(error.message);
        }
      } else if (members0.length) {
        // Switched to smart: the hand-picked list is no longer used.
        const { error } = await sb.from('collection_products').delete().eq('collection_id', id);
        if (error) throw new Error(error.message);
      }
      onClose(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not save this collection.');
      setSaving(false);
    }
  }

  async function remove() {
    if (!coll || !window.confirm(`Delete the collection "${coll.title}"? Your products are not deleted.`)) return;
    setSaving(true);
    const { error } = await sb.from('collections').delete().eq('id', coll.id).eq('business_id', businessId);
    if (error) {
      setErr(error.message);
      setSaving(false);
      return;
    }
    onClose(true);
  }

  const thumb = (p: Product) => {
    const u = coverOf(p);
    // eslint-disable-next-line @next/next/no-img-element
    return <span className="h-9 w-9 shrink-0 overflow-hidden rounded-md bg-slate-100">{u && <img src={u} alt="" className="h-full w-full object-cover" />}</span>;
  };

  return (
    <Modal title={coll ? 'Edit collection' : 'Create collection'} onClose={() => onClose(false)} wide>
      <div className="space-y-4">
        <Err text={err} />
        <div>
          <label className={labelCls}>Title</label>
          <input
            className={field}
            maxLength={120}
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (!touched) setHandle(slugify(e.target.value, 'collection'));
            }}
            placeholder="New arrivals"
          />
        </div>
        <div>
          <label className={labelCls}>Description</label>
          <textarea className={field} rows={3} maxLength={2000} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>

        <div>
          <label className={labelCls}>Image</label>
          <div className="flex items-center gap-3">
            <span className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50 text-slate-300">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {preview || image ? <img src={preview ?? image ?? ''} alt="" className="h-full w-full object-cover" /> : <ImagePlus className="h-6 w-6" />}
            </span>
            <label className={`${ghost} cursor-pointer`}>
              {preview || image ? 'Change' : 'Add image'}
              <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={chooseFile} />
            </label>
            {(preview || image) && (
              <button
                type="button"
                className="text-sm text-red-600 hover:underline"
                onClick={() => {
                  if (preview) URL.revokeObjectURL(preview);
                  setPreview(null);
                  setFile(null);
                  setImage(null);
                }}
              >
                Remove
              </button>
            )}
          </div>
        </div>

        <fieldset className="space-y-2 rounded-xl border border-slate-200 p-3">
          <legend className="px-1 text-xs font-medium text-slate-600">How products get in</legend>
          <label className="flex items-start gap-2 text-sm text-slate-700">
            <input type="radio" name="kind" className="mt-1" checked={kind === 'manual'} onChange={() => setKind('manual')} />
            <span>
              <b>Manual</b>: you choose each product.
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm text-slate-700">
            <input type="radio" name="kind" className="mt-1" checked={kind === 'smart'} onChange={() => setKind('smart')} />
            <span>
              <b>Smart</b>: products join by themselves when they match your rules, including new ones.
            </span>
          </label>
        </fieldset>

        {kind === 'manual' ? (
          <div className="space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input className={`${field} pl-9`} placeholder="Search products to add" value={pick} onChange={(e) => setPick(e.target.value)} />
            </div>
            {pick.trim() && (
              <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                {candidates.length === 0 && <li className="px-3 py-2 text-sm text-slate-500">No products found.</li>}
                {candidates.map((p) => (
                  <li key={p.id}>
                    <button type="button" className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-slate-50" onClick={() => setMembers((l) => [...l, p.id])}>
                      {thumb(p)}
                      <span className="min-w-0 flex-1 truncate text-sm text-slate-900">{p.name}</span>
                      <span className="text-xs text-slate-500">{naira(p.price)}</span>
                      <Plus className="h-4 w-4 text-blue-600" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {!ready ? (
              <ListSkeleton rows={2} />
            ) : members.length === 0 ? (
              <p className="text-sm text-slate-500">No products yet. Search above to add some.</p>
            ) : (
              <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                {members.map((id, i) => {
                  const p = byId.get(id);
                  if (!p) return null;
                  return (
                    <li key={id} className="flex items-center gap-2 px-3 py-2">
                      {thumb(p)}
                      <span className="min-w-0 flex-1 truncate text-sm text-slate-900">{p.name}</span>
                      <button type="button" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)} className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30">
                        ↑
                      </button>
                      <button type="button" aria-label="Move down" disabled={i === members.length - 1} onClick={() => move(i, 1)} className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30">
                        ↓
                      </button>
                      <button type="button" aria-label={`Remove ${p.name}`} onClick={() => setMembers((l) => l.filter((x) => x !== id))} className="rounded p-1 text-red-500 hover:bg-red-50">
                        <X className="h-4 w-4" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="text-xs text-slate-400">The order here is used when “Sort by” is Manually.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-sm text-slate-700">
              Products must match
              <select className={`${field} w-auto`} value={rules.match} onChange={(e) => setRules((r) => ({ ...r, match: e.target.value as 'all' | 'any' }))}>
                <option value="all">all conditions</option>
                <option value="any">any condition</option>
              </select>
            </div>
            {rules.conditions.map((c, i) => {
              const f = ruleFields.find((x) => x.v === c.field);
              return (
                <div key={i} className="flex flex-wrap items-center gap-2">
                  <select className={`${field} w-auto`} value={c.field} onChange={(e) => setRule(i, { field: e.target.value as RuleField })}>
                    {ruleFields.map((x) => (
                      <option key={x.v} value={x.v}>
                        {x.t}
                      </option>
                    ))}
                  </select>
                  <input className={`${field} min-w-[8rem] flex-1`} inputMode={f?.number ? 'numeric' : undefined} value={c.value} onChange={(e) => setRule(i, { value: f?.number ? e.target.value.replace(/\D/g, '') : e.target.value })} />
                  <button type="button" aria-label="Remove condition" onClick={() => setRules((r) => ({ ...r, conditions: r.conditions.filter((_, j) => j !== i) }))} className="rounded-lg p-2 text-red-500 hover:bg-red-50">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
            {rules.conditions.length < 10 && (
              <button type="button" className={ghost} onClick={() => setRules((r) => ({ ...r, conditions: [...r.conditions, { field: 'tag', value: '' }] }))}>
                Add condition
              </button>
            )}
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-sm font-medium text-slate-800">
                {matched.length} product{matched.length === 1 ? '' : 's'} match right now
              </p>
              {matched.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {matched.slice(0, 5).map((p) => (
                    <li key={p.id} className="flex items-center gap-2 text-sm text-slate-700">
                      {thumb(p)}
                      <span className="truncate">{p.name}</span>
                    </li>
                  ))}
                  {matched.length > 5 && <li className="text-xs text-slate-500">and {matched.length - 5} more</li>}
                </ul>
              )}
            </div>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Sort by</label>
            <select className={field} value={sortBy} onChange={(e) => setSortBy(e.target.value as SortBy)}>
              {(Object.keys(sortLabels) as SortBy[])
                .filter((s) => s !== 'manual' || kind === 'manual')
                .map((s) => (
                  <option key={s} value={s}>
                    {sortLabels[s]}
                  </option>
                ))}
            </select>
          </div>
          <div className="pt-5">
            <Toggle on={published} onChange={setPublished} label="Show on my website" hint="Hidden collections are not shown to customers." />
          </div>
        </div>

        <details className="rounded-xl border border-slate-200 p-3">
          <summary className="cursor-pointer text-sm font-medium text-slate-800">Search engine listing</summary>
          <div className="mt-3 space-y-3">
            <div>
              <label className={labelCls}>Page title ({seoTitle.length}/70)</label>
              <input className={field} maxLength={70} value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Description ({seoDesc.length}/320)</label>
              <textarea className={field} rows={3} maxLength={320} value={seoDesc} onChange={(e) => setSeoDesc(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>URL handle</label>
              <input
                className={field}
                maxLength={100}
                value={handle}
                onChange={(e) => {
                  setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'));
                  setTouched(true);
                }}
              />
            </div>
          </div>
        </details>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button type="button" className={btn} onClick={save} disabled={saving || !ready}>
            {saving ? 'Saving...' : coll ? 'Save changes' : 'Create collection'}
          </button>
          <button type="button" className={ghost} onClick={() => onClose(false)} disabled={saving}>
            Cancel
          </button>
          {coll && (
            <button type="button" className={`${danger} sm:ml-auto`} onClick={remove} disabled={saving}>
              Delete
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
