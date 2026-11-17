'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Minus, Pencil, Plus, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { Catalog, CatalogMarket, CatalogProduct, Market } from '@/lib/markets';

type ProductRow = { id: string; name: string; price: number };

type FormState = {
  title: string;
  status: 'active' | 'draft';
  marketIds: string[];
  adjustment: string;
  compareAt: Catalog['compare_at'];
  includeAll: boolean;
  selected: string[];
  fixed: Record<string, string>;
};

const emptyForm: FormState = {
  title: '',
  status: 'active',
  marketIds: [],
  adjustment: '0',
  compareAt: 'dynamic',
  includeAll: true,
  selected: [],
  fixed: {},
};

const field =
  'w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-600';

const naira = (n: number) => `₦${n.toLocaleString('en-NG')}`;

export default function CatalogsPanel({ businessId }: { businessId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [catalogs, setCatalogs] = useState<Catalog[]>([]);
  const [links, setLinks] = useState<CatalogMarket[]>([]);
  const [rows, setRows] = useState<CatalogProduct[]>([]);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const load = useCallback(async () => {
    const [c, m, p] = await Promise.all([
      supabase
        .from('catalogs')
        .select('id,title,status,adjustment_percent,compare_at,include_all_products,created_at')
        .eq('business_id', businessId)
        .order('created_at', { ascending: false }),
      supabase
        .from('markets')
        .select('id,name,type,regions,status,is_default,created_at')
        .eq('business_id', businessId)
        .order('created_at', { ascending: true }),
      supabase
        .from('products')
        .select('id,name,price')
        .eq('business_id', businessId)
        .order('name', { ascending: true }),
    ]);

    if (c.error) {
      setErrorMsg(c.error.message);
      setLoading(false);
      return;
    }

    const cats = ((c.data ?? []) as Catalog[]).map((x) => ({
      ...x,
      adjustment_percent: Number(x.adjustment_percent),
    }));
    const ids = cats.map((x) => x.id);

    if (ids.length > 0) {
      const [cm, cp] = await Promise.all([
        supabase.from('catalog_markets').select('catalog_id,market_id').in('catalog_id', ids),
        supabase
          .from('catalog_products')
          .select('catalog_id,product_id,fixed_price')
          .in('catalog_id', ids),
      ]);
      setLinks((cm.data ?? []) as CatalogMarket[]);
      setRows((cp.data ?? []) as CatalogProduct[]);
    } else {
      setLinks([]);
      setRows([]);
    }

    setCatalogs(cats);
    setMarkets((m.data ?? []) as Market[]);
    setProducts((p.data ?? []) as ProductRow[]);
    setLoading(false);
  }, [supabase, businessId]);

  useEffect(() => {
    load();
  }, [load]);

  function startCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setErrorMsg('');
    setOpen(true);
  }

  function startEdit(c: Catalog) {
    const mine = rows.filter((r) => r.catalog_id === c.id);
    const fixed: Record<string, string> = {};
    for (const r of mine) if (r.fixed_price !== null) fixed[r.product_id] = String(r.fixed_price);
    setEditingId(c.id);
    setForm({
      title: c.title,
      status: c.status,
      marketIds: links.filter((l) => l.catalog_id === c.id).map((l) => l.market_id),
      adjustment: String(c.adjustment_percent),
      compareAt: c.compare_at,
      includeAll: c.include_all_products,
      selected: mine.map((r) => r.product_id),
      fixed,
    });
    setErrorMsg('');
    setOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function closeForm() {
    setOpen(false);
    setEditingId(null);
    setForm(emptyForm);
  }

  function nudge(delta: number) {
    setForm((f) => {
      const next = Math.round((Number(f.adjustment || 0) + delta) * 100) / 100;
      return { ...f, adjustment: String(next) };
    });
  }

  function toggle(list: string[], id: string) {
    return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
  }

  function fail(message: string) {
    setSaving(false);
    setErrorMsg(message);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMsg('');

    const title = form.title.trim();
    if (!title) return setErrorMsg('Enter a title.');
    if (title.length > 255) return setErrorMsg('The title can be at most 255 characters.');

    const adjustment = Number(form.adjustment === '' ? 0 : form.adjustment);
    if (!Number.isFinite(adjustment) || adjustment <= -100 || adjustment > 1000) {
      return setErrorMsg('The adjustment must be between -99.99% and 1000%.');
    }

    // Which products belong to this catalog, and which have a fixed price.
    const productRows: { product_id: string; fixed_price: number | null }[] = [];
    for (const p of products) {
      const included = form.includeAll || form.selected.includes(p.id);
      if (!included) continue;
      const raw = (form.fixed[p.id] ?? '').trim();
      let fixed: number | null = null;
      if (raw) {
        fixed = Math.round(Number(raw));
        if (!Number.isFinite(fixed) || fixed < 0) {
          return setErrorMsg(`Enter a valid fixed price for ${p.name}.`);
        }
      }
      // When every product is included, only products with a fixed price need a row.
      if (!form.includeAll || fixed !== null) productRows.push({ product_id: p.id, fixed_price: fixed });
    }

    setSaving(true);
    const payload = {
      title,
      status: form.status,
      adjustment_percent: adjustment,
      compare_at: form.compareAt,
      include_all_products: form.includeAll,
    };

    let catalogId: string;
    if (editingId) {
      const { error } = await supabase.from('catalogs').update(payload).eq('id', editingId);
      if (error) return fail(error.message);
      catalogId = editingId;
    } else {
      const { data, error } = await supabase
        .from('catalogs')
        .insert({ ...payload, business_id: businessId })
        .select('id')
        .single();
      if (error || !data) return fail(error?.message ?? 'Could not create the catalog.');
      catalogId = data.id as string;
    }

    const delMarkets = await supabase.from('catalog_markets').delete().eq('catalog_id', catalogId);
    if (delMarkets.error) return fail(delMarkets.error.message);
    if (form.marketIds.length > 0) {
      const { error } = await supabase
        .from('catalog_markets')
        .insert(form.marketIds.map((market_id) => ({ catalog_id: catalogId, market_id })));
      if (error) return fail(error.message);
    }

    const delProducts = await supabase.from('catalog_products').delete().eq('catalog_id', catalogId);
    if (delProducts.error) return fail(delProducts.error.message);
    if (productRows.length > 0) {
      const { error } = await supabase
        .from('catalog_products')
        .insert(productRows.map((r) => ({ catalog_id: catalogId, ...r })));
      if (error) return fail(error.message);
    }

    setSaving(false);
    closeForm();
    await load();
  }

  async function remove(c: Catalog) {
    if (!window.confirm(`Delete the "${c.title}" catalog?`)) return;
    const { error } = await supabase.from('catalogs').delete().eq('id', c.id);
    if (error) setErrorMsg(error.message);
    else await load();
  }

  const marketName = (id: string) => markets.find((m) => m.id === id)?.name ?? 'Unknown market';

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-slate-500">
          Create custom pricing and product choices for the markets you sell in.
        </p>
        {!open && (
          <button
            type="button"
            onClick={startCreate}
            className="shrink-0 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
          >
            Create catalog
          </button>
        )}
      </div>

      {open && (
        <form
          onSubmit={handleSubmit}
          className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <p className="font-display font-bold text-slate-900">
            {editingId ? 'Edit catalog' : 'New catalog'}
          </p>

          <div>
            <div className="relative">
              <input
                required
                maxLength={255}
                placeholder="Title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className={`${field} pr-16`}
              />
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                {form.title.length}/255
              </span>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Status</label>
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as 'active' | 'draft' })}
              className={field}
            >
              <option value="active">Active</option>
              <option value="draft">Draft</option>
            </select>
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold text-slate-800">Markets</p>
            {markets.length === 0 ? (
              <p className="text-sm text-slate-500">Create a market first, then add it here.</p>
            ) : (
              <div className="space-y-1">
                {markets.map((m) => (
                  <label key={m.id} className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={form.marketIds.includes(m.id)}
                      onChange={() => setForm({ ...form, marketIds: toggle(form.marketIds, m.id) })}
                    />
                    {m.name}
                    {m.status === 'draft' && <span className="text-xs text-slate-400">(draft)</span>}
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <p className="text-sm font-semibold text-slate-800">Pricing</p>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Set prices in</label>
              <select disabled className={`${field} disabled:bg-slate-50`} value="ngn" onChange={() => {}}>
                <option value="ngn">Store currency (NGN ₦)</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Overall adjustment (%)
              </label>
              <div className="flex gap-2">
                <input
                  inputMode="decimal"
                  value={form.adjustment}
                  onChange={(e) =>
                    setForm({ ...form, adjustment: e.target.value.replace(/[^\d.-]/g, '') })
                  }
                  className={field}
                />
                <button
                  type="button"
                  onClick={() => nudge(-1)}
                  aria-label="Decrease adjustment"
                  className="rounded-xl bg-slate-100 px-4 text-slate-700 hover:bg-slate-200"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => nudge(1)}
                  aria-label="Increase adjustment"
                  className="rounded-xl bg-slate-100 px-4 text-slate-700 hover:bg-slate-200"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-1 text-xs text-slate-400">
                A negative number lowers prices, a positive number raises them. Fixed prices below
                override it.
              </p>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Compare-at prices
              </label>
              <select
                value={form.compareAt}
                onChange={(e) =>
                  setForm({ ...form, compareAt: e.target.value as Catalog['compare_at'] })
                }
                className={field}
              >
                <option value="dynamic">Dynamic (adjust by the same percentage)</option>
                <option value="static">Static (keep the original compare-at price)</option>
                <option value="hidden">Hidden (don&apos;t show compare-at prices)</option>
              </select>
              <p className="mt-1 text-xs text-slate-400">
                Takes effect once your products have a compare-at price.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-semibold text-slate-800">Products</p>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.includeAll}
                onChange={(e) => setForm({ ...form, includeAll: e.target.checked })}
              />
              Include all products, including new ones
            </label>

            {products.length === 0 ? (
              <p className="text-sm text-slate-500">Add products first to choose them here.</p>
            ) : (
              <div className="rounded-xl border border-slate-200">
                {products.map((p) => {
                  const included = form.includeAll || form.selected.includes(p.id);
                  return (
                    <div
                      key={p.id}
                      className="flex items-center gap-3 border-b border-slate-100 px-3 py-2 last:border-0"
                    >
                      {!form.includeAll && (
                        <input
                          type="checkbox"
                          checked={form.selected.includes(p.id)}
                          onChange={() => setForm({ ...form, selected: toggle(form.selected, p.id) })}
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-slate-900">{p.name}</p>
                        <p className="text-xs text-slate-400">{naira(p.price)}</p>
                      </div>
                      <input
                        inputMode="numeric"
                        placeholder="Fixed price"
                        disabled={!included}
                        value={form.fixed[p.id] ?? ''}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            fixed: { ...form.fixed, [p.id]: e.target.value.replace(/[^\d]/g, '') },
                          })
                        }
                        className="w-28 rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-blue-600 disabled:bg-slate-50"
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {errorMsg && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{errorMsg}</p>
          )}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? 'Saving...' : editingId ? 'Save changes' : 'Create catalog'}
            </button>
            <button
              type="button"
              onClick={closeForm}
              className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <p className="p-5 text-sm text-slate-400">Loading catalogs...</p>
        ) : catalogs.length === 0 ? (
          <div className="p-6 text-center">
            <p className="font-display font-bold text-slate-900">Personalize buying with catalogs</p>
            <p className="mt-1 text-sm text-slate-500">
              Create custom product and pricing offerings for your customers.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {catalogs.map((c) => {
              const mine = rows.filter((r) => r.catalog_id === c.id);
              const fixedCount = mine.filter((r) => r.fixed_price !== null).length;
              const marketNames = links
                .filter((l) => l.catalog_id === c.id)
                .map((l) => marketName(l.market_id));
              const adj = c.adjustment_percent;
              return (
                <li key={c.id} className="flex items-center gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900">{c.title}</p>
                    <p className="text-xs text-slate-500">
                      {marketNames.length > 0 ? marketNames.join(', ') : 'No markets'}
                      {' · '}
                      {adj !== 0 ? `${adj > 0 ? '+' : ''}${adj}%` : 'No adjustment'}
                      {fixedCount > 0 ? ` · ${fixedCount} fixed price${fixedCount > 1 ? 's' : ''}` : ''}
                      {' · '}
                      {c.include_all_products ? 'All products' : `${mine.length} products`}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      c.status === 'active'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {c.status === 'active' ? 'Active' : 'Draft'}
                  </span>
                  <button
                    type="button"
                    onClick={() => startEdit(c)}
                    aria-label={`Edit ${c.title}`}
                    className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(c)}
                    aria-label={`Delete ${c.title}`}
                    className="rounded-lg p-2 text-red-500 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {!open && errorMsg && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{errorMsg}</p>
      )}
    </div>
  );
}
