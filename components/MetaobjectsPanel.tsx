'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import {
  entryTitle, readFields, slugify, typeOptions,
  type Def, type Entry, type FDef, type FType, type Val,
} from '@/lib/metaobjects';

const card = 'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm';
const field = 'w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-blue-500';
const label = 'mb-1 block text-sm font-medium text-slate-700';
const primary = 'rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50';
const ghost = 'rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50';

function Note({ text }: { text: string }) {
  if (!text) return null;
  const bad = /fail|error|could not|must|need|invalid/i.test(text);
  return <p className={`mt-3 text-sm ${bad ? 'text-red-600' : 'text-green-700'}`}>{text}</p>;
}

function Back({ onClick, text }: { onClick: () => void; text: string }) {
  return (
    <button onClick={onClick} className="mb-4 flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900">
      <ArrowLeft className="h-4 w-4" /> {text}
    </button>
  );
}

type Mode =
  | { kind: 'list' }
  | { kind: 'def'; id: string | null }
  | { kind: 'entries'; defId: string }
  | { kind: 'entry'; defId: string; id: string | null };

export default function MetaobjectsPanel({ businessId }: { businessId: string }) {
  const [defs, setDefs] = useState<Def[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<Mode>({ kind: 'list' });
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);

  // definition form
  const [dName, setDName] = useState('');
  const [dFields, setDFields] = useState<FDef[]>([]);
  const [dShow, setDShow] = useState(true);
  const [lockedKeys, setLockedKeys] = useState<string[]>([]);

  // entry form
  const [eStatus, setEStatus] = useState<'active' | 'draft'>('draft');
  const [eVals, setEVals] = useState<Record<string, Val>>({});

  const load = useCallback(async () => {
    const sb = createClient();
    const [d, e] = await Promise.all([
      sb.from('metaobject_definitions').select('*').eq('business_id', businessId).order('created_at'),
      sb.from('metaobject_entries').select('*').eq('business_id', businessId).order('created_at', { ascending: false }),
    ]);
    if (d.error || e.error) {
      setMsg('Could not load: ' + (d.error?.message ?? e.error?.message) + '. Have you run metaobjects.sql in Supabase?');
    } else {
      setDefs(((d.data ?? []) as Def[]).map((x) => ({ ...x, fields: readFields(x.fields) })));
      setEntries((e.data ?? []) as Entry[]);
    }
    setLoading(false);
  }, [businessId]);

  useEffect(() => {
    load();
  }, [load]);

  // ---------- definitions ----------
  function openDef(id: string | null) {
    setMsg('');
    const d = defs.find((x) => x.id === id);
    setDName(d?.name ?? '');
    setDFields(d?.fields ?? [{ key: 'title', label: 'Title', type: 'text' }]);
    setDShow(d?.show_on_site ?? true);
    setLockedKeys(d?.fields.map((f) => f.key) ?? []);
    setMode({ kind: 'def', id });
  }

  function addField() {
    setDFields((f) => [...f, { key: '', label: '', type: 'text' }]);
  }

  function patchField(i: number, patch: Partial<FDef>) {
    setDFields((f) => f.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  }

  async function saveDef() {
    if (mode.kind !== 'def') return;
    const name = dName.trim();
    if (!name) return setMsg('Could not save: give this content type a name.');
    const cleaned: FDef[] = [];
    const used = new Set<string>();
    for (const f of dFields) {
      const lab = f.label.trim();
      if (!lab) return setMsg('Could not save: every field needs a name.');
      let key = lockedKeys.includes(f.key) ? f.key : slugify(lab).replace(/-/g, '_') || 'field';
      if (!lockedKeys.includes(f.key)) {
        let n = 2;
        const base = key;
        while (used.has(key) || lockedKeys.includes(key)) key = `${base}_${n++}`;
      }
      if (used.has(key)) return setMsg('Could not save: two fields have the same name.');
      used.add(key);
      cleaned.push({ key, label: lab, type: f.type });
    }
    if (cleaned.length === 0) return setMsg('Could not save: add at least one field.');
    setSaving(true);
    setMsg('');
    const sb = createClient();
    const row = { name, fields: cleaned, show_on_site: dShow };
    const { error } =
      mode.id === null
        ? await sb.from('metaobject_definitions').insert({ ...row, business_id: businessId, handle: slugify(name) || 'type' })
        : await sb.from('metaobject_definitions').update(row).eq('id', mode.id);
    setSaving(false);
    if (error) {
      return setMsg(
        /duplicate|unique/i.test(error.message)
          ? 'Could not save: you already have a content type with that name.'
          : 'Could not save: ' + error.message
      );
    }
    await load();
    setMode({ kind: 'list' });
  }

  async function deleteDef(d: Def) {
    const n = entries.filter((e) => e.definition_id === d.id).length;
    if (!confirm(`Delete "${d.name}"${n ? ` and its ${n} entr${n === 1 ? 'y' : 'ies'}` : ''}? This cannot be undone.`)) return;
    const { error } = await createClient().from('metaobject_definitions').delete().eq('id', d.id);
    if (error) return setMsg('Could not delete: ' + error.message);
    await load();
    setMode({ kind: 'list' });
  }

  // ---------- entries ----------
  function openEntry(defId: string, id: string | null) {
    setMsg('');
    const e = entries.find((x) => x.id === id);
    setEStatus(e?.status ?? 'draft');
    setEVals(e?.values ?? {});
    setMode({ kind: 'entry', defId, id });
  }

  async function saveEntry() {
    if (mode.kind !== 'entry') return;
    const def = defs.find((d) => d.id === mode.defId);
    if (!def) return;
    const vals: Record<string, Val> = {};
    for (const f of def.fields) {
      const v = eVals[f.key];
      if (v === undefined || v === '') continue;
      if (f.type === 'number') {
        const n = Number(v);
        if (Number.isNaN(n)) return setMsg(`Could not save: "${f.label}" must be a number.`);
        vals[f.key] = n;
      } else if (f.type === 'link') {
        const s = String(v).trim();
        if (!/^https?:\/\//i.test(s)) return setMsg(`Could not save: "${f.label}" must start with http:// or https://`);
        vals[f.key] = s;
      } else if (typeof v === 'string') {
        vals[f.key] = v.trim();
      } else {
        vals[f.key] = v;
      }
    }
    if (Object.keys(vals).length === 0) return setMsg('Could not save: fill in at least one field.');
    setSaving(true);
    setMsg('');
    const sb = createClient();
    const now = new Date().toISOString();
    const first = def.fields[0] ? String(vals[def.fields[0].key] ?? '') : '';
    const { error } =
      mode.id === null
        ? await sb.from('metaobject_entries').insert({
            business_id: businessId,
            definition_id: def.id,
            handle: `${slugify(first) || 'entry'}-${Math.random().toString(36).slice(2, 7)}`,
            status: eStatus,
            values: vals,
          })
        : await sb.from('metaobject_entries').update({ status: eStatus, values: vals, updated_at: now }).eq('id', mode.id);
    setSaving(false);
    if (error) return setMsg('Could not save: ' + error.message);
    await load();
    setMode({ kind: 'entries', defId: def.id });
  }

  async function deleteEntry(e: Entry) {
    if (!confirm('Delete this entry? This cannot be undone.')) return;
    const { error } = await createClient().from('metaobject_entries').delete().eq('id', e.id);
    if (error) return setMsg('Could not delete: ' + error.message);
    await load();
    setMode({ kind: 'entries', defId: e.definition_id });
  }

  async function toggleStatus(e: Entry) {
    const status = e.status === 'active' ? 'draft' : 'active';
    const { error } = await createClient()
      .from('metaobject_entries')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', e.id);
    if (error) return setMsg('Could not update: ' + error.message);
    setEntries((l) => l.map((x) => (x.id === e.id ? { ...x, status } : x)));
  }

  if (loading) return <div className="h-40 animate-pulse rounded-2xl bg-slate-100" />;

  // ---------- definition form ----------
  if (mode.kind === 'def') {
    const existing = mode.id ? defs.find((d) => d.id === mode.id) : null;
    return (
      <div className="space-y-5">
        <Back onClick={() => setMode({ kind: 'list' })} text="Custom content" />
        <h2 className="font-display text-xl font-bold text-slate-900">{existing ? `Edit ${existing.name}` : 'New content type'}</h2>
        <div className={card}>
          <label className={label}>Name</label>
          <input className={field} maxLength={40} placeholder="e.g. FAQs, Team members, Daily specials" value={dName} onChange={(e) => setDName(e.target.value)} />
          <label className="mt-4 flex cursor-pointer items-start gap-3">
            <input type="checkbox" className="mt-1 h-4 w-4" checked={dShow} onChange={(e) => setDShow(e.target.checked)} />
            <span>
              <span className="block text-sm font-medium text-slate-900">Show active entries on my website</span>
              <span className="block text-xs text-slate-500">Draft entries are never shown.</span>
            </span>
          </label>
        </div>
        <div className={card}>
          <p className="font-medium text-slate-900">Fields</p>
          <p className="mt-1 text-xs text-slate-500">The first field is used as the title of each entry. A field&apos;s type cannot be changed after you save it.</p>
          <div className="mt-4 space-y-3">
            {dFields.map((f, i) => {
              const locked = lockedKeys.includes(f.key);
              return (
                <div key={i} className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 p-3">
                  <input className={`${field} min-w-0 flex-1 !py-2`} placeholder="Field name, e.g. Question" maxLength={40} value={f.label} onChange={(e) => patchField(i, { label: e.target.value })} />
                  <select
                    disabled={locked}
                    className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm disabled:opacity-60"
                    value={f.type}
                    onChange={(e) => patchField(i, { type: e.target.value as FType })}
                  >
                    {typeOptions.map((o) => (
                      <option key={o.v} value={o.v}>{o.t}</option>
                    ))}
                  </select>
                  {dFields.length > 1 && (
                    <button onClick={() => setDFields((l) => l.filter((_, j) => j !== i))} className="rounded p-2 text-red-600 hover:bg-red-50" aria-label="Remove field">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          <button onClick={addField} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-100 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-200">
            <Plus className="h-4 w-4" /> Add field
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={saveDef} disabled={saving} className={primary}>{saving ? 'Saving...' : 'Save'}</button>
          {existing && (
            <button onClick={() => deleteDef(existing)} className="text-sm font-medium text-red-600 hover:underline">Delete this type</button>
          )}
        </div>
        <Note text={msg} />
      </div>
    );
  }

  // ---------- entry form ----------
  if (mode.kind === 'entry') {
    const def = defs.find((d) => d.id === mode.defId);
    if (!def) return null;
    const existing = mode.id ? entries.find((e) => e.id === mode.id) : null;
    return (
      <div className="space-y-5">
        <Back onClick={() => setMode({ kind: 'entries', defId: def.id })} text={def.name} />
        <h2 className="font-display text-xl font-bold text-slate-900">{existing ? 'Edit entry' : `New ${def.name} entry`}</h2>
        <div className={card}>
          <div className="space-y-4">
            {def.fields.map((f) => {
              const v = eVals[f.key];
              const set = (x: Val) => setEVals((o) => ({ ...o, [f.key]: x }));
              return (
                <div key={f.key}>
                  {f.type === 'boolean' ? (
                    <label className="flex cursor-pointer items-center gap-3">
                      <input type="checkbox" className="h-4 w-4" checked={v === true} onChange={(e) => set(e.target.checked)} />
                      <span className="text-sm font-medium text-slate-900">{f.label}</span>
                    </label>
                  ) : (
                    <>
                      <label className={label}>{f.label}</label>
                      {f.type === 'multiline' ? (
                        <textarea rows={4} className={field} value={String(v ?? '')} onChange={(e) => set(e.target.value)} />
                      ) : f.type === 'color' ? (
                        <input type="color" className="h-10 w-16 cursor-pointer rounded border border-slate-300" value={typeof v === 'string' && v ? v : '#000000'} onChange={(e) => set(e.target.value)} />
                      ) : (
                        <input
                          className={field}
                          type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'}
                          inputMode={f.type === 'link' ? 'url' : undefined}
                          placeholder={f.type === 'link' ? 'https://' : undefined}
                          value={String(v ?? '')}
                          onChange={(e) => set(e.target.value)}
                        />
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        <div className={card}>
          <label className={label}>Status</label>
          <select className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm" value={eStatus} onChange={(e) => setEStatus(e.target.value as 'active' | 'draft')}>
            <option value="active">Active (shows on my website)</option>
            <option value="draft">Draft (hidden)</option>
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={saveEntry} disabled={saving} className={primary}>{saving ? 'Saving...' : 'Save'}</button>
          {existing && <button onClick={() => deleteEntry(existing)} className="text-sm font-medium text-red-600 hover:underline">Delete entry</button>}
        </div>
        <Note text={msg} />
      </div>
    );
  }

  // ---------- entries list ----------
  if (mode.kind === 'entries') {
    const def = defs.find((d) => d.id === mode.defId);
    if (!def) return null;
    const list = entries.filter((e) => e.definition_id === def.id);
    return (
      <div className="space-y-5">
        <Back onClick={() => setMode({ kind: 'list' })} text="Custom content" />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl font-bold text-slate-900">{def.name}</h2>
          <div className="flex gap-2">
            <button onClick={() => openDef(def.id)} className={ghost}>Edit type</button>
            <button onClick={() => openEntry(def.id, null)} className={primary}>Add entry</button>
          </div>
        </div>
        <div className={card}>
          {list.length === 0 ? (
            <p className="text-sm text-slate-500">No entries yet. Add your first one.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {list.map((e) => (
                <div key={e.id} className="flex items-center gap-3 py-3">
                  <button onClick={() => openEntry(def.id, e.id)} className="min-w-0 flex-1 text-left">
                    <span className="block truncate text-sm font-semibold text-slate-900">{entryTitle(def, e)}</span>
                  </button>
                  <button
                    onClick={() => toggleStatus(e)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${e.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'}`}
                    title="Tap to switch between Active and Draft"
                  >
                    {e.status === 'active' ? 'Active' : 'Draft'}
                  </button>
                  <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                </div>
              ))}
            </div>
          )}
        </div>
        <Note text={msg} />
      </div>
    );
  }

  // ---------- main list ----------
  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-xl font-bold text-slate-900">Custom content</h2>
        <p className="mt-1 text-sm text-slate-500">Create your own kinds of content, such as FAQs, team members or daily specials, and show them on your website.</p>
      </div>
      <div className={card}>
        {defs.length === 0 ? (
          <p className="text-sm text-slate-500">You have not created any content types yet.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {defs.map((d) => {
              const n = entries.filter((e) => e.definition_id === d.id);
              return (
                <button key={d.id} onClick={() => setMode({ kind: 'entries', defId: d.id })} className="flex w-full items-center gap-3 py-3.5 text-left">
                  <span className="flex-1">
                    <span className="block text-sm font-semibold text-slate-900">{d.name}</span>
                    <span className="block text-xs text-slate-500">
                      {n.length} entr{n.length === 1 ? 'y' : 'ies'} · {n.filter((e) => e.status === 'active').length} active · {d.show_on_site ? 'Shown on website' : 'Not shown on website'}
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                </button>
              );
            })}
          </div>
        )}
        <button onClick={() => openDef(null)} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-100 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-200">
          <Plus className="h-4 w-4" /> New content type
        </button>
      </div>
      <p className="text-xs text-slate-500">Active entries are publicly readable, even for types you do not show on your website. Do not store private information here.</p>
      <Note text={msg} />
    </div>
  );
}
