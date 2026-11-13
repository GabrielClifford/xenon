export type PrivacyOptions = {
  cookieBanner: boolean;
  cookieMessage: string;
  analytics: boolean;
  requestsPage: boolean;
  doubleOptIn: boolean;
};

export const defaultCookieMessage =
  'We use simple visit counting to understand how our store is used. You can accept or decline.';

export const defaultPrivacy: PrivacyOptions = {
  cookieBanner: false,
  cookieMessage: defaultCookieMessage,
  analytics: true,
  requestsPage: false,
  doubleOptIn: false,
};

export function readPrivacy(raw: unknown): PrivacyOptions {
  const o = raw && typeof raw === 'object' ? (raw as Partial<PrivacyOptions>) : {};
  return {
    cookieBanner: typeof o.cookieBanner === 'boolean' ? o.cookieBanner : defaultPrivacy.cookieBanner,
    cookieMessage:
      typeof o.cookieMessage === 'string' && o.cookieMessage.trim() ? o.cookieMessage : defaultCookieMessage,
    analytics: typeof o.analytics === 'boolean' ? o.analytics : defaultPrivacy.analytics,
    requestsPage: typeof o.requestsPage === 'boolean' ? o.requestsPage : defaultPrivacy.requestsPage,
    doubleOptIn: typeof o.doubleOptIn === 'boolean' ? o.doubleOptIn : defaultPrivacy.doubleOptIn,
  };
}

export const requestKinds: { v: 'access' | 'delete' | 'marketing' | 'other'; t: string }[] = [
  { v: 'access', t: 'Get a copy of my information' },
  { v: 'delete', t: 'Delete my information' },
  { v: 'marketing', t: 'Stop marketing messages' },
  { v: 'other', t: 'Something else' },
];

// Where your Xenon data is stored. Your Supabase project's region is shown in its project settings.
// Write it here, for example 'Europe (Frankfurt)' or 'United States (East)'.
export const HOSTING_LOCATION = '';