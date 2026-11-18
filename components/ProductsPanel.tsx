'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ImagePlus, Pencil, Star, Trash2, X } from 'lucide-react';
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
  photo_url: string | null;
  images: string[] | null;
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

// One photo in the form: either already saved (url) or newly picked (file + preview)
type Img = { key: string; url: string | null; file: File | null; preview: string | null };

const emptyForm: FormState = { name: '', price: '', category: '', description: '', custom: {} };

const BUCKET = 'product-images';
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_IMAGES = 6;
const TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const field =
  'w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-600';

const naira = (n: number) => `₦${n.toLocaleString('en-NG')}`;

const coverOf = (p: Product) => p.images?.[0] ?? p.photo_url ?? null;

export default function ProductsPanel({ businessId }: { businessId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [products, setProducts] = useState<Product[]>([]);
  const [defs, setDefs] = useState<FieldDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [imgs, setImgs] = useState<Img[]>([]);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('products')
      .select('id,name,description,price,category,photo_url,images,available,custom_fields')
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

  // ----- photos -----
  function pickImages(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0) return;
    setErrorMsg('');
    const room = MAX_IMAGES - imgs.length;
    const added: Img[] = [];
    let problem = '';
    for (const file of files) {
      if (added.length >= room) {
        problem = `You can add up to ${MAX_IMAGES} photos per product.`;
        break;
      }
      if (!TYPES.includes(file.type)) {
        problem = 'Only JPG, PNG or WebP photos can be added.';
        continue;
      }
      if (file.size > MAX_BYTES) {
        problem = 'A photo was skipped because it is over 5 MB.';
        continue;
      }
      added.push({ key: crypto.randomUUID(), url: null, file, preview: URL.createObjectURL(file) });
    }
    if (added.length) setImgs((l) => [...l, ...added]);
    if (problem) setErrorMsg(problem);
  }

  function removeImage(key: string) {
    setImgs((l) => {
      const gone = l.find((x) => x.key === key);
      if (gone?.preview) URL.revokeObjectURL(gone.preview);
      return l.filter((x) => x.key !== key);
    });
  }

  function makeCover(key: string) {
    setImgs((l) => {
      const pick = l.find((x) => x.key === key);
      return pick ? [pick, ...l.filter((x) => x.key !== key)] : l;
    });
  }

  function clearImages() {
    setImgs((l) => {
      l.forEach((x) => x.preview && URL.revokeObjectURL(x.preview));
      return [];
    });
  }

  async function uploadImage(file: File): Promise<string> {
    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
    const path = `${businessId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
      contentType: file.type,
      cacheControl: '31536000',
    });
    if (error) throw new Error('Could not upload a photo: ' + error.message);
    return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  }

  // ----- form -----
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
    clearImages();
    const urls = p.images?.length ? p.images : p.photo_url ? [p.photo_url] : [];
    setImgs(urls.map((u) => ({ key: crypto.randomUUID(), url: u, file: null, preview: null })));
    setErrorMsg('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
    clearImages();
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
    let urls: string[];
    try {
      urls = await Promise.all(imgs.map((x) => (x.file ? uploadImage(x.file) : Promise.resolve(x.url as string))));
    } catch (err) {
      setSaving(false);
      setErrorMsg(err instanceof Error ? err.message : 'Could not upload a photo.');
      return;
    }

    const payload = {
      name: form.name.trim(),
      price,
      category: form.category.trim() || null,
      description: form.description.trim() || null,
      images: urls,
      photo_url: urls[0] ?? null, // cover photo, kept for parts of the site that show one image
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

        <div>
          <div className="flex flex-wrap gap-3">
            {imgs.map((x, i) => (
              <div key={x.key} className="relative h-28 w-28 overflow-hidden rounded-xl border border-slate-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={x.preview ?? x.url ?? ''} alt={`Photo ${i + 1}`} className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeImage(x.key)}
                  aria-label="Remove photo"
                  className="absolute right-1 top-1 rounded-full bg-white/90 p-1 text-slate-700 shadow hover:bg-white"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
                {i === 0 ? (
                  <span className="absolute bottom-1 left-1 rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-semibold text-white">
                    Cover
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => makeCover(x.key)}
                    className="absolute bottom-1 left-1 flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-slate-700 shadow hover:bg-white"
                  >
                    <Star className="h-3 w-3" /> Make cover
                  </button>
                )}
              </div>
            ))}
            {imgs.length < MAX_IMAGES && (
              <label className="flex h-28 w-28 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-slate-300 text-xs font-medium text-slate-500 hover:border-blue-500 hover:text-blue-600">
                <ImagePlus className="h-6 w-6" />
                Add photos
                <input
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp"
                  onChange={pickImages}
                  className="hidden"
                />
              </label>
            )}
          </div>
          <p className="mt-1.5 text-xs text-slate-400">
            Up to {MAX_IMAGES} photos (JPG, PNG or WebP, 5 MB each). The first one is the cover.
          </p>
        </div>

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
            {products.map((p) => {
              const cover = coverOf(p);
              const count = p.images?.length ?? (p.photo_url ? 1 : 0);
              return (
                <li key={p.id} className="flex items-center gap-3 p-4">
                  <div className="relative h-12 w-12 shrink-0">
                    {cover ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={cover} alt="" className="h-12 w-12 rounded-lg border border-slate-200 object-cover" />
                    ) : (
                      <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
                        <ImagePlus className="h-5 w-5" />
                      </span>
                    )}
                    {count > 1 && (
                      <span className="absolute -right-1 -top-1 rounded-full bg-slate-800 px-1.5 text-[10px] font-semibold text-white">
                        {count}
                      </span>
                    )}
                  </div>
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
                    className="rounded-lg p-2 text-slate-500 hover:bg-slate-200"
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
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
