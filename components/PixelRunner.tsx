'use client';

import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { bootApp, customSrcdoc, validateApp, type AppKind, type DataSale, type Handler, type Permission, type PixelEvent, type PixelKind } from '@/lib/pixels/apps';
import { getConsent, getHistory, onConsent, onEvent, track } from '@/lib/pixels/track';

type Row = {
  id: string;
  kind: PixelKind;
  name: string;
  config: Record<string, unknown>;
  permission: Permission;
  data_sale: DataSale;
};

let pageViewSent = false;

// Loads the owner's connected pixels and feeds them storefront events.
export default function PixelRunner({ businessId }: { businessId: string }) {
  useEffect(() => {
    let dead = false;
    let rows: Row[] = [];
    const live = new Map<string, (e: PixelEvent) => void>();
    const cleanups: (() => void)[] = [];

    const allowed = (r: Row) => {
      const c = getConsent();
      if (r.data_sale === 'qualifies' && c.saleOptOut) return false;
      const needA = r.permission === 'analytics' || r.permission === 'both';
      const needM = r.permission === 'marketing' || r.permission === 'both';
      if (needA && c.analytics !== true) return false;
      if (needM && c.marketing !== true) return false;
      return true;
    };

    function bootRow(r: Row) {
      if (r.kind === 'custom') {
        const code = typeof r.config.code === 'string' ? r.config.code : '';
        if (!code.trim()) return;
        const f = document.createElement('iframe');
        // No allow-same-origin: the code cannot touch this site, its storage or the dashboard.
        f.setAttribute('sandbox', 'allow-scripts');
        f.setAttribute('aria-hidden', 'true');
        f.tabIndex = -1;
        f.title = 'Pixel';
        f.style.cssText = 'position:absolute;width:0;height:0;border:0;visibility:hidden';
        let ready = false;
        const post = (e: PixelEvent) => f.contentWindow?.postMessage({ __xenon: 1, event: e }, '*');
        const onMsg = (m: MessageEvent) => {
          if (m.source !== f.contentWindow) return;
          const d = m.data as { __xenon?: number; ready?: boolean } | null;
          if (d && d.__xenon === 1 && d.ready && !ready) {
            ready = true;
            getHistory().forEach(post);
          }
        };
        window.addEventListener('message', onMsg);
        f.srcdoc = customSrcdoc(code, r.id);
        document.body.appendChild(f);
        live.set(r.id, (e) => {
          if (ready) post(e);
        });
        cleanups.push(() => {
          window.removeEventListener('message', onMsg);
          f.remove();
        });
        return;
      }

      const err = validateApp(r.kind, r.config);
      if (err) {
        console.warn('Pixel skipped:', r.name, err);
        return;
      }
      const cfg: Record<string, string> = {};
      for (const [k, v] of Object.entries(r.config)) if (typeof v === 'string') cfg[k] = v.trim();
      try {
        const handler: Handler = bootApp(r.kind as AppKind, cfg);
        live.set(r.id, handler);
        getHistory().forEach((e) => {
          try {
            handler(e);
          } catch (x) {
            console.error(x);
          }
        });
      } catch (x) {
        console.error('Pixel failed to start:', r.name, x);
      }
    }

    function sync() {
      if (dead) return;
      for (const r of rows) if (!live.has(r.id) && allowed(r)) bootRow(r);
    }

    cleanups.push(
      onEvent((e) => {
        for (const send of live.values()) {
          try {
            send(e);
          } catch (x) {
            console.error(x);
          }
        }
      })
    );
    cleanups.push(onConsent(sync));

    if (!pageViewSent) {
      pageViewSent = true;
      track('page_viewed');
    }

    createClient()
      .from('customer_pixels')
      .select('id,kind,name,config,permission,data_sale')
      .eq('business_id', businessId)
      .eq('status', 'connected')
      .then(({ data }) => {
        if (dead) return;
        rows = (data ?? []) as Row[];
        sync();
      });

    return () => {
      dead = true;
      cleanups.forEach((fn) => fn());
    };
  }, [businessId]);

  return null;
}
