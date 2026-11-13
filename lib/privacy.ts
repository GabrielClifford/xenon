export type CookiePosition = 'center' | 'bottom-full' | 'bottom-center' | 'bottom-left' | 'bottom-right';
export type CookieTheme = 'light' | 'dark' | 'custom';

export type CookieTexts = {
  title: string;
  message: string;
  accept: string;
  decline: string;
  manage: string;
  prefsTitle: string;
  prefsText: string;
  necessaryTitle: string;
  necessaryText: string;
  analyticsTitle: string;
  analyticsText: string;
  acceptAll: string;
  declineAll: string;
  save: string;
};

export type CookieSettings = CookieTexts & {
  auto: boolean;
  theme: CookieTheme;
  bg: string;
  text: string;
  button: string;
  position: CookiePosition;
  inCheckout: boolean;
};

export const defaultCookieTexts: CookieTexts = {
  title: 'Cookie consent',
  message:
    'We use cookies and similar technologies to keep our store working and, with your permission, to count visits so we can improve it. You can accept, decline, or choose what you allow.',
  accept: 'Accept',
  decline: 'Decline',
  manage: 'Manage preferences',
  prefsTitle: 'Cookie preferences',
  prefsText: 'Choose which cookies and similar technologies this store may use. You can change your choice at any time.',
  necessaryTitle: 'Strictly necessary',
  necessaryText: 'These keep the store working, for example your cart, signing in and remembering this choice. They are always on.',
  analyticsTitle: 'Analytics',
  analyticsText: 'These count visits and where they come from, so we can see which pages and links work. No advertising.',
  acceptAll: 'Accept all',
  declineAll: 'Decline all',
  save: 'Save my choices',
};

export const defaultCookie: CookieSettings = {
  ...defaultCookieTexts,
  auto: true,
  theme: 'light',
  bg: '#ffffff',
  text: '#0f172a',
  button: '#0f172a',
  position: 'bottom-center',
  inCheckout: false,
};

export type PrivacyOptions = {
  cookieBanner: boolean;
  cookie: CookieSettings;
  analytics: boolean;
  requestsPage: boolean;
  doubleOptIn: boolean;
};

export const defaultPrivacy: PrivacyOptions = {
  cookieBanner: false,
  cookie: defaultCookie,
  analytics: true,
  requestsPage: false,
  doubleOptIn: false,
};

const HEX = /^#[0-9a-fA-F]{6}$/;
const POSITIONS: CookiePosition[] = ['center', 'bottom-full', 'bottom-center', 'bottom-left', 'bottom-right'];
const THEMES: CookieTheme[] = ['light', 'dark', 'custom'];
const OLD_DEFAULT = 'We use simple visit counting to understand how our store is used. You can accept or decline.';

function readCookie(raw: unknown, legacyMessage: unknown): CookieSettings {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const out: CookieSettings = { ...defaultCookie };
  (Object.keys(defaultCookieTexts) as (keyof CookieTexts)[]).forEach((k) => {
    const v = o[k];
    if (typeof v === 'string' && v.trim()) out[k] = v;
  });
  if (typeof o.auto === 'boolean') out.auto = o.auto;
  if (THEMES.includes(o.theme as CookieTheme)) out.theme = o.theme as CookieTheme;
  if (typeof o.bg === 'string' && HEX.test(o.bg)) out.bg = o.bg;
  if (typeof o.text === 'string' && HEX.test(o.text)) out.text = o.text;
  if (typeof o.button === 'string' && HEX.test(o.button)) out.button = o.button;
  if (POSITIONS.includes(o.position as CookiePosition)) out.position = o.position as CookiePosition;
  if (typeof o.inCheckout === 'boolean') out.inCheckout = o.inCheckout;
  // an older version saved only a message
  if (!raw && typeof legacyMessage === 'string' && legacyMessage.trim() && legacyMessage !== OLD_DEFAULT) {
    out.auto = false;
    out.message = legacyMessage;
  }
  return out;
}

export function readPrivacy(raw: unknown): PrivacyOptions {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const b = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d);
  return {
    cookieBanner: b(o.cookieBanner, false),
    cookie: readCookie(o.cookie, o.cookieMessage),
    analytics: b(o.analytics, true),
    requestsPage: b(o.requestsPage, false),
    doubleOptIn: b(o.doubleOptIn, false),
  };
}

// the wording the visitor actually sees
export function resolveCookie(c: CookieSettings): CookieTexts {
  const t = { ...defaultCookieTexts };
  if (c.auto) return t;
  (Object.keys(t) as (keyof CookieTexts)[]).forEach((k) => {
    if (c[k].trim()) t[k] = c[k];
  });
  return t;
}

function lum(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

export function cookieColors(c: CookieSettings) {
  if (c.theme === 'dark') return { bg: '#0f172a', text: '#f8fafc', button: '#f8fafc', buttonText: '#0f172a' };
  if (c.theme === 'custom') {
    return { bg: c.bg, text: c.text, button: c.button, buttonText: lum(c.button) > 0.55 ? '#0f172a' : '#ffffff' };
  }
  return { bg: '#ffffff', text: '#0f172a', button: '#0f172a', buttonText: '#ffffff' };
}
export type CookieColors = ReturnType<typeof cookieColors>;

export const requestKinds: { v: 'access' | 'delete' | 'marketing' | 'other'; t: string }[] = [
  { v: 'access', t: 'Get a copy of my information' },
  { v: 'delete', t: 'Delete my information' },
  { v: 'marketing', t: 'Stop marketing messages' },
  { v: 'other', t: 'Something else' },
];

// Where your Xenon data is stored. Your Supabase project's region is shown in its project settings.
// Write it here, for example 'Europe (Frankfurt)' or 'United States (East)'.
export const HOSTING_LOCATION = 'United States (East) — North Virginia';