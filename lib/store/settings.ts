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
};

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
};

const str = (v: unknown, d: string) => (typeof v === 'string' ? v : d);
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
  };
}

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
