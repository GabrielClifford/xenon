// Turns the owner's Collections (manual lists and smart rules) into what the storefront needs:
// a handle, a picture and the ordered list of product ids. Reads defensively, so a missing column never breaks the store.

import type { SiteProduct } from '@/components/SiteProducts';

export type StoreCollection = { id: string; title: string; handle: string; image: string; ids: string[] };
type Row = Record<string, unknown>;
type Member = { collection_id: string; product_id: string; position?: number | null };

export const slugify = (v: string) => v.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
const norm = (v: unknown) => String(v ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
const text = (v: unknown) => String(v ?? '').trim().toLowerCase();

function fieldValue(p: SiteProduct, f: string): string | number | string[] | null {
  switch (f) {
    case 'title': case 'name': case 'product_title': return p.name;
    case 'type': case 'product_type': return p.product_type ?? '';
    case 'vendor': case 'brand': return p.vendor ?? '';
    case 'tag': case 'tags': case 'product_tag': return p.tags ?? [];
    case 'category': case 'product_category': return p.category ?? '';
    case 'price': case 'product_price': return p.price;
    case 'compare_at_price': case 'compare_at': return p.compare_at_price ?? 0;
    case 'stock': case 'inventory': case 'inventory_stock': case 'inventory_quantity': return p.stock ?? 999999;
    default: return null;
  }
}

function ruleMatches(p: SiteProduct, rule: Row): boolean | null {
  const f = norm(rule.field ?? rule.column ?? rule.attribute ?? rule.type);
  const c = norm(rule.condition ?? rule.operator ?? rule.relation ?? rule.op ?? 'equals');
  const val = fieldValue(p, f);
  if (val === null) return null; // a rule we do not understand is skipped
  const want = text(rule.value);
  const asList = Array.isArray(val) ? val.map(text) : [text(val)];
  const n = typeof val === 'number' ? val : Number(val);
  const w = Number(rule.value);
  switch (c) {
    case 'equals': case 'is': case 'eq': case 'is_equal_to': case '=': case '==': return asList.some((x) => x === want);
    case 'not_equals': case 'is_not': case 'neq': case 'is_not_equal_to': case '!=': return asList.every((x) => x !== want);
    case 'contains': return asList.some((x) => x.includes(want));
    case 'not_contains': case 'does_not_contain': return asList.every((x) => !x.includes(want));
    case 'starts_with': return asList.some((x) => x.startsWith(want));
    case 'ends_with': return asList.some((x) => x.endsWith(want));
    case 'greater_than': case 'gt': case '>': case 'is_greater_than': return Number.isFinite(n) && Number.isFinite(w) && n > w;
    case 'less_than': case 'lt': case '<': case 'is_less_than': return Number.isFinite(n) && Number.isFinite(w) && n < w;
    case 'is_set': case 'is_not_empty': return asList.some((x) => x !== '');
    case 'is_not_set': case 'is_empty': return asList.every((x) => x === '');
    default: return null;
  }
}

function parseRules(raw: unknown): Row[] {
  let v = raw;
  if (typeof v === 'string') { try { v = JSON.parse(v); } catch { return []; } }
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    const o = v as Row;
    v = o.rules ?? o.conditions ?? [];
  }
  return Array.isArray(v) ? (v.filter((x) => x && typeof x === 'object') as Row[]) : [];
}

export function smartIds(row: Row, products: SiteProduct[]): string[] | null {
  const rules = parseRules(row.rules ?? row.conditions ?? row.rule_set ?? row.smart_rules);
  if (rules.length === 0) return null;
  const any = norm(row.match ?? row.match_type ?? row.applies ?? (row.disjunctive === true ? 'any' : 'all')).startsWith('any') || row.disjunctive === true;
  let understood = 0;
  const ids = products.filter((p) => {
    const results = rules.map((r) => ruleMatches(p, r)).filter((r): r is boolean => r !== null);
    understood = Math.max(understood, results.length);
    if (results.length === 0) return false;
    return any ? results.some(Boolean) : results.every(Boolean);
  }).map((p) => p.id);
  return understood === 0 ? null : ids;
}

const IMG_KEYS = ['image_url', 'image', 'photo_url', 'cover_url', 'banner_url', 'thumbnail_url', 'thumbnail'];
const hidden = (r: Row) => r.published === false || r.visible === false || r.active === false || ['draft', 'archived', 'hidden', 'inactive'].includes(text(r.status));

export function buildCollections(rows: Row[], members: Member[], products: SiteProduct[]): StoreCollection[] {
  const byId = new Map(products.map((p) => [p.id, p]));
  const used = new Set<string>();
  const out: StoreCollection[] = [];
  for (const r of rows) {
    if (!r || typeof r.id !== 'string' || hidden(r)) continue;
    const title = String(r.title ?? r.name ?? '').trim();
    if (!title) continue;
    let handle = typeof r.handle === 'string' && r.handle.trim() ? slugify(r.handle) : slugify(title);
    if (!handle || handle === 'all') handle = `${handle || 'collection'}-c`;
    let h = handle; let n = 2;
    while (used.has(h)) h = `${handle}-${n++}`;
    used.add(h);
    const manual = members.filter((m) => m.collection_id === r.id && byId.has(m.product_id)).sort((a, b) => (a.position ?? 0) - (b.position ?? 0)).map((m) => m.product_id);
    const smart = smartIds(r, products);
    const ids = Array.from(new Set(smart ?? manual));
    const own = IMG_KEYS.map((k) => (typeof r[k] === 'string' ? (r[k] as string) : '')).find((x) => /^https:\/\//i.test(x)) ?? '';
    const image = own || ids.map((id) => byId.get(id)?.photo_url ?? '').find(Boolean) || '';
    out.push({ id: r.id, title, handle: h, image, ids });
  }
  return out;
}

export const ALL_ID = 'all';
export function allCollection(products: SiteProduct[]): StoreCollection {
  return { id: ALL_ID, title: 'Shop all', handle: 'all', image: products.find((p) => p.photo_url)?.photo_url ?? '', ids: products.map((p) => p.id) };
}
export const collectionHref = (slug: string, c: { handle: string }) => `/b/${slug}/collections/${c.handle}`;
export const productHref = (slug: string, p: { id: string; handle?: string | null }) => `/b/${slug}/products/${encodeURIComponent(p.handle || p.id)}`;
