// Shared helpers for the General settings page (and for anything that needs
// the store's defaults, such as the order ID format).

export type BusinessType = 'individual' | 'company' | 'nonprofit';
export type UnitSystem = 'metric' | 'imperial';
export type WeightUnit = 'kg' | 'g' | 'lb' | 'oz';

export type StoreProfile = {
  business_type: BusinessType | null;
  legal_name: string;
  registration_number: string;
  country: string;
  contact_email: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  postal_code: string;
  backup_region: string;
  unit_system: UnitSystem;
  weight_unit: WeightUnit;
  timezone: string;
  order_prefix: string;
  order_suffix: string;
  fulfill_after_paid: 'all' | 'none';
  archive_when_done: boolean;
  // Business entity (the "Edit business details" screen)
  entity_nickname: string;
  entity_first_name: string;
  entity_last_name: string;
  entity_dob: string; // YYYY-MM-DD or ''
  entity_email: string;
  entity_phone_country: string;
  entity_phone: string; // digits only, without the country code
  entity_line1: string;
  entity_line2: string;
  entity_city: string;
  entity_state: string;
  entity_postal: string;
  tax_id: string;
  website: string;
  business_ids: BusinessId[];
};

export type BusinessId = { country: string; kind: string; value: string };

export const defaultProfile: StoreProfile = {
  business_type: null,
  legal_name: '',
  registration_number: '',
  country: 'NG',
  contact_email: '',
  address_line1: '',
  address_line2: '',
  city: '',
  state: '',
  postal_code: '',
  backup_region: 'NG',
  unit_system: 'metric',
  weight_unit: 'kg',
  timezone: 'Africa/Lagos',
  order_prefix: '#',
  order_suffix: '',
  fulfill_after_paid: 'none',
  archive_when_done: true,
  entity_nickname: '',
  entity_first_name: '',
  entity_last_name: '',
  entity_dob: '',
  entity_email: '',
  entity_phone_country: 'NG',
  entity_phone: '',
  entity_line1: '',
  entity_line2: '',
  entity_city: '',
  entity_state: '',
  entity_postal: '',
  tax_id: '',
  website: '',
  business_ids: [],
};

const str =(v: unknown, d: string) => (typeof v === 'string' ? v : d);
const oneOf = <T extends string>(v: unknown, list: readonly T[], d: T): T => (typeof v === 'string' && (list as readonly string[]).includes(v) ? (v as T) : d);

// Turns a database row (or nothing) into a complete, safe profile.
export function readProfile(row: Record<string, unknown> | null | undefined): StoreProfile {
  const r = row ?? {};
  const d = defaultProfile;
  const unit = oneOf<UnitSystem>(r.unit_system, ['metric', 'imperial'], d.unit_system);
  const units = weightUnits[unit].map((u) => u.v);
  return {
    business_type: r.business_type === 'individual' || r.business_type === 'company' || r.business_type === 'nonprofit' ? r.business_type : null,
    legal_name: str(r.legal_name, d.legal_name),
    registration_number: str(r.registration_number, d.registration_number),
    country: str(r.country, d.country),
    contact_email: str(r.contact_email, d.contact_email),
    address_line1: str(r.address_line1, d.address_line1),
    address_line2: str(r.address_line2, d.address_line2),
    city: str(r.city, d.city),
    state: str(r.state, d.state),
    postal_code: str(r.postal_code, d.postal_code),
    backup_region: str(r.backup_region, d.backup_region),
    unit_system: unit,
    weight_unit: oneOf<WeightUnit>(r.weight_unit, units, units[0]),
    timezone: str(r.timezone, d.timezone) || d.timezone,
    order_prefix: str(r.order_prefix, d.order_prefix),
    order_suffix: str(r.order_suffix, d.order_suffix),
    fulfill_after_paid: oneOf(r.fulfill_after_paid, ['all', 'none'] as const, d.fulfill_after_paid),
    archive_when_done: typeof r.archive_when_done === 'boolean' ? r.archive_when_done : d.archive_when_done,
    entity_nickname: str(r.entity_nickname, ''),
    entity_first_name: str(r.entity_first_name, ''),
    entity_last_name: str(r.entity_last_name, ''),
    entity_dob: typeof r.entity_dob === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.entity_dob) ? r.entity_dob : '',
    entity_email: str(r.entity_email, ''),
    entity_phone_country: str(r.entity_phone_country, d.entity_phone_country) || d.entity_phone_country,
    entity_phone: str(r.entity_phone, ''),
    entity_line1: str(r.entity_line1, ''),
    entity_line2: str(r.entity_line2, ''),
    entity_city: str(r.entity_city, ''),
    entity_state: str(r.entity_state, ''),
    entity_postal: str(r.entity_postal, ''),
    tax_id: str(r.tax_id, ''),
    website: str(r.website, ''),
    business_ids: readBusinessIds(r.business_ids),
  };
}

function readBusinessIds(v: unknown): BusinessId[] {
  if (!Array.isArray(v)) return [];
  const out: BusinessId[] = [];
  for (const x of v) {
    if (x && typeof x === 'object') {
      const o = x as Record<string, unknown>;
      if (typeof o.country === 'string' && typeof o.kind === 'string' && typeof o.value === 'string') out.push({ country: o.country, kind: o.kind, value: o.value });
    }
  }
  return out.slice(0, 10);
}

/* ------------------------- business entity helpers ------------------------ */

export type PersonRole = 'account_representative' | 'owner' | 'executive' | 'director';

export const personRoles: { v: PersonRole; t: string }[] = [
  { v: 'account_representative', t: 'Account representative' },
  { v: 'owner', t: 'Owner' },
  { v: 'executive', t: 'Executive' },
  { v: 'director', t: 'Director' },
];
export const roleName = (r: string) => personRoles.find((x) => x.v === r)?.t ?? r;

export type Person = {
  id: string; // 'new-...' until it has been saved
  role: PersonRole;
  first_name: string;
  last_name: string;
  email: string;
  phone_country: string;
  phone: string;
  dob: string;
  job_title: string;
  ownership: string; // percent, as typed
};

export const blankPerson = (role: PersonRole, country: string): Person => ({
  id: `new-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  role,
  first_name: '',
  last_name: '',
  email: '',
  phone_country: country,
  phone: '',
  dob: '',
  job_title: '',
  ownership: '',
});

export function readPerson(row: Record<string, unknown>): Person {
  const s = (v: unknown) => (typeof v === 'string' ? v : '');
  const role = personRoles.some((x) => x.v === row.role) ? (row.role as PersonRole) : 'owner';
  return {
    id: s(row.id),
    role,
    first_name: s(row.first_name),
    last_name: s(row.last_name),
    email: s(row.email),
    phone_country: s(row.phone_country) || 'NG',
    phone: s(row.phone),
    dob: /^\d{4}-\d{2}-\d{2}$/.test(s(row.dob)) ? s(row.dob) : '',
    job_title: s(row.job_title),
    ownership: row.ownership_percent === null || row.ownership_percent === undefined ? '' : String(row.ownership_percent),
  };
}

export const personMissing = (p: Person) => !p.first_name.trim() || !p.last_name.trim() || !isEmail(p.email);

export const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// Returns YYYY-MM-DD for a real calendar date, otherwise null.
export function buildDob(y: string, m: string, d: string): string | null {
  const yy = Number(y);
  const mm = Number(m);
  const dd = Number(d);
  if (!/^\d{4}$/.test(y) || yy < 1900 || !Number.isInteger(mm) || !Number.isInteger(dd)) return null;
  const t = new Date(Date.UTC(yy, mm - 1, dd));
  if (t.getUTCFullYear() !== yy || t.getUTCMonth() !== mm - 1 || t.getUTCDate() !== dd) return null;
  return `${y}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
}

export function splitDob(iso: string): { y: string; m: string; d: string } {
  const x = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return x ? { y: x[1], m: String(Number(x[2])), d: String(Number(x[3])) } : { y: '', m: '', d: '' };
}

export function ageOf(iso: string, now = new Date()): number {
  const x = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!x) return 0;
  let age = now.getFullYear() - Number(x[1]);
  if (now.getMonth() + 1 < Number(x[2]) || (now.getMonth() + 1 === Number(x[2]) && now.getDate() < Number(x[3]))) age -= 1;
  return age;
}

export const dialCodes: Record<string, string> = {
  NG: '234', GH: '233', KE: '254', ZA: '27', EG: '20', MA: '212', TZ: '255', UG: '256', RW: '250', ET: '251', SN: '221', CI: '225', CM: '237',
  BJ: '229', TG: '228', NE: '227', BF: '226', ML: '223', LR: '231', SL: '232', GM: '220', ZM: '260', ZW: '263', BW: '267', NA: '264', AO: '244',
  DZ: '213', TN: '216', GB: '44', IE: '353', FR: '33', DE: '49', ES: '34', IT: '39', NL: '31', BE: '32', PT: '351', SE: '46', NO: '47', DK: '45',
  CH: '41', US: '1', CA: '1', MX: '52', BR: '55', AR: '54', AE: '971', SA: '966', TR: '90', IN: '91', PK: '92', CN: '86', JP: '81', KR: '82',
  SG: '65', MY: '60', PH: '63', ID: '62', AU: '61', NZ: '64',
};

// Keeps digits only, drops a typed country code (+234...) and a leading trunk zero (0803... becomes 803...).
export function normalizePhone(raw: string, country: string): string {
  const t = raw.trim();
  let s = t.replace(/\D/g, '');
  const dial = dialCodes[country] ?? '';
  if (t.startsWith('+') && dial && s.startsWith(dial)) s = s.slice(dial.length);
  return s.replace(/^0+/, '');
}
export const validPhone = (digits: string) => /^\d{6,14}$/.test(digits);
export const showPhone = (country: string, digits: string) => (digits ? `+${dialCodes[country] ?? ''} ${digits}` : '');

// Extra registration details a country can ask for. Nigeria has none beyond the CAC and tax numbers in the optional fields.
export const businessIdKinds: Record<string, { code: string; label: string }[]> = {
  US: [{ code: 'ein', label: 'Employer identification number (EIN)' }],
  GB: [{ code: 'crn', label: 'Company registration number' }, { code: 'vat', label: 'VAT number' }],
  IE: [{ code: 'cro', label: 'Company registration number' }, { code: 'vat', label: 'VAT number' }],
  CA: [{ code: 'bn', label: 'Business number (BN)' }],
  AU: [{ code: 'abn', label: 'Australian business number (ABN)' }],
  IN: [{ code: 'gstin', label: 'GSTIN' }, { code: 'pan', label: 'PAN' }],
  ZA: [{ code: 'cipc', label: 'CIPC registration number' }, { code: 'vat', label: 'VAT number' }],
  GH: [{ code: 'rgd', label: 'Registrar General number' }, { code: 'tin', label: 'Tax identification number (TIN)' }],
  KE: [{ code: 'kra', label: 'KRA PIN' }, { code: 'reg', label: 'Business registration number' }],
  DE: [{ code: 'hrb', label: 'Handelsregister number' }, { code: 'vat', label: 'VAT ID' }],
  FR: [{ code: 'siren', label: 'SIREN number' }, { code: 'vat', label: 'VAT number' }],
  AE: [{ code: 'trn', label: 'Tax registration number (TRN)' }, { code: 'licence', label: 'Trade licence number' }],
};
export const kindLabel = (country: string, code: string) => businessIdKinds[country]?.find((k) => k.code === code)?.label ?? code;

export type StoreBrand = {
  logo_url: string;
  cover_url: string;
  slogan: string;
  short_description: string;
  primary_color: string;
  secondary_color: string;
};

export const defaultBrand: StoreBrand = { logo_url: '', cover_url: '', slogan: '', short_description: '', primary_color: '', secondary_color: '' };

export function readBrand(row: Record<string, unknown> | null | undefined): StoreBrand {
  const r = row ?? {};
  const hex = (v: unknown) => (typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v) ? v : '');
  return {
    logo_url: str(r.logo_url, ''),
    cover_url: str(r.cover_url, ''),
    slogan: str(r.slogan, ''),
    short_description: str(r.short_description, ''),
    primary_color: hex(r.primary_color),
    secondary_color: hex(r.secondary_color),
  };
}

export const businessTypes: { v: BusinessType; t: string; text: string }[] = [
  { v: 'individual', t: 'Individual', text: "Pick this if you're selling products or services under your own name, without any registered business structure." },
  { v: 'company', t: 'Company', text: 'A legally separate entity conducting business activities to generate profit for owners or shareholders, either publicly traded or privately held.' },
  { v: 'nonprofit', t: 'Non-profit', text: 'An organization established primarily for charitable, educational, cultural, or social purposes rather than for profit-making.' },
];

export const countries: { code: string; name: string }[] = [
  ['NG', 'Nigeria'], ['GH', 'Ghana'], ['KE', 'Kenya'], ['ZA', 'South Africa'], ['EG', 'Egypt'], ['MA', 'Morocco'], ['TZ', 'Tanzania'],
  ['UG', 'Uganda'], ['RW', 'Rwanda'], ['ET', 'Ethiopia'], ['SN', 'Senegal'], ['CI', "Côte d'Ivoire"], ['CM', 'Cameroon'], ['BJ', 'Benin'],
  ['TG', 'Togo'], ['NE', 'Niger'], ['BF', 'Burkina Faso'], ['ML', 'Mali'], ['LR', 'Liberia'], ['SL', 'Sierra Leone'], ['GM', 'Gambia'],
  ['ZM', 'Zambia'], ['ZW', 'Zimbabwe'], ['BW', 'Botswana'], ['NA', 'Namibia'], ['AO', 'Angola'], ['DZ', 'Algeria'], ['TN', 'Tunisia'],
  ['GB', 'United Kingdom'], ['IE', 'Ireland'], ['FR', 'France'], ['DE', 'Germany'], ['ES', 'Spain'], ['IT', 'Italy'], ['NL', 'Netherlands'],
  ['BE', 'Belgium'], ['PT', 'Portugal'], ['SE', 'Sweden'], ['NO', 'Norway'], ['DK', 'Denmark'], ['CH', 'Switzerland'], ['US', 'United States'],
  ['CA', 'Canada'], ['MX', 'Mexico'], ['BR', 'Brazil'], ['AR', 'Argentina'], ['AE', 'United Arab Emirates'], ['SA', 'Saudi Arabia'], ['TR', 'Türkiye'],
  ['IN', 'India'], ['PK', 'Pakistan'], ['CN', 'China'], ['JP', 'Japan'], ['KR', 'South Korea'], ['SG', 'Singapore'], ['MY', 'Malaysia'],
  ['PH', 'Philippines'], ['ID', 'Indonesia'], ['AU', 'Australia'], ['NZ', 'New Zealand'],
].map(([code, name]) => ({ code, name }));

export const countryName = (code: string) => countries.find((c) => c.code === code)?.name ?? code;

export const flag = (code: string) =>
  /^[A-Za-z]{2}$/.test(code) ? String.fromCodePoint(...[...code.toUpperCase()].map((c) => 127397 + c.charCodeAt(0))) : '';

export const nigerianStates = [
  'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno', 'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu',
  'Federal Capital Territory', 'Gombe', 'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara', 'Lagos', 'Nasarawa', 'Niger',
  'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau', 'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara',
];

export const weightUnits: Record<UnitSystem, { v: WeightUnit; t: string }[]> = {
  metric: [
    { v: 'kg', t: 'Kilogram (kg)' },
    { v: 'g', t: 'Gram (g)' },
  ],
  imperial: [
    { v: 'lb', t: 'Pound (lb)' },
    { v: 'oz', t: 'Ounce (oz)' },
  ],
};

const fallbackZones = ['Africa/Lagos', 'Africa/Accra', 'Africa/Nairobi', 'Africa/Johannesburg', 'Africa/Cairo', 'Europe/London', 'Europe/Paris', 'America/New_York', 'America/Chicago', 'America/Los_Angeles', 'Asia/Dubai', 'Asia/Kolkata', 'Asia/Singapore', 'Australia/Sydney', 'UTC'];

function offsetOf(tz: string): { label: string; minutes: number } {
  try {
    const part = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'longOffset' }).formatToParts(new Date()).find((x) => x.type === 'timeZoneName')?.value ?? 'GMT';
    const m = /GMT([+-])(\d{2}):(\d{2})/.exec(part);
    if (!m) return { label: 'GMT+00:00', minutes: 0 };
    return { label: `GMT${m[1]}${m[2]}:${m[3]}`, minutes: (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) };
  } catch {
    return { label: 'GMT+00:00', minutes: 0 };
  }
}

export function timeZones(current?: string): { value: string; label: string }[] {
  const lister = (Intl as unknown as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf;
  const names = new Set<string>(lister ? lister('timeZone') : fallbackZones);
  names.add('UTC');
  if (current) names.add(current);
  return [...names]
    .map((value) => ({ value, ...offsetOf(value) }))
    .sort((a, b) => a.minutes - b.minutes || a.value.localeCompare(b.value))
    .map((z) => ({ value: z.value, label: `(${z.label}) ${z.value.replace(/_/g, ' ')}` }));
}

export function formatAddress(p: Pick<StoreProfile, 'address_line1' | 'address_line2' | 'city' | 'state' | 'postal_code' | 'country'>): string {
  const town = [p.postal_code, p.city, p.state].filter((x) => x.trim()).join(' ');
  return [p.address_line1, p.address_line2, town, countryName(p.country)].filter((x) => x.trim()).join(', ');
}

// Order IDs: prefix + number + suffix. Numbers start at 1001.
export const ORDER_START = 1001;
export const validOrderAffix = /^[A-Za-z0-9#\-_./ ]{0,15}$/;
export const formatOrderId = (p: Pick<StoreProfile, 'order_prefix' | 'order_suffix'>, n: number) => `${p.order_prefix}${n}${p.order_suffix}`;
export const orderPreview = (p: Pick<StoreProfile, 'order_prefix' | 'order_suffix'>) => [0, 1, 2].map((i) => formatOrderId(p, ORDER_START + i)).join(', ') + ', ...';

export const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s.trim()) && s.trim().length <= 254;

// Anything with a Supabase-style .from(table) works here.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Sb = { from: (table: string) => any };

// Writes one line to the store activity log. Never throws: logging must not break a save.
export async function logActivity(sb: Sb, businessId: string, actor: string, action: string, detail = ''): Promise<void> {
  try {
    await sb.from('store_activity').insert({ business_id: businessId, actor_email: actor.slice(0, 254), action: action.slice(0, 120), detail: detail.slice(0, 500) });
  } catch {
    /* ignore */
  }
}

