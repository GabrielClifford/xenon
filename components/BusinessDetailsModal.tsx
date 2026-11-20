'use client';

// The full "Edit business details" screen: business type, entity details, address, phone,
// extra business information, optional fields and the People list.
import { useEffect, useState } from 'react';
import { Building2, Check, ChevronsUpDown, Plus, Search, Trash2, User, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import {
  ageOf,
  blankPerson,
  buildDob,
  businessIdKinds,
  businessTypes,
  countries,
  countryName,
  dialCodes,
  flag,
  isEmail,
  kindLabel,
  months,
  nigerianStates,
  normalizePhone,
  personMissing,
  personRoles,
  readPerson,
  roleName,
  splitDob,
  validPhone,
  type BusinessId,
  type BusinessType,
  type Person,
  type StoreProfile,
} from '@/lib/store/settings';

type Activity = { action: string; detail?: string };
type Props = {
  bizId: string;
  bizName: string;
  profile: StoreProfile;
  onSave: (patch: Partial<StoreProfile>, activity: Activity[]) => Promise<string | null>;
  onClose: () => void;
};
type Dob = { y: string; m: string; d: string };
type Form = {
  country: string;
  type: BusinessType | '';
  legal: string;
  reg: string;
  nickname: string;
  first: string;
  last: string;
  dob: Dob;
  email: string;
  phoneCountry: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  postal: string;
  tax: string;
  website: string;
  ids: BusinessId[];
};

const box = 'w-full rounded-2xl border border-slate-300 bg-white px-4 pb-2 pt-6 text-[15px] text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50';
const plain = 'w-full rounded-2xl border border-slate-300 bg-white px-4 py-3.5 text-[15px] text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100';
const primary = 'rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50';
const ghost = 'rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50';
const circle = 'flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-900 shadow-sm hover:bg-slate-50 disabled:opacity-50';

const MAX_IDS = 10;
const dialCountries = countries.filter((c) => dialCodes[c.code]);

const isBlank = (p: Person) => !p.first_name.trim() && !p.last_name.trim() && !p.email.trim() && !p.phone.trim() && !p.dob && !p.job_title.trim() && !p.ownership.trim();
const personName = (p: Person) => `${p.first_name} ${p.last_name}`.trim();

function initForm(p: StoreProfile, bizName: string): Form {
  let first = p.entity_first_name;
  let last = p.entity_last_name;
  // An older save only kept one legal name: use it to fill the first and last name.
  if (p.business_type === 'individual' && !first && !last && p.legal_name.trim()) {
    const parts = p.legal_name.trim().split(/\s+/);
    first = parts[0] ?? '';
    last = parts.slice(1).join(' ');
  }
  return {
    country: p.country || 'NG',
    type: p.business_type ?? '',
    legal: p.business_type === 'individual' ? '' : p.legal_name,
    reg: p.registration_number,
    nickname: p.entity_nickname || `${bizName} - entity`,
    first,
    last,
    dob: splitDob(p.entity_dob),
    email: p.entity_email,
    phoneCountry: p.entity_phone_country || 'NG',
    phone: p.entity_phone,
    line1: p.entity_line1,
    line2: p.entity_line2,
    city: p.entity_city,
    state: p.entity_state,
    postal: p.entity_postal,
    tax: p.tax_id,
    website: p.website,
    ids: p.business_ids,
  };
}

/* --------------------------------- inputs -------------------------------- */

function TextBox({
  label,
  value,
  onChange,
  max = 200,
  type = 'text',
  inputMode,
  icon,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  max?: number;
  type?: string;
  inputMode?: 'text' | 'email' | 'tel' | 'numeric' | 'url';
  icon?: boolean;
  autoComplete?: string;
}) {
  return (
    <label className="relative block">
      <span className="pointer-events-none absolute left-4 top-2 text-xs text-slate-500">{label}</span>
      {icon && <Search size={18} className="pointer-events-none absolute left-4 top-[1.65rem] text-slate-500" />}
      <input type={type} inputMode={inputMode} autoComplete={autoComplete} maxLength={max} value={value} onChange={(e) => onChange(e.target.value)} className={`${box} ${icon ? 'pl-11' : ''}`} />
    </label>
  );
}

function SelectBox({ label, value, onChange, children }: { label: string; value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <label className="relative block">
      <span className="pointer-events-none absolute left-4 top-2 text-xs text-slate-500">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={`${box} appearance-none pr-10`}>
        {children}
      </select>
      <ChevronsUpDown size={18} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-500" />
    </label>
  );
}

function DobFields({ value, onChange }: { value: Dob; onChange: (d: Dob) => void }) {
  return (
    <div>
      <p className="mb-2 text-base font-semibold text-slate-900">Date of birth</p>
      <div className="grid grid-cols-[1.4fr_1fr_1.2fr] gap-3">
        <div className="relative">
          <select aria-label="Month" value={value.m} onChange={(e) => onChange({ ...value, m: e.target.value })} className={`${plain} appearance-none pr-8`}>
            <option value="">Month</option>
            {months.map((m, i) => (
              <option key={m} value={String(i + 1)}>
                {m}
              </option>
            ))}
          </select>
          <ChevronsUpDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" />
        </div>
        <input aria-label="Day" inputMode="numeric" placeholder="DD" maxLength={2} value={value.d} onChange={(e) => onChange({ ...value, d: e.target.value.replace(/\D/g, '') })} className={plain} />
        <input aria-label="Year" inputMode="numeric" placeholder="YYYY" maxLength={4} value={value.y} onChange={(e) => onChange({ ...value, y: e.target.value.replace(/\D/g, '') })} className={plain} />
      </div>
    </div>
  );
}

function PhoneFields({ country, number, onCountry, onNumber }: { country: string; number: string; onCountry: (c: string) => void; onNumber: (n: string) => void }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="relative">
        <select aria-label="Phone country" value={country} onChange={(e) => onCountry(e.target.value)} className={`${plain} appearance-none pr-8`}>
          {dialCountries.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name} (+{dialCodes[c.code]})
            </option>
          ))}
        </select>
        <ChevronsUpDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" />
      </div>
      <input aria-label="Phone number" inputMode="tel" autoComplete="tel-national" placeholder="Phone number" maxLength={20} value={number} onChange={(e) => onNumber(e.target.value)} className={plain} />
    </div>
  );
}

function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)} className="flex items-center gap-3 py-1 text-[15px] text-slate-900">
      <span className={`relative h-6 w-10 shrink-0 rounded-full transition ${on ? 'bg-slate-900' : 'bg-slate-300'}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? 'left-[1.15rem]' : 'left-0.5'}`} />
      </span>
      {label}
    </button>
  );
}

// Country picker that only shows the flag (the real select sits invisibly on top, so it works everywhere).
function FlagSelect({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="relative flex h-[3.1rem] w-[5.2rem] shrink-0 items-center justify-between rounded-2xl border border-slate-300 bg-white px-3 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100">
      <span className="text-2xl leading-none">{flag(value)}</span>
      <ChevronsUpDown size={16} className="text-slate-500" />
      <select aria-label="Country or region" value={value} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0">
        {countries.map((c) => (
          <option key={c.code} value={c.code}>
            {flag(c.code)} {c.name}
          </option>
        ))}
      </select>
    </div>
  );
}

function TypeSelect({ value, onChange }: { value: BusinessType | ''; onChange: (t: BusinessType) => void }) {
  const [open, setOpen] = useState(false);
  const current = businessTypes.find((t) => t.v === value);
  return (
    <div className="relative min-w-0 flex-1">
      <button type="button" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((v) => !v)} className="flex h-[3.1rem] w-full items-center justify-between gap-2 rounded-2xl border border-slate-300 bg-slate-50 px-4 text-left text-[15px] text-slate-900">
        <span className={`truncate ${current ? '' : 'text-slate-700'}`}>{current ? current.t : 'Select business type'}</span>
        <ChevronsUpDown size={16} className="shrink-0 text-slate-500" />
      </button>
      {open && (
        <>
          <button type="button" aria-label="Close list" className="fixed inset-0 z-10 cursor-default" onClick={() => setOpen(false)} />
          <div role="listbox" className="absolute left-0 right-0 top-full z-20 mt-1 max-h-[60vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
            {businessTypes.map((t) => (
              <div key={t.v}>
                <p className="px-3 pb-1 pt-3 text-lg text-slate-500">{t.t}</p>
                <button
                  type="button"
                  role="option"
                  aria-selected={value === t.v}
                  onClick={() => {
                    onChange(t.v);
                    setOpen(false);
                  }}
                  className={`block w-full rounded-xl px-3 py-2 text-left hover:bg-slate-50 ${value === t.v ? 'bg-slate-50' : ''}`}
                >
                  <span className="block text-lg font-semibold text-slate-900">{t.t === 'Non-profit' ? 'Non-Profit' : t.t}</span>
                  <span className="mt-1 block text-[15px] leading-6 text-slate-700">{t.text}</span>
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function StateField({ country, value, onChange }: { country: string; value: string; onChange: (v: string) => void }) {
  if (country === 'NG') {
    const list = value && !nigerianStates.includes(value) ? [value, ...nigerianStates] : nigerianStates;
    return (
      <SelectBox label="State" value={value} onChange={onChange}>
        <option value="">Select a state</option>
        {list.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </SelectBox>
    );
  }
  return <TextBox label="State / region" value={value} onChange={onChange} max={100} autoComplete="address-level1" />;
}

/* ---------------------------------- people -------------------------------- */

function PersonEditor({ person, country, onCancel, onDone }: { person: Person; country: string; onCancel: () => void; onDone: (p: Person) => void }) {
  const [p, setP] = useState<Person>(person);
  const [dob, setDob] = useState<Dob>(splitDob(person.dob));
  const [err, setErr] = useState('');
  const set = (patch: Partial<Person>) => setP((x) => ({ ...x, ...patch }));

  function done() {
    const email = p.email.trim();
    if (email && !isEmail(email)) return setErr('Enter a valid email address.');
    const phone = normalizePhone(p.phone, p.phone_country);
    if (phone && !validPhone(phone)) return setErr('Enter a valid phone number.');
    let iso = '';
    if (dob.y || dob.m || dob.d) {
      const b = buildDob(dob.y, dob.m, dob.d);
      if (!b) return setErr('Enter a real date of birth.');
      if (ageOf(b) < 18) return setErr('A person must be 18 or older.');
      iso = b;
    }
    let own = p.ownership.trim();
    if (p.role === 'owner' && own) {
      if (!/^\d{1,3}(\.\d{1,2})?$/.test(own) || Number(own) > 100) return setErr('Ownership must be a number from 0 to 100.');
    } else {
      own = '';
    }
    onDone({ ...p, first_name: p.first_name.trim(), last_name: p.last_name.trim(), email, phone, dob: iso, job_title: p.role === 'owner' ? '' : p.job_title.trim(), ownership: own });
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={onCancel}>
      <div role="dialog" aria-modal="true" aria-label="Person details" className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 shadow-xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-lg font-semibold text-slate-900">{personName(person) || roleName(person.role)}</h3>
          <button aria-label="Close" className={circle} onClick={onCancel}>
            <X size={18} />
          </button>
        </div>
        <div className="space-y-4">
          <SelectBox label="Role" value={p.role} onChange={(v) => set({ role: v as Person['role'] })}>
            {personRoles.map((r) => (
              <option key={r.v} value={r.v}>
                {r.t}
              </option>
            ))}
          </SelectBox>
          <TextBox label="First name" value={p.first_name} onChange={(v) => set({ first_name: v })} max={100} autoComplete="off" />
          <TextBox label="Last name" value={p.last_name} onChange={(v) => set({ last_name: v })} max={100} autoComplete="off" />
          <TextBox label="Email" value={p.email} onChange={(v) => set({ email: v })} max={254} type="email" inputMode="email" autoComplete="off" />
          <PhoneFields country={p.phone_country || country} number={p.phone} onCountry={(c) => set({ phone_country: c })} onNumber={(n) => set({ phone: n })} />
          <DobFields value={dob} onChange={setDob} />
          {p.role === 'owner' ? (
            <TextBox label="Ownership (%)" value={p.ownership} onChange={(v) => set({ ownership: v.replace(/[^\d.]/g, '') })} max={6} inputMode="numeric" />
          ) : (
            <TextBox label="Job title" value={p.job_title} onChange={(v) => set({ job_title: v })} max={100} />
          )}
          {err && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{err}</p>}
        </div>
        <div className="mt-5 flex justify-end gap-3">
          <button className={ghost} onClick={onCancel}>
            Cancel
          </button>
          <button className={primary} onClick={done}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

async function syncPeople(bizId: string, before: Person[], after: Person[]): Promise<string | null> {
  const sb = createClient();
  const keep = after.filter((p) => !isBlank(p));
  const gone = before.filter((b) => !keep.some((k) => k.id === b.id)).map((b) => b.id);
  if (gone.length) {
    const { error } = await sb.from('store_people').delete().in('id', gone).eq('business_id', bizId);
    if (error) return error.message;
  }
  for (const p of keep) {
    const row = {
      role: p.role,
      first_name: p.first_name,
      last_name: p.last_name,
      email: p.email,
      phone_country: p.phone_country,
      phone: p.phone,
      dob: p.dob,
      job_title: p.job_title,
      ownership_percent: p.ownership === '' ? null : Number(p.ownership),
    };
    if (p.id.startsWith('new-')) {
      const { error } = await sb.from('store_people').insert({ business_id: bizId, ...row });
      if (error) return error.message;
    } else {
      const old = before.find((b) => b.id === p.id);
      if (old && JSON.stringify(old) === JSON.stringify(p)) continue;
      const { error } = await sb.from('store_people').update(row).eq('id', p.id).eq('business_id', bizId);
      if (error) return error.message;
    }
  }
  return null;
}

/* ---------------------------------- screen -------------------------------- */

export default function BusinessDetailsModal({ bizId, bizName, profile, onSave, onClose }: Props) {
  const [initial] = useState<Form>(() => initForm(profile, bizName));
  const [form, setForm] = useState<Form>(initial);
  const [saved, setSaved] = useState<Person[]>([]); // people as stored
  const [people, setPeople] = useState<Person[]>([]); // people as shown
  const [peopleState, setPeopleState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [peopleErr, setPeopleErr] = useState('');
  const [editing, setEditing] = useState<Person | null>(null);
  const [showOptional, setShowOptional] = useState(!!(initial.tax || initial.website || initial.reg));
  const [idsOpen, setIdsOpen] = useState(false);
  const [idsCountry, setIdsCountry] = useState(initial.country);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const set = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }));
  const individual = form.type === 'individual';
  const entity = form.type === 'company' || form.type === 'nonprofit';

  // The account representative row is always there for companies and non-profits, like in Shopify.
  const withPlaceholder = (list: Person[], country: string): Person[] => (list.some((p) => p.role === 'account_representative') ? list : [blankPerson('account_representative', country), ...list]);

  useEffect(() => {
    let live = true;
    createClient()
      .from('store_people')
      .select('*')
      .eq('business_id', bizId)
      .order('created_at', { ascending: true })
      .then(({ data, error }) => {
        if (!live) return;
        if (error) {
          setPeopleState('error');
          setPeopleErr(/store_people/.test(error.message) ? 'Run business-details.sql in Supabase to manage people.' : error.message);
          setPeople(withPlaceholder([], initial.country));
          return;
        }
        const list = ((data ?? []) as Record<string, unknown>[]).map(readPerson);
        setSaved(list);
        setPeople(withPlaceholder(list, initial.country));
        setPeopleState('ready');
      });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bizId]);

  const dirty =
    JSON.stringify(form) !== JSON.stringify(initial) ||
    (peopleState === 'ready' && JSON.stringify(people.filter((p) => !isBlank(p))) !== JSON.stringify(saved));

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (editing) setEditing(null);
      else if (!dirty && !busy) onClose();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [editing, dirty, busy, onClose]);

  function discard() {
    setForm(initial);
    setPeople(withPlaceholder(saved, initial.country));
    setErr('');
    setIdsOpen(false);
  }

  function changeCountry(c: string) {
    // Keep the phone country in step with the business country until a number has been typed.
    set({ country: c, state: c === form.country ? form.state : '', phoneCountry: form.phone.trim() ? form.phoneCountry : dialCodes[c] ? c : form.phoneCountry });
    setIdsCountry(c);
  }

  function setId(kind: string, value: string) {
    const rest = form.ids.filter((x) => !(x.country === idsCountry && x.kind === kind));
    set({ ids: value ? [...rest, { country: idsCountry, kind, value }] : rest });
  }

  function validate(): { error: string } | { patch: Partial<StoreProfile> } {
    if (!form.type) return { error: 'Choose the type of business you have.' };
    const phone = normalizePhone(form.phone, form.phoneCountry);
    if (phone && !validPhone(phone)) return { error: 'Enter a valid phone number.' };
    if (form.website.trim()) {
      try {
        const u = new URL(/^https?:\/\//i.test(form.website.trim()) ? form.website.trim() : `https://${form.website.trim()}`);
        if (!u.hostname.includes('.')) throw new Error('bad');
      } catch {
        return { error: 'Enter a valid website address.' };
      }
    }
    let legal = form.legal.trim();
    let dob = '';
    let email = form.email.trim();
    if (individual) {
      if (!form.first.trim() || !form.last.trim()) return { error: 'Enter your first and last name.' };
      legal = `${form.first.trim()} ${form.last.trim()}`;
      if (legal.length > 200) return { error: 'The name is too long.' };
      const b = buildDob(form.dob.y, form.dob.m, form.dob.d);
      if (!b) return { error: 'Enter your real date of birth.' };
      if (ageOf(b) < 18) return { error: 'You must be 18 or older.' };
      dob = b;
      if (!isEmail(email)) return { error: 'Enter a valid email address.' };
    } else {
      if (!legal) return { error: 'Enter the registered legal business name.' };
      if (legal.length > 200) return { error: 'The legal business name is too long.' };
      if (form.reg.trim().length > 60) return { error: 'The registration number is too long.' };
      dob = profile.entity_dob;
      email = profile.entity_email;
      const owners = people.filter((p) => p.role === 'owner' && p.ownership !== '').reduce((s, p) => s + Number(p.ownership), 0);
      if (owners > 100.001) return { error: 'Owners cannot hold more than 100% in total.' };
    }
    const patch: Partial<StoreProfile> = {
      country: form.country,
      business_type: form.type,
      legal_name: legal,
      registration_number: individual ? '' : form.reg.trim(),
      entity_nickname: form.nickname.trim() === `${bizName} - entity` ? '' : form.nickname.trim(),
      entity_first_name: individual ? form.first.trim() : profile.entity_first_name,
      entity_last_name: individual ? form.last.trim() : profile.entity_last_name,
      entity_dob: dob,
      entity_email: email,
      entity_phone_country: form.phoneCountry,
      entity_phone: phone,
      entity_line1: form.line1.trim(),
      entity_line2: form.line2.trim(),
      entity_city: form.city.trim(),
      entity_state: form.state.trim(),
      entity_postal: form.postal.trim(),
      tax_id: form.tax.trim(),
      website: form.website.trim() ? (/^https?:\/\//i.test(form.website.trim()) ? form.website.trim() : `https://${form.website.trim()}`) : '',
      business_ids: form.ids.map((x) => ({ ...x, value: x.value.trim() })).filter((x) => x.value).slice(0, MAX_IDS),
    };
    return { patch };
  }

  async function save() {
    setErr('');
    const v = validate();
    if ('error' in v) return setErr(v.error);
    setBusy(true);
    const e = await onSave(v.patch, [{ action: 'Updated business details' }]);
    if (e) {
      setBusy(false);
      return setErr(/entity_|tax_id|business_ids|website|store_profile/.test(e) ? 'Run business-details.sql in Supabase first, then try again.' : e);
    }
    if (entity && peopleState === 'ready') {
      const pe = await syncPeople(bizId, saved, people);
      if (pe) {
        setBusy(false);
        return setErr(`Your business details were saved, but the people list was not: ${pe}`);
      }
    }
    setBusy(false);
    onClose();
  }

  const kinds = businessIdKinds[idsCountry] ?? [];
  const idValue = (kind: string) => form.ids.find((x) => x.country === idsCountry && x.kind === kind)?.value ?? '';

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={() => !dirty && !busy && onClose()}>
      <div role="dialog" aria-modal="true" aria-label="Edit business details" className="flex max-h-[94vh] w-full max-w-xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            {!dirty && <Building2 size={22} className="shrink-0 text-slate-900" />}
            <h3 className="truncate text-xl font-semibold text-slate-900">{dirty ? 'Unsaved changes' : 'Edit business details'}</h3>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button aria-label={dirty ? 'Discard changes' : 'Close'} className={circle} disabled={busy} onClick={dirty ? discard : onClose}>
              <X size={20} />
            </button>
            {dirty && (
              <button aria-label="Save changes" className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-900 text-white hover:bg-slate-700 disabled:opacity-50" disabled={busy} onClick={save}>
                {busy ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <Check size={20} />}
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
          {err && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{err}</p>}

          <h4 className="text-2xl font-semibold text-slate-900">About your business</h4>

          <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-lg text-slate-900">What type of business do you have?</p>
            <div className="flex gap-2">
              <FlagSelect value={form.country} onChange={changeCountry} />
              <TypeSelect value={form.type} onChange={(t) => set({ type: t })} />
            </div>

            {form.type !== '' && (
              <TextBox label="Nickname" value={form.nickname} onChange={(v) => set({ nickname: v })} max={100} />
            )}

            {individual && (
              <>
                <TextBox label="First name" value={form.first} onChange={(v) => set({ first: v })} max={100} autoComplete="given-name" />
                <TextBox label="Last name" value={form.last} onChange={(v) => set({ last: v })} max={100} autoComplete="family-name" />
                <DobFields value={form.dob} onChange={(d) => set({ dob: d })} />
                <TextBox label="Email" value={form.email} onChange={(v) => set({ email: v })} max={254} type="email" inputMode="email" autoComplete="email" />
                <PhoneFields country={form.phoneCountry} number={form.phone} onCountry={(c) => set({ phoneCountry: c })} onNumber={(n) => set({ phone: n })} />
                <TextBox label="Residential address" value={form.line1} onChange={(v) => set({ line1: v })} icon autoComplete="address-line1" />
                <TextBox label="Apartment, suite, etc" value={form.line2} onChange={(v) => set({ line2: v })} autoComplete="address-line2" />
                <TextBox label="City" value={form.city} onChange={(v) => set({ city: v })} max={100} autoComplete="address-level2" />
                <StateField country={form.country} value={form.state} onChange={(v) => set({ state: v })} />
                <TextBox label="Postal code" value={form.postal} onChange={(v) => set({ postal: v })} max={20} autoComplete="postal-code" />
              </>
            )}

            {entity && (
              <>
                <TextBox label="Registered legal business name" value={form.legal} onChange={(v) => set({ legal: v })} />
                <div>
                  <p className="mb-2 border-b border-dotted border-slate-400 pb-0.5 text-base font-semibold text-slate-900 inline-block">Business address</p>
                  <div className="space-y-4">
                    <TextBox label="Address" value={form.line1} onChange={(v) => set({ line1: v })} icon autoComplete="address-line1" />
                    <TextBox label="Apartment, suite, etc" value={form.line2} onChange={(v) => set({ line2: v })} autoComplete="address-line2" />
                    <TextBox label="City" value={form.city} onChange={(v) => set({ city: v })} max={100} autoComplete="address-level2" />
                    <StateField country={form.country} value={form.state} onChange={(v) => set({ state: v })} />
                    <TextBox label="Postal code" value={form.postal} onChange={(v) => set({ postal: v })} max={20} autoComplete="postal-code" />
                  </div>
                </div>
                <PhoneFields country={form.phoneCountry} number={form.phone} onCountry={(c) => set({ phoneCountry: c })} onNumber={(n) => set({ phone: n })} />

                {form.ids.length > 0 && (
                  <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200">
                    {form.ids.map((x) => (
                      <li key={`${x.country}-${x.kind}`} className="flex items-center gap-3 px-4 py-3">
                        <span className="text-xl leading-none">{flag(x.country)}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-xs text-slate-500">{kindLabel(x.country, x.kind)}</span>
                          <span className="block truncate text-[15px] text-slate-900">{x.value}</span>
                        </span>
                        <button aria-label="Remove" className="rounded-full p-2 text-slate-500 hover:bg-slate-100" onClick={() => set({ ids: form.ids.filter((y) => y !== x) })}>
                          <Trash2 size={16} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                <div>
                  <button type="button" className="rounded-full bg-slate-100 px-5 py-3 text-lg font-medium text-slate-900 hover:bg-slate-200" onClick={() => setIdsOpen((v) => !v)}>
                    Add business information
                  </button>
                  {idsOpen && (
                    <div className="mt-2 space-y-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-md">
                      <div className="relative">
                        <select aria-label="Country for business information" value={idsCountry} onChange={(e) => setIdsCountry(e.target.value)} className={`${plain} appearance-none pr-8`}>
                          {countries.map((c) => (
                            <option key={c.code} value={c.code}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                        <ChevronsUpDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" />
                      </div>
                      {kinds.length === 0 ? (
                        <p className="px-1 text-lg text-slate-700">
                          {idsCountry === 'NG' ? 'Nigeria has no extra options. Add your CAC and tax numbers under "Show optional fields". ' : ''}Select another country to see additional information options
                        </p>
                      ) : (
                        kinds.map((k) => <TextBox key={k.code} label={k.label} value={idValue(k.code)} onChange={(v) => (form.ids.length >= MAX_IDS && !idValue(k.code) ? setErr(`You can add up to ${MAX_IDS} items.`) : setId(k.code, v))} max={60} />)
                      )}
                      <div className="flex justify-end">
                        <button className={ghost} onClick={() => setIdsOpen(false)}>
                          Done
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {entity && (
            <section className="space-y-3">
              <div>
                <h4 className="text-2xl font-semibold text-slate-900">People</h4>
                <p className="mt-1 text-lg text-slate-700">Add account representative, all owners, executives and directors</p>
              </div>
              {peopleState === 'loading' && <div className="h-28 animate-pulse rounded-3xl bg-slate-100" />}
              {peopleErr && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{peopleErr}</p>}
              {peopleState !== 'loading' && (
                <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                  <ul className="divide-y divide-slate-100">
                    {people.map((p) => (
                      <li key={p.id} className="flex items-center gap-3 py-3">
                        <button type="button" className="flex min-w-0 flex-1 items-center gap-4 text-left" disabled={peopleState === 'error'} onClick={() => setEditing(p)}>
                          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-pink-500 text-white">
                            <User size={24} />
                          </span>
                          <span className="min-w-0">
                            {personMissing(p) && <span className="mb-0.5 inline-block rounded-full bg-yellow-300 px-3 py-0.5 text-sm font-semibold text-slate-900">Missing info</span>}
                            <span className="block truncate text-lg text-slate-900">{personName(p) || roleName(p.role)}</span>
                            {personName(p) && <span className="block truncate text-sm text-slate-600">{roleName(p.role)}</span>}
                          </span>
                        </button>
                        <button aria-label="Remove person" className="rounded-full p-2 text-slate-700 hover:bg-slate-100" disabled={peopleState === 'error'} onClick={() => setPeople(people.filter((x) => x.id !== p.id))}>
                          <Trash2 size={20} />
                        </button>
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 border-t border-slate-100 pt-4 text-left text-lg font-medium text-slate-900 disabled:opacity-50"
                    disabled={peopleState === 'error' || people.length >= 25}
                    onClick={() => setEditing(blankPerson('owner', form.country))}
                  >
                    <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-slate-900">
                      <Plus size={16} />
                    </span>
                    Add
                  </button>
                </div>
              )}
            </section>
          )}

          {form.type !== '' && (
            <div className="space-y-4">
              <Switch on={showOptional} onChange={setShowOptional} label="Show optional fields" />
              {showOptional && (
                <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                  {entity && <TextBox label={form.country === 'NG' ? 'CAC registration number' : 'Registration number'} value={form.reg} onChange={(v) => set({ reg: v })} max={60} />}
                  <TextBox label={form.country === 'NG' ? 'Tax identification number (TIN)' : 'Tax ID'} value={form.tax} onChange={(v) => set({ tax: v })} max={60} />
                  <TextBox label="Website" value={form.website} onChange={(v) => set({ website: v })} max={200} type="url" inputMode="url" />
                </div>
              )}
            </div>
          )}

          <p className="pb-2 text-xs text-slate-500">
            {form.type ? `Registered in ${countryName(form.country)}. ` : ''}This information is private. It is only used for taxes, payments and compliance, and is never shown to your customers.
          </p>
        </div>
      </div>

      {editing && (
        <PersonEditor
          person={editing}
          country={form.country}
          onCancel={() => setEditing(null)}
          onDone={(p) => {
            setPeople((list) => (list.some((x) => x.id === editing.id) ? list.map((x) => (x.id === editing.id ? p : x)) : [...list, p]));
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}
