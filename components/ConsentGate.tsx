'use client';

import { useEffect, useState } from 'react';
import { Cookie } from 'lucide-react';
import VisitTracker from '@/components/VisitTracker';
import { BannerCard, PrefsCard } from '@/components/CookieUI';
import { cookieColors, resolveCookie, type PrivacyOptions } from '@/lib/privacy';

export default function ConsentGate({
  businessId,
  privacy,
  privacyHref,
}: {
  businessId: string;
  privacy: PrivacyOptions;
  privacyHref?: string;
}) {
  const key = `xenon-consent-${businessId}`;
  const [consent, setConsent] = useState<'yes' | 'no' | null | undefined>(undefined);
  const [prefs, setPrefs] = useState(false);
  const [analyticsChoice, setAnalyticsChoice] = useState(false);
  const [preview, setPreview] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);

  useEffect(() => {
    try {
      const v = window.localStorage.getItem(key);
      setConsent(v === 'yes' || v === 'no' ? v : null);
    } catch {
      setConsent(null);
    }
    setPreview(new URLSearchParams(window.location.search).get('cookiepreview') === '1');
  }, [key]);

  // the cart tells us when it is open
  useEffect(() => {
    function onCart(e: Event) {
      setCartOpen(!!(e as CustomEvent<{ open: boolean }>).detail?.open);
    }
    window.addEventListener('xenon-cart', onCart);
    return () => window.removeEventListener('xenon-cart', onCart);
  }, []);

  const c = privacy.cookie;
  const t = resolveCookie(c);
  const colors = cookieColors(c);

  function choose(v: 'yes' | 'no') {
    if (preview) {
      // the owner is only looking, so nothing is saved
      setDismissed(true);
      setPrefs(false);
      return;
    }
    try {
      window.localStorage.setItem(key, v);
    } catch {
      /* storage blocked */
    }
    setConsent(v);
    setPrefs(false);
  }

  function openPrefs() {
    setAnalyticsChoice(consent === 'yes');
    setPrefs(true);
  }

  const track = privacy.analytics && (!privacy.cookieBanner || consent === 'yes');
  const hiddenByCart = cartOpen && !c.inCheckout;
  const showBanner = !dismissed && !prefs && !hiddenByCart && (preview || (privacy.cookieBanner && consent === null));
  const showReopen =
    privacy.cookieBanner && !preview && (consent === 'yes' || consent === 'no') && !prefs && !hiddenByCart;

  const place = {
    center: 'fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4',
    'bottom-full': 'fixed inset-x-0 bottom-0 z-[70]',
    'bottom-center': 'fixed inset-x-3 bottom-3 z-[70] mx-auto max-w-xl',
    'bottom-left': 'fixed bottom-3 left-3 z-[70] w-[calc(100%-1.5rem)] max-w-sm',
    'bottom-right': 'fixed bottom-3 right-3 z-[70] w-[calc(100%-1.5rem)] max-w-sm',
  }[c.position];

  return (
    <>
      {track && <VisitTracker businessId={businessId} />}

      {showBanner && (
        <div className={place}>
          <div className={c.position === 'center' ? 'w-full max-w-md' : ''}>
            <BannerCard
              t={t}
              colors={colors}
              privacyHref={privacyHref}
              flat={c.position === 'bottom-full'}
              onAccept={() => choose('yes')}
              onDecline={() => choose('no')}
              onManage={openPrefs}
            />
          </div>
        </div>
      )}

      {showReopen && (
        <button
          onClick={openPrefs}
          aria-label="Cookie preferences"
          className="fixed bottom-4 left-4 z-[65] flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-lg hover:bg-slate-50"
        >
          <Cookie className="h-5 w-5" />
        </button>
      )}

      {prefs && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md">
            <PrefsCard
              t={t}
              colors={colors}
              analytics={analyticsChoice}
              onToggle={setAnalyticsChoice}
              onAcceptAll={() => choose('yes')}
              onDeclineAll={() => choose('no')}
              onSave={() => choose(analyticsChoice ? 'yes' : 'no')}
              onClose={() => setPrefs(false)}
            />
          </div>
        </div>
      )}
    </>
  );
}