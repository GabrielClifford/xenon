'use client';

import { useEffect, useState } from 'react';
import VisitTracker from '@/components/VisitTracker';
import type { PrivacyOptions } from '@/lib/privacy';

export default function ConsentGate({ businessId, privacy }: { businessId: string; privacy: PrivacyOptions }) {
  const key = `xenon-consent-${businessId}`;
  const [consent, setConsent] = useState<'yes' | 'no' | null | undefined>(undefined);

  useEffect(() => {
    try {
      const v = window.localStorage.getItem(key);
      setConsent(v === 'yes' || v === 'no' ? v : null);
    } catch {
      setConsent(null);
    }
  }, [key]);

  function choose(v: 'yes' | 'no') {
    try {
      window.localStorage.setItem(key, v);
    } catch {
      /* storage blocked */
    }
    setConsent(v);
  }

  const track = privacy.analytics && (!privacy.cookieBanner || consent === 'yes');

  return (
    <>
      {track && <VisitTracker businessId={businessId} />}
      {privacy.cookieBanner && consent === null && (
        <div className="fixed inset-x-3 bottom-3 z-[70] mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl">
          <p className="text-sm text-slate-700">{privacy.cookieMessage}</p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => choose('yes')}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
            >
              Accept
            </button>
            <button
              onClick={() => choose('no')}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Decline
            </button>
          </div>
        </div>
      )}
    </>
  );
}