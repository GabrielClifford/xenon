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
import { defaultOptions, readOptions, type CheckoutOptions, type FieldMode, type OptIn } from '@/lib/checkout';
import { defaultAccounts, readAccounts, type AccountsOptions } from '@/lib/accounts';

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
  { id: 'accounts', label: 'Customer accounts', icon: UserIcon },
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

const sel = 'rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-blue-500';

function Sec({ title, text, children }: { title: string; text?: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="font-display text-base font-semibold text-slate-900">{title}</h3>
      {text && <p className="mt-0.5 text-sm text-slate-500">{text}</p>}
      <div className={`${card} mt-3`}>{children}</div>
    </div>
  );
}

function Line({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <span className="text-sm text-slate-800">{title}</span>
      {children}
    </div>
  );
}

const modeOptions: { v: FieldMode; t: string }[] = [
  { v: 'off', t: "Don't include" },
  { v: 'optional', t: 'Optional' },
  { v: 'required', t: 'Required' },
];
const optInOptions: { v: OptIn; t: string }[] = [
  { v: 'off', t: "Don't show" },
  { v: 'show', t: 'Show' },
  { v: 'checked', t: 'Show, preselected' },
];

function CheckoutPage({ user }: { user: User }) {
  const [bizId, setBizId] = useState<string | null | undefined>(undefined);
  const [base, setBase] = useState({ accepting: true, requireAddress: false, showNote: true, minOrder: '', thankYou: '' });
  const [opt, setOpt] = useState<CheckoutOptions>(defaultOptions);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  function set<K extends keyof CheckoutOptions>(k: K, v: CheckoutOptions[K]) {
    setOpt((o) => ({ ...o, [k]: v }));
  }

  useEffect(() => {
    createClient()
      .from('businesses')
      .select(
        'id,checkout_accepting,checkout_require_address,checkout_show_note,checkout_min_order,checkout_thank_you,checkout_options,checkout_updated_at'
      )
      .eq('owner_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        setBizId(data?.id ?? null);
        if (data) {
          setBase({
            accepting: data.checkout_accepting ?? true,
            requireAddress: data.checkout_require_address ?? false,
            showNote: data.checkout_show_note ?? true,
            minOrder: Number(data.checkout_min_order) > 0 ? String(data.checkout_min_order) : '',
            thankYou: data.checkout_thank_you ?? '',
          });
          setOpt(readOptions(data.checkout_options));
          setSavedAt(data.checkout_updated_at ?? null);
        }
      });
  }, [user.id]);

  async function save() {
    if (!bizId) return;
    const min = Number(base.minOrder) || 0;
    if (min < 0) return setMsg('Could not save: the minimum order cannot be negative.');
    setSaving(true);
    setMsg('');
    const now = new Date().toISOString();
    const { error } = await createClient()
      .from('businesses')
      .update({
        checkout_accepting: base.accepting,
        checkout_require_address: base.requireAddress,
        checkout_show_note: base.showNote,
        checkout_min_order: min,
        checkout_thank_you: base.thankYou.trim() || null,
        checkout_options: {
          ...opt,
          maxQty: Math.min(99, Math.max(1, Math.round(opt.maxQty) || 20)),
          buttonText: opt.buttonText.trim() || 'Place order',
          optEmailLabel: opt.optEmailLabel.trim() || defaultOptions.optEmailLabel,
        },
        checkout_updated_at: now,
      })
      .eq('id', bizId);
    setSaving(false);
    if (error) return setMsg('Could not save: ' + error.message);
    setSavedAt(now);
    setMsg('Saved. Your website now uses these checkout settings.');
  }

  if (bizId === undefined) return <div className="h-40 animate-pulse rounded-2xl bg-slate-100" />;
  if (bizId === null) {
    return (
      <div className="space-y-5">
        <Heading title="Checkout" />
        <div className={card}>
          <p className="text-sm text-slate-600">Create your website first (My website) to set this up.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-7">
      <Heading title="Checkout" text="Control what customers see and fill in when they order." />

      <div className={`${card} flex flex-wrap items-center gap-3`}>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 font-semibold text-slate-900">
            My Store configuration
            <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-800">Active</span>
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {savedAt
              ? `Last saved: ${new Date(savedAt).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' })}`
              : 'Not saved yet. These are the default settings.'}
          </p>
        </div>
        <button onClick={save} disabled={saving} className={primary}>
          {saving ? 'Saving...' : 'Save changes'}
        </button>
      </div>
      <Note text={msg} />

      <Sec title="Customer contact method" text="How customers can be reached about their order. A phone number is always required.">
        {(
          [
            ['off', 'Phone number only', 'Customers enter a phone number. This is how you reach them.'],
            ['optional', 'Phone number and email', 'Email is optional.'],
            ['required', 'Phone number and email', 'Both are required.'],
          ] as const
        ).map(([v, t, d]) => (
          <label key={v} className="flex cursor-pointer items-start gap-3 py-2">
            <input type="radio" name="contact" className="mt-1" checked={opt.email === v} onChange={() => set('email', v)} />
            <span>
              <span className="block text-sm font-medium text-slate-900">{t}</span>
              <span className="block text-xs text-slate-500">{d}</span>
            </span>
          </label>
        ))}
        <div className="mt-2 border-t border-slate-100 pt-1">
          <Toggle
            checked={opt.trackOrders}
            onChange={(v) => set('trackOrders', v)}
            title="Show a link for customers to track their order"
            text="Customers enter their order number and phone number to see if it is received, being prepared or delivered."
          />
          <label className="flex items-start gap-3 py-3 opacity-60">
            <input type="checkbox" className="mt-1 h-4 w-4" disabled />
            <span>
              <span className="block text-sm font-medium text-slate-900">Require customers to sign in before checkout</span>
              <span className="block text-xs text-slate-500">Turn this on in Settings, Customer accounts.</span>
            </span>
          </label>
        </div>
      </Sec>

      <Sec title="Customer information">
        <div className="divide-y divide-slate-100">
          <Line title="Full name">
            <select className={sel} value={opt.nameMode} onChange={(e) => set('nameMode', e.target.value as CheckoutOptions['nameMode'])}>
              <option value="single">One name field</option>
              <option value="first_last">Require first and last name</option>
            </select>
          </Line>
          <Line title="Company name">
            <select className={sel} value={opt.company} onChange={(e) => set('company', e.target.value as FieldMode)}>
              {modeOptions.map((o) => (
                <option key={o.v} value={o.v}>{o.t}</option>
              ))}
            </select>
          </Line>
          <Line title="Address line 2 (apartment, unit, etc.)">
            <select className={sel} value={opt.address2} onChange={(e) => set('address2', e.target.value as FieldMode)}>
              {modeOptions.map((o) => (
                <option key={o.v} value={o.v}>{o.t}</option>
              ))}
            </select>
          </Line>
          <Line title="Second phone number">
            <select className={sel} value={opt.altPhone} onChange={(e) => set('altPhone', e.target.value as FieldMode)}>
              {modeOptions.map((o) => (
                <option key={o.v} value={o.v}>{o.t}</option>
              ))}
            </select>
          </Line>
          <Toggle
            checked={base.showNote}
            onChange={(v) => setBase({ ...base, showNote: v })}
            title="Show a note box"
            text="Lets customers add a message, such as a delivery instruction."
          />
        </div>
      </Sec>

      <Sec title="Marketing opt-in" text="Show a checkbox for customers to agree to receive news and offers. Their choice is saved on each order.">
        <div className="space-y-5">
          <div>
            <p className="mb-1.5 text-sm font-semibold text-slate-900">Email</p>
            <select className={`${sel} w-full`} value={opt.optEmail} onChange={(e) => set('optEmail', e.target.value as OptIn)}>
              {optInOptions.map((o) => (
                <option key={o.v} value={o.v}>{o.t}</option>
              ))}
            </select>
            {opt.optEmail !== 'off' && (
              <input className={`${field} mt-2`} value={opt.optEmailLabel} onChange={(e) => set('optEmailLabel', e.target.value)} placeholder="Checkbox text" />
            )}
            {opt.optEmail !== 'off' && opt.email === 'off' && (
              <p className="mt-1 text-xs text-amber-700">Turn on the email field under Customer contact method, or this checkbox will not show.</p>
            )}
          </div>
          <div>
            <p className="mb-1.5 text-sm font-semibold text-slate-900">SMS</p>
            <select className={`${sel} w-full`} value={opt.optSms} onChange={(e) => set('optSms', e.target.value as OptIn)}>
              {optInOptions.map((o) => (
                <option key={o.v} value={o.v}>{o.t}</option>
              ))}
            </select>
          </div>
          <div>
            <p className="mb-1.5 text-sm font-semibold text-slate-900">WhatsApp</p>
            <select className={`${sel} w-full`} value={opt.optWhatsapp} onChange={(e) => set('optWhatsapp', e.target.value as OptIn)}>
              {optInOptions.map((o) => (
                <option key={o.v} value={o.v}>{o.t}</option>
              ))}
            </select>
          </div>
        </div>
      </Sec>

      <Sec title="Tipping" text="Customers can choose 5%, 10%, 15% or enter a custom amount.">
        <Toggle
          checked={opt.tipping}
          onChange={(v) => set('tipping', v)}
          title="Show tipping options at checkout"
          text="Tips are added to the order total."
        />
      </Sec>

      <Sec title="Abandoned checkout emails" text="Send an email to customers who did not finish checking out.">
        <p className="rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-900">
          Coming soon with Marketing. Xenon cannot send emails yet.
        </p>
      </Sec>

      <Sec title="Checkout language">
        <Line title="English">
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">More languages coming soon</span>
        </Line>
        <div className="space-y-4 border-t border-slate-100 pt-4">
          <p className="text-sm font-semibold text-slate-900">Edit checkout content</p>
          <div>
            <label className={label}>Order button text</label>
            <input className={field} maxLength={30} value={opt.buttonText} onChange={(e) => set('buttonText', e.target.value)} placeholder="Place order" />
          </div>
          <div>
            <label className={label}>Thank-you message</label>
            <textarea
              rows={3}
              maxLength={300}
              className={field}
              placeholder="e.g. We will call you within 30 minutes to confirm your order."
              value={base.thankYou}
              onChange={(e) => setBase({ ...base, thankYou: e.target.value })}
            />
            <p className="mt-1 text-xs text-slate-500">Shown to the customer right after they place an order.</p>
          </div>
        </div>
      </Sec>

      <Sec title="Advanced preferences">
        <div className="divide-y divide-slate-100">
          <Toggle
            checked={base.requireAddress}
            onChange={(v) => setBase({ ...base, requireAddress: v })}
            title="Address collection: require a delivery address"
            text="Customers must enter an address before they can place an order."
          />
          <div className="py-3">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium text-slate-900">Add-to-cart limit</p>
              <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-[11px] font-semibold text-blue-800">Recommended</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              The most of one item a customer can order at once. It stops huge orders and keeps your stock levels private.
            </p>
            <input
              type="number"
              min="1"
              max="99"
              className={`${field} mt-2 max-w-[140px]`}
              value={opt.maxQty}
              onChange={(e) => set('maxQty', Number(e.target.value))}
            />
          </div>
        </div>
      </Sec>

      <Sec title="Checkout rules" text="Rules for how your cart and checkout respond to customers.">
        <div className="divide-y divide-slate-100">
          <Toggle
            checked={base.accepting}
            onChange={(v) => setBase({ ...base, accepting: v })}
            title="Accepting orders"
            text="Turn this off when you are closed. Customers can still see your products, but cannot order."
          />
          <div className="py-3">
            <label className="text-sm font-medium text-slate-900">Minimum order (₦)</label>
            <input
              type="number"
              min="0"
              placeholder="No minimum"
              className={`${field} mt-2`}
              value={base.minOrder}
              onChange={(e) => setBase({ ...base, minOrder: e.target.value })}
            />
            <p className="mt-1 text-xs text-slate-500">Customers cannot check out until their cart reaches this amount.</p>
          </div>
          <Toggle
            checked={opt.ageCheck}
            onChange={(v) => set('ageCheck', v)}
            title="Ask customers to confirm they are 18 or older"
            text="Adds a required checkbox at checkout. It is a confirmation, not a proof of age."
          />
        </div>
      </Sec>

      <div>
        <button onClick={save} disabled={saving} className={primary}>
          {saving ? 'Saving...' : 'Save changes'}
        </button>
        <Note text={msg} />
      </div>
    </div>
  );
}
type Cust = { id: string; full_name: string | null; email: string | null; phone: string | null; credit: number };

function CustomerAccountsPage({ user }: { user: User }) {
  const [bizId, setBizId] = useState<string | null | undefined>(undefined);
  const [slug, setSlug] = useState('');
  const [a, setA] = useState<AccountsOptions>(defaultAccounts);
  const [custs, setCusts] = useState<Cust[]>([]);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [copied, setCopied] = useState(false);
  const origin = typeof window === 'undefined' ? '' : window.location.origin;

  function set<K extends keyof AccountsOptions>(k: K, v: AccountsOptions[K]) {
    setA((x) => ({ ...x, [k]: v }));
  }

  async function loadCusts(id: string) {
    const { data } = await createClient()
      .from('store_customers')
      .select('id,full_name,email,phone,credit')
      .eq('business_id', id)
      .order('created_at', { ascending: false });
    setCusts((data as Cust[]) ?? []);
  }

  useEffect(() => {
    createClient()
      .from('businesses')
      .select('id,slug,accounts_options')
      .eq('owner_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        setBizId(data?.id ?? null);
        if (data) {
          setSlug(data.slug);
          setA(readAccounts(data.accounts_options));
          loadCusts(data.id);
        }
      });
  }, [user.id]);

  async function save() {
    if (!bizId) return;
    setSaving(true);
    setMsg('');
    const { error } = await createClient()
      .from('businesses')
      .update({ accounts_options: { ...a, returnDays: Math.min(90, Math.max(1, Math.round(a.returnDays) || 14)) } })
      .eq('id', bizId);
    setSaving(false);
    setMsg(error ? 'Could not save: ' + error.message : 'Saved. Your store now uses these account settings.');
  }

  async function grant(c: Cust) {
    const amt = Number(amounts[c.id]);
    if (!amt) return setMsg('Could not add credit: enter an amount first.');
    const { data, error } = await createClient().rpc('grant_store_credit', { p_customer_id: c.id, p_amount: amt });
    if (error) return setMsg('Could not add credit: ' + error.message);
    setCusts((list) => list.map((x) => (x.id === c.id ? { ...x, credit: Number(data) } : x)));
    setAmounts((m) => ({ ...m, [c.id]: '' }));
    setMsg(`Done. ${c.full_name || c.email} now has ₦${Number(data).toLocaleString('en-NG')} store credit.`);
  }

  const link = slug ? `${origin}/b/${slug}/account` : '';

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked */
    }
  }

  if (bizId === undefined) return <div className="h-40 animate-pulse rounded-2xl bg-slate-100" />;
  if (bizId === null) {
    return (
      <div className="space-y-5">
        <Heading title="Customer accounts" />
        <div className={card}>
          <p className="text-sm text-slate-600">Create your website first (My website) to set this up.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-7">
      <Heading title="Customer accounts" text="Let your customers sign in to see their orders and order again." />

      <Sec title="Customer accounts" text="Turn this on to let customers create accounts on your store.">
        <div className="divide-y divide-slate-100">
          <Toggle checked={a.enabled} onChange={(v) => set('enabled', v)} title="Turn on customer accounts" text="Customers get a page where they sign in, see their orders and order again." />
          <Toggle checked={a.allowSignup} onChange={(v) => set('allowSignup', v)} title="Allow new customers to create accounts" text="Turn this off to close sign-ups. People who already have an account can still sign in." />
          <Toggle checked={a.requireSignIn} onChange={(v) => set('requireSignIn', v)} title="Require customers to sign in before checkout" text="Only signed-in customers can place orders." />
        </div>
      </Sec>

      <Sec title="Sign-in links">
        <Toggle checked={a.showSignIn} onChange={(v) => set('showSignIn', v)} title="Show sign-in links" text="Show a Sign in link above your products and at checkout." />
      </Sec>

      <Sec title="Order actions" text="What signed-in customers can do with their past orders.">
        <div className="divide-y divide-slate-100">
          <Toggle checked={a.allowBuyAgain} onChange={(v) => set('allowBuyAgain', v)} title="Buy again" text="Adds the items from an old order back to the cart." />
          <Toggle checked={a.allowCancel} onChange={(v) => set('allowCancel', v)} title="Cancellation requests" text="Customers can ask to cancel an order before you start preparing it. You decide what to do." />
          <Toggle checked={a.allowReturn} onChange={(v) => set('allowReturn', v)} title="Return requests" text="Customers can ask to return an order after it is delivered." />
          {a.allowReturn && (
            <div className="py-3">
              <label className="text-sm font-medium text-slate-900">Return window (days after ordering)</label>
              <input type="number" min="1" max="90" className={`${field} mt-2 max-w-[140px]`} value={a.returnDays} onChange={(e) => set('returnDays', Number(e.target.value))} />
            </div>
          )}
        </div>
        <p className="mt-2 text-xs text-slate-500">Requests show on the order in your Orders page, where you can dismiss them.</p>
      </Sec>

      <Sec title="Authentication" text="How customers sign in.">
        <label className="flex items-start gap-3 py-2">
          <input type="radio" checked readOnly className="mt-1" />
          <span>
            <span className="block text-sm font-medium text-slate-900">Email and password</span>
            <span className="block text-xs text-slate-500">Customers sign in with their email address and a password.</span>
          </span>
        </label>
        <label className="flex items-start gap-3 py-2 opacity-60">
          <input type="radio" disabled className="mt-1" />
          <span>
            <span className="block text-sm font-medium text-slate-900">One-time code by email</span>
            <span className="block text-xs text-slate-500">Coming soon. Xenon cannot send emails yet.</span>
          </span>
        </label>
      </Sec>

      <Sec title="Store credit" text="Give customers credit they can spend at checkout, for example after a return.">
        <Toggle checked={a.storeCredit} onChange={(v) => set('storeCredit', v)} title="Allow customers to see and spend store credit" text="Customers see their balance and can apply it at checkout." />
        <div className="mt-2 border-t border-slate-100 pt-3">
          <p className="text-sm font-semibold text-slate-900">Your customers</p>
          {custs.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">No customers have created an account yet.</p>
          ) : (
            <div className="mt-2 divide-y divide-slate-100">
              {custs.map((c) => (
                <div key={c.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">{c.full_name || 'No name'}</p>
                    <p className="truncate text-xs text-slate-500">{c.email}</p>
                  </div>
                  <p className="text-sm font-semibold">₦{Number(c.credit).toLocaleString('en-NG')}</p>
                  <input
                    type="number"
                    placeholder="± amount"
                    className={`${field} !w-28 !py-2`}
                    value={amounts[c.id] ?? ''}
                    onChange={(e) => setAmounts((m) => ({ ...m, [c.id]: e.target.value }))}
                  />
                  <button onClick={() => grant(c)} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium hover:bg-slate-50">
                    Update credit
                  </button>
                </div>
              ))}
            </div>
          )}
          <p className="mt-2 text-xs text-slate-500">Type a positive amount to add credit, or a negative one to remove it.</p>
        </div>
      </Sec>

      <Sec title="URL" text="Use this link anywhere you want customers to reach their account, such as WhatsApp or Instagram.">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input readOnly value={link} onFocus={(e) => e.currentTarget.select()} className={`${field} min-w-0 flex-1 bg-slate-50`} />
          <button onClick={copy} className={`${primary} flex items-center justify-center gap-2`}>
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Copied!' : 'Copy link'}
          </button>
        </div>
      </Sec>

      <div>
        <button onClick={save} disabled={saving} className={primary}>
          {saving ? 'Saving...' : 'Save changes'}
        </button>
        <Note text={msg} />
      </div>
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
              case 'accounts':
        return <CustomerAccountsPage user={user} />;
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