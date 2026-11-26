'use client';

import { useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronDown, Copy, Eye, EyeOff, GripVertical, ImagePlus, Plus, Trash2, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { FONTS } from '@/lib/store/theme';

export const inp = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-600';
export const lbl = 'mb-1 block text-xs font-semibold text-slate-600';

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return <div className="mb-3"><label className={lbl}>{label}</label>{children}{hint && <p className="mt-1 text-[11px] text-slate-500">{hint}</p>}</div>;
}
export const TextF = ({ label, value, onChange, hint, placeholder }: { label: string; value: string; onChange: (v: string) => void; hint?: string; placeholder?: string }) =>
  <Field label={label} hint={hint}><input className={inp} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} /></Field>;
export const AreaF = ({ label, value, onChange, rows = 4, hint }: { label: string; value: string; onChange: (v: string) => void; rows?: number; hint?: string }) =>
  <Field label={label} hint={hint}><textarea rows={rows} className={inp} value={value} onChange={(e) => onChange(e.target.value)} /></Field>;
export const SelectF = <T extends string>({ label, value, onChange, options }: { label: string; value: T; onChange: (v: T) => void; options: [T, string][] }) =>
  <Field label={label}><select className={inp} value={value} onChange={(e) => onChange(e.target.value as T)}>{options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>;
export const FontF = ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) =>
  <Field label={label}><select className={inp} value={value} onChange={(e) => onChange(e.target.value)}>{FONTS.map((f) => <option key={f}>{f}</option>)}</select></Field>;
export const BoolF = ({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) =>
  <label className="mb-3 flex cursor-pointer items-center justify-between gap-3 text-sm text-slate-800"><span>{label}</span>
    <input type="checkbox" className="h-5 w-5 accent-blue-600" checked={value} onChange={(e) => onChange(e.target.checked)} /></label>;
export const RangeF = ({ label, value, onChange, min, max, unit = '' }: { label: string; value: number; onChange: (v: number) => void; min: number; max: number; unit?: string }) =>
  <Field label={`${label}: ${value}${unit}`}><input type="range" className="w-full accent-blue-600" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} /></Field>;
export function ColorF({ label, value, onChange, allowEmpty }: { label: string; value: string; onChange: (v: string) => void; allowEmpty?: boolean }) {
  const ok = /^#[0-9a-f]{6}$/i.test(value);
  return (
    <Field label={label}>
      <div className="flex items-center gap-2">
        <input type="color" value={ok ? value : '#ffffff'} onChange={(e) => onChange(e.target.value)} className="h-9 w-11 cursor-pointer rounded border border-slate-300 bg-white p-0.5" aria-label={label} />
        <input className={inp} value={value} placeholder={allowEmpty ? 'Theme default' : '#000000'} onChange={(e) => onChange(e.target.value)} />
        {allowEmpty && value && <button onClick={() => onChange('')} className="p-1 text-slate-500" aria-label="Reset"><X className="h-4 w-4" /></button>}
      </div>
    </Field>
  );
}
export const Seg = <T extends string>({ label, value, onChange, options }: { label: string; value: T; onChange: (v: T) => void; options: [T, string][] }) =>
  <Field label={label}><div className="flex overflow-hidden rounded-lg border border-slate-300 text-sm">{options.map(([v, l]) =>
    <button key={v} onClick={() => onChange(v)} className={`flex-1 px-2 py-2 ${value === v ? 'bg-blue-600 font-semibold text-white' : 'bg-white text-slate-700 hover:bg-slate-50'}`}>{l}</button>)}</div></Field>;

async function resize(file: File, max = 1800): Promise<Blob> {
  const bm = await createImageBitmap(file);
  const k = Math.min(1, max / Math.max(bm.width, bm.height));
  const c = document.createElement('canvas'); c.width = Math.round(bm.width * k); c.height = Math.round(bm.height * k);
  c.getContext('2d')!.drawImage(bm, 0, 0, c.width, c.height);
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('Could not process this image.'))), 'image/jpeg', 0.85));
}

export function ImageF({ label, value, onChange, owner }: { label: string; value: string; onChange: (v: string) => void; owner: { userId: string; businessId: string } }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  async function pick(f: File | undefined) {
    if (!f) return;
    setBusy(true); setErr('');
    try {
      const supabase = createClient();
      const path = `${owner.userId}/${owner.businessId}/store-${Date.now()}.jpg`;
      const { error } = await supabase.storage.from('business-photos').upload(path, await resize(f), { contentType: 'image/jpeg', cacheControl: '31536000' });
      if (error) throw error;
      onChange(supabase.storage.from('business-photos').getPublicUrl(path).data.publicUrl);
    } catch (e) { setErr(e instanceof Error ? e.message : 'Upload failed.'); }
    setBusy(false);
  }
  return (
    <Field label={label}>
      {value && /* eslint-disable-next-line @next/next/no-img-element */ <img src={value} alt="" className="mb-2 h-24 w-full rounded-lg border border-slate-200 object-cover" />}
      <div className="flex gap-2">
        <button type="button" onClick={() => ref.current?.click()} disabled={busy} className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50"><ImagePlus className="h-4 w-4" />{busy ? 'Uploading...' : value ? 'Change image' : 'Upload image'}</button>
        {value && <button type="button" onClick={() => onChange('')} className="rounded-lg border border-slate-300 px-3 text-sm text-red-600">Remove</button>}
      </div>
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} />
      {err && <p className="mt-1 text-xs text-red-600">{err}</p>}
    </Field>
  );
}

export type ListKind<T> = { label: string; blank: T; fields: ListField<T>[]; titleKey?: string };
export type ListField<T> = { key: keyof T & string; label: string; area?: boolean; options?: (string | [string, string])[]; image?: boolean };

// Blocks: the items inside a section (slides, tiles, people...). Open one to edit it; drag, move, duplicate, hide or delete it.
export function ListF<T extends Record<string, string>>({ label, noun = 'item', titleKey, items, onChange, blank, fields = [], max = 12, owner, kinds }: {
  label: string; noun?: string; titleKey?: keyof T & string; items: T[]; onChange: (v: T[]) => void; blank?: T; fields?: ListField<T>[]; max?: number; owner?: { userId: string; businessId: string };
  // mixed items: each item has a type, and each type has its own fields (Shopify-style blocks)
  kinds?: Record<string, ListKind<T>>;
}) {
  const [open, setOpen] = useState<number | null>(null);
  const [pick, setPick] = useState(false);
  const fieldsOf = (it: T): ListField<T>[] => (kinds ? kinds[it.type as string]?.fields ?? [] : fields);
  const [drag, setDrag] = useState<number | null>(null);
  const tk = titleKey ?? fields.find((f) => !f.image && !f.options)?.key ?? fields[0]?.key;
  const upd = (i: number, key: string, v: string) => onChange(items.map((x, j) => (j === i ? { ...x, [key]: v } : x)));
  const swap = (i: number, j: number) => { if (j < 0 || j >= items.length) return; const a = [...items]; [a[i], a[j]] = [a[j], a[i]]; onChange(a); setOpen(open === i ? j : open === j ? i : open); };
  const dropOn = (to: number) => { if (drag === null || drag === to) return; const a = [...items]; const [m] = a.splice(drag, 1); a.splice(to, 0, m); onChange(a); setOpen(null); };
  const hidden = (it: T) => (it as Record<string, string>)._hide === '1';
  return (
    <div className="mb-3">
      <p className={lbl}>{label}</p>
      {items.length === 0 && <p className="mb-2 rounded-lg border border-dashed border-slate-300 p-3 text-xs text-slate-500">No {noun}s yet.</p>}
      {items.map((it, i) => {
        const k = kinds?.[it.type as string];
        const main = String(it[(k?.titleKey ?? tk) as string] ?? '').trim();
        const title = kinds ? (k?.label ?? 'Block') + (main ? `: ${main.slice(0, 40)}` : '') : main || `${noun[0].toUpperCase()}${noun.slice(1)} ${i + 1}`;
        const isOpen = open === i;
        return (
          <div key={i} draggable={!isOpen} onDragStart={() => setDrag(i)} onDragEnd={() => setDrag(null)} onDragOver={(e) => { if (drag !== null) e.preventDefault(); }} onDrop={(e) => { e.preventDefault(); dropOn(i); setDrag(null); }}
            className={`mb-1.5 rounded-lg border bg-white ${isOpen ? 'border-blue-600' : 'border-slate-200'} ${drag === i ? 'opacity-40' : ''}`}>
            <div className="flex items-center gap-0.5 px-1 py-0.5">
              <GripVertical className="hidden h-4 w-4 shrink-0 cursor-grab text-slate-300 sm:block" aria-hidden />
              <button onClick={() => setOpen(isOpen ? null : i)} aria-expanded={isOpen} className="flex min-w-0 flex-1 items-center gap-1 px-1 py-2 text-left text-sm font-medium text-slate-800">
                <span className={`truncate ${hidden(it) ? 'text-slate-400 line-through' : ''}`}>{title}</span><ChevronDown className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition ${isOpen ? 'rotate-180' : ''}`} />
              </button>
              <button onClick={() => swap(i, i - 1)} className="p-1.5 text-slate-500" aria-label={`Move ${noun} up`}><ArrowUp className="h-4 w-4" /></button>
              <button onClick={() => swap(i, i + 1)} className="p-1.5 text-slate-500" aria-label={`Move ${noun} down`}><ArrowDown className="h-4 w-4" /></button>
              {items.length < max && <button onClick={() => { const a = [...items]; a.splice(i + 1, 0, { ...it }); onChange(a); setOpen(i + 1); }} className="p-1.5 text-slate-500" aria-label={`Duplicate ${noun}`}><Copy className="h-4 w-4" /></button>}
              <button onClick={() => upd(i, '_hide', hidden(it) ? '' : '1')} className="p-1.5 text-slate-500" aria-label={hidden(it) ? `Show ${noun}` : `Hide ${noun}`}>{hidden(it) ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
              <button onClick={() => { onChange(items.filter((_, j) => j !== i)); setOpen(null); }} className="p-1.5 text-red-500" aria-label={`Delete ${noun}`}><Trash2 className="h-4 w-4" /></button>
            </div>
            {isOpen && (
              <div className="border-t border-slate-200 bg-slate-50 p-3">
                {fieldsOf(it).length === 0 && <p className="text-xs text-slate-500">Nothing to set for this block.</p>}
                {fieldsOf(it).map((f) => f.options
                  ? <SelectF key={f.key} label={f.label} value={it[f.key] ?? ''} options={f.options.map((o) => (typeof o === 'string' ? [o, o] : o) as [string, string])} onChange={(v) => upd(i, f.key, v)} />
                  : f.image && owner
                    ? <ImageF key={f.key} label={f.label} value={it[f.key] ?? ''} owner={owner} onChange={(v) => upd(i, f.key, v)} />
                    : f.area
                      ? <AreaF key={f.key} label={f.label} rows={2} value={it[f.key] ?? ''} onChange={(v) => upd(i, f.key, v)} />
                      : <TextF key={f.key} label={f.label} value={it[f.key] ?? ''} onChange={(v) => upd(i, f.key, v)} />)}
              </div>
            )}
          </div>
        );
      })}
      {items.length < max && kinds
        ? <div>
            <button onClick={() => setPick((v) => !v)} aria-expanded={pick} className="flex items-center gap-1 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm font-medium text-blue-600"><Plus className="h-4 w-4" />Add {noun}</button>
            {pick && <div className="mt-1.5 grid grid-cols-2 gap-1.5 rounded-lg border border-slate-200 bg-white p-2">{Object.entries(kinds).map(([t, kd]) => <button key={t} onClick={() => { onChange([...items, { ...kd.blank, type: t } as T]); setOpen(items.length); setPick(false); }} className="rounded-md border border-slate-200 px-2 py-2 text-left text-sm hover:border-blue-600 hover:text-blue-600">{kd.label}</button>)}</div>}
          </div>
        : items.length < max && blank
        ? <button onClick={() => { onChange([...items, { ...blank }]); setOpen(items.length); }} className="flex items-center gap-1 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm font-medium text-blue-600"><Plus className="h-4 w-4" />Add {noun}</button>
        : <p className="text-[11px] text-slate-500">You can add up to {max} {noun}s.</p>}
    </div>
  );
}
