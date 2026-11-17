// Pixel definitions, validation and the code that boots each pixel.
// Used by the dashboard (to build forms) and by the live site (to run pixels).

export type PixelKind = 'custom' | 'ga4' | 'meta' | 'tiktok' | 'google_ads' | 'clarity';
export type AppKind = Exclude<PixelKind, 'custom'>;
export type Permission = 'none' | 'analytics' | 'marketing' | 'both';
export type DataSale = 'qualifies' | 'not';

export type Line = { id: string; title: string; price: number; quantity: number; category?: string };
export type EventName =
  | 'page_viewed'
  | 'product_viewed'
  | 'product_added_to_cart'
  | 'checkout_started'
  | 'checkout_completed'
  | 'search_submitted';

export type EventData = {
  product?: Line;
  items?: Line[];
  total?: number;
  orderId?: string;
  query?: string;
  currency?: string;
};

export type PixelEvent = {
  id: string;
  name: EventName;
  timestamp: string;
  data: EventData;
  context: { url: string; path: string; referrer: string; title: string };
};

export const eventList: { name: EventName; text: string; fields: string }[] = [
  { name: 'page_viewed', text: 'A visitor opens your website', fields: 'context.url, context.title, context.referrer' },
  { name: 'product_viewed', text: 'A visitor looks at a product', fields: 'data.product (id, title, price, category)' },
  { name: 'product_added_to_cart', text: 'A visitor adds a product to the cart', fields: 'data.product (with quantity)' },
  { name: 'checkout_started', text: 'A visitor starts checkout', fields: 'data.items, data.total' },
  { name: 'checkout_completed', text: 'A visitor places an order', fields: 'data.orderId, data.items, data.total' },
  { name: 'search_submitted', text: 'A visitor searches', fields: 'data.query' },
];

export type AppField = {
  key: string;
  label: string;
  placeholder: string;
  help: string;
  pattern: RegExp;
  required: boolean;
  upper?: boolean;
};

export type AppDef = {
  kind: AppKind;
  name: string;
  group: string;
  blurb: string;
  permission: Permission;
  fields: AppField[];
};

export const apps: AppDef[] = [
  {
    kind: 'ga4',
    name: 'Google Analytics 4',
    group: 'Analytics',
    blurb: 'See visits, product views and orders in Google Analytics.',
    permission: 'analytics',
    fields: [
      {
        key: 'measurement_id',
        label: 'Measurement ID',
        placeholder: 'G-XXXXXXXXXX',
        help: 'In Google Analytics open Admin, then Data streams, and copy the Measurement ID.',
        pattern: /^G-[A-Z0-9]{6,12}$/,
        required: true,
        upper: true,
      },
    ],
  },
  {
    kind: 'clarity',
    name: 'Microsoft Clarity',
    group: 'Analytics',
    blurb: 'Free heatmaps and session recordings to see where visitors get stuck.',
    permission: 'analytics',
    fields: [
      {
        key: 'project_id',
        label: 'Project ID',
        placeholder: 'abcde12345',
        help: 'In Clarity open Settings, then Overview, and copy the Project ID.',
        pattern: /^[a-z0-9]{8,14}$/,
        required: true,
      },
    ],
  },
  {
    kind: 'meta',
    name: 'Meta Pixel (Facebook and Instagram)',
    group: 'Advertising',
    blurb: 'Measure ads and build audiences from visitors and buyers.',
    permission: 'marketing',
    fields: [
      {
        key: 'pixel_id',
        label: 'Pixel ID',
        placeholder: '123456789012345',
        help: 'In Meta Events Manager choose your pixel and copy the numeric ID.',
        pattern: /^\d{8,20}$/,
        required: true,
      },
    ],
  },
  {
    kind: 'tiktok',
    name: 'TikTok Pixel',
    group: 'Advertising',
    blurb: 'Track conversions from your TikTok ads.',
    permission: 'marketing',
    fields: [
      {
        key: 'pixel_id',
        label: 'Pixel ID',
        placeholder: 'C1ABCDEFGHIJ23KLMNOP',
        help: 'In TikTok Events Manager open your pixel and copy its ID.',
        pattern: /^[A-Z0-9]{10,30}$/,
        required: true,
        upper: true,
      },
    ],
  },
  {
    kind: 'google_ads',
    name: 'Google Ads conversions',
    group: 'Advertising',
    blurb: 'Count orders as conversions for your Google Ads campaigns.',
    permission: 'marketing',
    fields: [
      {
        key: 'conversion_id',
        label: 'Conversion ID',
        placeholder: 'AW-123456789',
        help: 'In Google Ads open your conversion action, then Tag setup, and copy the ID that starts with AW-.',
        pattern: /^AW-\d{6,14}$/,
        required: true,
        upper: true,
      },
      {
        key: 'purchase_label',
        label: 'Purchase conversion label (optional)',
        placeholder: 'AbC-D_efG-h12345',
        help: 'Needed to count orders. It is the part after the slash in AW-123456789/LABEL.',
        pattern: /^[A-Za-z0-9_-]{6,40}$/,
        required: false,
      },
    ],
  },
];

export const appByKind = (k: string) => apps.find((a) => a.kind === k);

export const permissionOptions: { v: Permission; t: string }[] = [
  { v: 'none', t: 'Not required (runs for every visitor)' },
  { v: 'analytics', t: 'Analytics consent required' },
  { v: 'marketing', t: 'Marketing consent required' },
  { v: 'both', t: 'Analytics and marketing consent required' },
];

export const dataSaleOptions: { v: DataSale; t: string }[] = [
  { v: 'qualifies', t: 'Data collected qualifies as data sale (stops if the visitor opts out)' },
  { v: 'not', t: 'Data collected does not qualify as data sale' },
];

export const MAX_CODE = 20000;

// Returns an error message, or null when the config is fine. Runs again on the
// live site before any pixel starts, because owners can write to the database directly.
export function validateApp(kind: string, config: Record<string, unknown>): string | null {
  const app = appByKind(kind);
  if (!app) return 'Unknown pixel type.';
  for (const f of app.fields) {
    const v = typeof config[f.key] === 'string' ? (config[f.key] as string).trim() : '';
    if (!v) {
      if (f.required) return `${f.label} is required.`;
      continue;
    }
    if (!f.pattern.test(v)) return `${f.label} does not look right. It should look like ${f.placeholder}.`;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Custom pixels run in a sandboxed iframe with no access to the site, */
/* its storage or the dashboard.                                       */
/* ------------------------------------------------------------------ */

export function customSrcdoc(code: string, pixelId: string): string {
  const safe = code.replace(/<\/script/gi, '<\\/script');
  return `<!doctype html><html><head><meta charset="utf-8"></head><body><script>
(function(){
var subs={},all=[];
window.analytics={subscribe:function(n,cb){if(typeof cb!=='function')return function(){};if(n==='all_events'){all.push(cb)}else{(subs[n]=subs[n]||[]).push(cb)}return function(){}}};
window.addEventListener('message',function(m){var d=m.data;if(!d||d.__xenon!==1||!d.event)return;(subs[d.event.name]||[]).concat(all).forEach(function(cb){try{cb(d.event)}catch(e){console.error(e)}})});
window.__xenonReady=function(){parent.postMessage({__xenon:1,ready:true,pixel:${JSON.stringify(pixelId)}},'*')};
})();
</script><script>try{
${safe}
}catch(e){console.error(e)}</script><script>window.__xenonReady()</script></body></html>`;
}

/* ------------------------------------------------------------------ */
/* App pixels. Each one follows the vendor's standard snippet.         */
/* ------------------------------------------------------------------ */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = any;
type Cfg = Record<string, string>;
export type Handler = (e: PixelEvent) => void;

const lines = (d: EventData): Line[] => d.items ?? (d.product ? [d.product] : []);
const sum = (ls: Line[]) => ls.reduce((n, l) => n + l.price * l.quantity, 0);
const cur = (d: EventData) => d.currency ?? 'NGN';
const value = (d: EventData) => d.total ?? sum(lines(d));

function addScript(src: string) {
  const s = document.createElement('script');
  s.async = true;
  s.src = src;
  document.head.appendChild(s);
}

function gtagInit(firstId: string): (...a: unknown[]) => void {
  const w = window as Loose;
  if (!w.gtag) {
    w.dataLayer = w.dataLayer || [];
    w.gtag = function () {
      // eslint-disable-next-line prefer-rest-params
      w.dataLayer.push(arguments);
    };
    w.gtag('js', new Date());
    addScript('https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(firstId));
  }
  return w.gtag;
}

function bootGa4(c: Cfg): Handler {
  const id = c.measurement_id;
  const gtag = gtagInit(id);
  gtag('config', id, { send_page_view: false });
  const items = (d: EventData) =>
    lines(d).map((l) => ({ item_id: l.id, item_name: l.title, price: l.price, quantity: l.quantity, item_category: l.category }));
  return (e) => {
    const d = e.data;
    const base = { send_to: id };
    switch (e.name) {
      case 'page_viewed':
        gtag('event', 'page_view', { ...base, page_location: e.context.url, page_title: e.context.title, page_referrer: e.context.referrer });
        break;
      case 'product_viewed':
        gtag('event', 'view_item', { ...base, currency: cur(d), value: sum(lines(d)), items: items(d) });
        break;
      case 'product_added_to_cart':
        gtag('event', 'add_to_cart', { ...base, currency: cur(d), value: sum(lines(d)), items: items(d) });
        break;
      case 'checkout_started':
        gtag('event', 'begin_checkout', { ...base, currency: cur(d), value: value(d), items: items(d) });
        break;
      case 'checkout_completed':
        gtag('event', 'purchase', { ...base, transaction_id: d.orderId, currency: cur(d), value: value(d), items: items(d) });
        break;
      case 'search_submitted':
        gtag('event', 'search', { ...base, search_term: d.query });
        break;
    }
  };
}

function bootAds(c: Cfg): Handler {
  const id = c.conversion_id;
  const gtag = gtagInit(id);
  gtag('config', id);
  return (e) => {
    if (e.name !== 'checkout_completed' || !c.purchase_label) return;
    gtag('event', 'conversion', {
      send_to: `${id}/${c.purchase_label}`,
      value: value(e.data),
      currency: cur(e.data),
      transaction_id: e.data.orderId,
    });
  };
}

function bootMeta(c: Cfg): Handler {
  const id = c.pixel_id;
  const w = window as Loose;
  if (!w.fbq) {
    const n: Loose = (w.fbq = function () {
      // eslint-disable-next-line prefer-rest-params
      n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
    });
    if (!w._fbq) w._fbq = n;
    n.push = n;
    n.loaded = true;
    n.version = '2.0';
    n.queue = [];
    addScript('https://connect.facebook.net/en_US/fbevents.js');
  }
  w.fbq('init', id);
  const ids = (d: EventData) => lines(d).map((l) => l.id);
  const track = (name: string, params?: object) => (params ? w.fbq('trackSingle', id, name, params) : w.fbq('trackSingle', id, name));
  return (e) => {
    const d = e.data;
    switch (e.name) {
      case 'page_viewed':
        track('PageView');
        break;
      case 'product_viewed':
        track('ViewContent', { content_ids: ids(d), content_name: d.product?.title, content_type: 'product', value: sum(lines(d)), currency: cur(d) });
        break;
      case 'product_added_to_cart':
        track('AddToCart', { content_ids: ids(d), content_name: d.product?.title, content_type: 'product', value: sum(lines(d)), currency: cur(d) });
        break;
      case 'checkout_started':
        track('InitiateCheckout', { content_ids: ids(d), num_items: lines(d).reduce((n, l) => n + l.quantity, 0), value: value(d), currency: cur(d) });
        break;
      case 'checkout_completed':
        track('Purchase', { content_ids: ids(d), content_type: 'product', num_items: lines(d).reduce((n, l) => n + l.quantity, 0), value: value(d), currency: cur(d) });
        break;
      case 'search_submitted':
        track('Search', { search_string: d.query });
        break;
    }
  };
}

function bootTiktok(c: Cfg): Handler {
  const id = c.pixel_id;
  const w = window as Loose;
  if (!w.ttq) {
    w.TiktokAnalyticsObject = 'ttq';
    const q: Loose = (w.ttq = []);
    q.methods = ['page', 'track', 'identify', 'instances', 'debug', 'on', 'off', 'once', 'ready', 'alias', 'group', 'enableCookie', 'disableCookie'];
    q.setAndDefer = (t: Loose, m: string) => {
      t[m] = (...a: unknown[]) => {
        t.push(([m] as unknown[]).concat(a));
      };
    };
    for (const m of q.methods) q.setAndDefer(q, m);
    q.instance = (key: string) => {
      const inst: Loose = q._i[key] || [];
      for (const m of q.methods) q.setAndDefer(inst, m);
      return inst;
    };
    q.load = (key: string, opts?: object) => {
      const url = 'https://analytics.tiktok.com/i18n/pixel/events.js';
      q._i = q._i || {};
      q._i[key] = [];
      q._i[key]._u = url;
      q._t = q._t || {};
      q._t[key] = +new Date();
      q._o = q._o || {};
      q._o[key] = opts || {};
      addScript(`${url}?sdkid=${encodeURIComponent(key)}&lib=ttq`);
    };
  }
  if (!w.ttq._i || !w.ttq._i[id]) w.ttq.load(id);
  const t: Loose = w.ttq.instance(id);
  const contents = (d: EventData) => lines(d).map((l) => ({ content_id: l.id, content_name: l.title, quantity: l.quantity, price: l.price }));
  return (e) => {
    const d = e.data;
    switch (e.name) {
      case 'page_viewed':
        t.page();
        break;
      case 'product_viewed':
        t.track('ViewContent', { contents: contents(d), content_type: 'product', value: sum(lines(d)), currency: cur(d) });
        break;
      case 'product_added_to_cart':
        t.track('AddToCart', { contents: contents(d), content_type: 'product', value: sum(lines(d)), currency: cur(d) });
        break;
      case 'checkout_started':
        t.track('InitiateCheckout', { contents: contents(d), content_type: 'product', value: value(d), currency: cur(d) });
        break;
      case 'checkout_completed':
        t.track('CompletePayment', { contents: contents(d), content_type: 'product', value: value(d), currency: cur(d) });
        break;
      case 'search_submitted':
        t.track('Search', { query: d.query });
        break;
    }
  };
}

function bootClarity(c: Cfg): Handler {
  const w = window as Loose;
  if (!w.clarity) {
    w.clarity = function () {
      // eslint-disable-next-line prefer-rest-params
      (w.clarity.q = w.clarity.q || []).push(arguments);
    };
    addScript('https://www.clarity.ms/tag/' + encodeURIComponent(c.project_id));
  }
  return (e) => {
    if (e.name === 'checkout_completed') w.clarity('event', 'purchase');
    if (e.name === 'product_added_to_cart') w.clarity('event', 'add_to_cart');
  };
}

export function bootApp(kind: AppKind, config: Cfg): Handler {
  switch (kind) {
    case 'ga4':
      return bootGa4(config);
    case 'google_ads':
      return bootAds(config);
    case 'meta':
      return bootMeta(config);
    case 'tiktok':
      return bootTiktok(config);
    case 'clarity':
      return bootClarity(config);
  }
}
