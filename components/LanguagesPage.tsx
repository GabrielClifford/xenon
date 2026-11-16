'use client';

import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { Check, ChevronDown, Copy, MoreHorizontal, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import {
  DEFAULT_LANGUAGE,
  LANGUAGES,
  MAX_LANGUAGES,
  langName,
  readLanguages,
  type StoreLanguage,
} from '@/lib/languages';

const card = 'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm';
const field = 'w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-blue-500';
const label = 'mb-1 block text-sm font-medium text-slate-700';
const primary = 'rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50';

function Heading({ title, text }: { title: string; text?: string }) {
  return (
    <div className="mb-4">
      <h2 className="font-display text-xl font-bold text-slate-900">{title}</h2>
      {text && <p className="mt-1 text-sm text-slate-500">{text}</p>}
    </div>
  );
}

function Note({ text }: { text: string }) {
  if (!text) return null;
  const bad = /fail|error|could not|must|match|least|invalid/i.test(text);
  return <p className={`mt-3 text-sm ${bad ? 'text-red-600' : 'text-green-700'}`}>{text}</p>;
}

function Pill({ tone, children }: { tone: 'green' | 'gray'; children: React.ReactNode }) {
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
        tone === 'green' ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'
      }`}
    >
      {children}
    </span>
  );
}

export default function LanguagesPage({ user, onGo }: { user: User; onGo: (id: 'general') => void }) {
  const [bizId, setBizId] = useState<string | null | undefined>(undefined);
  const [loadError, setLoadError] = useState('');
  const [slug, setSlug] = useState('');
  const [langs, setLangs] = useState<StoreLanguage[]>([]);
  const [menu, setMenu] = useState<string | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [sheet, setSheet] = useState(false);
  const [pick, setPick] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [copied, setCopied] = useState('');
  const origin = typeof window === 'undefined' ? '' : window.location.origin;

  useEffect(() => {
    createClient()
      .from('businesses')
      .select('id,slug,languages_options')
      .eq('owner_id', user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) {
          setLoadError(error.message);
          setBizId(null);
          return;
        }
        setBizId(data?.id ?? null);
        if (data) {
          setSlug(data.slug);
          setLangs(readLanguages(data.languages_options));
        }
      });
  }, [user.id]);

  async function persist(next: StoreLanguage[]): Promise<boolean> {
    if (!bizId) return false;
    setSaving(true);
    setMsg('');
    const { error } = await createClient()
      .from('businesses')
      .update({ languages_options: { languages: next } })
      .eq('id', bizId);
    setSaving(false);
    if (error) {
      setMsg('Could not save: ' + error.message);
      return false;
    }
    setLangs(next);
    return true;
  }

  const total = langs.length + 1;
  const atLimit = total >= MAX_LANGUAGES;
  const taken = new Set([DEFAULT_LANGUAGE, ...langs.map((l) => l.code)]);
  const choices = LANGUAGES.filter((l) => !taken.has(l.code));

  function openSheet() {
    setPick('');
    setMsg('');
    setSheet(true);
  }

  async function addLanguage() {
    if (!pick) return;
    if (atLimit) return setMsg(`Could not add: you can have up to ${MAX_LANGUAGES} languages.`);
    const name = langName(pick);
    if (await persist([...langs, { code: pick, published: false }])) {
      setSheet(false);
      setMsg(`${name} added. Publish it when you are ready.`);
    }
  }

  async function setPublished(code: string, published: boolean) {
    setMenu(null);
    const name = langName(code);
    if (await persist(langs.map((l) => (l.code === code ? { ...l, published } : l)))) {
      setMsg(published ? `${name} published.` : `${name} unpublished.`);
    }
  }

  async function remove(code: string) {
    setMenu(null);
    const name = langName(code);
    if (!confirm(`Remove ${name} from your store?`)) return;
    if (await persist(langs.filter((l) => l.code !== code))) setMsg(`${name} removed.`);
  }

  async function copy(link: string, code: string) {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(code);
      setTimeout(() => setCopied(''), 2000);
    } catch {
      /* clipboard blocked */
    }
  }

  if (bizId === undefined) return <div className="h-40 animate-pulse rounded-2xl bg-slate-100" />;
  if (bizId === null) {
    return (
      <div className="space-y-5">
        <Heading title="Languages" />
        <div className={card}>
          {loadError ? (
            <p className="text-sm text-red-600">
              Could not load languages: {loadError}
              {/languages_options/.test(loadError) && (
                <span className="mt-2 block text-slate-600">
                  Run this in your Supabase SQL editor, then refresh: alter table businesses add column if not exists languages_options jsonb;
                </span>
              )}
            </p>
          ) : (
            <p className="text-sm text-slate-600">Create your website first (My website) to set this up.</p>
          )}
        </div>
      </div>
    );
  }

  const rows: { code: string; published: boolean; isDefault: boolean }[] = [
    { code: DEFAULT_LANGUAGE, published: true, isDefault: true },
    ...langs.map((l) => ({ ...l, isDefault: false })),
  ];

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <Heading title="Languages" text="Offer your store in more than one language." />
        <button onClick={openSheet} disabled={atLimit} className={primary}>
          Add language
        </button>
      </div>

      <div className={`${card} !p-0 overflow-hidden`}>
        <div className="grid grid-cols-[1fr_auto] gap-3 border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs font-semibold text-slate-600 sm:grid-cols-[1.2fr_1fr_1.2fr_auto]">
          <span>Language</span>
          <span className="hidden sm:block">Status</span>
          <span className="hidden sm:block">Domains</span>
          <span className="w-9" />
        </div>
        <div className="divide-y divide-slate-100">
          {rows.map((r) => {
            const link = `${origin}/b/${slug}${r.isDefault ? '' : `?lang=${r.code}`}`;
            const expanded = !!open[r.code];
            return (
              <div key={r.code} className="px-5 py-4">
                <div className="grid grid-cols-[1fr_auto] items-center gap-3 sm:grid-cols-[1.2fr_1fr_1.2fr_auto]">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{langName(r.code)}</p>
                    {r.isDefault && <p className="text-xs text-slate-500">Default</p>}
                    <div className="mt-1.5 sm:hidden">
                      <Pill tone={r.published ? 'green' : 'gray'}>{r.published ? 'Published' : 'Unpublished'}</Pill>
                    </div>
                  </div>
                  <div className="hidden sm:block">
                    <Pill tone={r.published ? 'green' : 'gray'}>{r.published ? 'Published' : 'Unpublished'}</Pill>
                  </div>
                  <button
                    onClick={() => setOpen((o) => ({ ...o, [r.code]: !o[r.code] }))}
                    className="hidden items-center gap-1 text-left text-sm text-slate-700 sm:flex"
                    aria-expanded={expanded}
                  >
                    1 domain <ChevronDown className={`h-4 w-4 transition ${expanded ? 'rotate-180' : ''}`} />
                  </button>
                  <div className="relative">
                    <button
                      onClick={() => setMenu(menu === r.code ? null : r.code)}
                      className="rounded-full bg-slate-100 p-2 hover:bg-slate-200"
                      aria-label={`Actions for ${langName(r.code)}`}
                    >
                      <MoreHorizontal className="h-5 w-5" />
                    </button>
                    {menu === r.code && (
                      <>
                        <button className="fixed inset-0 z-40 cursor-default" onClick={() => setMenu(null)} aria-label="Close menu" />
                        <div className="absolute right-0 z-50 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
                          {r.isDefault ? (
                            <p className="px-3 py-2 text-xs text-slate-500">
                              English is your default language. It is always published and cannot be removed.
                            </p>
                          ) : (
                            <>
                              <button
                                onClick={() => setPublished(r.code, !r.published)}
                                className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50"
                              >
                                {r.published ? 'Unpublish' : 'Publish'}
                              </button>
                              <button
                                onClick={() => remove(r.code)}
                                className="block w-full rounded-lg px-3 py-2 text-left text-sm text-red-600 hover:bg-slate-50"
                              >
                                Remove
                              </button>
                            </>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* domains: a dropdown on phones too */}
                <button
                  onClick={() => setOpen((o) => ({ ...o, [r.code]: !o[r.code] }))}
                  className="mt-2 flex items-center gap-1 text-sm text-slate-700 sm:hidden"
                  aria-expanded={expanded}
                >
                  1 domain <ChevronDown className={`h-4 w-4 transition ${expanded ? 'rotate-180' : ''}`} />
                </button>
                {expanded && (
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <input
                      readOnly
                      value={link}
                      onFocus={(e) => e.currentTarget.select()}
                      className={`${field} min-w-0 flex-1 bg-slate-50`}
                    />
                    <button onClick={() => copy(link, r.code)} className={`${primary} flex items-center justify-center gap-2`}>
                      {copied === r.code ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      {copied === r.code ? 'Copied!' : 'Copy link'}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <Note text={msg} />
      {atLimit && <p className="text-xs text-slate-500">You have reached the limit of {MAX_LANGUAGES} languages.</p>}

      <div className={card}>
        <div className="flex flex-wrap items-center gap-3">
          <p className="font-medium text-slate-900">Translating your store</p>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">Coming soon</span>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          Translating your products, checkout and policies will be added soon. Languages you add now are saved and will
          show on your store once translations are ready.
        </p>
      </div>

      <p className="text-sm text-slate-600">
        To change your account language,{' '}
        <button onClick={() => onGo('general')} className="font-medium text-slate-900 underline">
          manage account
        </button>
        .
      </p>

      {/* Add language sheet */}
      {sheet && (
        <div
          className="fixed inset-0 z-[60] flex items-end bg-black/40 md:items-center md:justify-center"
          onClick={() => setSheet(false)}
        >
          <div
            className="w-full max-w-md rounded-t-3xl bg-white p-5 pb-8 md:rounded-2xl md:pb-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-display text-lg font-bold text-slate-900">Add language</h3>
              <button onClick={() => setSheet(false)} className="rounded-full border border-slate-200 p-2 hover:bg-slate-50" aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>
            <label className={label}>Language</label>
            <select className={field} value={pick} onChange={(e) => setPick(e.target.value)}>
              <option value="">Select...</option>
              {choices.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.name}
                  {l.native !== l.name ? ` (${l.native})` : ''}
                </option>
              ))}
            </select>
            <p className="mt-3 text-sm text-slate-500">
              The language is added as unpublished. Publish it when you are ready for customers to see it.
            </p>
            <div className="mt-5 space-y-2">
              <button onClick={addLanguage} disabled={!pick || saving} className={`${primary} w-full py-3`}>
                {saving ? 'Adding...' : 'Add language'}
              </button>
              <button
                onClick={() => setSheet(false)}
                className="w-full rounded-xl border border-slate-300 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
