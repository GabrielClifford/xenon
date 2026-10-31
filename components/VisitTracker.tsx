'use client';

import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

function detectSource(): string {
  const ref = (new URLSearchParams(window.location.search).get('ref') ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '')
    .slice(0, 30);
  const known = ['whatsapp', 'instagram', 'facebook', 'tiktok', 'google'];
  if (ref) return known.includes(ref) ? ref : 'other';

  try {
    if (!document.referrer) return 'direct';
    const host = new URL(document.referrer).hostname.toLowerCase();
    if (host === window.location.hostname) return 'direct';
    if (/(^|\.)(facebook|fb)\.com$/.test(host)) return 'facebook';
    if (/(^|\.)instagram\.com$/.test(host)) return 'instagram';
    if (/(^|\.)tiktok\.com$/.test(host)) return 'tiktok';
    if (/(^|\.)whatsapp\.com$/.test(host) || host === 'wa.me') return 'whatsapp';
    if (/(^|\.)google\.[a-z.]+$/.test(host)) return 'google';
    return 'other';
  } catch {
    return 'direct';
  }
}

export default function VisitTracker({ businessId }: { businessId: string }) {
  useEffect(() => {
    (async () => {
      try {
        const supabase = createClient();

        // Visits from logged-in Xenon accounts (including the owner) are not counted
        const { data } = await supabase.auth.getSession();
        if (data.session) return;

        let visitor = localStorage.getItem('Xenon_vid');
        if (!visitor) {
          visitor = crypto.randomUUID();
          localStorage.setItem('Xenon_vid', visitor);
        }

        // Count each visitor once per site every 30 minutes
        const key = `Xenon_seen_${businessId}`;
        const last = Number(localStorage.getItem(key) || 0);
        if (Date.now() - last < 30 * 60 * 1000) return;
        localStorage.setItem(key, String(Date.now()));

        await supabase
          .from('site_visits')
          .insert({ business_id: businessId, visitor_id: visitor, source: detectSource() });
      } catch {
        // Tracking must never break the website
      }
    })();
  }, [businessId]);

  return null;
}