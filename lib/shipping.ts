export type Zone = {
  id: string;
  name: string;
  areas: string;
  rate: number;
  freeOver: number;
  minDays: number;
  maxDays: number;
};
export type Profile = { id: string; name: string; categories: string[]; zones: Zone[] };
export type LocalDelivery = {
  enabled: boolean;
  areas: string;
  fee: number;
  freeOver: number;
  minOrder: number;
  eta: string;
};
export type Pickup = { enabled: boolean; address: string; instructions: string; ready: string };
export type MethodKey = 'shipping' | 'local' | 'pickup';
export type MethodSetting = { key: MethodKey; name: string; hidden: boolean };
export type ShippingSettings = {
  enabled: boolean;
  estimates: boolean;
  profiles: Profile[];
  local: LocalDelivery;
  pickup: Pickup;
  methods: MethodSetting[];
};

export const defaultMethods: MethodSetting[] = [
  { key: 'shipping', name: 'Delivery', hidden: false },
  { key: 'local', name: 'Local delivery', hidden: false },
  { key: 'pickup', name: 'Pickup in store', hidden: false },
];

export const defaultShipping: ShippingSettings = {
  enabled: false,
  estimates: false,
  profiles: [{ id: 'general', name: 'General profile', categories: [], zones: [] }],
  local: { enabled: false, areas: '', fee: 0, freeOver: 0, minOrder: 0, eta: '' },
  pickup: { enabled: false, address: '', instructions: '', ready: '' },
  methods: defaultMethods,
};

function obj(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
}
const num = (v: unknown, d = 0) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : d;
};
const str = (v: unknown, d = '') => (typeof v === 'string' ? v : d);

function readZone(raw: unknown, i: number): Zone {
  const r = obj(raw);
  return {
    id: str(r.id, `zone-${i}`),
    name: str(r.name),
    areas: str(r.areas),
    rate: Math.max(0, num(r.rate)),
    freeOver: Math.max(0, num(r.freeOver)),
    minDays: Math.max(0, Math.round(num(r.minDays))),
    maxDays: Math.max(0, Math.round(num(r.maxDays))),
  };
}

function readProfile(raw: unknown, i: number): Profile {
  const r = obj(raw);
  return {
    id: str(r.id, i === 0 ? 'general' : `profile-${i}`),
    name: str(r.name, i === 0 ? 'General profile' : 'Custom profile'),
    categories:
      i > 0 && Array.isArray(r.categories)
        ? (r.categories as unknown[]).filter((x): x is string => typeof x === 'string')
        : [],
    zones: Array.isArray(r.zones) ? (r.zones as unknown[]).map(readZone) : [],
  };
}

export function readShipping(raw: unknown): ShippingSettings {
  const r = obj(raw);
  const profiles =
    Array.isArray(r.profiles) && r.profiles.length > 0
      ? (r.profiles as unknown[]).map(readProfile)
      : defaultShipping.profiles;
  const loc = obj(r.local);
  const pk = obj(r.pickup);

  const keys: MethodKey[] = ['shipping', 'local', 'pickup'];
  const saved = (Array.isArray(r.methods) ? (r.methods as unknown[]).map(obj) : [])
    .filter((m) => keys.includes(m.key as MethodKey))
    .map((m) => ({ key: m.key as MethodKey, name: str(m.name), hidden: !!m.hidden }));
  const methods = [...saved, ...defaultMethods.filter((d) => !saved.some((m) => m.key === d.key))].map((m) => ({
    ...m,
    name: m.name || defaultMethods.find((d) => d.key === m.key)!.name,
  }));

  return {
    enabled: !!r.enabled,
    estimates: !!r.estimates,
    profiles,
    local: {
      enabled: !!loc.enabled,
      areas: str(loc.areas),
      fee: Math.max(0, num(loc.fee)),
      freeOver: Math.max(0, num(loc.freeOver)),
      minOrder: Math.max(0, num(loc.minOrder)),
      eta: str(loc.eta),
    },
    pickup: {
      enabled: !!pk.enabled,
      address: str(pk.address),
      instructions: str(pk.instructions),
      ready: str(pk.ready),
    },
    methods,
  };
}

export function splitAreas(text: string): string[] {
  return text
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function etaText(min: number, max: number): string {
  if (max <= 0) return '';
  if (min <= 0 || min === max) return `${max} working day${max === 1 ? '' : 's'}`;
  return `${min} to ${max} working days`;
}