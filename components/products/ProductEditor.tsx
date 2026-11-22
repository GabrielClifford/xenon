'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ImagePlus, Star, Trash2, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { appliesTo, fromInput, toInput, type FieldDefinition, type FieldInput } from '@/lib/customFields';
import {
  MAX_IMAGES,
  MAX_OPTIONS,
  MAX_VARIANTS,
  PRODUCT_COLS,
  VARIANT_COLS,
  checkOptions,
  isWhole,
  marginOf,
  naira,
  parseTags,
  readProduct,
  readVariant,
  slugify,
  statusLabel,
  uniqueHandle,
  variantCombos,
  variantTitle,
  type OptionDef,
  type Product,
  type Status,
  type VariantRow,
} from '@/lib/products';
import { Err, ListSkeleton, SQL_HINT, Toggle, btn, card, danger, field, ghost, labelCls, needsSql } from '@/components/products/ui';

type Img = { key: string; url: string | null; file: File | null; preview: string | null };
type OptForm = { id: string; name: string; values: string[]; draft: string };
// A variant's option values are stored by option id while editing, so renaming an option never loses data.
type VForm = { key: string; id: string | null; ov: Record<string, string>; price: string; compare: string; cost: string; sku: string; barcode: string; stock: string };
type Form = {
  name: string;
  description: string;
  price: string;
  compare: string;
  cost: string;
  sku: string;
  barcode: string;
  track: boolean;
  stock: string;
  oversell: boolean;
  low: string;
  weight: string;
  category: string;
  ptype: string;
  vendor: string;
  tags: string;
  status: Status;
  available: boolean;
  publishAt: string;
  handle: string;
  handleTouched: boolean;
  seoTitle: string;
  seoDesc: string;
  options: OptForm[];
  excluded: string[];
  variants: VForm[];
  custom: Record<string, FieldInput>;
  collections: string[];
};
type Coll = { id: string; title: string; kind: string };

const BUCKET = 'product-images';
const MAX_BYTES = 5 * 1024 * 1024;
const TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const uid = () => crypto.randomUUID();

const blank: Form = {
  name: '', description: '', price: '', compare: '', cost: '', sku: '', barcode: '', track: false, stock: '0', oversell: false, low: '5', weight: '',
  category: '', ptype: '', vendor: '', tags: '', status: 'active', available: true, publishAt: '', handle: '', handleTouched: false, seoTitle: '', seoDesc: '',
  options: [], excluded: [], variants: [], custom: {}, collections: [],
};

const toLocalInput = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

const fKey = (ov: Record<string, string>, opts: OptForm[]) => opts.map((o) => ov[o.id] ?? '').join('\u0001');

// Rebuilds the variant rows from the options, keeping what the user already typed for rows that still exist.
function buildVariants(options: OptForm[], prev: VForm[], excluded: string[], price: string): VForm[] {
  const used = options.filter((o) => o.values.length > 0);
  if (used.length === 0) return [];
  const combos = variantCombos(used.map((o) => ({ name: o.id, values: o.values })));
  if (combos.length > MAX_VARIANTS) return prev;
  const old = new Map(prev.map((v) => [fKey(v.ov, used), v]));
  return combos
    .filter((c) => !excluded.includes(fKey(c, used)))
    .map((c) => old.get(fKey(c, used)) ?? { key: uid(), id: null, ov: c, price, compare: '', cost: '', sku: '', barcode: '', stock: '0' });
}

const vLabel = (v: VForm, opts: OptForm[]) => opts.map((o) => v.ov[o.id]).filter(Boolean).join(' / ') || 'Default';

const sigOf = (f: Form) => JSON.stringify(f);

/* --------------------------------- component -------------------------------- */

export default function ProductEditor({ businessId, productId, onClose }: { businessId: string; productId: string | null; onClose: (changed: boolean) => void }) {
  const sb = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [fatal, setFatal] = useState('');
  const [orig, setOrig] = useState<{ product: Product; variants: VariantRow[] } | null>(null);
  const [form, setForm] = useState<Form>(blank);
  const [sig0, setSig0] = useState(sigOf(blank));
  const [imgs, setImgs] = useState<Img[]>([]);
  const [imgSig0, setImgSig0] = useState('');
  const [defs, setDefs] = useState<FieldDefinition[]>([]);
  const [colls, setColls] = useState<Coll[]>([]);
  const [members0, setMembers0] = useState<string[]>([]);
  const [taken, setTaken] = useState<Set<string>>(new Set());
  const [lists, setLists] = useState<{ cats: string[]; types: string[]; vendors: string[] }>({ cats: [], types: [], vendors: [] });
  const [slug, setSlug] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [allPrice, setAllPrice] = useState('');
  const [allStock, setAllStock] = useState('');

  const set = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }));
  const imgSig = imgs.map((x) => x.url ?? `new:${x.key}`).join('|');
  const dirty = sigOf(form) !== sig0 || imgSig !== imgSig0;

  const load = useCallback(async () => {
    type R = { data: unknown; error: { message: string } | null };
    const none: Promise<R> = Promise.resolve({ data: null, error: null });
    const [prod, vars, cl, df, all, biz, mem] = (await Promise.all([
      productId ? sb.from('products').select(PRODUCT_COLS).eq('id', productId).eq('business_id', businessId).maybeSingle() : none,
      productId ? sb.from('product_variants').select(VARIANT_COLS).eq('product_id', productId).order('position', { ascending: true }) : none,
      sb.from('collections').select('id,title,kind').eq('business_id', businessId).order('title'),
      sb.from('field_definitions').select('id,name,key,type,is_list,description,show_on_site,categories').eq('business_id', businessId).eq('resource', 'product').order('sort_order', { ascending: true }).order('created_at', { ascending: true }),
      sb.from('products').select('id,handle,category,product_type,vendor').eq('business_id', businessId).range(0, 4999),
      sb.from('businesses').select('slug').eq('id', businessId).maybeSingle(),
      productId ? sb.from('collection_products').select('collection_id').eq('product_id', productId) : none,
    ])) as R[];

    const first = prod.error || all.error || cl.error;
    if (first) {
      setFatal(needsSql(first.message) ? SQL_HINT : first.message);
      setLoading(false);
      return;
    }
    if (productId && !prod.data) {
      setFatal('This product was not found. It may have been deleted.');
      setLoading(false);
      return;
    }

    const rows = (all.data ?? []) as { id: string; handle: string | null; category: string | null; product_type: string | null; vendor: string | null }[];
    setTaken(new Set(rows.filter((r) => r.id !== productId && r.handle).map((r) => r.handle as string)));
    const uniq = (xs: (string | null)[]) => Array.from(new Set(xs.filter((x): x is string => !!x && !!x.trim()))).sort();
    setLists({ cats: uniq(rows.map((r) => r.category)), types: uniq(rows.map((r) => r.product_type)), vendors: uniq(rows.map((r) => r.vendor)) });
    setColls(((cl.data ?? []) as Coll[]).map((c) => ({ id: c.id, title: c.title, kind: c.kind })));
    setDefs((df.data ?? []) as FieldDefinition[]);
    setSlug(((biz.data as { slug?: string } | null)?.slug ?? '') as string);

    let f: Form = { ...blank };
    let im: Img[] = [];
    if (productId && prod.data) {
      const p = readProduct(prod.data as Record<string, unknown>);
      const vs = ((vars.data ?? []) as Record<string, unknown>[]).map(readVariant);
      setOrig({ product: p, variants: vs });
      const options: OptForm[] = p.options.map((o) => ({ id: uid(), name: o.name, values: o.values, draft: '' }));
      const byName = new Map(options.map((o) => [o.name, o.id]));
      const custom: Record<string, FieldInput> = {};
      for (const d of (df.data ?? []) as FieldDefinition[]) custom[d.key] = toInput(d, p.custom_fields?.[d.key]);
      f = {
        name: p.name,
        description: p.description ?? '',
        price: String(p.price),
        compare: p.compare_at_price === null ? '' : String(p.compare_at_price),
        cost: p.cost === null ? '' : String(p.cost),
        sku: p.sku ?? '',
        barcode: p.barcode ?? '',
        track: p.track_stock,
        stock: String(p.stock),
        oversell: p.continue_selling,
        low: String(p.low_stock_threshold),
        weight: p.weight_grams === null ? '' : String(p.weight_grams),
        category: p.category ?? '',
        ptype: p.product_type ?? '',
        vendor: p.vendor ?? '',
        tags: p.tags.join(', '),
        status: p.status,
        available: p.available,
        publishAt: toLocalInput(p.publish_at),
        handle: p.handle ?? '',
        handleTouched: !!p.handle,
        seoTitle: p.seo_title ?? '',
        seoDesc: p.seo_description ?? '',
        options,
        excluded: [],
        variants: vs.map((v) => ({
          key: uid(),
          id: v.id,
          ov: Object.fromEntries(Object.entries(v.option_values).flatMap(([n, val]) => (byName.has(n) ? [[byName.get(n) as string, val]] : []))),
          price: String(v.price),
          compare: v.compare_at_price === null ? '' : String(v.compare_at_price),
          cost: v.cost === null ? '' : String(v.cost),
          sku: v.sku ?? '',
          barcode: v.barcode ?? '',
          stock: String(v.stock),
        })),
        custom,
        collections: ((mem.data ?? []) as { collection_id: string }[]).map((m) => m.collection_id),
      };
      setMembers0(f.collections);
      const urls = p.images?.length ? p.images : p.photo_url ? [p.photo_url] : [];
      im = urls.map((u) => ({ key: uid(), url: u, file: null, preview: null }));
    }
    setForm(f);
    setSig0(sigOf(f));
    setImgs(im);
    setImgSig0(im.map((x) => x.url ?? '').join('|'));
    setLoading(false);
  }, [sb, businessId, productId]);

  useEffect(() => {
    load();
  }, [load]);

  /* ---- photos ---- */
  function pickImages(e: React.ChangeEvent<HTMLInputElement>) {
    const files: File[] = Array.from((e.target.files ?? []) as ArrayLike<File>);
    e.target.value = '';
    if (!files.length) return;
    setErr('');
    const room = MAX_IMAGES - imgs.length;
    const added: Img[] = [];
    let problem = '';
    for (const file of files) {
      if (added.length >= room) {
        problem = `You can add up to ${MAX_IMAGES} photos per product.`;
        break;
      }
      if (!TYPES.includes(file.type)) {
        problem = 'Only JPG, PNG or WebP photos can be added.';
        continue;
      }
      if (file.size > MAX_BYTES) {
        problem = 'A photo was skipped because it is over 5 MB.';
        continue;
      }
      added.push({ key: uid(), url: null, file, preview: URL.createObjectURL(file) });
    }
    if (added.length) setImgs((l) => [...l, ...added]);
    if (problem) setErr(problem);
  }
  const removeImage = (key: string) =>
    setImgs((l) => {
      const gone = l.find((x) => x.key === key);
      if (gone?.preview) URL.revokeObjectURL(gone.preview);
      return l.filter((x) => x.key !== key);
    });
  const makeCover = (key: string) =>
    setImgs((l) => {
      const pick = l.find((x) => x.key === key);
      return pick ? [pick, ...l.filter((x) => x.key !== key)] : l;
    });
  async function uploadImage(file: File): Promise<string> {
    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
    const path = `${businessId}/${uid()}.${ext}`;
    const { error } = await sb.storage.from(BUCKET).upload(path, file, { contentType: file.type, cacheControl: '31536000' });
    if (error) throw new Error('Could not upload a photo: ' + error.message);
    return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  }

  /* ---- options and variants ---- */
  function setOptions(options: OptForm[], excluded = form.excluded) {
    setForm((f) => ({ ...f, options, excluded, variants: buildVariants(options, f.variants, excluded, f.price) }));
  }
  function addOption() {
    if (form.options.length >= MAX_OPTIONS) return;
    setForm((f) => ({ ...f, options: [...f.options, { id: uid(), name: '', values: [], draft: '' }] }));
  }
  function removeOption(id: string) {
    const next = form.options.filter((o) => o.id !== id);
    setOptions(next, []);
  }
  function renameOption(id: string, name: string) {
    setForm((f) => ({ ...f, options: f.options.map((o) => (o.id === id ? { ...o, name } : o)) }));
  }
  function addValues(id: string, text: string) {
    const o = form.options.find((x) => x.id === id);
    if (!o) return;
    const have = new Set(o.values.map((v) => v.toLowerCase()));
    const add: string[] = [];
    for (const raw of text.split(/[,\n]/)) {
      const v = raw.trim().replace(/\s+/g, ' ').slice(0, 60);
      if (v && !have.has(v.toLowerCase())) {
        have.add(v.toLowerCase());
        add.push(v);
      }
    }
    if (!add.length) {
      setForm((f) => ({ ...f, options: f.options.map((x) => (x.id === id ? { ...x, draft: '' } : x)) }));
      return;
    }
    const next = form.options.map((x) => (x.id === id ? { ...x, values: [...x.values, ...add].slice(0, 50), draft: '' } : x));
    const used = next.filter((x) => x.values.length > 0).map((x) => ({ name: x.id, values: x.values }));
    if (variantCombos(used).length > MAX_VARIANTS) {
      setErr(`That makes more than ${MAX_VARIANTS} variants. Remove some values first.`);
      return;
    }
    setErr('');
    setOptions(next);
  }
  function removeValue(id: string, value: string) {
    setOptions(form.options.map((o) => (o.id === id ? { ...o, values: o.values.filter((v) => v !== value) } : o)), []);
  }
  function setVariant(key: string, patch: Partial<VForm>) {
    setForm((f) => ({ ...f, variants: f.variants.map((v) => (v.key === key ? { ...v, ...patch } : v)) }));
  }
  function dropVariant(v: VForm) {
    const used = form.options.filter((o) => o.values.length > 0);
    setForm((f) => ({ ...f, excluded: [...f.excluded, fKey(v.ov, used)], variants: f.variants.filter((x) => x.key !== v.key) }));
  }
  function setAll(field: 'price' | 'stock', value: string) {
    if (!/^\d{1,9}$/.test(value)) return setErr(field === 'price' ? 'Enter a whole number of naira.' : 'Enter a whole number.');
    setErr('');
    setForm((f) => ({ ...f, variants: f.variants.map((v) => ({ ...v, [field]: value })) }));
  }

  /* ---- save ---- */
  const hasVariants = form.options.length > 0;
  const activeDefs = defs.filter((d) => appliesTo(d, form.category));
  const margin = !hasVariants && isWhole(form.price) && isWhole(form.cost) ? marginOf(Number(form.price), Number(form.cost)) : null;

  async function save() {
    setErr('');
    const f = form;
    const name = f.name.trim();
    if (!name) return setErr('Enter a product name.');

    const optDefs: OptionDef[] = f.options.map((o) => ({ name: o.name.trim(), values: o.values }));
    const money = (s: string, what: string): string => (s.trim() === '' || isWhole(s) ? '' : `${what} must be a whole number of naira.`);
    let price = 0;
    if (hasVariants) {
      const m = checkOptions(optDefs);
      if (m) return setErr(m);
      if (f.variants.length === 0) return setErr('Every combination was removed. Add a value, or remove the options.');
      for (const v of f.variants) {
        const label = vLabel(v, f.options);
        if (!isWhole(v.price)) return setErr(`Enter a price for ${label}.`);
        const e = money(v.compare, 'Compare-at price') || money(v.cost, 'Cost') || (v.stock.trim() === '' || isWhole(v.stock) ? '' : 'Stock must be a whole number.');
        if (e) return setErr(`${label}: ${e}`);
        if (v.compare.trim() && Number(v.compare) <= Number(v.price)) return setErr(`${label}: the compare-at price must be higher than the price.`);
        if (v.sku.length > 60 || v.barcode.length > 60) return setErr(`${label}: SKU and barcode can be up to 60 characters.`);
      }
      price = Math.min(...f.variants.map((v) => Number(v.price)));
    } else {
      if (!isWhole(f.price)) return setErr('Enter a valid price in naira.');
      price = Number(f.price);
      const e = money(f.compare, 'Compare-at price') || money(f.cost, 'Cost');
      if (e) return setErr(e);
      if (f.compare.trim() && Number(f.compare) <= price) return setErr('The compare-at price must be higher than the price.');
      if (f.track && !isWhole(f.stock)) return setErr('Enter the quantity you have in stock.');
    }
    if (!isWhole(f.low)) return setErr('Enter the number at which you want a low-stock warning.');
    if (f.weight.trim() && !isWhole(f.weight)) return setErr('Weight must be a whole number of grams.');

    let handle = f.handleTouched && f.handle.trim() ? slugify(f.handle) : '';
    if (handle && taken.has(handle)) return setErr('Another product already uses that URL handle.');
    if (!handle) handle = uniqueHandle(name, taken);

    let publishAt: string | null = null;
    if (f.status === 'active' && f.publishAt) {
      const d = new Date(f.publishAt);
      if (Number.isNaN(d.getTime())) return setErr('The publish date is not valid.');
      publishAt = d.toISOString();
    }

    const custom_fields: Record<string, unknown> = {};
    for (const d of activeDefs) {
      const v = fromInput(d, f.custom[d.key]);
      if (v !== undefined) custom_fields[d.key] = v;
    }

    setSaving(true);
    try {
      const urls = await Promise.all(imgs.map((x) => (x.file ? uploadImage(x.file) : Promise.resolve(x.url as string))));
      const payload = {
        name,
        description: f.description.trim() || null,
        price,
        category: f.category.trim().slice(0, 100) || null,
        images: urls,
        photo_url: urls[0] ?? null,
        custom_fields,
        available: f.available,
        status: f.status,
        handle,
        compare_at_price: hasVariants || !f.compare.trim() ? null : Number(f.compare),
        cost: hasVariants || !f.cost.trim() ? null : Number(f.cost),
        sku: hasVariants ? null : f.sku.trim().slice(0, 60) || null,
        barcode: hasVariants ? null : f.barcode.trim().slice(0, 60) || null,
        track_stock: f.track,
        stock: hasVariants ? f.variants.reduce((s, v) => s + (isWhole(v.stock) ? Number(v.stock) : 0), 0) : f.track ? Number(f.stock) : Number(f.stock) || 0,
        continue_selling: f.oversell,
        low_stock_threshold: Number(f.low),
        weight_grams: f.weight.trim() ? Number(f.weight) : null,
        vendor: f.vendor.trim().slice(0, 100) || null,
        product_type: f.ptype.trim().slice(0, 100) || null,
        tags: parseTags(f.tags),
        seo_title: f.seoTitle.trim().slice(0, 70) || null,
        seo_description: f.seoDesc.trim().slice(0, 320) || null,
        publish_at: publishAt,
        options: hasVariants ? optDefs : [],
      };

      let id = productId;
      if (id) {
        const { error } = await sb.from('products').update(payload).eq('id', id).eq('business_id', businessId);
        if (error) throw new Error(error.message);
      } else {
        const { data, error } = await sb.from('products').insert({ ...payload, business_id: businessId }).select('id').single();
        if (error) throw new Error(error.message);
        id = (data as { id: string }).id;
      }

      // Variants: remove the ones that are gone first, then update, then add new ones.
      const keep = new Set(f.variants.filter((v) => v.id).map((v) => v.id as string));
      const gone = (orig?.variants ?? []).filter((v) => !hasVariants || !keep.has(v.id)).map((v) => v.id);
      if (gone.length) {
        const { error } = await sb.from('product_variants').delete().in('id', gone).eq('business_id', businessId);
        if (error) throw new Error(error.message);
      }
      if (hasVariants) {
        const nameOf = new Map(f.options.map((o) => [o.id, o.name.trim()]));
        const row = (v: VForm, i: number) => {
          const ov: Record<string, string> = {};
          for (const [oid, val] of Object.entries(v.ov)) ov[nameOf.get(oid) ?? oid] = val;
          return {
            business_id: businessId,
            product_id: id as string,
            title: variantTitle(ov, optDefs),
            option_values: ov,
            price: Number(v.price),
            compare_at_price: v.compare.trim() ? Number(v.compare) : null,
            cost: v.cost.trim() ? Number(v.cost) : null,
            sku: v.sku.trim() || null,
            barcode: v.barcode.trim() || null,
            stock: v.stock.trim() ? Number(v.stock) : 0,
            position: i,
          };
        };
        const existing = f.variants.map((v, i) => ({ v, i })).filter((x) => x.v.id);
        const fresh = f.variants.map((v, i) => ({ v, i })).filter((x) => !x.v.id);
        if (existing.length) {
          const { error } = await sb.from('product_variants').upsert(existing.map((x) => ({ id: x.v.id, ...row(x.v, x.i) })), { onConflict: 'id' });
          if (error) throw new Error(error.message);
        }
        if (fresh.length) {
          const { error } = await sb.from('product_variants').insert(fresh.map((x) => row(x.v, x.i)));
          if (error) throw new Error(error.message);
        }
      }

      // Manual collections
      const before = new Set(members0);
      const after = new Set(f.collections);
      const drop = [...before].filter((c) => !after.has(c));
      const add = [...after].filter((c) => !before.has(c));
      if (drop.length) {
        const { error } = await sb.from('collection_products').delete().eq('product_id', id).in('collection_id', drop);
        if (error) throw new Error(error.message);
      }
      for (const cid of add) {
        const { data: last } = await sb.from('collection_products').select('position').eq('collection_id', cid).order('position', { ascending: false }).limit(1);
        const pos = ((last as { position: number }[] | null)?.[0]?.position ?? -1) + 1;
        const { error } = await sb.from('collection_products').upsert({ collection_id: cid, product_id: id, business_id: businessId, position: pos }, { onConflict: 'collection_id,product_id', ignoreDuplicates: true });
        if (error) throw new Error(error.message);
      }
      onClose(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not save this product.');
      setSaving(false);
    }
  }

  async function duplicate() {
    if (!orig) return;
    if (dirty && !window.confirm('Your unsaved changes will not be copied. Duplicate the saved version?')) return;
    setSaving(true);
    setErr('');
    try {
      const p = orig.product;
      const { id: _id, created_at: _c, ...rest } = p;
      void _id;
      void _c;
      const { data, error } = await sb
        .from('products')
        .insert({ ...rest, business_id: businessId, name: `${p.name} (copy)`.slice(0, 200), status: 'draft', publish_at: null, handle: uniqueHandle(`${p.name} copy`, taken) })
        .select('id')
        .single();
      if (error) throw new Error(error.message);
      const newId = (data as { id: string }).id;
      if (orig.variants.length) {
        const rows = orig.variants.map((v) => ({ business_id: businessId, product_id: newId, title: v.title, option_values: v.option_values, price: v.price, compare_at_price: v.compare_at_price, cost: v.cost, sku: v.sku, barcode: v.barcode, stock: v.stock, position: v.position }));
        const { error: ve } = await sb.from('product_variants').insert(rows);
        if (ve) throw new Error(ve.message);
      }
      onClose(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not duplicate this product.');
      setSaving(false);
    }
  }

  async function remove() {
    if (!productId || !window.confirm(`Delete "${form.name}"? This cannot be undone.`)) return;
    setSaving(true);
    const { error } = await sb.from('products').delete().eq('id', productId).eq('business_id', businessId);
    if (error) {
      setErr(error.message);
      setSaving(false);
      return;
    }
    onClose(true);
  }

  function back() {
    if (dirty && !window.confirm('You have unsaved changes. Leave without saving?')) return;
    onClose(false);
  }

  if (loading) return <ListSkeleton rows={4} />;
  if (fatal) {
    return (
      <div className="space-y-3">
        <button type="button" onClick={() => onClose(false)} className="inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900">
          <ArrowLeft className="h-4 w-4" /> Back to products
        </button>
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">{fatal}</p>
      </div>
    );
  }

  const origin = typeof window === 'undefined' ? '' : window.location.origin;
  const previewHandle = (form.handleTouched && form.handle.trim() ? slugify(form.handle) : slugify(form.name || 'product')) || 'product';
  const manual = colls.filter((c) => c.kind === 'manual');
  const text = (v: FieldInput | undefined) => (typeof v === 'string' ? v : '');

  return (
    <div className="space-y-5 pb-10">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={back} aria-label="Back to products" className="rounded-full border border-slate-200 p-2 text-slate-600 hover:bg-slate-50">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h2 className="min-w-0 flex-1 truncate font-display text-xl font-bold text-slate-900">{productId ? form.name || 'Edit product' : 'Add product'}</h2>
        <select aria-label="Status" className={`${field} w-auto`} value={form.status} onChange={(e) => set({ status: e.target.value as Status })}>
          {(['active', 'draft', 'archived'] as Status[]).map((s) => (
            <option key={s} value={s}>
              {statusLabel[s]}
            </option>
          ))}
        </select>
        <button type="button" className={btn} onClick={save} disabled={saving || (!!productId && !dirty)}>
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>

      <Err text={err} />

      <div className="grid gap-5 lg:grid-cols-[1fr_20rem] lg:items-start">
        <div className="space-y-5">
          <section className={`${card} space-y-3`}>
            <div>
              <label className={labelCls}>Name</label>
              <input className={field} maxLength={200} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Ankara dress" />
            </div>
            <div>
              <label className={labelCls}>Description</label>
              <textarea className={field} rows={5} maxLength={5000} value={form.description} onChange={(e) => set({ description: e.target.value })} placeholder="What it is, what it is made of, sizes, delivery..." />
            </div>
          </section>

          <section className={card}>
            <p className="font-display font-bold text-slate-900">Photos</p>
            <div className="mt-3 flex flex-wrap gap-3">
              {imgs.map((x, i) => (
                <div key={x.key} className="relative h-28 w-28 overflow-hidden rounded-xl border border-slate-200">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={x.preview ?? x.url ?? ''} alt={`Photo ${i + 1}`} className="h-full w-full object-cover" />
                  <button type="button" onClick={() => removeImage(x.key)} aria-label="Remove photo" className="absolute right-1 top-1 rounded-full bg-white/90 p-1 text-slate-700 shadow hover:bg-white">
                    <X className="h-3.5 w-3.5" />
                  </button>
                  {i === 0 ? (
                    <span className="absolute bottom-1 left-1 rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-semibold text-white">Cover</span>
                  ) : (
                    <button type="button" onClick={() => makeCover(x.key)} className="absolute bottom-1 left-1 flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-slate-700 shadow hover:bg-white">
                      <Star className="h-3 w-3" /> Make cover
                    </button>
                  )}
                </div>
              ))}
              {imgs.length < MAX_IMAGES && (
                <label className="flex h-28 w-28 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-slate-300 text-xs font-medium text-slate-500 hover:border-blue-500 hover:text-blue-600">
                  <ImagePlus className="h-6 w-6" />
                  Add photos
                  <input type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={pickImages} className="hidden" />
                </label>
              )}
            </div>
            <p className="mt-1.5 text-xs text-slate-400">Up to {MAX_IMAGES} photos (JPG, PNG or WebP, 5 MB each). The first one is the cover.</p>
          </section>

          <section className={`${card} space-y-3`}>
            <p className="font-display font-bold text-slate-900">Pricing</p>
            {hasVariants ? (
              <p className="text-sm text-slate-500">This product has variants, so each variant has its own price below.</p>
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <label className={labelCls}>Price (₦)</label>
                    <input className={field} inputMode="numeric" value={form.price} onChange={(e) => set({ price: e.target.value.replace(/\D/g, '') })} placeholder="15000" />
                  </div>
                  <div>
                    <label className={labelCls}>Compare-at price (₦)</label>
                    <input className={field} inputMode="numeric" value={form.compare} onChange={(e) => set({ compare: e.target.value.replace(/\D/g, '') })} placeholder="Old price" />
                  </div>
                  <div>
                    <label className={labelCls}>Cost per item (₦)</label>
                    <input className={field} inputMode="numeric" value={form.cost} onChange={(e) => set({ cost: e.target.value.replace(/\D/g, '') })} placeholder="What it costs you" />
                  </div>
                </div>
                <p className="text-xs text-slate-500">
                  The compare-at price shows crossed out next to the price, for sales. Customers never see your cost.
                  {margin && (
                    <span className={`ml-1 font-semibold ${margin.profit < 0 ? 'text-red-600' : 'text-slate-700'}`}>
                      Profit {naira(margin.profit)} · Margin {margin.pct}%
                    </span>
                  )}
                </p>
              </>
            )}
          </section>

          <section className={`${card} space-y-4`}>
            <p className="font-display font-bold text-slate-900">Inventory</p>
            <Toggle on={form.track} onChange={(v) => set({ track: v })} label="Track stock" hint="Counts down what you have and warns you when it runs low." />
            {form.track && (
              <div className="grid gap-3 sm:grid-cols-2">
                {!hasVariants && (
                  <div>
                    <label className={labelCls}>Quantity in stock</label>
                    <input className={field} inputMode="numeric" value={form.stock} onChange={(e) => set({ stock: e.target.value.replace(/\D/g, '') })} />
                    <p className="mt-1 text-xs text-slate-400">With several locations, changes here go to your default location. Use Inventory to count each location.</p>
                  </div>
                )}
                <div>
                  <label className={labelCls}>Warn me when stock is at or below</label>
                  <input className={field} inputMode="numeric" value={form.low} onChange={(e) => set({ low: e.target.value.replace(/\D/g, '') })} />
                </div>
              </div>
            )}
            {form.track && <Toggle on={form.oversell} onChange={(v) => set({ oversell: v })} label="Keep selling when out of stock" hint="Customers can still order it (for example made-to-order items)." />}
            <div className="grid gap-3 sm:grid-cols-3">
              {!hasVariants && (
                <>
                  <div>
                    <label className={labelCls}>SKU</label>
                    <input className={field} maxLength={60} value={form.sku} onChange={(e) => set({ sku: e.target.value })} />
                  </div>
                  <div>
                    <label className={labelCls}>Barcode</label>
                    <input className={field} maxLength={60} value={form.barcode} onChange={(e) => set({ barcode: e.target.value })} />
                  </div>
                </>
              )}
              <div>
                <label className={labelCls}>Weight (grams)</label>
                <input className={field} inputMode="numeric" value={form.weight} onChange={(e) => set({ weight: e.target.value.replace(/\D/g, '') })} />
              </div>
            </div>
          </section>

          <section className={`${card} space-y-4`}>
            <div>
              <p className="font-display font-bold text-slate-900">Variants</p>
              <p className="text-sm text-slate-500">Does it come in different sizes, colours or materials? Add options and each combination gets its own price, SKU and stock.</p>
            </div>

            {form.options.map((o, i) => (
              <div key={o.id} className="space-y-2 rounded-xl border border-slate-200 p-3">
                <div className="flex items-center gap-2">
                  <input className={field} maxLength={40} placeholder={i === 0 ? 'Option name, for example Size' : i === 1 ? 'For example Colour' : 'For example Material'} value={o.name} onChange={(e) => renameOption(o.id, e.target.value)} />
                  <button type="button" onClick={() => removeOption(o.id)} aria-label="Remove option" className="rounded-lg p-2 text-red-500 hover:bg-red-50">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {o.values.map((v) => (
                    <span key={v} className="inline-flex items-center gap-1 rounded-full bg-slate-100 py-1 pl-3 pr-1.5 text-sm text-slate-800">
                      {v}
                      <button type="button" onClick={() => removeValue(o.id, v)} aria-label={`Remove ${v}`} className="rounded-full p-0.5 text-slate-500 hover:bg-slate-200">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  ))}
                  <input
                    className="min-w-[10rem] flex-1 rounded-full border border-dashed border-slate-300 px-3 py-1 text-sm outline-none focus:border-blue-600"
                    placeholder="Add a value, then press Enter"
                    value={o.draft}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val.includes(',')) addValues(o.id, val);
                      else setForm((f) => ({ ...f, options: f.options.map((x) => (x.id === o.id ? { ...x, draft: val } : x)) }));
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addValues(o.id, o.draft);
                      }
                    }}
                    onBlur={() => o.draft.trim() && addValues(o.id, o.draft)}
                  />
                </div>
              </div>
            ))}

            {form.options.length < MAX_OPTIONS && (
              <button type="button" className={ghost} onClick={addOption}>
                {form.options.length === 0 ? 'Add options like size or colour' : 'Add another option'}
              </button>
            )}

            {hasVariants && form.variants.length > 0 && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-end gap-3 rounded-xl bg-slate-50 p-3">
                  <div>
                    <label className={labelCls}>Set every price (₦)</label>
                    <div className="flex gap-2">
                      <input className={`${field} w-32`} inputMode="numeric" value={allPrice} onChange={(e) => setAllPrice(e.target.value.replace(/\D/g, ''))} />
                      <button type="button" className={ghost} onClick={() => setAll('price', allPrice)}>
                        Apply
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Set every stock</label>
                    <div className="flex gap-2">
                      <input className={`${field} w-32`} inputMode="numeric" value={allStock} onChange={(e) => setAllStock(e.target.value.replace(/\D/g, ''))} />
                      <button type="button" className={ghost} onClick={() => setAll('stock', allStock)}>
                        Apply
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500">{form.variants.length} variant{form.variants.length === 1 ? '' : 's'}</p>
                </div>
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full min-w-[760px] text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-3 py-2">Variant</th>
                        <th className="px-2 py-2">Price (₦)</th>
                        <th className="px-2 py-2">Compare-at</th>
                        <th className="px-2 py-2">Cost</th>
                        <th className="px-2 py-2">SKU</th>
                        <th className="px-2 py-2">Barcode</th>
                        <th className="px-2 py-2">Stock</th>
                        <th className="px-2 py-2" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {form.variants.map((v) => {
                        const num = (key: 'price' | 'compare' | 'cost' | 'stock') => (
                          <input className="w-24 rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-blue-600" inputMode="numeric" value={v[key]} onChange={(e) => setVariant(v.key, { [key]: e.target.value.replace(/\D/g, '') })} />
                        );
                        return (
                          <tr key={v.key}>
                            <td className="px-3 py-2 font-medium text-slate-900">{vLabel(v, form.options)}</td>
                            <td className="px-2 py-2">{num('price')}</td>
                            <td className="px-2 py-2">{num('compare')}</td>
                            <td className="px-2 py-2">{num('cost')}</td>
                            <td className="px-2 py-2">
                              <input className="w-28 rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-blue-600" maxLength={60} value={v.sku} onChange={(e) => setVariant(v.key, { sku: e.target.value })} />
                            </td>
                            <td className="px-2 py-2">
                              <input className="w-28 rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-blue-600" maxLength={60} value={v.barcode} onChange={(e) => setVariant(v.key, { barcode: e.target.value })} />
                            </td>
                            <td className="px-2 py-2">{num('stock')}</td>
                            <td className="px-2 py-2">
                              <button type="button" onClick={() => dropVariant(v)} aria-label={`Remove ${vLabel(v, form.options)}`} className="rounded-lg p-1.5 text-red-500 hover:bg-red-50">
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>

          <section className={`${card} space-y-3`}>
            <div>
              <p className="font-display font-bold text-slate-900">Search engine listing</p>
              <p className="text-sm text-slate-500">How this product can appear on Google. Xenon adds this to your shop page for search engines.</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="truncate text-sm font-medium text-blue-700">{form.seoTitle.trim() || form.name.trim() || 'Product name'}</p>
              <p className="truncate text-xs text-green-700">
                {origin}/b/{slug || 'your-shop'}#{previewHandle}
              </p>
              <p className="line-clamp-2 text-xs text-slate-600">{form.seoDesc.trim() || form.description.trim() || 'The description will show here.'}</p>
            </div>
            <div>
              <label className={labelCls}>
                Page title <span className="text-slate-400">({form.seoTitle.length}/70)</span>
              </label>
              <input className={field} maxLength={70} value={form.seoTitle} onChange={(e) => set({ seoTitle: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>
                Description <span className="text-slate-400">({form.seoDesc.length}/320)</span>
              </label>
              <textarea className={field} rows={3} maxLength={320} value={form.seoDesc} onChange={(e) => set({ seoDesc: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>URL handle</label>
              <input
                className={field}
                maxLength={100}
                value={form.handleTouched ? form.handle : previewHandle}
                onChange={(e) => set({ handle: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'), handleTouched: true })}
              />
              <p className="mt-1 text-xs text-slate-400">Used to find this product in CSV files. Lowercase letters, numbers and dashes.</p>
            </div>
          </section>

          {activeDefs.length > 0 && (
            <section className={`${card} space-y-3`}>
              <p className="font-display font-bold text-slate-900">Custom fields</p>
              {activeDefs.map((d) => {
                const value = form.custom[d.key];
                const setCustom = (v: FieldInput) => setForm((f) => ({ ...f, custom: { ...f.custom, [d.key]: v } }));
                return (
                  <div key={d.id}>
                    <label className={labelCls}>
                      {d.name}
                      {d.is_list ? ' (separate values with commas)' : ''}
                    </label>
                    {d.type === 'boolean' ? (
                      <label className="flex items-center gap-2 text-sm text-slate-700">
                        <input type="checkbox" checked={value === true} onChange={(e) => setCustom(e.target.checked)} />
                        Yes
                      </label>
                    ) : d.type === 'long_text' && !d.is_list ? (
                      <textarea rows={3} className={field} value={text(value)} onChange={(e) => setCustom(e.target.value)} />
                    ) : (
                      <input
                        className={field}
                        type={d.is_list ? 'text' : d.type === 'date' ? 'date' : d.type === 'url' ? 'url' : 'text'}
                        inputMode={d.type === 'number' ? 'decimal' : undefined}
                        placeholder={d.type === 'color' ? 'For example Red or #FF5733' : d.type === 'url' ? 'https://' : undefined}
                        value={text(value)}
                        onChange={(e) => setCustom(e.target.value)}
                      />
                    )}
                    {d.description && <p className="mt-1 text-xs text-slate-400">{d.description}</p>}
                  </div>
                );
              })}
            </section>
          )}
        </div>

        <div className="space-y-5">
          <section className={`${card} space-y-3`}>
            <p className="font-display font-bold text-slate-900">Organisation</p>
            <div>
              <label className={labelCls}>Category</label>
              <input className={field} list="pe-cats" maxLength={100} value={form.category} onChange={(e) => set({ category: e.target.value })} placeholder="For example Dresses" />
              <datalist id="pe-cats">
                {lists.cats.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            <div>
              <label className={labelCls}>Product type</label>
              <input className={field} list="pe-types" maxLength={100} value={form.ptype} onChange={(e) => set({ ptype: e.target.value })} />
              <datalist id="pe-types">
                {lists.types.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            <div>
              <label className={labelCls}>Vendor</label>
              <input className={field} list="pe-vendors" maxLength={100} value={form.vendor} onChange={(e) => set({ vendor: e.target.value })} />
              <datalist id="pe-vendors">
                {lists.vendors.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            <div>
              <label className={labelCls}>Tags</label>
              <input className={field} value={form.tags} onChange={(e) => set({ tags: e.target.value })} placeholder="sale, new, gift" />
              <p className="mt-1 text-xs text-slate-400">Separate with commas. Tags power smart collections and search.</p>
            </div>
          </section>

          <section className={`${card} space-y-3`}>
            <p className="font-display font-bold text-slate-900">Visibility</p>
            <Toggle on={!form.available} onChange={(v) => set({ available: !v })} label="Show as sold out" hint="Customers see it but cannot order it." />
            {form.status === 'active' && (
              <div>
                <label className={labelCls}>Publish on (optional)</label>
                <input type="datetime-local" className={field} value={form.publishAt} onChange={(e) => set({ publishAt: e.target.value })} />
                <p className="mt-1 text-xs text-slate-400">Leave empty to show it on your website right away. Otherwise it appears at that time.</p>
              </div>
            )}
            {form.status === 'draft' && <p className="text-xs text-slate-500">Drafts are hidden from your website.</p>}
            {form.status === 'archived' && <p className="text-xs text-slate-500">Archived products are hidden from your website but kept for your records.</p>}
          </section>

          <section className={`${card} space-y-2`}>
            <p className="font-display font-bold text-slate-900">Collections</p>
            {manual.length === 0 ? (
              <p className="text-sm text-slate-500">No manual collections yet. Create one in the Collections tab.</p>
            ) : (
              manual.map((c) => (
                <label key={c.id} className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={form.collections.includes(c.id)} onChange={(e) => set({ collections: e.target.checked ? [...form.collections, c.id] : form.collections.filter((x) => x !== c.id) })} />
                  {c.title}
                </label>
              ))
            )}
            <p className="text-xs text-slate-400">Smart collections add matching products by themselves.</p>
          </section>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className={btn} onClick={save} disabled={saving || (!!productId && !dirty)}>
          {saving ? 'Saving...' : productId ? 'Save changes' : 'Add product'}
        </button>
        <button type="button" className={ghost} onClick={back} disabled={saving}>
          {dirty ? 'Discard' : 'Close'}
        </button>
        {productId && (
          <>
            <button type="button" className={ghost} onClick={duplicate} disabled={saving}>
              Duplicate
            </button>
            <button type="button" className={`${danger} sm:ml-auto`} onClick={remove} disabled={saving}>
              Delete product
            </button>
          </>
        )}
      </div>
    </div>
  );
}
