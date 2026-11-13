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
import { defaultTax, readTax, type TaxSettings } from '@/lib/tax';
import { Mail, RotateCcw, Scale, ScrollText } from 'lucide-react';
import {
  contactLine, defaultPolicies, defaultRule, policyStatus, policyText, policyTypes, readPolicies, readRules,
  ruleSummary, templateFor, type ContactInfo, type PolicyDoc, type PolicyType, type Policies, type Rule, type Rules,
} from '@/lib/policies';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { defaultMethods, defaultShipping, readShipping, type Profile, type ShippingSettings, type Zone } from '@/lib/shipping';
import { BadgeCheck, Cookie, UserCheck } from 'lucide-react';
import { HOSTING_LOCATION, defaultPrivacy, readPrivacy, requestKinds, type PrivacyOptions } from '@/lib/privacy';

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
  { id: 'shipping', label: 'Shipping and delivery', icon: Truck },
  { id: 'taxes', label: 'Taxes and duties', icon: Percent },
  { id: 'locations', label: 'Locations', icon: MapPin, soon: 'Manage your business addresses and where customers can find you.' },
  { id: 'markets', label: 'Markets', icon: Globe, soon: 'Sell to customers in other regions and currencies.' },
  { id: 'apps', label: 'Apps', icon: LayoutGrid, soon: 'Connect extra tools to your website.' },
  { id: 'channels', label: 'Sales channels', icon: Share2 },
  { id: 'domains', label: 'Domains', icon: Link2 },
  { id: 'events', label: 'Customer events', icon: MousePointerClick, soon: 'Track what customers do on your website.' },
  { id: 'notifications', label: 'Notifications', icon: Bell, soon: 'Choose how you are alerted about new orders and enquiries.' },
  { id: 'metafields', label: 'Metafields and metaobjects', icon: Database, soon: 'Add custom information fields to your products and orders.' },
  { id: 'languages', label: 'Languages', icon: Languages, soon: 'Offer your website in more than one language.' },
  { id: 'privacy', label: 'Customer privacy', icon: Lock },
  { id: 'policies', label: 'Policies', icon: FileText },
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
function TaxesPage({ user }: { user: User }) {
  const [bizId, setBizId] = useState<string | null | undefined>(undefined);
  const [t, setT] = useState<TaxSettings>(defaultTax);
  const [rateText, setRateText] = useState(String(defaultTax.rate));
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  function set<K extends keyof TaxSettings>(k: K, v: TaxSettings[K]) {
    setT((x) => ({ ...x, [k]: v }));
  }

  useEffect(() => {
    createClient()
      .from('businesses')
      .select('id,tax_options')
      .eq('owner_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        setBizId(data?.id ?? null);
        if (data) {
          const s = readTax(data.tax_options);
          setT(s);
          setRateText(String(s.rate));
        }
      });
  }, [user.id]);

  async function save() {
    if (!bizId) return;
    const rate = Number(rateText);
    if (Number.isNaN(rate) || rate < 0 || rate > 100) {
      return setMsg('Could not save: the tax rate must be between 0 and 100.');
    }
    setSaving(true);
    setMsg('');
    const { error } = await createClient()
      .from('businesses')
      .update({ tax_options: { ...t, rate, label: t.label.trim() || 'VAT', vatNumber: t.vatNumber.trim() } })
      .eq('id', bizId);
    setSaving(false);
    setMsg(error ? 'Could not save: ' + error.message : 'Saved. Your store now uses these tax settings.');
  }

  if (bizId === undefined) return <div className="h-40 animate-pulse rounded-2xl bg-slate-100" />;
  if (bizId === null) {
    return (
      <div className="space-y-5">
        <Heading title="Taxes and duties" />
        <div className={card}>
          <p className="text-sm text-slate-600">Create your website first (My website) to set this up.</p>
        </div>
      </div>
    );
  }

  const shownRate = Number(rateText) || 0;

  return (
    <div className="space-y-7">
      <Heading title="Taxes and duties" text="Choose whether to charge tax on your orders and how it shows to customers." />

      <Sec title="Tax service">
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
            <Percent className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-2 font-semibold text-slate-900">
              Xenon tax calculator
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  t.enabled ? 'bg-green-100 text-green-800' : 'bg-slate-200 text-slate-600'
                }`}
              >
                {t.enabled ? 'Active' : 'Off'}
              </span>
            </p>
            <p className="text-xs text-slate-500">Works out tax on each order from the rate you set below.</p>
          </div>
          <button onClick={() => setOpen(true)} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50">
            Manage
          </button>
        </div>
      </Sec>

      <Sec title="Tax regions" text="Where you collect and remit tax from customers. Xenon stores sell and deliver within Nigeria.">
        <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-3 text-left">
          <span className="flex h-6 w-9 shrink-0 overflow-hidden rounded border border-slate-200">
            <span className="w-1/3 bg-green-600" />
            <span className="w-1/3 bg-white" />
            <span className="w-1/3 bg-green-600" />
          </span>
          <span className="flex-1">
            <span className="block text-sm font-semibold text-slate-900">Nigeria</span>
            <span className="block text-xs text-slate-500">
              {t.enabled ? `${t.label || 'VAT'} ${shownRate}% · Collecting` : 'Not collecting tax. Tap to set up.'}
            </span>
          </span>
          <ChevronRight className={`h-4 w-4 text-slate-400 transition ${open ? 'rotate-90' : ''}`} />
        </button>

        {open && (
          <div className="mt-4 space-y-4 border-t border-slate-100 pt-4">
            <Toggle
              checked={t.enabled}
              onChange={(v) => set('enabled', v)}
              title="Collect tax on orders in Nigeria"
              text="Turn this on only if your business must charge VAT. Small businesses may be exempt, so check with an accountant or the tax authority."
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={label}>Tax name</label>
                <input className={field} maxLength={20} value={t.label} onChange={(e) => set('label', e.target.value)} placeholder="VAT" />
              </div>
              <div>
                <label className={label}>Rate (%)</label>
                <input className={field} inputMode="decimal" value={rateText} onChange={(e) => setRateText(e.target.value)} placeholder="7.5" />
              </div>
            </div>
            <div>
              <label className={label}>VAT registration number (optional)</label>
              <input className={field} maxLength={40} value={t.vatNumber} onChange={(e) => set('vatNumber', e.target.value)} />
              <p className="mt-1 text-xs text-slate-500">Shown under the total in your customers&apos; cart.</p>
            </div>
          </div>
        )}
      </Sec>

      <Sec title="Duties and import taxes">
        <p className="text-sm font-medium text-slate-900">Collect duties and import taxes at checkout</p>
        <p className="mt-1 text-xs text-slate-500">Prevents surprise fees for international customers at delivery.</p>
        <p className="mt-3 rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-900">
          Not needed. Your store sells within Nigeria, so there are no duties or import taxes to collect.
        </p>
      </Sec>

      <Sec title="Customs information">
        <div className="divide-y divide-slate-100">
          <div className="py-3">
            <p className="text-sm font-medium text-slate-900">Country of origin</p>
            <p className="text-xs text-slate-500">Only needed when you ship products to other countries.</p>
          </div>
          <div className="py-3">
            <p className="text-sm font-medium text-slate-900">Harmonized System (HS) codes</p>
            <p className="text-xs text-slate-500">Only needed when you ship products to other countries.</p>
          </div>
        </div>
      </Sec>

      <Sec title="Additional configuration">
        <div className="divide-y divide-slate-100">
          <Toggle
            checked={t.inclusive}
            onChange={(v) => set('inclusive', v)}
            title="Include tax in product prices"
            text="On: prices already include tax, and customers see how much of it is tax. Off: tax is added on top at checkout."
          />
          <Toggle
            checked={t.taxShipping}
            onChange={(v) => set('taxShipping', v)}
            title="Charge tax on shipping"
            text="Adds tax to your delivery fees."
          />
          <label className="flex items-start gap-3 py-3 opacity-60">
            <input type="checkbox" className="mt-1 h-4 w-4" disabled />
            <span>
              <span className="block text-sm font-medium text-slate-900">Charge VAT on digital goods</span>
              <span className="block text-xs text-slate-500">
                Not needed, because Xenon stores sell physical products. To leave some products out of VAT, turn off
                &quot;Charge tax on this product&quot; when you edit them in Products.
              </span>
            </span>
          </label>
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
const policyIcons: Record<PolicyType, React.ElementType> = {
  refund: RotateCcw,
  privacy: Lock,
  terms: ScrollText,
  shipping: Truck,
  contact: Mail,
  legal: Scale,
};

function BackLink({ onClick, text }: { onClick: () => void; text: string }) {
  return (
    <button onClick={onClick} className="mb-4 flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900">
      <ArrowLeft className="h-4 w-4" /> {text}
    </button>
  );
}

function RuleForm({
  rule,
  onChange,
  cats,
  isDefault,
  onDelete,
}: {
  rule: Rule;
  onChange: (patch: Partial<Rule>) => void;
  cats: string[];
  isDefault?: boolean;
  onDelete?: () => void;
}) {
  const num = (v: string, max: number) => Math.min(max, Math.max(0, Math.round(Number(v) || 0)));
  return (
    <div className="space-y-4">
      {!isDefault && (
        <>
          <div>
            <label className={label}>Rule name</label>
            <input className={field} maxLength={40} placeholder="e.g. Cosmetics" value={rule.name} onChange={(e) => onChange({ name: e.target.value })} />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-900">Applies to products in these categories</p>
            {cats.length === 0 ? (
              <p className="mt-1 text-xs text-slate-500">Give your products categories in Products to use category rules.</p>
            ) : (
              <div className="mt-2 flex flex-wrap gap-2">
                {cats.map((c) => {
                  const on = rule.categories.includes(c);
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() =>
                        onChange({ categories: on ? rule.categories.filter((x) => x !== c) : [...rule.categories, c] })
                      }
                      className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold ${
                        on ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {c}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
      <Toggle
        checked={rule.finalSale}
        onChange={(v) => onChange({ finalSale: v })}
        title="Final sale"
        text="Customers cannot return these items."
      />
      {!rule.finalSale && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={label}>Return window (days after ordering)</label>
            <input type="number" min="1" max="90" className={field} value={rule.returnDays} onChange={(e) => onChange({ returnDays: Math.max(1, num(e.target.value, 90)) })} />
          </div>
          <div>
            <label className={label}>Restocking fee (% of item price)</label>
            <input type="number" min="0" max="100" className={field} value={rule.returnFeePct} onChange={(e) => onChange({ returnFeePct: num(e.target.value, 100) })} />
          </div>
        </div>
      )}
      <div className="sm:max-w-[50%]">
        <label className={label}>Cancellation fee (% of item price)</label>
        <input type="number" min="0" max="100" className={field} value={rule.cancelFeePct} onChange={(e) => onChange({ cancelFeePct: num(e.target.value, 100) })} />
      </div>
      {onDelete && (
        <button onClick={onDelete} className="text-sm font-medium text-red-600 hover:underline">
          Delete this rule
        </button>
      )}
    </div>
  );
}

type PView = null | 'rules' | PolicyType;

function PoliciesPage({ user }: { user: User }) {
  const [bizId, setBizId] = useState<string | null | undefined>(undefined);
  const [biz, setBiz] = useState({ name: '', slug: '', phone: '' });
  const [pol, setPol] = useState<Policies>(defaultPolicies);
  const [rules, setRules] = useState<Rules>(readRules(null));
  const [draftPol, setDraftPol] = useState<Policies>(defaultPolicies);
  const [draftRules, setDraftRules] = useState<Rules>(readRules(null));
  const [cats, setCats] = useState<string[]>([]);
  const [view, setView] = useState<PView>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const origin = typeof window === 'undefined' ? '' : window.location.origin;

  useEffect(() => {
    const sb = createClient();
    sb.from('businesses')
      .select('id,name,slug,phone,policies,policy_rules')
      .eq('owner_id', user.id)
      .maybeSingle()
      .then(async ({ data }) => {
        setBizId(data?.id ?? null);
        if (!data) return;
        setBiz({ name: data.name, slug: data.slug, phone: data.phone ?? '' });
        const p = readPolicies(data.policies);
        const r = readRules(data.policy_rules);
        setPol(p);
        setDraftPol(p);
        setRules(r);
        setDraftRules(r);
        const { data: prods } = await sb.from('products').select('category').eq('business_id', data.id);
        setCats([...new Set((prods ?? []).map((x) => (x.category ?? '').trim()).filter(Boolean))] as string[]);
      });
  }, [user.id]);

  async function persist(patch: Record<string, unknown>) {
    if (!bizId) return false;
    setSaving(true);
    setMsg('');
    const { error } = await createClient().from('businesses').update(patch).eq('id', bizId);
    setSaving(false);
    if (error) {
      setMsg('Could not save: ' + error.message);
      return false;
    }
    setMsg('Saved.');
    return true;
  }

  function openView(v: PView, addRule = false) {
    setMsg('');
    setDraftPol(pol);
    setDraftRules(
      addRule
        ? { ...rules, custom: [...rules.custom, { ...defaultRule, id: crypto.randomUUID(), name: '', returnFeePct: 0 }] }
        : rules
    );
    setView(v);
  }

  const ctxFor = (p: Policies, r: Rules) => ({ name: biz.name, contact: contactLine(p, biz.phone), rules: r });

  async function toggleLinks(v: boolean) {
    const next = { ...pol, showLinks: v };
    if (await persist({ policies: next })) {
      setPol(next);
      setDraftPol(next);
    }
  }

  async function saveRules() {
    const clean = {
      default: draftRules.default,
      custom: draftRules.custom
        .filter((r) => r.name.trim() || r.categories.length)
        .map((r) => ({ ...r, name: r.name.trim() || 'Rule' })),
    };
    if (await persist({ policy_rules: clean })) {
      const next = readRules(clean);
      setRules(next);
      setDraftRules(next);
    }
  }

  async function savePolicy(type: PolicyType) {
    const d = draftPol;
    const text = policyText(type, d, ctxFor(d, rules));
    const published = type === 'contact' ? d.contact.published : d[type].published;
    if (published) {
      if (type === 'contact') {
        const c = d.contact;
        if (!c.email && !c.phone && !c.whatsapp && !c.address) {
          return setMsg('Could not save: add at least one way to contact you before publishing.');
        }
      } else if (!text.trim()) {
        return setMsg('Could not save: add some text before publishing.');
      } else if (/\[[^\]]+\]/.test(text)) {
        return setMsg('Could not save: replace the parts in [square brackets] before publishing.');
      }
    }
    if (await persist({ policies: d })) setPol(d);
  }

  function setDoc(type: Exclude<PolicyType, 'contact'>, patch: Partial<PolicyDoc & { auto: boolean }>) {
    setDraftPol((p) => ({ ...p, [type]: { ...p[type], ...patch } }) as Policies);
  }
  function setContact(patch: Partial<ContactInfo>) {
    setDraftPol((p) => ({ ...p, contact: { ...p.contact, ...patch } }));
  }

  if (bizId === undefined) return <div className="h-40 animate-pulse rounded-2xl bg-slate-100" />;
  if (bizId === null) {
    return (
      <div className="space-y-5">
        <Heading title="Policies" />
        <div className={card}>
          <p className="text-sm text-slate-600">Create your website first (My website) to set this up.</p>
        </div>
      </div>
    );
  }

  // ----- return and cancellation rules -----
  if (view === 'rules') {
    return (
      <div className="space-y-5">
        <BackLink onClick={() => setView(null)} text="Policies" />
        <Heading
          title="Return and cancellation rules"
          text="Set conditions and fees for return and cancellation requests. Customers send requests from their account and you decide what to do."
        />
        <Sec title="Default rules" text="Used for every product that does not match another rule.">
          <RuleForm
            isDefault
            rule={draftRules.default}
            cats={cats}
            onChange={(patch) => setDraftRules((r) => ({ ...r, default: { ...r.default, ...patch } }))}
          />
        </Sec>
        {draftRules.custom.map((r) => (
          <Sec key={r.id} title={r.name || 'New rule'}>
            <RuleForm
              rule={r}
              cats={cats}
              onChange={(patch) =>
                setDraftRules((x) => ({ ...x, custom: x.custom.map((y) => (y.id === r.id ? { ...y, ...patch } : y)) }))
              }
              onDelete={() => setDraftRules((x) => ({ ...x, custom: x.custom.filter((y) => y.id !== r.id) }))}
            />
          </Sec>
        ))}
        <button
          onClick={() =>
            setDraftRules((x) => ({ ...x, custom: [...x.custom, { ...defaultRule, id: crypto.randomUUID(), name: '' }] }))
          }
          className="w-full rounded-xl bg-slate-100 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-200"
        >
          + Rule
        </button>
        <p className="text-xs text-slate-500">
          These rules decide the return window and fees. Customers can only send requests if Cancellation requests and Return
          requests are turned on under Customer accounts.
        </p>
        <div>
          <button onClick={saveRules} disabled={saving} className={primary}>
            {saving ? 'Saving...' : 'Save rules'}
          </button>
          <Note text={msg} />
        </div>
      </div>
    );
  }

  // ----- one written policy -----
  if (view) {
    const type = view;
    const meta = policyTypes.find((p) => p.type === type)!;
    const published = type === 'contact' ? draftPol.contact.published : draftPol[type].published;
    const savedLive = published;
    const live = `${origin}/b/${biz.slug}/policies/${type}`;
    const ctx = ctxFor(draftPol, rules);

    return (
      <div className="space-y-5">
        <BackLink onClick={() => setView(null)} text="Policies" />
        <Heading title={meta.label} />

        {type === 'contact' ? (
          <div className={card}>
            <div className="space-y-4">
              <div>
                <label className={label}>Email</label>
                <input className={field} type="email" value={draftPol.contact.email} onChange={(e) => setContact({ email: e.target.value })} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={label}>Phone number</label>
                  <input className={field} inputMode="tel" placeholder={biz.phone} value={draftPol.contact.phone} onChange={(e) => setContact({ phone: e.target.value })} />
                </div>
                <div>
                  <label className={label}>WhatsApp number</label>
                  <input className={field} inputMode="tel" value={draftPol.contact.whatsapp} onChange={(e) => setContact({ whatsapp: e.target.value })} />
                </div>
              </div>
              <div>
                <label className={label}>Address</label>
                <textarea rows={2} className={field} value={draftPol.contact.address} onChange={(e) => setContact({ address: e.target.value })} />
              </div>
              <div>
                <label className={label}>Opening hours</label>
                <input className={field} placeholder="e.g. Monday to Saturday, 9am to 6pm" value={draftPol.contact.hours} onChange={(e) => setContact({ hours: e.target.value })} />
              </div>
            </div>
          </div>
        ) : (
          <div className={card}>
            {type === 'privacy' && (
              <div className="mb-3 border-b border-slate-100 pb-2">
                <Toggle
                  checked={draftPol.privacy.auto}
                  onChange={(v) => setDoc('privacy', { auto: v })}
                  title="Use Xenon's automated privacy policy"
                  text="Written from how Xenon stores collect and use customer information. Turn off to write your own."
                />
              </div>
            )}
            <textarea
              rows={14}
              className={`${field} font-mono text-[13px] leading-6 ${type === 'privacy' && draftPol.privacy.auto ? 'bg-slate-50 text-slate-500' : ''}`}
              readOnly={type === 'privacy' && draftPol.privacy.auto}
              placeholder="Write your policy here, or generate a template to start from."
              value={type === 'privacy' && draftPol.privacy.auto ? templateFor('privacy', ctx) : draftPol[type].text}
              onChange={(e) => setDoc(type, { text: e.target.value })}
            />
            {!(type === 'privacy' && draftPol.privacy.auto) && (
              <button
                onClick={() => {
                  if (draftPol[type].text.trim() && !confirm('Replace your text with a new template?')) return;
                  setDoc(type, { text: templateFor(type, ctx) });
                }}
                className="mt-3 rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Generate a template
              </button>
            )}
            <p className="mt-3 text-xs text-slate-500">
              Templates are a starting point, not legal advice. You are responsible for making sure your policies are accurate
              and follow the law. Replace anything in [square brackets] before publishing.
            </p>
          </div>
        )}

        <div className={card}>
          <Toggle
            checked={published}
            onChange={(v) => (type === 'contact' ? setContact({ published: v }) : setDoc(type, { published: v }))}
            title="Publish on my store"
            text="Shows a link in your store footer and at checkout."
          />
          {savedLive && (
            <a href={live} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-sm font-medium text-blue-600 hover:underline">
              View the live page
            </a>
          )}
        </div>

        <div>
          <button onClick={() => savePolicy(type)} disabled={saving} className={primary}>
            {saving ? 'Saving...' : 'Save'}
          </button>
          <Note text={msg} />
        </div>
      </div>
    );
  }

  // ----- the list -----
  return (
    <div className="space-y-7">
      <Heading title="Policies" text="Tell customers how returns, privacy, delivery and contact work. Published policies show on your store." />

      <Sec title="Return and cancellation rules" text="Set conditions and fees for return and cancellation requests.">
        <button onClick={() => openView('rules')} className="flex w-full items-center gap-3 text-left">
          <span className="flex-1">
            <span className="block text-sm font-semibold text-slate-900">Default rules</span>
            <span className="mt-1 inline-block rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
              {ruleSummary(rules)}
            </span>
          </span>
          <ChevronRight className="h-4 w-4 text-slate-400" />
        </button>
        {rules.custom.length > 0 && (
          <div className="mt-3 divide-y divide-slate-100 border-t border-slate-100">
            {rules.custom.map((r) => (
              <button key={r.id} onClick={() => openView('rules')} className="flex w-full items-center gap-3 py-3 text-left">
                <span className="flex-1">
                  <span className="block text-sm font-medium text-slate-900">{r.name}</span>
                  <span className="block text-xs text-slate-500">
                    {r.categories.join(', ') || 'No categories chosen'} · {r.finalSale ? 'Final sale' : `${r.returnDays}-day returns`}
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 text-slate-400" />
              </button>
            ))}
          </div>
        )}
        <button
          onClick={() => openView('rules', true)}
          className="mt-4 w-full rounded-xl bg-slate-100 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-200"
        >
          + Rule
        </button>
      </Sec>

      <Sec title="Written policies" text="By default, published policies appear in the footer of your store and in checkout.">
        <div className="divide-y divide-slate-100">
          {policyTypes.map((p) => {
            const Icon = policyIcons[p.type];
            return (
              <button key={p.type} onClick={() => openView(p.type)} className="flex w-full items-center gap-3 py-3.5 text-left">
                <Icon className="h-5 w-5 shrink-0 text-slate-700" />
                <span className="flex-1">
                  <span className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-900">
                    {p.label}
                    {p.required && (
                      <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-semibold text-orange-800">Required</span>
                    )}
                  </span>
                  <span className="block text-xs text-slate-500">{policyStatus(p.type, pol)}</span>
                </span>
                <ChevronRight className="h-4 w-4 text-slate-400" />
              </button>
            );
          })}
        </div>
        <div className="mt-2 border-t border-slate-100 pt-1">
          <Toggle
            checked={pol.showLinks}
            onChange={toggleLinks}
            title="Show policy links in my store footer and checkout"
            text="Turn this off to hide the links. The policy pages stay available to anyone with the link."
          />
        </div>
      </Sec>
      <Note text={msg} />

      <p className="text-xs text-slate-500">
        Recommended policies are not legal advice. You are responsible for making sure they are accurate and comply with
        applicable laws.
      </p>
    </div>
  );
}
type SView = null | { kind: 'profile'; id: string } | { kind: 'local' } | { kind: 'pickup' };

function ZoneForm({
  zone,
  onChange,
  onDelete,
}: {
  zone: Zone;
  onChange: (patch: Partial<Zone>) => void;
  onDelete: () => void;
}) {
  const int = (v: string) => Math.max(0, Math.round(Number(v) || 0));
  return (
    <div className="space-y-3 rounded-xl border border-slate-200 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={label}>Zone name</label>
          <input className={field} placeholder="e.g. Port Harcourt" value={zone.name} onChange={(e) => onChange({ name: e.target.value })} />
        </div>
        <div>
          <label className={label}>Areas covered (optional)</label>
          <input className={field} placeholder="e.g. GRA, Rumuola, Trans Amadi" value={zone.areas} onChange={(e) => onChange({ areas: e.target.value })} />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={label}>Delivery fee (₦)</label>
          <input type="number" min="0" className={field} value={zone.rate} onChange={(e) => onChange({ rate: int(e.target.value) })} />
        </div>
        <div>
          <label className={label}>Free delivery over (₦, 0 = never)</label>
          <input type="number" min="0" className={field} value={zone.freeOver} onChange={(e) => onChange({ freeOver: int(e.target.value) })} />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={label}>Earliest delivery (working days)</label>
          <input type="number" min="0" className={field} value={zone.minDays} onChange={(e) => onChange({ minDays: int(e.target.value) })} />
        </div>
        <div>
          <label className={label}>Latest delivery (working days)</label>
          <input type="number" min="0" className={field} value={zone.maxDays} onChange={(e) => onChange({ maxDays: int(e.target.value) })} />
        </div>
      </div>
      <button onClick={onDelete} className="flex items-center gap-1.5 text-sm font-medium text-red-600 hover:underline">
        <Trash2 className="h-4 w-4" /> Delete zone
      </button>
    </div>
  );
}

function validateShipping(s: ShippingSettings): string {
  if (s.enabled && (s.profiles[0]?.zones.length ?? 0) === 0) {
    return 'add at least one delivery zone to your general profile, or turn delivery off';
  }
  for (const [i, p] of s.profiles.entries()) {
    const names = new Set<string>();
    for (const z of p.zones) {
      const n = z.name.trim().toLowerCase();
      if (!n) return `every zone in "${p.name}" needs a name`;
      if (names.has(n)) return `"${p.name}" has two zones named "${z.name}"`;
      names.add(n);
      if (z.maxDays < z.minDays) return `the latest delivery days cannot be fewer than the earliest in "${z.name}"`;
    }
    if (i > 0 && p.categories.length === 0) return `choose at least one product category for "${p.name}"`;
  }
  if (s.pickup.enabled && !s.pickup.address.trim()) return 'add your pickup address, or turn pickup off';
  return '';
}

function ShippingPage({ user }: { user: User }) {
  const [bizId, setBizId] = useState<string | null | undefined>(undefined);
  const [sh, setSh] = useState<ShippingSettings>(defaultShipping);
  const [saved, setSaved] = useState<ShippingSettings>(defaultShipping);
  const [cats, setCats] = useState<string[]>([]);
  const [view, setView] = useState<SView>(null);
  const [custOpen, setCustOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    const sb = createClient();
    sb.from('businesses')
      .select('id,shipping_options')
      .eq('owner_id', user.id)
      .maybeSingle()
      .then(async ({ data }) => {
        setBizId(data?.id ?? null);
        if (!data) return;
        const s = readShipping(data.shipping_options);
        setSh(s);
        setSaved(s);
        const { data: prods } = await sb.from('products').select('category').eq('business_id', data.id);
        setCats([...new Set((prods ?? []).map((x) => (x.category ?? '').trim()).filter(Boolean))] as string[]);
      });
  }, [user.id]);

  const dirty = JSON.stringify(sh) !== JSON.stringify(saved);

  async function save() {
    const err = validateShipping(sh);
    if (err) return setMsg('Could not save: ' + err + '.');
    if (!bizId) return;
    setSaving(true);
    setMsg('');
    const { error } = await createClient().from('businesses').update({ shipping_options: sh }).eq('id', bizId);
    setSaving(false);
    if (error) return setMsg('Could not save: ' + error.message);
    setSaved(sh);
    setMsg('Saved. Your store now uses these delivery settings.');
  }

  function patchProfile(id: string, patch: Partial<Profile>) {
    setSh((s) => ({ ...s, profiles: s.profiles.map((p) => (p.id === id ? { ...p, ...patch } : p)) }));
  }
  function patchZone(pid: string, zid: string, patch: Partial<Zone>) {
    setSh((s) => ({
      ...s,
      profiles: s.profiles.map((p) =>
        p.id === pid ? { ...p, zones: p.zones.map((z) => (z.id === zid ? { ...z, ...patch } : z)) } : p
      ),
    }));
  }
  function addZone(pid: string) {
    const z: Zone = { id: crypto.randomUUID(), name: '', areas: '', rate: 0, freeOver: 0, minDays: 0, maxDays: 0 };
    setSh((s) => ({ ...s, profiles: s.profiles.map((p) => (p.id === pid ? { ...p, zones: [...p.zones, z] } : p)) }));
  }
  function deleteZone(pid: string, zid: string) {
    setSh((s) => ({
      ...s,
      profiles: s.profiles.map((p) => (p.id === pid ? { ...p, zones: p.zones.filter((z) => z.id !== zid) } : p)),
    }));
  }
  function addProfile() {
    const id = crypto.randomUUID();
    setSh((s) => ({ ...s, profiles: [...s.profiles, { id, name: '', categories: [], zones: [] }] }));
    setView({ kind: 'profile', id });
  }
  function deleteProfile(id: string) {
    setSh((s) => ({ ...s, profiles: s.profiles.filter((p) => p.id !== id) }));
    setView(null);
  }
  function moveMethod(i: number, dir: -1 | 1) {
    setSh((s) => {
      const m = [...s.methods];
      const j = i + dir;
      if (j < 0 || j >= m.length) return s;
      [m[i], m[j]] = [m[j], m[i]];
      return { ...s, methods: m };
    });
  }

  if (bizId === undefined) return <div className="h-40 animate-pulse rounded-2xl bg-slate-100" />;
  if (bizId === null) {
    return (
      <div className="space-y-5">
        <Heading title="Shipping and delivery" />
        <div className={card}>
          <p className="text-sm text-slate-600">Create your website first (My website) to set this up.</p>
        </div>
      </div>
    );
  }

  const saveRow = (
    <div>
      <button onClick={save} disabled={saving} className={primary}>
        {saving ? 'Saving...' : 'Save changes'}
      </button>
      {dirty && !msg && <span className="ml-3 text-xs text-amber-700">You have unsaved changes.</span>}
      <Note text={msg} />
    </div>
  );

  // ----- one shipping profile -----
  if (view?.kind === 'profile') {
    const idx = sh.profiles.findIndex((p) => p.id === view.id);
    const p = sh.profiles[idx];
    if (!p) {
      setView(null);
      return null;
    }
    const isGeneral = idx === 0;
    return (
      <div className="space-y-5">
        <BackLink onClick={() => setView(null)} text="Shipping and delivery" />
        <Heading
          title={p.name || 'New profile'}
          text={isGeneral ? 'Applies to every product that is not covered by a custom profile.' : 'Applies to products in the categories you choose.'}
        />
        {!isGeneral && (
          <Sec title="Profile">
            <div className="space-y-4">
              <div>
                <label className={label}>Profile name</label>
                <input className={field} maxLength={40} placeholder="e.g. Heavy items" value={p.name} onChange={(e) => patchProfile(p.id, { name: e.target.value })} />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900">Products in these categories use this profile</p>
                {cats.length === 0 ? (
                  <p className="mt-1 text-xs text-slate-500">Give your products categories in Products to use custom profiles.</p>
                ) : (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {cats.map((c) => {
                      const on = p.categories.includes(c);
                      return (
                        <button
                          key={c}
                          type="button"
                          onClick={() => patchProfile(p.id, { categories: on ? p.categories.filter((x) => x !== c) : [...p.categories, c] })}
                          className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold ${
                            on ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          {c}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              <button onClick={() => deleteProfile(p.id)} className="text-sm font-medium text-red-600 hover:underline">
                Delete this profile
              </button>
            </div>
          </Sec>
        )}
        <Sec title="Delivery zones" text="Customers choose a zone at checkout. Give each zone a fee and, if you like, a free-delivery amount and delivery time.">
          <div className="space-y-4">
            {p.zones.map((z) => (
              <ZoneForm key={z.id} zone={z} onChange={(patch) => patchZone(p.id, z.id, patch)} onDelete={() => deleteZone(p.id, z.id)} />
            ))}
            <button onClick={() => addZone(p.id)} className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-100 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-200">
              <Plus className="h-4 w-4" /> Add zone
            </button>
            {!isGeneral && (
              <p className="text-xs text-slate-500">
                A zone only works for a mixed cart if every profile in the cart has a zone with the same name.
              </p>
            )}
          </div>
        </Sec>
        {saveRow}
      </div>
    );
  }

  // ----- local delivery -----
  if (view?.kind === 'local') {
    const l = sh.local;
    const set = (patch: Partial<typeof l>) => setSh((s) => ({ ...s, local: { ...s.local, ...patch } }));
    const int = (v: string) => Math.max(0, Math.round(Number(v) || 0));
    return (
      <div className="space-y-5">
        <BackLink onClick={() => setView(null)} text="Shipping and delivery" />
        <Heading title="Local delivery" text="Deliver to nearby customers yourself, with your own riders." />
        <div className={card}>
          <Toggle checked={l.enabled} onChange={(v) => set({ enabled: v })} title="Offer local delivery" text="Customers can choose it at checkout." />
          <div className="mt-3 space-y-4 border-t border-slate-100 pt-4">
            <div>
              <label className={label}>Areas you deliver to</label>
              <textarea rows={3} className={field} placeholder="e.g. GRA, Rumuola, Trans Amadi" value={l.areas} onChange={(e) => set({ areas: e.target.value })} />
              <p className="mt-1 text-xs text-slate-500">Separate areas with commas. Customers pick one at checkout. Leave empty to skip the area choice.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className={label}>Delivery fee (₦)</label>
                <input type="number" min="0" className={field} value={l.fee} onChange={(e) => set({ fee: int(e.target.value) })} />
              </div>
              <div>
                <label className={label}>Free over (₦, 0 = never)</label>
                <input type="number" min="0" className={field} value={l.freeOver} onChange={(e) => set({ freeOver: int(e.target.value) })} />
              </div>
              <div>
                <label className={label}>Minimum order (₦)</label>
                <input type="number" min="0" className={field} value={l.minOrder} onChange={(e) => set({ minOrder: int(e.target.value) })} />
              </div>
            </div>
            <div>
              <label className={label}>Delivery time (shown when estimated dates are on)</label>
              <input className={field} placeholder="e.g. Same day, within 3 hours" value={l.eta} onChange={(e) => set({ eta: e.target.value })} />
            </div>
          </div>
        </div>
        {saveRow}
      </div>
    );
  }

  // ----- pickup -----
  if (view?.kind === 'pickup') {
    const k = sh.pickup;
    const set = (patch: Partial<typeof k>) => setSh((s) => ({ ...s, pickup: { ...s.pickup, ...patch } }));
    return (
      <div className="space-y-5">
        <BackLink onClick={() => setView(null)} text="Shipping and delivery" />
        <Heading title="Pickup in store" text="Let customers collect their order from you, free of charge." />
        <div className={card}>
          <Toggle checked={k.enabled} onChange={(v) => set({ enabled: v })} title="Offer pickup in store" text="Customers can choose it at checkout." />
          <div className="mt-3 space-y-4 border-t border-slate-100 pt-4">
            <div>
              <label className={label}>Pickup address</label>
              <textarea rows={2} className={field} value={k.address} onChange={(e) => set({ address: e.target.value })} />
            </div>
            <div>
              <label className={label}>Pickup instructions (optional)</label>
              <textarea rows={2} className={field} placeholder="e.g. Call when you arrive. We are at the blue gate." value={k.instructions} onChange={(e) => set({ instructions: e.target.value })} />
            </div>
            <div>
              <label className={label}>Usually ready in (shown when estimated dates are on)</label>
              <input className={field} placeholder="e.g. 2 hours" value={k.ready} onChange={(e) => set({ ready: e.target.value })} />
            </div>
          </div>
        </div>
        {saveRow}
      </div>
    );
  }

  // ----- the main page -----
  const pill = (on: boolean) => (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${on ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'}`}>
      {on ? 'On' : 'Off'}
    </span>
  );

  return (
    <div className="space-y-7">
      <Heading title="Shipping and delivery" text="Choose how customers receive their orders and what it costs." />

      <Sec title="Shipping">
        <Toggle
          checked={sh.enabled}
          onChange={(v) => setSh((s) => ({ ...s, enabled: v }))}
          title="Offer delivery to customers"
          text="Customers choose a delivery zone at checkout and pay the fee you set."
        />
        <div className="mt-2 border-t border-slate-100 pt-3">
          <p className="text-sm font-semibold text-slate-900">Shipping profiles</p>
          <p className="text-xs text-slate-500">
            {sh.profiles.length} profile{sh.profiles.length === 1 ? '' : 's'} · Manage where you ship and the rates for products
          </p>
          <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
            <p className="bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-900">Store default</p>
            {sh.profiles.map((p, i) => (
              <button
                key={p.id}
                onClick={() => setView({ kind: 'profile', id: p.id })}
                className="flex w-full items-center gap-3 border-t border-slate-100 px-4 py-3 text-left"
              >
                <span className="flex-1">
                  <span className="block text-sm font-semibold text-slate-900">{p.name || 'New profile'}</span>
                  <span className="block text-xs text-slate-500">
                    {i === 0 ? 'All products' : p.categories.join(', ') || 'No categories chosen'} · 1 location · {p.zones.length} zone
                    {p.zones.length === 1 ? '' : 's'}
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 text-slate-400" />
              </button>
            ))}
            <button onClick={addProfile} className="flex w-full items-center gap-2 border-t border-slate-100 px-4 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-50">
              <Plus className="h-4 w-4" /> Add custom profile
            </button>
          </div>
        </div>
        <div className="mt-3 border-t border-slate-100 pt-1">
          <Toggle
            checked={sh.estimates}
            onChange={(v) => setSh((s) => ({ ...s, estimates: v }))}
            title="Estimated delivery dates"
            text="Show customers how long delivery should take at checkout and on their order."
          />
        </div>
      </Sec>

      <Sec title="Additional delivery methods">
        <div className="divide-y divide-slate-100">
          <button onClick={() => setView({ kind: 'local' })} className="flex w-full items-center gap-3 py-3.5 text-left">
            <Truck className="h-5 w-5 shrink-0 text-slate-700" />
            <span className="flex-1 text-sm font-semibold text-slate-900">Local delivery</span>
            {pill(sh.local.enabled)}
            <ChevronRight className="h-4 w-4 text-slate-400" />
          </button>
          <button onClick={() => setView({ kind: 'pickup' })} className="flex w-full items-center gap-3 py-3.5 text-left">
            <Store className="h-5 w-5 shrink-0 text-slate-700" />
            <span className="flex-1 text-sm font-semibold text-slate-900">Pickup in store</span>
            {pill(sh.pickup.enabled)}
            <ChevronRight className="h-4 w-4 text-slate-400" />
          </button>
        </div>
      </Sec>

      <Sec title="Delivery customizations" text="Customizations control how delivery options appear to customers at checkout. You can hide, reorder and rename delivery options.">
        {!custOpen ? (
          <button onClick={() => setCustOpen(true)} className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-100 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-200">
            <Plus className="h-4 w-4" /> Delivery customization
          </button>
        ) : (
          <div className="space-y-3">
            {sh.methods.map((m, i) => (
              <div key={m.key} className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 p-3">
                <div className="flex flex-col">
                  <button onClick={() => moveMethod(i, -1)} disabled={i === 0} className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30" aria-label="Move up">
                    <ArrowUp className="h-4 w-4" />
                  </button>
                  <button onClick={() => moveMethod(i, 1)} disabled={i === sh.methods.length - 1} className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30" aria-label="Move down">
                    <ArrowDown className="h-4 w-4" />
                  </button>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] uppercase tracking-wide text-slate-400">
                    {m.key === 'shipping' ? 'Delivery zones' : m.key === 'local' ? 'Local delivery' : 'Pickup in store'}
                  </p>
                  <input
                    className={`${field} mt-1 !py-2`}
                    maxLength={40}
                    value={m.name}
                    onChange={(e) => setSh((s) => ({ ...s, methods: s.methods.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) }))}
                  />
                </div>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={m.hidden}
                    onChange={(e) => setSh((s) => ({ ...s, methods: s.methods.map((x, j) => (j === i ? { ...x, hidden: e.target.checked } : x)) }))}
                  />
                  Hide at checkout
                </label>
              </div>
            ))}
            <button onClick={() => setSh((s) => ({ ...s, methods: defaultMethods }))} className="text-sm font-medium text-slate-600 underline">
              Reset to default
            </button>
          </div>
        )}
      </Sec>

      <p className="text-xs text-slate-500">
        If you turn on every delivery option, customers see them in the order shown above. If you turn on none, checkout skips
        the delivery step.
      </p>

      {saveRow}
    </div>
  );
}

type PrView = null | 'cookie' | 'requests' | 'double';
type PReq = { id: string; name: string; contact: string; kind: string; details: string | null; status: string; created_at: string };

function PRow({
  icon: Icon,
  title,
  status,
  badge,
  onClick,
}: {
  icon: React.ElementType;
  title: string;
  status: string;
  badge?: string;
  onClick: () => void;
}) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 py-3.5 text-left">
      <Icon className="h-5 w-5 shrink-0 text-slate-700" />
      <span className="flex-1">
        <span className="block text-sm font-semibold text-slate-900">{title}</span>
        <span className="block text-xs text-slate-500">{status}</span>
        {badge && (
          <span className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
            <span className="h-2 w-2 rounded-full bg-green-500" /> {badge}
          </span>
        )}
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
    </button>
  );
}

function PrivacyPage({ user, onGo }: { user: User; onGo: (id: PageId) => void }) {
  const [bizId, setBizId] = useState<string | null | undefined>(undefined);
  const [slug, setSlug] = useState('');
  const [p, setP] = useState<PrivacyOptions>(defaultPrivacy);
  const [draft, setDraft] = useState<PrivacyOptions>(defaultPrivacy);
  const [pol, setPol] = useState<Policies>(defaultPolicies);
  const [reqs, setReqs] = useState<PReq[]>([]);
  const [view, setView] = useState<PrView>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [copied, setCopied] = useState(false);
  const origin = typeof window === 'undefined' ? '' : window.location.origin;

  useEffect(() => {
    const sb = createClient();
    sb.from('businesses')
      .select('id,slug,privacy_options,policies')
      .eq('owner_id', user.id)
      .maybeSingle()
      .then(async ({ data }) => {
        setBizId(data?.id ?? null);
        if (!data) return;
        setSlug(data.slug);
        const po = readPrivacy(data.privacy_options);
        setP(po);
        setDraft(po);
        setPol(readPolicies(data.policies));
        const { data: rows } = await sb
          .from('privacy_requests')
          .select('id,name,contact,kind,details,status,created_at')
          .eq('business_id', data.id)
          .order('created_at', { ascending: false })
          .limit(50);
        setReqs((rows as PReq[]) ?? []);
      });
  }, [user.id]);

  async function save(next: PrivacyOptions) {
    if (!bizId) return;
    setSaving(true);
    setMsg('');
    const { error } = await createClient().from('businesses').update({ privacy_options: next }).eq('id', bizId);
    setSaving(false);
    if (error) return setMsg('Could not save: ' + error.message);
    setP(next);
    setDraft(next);
    setMsg('Saved.');
  }

  function openView(v: PrView) {
    setMsg('');
    setDraft(p);
    setView(v);
  }

  async function setReqStatus(r: PReq, status: 'new' | 'done') {
    await createClient().from('privacy_requests').update({ status }).eq('id', r.id);
    setReqs((list) => list.map((x) => (x.id === r.id ? { ...x, status } : x)));
  }

  const link = slug ? `${origin}/b/${slug}/privacy-request` : '';
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
        <Heading title="Customer privacy" />
        <div className={card}>
          <p className="text-sm text-slate-600">Create your website first (My website) to set this up.</p>
        </div>
      </div>
    );
  }

  const saveBtn = (
    <div>
      <button onClick={() => save(draft)} disabled={saving} className={primary}>
        {saving ? 'Saving...' : 'Save'}
      </button>
      <Note text={msg} />
    </div>
  );

  if (view === 'cookie') {
    return (
      <div className="space-y-5">
        <BackLink onClick={() => setView(null)} text="Customer privacy" />
        <Heading title="Cookie banner" text="Ask visitors before your store counts their visit." />
        <div className={card}>
          <Toggle
            checked={draft.cookieBanner}
            onChange={(v) => setDraft({ ...draft, cookieBanner: v })}
            title="Show a cookie banner on my store"
            text="Visitors choose Accept or Decline. Visits are counted only after they accept."
          />
          <div className="mt-3 border-t border-slate-100 pt-4">
            <label className={label}>Banner message</label>
            <textarea
              rows={3}
              maxLength={300}
              className={field}
              value={draft.cookieMessage}
              onChange={(e) => setDraft({ ...draft, cookieMessage: e.target.value })}
            />
          </div>
          <div className="mt-4 rounded-xl bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Preview</p>
            <p className="mt-2 text-sm text-slate-700">{draft.cookieMessage || '...'}</p>
            <div className="mt-3 flex gap-2">
              <span className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Accept</span>
              <span className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">Decline</span>
            </div>
          </div>
          {draft.cookieBanner && !draft.analytics && (
            <p className="mt-3 text-xs text-amber-700">Visit analytics is turned off, so the banner will not change what is counted.</p>
          )}
        </div>
        {saveBtn}
      </div>
    );
  }

  if (view === 'requests') {
    return (
      <div className="space-y-5">
        <BackLink onClick={() => setView(null)} text="Customer privacy" />
        <Heading title="Privacy requests page" text="A page where customers can ask for their information, ask for it to be deleted, or stop marketing." />
        <div className={card}>
          <Toggle
            checked={draft.requestsPage}
            onChange={(v) => setDraft({ ...draft, requestsPage: v })}
            title="Turn on the privacy requests page"
            text="Adds a Privacy requests link to your store footer and checkout."
          />
          <div className="mt-3 flex flex-col gap-2 border-t border-slate-100 pt-4 sm:flex-row">
            <input readOnly value={link} onFocus={(e) => e.currentTarget.select()} className={`${field} min-w-0 flex-1 bg-slate-50`} />
            <button onClick={copy} className={`${primary} flex items-center justify-center gap-2`}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copied!' : 'Copy link'}
            </button>
          </div>
        </div>
        {saveBtn}

        <Sec title="Requests" text="When a customer sends a request, handle it yourself and mark it done. To delete someone's information, remove it from Orders and Customer accounts.">
          {reqs.length === 0 ? (
            <p className="text-sm text-slate-500">No requests yet.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {reqs.map((r) => (
                <div key={r.id} className="py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900">
                      {requestKinds.find((k) => k.v === r.kind)?.t ?? r.kind}
                    </p>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                        r.status === 'done' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {r.status === 'done' ? 'Done' : 'New'}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-700">
                    {r.name} · {r.contact}
                  </p>
                  {r.details && <p className="mt-1 whitespace-pre-line text-xs text-slate-500">{r.details}</p>}
                  <p className="mt-1 text-[11px] text-slate-400">
                    {new Date(r.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                  <button
                    onClick={() => setReqStatus(r, r.status === 'done' ? 'new' : 'done')}
                    className="mt-2 text-xs font-semibold text-blue-600 hover:underline"
                  >
                    {r.status === 'done' ? 'Reopen' : 'Mark as done'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </Sec>
      </div>
    );
  }

  if (view === 'double') {
    return (
      <div className="space-y-5">
        <BackLink onClick={() => setView(null)} text="Customer privacy" />
        <Heading title="Double opt-in for marketing" text="Ask your customers to confirm their contact details before you send them marketing." />
        <div className={card}>
          <Toggle
            checked={draft.doubleOptIn}
            onChange={(v) => setDraft({ ...draft, doubleOptIn: v })}
            title="Require confirmation of marketing consent"
            text="Customers who agree to marketing on an order show as Not confirmed in Orders."
          />
          <div className="mt-3 space-y-2 border-t border-slate-100 pt-4 text-sm text-slate-600">
            <p>How it works:</p>
            <ol className="list-decimal space-y-1 pl-5">
              <li>A customer ticks a marketing box at checkout.</li>
              <li>In Orders, that order shows Not confirmed, with buttons to message them on WhatsApp or by email.</li>
              <li>When they reply to confirm, press Mark as confirmed.</li>
              <li>Only message customers who are confirmed.</li>
            </ol>
            <p className="text-xs text-slate-500">Xenon does not send these messages itself. The buttons open your own WhatsApp or email.</p>
          </div>
        </div>
        {saveBtn}
      </div>
    );
  }

  return (
    <div className="space-y-7">
      <Heading title="Customer privacy" text="Control how your store handles customer information." />

      <Sec title="Privacy settings">
        <div className="divide-y divide-slate-100">
          <PRow
            icon={ScrollText}
            title="Privacy policy"
            status={pol.privacy.published ? 'Published on your online store' : 'Not published'}
            badge={pol.privacy.auto ? 'Automated' : undefined}
            onClick={() => onGo('policies')}
          />
          <PRow
            icon={Cookie}
            title="Cookie banner"
            status={p.cookieBanner ? 'On. Visitors are asked before visits are counted' : 'Off'}
            onClick={() => openView('cookie')}
          />
          <PRow
            icon={UserCheck}
            title="Privacy requests page"
            status={p.requestsPage ? `On. ${reqs.filter((r) => r.status === 'new').length} new request(s)` : 'Off'}
            onClick={() => openView('requests')}
          />
        </div>
      </Sec>

      <div className={card}>
        <div className="flex flex-wrap items-center gap-3">
          <ShieldCheck className="h-5 w-5 shrink-0 text-slate-700" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-900">Visit analytics</p>
            <span
              className={`mt-1 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                p.analytics ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${p.analytics ? 'bg-green-500' : 'bg-slate-400'}`} />
              {p.analytics ? 'Enabled' : 'Disabled'}
            </span>
          </div>
          <button
            onClick={() => save({ ...p, analytics: !p.analytics })}
            disabled={saving}
            className="rounded-xl border border-slate-300 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100"
          >
            {p.analytics ? 'Disable' : 'Enable'}
          </button>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Xenon counts visits to your store, such as how many people visit and which link they came from, to power your
          Analytics. These statistics are only shown to you. If you disable this, new visits are not counted.
        </p>
      </div>

      <Sec title="Marketing settings">
        <div className="divide-y divide-slate-100">
          <PRow
            icon={Mail}
            title="Email, SMS and WhatsApp marketing in checkout"
            status="Ask your customers for their marketing preferences"
            onClick={() => onGo('checkout')}
          />
          <PRow
            icon={BadgeCheck}
            title="Double opt-in for marketing"
            status={p.doubleOptIn ? 'On. Ask your customers to confirm their contact details' : 'Off'}
            onClick={() => openView('double')}
          />
        </div>
      </Sec>

      <Sec title="Data storage hosting location">
        <p className="text-sm font-semibold text-slate-900">
          {HOSTING_LOCATION || 'Location not set yet'}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Your store&apos;s customer information is stored in this region.
          {HOSTING_LOCATION ? '' : ' Set it in lib/privacy.ts.'}
        </p>
      </Sec>
      <Note text={msg} />

      <p className="text-xs text-slate-500">
        Recommended privacy settings are for your convenience. Compliance with laws and regulations is your responsibility.
      </p>
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
    // phone: opening a settings page adds a history step, so the back button returns to the list first
  function openPage(id: PageId) {
    setPage(id);
    const state = { tab: 'settings', settingsPage: id };
    if (window.matchMedia('(min-width: 1024px)').matches) {
      window.history.replaceState(state, '', '#settings');
    } else {
      window.history.pushState(state, '', '#settings');
    }
  }

  function backToList() {
    const st = window.history.state as { settingsPage?: string } | null;
    if (st?.settingsPage) window.history.back();
    else setPage(null);
  }

  useEffect(() => {
    function onPop(e: PopStateEvent) {
      const st = e.state as { settingsPage?: PageId } | null;
      setPage(st?.settingsPage ?? null);
    }
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
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
              case 'taxes':
        return <TaxesPage user={user} />;
              case 'policies':
        return <PoliciesPage user={user} />;
              case 'shipping':
        return <ShippingPage user={user} />;
              case 'privacy':
        return <PrivacyPage user={user} onGo={openPage} />;
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
                  onClick={() => openPage(i.id)}
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
            onClick={backToList}
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