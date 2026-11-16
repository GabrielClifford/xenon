'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import {
  appliesTo,
  fromInput,
  toInput,
  type FieldDefinition,
  type FieldInput,
} from '@/lib/customFields';

type Product = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  category: string | null;
  image_url: string | null;
  available: boolean;
  custom_fields: Record<string, unknown> | null;
};

type FormState = {
  name: string;
  price: string;
  category: string;
  description: string;
  custom: Record<string, FieldInput>;
};

const emptyForm: FormState = { name: '', price: '', category: '', description: '', custom: {} };

const field =
  'w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-600';

const naira = (n: number) => `₦${n.toLocaleString('en-NG')}`;

export default function ProductsPanel({ businessId }: { businessId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [products, setProducts] = useState<Product[]>([]);
  const [defs, setDefs] = useState<FieldDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('products')
      .select('id,name,description,price,category,image_url,available,custom_fields')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false });
    if (error) setErrorMsg(error.message);
    else setProducts((data ?? []) as Product[]);
    setLoading(false);
  }, [supabase, businessId]);

  const loadDefs = useCallback(async () => {
    const { data } = await supabase
      .from('field_definitions')
      .select('id,name,key,type,is_list,description,show_on_site,categories')
      .eq('business_id', businessId)
      .eq('resource', 'product')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });
    setDefs((data ?? []) as FieldDefinition[]);
  }, [supabase, businessId]);

  useEffect(() => {
    load();
    loadDefs();
  }, [load, loadDefs]);

  const categories = Array.from(
    new Set(products.map((p) => p.category).filter((c): c is string => !!c))
  );

  // Custom fields that apply to the category currently typed in the form.
  const activeDefs = defs.filter((d) => appliesTo(d, form.category));

  function setCustom(key: string, value: FieldInput) {
    setForm((f) => ({ ...f, custom: { ...f.custom, [key]: value } }));
  }

  function startEdit(p: Product) {
    const custom: Record<string, FieldInput> = {};
    for (const d of defs) custom[d.key] = toInput(d, p.custom_fields?.[d.key]);
    setEditingId(p.id);
    setForm({
      name: p.name,
      price: String(p.price),
      category: p.category ?? '',
      description: p.description ?? '',
      custom,
    });
    setErrorMsg('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMsg('');

    const price = Math.round(Number(form.price));
    if (!form.name.trim()) {
      setErrorMsg('Enter a name.');
      return;
    }
    if (!Number.isFinite(price) || price < 0) {
      setErrorMsg('Enter a valid price in naira.');
      return;
    }

    const custom_fields: Record<string, unknown> = {};
    for (const d of activeDefs) {
      const v = fromInput(d, form.custom[d.key]);
      if (v !== undefined) custom_fields[d.key] = v;
    }

    setSaving(true);
    const payload = {
      name: form.name.trim(),
      price,
      category: form.category.trim() || null,
      description: form.description.trim() || null,
      custom_fields,
    };
    const { error } = editingId
      ? await supabase.from('products').update(payload).eq('id', editingId)
      : await supabase.from('products').insert({ ...payload, business_id: businessId });
    setSaving(false);

    if (error) {
      setErrorMsg(error.message);
      return;
    }
    resetForm();
    await load();
  }

  async function toggleAvailable(p: Product) {
    const { error } = await supabase
      .from('products')
      .update({ available: !p.available })
      .eq('id', p.id);
    if (error) setErrorMsg(error.message);
    else await load();
  }

  async function remove(p: Product) {
    if (!window.confirm(`Delete "${p.name}"?`)) return;
    const { error } = await supabase.from('products').delete().eq('id', p.id);
    if (error) setErrorMsg(error.message);
    else {
      if (editingId === p.id) resetForm();
      await load();
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900">Products</h1>
        <p className="mt-1 text-sm text-slate-500">
          Add what you sell. Restaurants can use categories as menu sections, like Starters or
          Drinks.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
      >
        <p className="font-display font-bold text-slate-900">
          {editingId ? 'Edit product' : 'Add a product'}
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            required
            placeholder="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className={field}
          />
          <input
            required
            inputMode="numeric"
            placeholder="Price in naira"
            value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value.replace(/[^\d]/g, '') })}
            className={field}
          />
        </div>
        <input
          list="product-categories"
          placeholder="Category (optional)"
          value={form.category}
          onChange={(e) => setForm({ ...form, category: e.target.value })}
          className={field}
        />
        <datalist id="product-categories">
          {categories.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        <textarea
          rows={3}
          placeholder="Short description (optional)"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          className={field}
        />

        {activeDefs.length > 0 && (
          <div className="space-y-3 border-t border-slate-100 pt-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Custom fields
            </p>
            {activeDefs.map((d) => {
              const value = form.custom[d.key];
              const text = typeof value === 'string' ? value : '';
              return (
                <div key={d.id}>
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    {d.name}
                    {d.is_list ? ' (separate values with commas)' : ''}
                  </label>
                  {d.type === 'boolean' ? (
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={value === true}
                        onChange={(e) => setCustom(d.key, e.target.checked)}
                      />
                      Yes
                    </label>
                  ) : d.type === 'long_text' && !d.is_list ? (
                    <textarea
                      rows={3}
                      value={text}
                      onChange={(e) => setCustom(d.key, e.target.value)}
                      className={field}
                    />
                  ) : (
                    <input
                      type={
                        d.is_list
                          ? 'text'
                          : d.type === 'date'
                            ? 'date'
                            : d.type === 'url'
                              ? 'url'
                              : 'text'
                      }
                      inputMode={d.type === 'number' ? 'decimal' : undefined}
                      placeholder={
                        d.type === 'color'
                          ? 'For example Red or #FF5733'
                          : d.type === 'url'
                            ? 'https://'
                            : undefined
                      }
                      value={text}
                      onChange={(e) => setCustom(d.key, e.target.value)}
                      className={field}
                    />
                  )}
                  {d.description && <p className="mt-1 text-xs text-slate-400">{d.description}</p>}
                </div>
              );
            })}
          </div>
        )}

        {errorMsg && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{errorMsg}</p>
        )}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
          >
            {saving ? 'Saving...' : editingId ? 'Save changes' : 'Add product'}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <p className="p-5 text-sm text-slate-400">Loading products...</p>
        ) : products.length === 0 ? (
          <p className="p-5 text-sm text-slate-500">
            No products yet. Add your first one above and it will appear on your website.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {products.map((p) => (
              <li key={p.id} className="flex items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900">{p.name}</p>
                  <p className="text-xs text-slate-500">
                    {naira(p.price)}
                    {p.category ? ` · ${p.category}` : ''}
                    {!p.available ? ' · Sold out' : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => toggleAvailable(p)}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  {p.available ? 'Mark sold out' : 'Mark available'}
                </button>
                <button
                  type="button"
                  onClick={() => startEdit(p)}
                  aria-label={`Edit ${p.name}`}
                  className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => remove(p)}
                  aria-label={`Delete ${p.name}`}
                  className="rounded-lg p-2 text-red-500 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
