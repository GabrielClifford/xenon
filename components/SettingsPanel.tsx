'use client';

import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import {
  ArrowLeft, Bell, Check, ChevronRight, ClipboardList, Copy, Database, FileText, Globe, KeyRound,
  Languages, LayoutGrid, Link2, Lock, MapPin, MousePointerClick, Percent, Receipt, Search, Share2,
  ShieldCheck, ShoppingCart, Store, Truck, User as UserIcon, Users, Wallet,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { Tab } from '@/components/DashboardOverview';

type PageId =
  | 'general' | 'plan' | 'billing' | 'users' | 'roles' | 'security' | 'payments' | 'checkout'
  | 'accounts' | 'shipping' | 'taxes' | 'locations' | 'markets' | 'apps' | 'channels' | 'domains'
  | 'events' | 'notifications' | 'metafields' | 'languages' | 'privacy' | 'policies';

// "soon" holds the text shown on a page that is not built yet
type Item = { id: PageId; label: string; icon: React.ElementType; sub?: boolean; soon?: string };

const items: Item[] = [
  { id: 'general', label: 'General', icon: Store },
  { id: 'plan', label: 'Plan', icon: ClipboardList, soon: 'See your current Xenon plan and compare plans. Online plan payments are coming once our payment setup is complete.' },
  { id: 'billing', label: 'Billing', icon: Receipt, soon: 'Your Xenon invoices and payment history will show here.' },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'roles', label: 'Roles', icon: KeyRound, sub: true, soon: 'Choose what each team member can see and do.' },
  { id: 'security', label: 'Security', icon: ShieldCheck, sub: true },
  { id: 'payments', label: 'Payments', icon: Wallet },
  { id: 'checkout', label: 'Checkout', icon: ShoppingCart },
  { id: 'accounts', label: 'Customer accounts', icon: UserIcon, soon: 'Let your customers create accounts to see their past orders.' },
  { id: 'shipping', label: 'Shipping and delivery', icon: Truck, soon: 'Set delivery fees, pickup, and the areas you deliver to.' },
  { id: 'taxes', label: 'Taxes and duties', icon: Percent, soon: 'Add tax to your prices at checkout.' },
  { id: 'locations', label: 'Locations', icon: MapPin, soon: 'Manage your business addresses and where customers can find you.' },
  { id: 'markets', label: 'Markets', icon: Globe, soon: 'Sell to customers in other regions and currencies.' },
  { id: 'apps', label: 'Apps', icon: LayoutGrid, soon: 'Connect extra tools to your website.' },
  { id: 'channels', label: 'Sales channels', icon: Share2 },
  { id: 'domains', label: 'Domains', icon: Link2 },
  { id: 'events', label: 'Customer events', icon: MousePointerClick, soon: 'Track what customers do on your website.' },
  { id: 'notifications', label: 'Notifications', icon: Bell, soon: 'Choose how you are alerted about new orders and enquiries.' },
  { id: 'metafields', label: 'Metafields and metaobjects', icon: Database, soon: 'Add custom information fields to your products and orders.' },
  { id: 'languages', label: 'Languages', icon: Languages, soon: 'Offer your website in more than one language.' },
  { id: 'privacy', label: 'Customer privacy', icon: Lock, soon: 'Cookie notice and privacy options for your visitors.' },
  { id: 'policies', label: 'Policies', icon: FileText, soon: 'Add your refund, shipping and privacy policies to your website.' },
];

type Meta = { full_name?: string; phone?: string; role?: string; trade?: string };

const card = 'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm';
const field = 'w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-blue-500';
const label = 'mb-1 block text-sm font-medium text-slate-700';
const primary = 'rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50';

function Note({ text }: { text: string }) {
  if (!text) return null;
  const bad = /fail|error|could not|must|match|least|invalid/i.test(text);
  return <p className={`mt-3 text-sm ${bad ? 'text-red-600' : 'text-green-700'}`}>{text}</p>;
}

function Heading({ title, text }: { title: string; text?: string }) {
  return (
    <div className="mb-4">
      <h2 className="font-display text-xl font-bold text-slate-900">{title}</h2>
      {text && <p className="mt-1 text-sm text-slate-500">{text}</p>}
    </div>
  );
}

function SoonPage({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <Heading title={title} />
      <div className={card}>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">Coming soon</span>
        <p className="mt-4 text-sm text-slate-600">{text}</p>
        <p className="mt-2 text-sm text-slate-400">We are working on this and it will appear here when it is ready.</p>
      </div>
    </div>
  );
}

function GeneralPage({
  user,
  onUserChange,
  onNavigate,
}: {
  user: User;
  onUserChange: (u: User) => void;
  onNavigate: (t: Tab) => void;
}) {
  const meta = (user.user_metadata ?? {}) as Meta;
  const [name, setName] = useState(meta.full_name ?? '');
  const [phone, setPhone] = useState(meta.phone ?? '');
  const [biz, setBiz] = useState<{ name: string; published: boolean } | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    createClient()
      .from('businesses')
      .select('name,published')
      .eq('owner_id', user.id)
      .maybeSingle()
      .then(({ data }) => setBiz(data ?? null));
  }, [user.id]);

  async function save() {
    setSaving(true);
    setMsg('');
    const { data, error } = await createClient().auth.updateUser({
      data: { full_name: name.trim(), phone: phone.trim() },
    });
    setSaving(false);
    if (error) return setMsg('Could not save: ' + error.message);
    if (data.user) onUserChange(data.user);
    setMsg('Saved.');
  }

  return (
    <div className="space-y-5">
      <Heading title="General" text="Your account details." />
      <div className={card}>
        <div className="space-y-4">
          <div>
            <label className={label}>Full name</label>
            <input className={field} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className={label}>Phone number</label>
            <input className={field} inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div>
            <label className={label}>Email</label>
            <input className={`${field} bg-slate-50 text-slate-500`} value={user.email ?? ''} readOnly />
          </div>
          <div>
            <label className={label}>Account type</label>
            <input
              className={`${field} bg-slate-50 text-slate-500`}
              value={meta.role === 'artisan' ? `Business owner${meta.trade ? ` · ${meta.trade}` : ''}` : 'Customer'}
              readOnly
            />
          </div>
        </div>
        <button onClick={save} disabled={saving} className={`${primary} mt-5`}>
          {saving ? 'Saving...' : 'Save'}
        </button>
        <Note text={msg} />
      </div>

      {biz && (
        <div className={`${card} flex flex-wrap items-center gap-3`}>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-slate-500">Your business</p>
            <p className="truncate font-semibold text-slate-900">{biz.name}</p>
            <p className="text-xs text-slate-500">{biz.published ? 'Live' : 'Not published'}</p>
          </div>
          <button
            onClick={() => onNavigate('website')}
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Edit in My website
          </button>
        </div>
      )}
    </div>
  );
}

function UsersPage({ user }: { user: User }) {
  const meta = (user.user_metadata ?? {}) as Meta;
  const name = meta.full_name || user.email || 'You';
  const initials = name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  return (
    <div className="space-y-5">
      <Heading title="Users" text="People who can sign in to this dashboard." />
      <div className={card}>
        <div className="flex items-center gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-semibold text-white">
            {initials}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-slate-900">{name}</p>
            <p className="truncate text-sm text-slate-500">{user.email}</p>
          </div>
          <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800">Owner</span>
        </div>
      </div>
      <div className={card}>
        <p className="font-medium text-slate-900">Add team members</p>
        <p className="mt-1 text-sm text-slate-500">
          Inviting staff to help manage orders is coming soon. For now, only the owner can sign in.
        </p>
      </div>
    </div>
  );
}

function SecurityPage({ onLogout }: { onLogout: () => void }) {
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [msg2, setMsg2] = useState('');

  async function change() {
    setMsg('');
    if (pw.length < 8) return setMsg('Your password must be at least 8 characters.');
    if (pw !== pw2) return setMsg('The two passwords do not match.');
    setBusy(true);
    const { error } = await createClient().auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return setMsg('Could not change password: ' + error.message);
    setPw('');
    setPw2('');
    setMsg('Password changed.');
  }

  async function others() {
    setMsg2('');
    const { error } = await createClient().auth.signOut({ scope: 'others' });
    setMsg2(error ? 'Could not sign out other devices: ' + error.message : 'Signed out of all your other devices.');
  }

  return (
    <div className="space-y-5">
      <Heading title="Security" text="Keep your account safe." />
      <div className={card}>
        <p className="font-medium text-slate-900">Change password</p>
        <div className="mt-4 space-y-4">
          <div>
            <label className={label}>New password</label>
            <input type="password" autoComplete="new-password" className={field} value={pw} onChange={(e) => setPw(e.target.value)} />
          </div>
          <div>
            <label className={label}>Confirm new password</label>
            <input type="password" autoComplete="new-password" className={field} value={pw2} onChange={(e) => setPw2(e.target.value)} />
          </div>
        </div>
        <button onClick={change} disabled={busy} className={`${primary} mt-5`}>
          {busy ? 'Saving...' : 'Change password'}
        </button>
        <Note text={msg} />
      </div>
      <div className={card}>
        <p className="font-medium text-slate-900">Sign out</p>
        <p className="mt-1 text-sm text-slate-500">Lost a phone, or used a shared computer? Sign out everywhere else.</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            onClick={others}
            className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Sign out other devices
          </button>
          <button
            onClick={onLogout}
            className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Log out
          </button>
        </div>
        <Note text={msg2} />
      </div>
    </div>
  );
}

function PaymentsPage({ user }: { user: User }) {
  const [bizId, setBizId] = useState<string | null | undefined>(undefined);
  const [bank, setBank] = useState({ bank_name: '', account_number: '', account_name: '' });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    createClient()
      .from('businesses')
      .select('id,bank_name,account_number,account_name')
      .eq('owner_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        setBizId(data?.id ?? null);
        if (data) {
          setBank({
            bank_name: data.bank_name ?? '',
            account_number: data.account_number ?? '',
            account_name: data.account_name ?? '',
          });
        }
      });
  }, [user.id]);

  async function save() {
    if (!bizId) return;
    setSaving(true);
    setMsg('');
    const { error } = await createClient()
      .from('businesses')
      .update({
        bank_name: bank.bank_name.trim() || null,
        account_number: bank.account_number.trim() || null,
        account_name: bank.account_name.trim() || null,
      })
      .eq('id', bizId);
    setSaving(false);
    setMsg(error ? 'Could not save: ' + error.message : 'Saved. Customers can now choose bank transfer at checkout.');
  }

  return (
    <div className="space-y-5">
      <Heading title="Payments" text="How your customers pay you." />
      <div className={card}>
        <p className="font-medium text-slate-900">Pay on delivery</p>
        <p className="mt-1 text-sm text-slate-500">Always on. Customers pay you when their order arrives.</p>
      </div>
      <div className={card}>
        <p className="font-medium text-slate-900">Bank transfer</p>
        <p className="mt-1 text-sm text-slate-500">
          Fill these in to let customers pay by transfer. Leave them empty to turn bank transfer off.
        </p>
        {bizId === null ? (
          <p className="mt-4 text-sm text-slate-600">Create your website first (My website) to set this up.</p>
        ) : (
          <>
            <div className="mt-4 space-y-4">
              <div>
                <label className={label}>Bank name</label>
                <input className={field} value={bank.bank_name} onChange={(e) => setBank({ ...bank, bank_name: e.target.value })} />
              </div>
              <div>
                <label className={label}>Account number</label>
                <input className={field} inputMode="numeric" value={bank.account_number} onChange={(e) => setBank({ ...bank, account_number: e.target.value })} />
              </div>
              <div>
                <label className={label}>Account name</label>
                <input className={field} value={bank.account_name} onChange={(e) => setBank({ ...bank, account_name: e.target.value })} />
              </div>
            </div>
            <button onClick={save} disabled={saving || bizId === undefined} className={`${primary} mt-5`}>
              {saving ? 'Saving...' : 'Save'}
            </button>
            <Note text={msg} />
          </>
        )}
      </div>
      <div className={card}>
        <div className="flex items-center gap-3">
          <p className="font-medium text-slate-900">Card payments</p>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">Coming soon</span>
        </div>
        <p className="mt-1 text-sm text-slate-500">Let customers pay by card on your website, with the money going to your bank account.</p>
      </div>
    </div>
  );
}

function ChannelsPage({ onNavigate }: { onNavigate: (t: Tab) => void }) {
  return (
    <div>
      <Heading title="Sales channels" text="Places where customers find your website." />
      <div className={card}>
        <p className="text-sm text-slate-600">
          Get separate links for WhatsApp, Instagram and more, so you can see which one brings you visitors.
        </p>
        <button onClick={() => onNavigate('channels')} className={`${primary} mt-4`}>
          Open sales channels
        </button>
      </div>
    </div>
  );
}

function DomainsPage({ user }: { user: User }) {
  const [slug, setSlug] = useState<string | null | undefined>(undefined);
  const [copied, setCopied] = useState(false);
  const origin = typeof window === 'undefined' ? '' : window.location.origin;

  useEffect(() => {
    createClient()
      .from('businesses')
      .select('slug')
      .eq('owner_id', user.id)
      .maybeSingle()
      .then(({ data }) => setSlug(data?.slug ?? null));
  }, [user.id]);

  const link = slug ? `${origin}/b/${slug}` : '';

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked */
    }
  }

  return (
    <div className="space-y-5">
      <Heading title="Domains" text="The web address of your website." />
      <div className={card}>
        <p className="font-medium text-slate-900">Your Xenon link</p>
        {slug ? (
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input readOnly value={link} onFocus={(e) => e.currentTarget.select()} className={`${field} min-w-0 flex-1 bg-slate-50`} />
            <button onClick={copy} className={`${primary} flex items-center justify-center gap-2`}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copied!' : 'Copy link'}
            </button>
          </div>
        ) : (
          slug === null && <p className="mt-2 text-sm text-slate-600">Create your website first (My website) to get your link.</p>
        )}
      </div>
      <div className={card}>
        <div className="flex items-center gap-3">
          <p className="font-medium text-slate-900">Custom domain</p>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">Coming soon</span>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          Use your own address, like www.yourbusiness.com, instead of the Xenon link.
        </p>
      </div>
    </div>
  );
}
function Toggle({
  checked,
  onChange,
  title,
  text,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  title: string;
  text: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 py-3">
      <input type="checkbox" className="mt-1 h-4 w-4" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>
        <span className="block text-sm font-medium text-slate-900">{title}</span>
        <span className="block text-xs text-slate-500">{text}</span>
      </span>
    </label>
  );
}

function CheckoutPage({ user }: { user: User }) {
  const [bizId, setBizId] = useState<string | null | undefined>(undefined);
  const [s, setS] = useState({ accepting: true, requireAddress: false, showNote: true, minOrder: '', thankYou: '' });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    createClient()
      .from('businesses')
      .select('id,checkout_accepting,checkout_require_address,checkout_show_note,checkout_min_order,checkout_thank_you')
      .eq('owner_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        setBizId(data?.id ?? null);
        if (data) {
          setS({
            accepting: data.checkout_accepting ?? true,
            requireAddress: data.checkout_require_address ?? false,
            showNote: data.checkout_show_note ?? true,
            minOrder: Number(data.checkout_min_order) > 0 ? String(data.checkout_min_order) : '',
            thankYou: data.checkout_thank_you ?? '',
          });
        }
      });
  }, [user.id]);

  async function save() {
    if (!bizId) return;
    const min = Number(s.minOrder) || 0;
    if (min < 0) return setMsg('Could not save: the minimum order cannot be negative.');
    setSaving(true);
    setMsg('');
    const { error } = await createClient()
      .from('businesses')
      .update({
        checkout_accepting: s.accepting,
        checkout_require_address: s.requireAddress,
        checkout_show_note: s.showNote,
        checkout_min_order: min,
        checkout_thank_you: s.thankYou.trim() || null,
      })
      .eq('id', bizId);
    setSaving(false);
    setMsg(error ? 'Could not save: ' + error.message : 'Saved. Your website now uses these checkout settings.');
  }

  return (
    <div className="space-y-5">
      <Heading title="Checkout" text="Control what customers see and fill in when they order." />
      {bizId === null ? (
        <div className={card}>
          <p className="text-sm text-slate-600">Create your website first (My website) to set this up.</p>
        </div>
      ) : (
        <>
          <div className={`${card} divide-y divide-slate-100 !py-2`}>
            <Toggle
              checked={s.accepting}
              onChange={(v) => setS({ ...s, accepting: v })}
              title="Accepting orders"
              text="Turn this off when you are closed. Customers can still see your products, but cannot order."
            />
            <Toggle
              checked={s.requireAddress}
              onChange={(v) => setS({ ...s, requireAddress: v })}
              title="Require a delivery address"
              text="Customers must enter an address before they can place an order."
            />
            <Toggle
              checked={s.showNote}
              onChange={(v) => setS({ ...s, showNote: v })}
              title="Show a note box"
              text="Lets customers add a message, such as a delivery instruction."
            />
          </div>

          <div className={card}>
            <div className="space-y-4">
              <div>
                <label className={label}>Minimum order (₦)</label>
                <input
                  type="number"
                  min="0"
                  placeholder="No minimum"
                  className={field}
                  value={s.minOrder}
                  onChange={(e) => setS({ ...s, minOrder: e.target.value })}
                />
                <p className="mt-1 text-xs text-slate-500">Customers cannot check out until their cart reaches this amount.</p>
              </div>
              <div>
                <label className={label}>Thank-you message</label>
                <textarea
                  rows={3}
                  maxLength={300}
                  placeholder="e.g. We will call you within 30 minutes to confirm your order."
                  className={field}
                  value={s.thankYou}
                  onChange={(e) => setS({ ...s, thankYou: e.target.value })}
                />
                <p className="mt-1 text-xs text-slate-500">Shown to the customer right after they place an order.</p>
              </div>
            </div>
            <button onClick={save} disabled={saving || bizId === undefined} className={`${primary} mt-5`}>
              {saving ? 'Saving...' : 'Save'}
            </button>
            <Note text={msg} />
          </div>
        </>
      )}
    </div>
  );
}
export default function SettingsPanel({
  user,
  onNavigate,
  onLogout,
  onUserChange,
}: {
  user: User;
  onNavigate: (tab: Tab) => void;
  onLogout: () => void;
  onUserChange: (u: User) => void;
}) {
  const [page, setPage] = useState<PageId | null>(null); // null = list only (phone)
  const [query, setQuery] = useState('');
  const current: PageId = page ?? 'general';
  const meta = (user.user_metadata ?? {}) as Meta;
  const name = meta.full_name || user.email || 'Account';
  const initials = name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  const q = query.trim().toLowerCase();
  const shown = q ? items.filter((i) => i.label.toLowerCase().includes(q)) : items;
  const item = items.find((i) => i.id === current)!;

  function body() {
    if (item.soon) return <SoonPage title={item.label} text={item.soon} />;
    switch (current) {
      case 'general':
        return <GeneralPage user={user} onUserChange={onUserChange} onNavigate={onNavigate} />;
      case 'users':
        return <UsersPage user={user} />;
      case 'security':
        return <SecurityPage onLogout={onLogout} />;
      case 'payments':
        return <PaymentsPage user={user} />;
      case 'channels':
        return <ChannelsPage onNavigate={onNavigate} />;
      case 'domains':
        return <DomainsPage user={user} />;
              case 'checkout':
        return <CheckoutPage user={user} />;
      default:
        return null;
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="grid gap-6 lg:grid-cols-[18rem_1fr] lg:items-start">
        <aside className={`${page ? 'hidden lg:block' : ''}`}>
          <h1 className="font-display text-2xl font-bold text-slate-900">Settings</h1>
          <div className="relative mt-4">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search settings"
              className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-4 text-sm outline-none focus:border-blue-500"
            />
          </div>
          <nav className="mt-3 space-y-0.5">
            {shown.map((i) => {
              const active = page === null ? i.id === 'general' : page === i.id;
              return (
                <button
                  key={i.id}
                  onClick={() => setPage(i.id)}
                  className={`flex w-full items-center gap-3 rounded-xl py-3 pr-3 text-left text-[15px] font-medium transition ${
                    i.sub && !q ? 'pl-12' : 'pl-3'
                  } ${active ? 'lg:bg-blue-50 lg:text-blue-700' : 'text-slate-800 hover:bg-slate-100'}`}
                >
                  {!(i.sub && !q) && <i.icon className="h-5 w-5 shrink-0" />}
                  <span className="flex-1">{i.label}</span>
                  {i.soon && (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">Soon</span>
                  )}
                  <ChevronRight className="h-4 w-4 shrink-0 text-slate-400 lg:hidden" />
                </button>
              );
            })}
            {shown.length === 0 && <p className="px-3 py-4 text-sm text-slate-500">No settings match your search.</p>}
          </nav>
          <div className="mt-4 flex items-center gap-3 border-t border-slate-200 px-3 pt-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-sm font-semibold text-white">
              {initials}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">{name}</p>
              <p className="truncate text-xs text-slate-500">{user.email}</p>
            </div>
          </div>
        </aside>

        <section className={`min-w-0 ${page ? '' : 'hidden lg:block'}`}>
          <button
            onClick={() => setPage(null)}
            className="mb-4 flex items-center gap-2 text-sm font-medium text-slate-600 lg:hidden"
          >
            <ArrowLeft className="h-4 w-4" /> Settings
          </button>
          {body()}
        </section>
      </div>
    </div>
  );
}