'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { AreaF, BoolF, Field, ImageF, TextF, inp } from './fields';
import { readPrefs } from '@/lib/store/prefs';
import type { Biz } from './ThemesHome';
import Subscribers from './Subscribers';

const btn = 'rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-500';

export default function PreferencesTab({ biz, onSaved }: { biz: Biz; onSaved: () => void }) {
  const supabase = useMemo(() => createClient(), []);
  const [p, setP] = useState(() => readPrefs(biz.store_prefs));
  const [trusted, setTrusted] = useState(() => readPrefs(biz.store_prefs).trusted.join('\n'));
  const [hasPw, setHasPw] = useState(false);
  const [pw, setPw] = useState('');
  const [userId, setUserId] = useState('');
  const [msg, setMsg] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const [{ data: has }, { data: u }] = await Promise.all([supabase.rpc('xenon_store_has_password', { p_business: biz.id }), supabase.auth.getUser()]);
      setHasPw(has === true); setUserId(u.user?.id ?? '');
    })();
  }, [supabase, biz.id]);

  async function save() {
    setBusy(true); setMsg(''); setErr('');
    try {
      if (p.private && !hasPw && pw.length < 4) throw new Error('Set a password of at least 4 characters before turning on password protection.');
      if (pw) {
        const { error } = await supabase.rpc('xenon_store_set_password', { p_business: biz.id, p_password: pw });
        if (error) throw new Error(error.message);
        setHasPw(true); setPw('');
      }
      const next = readPrefs({ ...p, trusted: trusted.split(/[\n,]+/) });
      const { error } = await supabase.from('businesses').update({ store_prefs: next }).eq('id', biz.id);
      if (error) throw new Error(error.message);
      setP(next); setTrusted(next.trusted.join('\n')); setMsg('Saved.'); onSaved();
    } catch (e) { setErr(e instanceof Error ? e.message : 'Could not save.'); }
    setBusy(false);
  }

  const card = 'rounded-2xl border border-slate-200 bg-white p-4';
  return (
    <div className="space-y-5">
      <section className={card}>
        <h2 className="font-semibold text-slate-900">Store access</h2>
        <p className="mb-3 text-sm text-slate-500">Keep your store private while you set it up, or for wholesale customers.</p>
        <BoolF label="Require a password to enter my store" value={p.private} onChange={(v) => setP({ ...p, private: v })} />
        {p.private && <Field label={hasPw ? 'New password (leave empty to keep the current one)' : 'Password'}><input type="text" className={inp} value={pw} onChange={(e) => setPw(e.target.value)} placeholder="At least 4 characters" /></Field>}
        <p className="text-xs text-slate-500">Visitors need the password to see your products. Private stores are also hidden from search engines.</p>
      </section>

      <section className={card}>
        <h2 className="font-semibold text-slate-900">Search engines (SEO)</h2>
        <p className="mb-3 text-sm text-slate-500">How your store looks on Google and when you share the link on WhatsApp.</p>
        <TextF label={`Page title (${p.seoTitle.length}/70)`} value={p.seoTitle} onChange={(v) => setP({ ...p, seoTitle: v.slice(0, 70) })} />
        <AreaF label={`Meta description (${p.seoDescription.length}/320)`} rows={3} value={p.seoDescription} onChange={(v) => setP({ ...p, seoDescription: v.slice(0, 320) })} />
        {userId && <ImageF label="Social sharing image" value={p.socialImage} onChange={(v) => setP({ ...p, socialImage: v })} owner={{ userId, businessId: biz.id }} />}
        <BoolF label="Ask search engines not to list my store" value={p.noindex} onChange={(v) => setP({ ...p, noindex: v })} />
        <div className="rounded-xl bg-slate-50 p-3 text-sm">
          <p className="truncate text-base text-blue-700">{p.seoTitle || biz.name}</p>
          <p className="truncate text-xs text-green-700">/b/{biz.slug}</p>
          <p className="line-clamp-2 text-xs text-slate-600">{p.seoDescription || 'Your description will show here.'}</p>
        </div>
      </section>

      <section className={card}>
        <h2 className="font-semibold text-slate-900">Trusted websites</h2>
        <p className="mb-3 text-sm text-slate-500">Links to other websites in your pages show a &quot;you are leaving this store&quot; notice, to protect customers. Add websites you trust to skip it. One per line, like instagram.com.</p>
        <textarea rows={4} className={inp} value={trusted} onChange={(e) => setTrusted(e.target.value)} placeholder={'instagram.com\nwa.me'} />
      </section>

      <Subscribers businessId={biz.id} />

      {err && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{err}</p>}
      {msg && <p className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-800">{msg}</p>}
      <button className={btn} onClick={save} disabled={busy}>{busy ? 'Saving...' : 'Save preferences'}</button>
    </div>
  );
}
