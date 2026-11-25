'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Copy, ExternalLink, MessageCircle, MoreHorizontal, Plus, Sparkles, X, AlertTriangle, Lock } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { PageSkeleton } from '@/components/Skeleton';
import { TEMPLATES, freshTheme, suggestTemplates, templateById } from '@/lib/store/theme';
import { readPrefs } from '@/lib/store/prefs';

export type Biz = { id: string; slug: string; name: string; published: boolean; phone: string | null; bank_name: string | null; store_prefs: unknown };
type ThemeRow = { id: string; name: string; template: string; status: 'live' | 'draft'; scheduled_at: string | null; updated_at: string; settings: { }; sections: unknown[] };

const btn = 'rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-500';
const btn2 = 'rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50';

export default function ThemesHome({ biz, onEdit, onBizChanged, goTab }: { biz: Biz; onEdit: (id: string) => void; onBizChanged: () => void; goTab: (t: 'pages' | 'preferences' | 'details') => void }) {
  const supabase = useMemo(() => createClient(), []);
  const [themes, setThemes] = useState<ThemeRow[] | null>(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState('');
  const [menu, setMenu] = useState<string | null>(null);
  const [desc, setDesc] = useState('');
  const [health, setHealth] = useState<{ ok: boolean; text: string; fix?: 'details' | 'pages' | 'preferences' | 'products' }[]>([]);
  const prefs = readPrefs(biz.store_prefs);
  const url = typeof window !== 'undefined' ? `${window.location.origin}/b/${biz.slug}` : `/b/${biz.slug}`;

  const load = useCallback(async () => {
    const { data } = await supabase.from('store_themes').select('id, name, template, status, scheduled_at, updated_at, settings, sections').eq('business_id', biz.id).order('created_at');
    let rows = (data ?? []) as ThemeRow[];
    if (rows.length === 0) {
      // first visit: every store starts with a live copy of the Fresh theme
      const t = freshTheme('prestige');
      const { data: ins } = await supabase.from('store_themes').insert({ business_id: biz.id, name: 'Prestige', template: 'prestige', status: 'live', settings: t.settings, sections: t.sections, published_at: new Date().toISOString() }).select('id, name, template, status, scheduled_at, updated_at, settings, sections').single();
      rows = ins ? [ins as ThemeRow] : [];
    }
    setThemes(rows);
  }, [supabase, biz.id]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    (async () => {
      const [{ count: products }, { count: pages }] = await Promise.all([
        supabase.from('products').select('id', { count: 'exact', head: true }).eq('business_id', biz.id).eq('available', true),
        supabase.from('store_pages').select('id', { count: 'exact', head: true }).eq('business_id', biz.id).eq('visible', true),
      ]);
      const live = themes?.find((t) => t.status === 'live');
      const hero = (live?.sections as { type: string; s: { image?: string } }[] | undefined)?.find((s) => s.type === 'hero');
      setHealth([
        { ok: biz.published, text: biz.published ? 'Your store is live' : 'Your store is not published yet, customers cannot see it', fix: 'details' },
        { ok: (products ?? 0) > 0, text: (products ?? 0) > 0 ? `${products} product${products === 1 ? '' : 's'} on sale` : 'Add at least one product so customers can buy', fix: 'products' },
        { ok: !!biz.phone, text: biz.phone ? 'Phone / WhatsApp number added' : 'Add a phone number so customers can chat with you on WhatsApp', fix: 'details' },
        { ok: !!biz.bank_name, text: biz.bank_name ? 'Bank details added for transfers' : 'Add your bank details so customers can pay by transfer', fix: 'details' },
        { ok: !!hero?.s?.image, text: hero?.s?.image ? 'Banner image added' : 'Add a banner image in the theme editor: stores with pictures sell more' },
        { ok: !!prefs.seoTitle, text: prefs.seoTitle ? 'Search title set' : 'Set a search title so Google shows your store properly', fix: 'preferences' },
        { ok: (pages ?? 0) > 0, text: (pages ?? 0) > 0 ? 'You have pages like About or Contact' : 'Add an About or Contact page: customers trust shops they can read about', fix: 'pages' },
      ]);
    })();
  }, [supabase, biz, themes, prefs.seoTitle]);

  const live = themes?.find((t) => t.status === 'live');
  const drafts = themes?.filter((t) => t.status === 'draft') ?? [];

  async function run(key: string, fn: () => Promise<string | void>) {
    setBusy(key); setMsg('');
    const r = await fn();
    setBusy('');
    if (typeof r === 'string') setMsg(r);
    await load();
  }
  const addTemplate = (id: string) => run('add' + id, async () => {
    const t = freshTheme(id); const name = templateById(id).name;
    const { error } = await supabase.from('store_themes').insert({ business_id: biz.id, name, template: id, status: 'draft', settings: t.settings, sections: t.sections });
    return error ? error.message : `${name} added to your theme library. Publish it when you are ready.`;
  });
  const publish = (id: string) => run('pub' + id, async () => {
    const { error } = await supabase.rpc('xenon_store_publish_theme', { p_theme: id });
    return error ? error.message : 'Theme published. Your store now looks different to customers.';
  });
  const duplicate = (t: ThemeRow) => run('dup' + t.id, async () => {
    const { error } = await supabase.from('store_themes').insert({ business_id: biz.id, name: `Copy of ${t.name}`.slice(0, 60), template: t.template, status: 'draft', settings: t.settings, sections: t.sections });
    return error ? error.message : 'Copy created.';
  });
  const rename = (t: ThemeRow) => { const n = window.prompt('Theme name', t.name)?.trim(); if (n) run('ren' + t.id, async () => { const { error } = await supabase.from('store_themes').update({ name: n.slice(0, 60) }).eq('id', t.id); return error?.message; }); };
  const remove = (t: ThemeRow) => { if (window.confirm(`Delete "${t.name}"? This cannot be undone.`)) run('del' + t.id, async () => { const { error } = await supabase.from('store_themes').delete().eq('id', t.id); return error?.message; }); };
  const schedule = (t: ThemeRow) => {
    const v = window.prompt('Publish this theme on (date and time, like 2026-12-01 08:00). Leave empty to cancel the schedule.', t.scheduled_at ? t.scheduled_at.slice(0, 16).replace('T', ' ') : '');
    if (v === null) return;
    const d = v.trim() ? new Date(v.trim().replace(' ', 'T')) : null;
    if (d && (isNaN(d.getTime()) || d.getTime() < Date.now())) return setMsg('Please enter a future date and time, like 2026-12-01 08:00.');
    run('sch' + t.id, async () => { const { error } = await supabase.from('store_themes').update({ scheduled_at: d ? d.toISOString() : null }).eq('id', t.id); return error ? error.message : d ? 'Scheduled. The theme goes live automatically when someone opens your store after that time.' : 'Schedule removed.'; });
  };
  const togglePublish = () => run('biz', async () => {
    const { error } = await supabase.from('businesses').update({ published: !biz.published }).eq('id', biz.id);
    onBizChanged();
    return error ? error.message : biz.published ? 'Store hidden from customers.' : 'Your store is live.';
  });

  const suggested = useMemo(() => (desc.trim().length > 2 ? suggestTemplates(desc) : []), [desc]);
  const copy = (text: string) => navigator.clipboard?.writeText(text).then(() => setMsg('Copied.'));

  if (!themes) return <PageSkeleton />;
  const failing = health.filter((h) => !h.ok).length;
  const waText = `Shop at ${biz.name}: ${url}`;

  return (
    <div className="space-y-8">
      {msg && <p className="flex items-start justify-between gap-3 rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-800">{msg}<button onClick={() => setMsg('')} aria-label="Dismiss"><X className="h-4 w-4" /></button></p>}

      {prefs.private && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <Lock className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="flex-1"><p className="font-semibold">Your store is password protected</p><p>Only people with the password can see it. Turn this off when you are ready to sell to everyone.</p></div>
          <button onClick={() => goTab('preferences')} className="font-semibold underline">Change</button>
        </div>
      )}

      {/* current theme */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 p-4">
          <p className="font-semibold text-slate-900">Current theme</p>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${biz.published ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'}`}>{biz.published ? 'Live' : 'Not published'}</span>
        </div>
        <div className="p-4">
          <p className="text-lg font-bold text-slate-900">{live?.name ?? 'Urban'}</p>
          <p className="text-sm text-slate-500">{templateById(live?.template ?? 'prestige').blurb}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button className={btn} onClick={() => live && onEdit(live.id)}>Edit theme</button>
            <a className={btn2} href={`/b/${biz.slug}`} target="_blank" rel="noreferrer">View store <ExternalLink className="ml-1 inline h-3.5 w-3.5" /></a>
            <button className={btn2} onClick={togglePublish} disabled={busy === 'biz'}>{biz.published ? 'Hide store' : 'Launch store'}</button>
          </div>
        </div>
      </section>

      {/* drafts */}
      {drafts.length > 0 && (
        <section>
          <h2 className="font-semibold text-slate-900">Theme library</h2>
          <p className="text-sm text-slate-500">Drafts you can edit safely. Customers only see the current theme.</p>
          <div className="mt-3 space-y-3">
            {drafts.map((t) => (
              <div key={t.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-900">{t.name}</p>
                    <p className="text-xs text-slate-500">Saved {new Date(t.updated_at).toLocaleDateString('en-NG')}{t.scheduled_at ? ` · goes live ${new Date(t.scheduled_at).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' })}` : ''}</p>
                  </div>
                  <div className="relative">
                    <button onClick={() => setMenu(menu === t.id ? null : t.id)} className="rounded-lg border border-slate-300 p-2" aria-label="More actions"><MoreHorizontal className="h-4 w-4" /></button>
                    {menu === t.id && (
                      <div className="absolute right-0 z-10 mt-1 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white text-sm shadow-lg" onClick={() => setMenu(null)}>
                        {[['Rename', () => rename(t)], ['Duplicate', () => duplicate(t)], ['Schedule publish', () => schedule(t)], ['Delete', () => remove(t)]].map(([l, f]) => (
                          <button key={String(l)} onClick={f as () => void} className={`block w-full px-4 py-2.5 text-left hover:bg-slate-50 ${l === 'Delete' ? 'text-red-600' : ''}`}>{String(l)}</button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <button className={btn} onClick={() => publish(t.id)} disabled={!!busy}>{busy === 'pub' + t.id ? 'Publishing...' : 'Publish'}</button>
                  <button className={btn2} onClick={() => onEdit(t.id)}>Edit</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* explore */}
      <section>
        <h2 className="font-semibold text-slate-900">Explore more themes</h2>
        <p className="text-sm text-slate-500">Real online shop designs. Adding one does not change your live store.</p>
        <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-4">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700"><Sparkles className="h-4 w-4 text-blue-600" /> What do you sell? We will suggest a theme</label>
          <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="e.g. ankara dresses, phones, perfumes" className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm" />
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {TEMPLATES.map((tp) => {
            const best = suggested[0]?.score > 0 && suggested[0].id === tp.id;
            const t = tp.settings.colors;
            return (
              <div key={tp.id} className={`overflow-hidden rounded-2xl border bg-white ${best ? 'border-blue-600 ring-2 ring-blue-600/20' : 'border-slate-200'}`}>
                <div className="p-4" style={{ background: t.background }}>
                  <div className="rounded-lg p-3" style={{ background: t.card, border: `1px solid ${t.border}` }}>
                    <div className="h-2 w-16 rounded" style={{ background: t.text }} />
                    <div className="mt-3 grid grid-cols-3 gap-2">{[0, 1, 2].map((i) => <div key={i} className="h-10 rounded" style={{ background: t.border }} />)}</div>
                    <div className="mt-3 h-5 w-20 rounded" style={{ background: t.primary }} />
                  </div>
                </div>
                <div className="p-4">
                  <p className="font-semibold text-slate-900">{tp.name}{best && <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">Best match</span>}</p>
                  <p className="text-sm text-slate-500">{tp.blurb}</p>
                  <button className={`${btn} mt-3 w-full`} onClick={() => addTemplate(tp.id)} disabled={!!busy}><Plus className="mr-1 inline h-4 w-4" />Add to library</button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* health */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="font-semibold text-slate-900">Store health check</p>
        <p className="text-sm text-slate-500">{failing === 0 ? 'Everything looks good. Your store is ready to sell.' : `${failing} thing${failing === 1 ? '' : 's'} to fix so customers can find you and buy.`}</p>
        <ul className="mt-3 space-y-2">
          {health.map((h, i) => (
            <li key={i} className="flex items-start gap-2 text-sm">
              {h.ok ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />}
              <span className={h.ok ? 'text-slate-600' : 'text-slate-900'}>{h.text}{!h.ok && h.fix && h.fix !== 'products' && <button className="ml-2 font-semibold text-blue-600 underline" onClick={() => goTab(h.fix as 'pages' | 'preferences' | 'details')}>Fix</button>}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* share kit */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="font-semibold text-slate-900">Share your store</p>
        <p className="text-sm text-slate-500">Most Nigerian shops sell through WhatsApp and Instagram. Share your link where your customers are.</p>
        <div className="mt-3 flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-sm"><span className="flex-1 truncate">{url}</span><button onClick={() => copy(url)} aria-label="Copy link"><Copy className="h-4 w-4" /></button></div>
        <div className="mt-3 flex flex-wrap gap-2">
          <a className={btn2} target="_blank" rel="noreferrer" href={`https://wa.me/?text=${encodeURIComponent(waText)}`}><MessageCircle className="mr-1 inline h-4 w-4" />Share on WhatsApp</a>
          <button className={btn2} onClick={() => copy(`New: shop online with ${biz.name}. Order and pay on delivery or by transfer. ${url}`)}>Copy caption for Instagram</button>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(url)}`} alt="QR code for your store" width={120} height={120} className="mt-4 rounded-lg border border-slate-200" />
        <p className="mt-1 text-xs text-slate-500">Print this QR code for your shop door, packaging or flyers.</p>
      </section>
    </div>
  );
}
