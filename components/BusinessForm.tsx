'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { trades, areas } from '@/data/providers';
import { PageSkeleton } from '@/components/Skeleton';

type Business = {
  id: string;
  slug: string;
  name: string;
  trade: string;
  area: string;
  tagline: string | null;
  about: string | null;
  services: string[];
  service_areas: string[];
  phone: string | null;
  years: number;
  price_from: number | null;
  theme: string;
  published: boolean;
  photo_url: string | null;
  gallery: string[];
};

const field =
  'w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-600';
const label = 'mb-1.5 block text-sm font-medium text-slate-700';
const MAX_GALLERY = 6;
const BUCKET = 'business-photos';

function makeSlug(name: string) {
  const base =
    name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'business';
  return `${base}-${Math.random().toString(36).slice(2, 6)}`;
}

// Shrinks a photo in the browser before upload to save data and storage
async function resizeImage(file: File, maxSize = 1600): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Could not process this image.'))),
      'image/jpeg',
      0.85
    )
  );
}

export default function BusinessForm({ user }: { user: User }) {
  const meta = (user.user_metadata ?? {}) as { trade?: string; phone?: string };
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    createClient()
      .from('businesses')
      .select('*')
      .eq('owner_id', user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) setError(error.message);
        else setBusiness(data as Business | null);
        setLoading(false);
      });
  }, [user.id]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setMessage('');

    const form = new FormData(e.currentTarget);
    const text = (k: string) => String(form.get(k) ?? '').trim();
    const payload = {
      name: text('name').slice(0, 80),
      trade: text('trade'),
      area: text('area'),
      city: 'Port Harcourt',
      tagline: text('tagline').slice(0, 120),
      about: text('about').slice(0, 600),
      services: text('services')
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 12)
        .map((s) => s.slice(0, 80)),
      service_areas: form.getAll('service_areas').map(String),
      phone: text('phone').slice(0, 30) || null,
      years: Math.max(0, Math.min(60, Number(form.get('years')) || 0)),
      price_from: Number(form.get('price')) || null,
            theme: ['classic', 'bold', 'spark'].includes(text('theme')) ? text('theme') : 'classic',
      published: form.get('published') === 'on',
    };

    setSaving(true);
    const supabase = createClient();
    const result = business
      ? await supabase.from('businesses').update(payload).eq('id', business.id).select().single()
      : await supabase
          .from('businesses')
          .insert({ ...payload, owner_id: user.id, slug: makeSlug(payload.name) })
          .select()
          .single();
    setSaving(false);

    if (result.error) {
      setError(result.error.message);
      return;
    }
    setBusiness(result.data as Business);
    setMessage('Saved.');
  }

  async function uploadPhoto(file: File, kind: 'profile' | 'gallery') {
    if (!business) return;
    setError('');
    setMessage('');

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Please choose a JPG, PNG or WebP image.');
      return;
    }
    if (kind === 'gallery' && business.gallery.length >= MAX_GALLERY) {
      setError(`You can add up to ${MAX_GALLERY} project photos. Remove one first.`);
      return;
    }

    setUploading(true);
    try {
      const blob = await resizeImage(file);
      const supabase = createClient();
      const path = `${user.id}/${business.id}/${kind}-${Date.now()}.jpg`;
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, blob, { contentType: 'image/jpeg', cacheControl: '31536000' });
      if (upErr) throw upErr;

      const url = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
      const changes = kind === 'profile' ? { photo_url: url } : { gallery: [...business.gallery, url] };
      const { data, error: dbErr } = await supabase
        .from('businesses')
        .update(changes)
        .eq('id', business.id)
        .select()
        .single();
      if (dbErr) throw dbErr;
      setBusiness(data as Business);
    } catch (err) {
      setError((err as { message?: string }).message ?? 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  }

  async function removePhoto(url: string, kind: 'profile' | 'gallery') {
    if (!business) return;
    setError('');
    setUploading(true);
    try {
      const supabase = createClient();
      const path = url.split(`/${BUCKET}/`)[1];
      if (path) await supabase.storage.from(BUCKET).remove([path]);

      const changes =
        kind === 'profile'
          ? { photo_url: null }
          : { gallery: business.gallery.filter((g) => g !== url) };
      const { data, error: dbErr } = await supabase
        .from('businesses')
        .update(changes)
        .eq('id', business.id)
        .select()
        .single();
      if (dbErr) throw dbErr;
      setBusiness(data as Business);
    } catch (err) {
      setError((err as { message?: string }).message ?? 'Could not remove the photo.');
    } finally {
      setUploading(false);
    }
  }

  if (loading) return <PageSkeleton />;

  const pickButton =
    'cursor-pointer rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50';

  return (
    <form
      key={business?.id ?? 'new'}
      onSubmit={handleSubmit}
      className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      <h2 className="font-display text-xl font-semibold text-slate-900">
        {business ? 'Edit your business website' : 'Create your business website'}
      </h2>

      <div>
        <label className={label}>Business name</label>
        <input required name="name" maxLength={80} defaultValue={business?.name ?? ''} placeholder="e.g. John's Plumbing Services" className={field} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={label}>Service</label>
          <select required name="trade" defaultValue={business?.trade ?? meta.trade ?? ''} className={field}>
            <option value="" disabled>Choose a service</option>
            {trades.map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className={label}>Your area</label>
          <select required name="area" defaultValue={business?.area ?? ''} className={field}>
            <option value="" disabled>Choose an area</option>
            {areas.map((a) => <option key={a}>{a}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className={label}>Tagline</label>
        <input name="tagline" maxLength={120} defaultValue={business?.tagline ?? ''} placeholder="A short line about your work" className={field} />
      </div>

      <div>
        <label className={label}>About your business</label>
        <textarea name="about" rows={4} maxLength={600} defaultValue={business?.about ?? ''} placeholder="What you do, and why customers can trust you" className={field} />
      </div>

      <div>
        <label className={label}>Services (one per line, up to 12)</label>
        <textarea name="services" rows={5} defaultValue={business?.services.join('\n') ?? ''} placeholder={'Leak repairs\nPipe fitting\nBathroom fittings'} className={field} />
      </div>

      <div>
        <label className={label}>Areas you serve</label>
        <div className="flex flex-wrap gap-3">
          {areas.map((a) => (
            <label key={a} className="flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-sm">
              <input type="checkbox" name="service_areas" value={a} defaultChecked={business?.service_areas.includes(a)} />
              {a}
            </label>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className={label}>Phone number</label>
          <input name="phone" defaultValue={business?.phone ?? meta.phone ?? ''} className={field} />
        </div>
        <div>
          <label className={label}>Years of experience</label>
          <input name="years" type="number" min={0} max={60} defaultValue={business?.years ?? 0} className={field} />
        </div>
        <div>
          <label className={label}>Starting price (₦)</label>
          <input name="price" type="number" min={0} defaultValue={business?.price_from ?? ''} className={field} />
        </div>
      </div>

      <div>
        <label className={label}>Website theme</label>
        <select name="theme" defaultValue={business?.theme ?? 'classic'} className={field}>
          <option value="classic">Classic</option>
          <option value="bold">Bold</option>
                    <option value="spark">Spark</option>
        </select>
      </div>

      <div>
        <label className={label}>Photos</label>
        {!business ? (
          <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
            Save your business details first, then you can add photos.
          </p>
        ) : (
          <div className="space-y-6 rounded-xl border border-slate-200 p-4">
            <div>
              <p className="mb-2 text-sm font-medium text-slate-700">Main photo (shown at the top of your website)</p>
              <div className="flex flex-wrap items-center gap-4">
                {business.photo_url ? (
                  <img src={business.photo_url} alt="Main" className="h-24 w-36 rounded-xl object-cover" />
                ) : (
                  <div className="flex h-24 w-36 items-center justify-center rounded-xl bg-slate-100 text-xs text-slate-400">
                    No photo yet
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  <label className={pickButton}>
                    {business.photo_url ? 'Change photo' : 'Choose photo'}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      disabled={uploading}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        e.target.value = '';
                        if (f) uploadPhoto(f, 'profile');
                      }}
                    />
                  </label>
                  {business.photo_url && (
                    <button
                      type="button"
                      disabled={uploading}
                      onClick={() => removePhoto(business.photo_url!, 'profile')}
                      className={pickButton}
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-slate-700">
                Project photos ({business.gallery.length}/{MAX_GALLERY})
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {business.gallery.map((src) => (
                  <div key={src} className="relative aspect-square overflow-hidden rounded-xl bg-slate-100">
                    <img src={src} alt="Project" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      disabled={uploading}
                      onClick={() => removePhoto(src, 'gallery')}
                      aria-label="Remove photo"
                      className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-sm font-bold text-slate-700 shadow hover:bg-white"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              {business.gallery.length < MAX_GALLERY && (
                <label className={`${pickButton} mt-3 inline-block`}>
                  Add a project photo
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    disabled={uploading}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.target.value = '';
                      if (f) uploadPhoto(f, 'gallery');
                    }}
                  />
                </label>
              )}
            </div>

            {uploading && <p className="text-sm text-slate-500">Working on your photo...</p>}
            <p className="text-xs text-slate-400">
              JPG, PNG or WebP. Only upload photos you own or have permission to share, and don&apos;t show customers&apos;
              faces or private homes without their consent.
            </p>
          </div>
        )}
      </div>

      <label className="flex items-start gap-3 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
        <input type="checkbox" name="published" defaultChecked={business?.published} className="mt-1" />
        <span>
          Make my website public. Your business name, description, phone number and photos will be visible to anyone.
        </span>
      </label>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {message && (
        <p className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-700">
          {message}{' '}
          {business?.published ? (
            <Link href={`/b/${business.slug}`} className="font-semibold underline">View your website</Link>
          ) : (
            'Tick "Make my website public" and save again to publish it.'
          )}
        </p>
      )}

      <button
        type="submit"
        disabled={saving}
        className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
      >
        {saving ? 'Saving...' : 'Save'}
      </button>
    </form>
  );
}