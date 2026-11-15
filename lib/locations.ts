export const PLAN_LOCATION_LIMIT = 10;

export type Address = {
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
};

export type Location = {
  id: string;
  name: string;
  address: Address;
  active: boolean;
  isDefault: boolean;
  storefront: boolean; // show this location on the online store
  fulfillOnline: boolean; // use inventory here to fulfil online orders
  shipping: boolean;
  pickup: boolean;
  localDelivery: boolean;
  pos: boolean;
  posPro: boolean;
};

export function blankLocation(): Location {
  return {
    id: crypto.randomUUID(),
    name: '',
    address: { line1: '', line2: '', city: '', state: '', postalCode: '', country: 'Nigeria' },
    active: true,
    isDefault: false,
    storefront: false,
    fulfillOnline: true,
    shipping: true,
    pickup: false,
    localDelivery: false,
    pos: false,
    posPro: false,
  };
}

const str = (v: unknown, d = '') => (typeof v === 'string' ? v : d);
const bool = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d);

// reads what is saved in businesses.locations_options and fills in anything missing
export function readLocations(raw: unknown): Location[] {
  const list = (raw as { locations?: unknown } | null)?.locations;
  if (!Array.isArray(list)) return [];
  const base = blankLocation();
  const out: Location[] = list.map((x) => {
    const r = (x ?? {}) as Record<string, unknown>;
    const a = (r.address ?? {}) as Record<string, unknown>;
    return {
      id: str(r.id) || crypto.randomUUID(),
      name: str(r.name),
      address: {
        line1: str(a.line1),
        line2: str(a.line2),
        city: str(a.city),
        state: str(a.state),
        postalCode: str(a.postalCode),
        country: str(a.country, base.address.country),
      },
      active: bool(r.active, true),
      isDefault: bool(r.isDefault, false),
      storefront: bool(r.storefront, false),
      fulfillOnline: bool(r.fulfillOnline, true),
      shipping: bool(r.shipping, true),
      pickup: bool(r.pickup, false),
      localDelivery: bool(r.localDelivery, false),
      pos: bool(r.pos, false),
      posPro: bool(r.pos, false) && bool(r.posPro, false),
    };
  });
  // there must be exactly one default location
  const first = out.findIndex((l) => l.isDefault);
  const keep = first >= 0 ? first : Math.max(0, out.findIndex((l) => l.active));
  return out.map((l, i) => (i === keep ? { ...l, isDefault: true, active: true, fulfillOnline: true } : { ...l, isDefault: false }));
}

export function formatAddress(a: Address): string {
  return [a.line1, a.line2, a.city, a.state, a.postalCode, a.country]
    .map((p) => p.trim())
    .filter(Boolean)
    .join(', ');
}

export function hasAddress(a: Address): boolean {
  return !!(a.line1.trim() && a.city.trim() && a.country.trim());
}
export function applyLocations(shippingOptions: any, locations: Location[]): any {
  // If shipping options isn't initialized yet, return it as-is
  if (!shippingOptions) return shippingOptions;
  
  // Apply locations to your shipping rules/options logic here
  return {
    ...shippingOptions,
    locations: locations.map(l => l.name)
  };
}