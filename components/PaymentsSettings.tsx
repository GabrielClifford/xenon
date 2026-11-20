'use client';

import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { ArrowLeft, ChevronRight, MoreHorizontal, Search, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import {
  MAX_METHODS,
  PROVIDERS,
  buildPayOptions,
  defaultPayments,
  isHttps,
  isTestKey,
  isValidKey,
  looksSecret,
  providerName,
  readPayments,
  type CustomMethod,
  type PaymentsConfig,
  type ProviderId,
} from '@/lib/paymentMethods';

const card = 'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm';
const field = 'w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-blue-500';
const label = 'mb-1 block text-sm font-medium text-slate-700';
const primary = 'rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50';
const grayBtn = 'w-full rounded-xl bg-slate-100 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-200';

type Ctx = 'manual' | 'offsite';
type View =
  | { v: 'main' }
  | { v: 'providers' }
  | { v: 'provider'; id: ProviderId }
  | { v: 'add'; ctx: Ctx }
  | { v: 'method'; draft: CustomMethod; isNew: boolean }
  | { v: 'bank' };

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
  const bad = /fail|error|could not|must|match|least|invalid|never/i.test(text);
  return <p className={`mt-3 text-sm ${bad ? 'text-red-600' : 'text-green-700'}`}>{text}</p>;
}

function Sec({ title, text, children }: { title: string; text?: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="font-display text-base font-semibold text-slate-900">{title}</h3>
      {text && <p className="mt-0.5 text-sm text-slate-500">{text}</p>}
      <div className={`${card} mt-3`}>{children}</div>
    </div>
  );
}

function BackLink({ onClick, text }: { onClick: () => void; text: string }) {
  return (
    <button onClick={onClick} className="mb-4 flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900">
      <ArrowLeft className="h-4 w-4" /> {text}
    </button>
  );
}

function Toggle({ checked, onChange, title, text, disabled }: { checked: boolean; onChange: (v: boolean) => void; title: string; text?: string; disabled?: boolean }) {
  return (
    <label className={`flex items-start gap-3 py-3 ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}>
      <input type="checkbox" className="mt-1 h-4 w-4" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span>
        <span className="block text-sm font-medium text-slate-900">{title}</span>
        {text && <span className="block text-xs text-slate-500">{text}</span>}
      </span>
    </label>
  );
}

function Pill({ tone, children }: { tone: 'green' | 'gray' | 'amber'; children: React.ReactNode }) {
  const c = tone === 'green' ? 'bg-green-100 text-green-800' : tone === 'amber' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600';
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${c}`}>{children}</span>;
}

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700">{children}</span>;
}

const blankMethod = (kind: 'manual' | 'offsite', name = '', instructions = '', base: 'cod' | 'transfer' = kind === 'offsite' ? 'transfer' : 'cod'): CustomMethod => ({
  id: crypto.randomUUID(), name, kind, base, instructions, link: '', active: true,
});

type CatalogItem = { id: string; name: string; desc: string; ctx: Ctx | 'any'; go: () => void };

export default function PaymentsSettings({ user }: { user: User }) {
  const [bizId, setBizId] = useState<string | null | undefined>(undefined);
  const [loadError, setLoadError] = useState('');
  const [cfg, setCfg] = useState<PaymentsConfig>(defaultPayments);
  const [bank, setBank] = useState({ bank_name: '', account_number: '', account_name: '' });
  const [view, setView] = useState<View>({ v: 'main' });
  const [menu, setMenu] = useState<string | null>(null);
  const [sheet, setSheet] = useState(false);
  const [tab, setTab] = useState<'method' | 'provider'>('method');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'available' | 'soon'>('all');
  const [keyText, setKeyText] = useState('');
  const [bankDraft, setBankDraft] = useState(bank);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    createClient()
      .from('businesses')
      .select('id,bank_name,account_number,account_name,payments_options')
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
          setCfg(readPayments(data.payments_options));
          const b = { bank_name: data.bank_name ?? '', account_number: data.account_number ?? '', account_name: data.account_name ?? '' };
          setBank(b);
          setBankDraft(b);
        }
      });
  }, [user.id]);

  const bankOk = !!(bank.bank_name.trim() && bank.account_number.trim());
  const activeCount = (c: PaymentsConfig, hasBank = bankOk) => buildPayOptions(c, hasBank, false).length;

  async function persist(next: PaymentsConfig, extra: Record<string, unknown> = {}): Promise<boolean> {
    if (!bizId) return false;
    setSaving(true);
    setMsg('');
    const { error } = await createClient().from('businesses').update({ payments_options: next, ...extra }).eq('id', bizId);
    setSaving(false);
    if (error) {
      setMsg('Could not save: ' + error.message);
      return false;
    }
    setCfg(next);
    return true;
  }

  // refuse any change that would leave the store with no way to pay
  async function change(next: PaymentsConfig, okMsg: string, extra: Record<string, unknown> = {}, hasBank = bankOk): Promise<boolean> {
    if (activeCount(next, hasBank) === 0) {
      setMsg('Could not save: keep at least one payment method turned on.');
      return false;
    }
    const ok = await persist(next, extra);
    if (ok) setMsg(okMsg);
    return ok;
  }

  function go(v: View) {
    setView(v);
    setMenu(null);
    setMsg('');
    setQuery('');
  }

  /* ----- providers ----- */
  function openProvider(id: ProviderId) {
    setKeyText(cfg.providers.find((p) => p.id === id)?.publicKey ?? '');
    go({ v: 'provider', id });
  }

  async function saveProvider(id: ProviderId, active: boolean) {
    const key = keyText.trim();
    if (looksSecret(key)) return setMsg('Could not save: that looks like a secret key. Never paste a secret key here. Use the public key.');
    if (!isValidKey(id, key)) return setMsg(`Could not save: enter a valid ${providerName(id)} public key.`);
    const others = cfg.providers.filter((p) => p.id !== id);
    const next = { ...cfg, providers: [...others, { id, publicKey: key, active }] };
    if (await change(next, `${providerName(id)} saved.`)) setView({ v: 'main' });
  }

  /* ----- custom methods ----- */
  async function saveMethod(draft: CustomMethod, isNew: boolean) {
    const name = draft.name.trim();
    if (!name) return setMsg('Could not save: enter a name for this method.');
    if (cfg.methods.some((m) => m.id !== draft.id && m.name.trim().toLowerCase() === name.toLowerCase()))
      return setMsg('Could not save: you already have a method with this name.');
    if (draft.kind === 'offsite' && !isHttps(draft.link.trim())) return setMsg('Could not save: the payment link must start with https://');
    if (isNew && cfg.methods.length >= MAX_METHODS) return setMsg(`Could not save: you can add up to ${MAX_METHODS} methods.`);
    const clean = { ...draft, name, link: draft.kind === 'offsite' ? draft.link.trim() : '', instructions: draft.instructions.trim() };
    const methods = isNew ? [...cfg.methods, clean] : cfg.methods.map((m) => (m.id === clean.id ? clean : m));
    if (await change({ ...cfg, methods }, 'Saved.')) setView({ v: 'main' });
  }

  async function deleteMethod(id: string) {
    if (!confirm('Delete this payment method?')) return;
    if (await change({ ...cfg, methods: cfg.methods.filter((m) => m.id !== id) }, 'Method deleted.')) setView({ v: 'main' });
  }

  /* ----- bank transfer ----- */
  async function saveBank() {
    const b = { bank_name: bankDraft.bank_name.trim(), account_number: bankDraft.account_number.trim(), account_name: bankDraft.account_name.trim() };
    const filled = !!(b.bank_name && b.account_number);
    if (cfg.transfer && !filled) return setMsg('Could not save: add your bank name and account number, or turn bank transfer off.');
    const ok = await change(cfg, 'Saved.', { bank_name: b.bank_name || null, account_number: b.account_number || null, account_name: b.account_name || null }, filled);
    if (ok) {
      setBank(b);
      setView({ v: 'main' });
    }
  }

  if (bizId === undefined) return <div className="h-40 animate-pulse rounded-2xl bg-slate-100" />;
  if (bizId === null) {
    return (
      <div className="space-y-5">
        <Heading title="Payments" />
        <div className={card}>
          {loadError ? (
            <p className="text-sm text-red-600">
              Could not load payments: {loadError}
              {/payments_options/.test(loadError) && (
                <span className="mt-2 block text-slate-600">Run this in your Supabase SQL editor, then refresh: alter table businesses add column if not exists payments_options jsonb;</span>
              )}
            </p>
          ) : (
            <p className="text-sm text-slate-600">Create your website first (My website) to set this up.</p>
          )}
        </div>
      </div>
    );
  }

  const Row = ({ title, sub, pill, onClick, right }: { title: string; sub?: string; pill?: React.ReactNode; onClick?: () => void; right?: React.ReactNode }) => (
    <div className="flex items-center gap-3 py-3">
      <button onClick={onClick} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-slate-900">{title}</span>
          {sub && <span className="block truncate text-xs text-slate-500">{sub}</span>}
          {pill && <span className="mt-1.5 inline-block">{pill}</span>}
        </span>
        {!right && <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />}
      </button>
      {right}
    </div>
  );

  /* ================= bank transfer ================= */
  if (view.v === 'bank') {
    return (
      <div className="space-y-5">
        <BackLink onClick={() => go({ v: 'main' })} text="Payments" />
        <Heading title="Bank transfer" text="Customers send money to your account and you confirm it before delivery." />
        <div className={card}>
          <Toggle checked={cfg.transfer} onChange={(v) => setCfg({ ...cfg, transfer: v })} title="Offer bank transfer" text="Shown at checkout once your bank details are filled in." />
          <div className="mt-3 space-y-4 border-t border-slate-100 pt-4">
            <div>
              <label className={label}>Bank name</label>
              <input className={field} value={bankDraft.bank_name} onChange={(e) => setBankDraft({ ...bankDraft, bank_name: e.target.value })} />
            </div>
            <div>
              <label className={label}>Account number</label>
              <input className={field} inputMode="numeric" value={bankDraft.account_number} onChange={(e) => setBankDraft({ ...bankDraft, account_number: e.target.value })} />
            </div>
            <div>
              <label className={label}>Account name</label>
              <input className={field} value={bankDraft.account_name} onChange={(e) => setBankDraft({ ...bankDraft, account_name: e.target.value })} />
            </div>
          </div>
        </div>
        <div>
          <button onClick={saveBank} disabled={saving} className={primary}>{saving ? 'Saving...' : 'Save'}</button>
          <Note text={msg} />
        </div>
      </div>
    );
  }

  /* ================= provider list ================= */
  if (view.v === 'providers') {
    const q = query.trim().toLowerCase();
    const list = PROVIDERS.filter((p) => (filter === 'all' ? true : filter === 'available' ? p.available : !p.available)).filter((p) => !q || p.name.toLowerCase().includes(q));
    return (
      <div className="space-y-5">
        <BackLink onClick={() => go({ v: 'main' })} text="Payments" />
        <Heading title="Third-party payment providers" />
        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input className={`${field} pl-9`} placeholder="Filter third-party payment providers" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <select aria-label="Filter" className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm" value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}>
            <option value="all">All</option>
            <option value="available">Available</option>
            <option value="soon">Coming soon</option>
          </select>
        </div>
        <div className={`${card} divide-y divide-slate-100 !py-2`}>
          {list.length === 0 && <p className="py-6 text-center text-sm text-slate-500">No providers match.</p>}
          {list.map((p) => {
            const conn = cfg.providers.find((c) => c.id === p.id);
            return (
              <button
                key={p.id}
                disabled={!p.available}
                onClick={() => p.available && openProvider(p.id as ProviderId)}
                className={`flex w-full items-center gap-3 py-4 text-left ${p.available ? '' : 'opacity-60'}`}
              >
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-900">
                    {p.name}
                    {conn && <Pill tone={conn.active ? 'green' : 'gray'}>{conn.active ? 'Active' : 'Inactive'}</Pill>}
                    {!p.available && <Pill tone="gray">Coming soon</Pill>}
                  </span>
                  <span className="mt-2 flex flex-wrap gap-1.5">{p.methods.map((m) => <Chip key={m}>{m}</Chip>)}</span>
                </span>
                {p.available && <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  /* ================= one provider ================= */
  if (view.v === 'provider') {
    const info = PROVIDERS.find((p) => p.id === view.id)!;
    const conn = cfg.providers.find((p) => p.id === view.id);
    const key = keyText.trim();
    return (
      <div className="space-y-5">
        <BackLink onClick={() => go({ v: 'providers' })} text="Providers" />
        <Heading title={info.name} text={info.blurb} />
        <div className={card}>
          <div className="flex flex-wrap gap-1.5">{info.methods.map((m) => <Chip key={m}>{m}</Chip>)}</div>
          <div className="mt-4">
            <label className={label}>{info.keyLabel}</label>
            <input className={field} placeholder={info.keyExample} autoComplete="off" value={keyText} onChange={(e) => setKeyText(e.target.value)} />
            <p className="mt-1 text-xs text-slate-500">{info.keyHint}</p>
            {key && isValidKey(view.id, key) && isTestKey(key) && (
              <p className="mt-2"><Pill tone="amber">Test key: no real money moves</Pill></p>
            )}
            <p className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-900">
              Only paste your <b>public</b> key. Never paste a secret key here. Your public key is visible to anyone who opens your store.
            </p>
          </div>
        </div>
        <div className={card}>
          <p className="text-sm font-semibold text-slate-900">How it works</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-600">
            <li>The customer places the order, then pays in {info.name}&apos;s secure window.</li>
            <li>The money goes straight to your {info.name} account. Fees are set by {info.name}.</li>
            <li>Xenon cannot confirm payments automatically yet. The payment reference is added to the order note. Check it in your {info.name} dashboard before you deliver.</li>
          </ol>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={() => saveProvider(view.id, true)} disabled={saving} className={primary}>{conn ? 'Save and activate' : 'Connect and activate'}</button>
          {conn && (
            <>
              <button
                onClick={() => saveProvider(view.id, !conn.active)}
                disabled={saving}
                className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                {conn.active ? 'Deactivate' : 'Activate'}
              </button>
              <button
                onClick={async () => {
                  if (confirm(`Remove ${info.name}?`) && (await change({ ...cfg, providers: cfg.providers.filter((p) => p.id !== view.id) }, `${info.name} removed.`))) go({ v: 'providers' });
                }}
                className="text-sm font-medium text-red-600 hover:underline"
              >
                Remove
              </button>
            </>
          )}
        </div>
        <Note text={msg} />
      </div>
    );
  }

  /* ================= add payment method ================= */
  if (view.v === 'add') {
    const ctx = view.ctx;
    const toMethod = (draft: CustomMethod) => setView({ v: 'method', draft, isNew: true });
    const byMethod: CatalogItem[] = [
      { id: 'cards', name: 'Credit and debit cards', desc: 'Pay online with Paystack or Flutterwave', ctx: 'any', go: () => go({ v: 'providers' }) },
      { id: 'bank', name: 'Bank transfer', desc: 'Customers send money to your account', ctx: 'manual', go: () => { setBankDraft(bank); go({ v: 'bank' }); } },
      { id: 'cod', name: 'Cash on delivery', desc: 'Customers pay when the order arrives', ctx: 'manual', go: () => { void change({ ...cfg, cod: true }, 'Cash on delivery is on.').then((ok) => ok && go({ v: 'main' })); } },
      { id: 'pos', name: 'POS on delivery', desc: 'Your rider brings a card machine', ctx: 'manual', go: () => toMethod(blankMethod('manual', 'POS on delivery', 'Our rider will bring a POS machine. Pay by card when your order arrives.', 'cod')) },
      { id: 'wallet', name: 'Transfer app or mobile money', desc: 'OPay, PalmPay, Moniepoint and similar', ctx: 'manual', go: () => toMethod(blankMethod('manual', 'Mobile money transfer', 'Send the total to this account: [bank / wallet and account number]. Use your order number as the reference.', 'transfer')) },
      { id: 'link', name: 'Payment link', desc: 'Send customers to a payment page', ctx: 'offsite', go: () => toMethod(blankMethod('offsite')) },
    ];
    const byProvider: CatalogItem[] = [
      { id: 'paystack', name: 'Paystack', desc: 'Pay in a secure Paystack window', ctx: 'any', go: () => openProvider('paystack') },
      { id: 'flutterwave', name: 'Flutterwave', desc: 'Pay in a secure Flutterwave window', ctx: 'any', go: () => openProvider('flutterwave') },
      { id: 'psl', name: 'Paystack payment page', desc: 'Your Paystack payment link', ctx: 'offsite', go: () => toMethod(blankMethod('offsite', 'Pay with Paystack link')) },
      { id: 'flwl', name: 'Flutterwave payment link', desc: 'Your Flutterwave payment link', ctx: 'offsite', go: () => toMethod(blankMethod('offsite', 'Pay with Flutterwave link')) },
      { id: 'other', name: 'Other payment link', desc: 'Selar, Bumpa or any https payment page', ctx: 'offsite', go: () => toMethod(blankMethod('offsite', 'Pay online')) },
    ];
    const q = query.trim().toLowerCase();
    const items = (tab === 'method' ? byMethod : byProvider).filter((i) => i.ctx === 'any' || i.ctx === ctx).filter((i) => !q || `${i.name} ${i.desc}`.toLowerCase().includes(q));
    return (
      <div className="space-y-5">
        <BackLink onClick={() => go({ v: 'main' })} text="Payments" />
        <Heading title="Add payment method" />
        <div className={card}>
          <div className="flex gap-2">
            {([['method', 'Search by payment method'], ['provider', 'Search by provider']] as const).map(([k, t]) => (
              <button key={k} onClick={() => setTab(k)} className={`rounded-full px-4 py-2 text-sm font-semibold ${tab === k ? 'bg-slate-200 text-slate-900' : 'text-slate-600 hover:bg-slate-100'}`}>{t}</button>
            ))}
          </div>
          <div className="relative mt-4">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input className={`${field} pl-9`} placeholder="Search" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <div className="mt-2 divide-y divide-slate-100">
            {items.length === 0 && <p className="py-6 text-center text-sm text-slate-500">Nothing matches your search.</p>}
            {items.map((i) => (
              <button key={i.id} onClick={i.go} className="flex w-full items-center gap-3 py-3.5 text-left">
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-slate-900">{i.name}</span>
                  <span className="block text-xs text-slate-500">{i.desc}</span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
              </button>
            ))}
          </div>
        </div>
        <Note text={msg} />
      </div>
    );
  }

  /* ================= one custom method ================= */
  if (view.v === 'method') {
    const d = view.draft;
    const set = (p: Partial<CustomMethod>) => setView({ ...view, draft: { ...d, ...p } });
    return (
      <div className="space-y-5">
        <BackLink onClick={() => go({ v: 'main' })} text="Payments" />
        <Heading title={view.isNew ? (d.kind === 'offsite' ? 'Add payment link' : 'Add manual method') : d.name || 'Payment method'} text={d.kind === 'offsite' ? 'Customers are sent to your payment page after they place the order.' : 'Customers see your instructions at checkout and after they order.'} />
        <div className={card}>
          <div className="space-y-4">
            <div>
              <label className={label}>Name shown at checkout</label>
              <input className={field} maxLength={40} value={d.name} onChange={(e) => set({ name: e.target.value })} />
            </div>
            {d.kind === 'offsite' && (
              <div>
                <label className={label}>Payment link</label>
                <input className={field} inputMode="url" placeholder="https://" value={d.link} onChange={(e) => set({ link: e.target.value })} />
              </div>
            )}
            <div>
              <label className={label}>Payment instructions (optional)</label>
              <textarea rows={3} maxLength={500} className={field} value={d.instructions} onChange={(e) => set({ instructions: e.target.value })} />
            </div>
            {d.kind === 'manual' && (
              <div>
                <p className="text-sm font-medium text-slate-900">When does the customer pay?</p>
                {([['cod', 'When the order arrives (like cash on delivery)'], ['transfer', 'Before delivery (like a transfer)']] as const).map(([v, t]) => (
                  <label key={v} className="mt-2 flex cursor-pointer items-center gap-2 text-sm">
                    <input type="radio" checked={d.base === v} onChange={() => set({ base: v })} /> {t}
                  </label>
                ))}
              </div>
            )}
          </div>
          <div className="mt-2 border-t border-slate-100 pt-1">
            <Toggle checked={d.active} onChange={(v) => set({ active: v })} title="Active" text="Show this method at checkout." />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={() => saveMethod(d, view.isNew)} disabled={saving} className={primary}>{saving ? 'Saving...' : 'Save'}</button>
          {!view.isNew && <button onClick={() => deleteMethod(d.id)} className="text-sm font-medium text-red-600 hover:underline">Delete method</button>}
        </div>
        <Note text={msg} />
      </div>
    );
  }

  /* ================= main page ================= */
  const offsite = cfg.methods.filter((m) => m.kind === 'offsite');
  const manual = cfg.methods.filter((m) => m.kind === 'manual');

  return (
    <div className="space-y-7">
      <Heading title="Payments" text="How your customers pay you." />

      <Sec title="Payment providers" text="Providers that let customers pay online by card, bank transfer or USSD. Fees are set by the provider.">
        {cfg.providers.length > 0 && (
          <div className="mb-3 divide-y divide-slate-100">
            {cfg.providers.map((p) => (
              <div key={p.id} className="relative">
                <Row
                  title={providerName(p.id)}
                  pill={<Pill tone={p.active ? 'green' : 'gray'}>{p.active ? 'Active' : 'Inactive'}</Pill>}
                  onClick={() => openProvider(p.id)}
                  right={
                    <>
                      <button onClick={() => setMenu(menu === p.id ? null : p.id)} className="rounded-full bg-slate-100 p-2 hover:bg-slate-200" aria-label="Actions">
                        <MoreHorizontal className="h-5 w-5" />
                      </button>
                      {menu === p.id && (
                        <>
                          <button className="fixed inset-0 z-40 cursor-default" onClick={() => setMenu(null)} aria-label="Close menu" />
                          <div className="absolute right-0 top-12 z-50 w-52 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
                            <button onClick={() => openProvider(p.id)} className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50">Manage</button>
                            <button
                              onClick={async () => {
                                setMenu(null);
                                await change({ ...cfg, providers: cfg.providers.map((x) => (x.id === p.id ? { ...x, active: !x.active } : x)) }, p.active ? 'Deactivated.' : 'Activated.');
                              }}
                              className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50"
                            >
                              {p.active ? 'Deactivate' : 'Activate'}
                            </button>
                            <button
                              onClick={async () => {
                                setMenu(null);
                                if (confirm(`Remove ${providerName(p.id)}?`)) await change({ ...cfg, providers: cfg.providers.filter((x) => x.id !== p.id) }, 'Provider removed.');
                              }}
                              className="block w-full rounded-lg px-3 py-2 text-left text-sm text-red-600 hover:bg-slate-50"
                            >
                              Remove
                            </button>
                          </div>
                        </>
                      )}
                    </>
                  }
                />
              </div>
            ))}
          </div>
        )}
        <button onClick={() => go({ v: 'providers' })} className="rounded-xl bg-slate-100 px-5 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-200">
          {cfg.providers.length > 0 ? 'Add a provider' : 'Choose a provider'}
        </button>
      </Sec>

      <div>
        <h3 className="font-display text-base font-semibold text-slate-900">More ways to pay</h3>
        <p className="mt-0.5 text-sm text-slate-500">Offer methods processed offsite, through a payment link.</p>
        {offsite.length > 0 && (
          <div className={`${card} mt-3 divide-y divide-slate-100 !py-2`}>
            {offsite.map((m) => (
              <Row key={m.id} title={m.name} sub={m.link} pill={<Pill tone={m.active ? 'green' : 'gray'}>{m.active ? 'Active' : 'Inactive'}</Pill>} onClick={() => setView({ v: 'method', draft: m, isNew: false })} />
            ))}
          </div>
        )}
        <button onClick={() => go({ v: 'add', ctx: 'offsite' })} className={`${grayBtn} mt-3`}>+ Method</button>
      </div>

      <div>
        <h3 className="font-display text-base font-semibold text-slate-900">Manual payment methods</h3>
        <p className="mt-0.5 text-sm text-slate-500">Accept payments outside your online store, like bank deposits or cash on delivery.</p>
        <div className={`${card} mt-3 divide-y divide-slate-100 !py-2`}>
          <Toggle
            checked={cfg.cod}
            onChange={(v) => void change({ ...cfg, cod: v }, v ? 'Cash on delivery is on.' : 'Cash on delivery is off.')}
            title="Pay on delivery"
            text="Customers pay when their order arrives."
          />
          <Row
            title="Bank transfer"
            sub={bankOk ? `${bank.bank_name} · ${bank.account_number}` : 'Add your bank details to offer this'}
            pill={<Pill tone={cfg.transfer && bankOk ? 'green' : 'gray'}>{cfg.transfer && bankOk ? 'Active' : 'Off'}</Pill>}
            onClick={() => { setBankDraft(bank); go({ v: 'bank' }); }}
          />
          {manual.map((m) => (
            <Row key={m.id} title={m.name} sub={m.base === 'cod' ? 'Pay when the order arrives' : 'Pay before delivery'} pill={<Pill tone={m.active ? 'green' : 'gray'}>{m.active ? 'Active' : 'Inactive'}</Pill>} onClick={() => setView({ v: 'method', draft: m, isNew: false })} />
          ))}
        </div>
        <button onClick={() => go({ v: 'add', ctx: 'manual' })} className={`${grayBtn} mt-3`}>+ Method</button>
      </div>

      <div>
        <h3 className="font-display text-base font-semibold text-slate-900">Payment configuration</h3>
        <div className={`${card} mt-3 !py-1`}>
          <Row title="Payment capture method" onClick={() => setSheet(true)} />
        </div>
      </div>
      <Note text={msg} />

      {sheet && (
        <div className="fixed inset-0 z-[60] flex items-end bg-black/40 md:items-center md:justify-center" onClick={() => setSheet(false)}>
          <div className="w-full max-w-md rounded-t-3xl bg-white p-5 pb-8 md:rounded-2xl md:pb-5" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-display text-lg font-bold text-slate-900">Payment capture method</h3>
              <button onClick={() => setSheet(false)} className="rounded-full border border-slate-200 p-2 hover:bg-slate-50" aria-label="Close"><X className="h-5 w-5" /></button>
            </div>
            <p className="text-sm text-slate-600">Choose when money is taken for online payments.</p>
            {([
              ['checkout', 'Automatically at checkout', 'Capture payment when an order is placed.', true],
              ['fulfilled', 'Automatically when the entire order is fulfilled', 'Authorize at checkout and capture once the order is fulfilled.', false],
              ['manual', 'Manually', 'Authorize at checkout and capture manually.', false],
            ] as const).map(([v, t, d, on]) => (
              <label key={v} className={`mt-4 flex items-start gap-3 ${on ? '' : 'opacity-50'}`}>
                <input type="radio" className="mt-1" checked={v === 'checkout'} disabled={!on} readOnly />
                <span>
                  <span className="block text-sm font-medium text-slate-900">{t}</span>
                  <span className="block text-xs text-slate-500">{d}{!on && ' Coming soon.'}</span>
                </span>
              </label>
            ))}
            <p className="mt-4 rounded-xl bg-blue-50 px-4 py-3 text-xs text-blue-900">
              Paystack and Flutterwave take payment right away, so capture is always automatic at checkout for now.
            </p>
            <button onClick={() => setSheet(false)} className="mt-5 w-full rounded-xl border border-slate-300 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
