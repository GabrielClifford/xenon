/* eslint-disable @typescript-eslint/no-explicit-any */

export type ProviderId = 'paystack' | 'flutterwave' | 'monnify' | 'interswitch' | 'remita' | 'squad';
export type Mode = 'test' | 'live';

// publicKey = the main public credential (public key, API key or merchant code)
// extra     = a second public value some providers need (Monnify contract code, Interswitch pay item ID)
export type ProviderConn = { id: ProviderId; publicKey: string; extra: string; mode: Mode; active: boolean };

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

type Field = { label: string; hint: string; example: string };

export type ProviderInfo = {
  id: ProviderId;
  name: string;
  methods: string[];
  blurb: string;
  key: Field;
  extra?: Field; // second credential
  modeSelect?: boolean; // the provider needs an explicit Test / Live choice
};

export const PROVIDERS: ProviderInfo[] = [
  {
    id: 'paystack', name: 'Paystack', methods: ['Cards', 'Bank transfer', 'USSD'],
    blurb: 'Customers pay in a secure Paystack window. The money goes straight to your Paystack account.',
    key: { label: 'Paystack public key', hint: 'Dashboard, Settings, API Keys & Webhooks.', example: 'pk_live_...' },
  },
  {
    id: 'flutterwave', name: 'Flutterwave', methods: ['Cards', 'Bank transfer', 'USSD', 'Mobile money'],
    blurb: 'Customers pay in a secure Flutterwave window. The money goes straight to your Flutterwave account.',
    key: { label: 'Flutterwave public key', hint: 'Dashboard, Settings, API Keys.', example: 'FLWPUBK-...-X' },
  },
  {
    id: 'monnify', name: 'Monnify', methods: ['Cards', 'Bank transfer', 'USSD'],
    blurb: 'Customers pay in the Monnify checkout window. The money goes straight to your Monnify account.',
    key: { label: 'Monnify API key', hint: 'Monnify dashboard, Developer, API Keys. Starts with MK_TEST_ or MK_PROD_. This is the API key, not the secret key.', example: 'MK_PROD_...' },
    extra: { label: 'Monnify contract code', hint: 'On the same Developer page. It is a number.', example: '1234567890' },
  },
  {
    id: 'interswitch', name: 'Interswitch WebPay', methods: ['Cards'],
    blurb: 'Customers pay in the Interswitch WebPay window. The money goes straight to your Interswitch merchant account.',
    key: { label: 'Merchant code', hint: 'From your Interswitch Business Console. It looks like MX123456.', example: 'MX123456' },
    extra: { label: 'Pay item ID', hint: 'From the same console, under your payment item.', example: 'Default_Payable_MX123456' },
    modeSelect: true,
  },
  {
    id: 'remita', name: 'Remita', methods: ['Cards'],
    blurb: 'Customers pay in the Remita window. The money goes straight to your Remita account.',
    key: { label: 'Remita public key', hint: 'Remita dashboard, API keys. It is a long text. Use the public key, not the secret key.', example: 'QzAwMDAy...' },
    modeSelect: true,
  },
  {
    id: 'squad', name: 'Squad', methods: ['Cards', 'Bank transfer', 'USSD'],
    blurb: 'Customers pay in the Squad checkout window. The money goes straight to your Squad account.',
    key: { label: 'Squad public key', hint: 'Squad dashboard, Settings, API & Webhooks. Use the sandbox key to test.', example: 'sandbox_pk_...' },
  },
];

export const providerName = (id: string) => PROVIDERS.find((p) => p.id === id)?.name ?? id;

const PATTERNS: Record<ProviderId, { key: RegExp; extra?: RegExp }> = {
  paystack: { key: /^pk_(test|live)_[A-Za-z0-9]{10,100}$/ },
  flutterwave: { key: /^FLWPUBK(_TEST)?-[A-Za-z0-9]{8,100}-X$/ },
  monnify: { key: /^MK_(TEST|PROD)_[A-Za-z0-9]{6,60}$/, extra: /^\d{4,20}$/ },
  interswitch: { key: /^[A-Za-z0-9_-]{3,30}$/, extra: /^[A-Za-z0-9_-]{3,60}$/ },
  remita: { key: /^[A-Za-z0-9+/=_-]{20,600}$/ },
  squad: { key: /^[A-Za-z0-9_-]{10,150}$/ },
};

// secret keys must never be saved: they would be visible to anyone who opens the store
export const looksSecret = (v: string) => /^sk_/i.test(v) || /_sk_/i.test(v) || /FLWSECK/i.test(v) || /secret/i.test(v);

// returns an error message, or '' when the credentials look right
export function validateProvider(id: ProviderId, v: { publicKey: string; extra: string; mode: Mode }): string {
  const info = PROVIDERS.find((p) => p.id === id)!;
  const pat = PATTERNS[id];
  if (looksSecret(v.publicKey) || looksSecret(v.extra)) return 'that looks like a secret key. Never paste a secret key here';
  if (!pat.key.test(v.publicKey.trim())) return `enter a valid ${info.key.label.toLowerCase()}`;
  if (info.extra && !pat.extra!.test(v.extra.trim())) return `enter a valid ${info.extra.label.toLowerCase()}`;
  return '';
}

export function isTestConn(p: Pick<ProviderConn, 'id' | 'publicKey' | 'mode'>): boolean {
  if (p.id === 'paystack') return /^pk_test_/.test(p.publicKey);
  if (p.id === 'flutterwave') return /^FLWPUBK_TEST/.test(p.publicKey);
  if (p.id === 'monnify') return /^MK_TEST_/.test(p.publicKey);
  if (p.id === 'squad') return /test|sandbox/i.test(p.publicKey);
  return p.mode === 'test';
}

export const isHttps = (url: string) => {
  try {
    return new URL(url).protocol === 'https:';
  } catch {
    return false;
  }
};

/* ---------- reading what is saved ---------- */

const str = (v: unknown, max = 500) => (typeof v === 'string' ? v.slice(0, max) : '');
const IDS = PROVIDERS.map((p) => p.id) as string[];

export function readPayments(raw: unknown): PaymentsConfig {
  const r = (raw ?? {}) as Record<string, unknown>;
  const providers: ProviderConn[] = [];
  if (Array.isArray(r.providers)) {
    for (const x of r.providers) {
      const p = (x ?? {}) as Record<string, unknown>;
      const id = typeof p.id === 'string' && IDS.includes(p.id) ? (p.id as ProviderId) : null;
      if (!id) continue;
      const conn = {
        publicKey: str(p.publicKey, 620).trim(),
        extra: str(p.extra, 80).trim(),
        mode: (p.mode === 'live' ? 'live' : 'test') as Mode,
      };
      if (validateProvider(id, conn) || providers.some((q) => q.id === id)) continue;
      providers.push({ id, ...conn, active: p.active === true });
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

/* ---------- provider payment windows (public credentials only) ---------- */

// Remita expects a numeric transaction id; the others accept text
export const makeRef = (id: ProviderId) => (id === 'remita' ? String(Date.now()) : `XN-${Date.now().toString(36).toUpperCase()}`);

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
type Outcome = 'paid' | 'closed' | 'error';

// Opens the provider's own payment window. This does NOT prove the money arrived:
// the business should confirm the reference in the provider dashboard.
export async function payWithProvider(p: ProviderConn, o: PayMeta): Promise<Outcome> {
  const w = window as any;
  const kobo = Math.round(o.amount * 100);
  const [first, ...rest] = o.name.trim().split(/\s+/);
  const last = rest.join(' ') || first || 'Customer';
  try {
    switch (p.id) {
      case 'paystack':
        await loadScript('https://js.paystack.co/v1/inline.js');
        return await new Promise<Outcome>((resolve) => {
          w.PaystackPop.setup({
            key: p.publicKey, email: o.email, amount: kobo, currency: 'NGN', ref: o.ref,
            callback: () => resolve('paid'),
            onClose: () => resolve('closed'),
          }).openIframe();
        });

      case 'flutterwave':
        await loadScript('https://checkout.flutterwave.com/v3.js');
        return await new Promise<Outcome>((resolve) => {
          let done = false;
          w.FlutterwaveCheckout({
            public_key: p.publicKey, tx_ref: o.ref, amount: o.amount, currency: 'NGN',
            customer: { email: o.email, phone_number: o.phone, name: o.name },
            callback: (r: any) => {
              done = true;
              resolve(r?.status === 'successful' || r?.status === 'completed' ? 'paid' : 'closed');
            },
            onclose: () => { if (!done) resolve('closed'); },
          });
        });

      case 'monnify':
        await loadScript('https://sdk.monnify.com/plugin/monnify.js');
        return await new Promise<Outcome>((resolve) => {
          let done = false;
          w.MonnifySDK.initialize({
            amount: o.amount, currency: 'NGN', reference: o.ref,
            customerFullName: o.name, customerEmail: o.email, customerMobileNumber: o.phone,
            apiKey: p.publicKey, contractCode: p.extra, paymentDescription: `Order ${o.ref}`,
            isTestMode: /^MK_TEST_/.test(p.publicKey),
            onComplete: (r: any) => {
              done = true;
              const s = String(r?.paymentStatus ?? r?.status ?? '').toUpperCase();
              resolve(s === 'PAID' || s === 'OVERPAID' || s === 'SUCCESS' ? 'paid' : 'closed');
            },
            onClose: () => { if (!done) resolve('closed'); },
          });
        });

      case 'interswitch':
        await loadScript(
          p.mode === 'live'
            ? 'https://newwebpay.interswitchng.com/inline-checkout.js'
            : 'https://newwebpay-sandbox.interswitchng.com/inline-checkout.js'
        );
        return await new Promise<Outcome>((resolve) => {
          w.webpayCheckout({
            merchant_code: p.publicKey, pay_item_id: p.extra, txn_ref: o.ref, amount: kobo, currency: 566,
            cust_email: o.email, cust_name: o.name,
            onComplete: (r: any) => resolve(r?.resp === '00' ? 'paid' : 'closed'),
            mode: p.mode === 'live' ? 'LIVE' : 'TEST',
          });
        });

      case 'remita':
        await loadScript(
          p.mode === 'live'
            ? 'https://login.remita.net/payment/v1/remita-pay-inline.bundle.js'
            : 'https://remitademo.net/payment/v1/remita-pay-inline.bundle.js'
        );
        return await new Promise<Outcome>((resolve) => {
          let done = false;
          const engine = w.RmPaymentEngine.init({
            key: p.publicKey, transactionId: o.ref, customerId: o.email, email: o.email,
            firstName: first || 'Customer', lastName: last, amount: o.amount, narration: `Order payment ${o.ref}`,
            onSuccess: () => { done = true; resolve('paid'); },
            onError: () => resolve('closed'),
            onClose: () => { if (!done) resolve('closed'); },
          });
          engine.showPaymentWidget();
        });

      case 'squad':
        await loadScript('https://checkout.squadco.com/widget/squad.min.js');
        return await new Promise<Outcome>((resolve) => {
          let done = false;
          const s = new w.squad({
            key: p.publicKey, email: o.email, amount: kobo, currency_code: 'NGN', transaction_ref: o.ref,
            onSuccess: () => { done = true; resolve('paid'); },
            onClose: () => { if (!done) resolve('closed'); },
            onLoad: () => undefined,
          });
          s.setup();
          s.open();
        });
    }
  } catch {
    return 'error';
  }
}
