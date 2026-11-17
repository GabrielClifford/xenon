// Storefront event bus and consent state. Client only.
import type { EventData, EventName, PixelEvent } from './apps';

export type Consent = { analytics: boolean | null; marketing: boolean | null; saleOptOut: boolean };

type Listener = (e: PixelEvent) => void;

const listeners = new Set<Listener>();
const consentListeners = new Set<() => void>();
const history: PixelEvent[] = [];
const MAX_HISTORY = 100;

let consent: Consent = { analytics: null, marketing: null, saleOptOut: false };
let gpcApplied = false;

function applyGpc() {
  if (gpcApplied || typeof navigator === 'undefined') return;
  gpcApplied = true;
  // Honour the browser's Global Privacy Control signal as a data sale opt-out.
  if ((navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true) {
    consent = { ...consent, saleOptOut: true };
  }
}

export function getConsent(): Consent {
  applyGpc();
  return consent;
}

// Call this from your cookie banner once the visitor decides (and again on every
// page load with their saved choice).
export function setPixelConsent(next: Partial<Consent>) {
  applyGpc();
  consent = { ...consent, ...next };
  consentListeners.forEach((fn) => {
    try {
      fn();
    } catch {
      /* ignore */
    }
  });
}

export function onConsent(fn: () => void) {
  consentListeners.add(fn);
  return () => {
    consentListeners.delete(fn);
  };
}

export function onEvent(fn: Listener) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export const getHistory = () => history;

const debug = () => typeof location !== 'undefined' && new URLSearchParams(location.search).has('xenon_debug');

export function track(name: EventName, data: EventData = {}) {
  if (typeof window === 'undefined') return;
  const e: PixelEvent = {
    id: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : String(Date.now()) + Math.random(),
    name,
    timestamp: new Date().toISOString(),
    data: { currency: 'NGN', ...data },
    context: { url: location.href, path: location.pathname, referrer: document.referrer, title: document.title },
  };
  history.push(e);
  if (history.length > MAX_HISTORY) history.shift();
  if (debug()) console.log('[xenon event]', e);
  listeners.forEach((fn) => {
    try {
      fn(e);
    } catch (err) {
      console.error(err);
    }
  });
}
