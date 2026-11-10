'use client';

import { useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { ImagePlus, Pencil, Plus, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { PageSkeleton } from '@/components/Skeleton';

// Must match the storage bucket your BusinessForm uploads photos to
const BUCKET = 'business-photos';

type Product = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  category: string | null;
  photo_url: string | null;
  stock: number | null;
  available: boolean;
  taxable: boolean;
};

type Form = {
  id?: string;
  name: string;
  description: string;
  price: string;
  category: string;
  stock: string;
  photo_url: string;
  available: boolean;
   taxable: boolean;
};

const emptyForm: Form = { name: '', description: '', price: '', category: '', stock: '', photo_url: '', available: true, taxable: true };
const naira = (n: number) => '₦' + Number(n).toLocaleString('en-NG');
const input = 'w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-blue-500';

export default function ProductsPanel({ user }: { user: User }) {
  const supabase = useMemo(() => createClient(), []);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Form | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  async function load(bid: string) {
    const { data } = await supabase
      .from('products')
      .select('*')
      .eq('business_id', bid)
      .order('created_at', { ascending: false });
    setProducts((data as Product[]) ?? []);
  }

  useEffect(() => {
    (async () => {
      const { data: b } = await supabase.from('businesses').select('id').eq('owner_id', user.id).maybeSingle();
      if (b) {
        setBusinessId(b.id);
        await load(b.id);
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]);

  const categories = [...new Set(products.map((p) => p.category).filter(Boolean))] as string[];

  async function upload(file: File) {
    if (!businessId) return;
    setUploading(true);
    setError('');
    const path = `${user.id}/products/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file);
    if (upErr) {
      setError('Photo upload failed: ' + upErr.message);
    } else {
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
      setForm((f) => (f ? { ...f, photo_url: data.publicUrl } : f));
    }
    setUploading(false);
  }

  async function save() {
    if (!form || !businessId) return;
    if (!form.name.trim()) return setError('Give the product a name.');
    const price = Number(form.price);
    if (!form.price || Number.isNaN(price) || price < 0) return setError('Enter a valid price.');
    setSaving(true);
    setError('');
    const row = {
      business_id: businessId,
      name: form.name.trim(),
      description: form.description.trim() || null,
      price,
      category: form.category.trim() || null,
      photo_url: form.photo_url || null,
      stock: form.stock === '' ? null : Math.max(0, parseInt(form.stock, 10) || 0),
      available: form.available,
      taxable: form.taxable,
    };
    const { error: dbErr } = form.id
      ? await supabase.from('products').update(row).eq('id', form.id)
      : await supabase.from('products').insert(row);
    setSaving(false);
    if (dbErr) return setError(dbErr.message);
    setForm(null);
    await load(businessId);
  }

  async function remove(p: Product) {
    if (!businessId || !confirm(`Delete "${p.name}"?`)) return;
    await supabase.from('products').delete().eq('id', p.id);
    await load(businessId);
  }

   if (loading) return <PageSkeleton />;

  if (!businessId) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
        Create your website first (My website), then you can add products.
      </div>
    );
  }

  if (form) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold">{form.id ? 'Edit product' : 'Add product'}</h1>
        <div className="mt-6 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Photo</label>
            <label className="flex h-40 w-40 cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-dashed border-slate-300 bg-slate-50 text-slate-400">
              {form.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={form.photo_url} alt="" className="h-full w-full object-cover" />
              ) : uploading ? (
                <span className="text-xs">Uploading...</span>
              ) : (
                <ImagePlus className="h-8 w-8" />
              )}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
              />
            </label>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Name</label>
            <input className={input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Description</label>
            <textarea
              rows={3}
              className={input}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Price (₦)</label>
              <input
                type="number"
                min="0"
                className={input}
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Category</label>
              <input
                list="product-categories"
                placeholder="e.g. Caps, Starters"
                className={input}
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              />
              <datalist id="product-categories">
                {categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Stock</label>
              <input
                type="number"
                min="0"
                placeholder="Leave empty if not tracked"
                className={input}
                value={form.stock}
                onChange={(e) => setForm({ ...form, stock: e.target.value })}
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.available}
              onChange={(e) => setForm({ ...form, available: e.target.checked })}
            />
            Show this product on my website
          </label>
                    <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.taxable}
              onChange={(e) => setForm({ ...form, taxable: e.target.checked })}
            />
            Charge tax on this product
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-3">
            <button
              onClick={save}
              disabled={saving || uploading}
              className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save product'}
            </button>
            <button
              onClick={() => {
                setForm(null);
                setError('');
              }}
              className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Products</h1>
        <button
          onClick={() => setForm(emptyForm)}
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" /> Add product
        </button>
      </div>

      {products.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
          No products yet. Add your first one and it will show on your website.
        </div>
      ) : (
        <div className="mt-6 divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
          {products.map((p) => (
            <div key={p.id} className="flex items-center gap-4 p-4">
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                {p.photo_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.photo_url} alt="" className="h-full w-full object-cover" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{p.name}</p>
                <p className="text-xs text-slate-500">
                  {p.category || 'No category'} · {p.stock === null ? 'Stock not tracked' : `${p.stock} in stock`}
                  {!p.available && ' · Hidden'}
                </p>
              </div>
              <p className="font-bold">{naira(p.price)}</p>
              <button
                onClick={() =>
                  setForm({
                    id: p.id,
                    name: p.name,
                    description: p.description ?? '',
                    price: String(p.price),
                    category: p.category ?? '',
                    stock: p.stock === null ? '' : String(p.stock),
                    photo_url: p.photo_url ?? '',
                    available: p.available,
                    taxable: p.taxable ?? true,
                  })
                }
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                aria-label="Edit"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                onClick={() => remove(p)}
                className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-600"
                aria-label="Delete"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}