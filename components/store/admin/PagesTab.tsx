'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bold, Eye, EyeOff, Italic, Link2, List, Plus, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { PageSkeleton } from '@/components/Skeleton';
import { Markdown } from '@/lib/store/markdown';
import { AreaF, BoolF, SelectF, TextF } from './fields';
import type { Biz } from './ThemesHome';

type PageRow = { id: string; title: string; handle: string; body: string; template: 'default' | 'contact' | 'faq'; visible: boolean; publish_at: string | null; seo_title: string | null; seo_description: string | null };
const handleOf = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
const btn = 'rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-500';
const btn2 = 'rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50';

const STARTERS: { title: string; template: PageRow['template']; body: string }[] = [
  { title: 'About us', template: 'default', body: '## Who we are\n\nTell customers who you are, how long you have been selling and why they can trust you.\n\n## Why shop with us\n\n- Genuine products\n- Fast delivery\n- Pay on delivery available' },
  { title: 'Contact us', template: 'contact', body: 'We reply fast on WhatsApp. Send us a message with the product you want and we will help you order.' },
  { title: 'Delivery information', template: 'default', body: '## Delivery times\n\n- Within your city: same or next day\n- Other states: 2 to 5 days\n\n## Delivery fees\n\nFees depend on your location and show at checkout.' },
  { title: 'FAQ', template: 'faq', body: '**How do I order?**\nAdd items to your cart and checkout. You can pay by transfer or on delivery.\n\n**Can I return an item?**\nYes. Tell us within 24 hours of delivery.' },
];

const phoneOf = (b: Biz) => b.phone || 'our WhatsApp number';
const SUPPORT = (b: Biz): { title: string; template: PageRow['template']; body: string }[] => [
  { title: 'Contact us', template: 'contact', body: `We would love to hear from you.\n\nWhatsApp or call: ${phoneOf(b)}\n\nSend us a message any time and we will reply as soon as we can.` },
  { title: 'Shipping', template: 'default', body: `Delivery areas, fees and timelines depend on your location. Any delivery fee is shown at checkout.\n\nTo confirm delivery to your area before you order, message us on WhatsApp at ${phoneOf(b)}.` },
  { title: 'Returns & Exchanges', template: 'default', body: `If something is wrong with your order, contact us as soon as possible after it arrives.\n\n- Items must be unused and in their original condition\n- Tell us within 24 hours of delivery\n\nTo start a return or exchange, message us on WhatsApp at ${phoneOf(b)}.` },
  { title: 'Privacy Policy', template: 'default', body: 'We collect your name, phone number and delivery address only to process and deliver your orders.\n\nWe never sell your personal information. To ask about or delete your data, contact us.' },
  { title: 'Terms and Conditions', template: 'default', body: 'By using this website and placing an order, you agree to these terms.\n\n- Prices are in Naira (₦)\n- An order is confirmed once payment is received or accepted for pay on delivery\n- We may cancel an order if an item is out of stock, and you will get a full refund\n\nSee our Shipping and Returns & Exchanges pages for delivery and return details.' },
  { title: 'FAQ', template: 'faq', body: `**How long does delivery take?**\nIt depends on your location. Message us on WhatsApp at ${phoneOf(b)} and we will confirm for your area.\n\n**How can I pay?**\nBy bank transfer, or pay on delivery where available.\n\n**Can I return an item?**\nYes, see our Returns & Exchanges page.` },
];

export default function PagesTab({ biz }: { biz: Biz }) {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<PageRow[] | null>(null);
  const [edit, setEdit] = useState<PageRow | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from('store_pages').select('id, title, handle, body, template, visible, publish_at, seo_title, seo_description').eq('business_id', biz.id).order('created_at');
    setRows((data ?? []) as PageRow[]);
  }, [supabase, biz.id]);
  useEffect(() => { load(); }, [load]);

  async function addSupport() {
    const have = new Set((rows ?? []).map((r) => r.handle));
    const todo = SUPPORT(biz).filter((p) => !have.has(handleOf(p.title)));
    if (todo.length === 0) return setMsg('You already have all the support pages.');
    setSaving(true); setMsg('');
    const { error } = await supabase.from('store_pages').insert(todo.map((p) => ({ business_id: biz.id, title: p.title, handle: handleOf(p.title), body: p.body, template: p.template, visible: true })));
    setSaving(false);
    setMsg(error ? error.message : `${todo.length} support page${todo.length === 1 ? '' : 's'} added and visible. Edit the wording so it matches your shop.`);
    load();
  }

  const start = (t?: (typeof STARTERS)[number]) => {
    setIsNew(true); setPreview(false); setMsg('');
    setEdit({ id: '', title: t?.title ?? '', handle: handleOf(t?.title ?? ''), body: t?.body ?? '', template: t?.template ?? 'default', visible: false, publish_at: null, seo_title: null, seo_description: null });
  };

  async function save() {
    if (!edit) return;
    const title = edit.title.trim(); const handle = handleOf(edit.handle || title);
    if (!title) return setMsg('Give the page a title.');
    if (!handle) return setMsg('The page address can only use letters and numbers.');
    setSaving(true); setMsg('');
    const payload = { title, handle, body: edit.body, template: edit.template, visible: edit.visible, publish_at: edit.publish_at, seo_title: edit.seo_title || null, seo_description: edit.seo_description || null };
    const { error } = isNew
      ? await supabase.from('store_pages').insert({ ...payload, business_id: biz.id })
      : await supabase.from('store_pages').update(payload).eq('id', edit.id);
    setSaving(false);
    if (error) return setMsg(error.code === '23505' ? 'You already have a page with this address. Change the address.' : error.message);
    setEdit(null); await load();
  }
  async function remove(p: PageRow) {
    if (!window.confirm(`Delete "${p.title}"?`)) return;
    await supabase.from('store_pages').delete().eq('id', p.id);
    setEdit(null); load();
  }
  async function quickToggle(p: PageRow) { await supabase.from('store_pages').update({ visible: !p.visible }).eq('id', p.id); load(); }

  // toolbar for the text box
  function wrap(before: string, after = before, placeholder = 'text') {
    if (!edit) return;
    const ta = document.getElementById('page-body') as HTMLTextAreaElement | null;
    const a = ta?.selectionStart ?? edit.body.length; const b = ta?.selectionEnd ?? a;
    const sel = edit.body.slice(a, b) || placeholder;
    setEdit({ ...edit, body: edit.body.slice(0, a) + before + sel + after + edit.body.slice(b) });
  }

  if (!rows) return <PageSkeleton />;

  if (edit) {
    const url = `/b/${biz.slug}/pages/${handleOf(edit.handle || edit.title)}`;
    return (
      <div className="space-y-4">
        <button onClick={() => setEdit(null)} className="text-sm font-semibold text-blue-600">← All pages</button>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <TextF label="Title" value={edit.title} onChange={(v) => setEdit({ ...edit, title: v, handle: isNew ? handleOf(v) : edit.handle })} />
          <SelectF label="Page type" value={edit.template} options={[['default', 'Normal page'], ['contact', 'Contact page (adds WhatsApp and Call buttons)'], ['faq', 'FAQ']]} onChange={(v) => setEdit({ ...edit, template: v })} />
          <div className="mb-1 flex items-center gap-1">
            {[[Bold, () => wrap('**'), 'Bold'], [Italic, () => wrap('*'), 'Italic'], [List, () => wrap('- ', '', 'item'), 'List'], [Link2, () => wrap('[', '](https://)', 'link text'), 'Link']].map(([Ic, f, l], i) => {
              const I = Ic as typeof Bold;
              return <button key={i} onClick={f as () => void} className="rounded-lg border border-slate-300 p-2" aria-label={l as string}><I className="h-4 w-4" /></button>;
            })}
            <button onClick={() => setPreview(!preview)} className="ml-auto text-sm font-semibold text-blue-600">{preview ? 'Edit' : 'Preview'}</button>
          </div>
          {preview
            ? <div className="min-h-[200px] rounded-lg border border-slate-200 p-4 text-sm"><Markdown text={edit.body} ctx={{ slug: biz.slug, trusted: [] }} /></div>
            : <textarea id="page-body" rows={12} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-600" value={edit.body} onChange={(e) => setEdit({ ...edit, body: e.target.value })} placeholder="Write your page here. Use ## for headings." />}
          <p className="mt-1 text-[11px] text-slate-500">Use ## for a heading, **bold**, *italic*, - for bullet points, [text](link) for links.</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <BoolF label="Visible to customers" value={edit.visible} onChange={(v) => setEdit({ ...edit, visible: v })} />
          <TextF label="Publish on (optional)" value={edit.publish_at ? edit.publish_at.slice(0, 16).replace('T', ' ') : ''} placeholder="2026-12-01 08:00" hint="Leave empty to publish straight away when visible."
            onChange={(v) => { const d = v.trim() ? new Date(v.trim().replace(' ', 'T')) : null; setEdit({ ...edit, publish_at: d && !isNaN(d.getTime()) ? d.toISOString() : null }); }} />
          <TextF label="Page address" value={edit.handle} onChange={(v) => setEdit({ ...edit, handle: handleOf(v) })} hint={url} />
          <TextF label="Search title (SEO)" value={edit.seo_title ?? ''} onChange={(v) => setEdit({ ...edit, seo_title: v.slice(0, 70) })} />
          <AreaF label="Search description (SEO)" rows={2} value={edit.seo_description ?? ''} onChange={(v) => setEdit({ ...edit, seo_description: v.slice(0, 320) })} />
        </div>
        {msg && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{msg}</p>}
        <div className="flex gap-2">
          <button className={btn} onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save page'}</button>
          {!isNew && <button className={btn2} onClick={() => remove(edit)}><Trash2 className="mr-1 inline h-4 w-4" />Delete</button>}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div><h2 className="font-semibold text-slate-900">Pages</h2><p className="text-sm text-slate-500">About, Contact, Delivery and other pages customers can read.</p></div>
        <button className={btn} onClick={() => start()}><Plus className="mr-1 inline h-4 w-4" />Add page</button>
      </div>
      {msg && <p className="rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-800">{msg}</p>}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="min-w-0 flex-1"><p className="font-semibold text-slate-900">Customer support pages</p><p className="text-sm text-slate-500">Contact us, Shipping, Returns, Privacy, Terms and FAQ in one tap. They also appear under Customer Support in your store menu.</p></div>
        <button className={btn2} onClick={addSupport} disabled={saving}>{saving ? 'Adding...' : 'Add support pages'}</button>
      </div>
      {rows.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="font-semibold text-slate-900">Start with a ready-made page</p>
          <p className="text-sm text-slate-500">Shops with About and Delivery pages get more trust and fewer questions.</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">{STARTERS.map((t) => <button key={t.title} onClick={() => start(t)} className="rounded-xl border border-slate-300 px-4 py-3 text-left text-sm font-semibold hover:bg-slate-50">{t.title}</button>)}</div>
        </div>
      ) : (
        <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {rows.map((p) => (
            <div key={p.id} className="flex items-center gap-3 p-4">
              <button className="min-w-0 flex-1 text-left" onClick={() => { setIsNew(false); setPreview(false); setMsg(''); setEdit(p); }}>
                <p className="truncate font-semibold text-slate-900">{p.title}</p>
                <p className="truncate text-xs text-slate-500">/pages/{p.handle}{p.publish_at && new Date(p.publish_at) > new Date() ? ` · goes live ${new Date(p.publish_at).toLocaleDateString('en-NG')}` : ''}</p>
              </button>
              <button onClick={() => quickToggle(p)} className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${p.visible ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'}`}>{p.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}{p.visible ? 'Visible' : 'Hidden'}</button>
            </div>
          ))}
        </div>
      )}
      {rows.length > 0 && <p className="text-xs text-slate-500">Visible pages appear in your store footer automatically.</p>}
    </div>
  );
}
