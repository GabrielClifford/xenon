'use client';

import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { appliesTo, valueList, type FieldDefinition } from '@/lib/customFields';
import { PRODUCT_COLS, VARIANT_COLS, coverOf, isLive, matchesRules, naira, readProduct, readRules, readVariant, sortLabels, sortProducts, type Product, type Rules, type SortBy, type VariantRow } from '@/lib/products';

type Coll = { id: string; title: string; kind: 'manual' | 'smart'; rules: Rules; sort_by: SortBy };

// Older databases may not have the newer product columns yet, so we step down to what exists.
const LEGACY = 'id,name,description,price,category,photo_url,images,available,custom_fields,created_at';
const LEGACY_OLD = 'id,name,description,price,category,image_url,available,custom_fields,created_at';

function whatsappNumber(phone?: string | null): string | null {
  if (!phone) return null;
  let d = phone.replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('0')) d = '234' + d.slice(1);
  return d.length >= 10 ? d : null;
}

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

function Single({ def, value }: { def: FieldDefinition; value: unknown }) {
  const s = String(value);
  if (def.type === 'boolean') return <>{value === true ? 'Yes' : 'No'}</>;
  if (def.type === 'number') return <>{Number(value).toLocaleString('en-NG')}</>;
  if (def.type === 'date') {
    const d = new Date(s);
    return <>{Number.isNaN(d.getTime()) ? s : d.toLocaleDateString('en-NG')}</>;
  }
  if (def.type === 'url' && /^https?:\/\//i.test(s)) {
    return (
      <a href={s} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
        {s}
      </a>
    );
  }
  if (def.type === 'color' && HEX.test(s)) {
    return (
      <>
        <span className="mr-1 inline-block h-3 w-3 rounded-full border border-slate-300 align-middle" style={{ backgroundColor: s }} />
        {s}
      </>
    );
  }
  return <>{s}</>;
}

const soldOut = (p: Product, vs: VariantRow[]) => {
  if (!p.available) return true;
  if (!p.track_stock || p.continue_selling) return false;
  return vs.length ? vs.every((v) => v.stock <= 0) : p.stock <= 0;
};

export default function ProductsSection({ businessId, businessName, phone }: { businessId: string; businessName: string; phone?: string | null }) {
  const sb = useMemo(() => createClient(), []);
  const [items, setItems] = useState<Product[] | null>(null);
  const [variants, setVariants] = useState<Record<string, VariantRow[]>>({});
  const [colls, setColls] = useState<Coll[]>([]);
  const [members, setMembers] = useState<Record<string, string[]>>({});
  const [defs, setDefs] = useState<FieldDefinition[]>([]);
  const [q, setQ] = useState('');
  const [coll, setColl] = useState('');
  const [sort, setSort] = useState<'featured' | SortBy>('featured');
  const [open, setOpen] = useState<Product | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      let rows: Record<string, unknown>[] | null = null;
      for (const cols of [PRODUCT_COLS, LEGACY, LEGACY_OLD]) {
        const { data, error } = await sb.from('products').select(cols).eq('business_id', businessId).order('created_at', { ascending: false }).limit(500);
        if (!error) {
          rows = (data ?? []) as unknown as Record<string, unknown>[];
          break;
        }
      }
      if (!alive) return;
      const list = (rows ?? []).map((r) => readProduct({ ...r, photo_url: r.photo_url ?? r.image_url })).filter((p) => isLive(p));
      setItems(list);
      if (!list.length) return;

      const [v, c, m, d] = await Promise.all([
        sb.from('product_variants').select(VARIANT_COLS).eq('business_id', businessId).order('position', { ascending: true }).limit(5000),
        sb.from('collections').select('id,title,kind,rules,sort_by').eq('business_id', businessId).eq('published', true).order('title'),
        sb.from('collection_products').select('collection_id,product_id,position').eq('business_id', businessId).order('position', { ascending: true }).limit(5000),
        sb.from('field_definitions').select('id,name,key,type,is_list,description,show_on_site,categories').eq('business_id', businessId).eq('resource', 'product').eq('show_on_site', true).order('sort_order', { ascending: true }),
      ]);
      if (!alive) return;
      const byProduct: Record<string, VariantRow[]> = {};
      for (const r of (v.data ?? []) as Record<string, unknown>[]) {
        const x = readVariant(r);
        (byProduct[x.product_id] ??= []).push(x);
      }
      setVariants(byProduct);
      setColls(((c.data ?? []) as Record<string, unknown>[]).map((r) => ({ id: String(r.id), title: String(r.title ?? ''), kind: r.kind === 'smart' ? 'smart' : 'manual', rules: readRules(r.rules), sort_by: String(r.sort_by) in sortLabels ? (r.sort_by as SortBy) : 'manual' })));
      const mem: Record<string, string[]> = {};
      for (const r of (m.data ?? []) as { collection_id: string; product_id: string }[]) (mem[r.collection_id] ??= []).push(r.product_id);
      setMembers(mem);
      setDefs((d.data ?? []) as FieldDefinition[]);
    })();
    return () => {
      alive = false;
    };
  }, [sb, businessId]);

  const visible = useMemo(() => {
    if (!items) return [];
    let list = items;
    let order: string[] | undefined;
    let by: 'featured' | SortBy = sort;
    const active = colls.find((c) => c.id === coll);
    if (active) {
      if (active.kind === 'smart') list = list.filter((p) => matchesRules(p, active.rules));
      else {
        order = members[active.id] ?? [];
        const set = new Set(order);
        list = list.filter((p) => set.has(p.id));
      }
      if (by === 'featured') by = active.sort_by;
    }
    const term = q.trim().toLowerCase();
    if (term) list = list.filter((p) => `${p.name} ${p.category ?? ''} ${p.product_type ?? ''} ${p.vendor ?? ''} ${p.tags.join(' ')}`.toLowerCase().includes(term));
    return by === 'featured' ? list : sortProducts(list, by, order);
  }, [items, colls, members, coll, q, sort]);

  if (!items || items.length === 0) return null;

  const grouped = !q.trim() && !coll && sort === 'featured';
  const groups: [string, Product[]][] = grouped
    ? Array.from(
        visible.reduce((m, p) => {
          const k = p.category?.trim() || '';
          m.set(k, [...(m.get(k) ?? []), p]);
          return m;
        }, new Map<string, Product[]>()),
      ).sort((a, b) => (a[0] === '' ? 1 : b[0] === '' ? -1 : 0))
    : [['', visible]];
  const showCollections = colls.filter((c) => c.kind === 'smart' || (members[c.id]?.length ?? 0) > 0);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: visible.slice(0, 50).map((p, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'Product',
        name: p.seo_title || p.name,
        description: p.seo_description || p.description || undefined,
        image: coverOf(p) || undefined,
        sku: p.sku || undefined,
        brand: p.vendor ? { '@type': 'Brand', name: p.vendor } : undefined,
        offers: { '@type': 'Offer', priceCurrency: 'NGN', price: String(p.price), availability: soldOut(p, variants[p.id] ?? []) ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock', seller: { '@type': 'Organization', name: businessName } },
      },
    })),
  };

  return (
    <section id="products" className="mx-auto max-w-6xl px-4 py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <h2 className="font-display text-2xl font-bold text-slate-900">Products</h2>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products" aria-label="Search products" className="min-w-[10rem] flex-1 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm outline-none focus:border-blue-600" />
        <select value={sort} onChange={(e) => setSort(e.target.value as 'featured' | SortBy)} aria-label="Sort products" className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-600">
          <option value="featured">Featured</option>
          {(Object.keys(sortLabels) as SortBy[]).filter((s) => s !== 'manual').map((s) => (
            <option key={s} value={s}>
              {sortLabels[s]}
            </option>
          ))}
        </select>
      </div>

      {showCollections.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {[{ id: '', title: 'All' }, ...showCollections].map((c) => (
            <button key={c.id || 'all'} type="button" onClick={() => setColl(c.id)} className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${coll === c.id ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'}`}>
              {c.title}
            </button>
          ))}
        </div>
      )}

      {visible.length === 0 ? (
        <p className="py-12 text-center text-sm text-slate-500">No products match. Try another search.</p>
      ) : (
        groups.map(([name, list]) => (
          <div key={name || 'all'} className="mt-6">
            {grouped && groups.length > 1 && <h3 className="mb-3 font-display text-lg font-bold text-slate-800">{name || 'More products'}</h3>}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
              {list.map((p) => {
                const vs = variants[p.id] ?? [];
                const prices = vs.length ? vs.map((v) => v.price) : [p.price];
                const low = Math.min(...prices);
                const out = soldOut(p, vs);
                const img = coverOf(p);
                const was = !vs.length && p.compare_at_price && p.compare_at_price > p.price ? p.compare_at_price : null;
                return (
                  <button key={p.id} type="button" onClick={() => setOpen(p)} className="group text-left">
                    <span className="relative block aspect-square overflow-hidden rounded-2xl bg-slate-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {img && <img src={img} alt={p.name} loading="lazy" className={`h-full w-full object-cover transition group-hover:scale-105 ${out ? 'opacity-60' : ''}`} />}
                      {out && <span className="absolute left-2 top-2 rounded-full bg-slate-900 px-2.5 py-0.5 text-xs font-semibold text-white">Sold out</span>}
                      {!out && was && <span className="absolute left-2 top-2 rounded-full bg-red-600 px-2.5 py-0.5 text-xs font-semibold text-white">Sale</span>}
                    </span>
                    <span className="mt-2 block truncate text-sm font-medium text-slate-900">{p.name}</span>
                    <span className="block text-sm text-slate-700">
                      {prices.length > 1 && Math.max(...prices) !== low ? 'From ' : ''}
                      {naira(low)}
                      {was && <span className="ml-1.5 text-xs text-slate-400 line-through">{naira(was)}</span>}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))
      )}

      {open && <Detail p={open} vs={variants[open.id] ?? []} defs={defs} businessName={businessName} phone={phone} onClose={() => setOpen(null)} />}
    </section>
  );
}

function Detail({ p, vs, defs, businessName, phone, onClose }: { p: Product; vs: VariantRow[]; defs: FieldDefinition[]; businessName: string; phone?: string | null; onClose: () => void }) {
  const images = p.images?.length ? p.images : p.photo_url ? [p.photo_url] : [];
  const [shot, setShot] = useState(0);
  const [pick, setPick] = useState<Record<string, string>>(() => {
    // Start on the first variant that can be bought.
    const first = vs.find((v) => !p.track_stock || p.continue_selling || v.stock > 0) ?? vs[0];
    return first ? { ...first.option_values } : {};
  });

  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const variant = vs.find((v) => p.options.every((o) => v.option_values[o.name] === pick[o.name]));
  const price = variant?.price ?? p.price;
  const was = (variant ? variant.compare_at_price : p.compare_at_price) ?? null;
  const stock = variant ? variant.stock : p.stock;
  const out = !p.available || (vs.length > 0 && !variant) || (p.track_stock && !p.continue_selling && stock <= 0);
  const sku = variant?.sku ?? p.sku;
  const low = !out && p.track_stock && !p.continue_selling && stock > 0 && stock <= p.low_stock_threshold;

  const extras = defs
    .filter((d) => appliesTo(d, p.category))
    .map((d) => ({ d, vals: valueList(p.custom_fields?.[d.key]) as unknown[] }))
    .filter((r) => r.vals.length > 0);

  const wa = whatsappNumber(phone);
  const label = variant ? ` (${variant.title})` : '';
  const msg = `Hello ${businessName}, I would like to order: ${p.name}${label} at ${naira(price)}${sku ? `. SKU: ${sku}` : ''}.`;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={p.name} onClick={(e) => e.stopPropagation()} className="relative max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-t-2xl bg-white shadow-xl sm:rounded-2xl">
        <button type="button" aria-label="Close" onClick={onClose} className="absolute right-3 top-3 z-10 rounded-full bg-white/90 p-2 text-slate-700 shadow hover:bg-white">
          <X className="h-4 w-4" />
        </button>
        <div className="grid gap-5 p-4 sm:grid-cols-2 sm:p-6">
          <div>
            <div className="aspect-square overflow-hidden rounded-2xl bg-slate-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {images[shot] && <img src={images[shot]} alt={p.name} className="h-full w-full object-cover" />}
            </div>
            {images.length > 1 && (
              <div className="mt-2 flex gap-2 overflow-x-auto">
                {images.map((u, i) => (
                  <button key={u + i} type="button" onClick={() => setShot(i)} aria-label={`Photo ${i + 1}`} className={`h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2 ${i === shot ? 'border-blue-600' : 'border-transparent'}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={u} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div>
              {p.vendor && <p className="text-xs uppercase tracking-wide text-slate-500">{p.vendor}</p>}
              <h3 className="font-display text-xl font-bold text-slate-900">{p.name}</h3>
              <p className="mt-1 text-lg font-semibold text-slate-900">
                {naira(price)}
                {was && was > price && <span className="ml-2 text-sm font-normal text-slate-400 line-through">{naira(was)}</span>}
              </p>
            </div>

            {p.options.map((o) => (
              <div key={o.name}>
                <p className="mb-1.5 text-sm font-medium text-slate-700">
                  {o.name}: <span className="font-normal text-slate-500">{pick[o.name]}</span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {o.values.map((val) => {
                    const next = { ...pick, [o.name]: val };
                    const exists = vs.some((v) => p.options.every((x) => v.option_values[x.name] === next[x.name]));
                    const fallback = vs.find((v) => v.option_values[o.name] === val);
                    return (
                      <button
                        key={val}
                        type="button"
                        disabled={!fallback}
                        onClick={() => setPick(exists ? next : { ...(fallback as VariantRow).option_values })}
                        className={`rounded-lg border px-3 py-1.5 text-sm transition ${pick[o.name] === val ? 'border-blue-600 bg-blue-50 font-semibold text-blue-700' : 'border-slate-200 text-slate-700 hover:border-slate-300'} ${!fallback ? 'cursor-not-allowed opacity-40 line-through' : ''}`}
                      >
                        {val}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            {vs.length > 0 && !variant && <p className="text-sm text-amber-700">That combination is not available. Choose another.</p>}
            {low && <p className="text-sm font-medium text-amber-700">Only {stock} left</p>}
            {out && <p className="text-sm font-medium text-red-600">Sold out</p>}

            {p.description && <p className="whitespace-pre-line text-sm leading-relaxed text-slate-600">{p.description}</p>}

            {extras.length > 0 && (
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                {extras.map(({ d, vals }) => (
                  <div key={d.id} className="contents">
                    <dt className="text-slate-500">{d.name}:</dt>
                    <dd className="text-slate-800">
                      {vals.map((v, i) => (
                        <span key={i}>
                          {i > 0 ? ', ' : ''}
                          <Single def={d} value={v} />
                        </span>
                      ))}
                    </dd>
                  </div>
                ))}
              </dl>
            )}

            {wa ? (
              out ? (
                <button type="button" disabled className="w-full rounded-xl bg-slate-200 px-5 py-3 text-sm font-semibold text-slate-500">
                  Sold out
                </button>
              ) : (
                <a href={`https://wa.me/${wa}?text=${encodeURIComponent(msg)}`} target="_blank" rel="noopener noreferrer" className="block w-full rounded-xl bg-green-600 px-5 py-3 text-center text-sm font-semibold text-white hover:bg-green-700">
                  Order on WhatsApp
                </a>
              )
            ) : (
              <p className="text-sm text-slate-500">Contact {businessName} to order this item.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
