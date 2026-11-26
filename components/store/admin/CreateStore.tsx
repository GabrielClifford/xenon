'use client';

import { useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';

const slugify = (v: string) => v.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);

// first run: a new owner names the shop and picks its web address. Everything else lives in Settings.
export default function CreateStore({ user, onCreated }: { user: User; onCreated: () => void }) {
  const supabase = useMemo(() => createClient(), []);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [edited, setEdited] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const shown = edited ? slug : slugify(name);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const n = name.trim();
    const s = slugify(shown);
    if (n.length < 2) return setErr('Please enter your store name.');
    if (s.length < 3) return setErr('The store link needs at least 3 letters or numbers.');
    setBusy(true); setErr('');
    const { error } = await supabase.from('businesses').insert({ owner_id: user.id, name: n, slug: s, published: false });
    setBusy(false);
    if (error) return setErr(error.code === '23505' ? 'That store link is already taken. Try another one.' : `Could not create your store: ${error.message}`);
    onCreated();
  }

  return (
    <form onSubmit={create} className="mx-auto max-w-md space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
      <div>
        <h1 className="text-2xl font-bold">Create your online store</h1>
        <p className="mt-1 text-sm text-slate-500">Just the name and link for now. You can add your address, currency, policies and delivery later in Settings.</p>
      </div>
      <label className="block text-sm font-semibold text-slate-700">Store name
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="e.g. QuickVita" className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-normal" />
      </label>
      <label className="block text-sm font-semibold text-slate-700">Store link
        <div className="mt-1 flex items-center overflow-hidden rounded-xl border border-slate-300 text-sm font-normal">
          <span className="bg-slate-50 px-3 py-2.5 text-slate-500">/b/</span>
          <input value={shown} onChange={(e) => { setEdited(true); setSlug(slugify(e.target.value)); }} maxLength={40} className="min-w-0 flex-1 px-2 py-2.5 outline-none" aria-label="Store link" />
        </div>
      </label>
      {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{err}</p>}
      <button disabled={busy} className="w-full rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-slate-300">{busy ? 'Creating...' : 'Create store'}</button>
    </form>
  );
}
