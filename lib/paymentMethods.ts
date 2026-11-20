/* eslint-disable @typescript-eslint/no-explicit-any */

export type ProviderId = 'paystack' | 'flutterwave';

export type ProviderConn = { id: ProviderId; publicKey: string; active: boolean };

export type CustomMethod = {
  id: string;
  name: string;
  kind: 'manual' | 'offsite'; // manual = instructions only, offsite = opens a payment link
  base: 'cod' | 'transfer'; // how the order is recorded: pay on delivery, or pay before delivery
  instructions: string;
  link: string; // https payment link (offsite only)
  active: boolean;
};

export type PaymentsConfig = {
  cod: boolean; // pay on delivery
  transfer: boolean; // bank transfer (details live in the bank_* columns)
  providers: ProviderConn[];
  methods: CustomMethod[];
  capture: 'checkout';
};

export const defaultPayments: PaymentsConfig = { cod: true, transfer: true, providers: [], methods: [], capture: 'checkout' };

export const MAX_METHODS = 10;

/* ---------- provider catalog ---------- */

export type ProviderInfo = {
  id: ProviderId | 'monnify' | 'interswitch' | 'stripe';
  name: string;
  available: boolean;
  methods: string[];
  blurb: string;
  keyLabel?: string;
  keyHint?: string;
  keyExample?: string;
};

export const PROVIDERS: ProviderInfo[] = [
  {
    id: 'paystack', name: 'Paystack', available: true, methods: ['Cards', 'Bank transfer', 'USSD'],
    blurb: 'Customers pay in a secure Paystack window. The money goes straight to your Paystack account.',
    keyLabel: 'Paystack public key', keyHint: 'Find it in your Paystack dashboard under Settings, API Keys & Webhooks.', keyExample: 'pk_live_...',
  },
  {
    id: 'flutterwave', name: 'Flutterwave', available: true, methods: ['Cards', 'Bank transfer', 'USSD', 'Mobile money'],
    blurb: 'Customers pay in a secure Flutterwave window. The money goes straight to your Flutterwave account.',
    keyLabel: 'Flutterwave public key', keyHint: 'Find it in your Flutterwave dashboard under Settings, API Keys.', keyExample: 'FLWPUBK-...-X',
  },
  { id: 'monnify', name: 'Monnify', available: false, methods: ['Cards'], blurb: 'Coming soon.' },
  { id: 'interswitch', name: 'Interswitch', available: false, methods: ['Cards'], blurb: 'Coming soon.' },
  { id: 'stripe', name: 'Stripe', available: false, methods: ['Cards'], blurb: 'Coming soon.' },
];

export const providerName = (id: string) => PROVIDERS.find((p) => p.id === id)?.name ?? id;

const KEY_PATTERNS: Record<ProviderId, RegExp> = {
  paystack: /^pk_(test|live)_[A-Za-z0-9]{10,100}$/,
  flutterwave: /^FLWPUBK(_TEST)?-[A-Za-z0-9]{8,100}-X$/,
};

export const looksSecret = (key: string) => /^sk_/i.test(key) || /FLWSECK/i.test(key);
export const isValidKey = (id: ProviderId, key: string) => KEY_PATTERNS[id].test(key);
export const isTestKey = (key: string) => /^pk_test_/.test(key) || /^FLWPUBK_TEST/.test(key);
export const isHttps = (url: string) => {
  try {
    return new URL(url).protocol === 'https:';
  } catch {
    return false;
  }
};

/* ---------- reading what is saved ---------- */

const str = (v: unknown, max = 500) => (typeof v === 'string' ? v.slice(0, max) : '');

export function readPayments(raw: unknown): PaymentsConfig {
  const r = (raw ?? {}) as Record<string, unknown>;
  const providers: ProviderConn[] = [];
  if (Array.isArray(r.providers)) {
    for (const x of r.providers) {
      const p = (x ?? {}) as Record<string, unknown>;
      const id = p.id === 'paystack' || p.id === 'flutterwave' ? p.id : null;
      const key = str(p.publicKey, 120).trim();
      if (id && isValidKey(id, key) && !providers.some((q) => q.id === id)) {
        providers.push({ id, publicKey: key, active: p.active === true });
      }
    }
  }
  const methods: CustomMethod[] = [];
  if (Array.isArray(r.methods)) {
    for (const x of r.methods.slice(0, MAX_METHODS)) {
      const m = (x ?? {}) as Record<string, unknown>;
      const kind = m.kind === 'offsite' ? 'offsite' : 'manual';
      const link = str(m.link);
      if (kind === 'offsite' && !isHttps(link)) continue;
      methods.push({
        id: str(m.id, 60) || crypto.randomUUID(),
        name: str(m.name, 40),
        kind,
        base: m.base === 'transfer' ? 'transfer' : 'cod',
        instructions: str(m.instructions),
        link: kind === 'offsite' ? link : '',
        active: m.active !== false,
      });
    }
  }
  return {
    cod: r.cod !== false,
    transfer: r.transfer !== false,
    providers,
    methods: methods.filter((m) => m.name.trim()),
    capture: 'checkout',
  };
}

/* ---------- what the customer sees at checkout ---------- */

export type PayOption = {
  key: string;
  label: string;
  kind: 'cod' | 'transfer' | 'provider' | 'custom';
  base: 'cod' | 'transfer';
  provider?: ProviderConn;
  method?: CustomMethod;
};

export function buildPayOptions(cfg: PaymentsConfig | undefined, hasBank: boolean, fallback = true): PayOption[] {
  const c = cfg ?? defaultPayments;
  const out: PayOption[] = [];
  for (const p of c.providers) {
    if (p.active) out.push({ key: `p:${p.id}`, label: `Pay online with ${providerName(p.id)}`, kind: 'provider', base: 'transfer', provider: p });
  }
  if (c.cod) out.push({ key: 'cod', label: 'Pay on delivery', kind: 'cod', base: 'cod' });
  if (c.transfer && hasBank) out.push({ key: 'transfer', label: 'Bank transfer', kind: 'transfer', base: 'transfer' });
  for (const m of c.methods) {
    if (m.active) out.push({ key: `m:${m.id}`, label: m.name, kind: 'custom', base: m.base, method: m });
  }
  // a store should never end up with no way to pay
  if (out.length === 0 && fallback) out.push({ key: 'cod', label: 'Pay on delivery', kind: 'cod', base: 'cod' });
  return out;
}

/* ---------- provider payment windows (public keys only) ---------- */

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('script failed'));
    document.head.appendChild(s);
  });
}

export type PayMeta = { email: string; phone: string; name: string; amount: number; ref: string };

// Opens the provider's own payment window. This does NOT prove the money arrived:
// the business should confirm the reference in the provider dashboard.
export async function payWithProvider(p: ProviderConn, o: PayMeta): Promise<'paid' | 'closed' | 'error'> {
  try {
    if (p.id === 'paystack') {
      await loadScript('https://js.paystack.co/v1/inline.js');
      return await new Promise((resolve) => {
        const handler = (window as any).PaystackPop.setup({
          key: p.publicKey,
          email: o.email,
          amount: Math.round(o.amount * 100),
          currency: 'NGN',
          ref: o.ref,
          callback: () => resolve('paid'),
          onClose: () => resolve('closed'),
        });
        handler.openIframe();
      });
    }
    await loadScript('https://checkout.flutterwave.com/v3.js');
    return await new Promise((resolve) => {
      let done = false;
      (window as any).FlutterwaveCheckout({
        public_key: p.publicKey,
        tx_ref: o.ref,
        amount: o.amount,
        currency: 'NGN',
        customer: { email: o.email, phone_number: o.phone, name: o.name },
        callback: (r: any) => {
          done = true;
          resolve(r?.status === 'successful' || r?.status === 'completed' ? 'paid' : 'closed');
        },
        onclose: () => {
          if (!done) resolve('closed');
        },
      });
    });
  } catch {
    return 'error';
  }
}
