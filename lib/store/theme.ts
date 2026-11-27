// Online Store themes: settings shape, ready-made templates, safe reading, and the CSS they produce.
// Everything coming from the database goes through readTheme(), so a bad value can never break (or inject into) the store.

export const FONTS = [
  'Inter', 'Poppins', 'Montserrat', 'DM Sans', 'Nunito', 'Raleway', 'Roboto', 'Space Grotesk',
  'Oswald', 'Playfair Display', 'Lora', 'Merriweather',
] as const;

export type Tri = 'tight' | 'normal' | 'loose';
export type FontRole = 'body' | 'subheading' | 'heading' | 'accent';
export type Preset = { font: FontRole; size: number; lh: Tri; ls: Tri; upper: boolean };
export type HKey = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';

export type ThemeSettings = {
  colors: {
    text: string; background: string; card: string; border: string; muted: string;
    primary: string; primaryText: string; accent: string;
    saleBg: string; saleText: string; soldBg: string; soldText: string;
    inputBg: string; inputText: string; inputBorder: string; drawerBg: string;
  };
  fonts: Record<FontRole, string>;
  paragraph: { size: number; lh: Tri };
  h: Record<HKey, Preset>;
  page: { width: 'narrow' | 'normal' | 'wide' };
  anim: { hover: 'none' | 'lift' | 'scale' | 'zoom'; cartBump: boolean };
  badges: { position: 'tl' | 'tr' | 'bl'; radius: number; upper: boolean };
  buttons: { radius: number; border: number; upper: boolean; font: 'body' | 'accent'; sRadius: number; sBorder: number; pill: number };
  icons: { stroke: 'thin' | 'default' | 'heavy' };
  inputs: { radius: number; border: number };
  popovers: { radius: number; border: number; shadow: boolean };
  prices: { code: boolean };
  cards: { quickAdd: 'always' | 'hover'; radius: number; border: 'none' | 'solid'; columns: number; mobileColumns: number };
  css: string;
};

export type SectionType =
  | 'announcement' | 'header' | 'hero' | 'products' | 'richtext' | 'imagetext'
  | 'trust' | 'testimonials' | 'faq' | 'contact' | 'marquee' | 'floatchat' | 'countdown' | 'footer'
  | 'multicolumn' | 'featured' | 'video' | 'slideshow' | 'custom' | 'main' | 'ticker' | 'collection' | 'collectiontabs' | 'collectionlist' | 'infotiles' | 'people' | 'gallery' | 'newsletter';

// Where a section lives. header and footer are groups shared by every page; the others are page templates.
export type PageId = 'header' | 'home' | 'collection' | 'product' | 'cart' | 'page' | 'footer';
export const PAGE_ORDER: PageId[] = ['header', 'home', 'collection', 'product', 'cart', 'page', 'footer'];
export const TEMPLATE_PAGES: { id: PageId; label: string }[] = [
  { id: 'home', label: 'Home page' }, { id: 'collection', label: 'Collection page' }, { id: 'product', label: 'Product page' }, { id: 'cart', label: 'Cart page' }, { id: 'page', label: 'Info pages' },
];
export type Section = { id: string; type: SectionType; page: PageId; visible: boolean; s: Record<string, unknown> };
export type ThemeData = { settings: ThemeSettings; sections: Section[] };

export const FIXED_TOP: SectionType[] = ['announcement', 'header'];
export const FIXED_BOTTOM: SectionType[] = ['footer'];
export const ADDABLE: SectionType[] = ['hero', 'ticker', 'collection', 'collectiontabs', 'collectionlist', 'infotiles', 'people', 'gallery', 'newsletter', 'countdown', 'slideshow', 'multicolumn', 'featured', 'video', 'custom', 'richtext', 'imagetext', 'trust', 'testimonials', 'marquee', 'faq', 'contact', 'floatchat', 'products'];
export const SINGLE: SectionType[] = ['announcement', 'header', 'footer', 'products', 'floatchat', 'ticker', 'main'];
// what the owner may add to each group (the page body accepts everything in ADDABLE)
export const GROUP_ADDABLE: Record<'header' | 'footer', SectionType[]> = {
  header: ['ticker', 'countdown', 'marquee', 'richtext', 'custom'],
  footer: ['newsletter', 'trust', 'marquee', 'gallery', 'richtext', 'custom', 'floatchat'],
};
export const SECTION_HINTS: Partial<Record<SectionType, string>> = {
  hero: 'Big banner with a picture, text, button and optional countdown', ticker: 'Thin strip of messages that rotate with arrows', collection: 'Products of one collection in a row, with a Shop now button',
  collectiontabs: 'Tabs that switch between collections (Find your deal)', collectionlist: 'Picture tiles that open your collections', infotiles: 'Heading with icon tiles',
  people: 'Photos of people who wear your products', gallery: 'Photo strip, like Instagram', newsletter: 'Email sign-up box', countdown: 'Sale countdown with a button', marquee: 'Scrolling line of text',
  multicolumn: 'A row of 2 to 4 columns, each with a picture, heading, text and link', featured: 'One product shown big, with its photo, price and Add to cart', video: 'A YouTube, Vimeo or video file that plays when tapped', slideshow: 'Banner that moves through several slides, each with a picture, text and button', custom: 'Your own mix of headings, text, buttons and images, in any order', richtext: 'Heading and text', imagetext: 'Picture next to text', trust: 'Icons with short promises (delivery, secure payment...)', testimonials: 'Customer reviews', faq: 'Questions and answers',
  contact: 'Chat with us box', floatchat: 'WhatsApp or Tawk chat button', products: 'All products in a grid',
};
export const sectionLabel = (s: { type: SectionType; page: PageId }) =>
  s.type === 'main' ? (s.page === 'collection' ? 'Collection products' : s.page === 'product' ? 'Product details' : s.page === 'cart' ? 'Cart items' : 'Page content') : SECTION_LABELS[s.type];
export const SECTION_LABELS: Record<SectionType, string> = {
  main: 'Main content',
  announcement: 'Announcement bar', header: 'Header', hero: 'Hero banner', products: 'Products',
  multicolumn: 'Multi-column', featured: 'Featured product', video: 'Video', slideshow: 'Slideshow', custom: 'Custom blocks', richtext: 'Rich text', imagetext: 'Image with text', trust: 'Trust badges', testimonials: 'Customer reviews',
  faq: 'FAQ', contact: 'Contact / WhatsApp', marquee: 'Scrolling text strip', floatchat: 'Chat buttons (WhatsApp / Live chat)', countdown: 'Sale countdown', footer: 'Footer',
  ticker: 'Rotating announcements', collection: 'Collection carousel', collectiontabs: 'Collection tabs (Find your deal)', collectionlist: 'Collection tiles', infotiles: 'Heading with icon tiles', people: 'People carousel (ambassadors)', gallery: 'Photo strip (Instagram style)', newsletter: 'Newsletter sign-up',
};
// icons trust badges can use (rendered with lucide in the storefront)
export const TRUST_ICONS = ['truck', 'shield', 'phone', 'card', 'gift', 'clock', 'heart', 'star', 'sparkles', 'leaf', 'ruler', 'refresh', 'award', 'package', 'layers', 'sun'] as const;

// ---------- defaults ----------
const t = (size: number, lh: Tri, font: FontRole, ls: Tri = 'normal', upper = false): Preset => ({ font, size, lh, ls, upper });

export const defaultSettings: ThemeSettings = {
  colors: {
    text: '#0f172a', background: '#ffffff', card: '#ffffff', border: '#e2e8f0', muted: '#64748b',
    primary: '#0f172a', primaryText: '#ffffff', accent: '#2563eb',
    saleBg: '#fee2e2', saleText: '#991b1b', soldBg: '#eef1ea', soldText: '#0f172a',
    inputBg: '#ffffff', inputText: '#0f172a', inputBorder: '#cbd5e1', drawerBg: '#ffffff',
  },
  fonts: { body: 'Inter', subheading: 'Inter', heading: 'Inter', accent: 'Inter' },
  paragraph: { size: 15, lh: 'loose' },
  h: {
    h1: t(52, 'tight', 'heading'), h2: t(40, 'tight', 'heading'), h3: t(30, 'normal', 'heading'),
    h4: t(22, 'tight', 'heading'), h5: t(14, 'loose', 'subheading'), h6: t(12, 'loose', 'subheading'),
  },
  page: { width: 'normal' },
  anim: { hover: 'lift', cartBump: true },
  badges: { position: 'tl', radius: 100, upper: false },
  buttons: { radius: 12, border: 0, upper: false, font: 'body', sRadius: 12, sBorder: 1, pill: 40 },
  icons: { stroke: 'default' },
  inputs: { radius: 8, border: 1 },
  popovers: { radius: 16, border: 1, shadow: true },
  prices: { code: false },
  cards: { quickAdd: 'always', radius: 12, border: 'solid', columns: 4, mobileColumns: 2 },
  css: '',
};

export const defaultSectionSettings: Record<SectionType, Record<string, unknown>> = {
  main: {},
  announcement: { text: 'Free delivery on orders over ₦50,000', link: '', bg: '', color: '', ends: '' },
  header: { logoText: '', logoImage: '', links: [{ label: 'Shop', href: '#products' }], showSearch: true, showCart: true, showAccount: true, showMenu: false, sticky: true, center: false, wide: false },
  hero: { image: '', heading: 'Browse our latest products', sub: 'Quality you can trust, delivered to your door.', button: 'Shop all', link: '#products', height: 'medium', overlay: 35, align: 'center', valign: 'center', eyebrow: '', outline: false, textColor: '#ffffff', bg: '', ends: '', endsLabel: 'Ends in' },
  products: { heading: 'Products', showTrack: true, layout: 'grid', portrait: false },
  multicolumn: { heading: '', perRow: '3', shape: 'portrait', align: 'center', button: '', cols: [] },
  featured: { product: '', heading: '', button: 'Add to cart', showDesc: true, imageRight: false },
  video: { heading: '', url: '', title: '', ratio: '16:9', poster: '', narrow: false },
  slideshow: { height: 'medium', autoplay: true, seconds: 5, arrows: true, dots: true, align: 'center', overlay: 35, textColor: '#ffffff', bg: '', outline: false, slides: [] },
  custom: { align: 'center', columns: '1', blocks: [] },
  richtext: { heading: 'About our store', text: 'Tell customers who you are and why they can trust you.', align: 'center', button: '', link: '' },
  imagetext: { image: '', heading: 'Our story', text: 'Share what makes your products special.', button: '', link: '', imageSide: 'left' },
  trust: { items: [
    { icon: 'truck', title: 'Fast delivery', text: 'Same-day delivery in your area' },
    { icon: 'shield', title: 'Pay safely', text: 'Pay on delivery or by transfer' },
    { icon: 'phone', title: 'We reply fast', text: 'Chat with us on WhatsApp' },
  ] },
  testimonials: { heading: 'What customers say', subtitle: '', style: 'cards', items: [
    { name: 'Amaka O.', rating: '5', text: 'Fast delivery and exactly as described. Will order again.' },
    { name: 'Tunde B.', rating: '5', text: 'Great service, the seller replied within minutes.' },
  ] },
  faq: { heading: 'Questions we get a lot', items: [
    { q: 'How long does delivery take?', a: 'Orders in your city arrive the same or next day. Other states take 2 to 5 days.' },
    { q: 'Can I pay on delivery?', a: 'Yes, pay on delivery is available for most orders.' },
  ] },
  marquee: { items: [{ text: 'Free delivery' }, { text: 'Pay on delivery' }, { text: 'Genuine products' }], speed: 30, bg: '', color: '' },
  countdown: { heading: 'Sale ends in', ends: '', endedText: 'This sale has ended', button: 'Shop the sale', link: '#products', bg: '', color: '' },
  floatchat: { whatsapp: '', message: 'Hi, I have a question.', showWhatsapp: true, tawkProperty: '', tawkWidget: '' },
  contact: { heading: 'Need help ordering?', text: 'Chat with us and we will help you place your order.', whatsapp: '', phone: '', button: 'Chat on WhatsApp' },
  ticker: { items: [], seconds: 5, bg: '', color: '' },
  collection: { collection: '', heading: '', button: 'Shop now', limit: 8, portrait: true },
  collectiontabs: { heading: 'Find your deal', tabs: [], limit: 8, button: 'Shop now', portrait: true },
  collectionlist: { heading: '', items: [], columns: 4 },
  infotiles: { heading: '', text: '', items: [] },
  people: { heading: 'Worn by icons', subtitle: '', items: [] },
  gallery: { heading: '', handle: '', link: '', items: [] },
  newsletter: { heading: 'Join the community', text: 'Be the first to hear about new drops and offers.', button: 'Subscribe', success: 'Thank you for subscribing!', bg: '', color: '' },
  footer: { layout: 'classic', aboutHeading: 'About', shopHeading: 'Shop', supportHeading: 'Customer support', newsletter: false, newsHeading: 'Join the community', newsText: 'Be the first to hear about new drops and offers.', text: '', showPolicies: true, showPages: true, showStorefronts: true, instagram: '', facebook: '', tiktok: '', x: '', youtube: '', whatsapp: '', phone: '', payments: '', showSupport: false, bg: '', color: '' },
};

let counter = 0;
export function newId(prefix = 's') {
  counter += 1;
  return `${prefix}${Date.now().toString(36)}${counter}${Math.random().toString(36).slice(2, 5)}`;
}
export function defaultPage(type: SectionType): PageId {
  return type === 'announcement' || type === 'header' ? 'header' : type === 'footer' ? 'footer' : 'home';
}
export function newSection(type: SectionType, s: Record<string, unknown> = {}, page?: PageId): Section {
  return { id: newId(), type, page: page ?? defaultPage(type), visible: true, s: { ...JSON.parse(JSON.stringify(defaultSectionSettings[type])), ...s } };
}

// ---------- templates (ready-made starting points) ----------
function deepMerge<T>(base: T, over: unknown): T {
  if (Array.isArray(base) || typeof base !== 'object' || base === null) return (over === undefined ? base : (over as T));
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  const o = (over ?? {}) as Record<string, unknown>;
  for (const k of Object.keys(o)) out[k] = k in (base as object) ? deepMerge((base as Record<string, unknown>)[k], o[k]) : o[k];
  return out as T;
}
const mk = (over: Record<string, unknown>): ThemeSettings => deepMerge(defaultSettings, over);

export const BASE_BLURB = 'Starts empty: header and footer only. You add every section yourself with Add section.';

const BASE_SETTINGS: ThemeSettings = mk({
    colors: { text: '#111111', background: '#ffffff', card: '#ffffff', border: '#ededed', muted: '#6b6b6b', primary: '#111111', primaryText: '#ffffff', accent: '#111111', saleBg: '#991b1b', saleText: '#ffffff', soldBg: '#111111', soldText: '#ffffff', inputBg: '#ffffff', inputText: '#111111', inputBorder: '#d4d4d4', drawerBg: '#ffffff' },
    fonts: { body: 'Inter', subheading: 'Montserrat', heading: 'Montserrat', accent: 'Montserrat' },
    h: { h1: t(60, 'tight', 'heading', 'tight', true), h2: t(26, 'tight', 'heading', 'loose', true), h4: t(20, 'tight', 'heading', 'loose', true), h5: t(12, 'loose', 'subheading', 'loose', true) },
    page: { width: 'wide' },
    buttons: { radius: 0, sRadius: 0, upper: true, border: 1 },
    cards: { radius: 0, border: 'none', columns: 4, mobileColumns: 2 },
    badges: { radius: 0, upper: true }, inputs: { radius: 0 }, popovers: { radius: 0 }, anim: { hover: 'zoom' },
});

// every theme starts with just what a store needs to work; the owner adds everything else
export function freshTheme(_template?: string): ThemeData {
  return {
    settings: JSON.parse(JSON.stringify(BASE_SETTINGS)),
    sections: [
      newSection('announcement', { text: '' }),
      newSection('header', { center: true, wide: true, showMenu: true, sticky: true, links: [] }),
      newSection('footer', { layout: 'classic', showSupport: true, payments: '' }),
    ],
  };
}

// ---------- reading from the database ----------
const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
export const safeColor = (v: unknown, fallback = ''): string => (typeof v === 'string' && (HEX.test(v.trim()) || v.trim() === 'transparent') ? v.trim() : fallback);
const num = (v: unknown, min: number, max: number, d: number) => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : d;
};
const oneOf = <T extends string>(v: unknown, list: readonly T[], d: T): T => (list.includes(v as T) ? (v as T) : d);
const bool = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d);
const font = (v: unknown, d: string) => ((FONTS as readonly string[]).includes(v as string) ? (v as string) : d);
const str = (v: unknown, d = '', max = 2000) => (typeof v === 'string' ? v.slice(0, max) : d);

export function safeUrl(v: unknown): string {
  if (typeof v !== 'string') return '';
  const s = v.trim();
  return /^https:\/\//i.test(s) || /^\/[^/]/.test(s) ? s.slice(0, 1000) : '';
}
// a link a visitor may click: https, mailto, tel, an in-page anchor, or a path inside this store ({store} = /b/slug)
export function safeHref(v: unknown, slug = ''): string {
  if (typeof v !== 'string') return '';
  const s = v.trim().replace(/^\{store\}/, `/b/${slug}`);
  if (/^(https?:\/\/|mailto:|tel:|\/[^/]|#)/i.test(s) || s === '/') return s.slice(0, 1000);
  return '';
}

function readSettings(raw: unknown): ThemeSettings {
  const d = defaultSettings;
  const r = (deepMerge(d, raw && typeof raw === 'object' ? raw : {}) as unknown) as ThemeSettings;
  const c = r.colors;
  const colors = {} as ThemeSettings['colors'];
  for (const k of Object.keys(d.colors) as (keyof ThemeSettings['colors'])[]) colors[k] = safeColor(c?.[k], d.colors[k]);
  const fonts = {} as ThemeSettings['fonts'];
  for (const k of Object.keys(d.fonts) as FontRole[]) fonts[k] = font(r.fonts?.[k], d.fonts[k]);
  const h = {} as ThemeSettings['h'];
  for (const k of Object.keys(d.h) as HKey[]) {
    const p = r.h?.[k] ?? d.h[k];
    h[k] = { font: oneOf(p.font, ['body', 'subheading', 'heading', 'accent'] as const, d.h[k].font), size: num(p.size, 10, 96, d.h[k].size), lh: oneOf(p.lh, ['tight', 'normal', 'loose'] as const, d.h[k].lh), ls: oneOf(p.ls, ['tight', 'normal', 'loose'] as const, d.h[k].ls), upper: bool(p.upper, d.h[k].upper) };
  }
  return {
    colors, fonts, h,
    paragraph: { size: num(r.paragraph?.size, 10, 20, d.paragraph.size), lh: oneOf(r.paragraph?.lh, ['tight', 'normal', 'loose'] as const, d.paragraph.lh) },
    page: { width: oneOf(r.page?.width, ['narrow', 'normal', 'wide'] as const, d.page.width) },
    anim: { hover: oneOf(r.anim?.hover, ['none', 'lift', 'scale', 'zoom'] as const, d.anim.hover), cartBump: bool(r.anim?.cartBump, d.anim.cartBump) },
    badges: { position: oneOf(r.badges?.position, ['tl', 'tr', 'bl'] as const, d.badges.position), radius: num(r.badges?.radius, 0, 100, d.badges.radius), upper: bool(r.badges?.upper, d.badges.upper) },
    buttons: { radius: num(r.buttons?.radius, 0, 60, d.buttons.radius), border: num(r.buttons?.border, 0, 6, d.buttons.border), upper: bool(r.buttons?.upper, d.buttons.upper), font: oneOf(r.buttons?.font, ['body', 'accent'] as const, d.buttons.font), sRadius: num(r.buttons?.sRadius, 0, 60, d.buttons.sRadius), sBorder: num(r.buttons?.sBorder, 0, 6, d.buttons.sBorder), pill: num(r.buttons?.pill, 0, 60, d.buttons.pill) },
    icons: { stroke: oneOf(r.icons?.stroke, ['thin', 'default', 'heavy'] as const, d.icons.stroke) },
    inputs: { radius: num(r.inputs?.radius, 0, 30, d.inputs.radius), border: num(r.inputs?.border, 0, 4, d.inputs.border) },
    popovers: { radius: num(r.popovers?.radius, 0, 40, d.popovers.radius), border: num(r.popovers?.border, 0, 4, d.popovers.border), shadow: bool(r.popovers?.shadow, d.popovers.shadow) },
    prices: { code: bool(r.prices?.code, d.prices.code) },
    cards: { quickAdd: oneOf(r.cards?.quickAdd, ['always', 'hover'] as const, d.cards.quickAdd), radius: num(r.cards?.radius, 0, 40, d.cards.radius), border: oneOf(r.cards?.border, ['none', 'solid'] as const, d.cards.border), columns: Math.round(num(r.cards?.columns, 2, 6, d.cards.columns)), mobileColumns: Math.round(num(r.cards?.mobileColumns, 1, 3, d.cards.mobileColumns)) },
    css: sanitizeCss(str(r.css, '', 8000)),
  };
}

const GROUP_PAGES: PageId[] = ['header', 'home', 'collection', 'product', 'cart', 'page', 'footer'];

// mixed blocks inside a Custom blocks section: only known block types, text values only
export const BLOCK_TYPES = ['heading', 'text', 'button', 'image', 'divider', 'spacer'] as const;
export const MAX_BLOCKS = 20;
function cleanBlocks(v: unknown): Record<string, string>[] {
  if (!Array.isArray(v)) return [];
  const out: Record<string, string>[] = [];
  for (const b of v.slice(0, MAX_BLOCKS)) {
    if (!b || typeof b !== 'object' || !(BLOCK_TYPES as readonly string[]).includes((b as Record<string, unknown>).type as string)) continue;
    const o: Record<string, string> = {};
    for (const [k, val] of Object.entries(b as Record<string, unknown>)) if (/^[a-z_]{1,20}$/i.test(k) && typeof val === 'string') o[k] = val.slice(0, 3000);
    out.push(o);
  }
  return out;
}

function readSections(raw: unknown): Section[] {
  const types = Object.keys(defaultSectionSettings) as SectionType[];
  const list: Section[] = [];
  const seen = new Set<string>();
  if (Array.isArray(raw)) {
    for (const x of raw as Record<string, unknown>[]) {
      if (!x || typeof x !== 'object' || !types.includes(x.type as SectionType)) continue;
      const type = x.type as SectionType;
      let page: PageId = GROUP_PAGES.includes(x.page as PageId) ? (x.page as PageId) : defaultPage(type);
      if (type === 'announcement' || type === 'header') page = 'header';
      else if (type === 'footer') page = 'footer';
      else if (type === 'main' && !['collection', 'product', 'cart', 'page'].includes(page)) continue;
      if (SINGLE.includes(type) && list.some((s) => s.type === type && (type !== 'main' || s.page === page))) continue;
      let id = typeof x.id === 'string' && /^[a-z0-9]{1,40}$/i.test(x.id) ? x.id : newId();
      if (seen.has(id)) id = newId();
      seen.add(id);
      const base = defaultSectionSettings[type];
      const given = x.s && typeof x.s === 'object' ? (x.s as Record<string, unknown>) : {};
      const s: Record<string, unknown> = {};
      for (const k of Object.keys(base)) {
        const bv = base[k];
        const gv = given[k];
        if (type === 'custom' && k === 'blocks') s[k] = cleanBlocks(gv);
        else if (Array.isArray(bv)) s[k] = Array.isArray(gv) ? gv.slice(0, 12) : bv;
        else if (typeof bv === 'boolean') s[k] = typeof gv === 'boolean' ? gv : bv;
        else if (typeof bv === 'number') s[k] = num(gv, 0, 100, bv);
        else s[k] = typeof gv === 'string' ? gv.slice(0, 3000) : bv;
      }
      // section style settings shared by every section (Shopify's section padding, colors and width)
      for (const k of ['_pt', '_pb']) s[k] = given[k] === '' || given[k] == null ? '' : String(Math.round(num(given[k], 0, 200, 0)));
      s._bg = safeColor(given._bg, ''); s._color = safeColor(given._color, '');
      s._width = oneOf(given._width, ['', 'narrow', 'full'] as const, '');
      s._hm = given._hm === true; s._hd = given._hd === true;
      list.push({ id, type, page, visible: type === 'main' ? true : x.visible !== false, s });
    }
  }
  // the parts every store needs always exist
  if (!list.some((s) => s.type === 'announcement')) list.unshift(newSection('announcement'));
  if (!list.some((s) => s.type === 'header')) list.splice(1, 0, newSection('header'));
  if (!list.some((s) => s.type === 'footer')) list.push(newSection('footer'));
  for (const pg of ['collection', 'product', 'cart', 'page'] as PageId[]) {
    if (!list.some((s) => s.type === 'main' && s.page === pg)) list.push(newSection('main', {}, pg));
  }
  // one list, always in the same order: header group, each page, footer group
  return PAGE_ORDER.flatMap((pg) => list.filter((s) => s.page === pg));
}

export function readTheme(row: { settings?: unknown; sections?: unknown; template?: string } | null | undefined): ThemeData {
  if (!row) return freshTheme('blank');
  const sectionsRaw = Array.isArray(row.sections) && row.sections.length > 0 ? row.sections : freshTheme(row.template ?? 'blank').sections;
  return { settings: readSettings(row.settings), sections: readSections(sectionsRaw) };
}

// ---------- CSS ----------
export function sanitizeCss(css: string): string {
  return css
    .replace(/</g, '')
    .replace(/@import[^;]*;?/gi, '')
    .replace(/expression\s*\(/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/behaviou?r\s*:/gi, '')
    .replace(/-moz-binding\s*:/gi, '')
    .replace(/url\s*\(\s*(['"]?)\s*(?!https:|\/|data:image\/)[^)]*\)/gi, 'none')
    .slice(0, 8000);
}

const LH: Record<Tri, number> = { tight: 1.15, normal: 1.4, loose: 1.7 };
const LS: Record<Tri, string> = { tight: '-0.02em', normal: '0', loose: '0.06em' };
const WIDTH = { narrow: '960px', normal: '1152px', wide: '1360px' };
const STROKE = { thin: 1.4, default: 2, heavy: 2.6 };
export const strokeWidth = (s: ThemeSettings) => STROKE[s.icons.stroke];

export function fontsHref(s: ThemeSettings): string {
  const names = Array.from(new Set(Object.values(s.fonts)));
  const fam = names.map((n) => `family=${n.replace(/ /g, '+')}:wght@400;500;600;700`).join('&');
  return `https://fonts.googleapis.com/css2?${fam}&display=swap`;
}

const fam = (n: string) => `'${n}', system-ui, sans-serif`;

export function themeCss(s: ThemeSettings): string {
  const c = s.colors;
  const role = (r: FontRole) => fam(s.fonts[r]);
  const heads = (Object.keys(s.h) as HKey[]).map((k) => {
    const p = s.h[k];
    const mobile = Math.max(14, Math.round(p.size * (p.size > 30 ? 0.6 : 0.85)));
    return `.xs-store .xs-${k}{font-family:${role(p.font)};font-size:clamp(${mobile}px,${(p.size / 14).toFixed(2)}vw + ${Math.round(mobile * 0.55)}px,${p.size}px);line-height:${LH[p.lh]};letter-spacing:${LS[p.ls]};${p.upper ? 'text-transform:uppercase;' : ''}font-weight:600;margin:0}`;
  });
  const shadow = s.popovers.shadow ? '0 20px 50px rgba(0,0,0,.25)' : 'none';
  const hover =
    s.anim.hover === 'lift' ? '.xs-store .xs-card:hover{transform:translateY(-4px);box-shadow:0 10px 24px rgba(0,0,0,.12)}'
    : s.anim.hover === 'scale' ? '.xs-store .xs-card:hover{transform:scale(1.03)}'
    : s.anim.hover === 'zoom' ? '.xs-store .xs-card:hover .xs-media img{transform:scale(1.08)}' : '';
  const badgePos = s.badges.position === 'tr' ? 'top:8px;right:8px;left:auto;bottom:auto' : s.badges.position === 'bl' ? 'bottom:8px;left:8px;top:auto;right:auto' : 'top:8px;left:8px;bottom:auto;right:auto';

  const rules = [
    `.xs-store{--xs-text:${c.text};--xs-bg:${c.background};--xs-card:${c.card};--xs-border:${c.border};--xs-muted:${c.muted};--xs-primary:${c.primary};--xs-primary-text:${c.primaryText};--xs-accent:${c.accent};--xs-width:${WIDTH[s.page.width]};--xs-cols-m:${s.cards.mobileColumns};--xs-cols-d:${s.cards.columns};`
      + `font-family:${role('body')};font-size:${s.paragraph.size}px;line-height:${LH[s.paragraph.lh]};color:var(--xs-text);background:var(--xs-bg);min-height:100vh}`,
    `.xs-store *{box-sizing:border-box}`,
    `.xs-store .xs-wrap{max-width:var(--xs-width);margin:0 auto;padding-left:20px;padding-right:20px}`,
    `.xs-store .xs-sub{font-family:${role('subheading')}}`,
    `.xs-store .xs-accent{font-family:${role('accent')}}`,
    ...heads,
    `.xs-store a{color:inherit}`,
    `.xs-store .xs-muted{color:var(--xs-muted)}`,
    // buttons
    `.xs-store .xs-btn,.xs-store .xs-btn-primary{background:var(--xs-primary)!important;color:var(--xs-primary-text)!important;border:${s.buttons.border}px solid var(--xs-primary)!important;border-radius:${s.buttons.radius}px!important;${s.buttons.upper ? 'text-transform:uppercase;letter-spacing:.06em;' : ''}font-family:${s.buttons.font === 'accent' ? role('accent') : role('body')};display:inline-flex;align-items:center;justify-content:center;gap:8px;font-weight:600;cursor:pointer;text-decoration:none;transition:opacity .15s}`,
    `.xs-store .xs-btn{padding:12px 26px}`,
    `.xs-store .xs-btn:hover,.xs-store .xs-btn-primary:hover{opacity:.88}`,
    `.xs-store .xs-btn-outline{background:transparent!important;color:inherit!important;border:1px solid currentColor!important;border-radius:${s.buttons.radius}px!important;padding:14px 30px;display:inline-flex;align-items:center;gap:12px;font-weight:700;text-transform:uppercase;letter-spacing:.2em;font-size:12px;text-decoration:none;transition:background .2s,color .2s}`,
    `.xs-store .xs-btn-outline:hover{background:var(--xs-bg)!important;color:var(--xs-text)!important}`,
    `.xs-store .xs-btn-secondary{background:transparent!important;color:var(--xs-text)!important;border:${Math.max(1, s.buttons.sBorder)}px solid var(--xs-text)!important;border-radius:${s.buttons.sRadius}px!important;padding:12px 26px;display:inline-flex;align-items:center;gap:8px;font-weight:600;text-decoration:none;cursor:pointer}`,
    `.xs-store .xs-pill{border:1px solid var(--xs-border);border-radius:${s.buttons.pill}px;padding:4px 12px;font-size:12px}`,
    // existing shopping UI (SiteProducts) picks these up
    `.xs-store .xs-section{background:transparent!important;padding-top:48px!important;padding-bottom:48px!important}`,
    `.xs-store .xs-section>div{max-width:var(--xs-width)!important}`,
    `.xs-store .xs-section h2{font-family:${role('heading')};font-size:${s.h.h2.size > 34 ? 34 : s.h.h2.size}px;color:var(--xs-text)!important}`,
    `.xs-store .xs-section h3{color:var(--xs-muted)!important}`,
    `.xs-store .xs-grid{grid-template-columns:repeat(var(--xs-cols-m),minmax(0,1fr))!important}`,
    `@media(min-width:768px){.xs-store .xs-grid{grid-template-columns:repeat(${Math.min(3, s.cards.columns)},minmax(0,1fr))!important}}`,
    `@media(min-width:1024px){.xs-store .xs-grid{grid-template-columns:repeat(var(--xs-cols-d),minmax(0,1fr))!important}}`,
    `.xs-store .xs-card{background:var(--xs-card)!important;border:${s.cards.border === 'solid' ? '1px solid var(--xs-border)' : '1px solid transparent'}!important;border-radius:${s.cards.radius}px!important;overflow:hidden;transition:transform .2s,box-shadow .2s;color:var(--xs-text)}`,
    `.xs-store .xs-card p{color:inherit!important}`,
    `.xs-store .xs-card .text-slate-500,.xs-store .xs-card .text-slate-400{color:var(--xs-muted)!important}`,
    `.xs-store .xs-media{background:var(--xs-border)!important;overflow:hidden}`,
    `.xs-store .xs-media img{transition:transform .35s}`,
    hover,
    `.xs-store .xs-badge{position:absolute!important;${badgePos};border-radius:${s.badges.radius}px!important;background:${c.soldBg}!important;color:${c.soldText}!important;${s.badges.upper ? 'text-transform:uppercase;letter-spacing:.05em;' : ''}font-size:11px!important;padding:4px 10px!important}`,
    s.cards.quickAdd === 'hover' ? `@media(hover:hover){.xs-store .xs-card .xs-add{opacity:0;transition:opacity .2s}.xs-store .xs-card:hover .xs-add{opacity:1}}` : '',
    `.xs-store .xs-price{color:var(--xs-text)!important}`,
    `.xs-store .xs-badge.xs-sale{background:${c.saleBg}!important;color:${c.saleText}!important}`,
    `.xs-store .xs-sale-price{color:${c.saleBg}!important}`,
    `.xs-store .xs-pname{text-transform:uppercase;letter-spacing:.04em;font-size:13px;font-weight:600}`,
    `.xs-store .xs-secnarrow .xs-wrap{max-width:48rem}.xs-store .xs-secfull .xs-wrap{max-width:none}`,
    `@media(max-width:767px){.xs-store .xs-hm{display:none!important}}@media(min-width:768px){.xs-store .xs-hd{display:none!important}}`,
    `.xs-store .xs-hscroll{display:flex;gap:12px;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none}.xs-store .xs-hscroll::-webkit-scrollbar{display:none}.xs-store .xs-hscroll>*{scroll-snap-align:start;flex:0 0 auto}`,
    `.xs-store .bg-blue-600,.xs-store .hover\\:bg-blue-700:hover{background:var(--xs-primary)!important;color:var(--xs-primary-text)!important}`,
    `.xs-store .text-blue-600,.xs-store .text-blue-700,.xs-store .text-blue-900{color:var(--xs-accent)!important}`,
    `.xs-store .bg-blue-50{background:color-mix(in srgb,var(--xs-accent) 12%,transparent)!important}`,
    `.xs-store input,.xs-store select,.xs-store textarea{background:${c.inputBg}!important;color:${c.inputText}!important;border:${s.inputs.border}px solid ${c.inputBorder}!important;border-radius:${s.inputs.radius}px!important}`,
    `.xs-store .xs-modal>div{background:${c.drawerBg}!important;color:var(--xs-text);border-radius:${s.popovers.radius}px 0 0 ${s.popovers.radius}px;box-shadow:${shadow};border-left:${s.popovers.border}px solid var(--xs-border)}`,
    `.xs-store .xs-modal .text-slate-900,.xs-store .xs-modal .text-slate-700{color:var(--xs-text)!important}`,
    `.xs-store .xs-modal .text-slate-500,.xs-store .xs-modal .text-slate-600{color:var(--xs-muted)!important}`,
    `.xs-store .xs-modal .border-slate-200,.xs-store .xs-modal .border-slate-300,.xs-store .xs-modal .divide-slate-100>*{border-color:var(--xs-border)!important}`,
    `.xs-store .xs-bump{animation:xsbump .4s}@keyframes xsbump{40%{transform:scale(1.25)}}`,
    s.css ? `.xs-store{${s.css}}` : '',
  ];
  return rules.filter(Boolean).join('\n');
}

// ---------- sample data for previews ----------
export const sampleProducts = Array.from({ length: 8 }, (_, i) => ({
  id: `sample-${i}`,
  name: ['Classic sneakers', 'Leather bag', 'Wireless earbuds', 'Ankara dress', 'Smart watch', 'Perfume oil', 'Wrist watch', 'Casual shirt'][i],
  description: 'A great product description goes here.',
  price: [18500, 32000, 24000, 15000, 45000, 9500, 28000, 12000][i],
  category: null as string | null,
  photo_url: null as string | null,
  stock: i === 5 ? 0 : null as number | null,
  taxable: false,
  compare_at_price: i % 3 === 0 ? [24000, 0, 0, 20000, 0, 0, 36000, 0][i] : null as number | null,
  product_type: ['Sneakers', 'Bags', 'Audio', 'Dresses', 'Watches', 'Fragrance', 'Watches', 'Shirts'][i] as string | null,
  handle: `sample-${i}` as string | null,
  vendor: null as string | null,
  tags: [] as string[],
  created_at: null as string | null,
}));
