'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { ArrowLeft, Building2, Check, ChevronRight, Copy, Database, History, Info, Lock, MapPin, MoreHorizontal, Palette, Store, Trash2, Upload, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { Tab } from '@/components/DashboardOverview';
import {
  businessTypes,
  countries,
  countryName,
  defaultBrand,
  defaultProfile,
  flag,
  formatAddress,
  isEmail,
  logActivity,
  nigerianStates,
  orderPreview,
  readBrand,
  readProfile,
  timeZones,
  validOrderAffix,
  weightUnits,
  type BusinessType,
  type StoreBrand,
  type StoreProfile,
  type UnitSystem,
  type WeightUnit,
} from '@/lib/store/settings';

const card = 'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm';
const field = 'w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500';
const label = 'mb-1 block text-sm font-medium text-slate-700';
const primary = 'rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50';
const ghost = 'rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50';
const danger = 'rounded-xl border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50';
const rowBtn = 'flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-slate-50';

const BUCKET = 'brand-assets';
const FULFILLED = ['fulfilled', 'delivered', 'completed', 'shipped'];

type Biz = { id: string; name: string; slug: string | null; phone: string | null; published: boolean | null };
type Transfer = { id: string; to_email: string; expires_at: string; created_at: string };
type Screen = 'home' | 'account' | 'brand' | 'activity';
type ModalName = null | 'business' | 'contact' | 'address' | 'transfer' | 'benefits';
type Draft = Pick<StoreProfile, 'backup_region' | 'unit_system' | 'weight_unit' | 'timezone' | 'order_prefix' | 'order_suffix' | 'fulfill_after_paid' | 'archive_when_done'>;
type Save = (patch: Partial<StoreProfile>) => Promise<string | null>;

const draftOf = (p: StoreProfile): Draft => ({
  backup_region: p.backup_region,
  unit_system: p.unit_system,
  weight_unit: p.weight_unit,
  timezone: p.timezone,
  order_prefix: p.order_prefix,
  order_suffix: p.order_suffix,
  fulfill_after_paid: p.fulfill_after_paid,
  archive_when_done: p.archive_when_done,
});

const when = (iso: string, tz: string) => {
  const d = new Date(iso);
  try {
    return new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium', timeStyle: 'short', timeZone: tz }).format(d);
  } catch {
    return d.toLocaleString();
  }
};

/* --------------------------------- pieces -------------------------------- */

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          <button aria-label="Close" onClick={onClose} className="rounded-full border border-slate-200 p-2 text-slate-600 hover:bg-slate-50">
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Err({ text }: { text: string }) {
  return text ? <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{text}</p> : null;
}

function Radio({ on, title, text, onClick, disabled }: { on: boolean; title: string; text?: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" role="radio" aria-checked={on} disabled={disabled} onClick={onClick} className="flex w-full items-start gap-3 rounded-xl p-2 text-left hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-transparent">
      <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${on ? 'border-slate-900' : 'border-slate-300'}`}>{on && <span className="h-2.5 w-2.5 rounded-full bg-slate-900" />}</span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-slate-900">{title}</span>
        {text && <span className="block text-sm text-slate-600">{text}</span>}
      </span>
    </button>
  );
}

function Avatar({ name, logo, color }: { name: string; logo: string; color: string }) {
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase() || 'X';
  if (logo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={logo} alt="" className="h-12 w-12 shrink-0 rounded-xl object-cover" />;
  }
  return (
    <span style={color ? { backgroundColor: color } : undefined} className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${color ? 'text-white' : 'bg-yellow-400 text-slate-900'}`}>
      {initials}
    </span>
  );
}

function CountrySelect({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <select className={field} value={value} onChange={(e) => onChange(e.target.value)}>
      {countries.map((c) => (
        <option key={c.code} value={c.code}>
          {flag(c.code)} {c.name}
        </option>
      ))}
    </select>
  );
}

function Footer({ busy, onClose, onSave, saveText = 'Save' }: { busy: boolean; onClose: () => void; onSave: () => void; saveText?: string }) {
  return (
    <div className="mt-5 flex justify-end gap-3">
      <button className={ghost} onClick={onClose} disabled={busy}>
        Cancel
      </button>
      <button className={primary} onClick={onSave} disabled={busy}>
        {busy ? 'Saving...' : saveText}
      </button>
    </div>
  );
}

/* ---------------------------------- modals -------------------------------- */

function BusinessModal({ profile, onSave, onClose }: { profile: StoreProfile; onSave: Save; onClose: () => void }) {
  const [country, setCountry] = useState(profile.country);
  const [type, setType] = useState<BusinessType | ''>(profile.business_type ?? '');
  const [legal, setLegal] = useState(profile.legal_name);
  const [reg, setReg] = useState(profile.registration_number);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function go() {
    setErr('');
    if (!type) return setErr('Choose the type of business you have.');
    if (!legal.trim()) return setErr(type === 'individual' ? 'Enter your full legal name.' : 'Enter your legal business name.');
    if (legal.trim().length > 200) return setErr('The legal name is too long.');
    if (reg.trim().length > 60) return setErr('The registration number is too long.');
    setBusy(true);
    const e = await onSave({ country, business_type: type, legal_name: legal.trim(), registration_number: type === 'individual' ? '' : reg.trim() });
    setBusy(false);
    if (e) setErr(e);
    else onClose();
  }

  return (
    <Modal title="Edit business details" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className={label}>Country or region</label>
          <CountrySelect value={country} onChange={setCountry} />
        </div>
        <div>
          <p className={label}>What type of business do you have?</p>
          <div role="radiogroup" className="space-y-1">
            {businessTypes.map((t) => (
              <Radio key={t.v} on={type === t.v} title={t.t} text={t.text} onClick={() => setType(t.v)} />
            ))}
          </div>
        </div>
        <div>
          <label className={label}>{type === 'individual' ? 'Full legal name' : 'Legal business name'}</label>
          <input className={field} value={legal} maxLength={200} onChange={(e) => setLegal(e.target.value)} />
        </div>
        {(type === 'company' || type === 'nonprofit') && (
          <div>
            <label className={label}>{country === 'NG' ? 'CAC registration number (optional)' : 'Registration number (optional)'}</label>
            <input className={field} value={reg} maxLength={60} placeholder={country === 'NG' ? 'RC1234567' : ''} onChange={(e) => setReg(e.target.value)} />
          </div>
        )}
        <Err text={err} />
      </div>
      <Footer busy={busy} onClose={onClose} onSave={go} />
    </Modal>
  );
}

function ContactModal({ biz, email, onSave, onClose }: { biz: Biz; email: string; onSave: (name: string, phone: string, email: string) => Promise<string | null>; onClose: () => void }) {
  const [name, setName] = useState(biz.name);
  const [phone, setPhone] = useState(biz.phone ?? '');
  const [mail, setMail] = useState(email);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function go() {
    setErr('');
    if (!name.trim()) return setErr('Enter a store name.');
    if (name.trim().length > 100) return setErr('The store name is too long (100 characters max).');
    if (!isEmail(mail)) return setErr('Enter a valid store email.');
    if (phone.trim() && !/^[0-9+()\-\s]{6,20}$/.test(phone.trim())) return setErr('Enter a valid phone number.');
    setBusy(true);
    const e = await onSave(name.trim(), phone.trim(), mail.trim());
    setBusy(false);
    if (e) setErr(e);
    else onClose();
  }

  return (
    <Modal title="Edit store contact details" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className={label}>Store name</label>
          <input className={field} value={name} maxLength={100} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className={label}>Store email</label>
          <input className={field} type="email" inputMode="email" value={mail} onChange={(e) => setMail(e.target.value)} />
          <p className="mt-1 text-xs text-slate-500">Where customers can reach you.</p>
        </div>
        <div>
          <label className={label}>Phone number (optional)</label>
          <input className={field} inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <Err text={err} />
      </div>
      <Footer busy={busy} onClose={onClose} onSave={go} />
    </Modal>
  );
}

function AddressModal({ profile, onSave, onClose }: { profile: StoreProfile; onSave: Save; onClose: () => void }) {
  const [country, setCountry] = useState(profile.country);
  const [l1, setL1] = useState(profile.address_line1);
  const [l2, setL2] = useState(profile.address_line2);
  const [city, setCity] = useState(profile.city);
  const [state, setState] = useState(profile.state);
  const [zip, setZip] = useState(profile.postal_code);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function go() {
    setErr('');
    if (!l1.trim()) return setErr('Enter your street address.');
    if (!city.trim()) return setErr('Enter your city.');
    setBusy(true);
    const e = await onSave({ country, address_line1: l1.trim(), address_line2: l2.trim(), city: city.trim(), state: state.trim(), postal_code: zip.trim() });
    setBusy(false);
    if (e) setErr(e);
    else onClose();
  }

  return (
    <Modal title="Edit store address" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className={label}>Country or region</label>
          <CountrySelect
            value={country}
            onChange={(c) => {
              setCountry(c);
              setState('');
            }}
          />
        </div>
        <div>
          <label className={label}>Address</label>
          <input className={field} value={l1} maxLength={200} onChange={(e) => setL1(e.target.value)} />
        </div>
        <div>
          <label className={label}>Apartment, suite, etc. (optional)</label>
          <input className={field} value={l2} maxLength={200} onChange={(e) => setL2(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label}>City</label>
            <input className={field} value={city} maxLength={100} onChange={(e) => setCity(e.target.value)} />
          </div>
          <div>
            <label className={label}>Postal code</label>
            <input className={field} value={zip} maxLength={20} onChange={(e) => setZip(e.target.value)} />
          </div>
        </div>
        <div>
          <label className={label}>{country === 'NG' ? 'State' : 'State or region'}</label>
          {country === 'NG' ? (
            <select className={field} value={state} onChange={(e) => setState(e.target.value)}>
              <option value="">Choose a state</option>
              {nigerianStates.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          ) : (
            <input className={field} value={state} maxLength={100} onChange={(e) => setState(e.target.value)} />
          )}
        </div>
        <Err text={err} />
      </div>
      <Footer busy={busy} onClose={onClose} onSave={go} />
    </Modal>
  );
}

async function authed(path: string, body: object): Promise<{ ok: boolean; json: Record<string, unknown> }> {
  const { data } = await createClient().auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { ok: false, json: { error: 'Please sign in again.' } };
  const res = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
  return { ok: res.ok, json: ((await res.json().catch(() => ({}))) as Record<string, unknown>) ?? {} };
}

function TransferModal({ biz, transfer, actor, onClose, onChanged }: { biz: Biz; transfer: Transfer | null; actor: string; onClose: () => void; onChanged: () => void }) {
  const [step, setStep] = useState<'choose' | 'details' | 'done' | 'pending'>(transfer ? 'pending' : 'choose');
  const [email, setEmail] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [link, setLink] = useState(transfer ? `${window.location.origin}/transfer/${transfer.id}` : '');
  const [sent, setSent] = useState<boolean | null>(null);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  async function send() {
    setErr('');
    if (!isEmail(email)) return setErr('Enter the email address of the new owner.');
    if (confirm.trim().toLowerCase() !== biz.name.trim().toLowerCase()) return setErr('Type your store name exactly to confirm.');
    setBusy(true);
    const r = await authed('/api/store/transfer', { businessId: biz.id, email: email.trim(), confirmName: confirm.trim() });
    setBusy(false);
    if (!r.ok) return setErr(typeof r.json.error === 'string' ? r.json.error : 'Could not start the transfer.');
    setLink(typeof r.json.link === 'string' ? r.json.link : '');
    setSent(r.json.emailSent === true);
    setStep('done');
    onChanged();
  }

  async function cancel() {
    if (!transfer) return;
    setBusy(true);
    const sb = createClient();
    const { error } = await sb.from('store_transfers').update({ status: 'cancelled' }).eq('id', transfer.id);
    setBusy(false);
    if (error) return setErr(error.message);
    logActivity(sb, biz.id, actor, 'Cancelled store transfer', `To ${transfer.to_email}`);
    onChanged();
    onClose();
  }

  return (
    <Modal title="Transfer store" onClose={onClose}>
      {step === 'choose' && (
        <div className="space-y-4">
          <p className="text-sm text-slate-600">This can affect billing, finance, and user permissions.</p>
          <div role="radiogroup" className="space-y-1">
            <Radio on={false} disabled title="Move store into a new or existing organization" text="Not available yet." onClick={() => undefined} />
            <Radio on title="Transfer store to a new owner outside your business" onClick={() => undefined} />
          </div>
          <div className="flex flex-col gap-2">
            <button className={primary} onClick={() => setStep('details')}>
              Continue
            </button>
            <button className={ghost} onClick={onClose}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {step === 'details' && (
        <div className="space-y-4">
          <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
            The new owner gets full control of this store, its orders, customers and settings. You lose access when they accept. The request expires in 7 days and you can cancel it until then.
          </div>
          <div>
            <label className={label}>New owner&apos;s email</label>
            <input className={field} type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <p className="mt-1 text-xs text-slate-500">They need a Xenon account with this email, and it can&apos;t already have its own store.</p>
          </div>
          <div>
            <label className={label}>
              Type <strong>{biz.name}</strong> to confirm
            </label>
            <input className={field} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>
          <Err text={err} />
          <div className="flex justify-end gap-3">
            <button className={ghost} onClick={() => setStep('choose')} disabled={busy}>
              Back
            </button>
            <button className={primary} onClick={send} disabled={busy}>
              {busy ? 'Sending...' : 'Send transfer request'}
            </button>
          </div>
        </div>
      )}

      {step === 'done' && (
        <div className="space-y-4">
          <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{sent ? `We emailed ${email.trim()} a link to accept the transfer.` : 'The transfer request is ready, but we could not email it. Send this link to the new owner yourself.'}</p>
          <div className="flex items-center gap-2 rounded-xl bg-slate-50 p-3">
            <p className="min-w-0 flex-1 break-all text-xs text-slate-700">{link}</p>
            <button className={ghost} onClick={copy}>
              {copied ? <Check size={14} /> : <Copy size={14} />}
            </button>
          </div>
          <div className="flex justify-end">
            <button className={primary} onClick={onClose}>
              Done
            </button>
          </div>
        </div>
      )}

      {step === 'pending' && transfer && (
        <div className="space-y-4">
          <p className="text-sm text-slate-700">
            Waiting for <strong>{transfer.to_email}</strong> to accept. This request expires on {new Date(transfer.expires_at).toLocaleDateString()}.
          </p>
          <div className="flex items-center gap-2 rounded-xl bg-slate-50 p-3">
            <p className="min-w-0 flex-1 break-all text-xs text-slate-700">{link}</p>
            <button className={ghost} onClick={copy}>
              {copied ? <Check size={14} /> : <Copy size={14} />}
            </button>
          </div>
          <Err text={err} />
          <div className="flex justify-end gap-3">
            <button className={ghost} onClick={onClose}>
              Close
            </button>
            <button className={danger} onClick={cancel} disabled={busy}>
              {busy ? 'Cancelling...' : 'Cancel transfer'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

/* --------------------------------- sub pages ------------------------------ */

type Meta = { full_name?: string; phone?: string; role?: string; trade?: string };

function AccountPage({ user, onUserChange, onBack }: { user: User; onUserChange: (u: User) => void; onBack: () => void }) {
  const meta = (user.user_metadata ?? {}) as Meta;
  const [name, setName] = useState(meta.full_name ?? '');
  const [phone, setPhone] = useState(meta.phone ?? '');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  async function save() {
    setBusy(true);
    setMsg('');
    setErr('');
    const { data, error } = await createClient().auth.updateUser({ data: { full_name: name.trim(), phone: phone.trim() } });
    setBusy(false);
    if (error) return setErr('Could not save: ' + error.message);
    if (data.user) onUserChange(data.user);
    setMsg('Saved.');
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button className={ghost} onClick={onBack}>
          <ArrowLeft size={14} className="mr-1 inline" />
          Back
        </button>
        <h2 className="text-xl font-bold text-slate-900">Account settings</h2>
      </div>
      <div className={`${card} space-y-4`}>
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
          <input className={field} value={user.email ?? ''} disabled readOnly />
        </div>
        <div>
          <label className={label}>Account type</label>
          <input className={field} disabled readOnly value={meta.role === 'artisan' ? `Business owner${meta.trade ? ` · ${meta.trade}` : ''}` : 'Customer'} />
        </div>
        <Err text={err} />
        {msg && <p className="text-sm text-emerald-700">{msg}</p>}
        <button className={primary} onClick={save} disabled={busy}>
          {busy ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
}

function BrandPage({ biz, brand, actor, onBack, onSaved }: { biz: Biz; brand: StoreBrand; actor: string; onBack: () => void; onSaved: (b: StoreBrand) => void }) {
  const [b, setB] = useState<StoreBrand>(brand);
  const [busy, setBusy] = useState(false);
  const [up, setUp] = useState<'' | 'logo' | 'cover'>('');
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const dirty = JSON.stringify(b) !== JSON.stringify(brand);

  async function upload(kind: 'logo' | 'cover', file: File | undefined) {
    if (!file) return;
    setErr('');
    setMsg('');
    const ext = ({ 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' } as Record<string, string>)[file.type];
    if (!ext) return setErr('Use a PNG, JPG or WebP image.');
    const max = kind === 'logo' ? 2 : 4;
    if (file.size > max * 1024 * 1024) return setErr(`That image is over ${max} MB.`);
    setUp(kind);
    const sb = createClient();
    const path = `${biz.id}/${kind}-${crypto.randomUUID()}.${ext}`;
    const { error } = await sb.storage.from(BUCKET).upload(path, file, { contentType: file.type, cacheControl: '31536000' });
    setUp('');
    if (error) return setErr(/bucket/i.test(error.message) ? 'Run general.sql in Supabase first.' : error.message);
    const url = sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl as string;
    setB((x) => ({ ...x, [kind === 'logo' ? 'logo_url' : 'cover_url']: url }));
  }

  async function save() {
    setErr('');
    setMsg('');
    if (b.slogan.length > 150) return setErr('The slogan is too long (150 characters max).');
    if (b.short_description.length > 500) return setErr('The description is too long (500 characters max).');
    for (const c of [b.primary_color, b.secondary_color]) if (c && !/^#[0-9a-fA-F]{6}$/.test(c)) return setErr('Colours must look like #1a2b3c.');
    setBusy(true);
    const sb = createClient();
    const { error } = await sb.from('store_brand').upsert({ business_id: biz.id, ...b, slogan: b.slogan.trim(), short_description: b.short_description.trim(), updated_at: new Date().toISOString() }, { onConflict: 'business_id' });
    setBusy(false);
    if (error) return setErr(error.message);
    logActivity(sb, biz.id, actor, 'Updated brand');
    onSaved(b);
    setMsg('Saved.');
  }

  const colour = (key: 'primary_color' | 'secondary_color', title: string) => (
    <div>
      <label className={label}>{title}</label>
      <div className="flex items-center gap-2">
        <input type="color" aria-label={title} className="h-10 w-12 shrink-0 cursor-pointer rounded-lg border border-slate-300 bg-white p-1" value={b[key] || '#2563eb'} onChange={(e) => setB({ ...b, [key]: e.target.value })} />
        <input className={field} value={b[key]} placeholder="#2563eb" maxLength={7} onChange={(e) => setB({ ...b, [key]: e.target.value })} />
        {b[key] && (
          <button className={ghost} onClick={() => setB({ ...b, [key]: '' })}>
            Clear
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-5 pb-4">
      <div className="flex items-center gap-3">
        <button className={ghost} onClick={onBack}>
          <ArrowLeft size={14} className="mr-1 inline" />
          Back
        </button>
        <h2 className="text-xl font-bold text-slate-900">Brand</h2>
      </div>
      <p className="text-sm text-slate-600">Your logo, colours and description, kept in one place for your website and emails.</p>

      <div className={`${card} space-y-4`}>
        <div className="flex items-center gap-4">
          <Avatar name={biz.name} logo={b.logo_url} color={b.primary_color} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-slate-900">Logo</p>
            <p className="text-xs text-slate-500">PNG, JPG or WebP, up to 2 MB.</p>
          </div>
          <label className={`${ghost} cursor-pointer`}>
            <Upload size={14} className="mr-1 inline" />
            {up === 'logo' ? 'Uploading...' : b.logo_url ? 'Replace' : 'Upload'}
            <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" disabled={!!up} onChange={(e) => upload('logo', e.target.files?.[0])} />
          </label>
          {b.logo_url && (
            <button className={danger} aria-label="Remove logo" onClick={() => setB({ ...b, logo_url: '' })}>
              <Trash2 size={14} />
            </button>
          )}
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-slate-900">Cover image</p>
          {b.cover_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={b.cover_url} alt="" className="mb-2 h-32 w-full rounded-xl object-cover" />
          ) : (
            <div className="mb-2 flex h-32 w-full items-center justify-center rounded-xl bg-slate-100 text-sm text-slate-400">No cover image</div>
          )}
          <div className="flex gap-2">
            <label className={`${ghost} cursor-pointer`}>
              <Upload size={14} className="mr-1 inline" />
              {up === 'cover' ? 'Uploading...' : b.cover_url ? 'Replace' : 'Upload'}
              <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" disabled={!!up} onChange={(e) => upload('cover', e.target.files?.[0])} />
            </label>
            {b.cover_url && (
              <button className={danger} onClick={() => setB({ ...b, cover_url: '' })}>
                Remove
              </button>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-500">PNG, JPG or WebP, up to 4 MB.</p>
        </div>
      </div>

      <div className={`${card} space-y-4`}>
        <div>
          <div className="flex items-baseline justify-between">
            <label className={label}>Slogan</label>
            <span className="text-xs text-slate-400">{b.slogan.length}/150</span>
          </div>
          <input className={field} value={b.slogan} maxLength={150} onChange={(e) => setB({ ...b, slogan: e.target.value })} />
        </div>
        <div>
          <div className="flex items-baseline justify-between">
            <label className={label}>Short description</label>
            <span className="text-xs text-slate-400">{b.short_description.length}/500</span>
          </div>
          <textarea className={`${field} h-24`} value={b.short_description} maxLength={500} onChange={(e) => setB({ ...b, short_description: e.target.value })} />
        </div>
        {colour('primary_color', 'Primary colour')}
        {colour('secondary_color', 'Secondary colour')}
      </div>

      <Err text={err} />
      {msg && <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{msg}</p>}
      <button className={primary} disabled={busy || !dirty} onClick={save}>
        {busy ? 'Saving...' : 'Save'}
      </button>
    </div>
  );
}

type Act = { id: string; actor_email: string; action: string; detail: string; created_at: string };
const PAGE = 50;

function ActivityPage({ biz, tz, onBack }: { biz: Biz; tz: string; onBack: () => void }) {
  const [rows, setRows] = useState<Act[]>([]);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(
    async (from: number) => {
      const { data, error } = await createClient()
        .from('store_activity')
        .select('id,actor_email,action,detail,created_at')
        .eq('business_id', biz.id)
        .order('created_at', { ascending: false })
        .range(from, from + PAGE - 1);
      if (error) setErr(/store_activity/.test(error.message) ? 'Run general.sql in Supabase first.' : error.message);
      else {
        const list = (data ?? []) as Act[];
        setRows((r) => (from === 0 ? list : [...r, ...list]));
        setMore(list.length === PAGE);
      }
      setLoading(false);
    },
    [biz.id]
  );

  useEffect(() => {
    load(0);
  }, [load]);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button className={ghost} onClick={onBack}>
          <ArrowLeft size={14} className="mr-1 inline" />
          Back
        </button>
        <h2 className="text-xl font-bold text-slate-900">Store activity log</h2>
      </div>
      <Err text={err} />
      {loading ? (
        <div className="h-64 animate-pulse rounded-2xl bg-slate-100" />
      ) : rows.length === 0 ? (
        <div className={`${card} text-sm text-slate-600`}>No activity yet. Changes you make in General settings will show up here.</div>
      ) : (
        <div className={`${card} p-0`}>
          <ul className="divide-y divide-slate-100">
            {rows.map((r) => (
              <li key={r.id} className="px-5 py-4">
                <p className="text-sm font-medium text-slate-900">{r.action}</p>
                {r.detail && <p className="text-sm text-slate-600">{r.detail}</p>}
                <p className="mt-1 text-xs text-slate-500">
                  {r.actor_email || 'Unknown'} · {when(r.created_at, tz)}
                </p>
              </li>
            ))}
          </ul>
          {more && (
            <div className="border-t border-slate-100 p-4 text-center">
              <button className={ghost} onClick={() => load(rows.length)}>
                Load more
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------- the General page ------------------------- */

export default function GeneralPanel({
  user,
  onUserChange,
  onNavigate,
  onGo,
}: {
  user: User;
  onUserChange: (u: User) => void;
  onNavigate: (t: Tab) => void;
  onGo: (id: 'markets' | 'metafields') => void;
}) {
  const [loading, setLoading] = useState(true);
  const [biz, setBiz] = useState<Biz | null>(null);
  const [profile, setProfile] = useState<StoreProfile>(defaultProfile);
  const [brand, setBrand] = useState<StoreBrand>(defaultBrand);
  const [draft, setDraft] = useState<Draft>(draftOf(defaultProfile));
  const [fulfilled, setFulfilled] = useState(false);
  const [transfer, setTransfer] = useState<Transfer | null>(null);
  const [screen, setScreen] = useState<Screen>('home');
  const [modal, setModal] = useState<ModalName>(null);
  const [menu, setMenu] = useState(false);
  const [info, setInfo] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState('');
  const [saved, setSaved] = useState(false);

  const actor = user.email ?? '';
  const zones = useMemo(() => timeZones(profile.timezone), [profile.timezone]);

  const load = useCallback(async () => {
    const sb = createClient();
    const { data: b } = await sb.from('businesses').select('id,name,slug,phone,published').eq('owner_id', user.id).maybeSingle();
    if (!b) {
      setBiz(null);
      setLoading(false);
      return;
    }
    setBiz(b as Biz);
    const [p, br, ord, tr] = await Promise.all([
      sb.from('store_profile').select('*').eq('business_id', b.id).maybeSingle(),
      sb.from('store_brand').select('*').eq('business_id', b.id).maybeSingle(),
      sb.from('orders').select('id', { count: 'exact', head: true }).eq('business_id', b.id).in('status', FULFILLED),
      sb.from('store_transfers').select('id,to_email,expires_at,created_at').eq('business_id', b.id).eq('status', 'pending').gt('expires_at', new Date().toISOString()).maybeSingle(),
    ]);
    if (p.error) setError(/store_profile/.test(p.error.message) ? 'Run general.sql in Supabase first.' : p.error.message);
    else setError('');
    const prof = readProfile(p.data as Record<string, unknown> | null);
    setProfile(prof);
    setDraft(draftOf(prof));
    setBrand(readBrand(br.data as Record<string, unknown> | null));
    setFulfilled(!ord.error && (ord.count ?? 0) > 0);
    setTransfer((tr.data as Transfer | null) ?? null);
    setLoading(false);
  }, [user.id]);

  useEffect(() => {
    load();
  }, [load]);

  // Saves private store details and writes the activity log.
  const saveProfile = useCallback(
    async (patch: Partial<StoreProfile>, activity: { action: string; detail?: string }[]): Promise<string | null> => {
      if (!biz) return 'No business found.';
      const sb = createClient();
      const next = { ...profile, ...patch };
      const { error: e } = await sb.from('store_profile').upsert({ business_id: biz.id, ...next, updated_at: new Date().toISOString() }, { onConflict: 'business_id' });
      if (e) return /store_profile/.test(e.message) ? 'Run general.sql in Supabase first.' : e.message;
      setProfile(next);
      for (const a of activity) logActivity(sb, biz.id, actor, a.action, a.detail ?? '');
      return null;
    },
    [biz, profile, actor]
  );

  async function saveContact(name: string, phone: string, email: string): Promise<string | null> {
    if (!biz) return 'No business found.';
    const sb = createClient();
    const { data, error: e } = await sb.from('businesses').update({ name, phone: phone || null }).eq('id', biz.id).eq('owner_id', user.id).select('id');
    if (e) return e.message;
    if (!data || data.length === 0) return 'Could not update your store. Please sign in again.';
    const failed = await saveProfile({ contact_email: email }, [{ action: 'Updated store contact details' }]);
    if (failed) return failed;
    setBiz({ ...biz, name, phone: phone || null });
    return null;
  }

  const dirty = JSON.stringify(draft) !== JSON.stringify(draftOf(profile));

  async function saveDraft() {
    setSaveErr('');
    setSaved(false);
    if (!validOrderAffix.test(draft.order_prefix) || !validOrderAffix.test(draft.order_suffix)) {
      return setSaveErr('Prefix and suffix can use letters, numbers and # - _ . / (15 characters max).');
    }
    const was = draftOf(profile);
    const log: { action: string; detail?: string }[] = [];
    if (was.backup_region !== draft.backup_region || was.unit_system !== draft.unit_system || was.weight_unit !== draft.weight_unit || was.timezone !== draft.timezone) log.push({ action: 'Updated store defaults' });
    if (was.order_prefix !== draft.order_prefix || was.order_suffix !== draft.order_suffix) log.push({ action: 'Updated order ID format', detail: orderPreview(draft) });
    if (was.fulfill_after_paid !== draft.fulfill_after_paid || was.archive_when_done !== draft.archive_when_done) log.push({ action: 'Updated order processing' });
    setSaving(true);
    const e = await saveProfile(draft, log);
    setSaving(false);
    if (e) return setSaveErr(e);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  /* -------- other screens -------- */

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 animate-pulse rounded-xl bg-slate-200" />
          <div className="h-8 w-48 animate-pulse rounded-lg bg-slate-200" />
        </div>
        <div className="h-32 animate-pulse rounded-2xl bg-slate-100" />
        <div className="h-48 animate-pulse rounded-2xl bg-slate-100" />
      </div>
    );
  }

  if (screen === 'account') return <AccountPage user={user} onUserChange={onUserChange} onBack={() => setScreen('home')} />;

  if (!biz) {
    return (
      <div className="space-y-5">
        <AccountLink onOpen={() => setScreen('account')} />
        <div className={`${card} text-sm text-slate-600`}>Create your business first, then your store details will show up here.</div>
      </div>
    );
  }

  if (screen === 'brand') {
    return (
      <BrandPage
        biz={biz}
        brand={brand}
        actor={actor}
        onBack={() => setScreen('home')}
        onSaved={(b) => setBrand(b)}
      />
    );
  }
  if (screen === 'activity') return <ActivityPage biz={biz} tz={profile.timezone} onBack={() => setScreen('home')} />;

  /* -------- home -------- */

  const detailsDone = !!profile.business_type && !!profile.legal_name.trim();
  const steps = [
    { done: detailsDone, text: 'Add business details', go: () => setModal('business') },
    { done: fulfilled, text: 'Fulfill your first order', go: () => onNavigate('orders' as unknown as Tab) },
  ];
  const left = steps.filter((s) => !s.done).length;
  const email = profile.contact_email || user.email || '';
  const address = formatAddress(profile);
  const hasAddress = !!profile.address_line1.trim();
  const units = weightUnits[draft.unit_system];

  return (
    <div className="space-y-6 pb-24">
      <div className="flex items-center gap-4">
        <Avatar name={biz.name} logo={brand.logo_url} color={brand.primary_color} />
        <h2 className="min-w-0 flex-1 truncate font-display text-2xl font-bold text-slate-900">{biz.name}</h2>
      </div>

      {error && <Err text={error} />}

      <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 shadow-sm">
        <span className={`h-2.5 w-2.5 rounded-full ${left ? 'bg-slate-300' : 'bg-emerald-500'}`} />
        {left ? 'Establishing seller health' : 'Good seller health'}
      </span>

      <div className="overflow-hidden rounded-2xl bg-slate-100">
        <div className="flex items-center gap-3 px-5 py-4">
          {left ? <Lock size={18} className="shrink-0 text-slate-600" /> : <Check size={18} className="shrink-0 text-emerald-600" />}
          <p className="flex-1 text-sm font-semibold text-slate-900">{left ? `${left} step${left > 1 ? 's' : ''} to unlock good seller health` : 'You have unlocked good seller health'}</p>
          <button className="text-sm font-semibold text-slate-900 hover:underline" onClick={() => setModal('benefits')}>
            View benefits
          </button>
        </div>
        <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
          {steps.map((s) => (
            <li key={s.text}>
              <button className={rowBtn} onClick={s.go}>
                {s.done ? (
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
                    <Check size={14} />
                  </span>
                ) : (
                  <span className="h-6 w-6 shrink-0 rounded-full border-2 border-dashed border-slate-400" />
                )}
                <span className={`flex-1 text-sm ${s.done ? 'text-slate-500 line-through' : 'font-medium text-slate-900'}`}>{s.text}</span>
                <ChevronRight size={16} className="text-slate-400" />
              </button>
            </li>
          ))}
        </ul>
      </div>

      <section className="space-y-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Business details</h3>
          <p className="text-sm text-slate-600">Business entity used for financial products, markets and taxes in this shop</p>
        </div>
        <div className={`${card} relative flex items-center gap-4`}>
          <span className="text-3xl leading-none">{flag(profile.country)}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-slate-900">{profile.legal_name.trim() ? profile.legal_name : `${biz.name} - entity`}</p>
            <p className="text-sm text-slate-600">{countryName(profile.country)}</p>
          </div>
          <button aria-label="Business details menu" className="rounded-full p-2 text-slate-600 hover:bg-slate-100" onClick={() => setMenu((v) => !v)}>
            <MoreHorizontal size={18} />
          </button>
          {menu && (
            <>
              <button aria-label="Close menu" className="fixed inset-0 z-10 cursor-default" onClick={() => setMenu(false)} />
              <div className="absolute right-4 top-14 z-20 w-56 rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
                <button
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-50"
                  onClick={() => {
                    setMenu(false);
                    setModal('business');
                  }}
                >
                  <Building2 size={16} /> Edit business details
                </button>
              </div>
            </>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-slate-900">Store contact details</h3>
        <div className={`${card} divide-y divide-slate-100 p-0`}>
          <button className={rowBtn} onClick={() => setModal('contact')}>
            <Store size={20} className="shrink-0 text-slate-700" />
            <span className="min-w-0 flex-1">
              <span className="block font-medium text-slate-900">{biz.name}</span>
              <span className="block break-all text-sm text-slate-600">
                {email} · {biz.phone ? biz.phone : 'No phone number'}
              </span>
            </span>
            <ChevronRight size={16} className="shrink-0 text-slate-400" />
          </button>
          <button className={rowBtn} onClick={() => setModal('address')}>
            <MapPin size={20} className="shrink-0 text-slate-700" />
            <span className="min-w-0 flex-1">
              <span className="block font-medium text-slate-900">Store address</span>
              <span className="block text-sm text-slate-600">{hasAddress ? address : 'Add your store address'}</span>
            </span>
            <ChevronRight size={16} className="shrink-0 text-slate-400" />
          </button>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-slate-900">Store defaults</h3>
        <div className={card}>
          <p className="font-medium text-slate-900">Currency display</p>
          <p className="mt-1 text-sm text-slate-600">
            To manage the currencies customers see, go to{' '}
            <button className="underline" onClick={() => onGo('markets')}>
              Markets
            </button>
          </p>
          <span className="mt-3 inline-block rounded-lg bg-slate-100 px-3 py-1 text-sm text-slate-800">Nigerian Naira (NGN ₦)</span>
        </div>
        <div className={`${card} space-y-4`}>
          <div>
            <label className={label}>Backup region</label>
            <CountrySelect value={draft.backup_region} onChange={(c) => setDraft({ ...draft, backup_region: c })} />
            <p className="mt-1 text-xs text-slate-500">Determines settings for customers outside of your markets</p>
          </div>
          <div>
            <label className={label}>Unit system</label>
            <select
              className={field}
              value={draft.unit_system}
              onChange={(e) => {
                const u = e.target.value as UnitSystem;
                setDraft({ ...draft, unit_system: u, weight_unit: weightUnits[u][0].v });
              }}
            >
              <option value="metric">Metric system</option>
              <option value="imperial">Imperial system</option>
            </select>
          </div>
          <div>
            <label className={label}>Default weight unit</label>
            <select className={field} value={draft.weight_unit} onChange={(e) => setDraft({ ...draft, weight_unit: e.target.value as WeightUnit })}>
              {units.map((u) => (
                <option key={u.v} value={u.v}>
                  {u.t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={label}>Time zone</label>
            <select className={field} value={draft.timezone} onChange={(e) => setDraft({ ...draft, timezone: e.target.value })}>
              {zones.map((z) => (
                <option key={z.value} value={z.value}>
                  {z.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-500">Sets the time for when orders and analytics are recorded</p>
          </div>
        </div>
        <p className="text-sm text-slate-600">
          To change your own name and phone number visit your{' '}
          <button className="underline" onClick={() => setScreen('account')}>
            account settings
          </button>
        </p>
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Order ID format</h3>
          <p className="text-sm text-slate-600">Shown on the order page, customer pages, and customer order notifications to identify order</p>
        </div>
        <div className={`${card} space-y-4`}>
          <div>
            <label className={label}>Prefix</label>
            <input className={field} value={draft.order_prefix} maxLength={15} onChange={(e) => setDraft({ ...draft, order_prefix: e.target.value })} />
          </div>
          <div>
            <label className={label}>Suffix</label>
            <input className={field} value={draft.order_suffix} maxLength={15} onChange={(e) => setDraft({ ...draft, order_suffix: e.target.value })} />
          </div>
          <p className="text-sm text-slate-700">Your order ID will appear as {orderPreview(draft)}</p>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold text-slate-900">Order processing</h3>
          <button aria-label="About order processing" className="text-slate-500 hover:text-slate-800" onClick={() => setInfo((v) => !v)}>
            <Info size={18} />
          </button>
        </div>
        {info && <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">Choose what happens to an order automatically, so you do less by hand.</p>}
        <div className={`${card} space-y-4`}>
          <div>
            <p className="mb-1 text-sm font-medium text-slate-900">After an order has been paid</p>
            <div role="radiogroup" className="space-y-1">
              <Radio on={draft.fulfill_after_paid === 'all'} title="Automatically fulfill the order's line items" onClick={() => setDraft({ ...draft, fulfill_after_paid: 'all' })} />
              <Radio on={draft.fulfill_after_paid === 'none'} title="Don't fulfill any of the order's line items automatically" onClick={() => setDraft({ ...draft, fulfill_after_paid: 'none' })} />
            </div>
          </div>
          <div>
            <p className="mb-1 text-sm font-medium text-slate-900">After an order has been fulfilled and paid, or when all items have been refunded</p>
            <label className="flex cursor-pointer items-start gap-3 rounded-xl p-2 hover:bg-slate-50">
              <input type="checkbox" className="mt-1 h-4 w-4 accent-slate-900" checked={draft.archive_when_done} onChange={(e) => setDraft({ ...draft, archive_when_done: e.target.checked })} />
              <span>
                <span className="block text-sm font-medium text-slate-900">Automatically archive the order</span>
                <span className="block text-sm text-slate-600">The order will be removed from your list of open orders.</span>
              </span>
            </label>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-slate-900">Store assets</h3>
        <div className={`${card} divide-y divide-slate-100 p-0`}>
          <button className={rowBtn} onClick={() => onGo('metafields')}>
            <Database size={20} className="shrink-0 text-slate-700" />
            <span className="min-w-0 flex-1">
              <span className="block font-medium text-slate-900">Metafields</span>
              <span className="block text-sm text-slate-600">Available on your website and configurable for custom content</span>
            </span>
            <ChevronRight size={16} className="shrink-0 text-slate-400" />
          </button>
          <button className={rowBtn} onClick={() => setScreen('brand')}>
            <Palette size={20} className="shrink-0 text-slate-700" />
            <span className="min-w-0 flex-1">
              <span className="block font-medium text-slate-900">Brand</span>
              <span className="block text-sm text-slate-600">Your logo, colours and description for your website and emails</span>
            </span>
            <ChevronRight size={16} className="shrink-0 text-slate-400" />
          </button>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-slate-900">Resources</h3>
        <div className={`${card} p-0`}>
          <button className={rowBtn} onClick={() => setScreen('activity')}>
            <History size={20} className="shrink-0 text-slate-700" />
            <span className="flex-1 font-medium text-slate-900">Store activity log</span>
            <ChevronRight size={16} className="shrink-0 text-slate-400" />
          </button>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-slate-900">Transfer store</h3>
        <div className={card}>
          <p className="text-sm text-slate-600">Move this store into an organization or transfer to an external owner.</p>
          {transfer && (
            <p className="mt-2 rounded-lg bg-amber-50 p-2 text-sm text-amber-900">
              Transfer to {transfer.to_email} is waiting to be accepted.
            </p>
          )}
          <button className={`${ghost} mt-4`} onClick={() => setModal('transfer')}>
            Manage
          </button>
        </div>
      </section>

      {(dirty || saved || saveErr) && (
        <div className="sticky bottom-4 z-30 flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-lg">
          <p className={`min-w-0 flex-1 text-sm ${saveErr ? 'text-red-600' : saved ? 'text-emerald-700' : 'text-slate-700'}`}>{saveErr || (saved ? 'Saved.' : 'Unsaved changes')}</p>
          {dirty && (
            <>
              <button
                className={ghost}
                disabled={saving}
                onClick={() => {
                  setDraft(draftOf(profile));
                  setSaveErr('');
                }}
              >
                Discard
              </button>
              <button className={primary} disabled={saving} onClick={saveDraft}>
                {saving ? 'Saving...' : 'Save'}
              </button>
            </>
          )}
        </div>
      )}

      {modal === 'business' && (
        <BusinessModal
          profile={profile}
          onClose={() => setModal(null)}
          onSave={(p) => saveProfile(p, [{ action: 'Updated business details' }])}
        />
      )}
      {modal === 'contact' && <ContactModal biz={biz} email={email} onSave={saveContact} onClose={() => setModal(null)} />}
      {modal === 'address' && <AddressModal profile={profile} onClose={() => setModal(null)} onSave={(p) => saveProfile(p, [{ action: 'Updated store address' }])} />}
      {modal === 'transfer' && <TransferModal biz={biz} transfer={transfer} actor={actor} onClose={() => setModal(null)} onChanged={load} />}
      {modal === 'benefits' && (
        <Modal title="Seller health" onClose={() => setModal(null)}>
          <div className="space-y-3 text-sm text-slate-700">
            <p>Seller health shows how complete and active your store is.</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>Adding your business details makes your store ready for tax and payment setup.</li>
              <li>Your first fulfilled order shows that customers can buy from you and receive what they paid for.</li>
            </ul>
            <p>It updates by itself when you finish each step.</p>
          </div>
          <div className="mt-5 flex justify-end">
            <button className={primary} onClick={() => setModal(null)}>
              Got it
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function AccountLink({ onOpen }: { onOpen: () => void }) {
  return (
    <p className="text-sm text-slate-600">
      To change your own name and phone number visit your{' '}
      <button className="underline" onClick={onOpen}>
        account settings
      </button>
    </p>
  );
}
