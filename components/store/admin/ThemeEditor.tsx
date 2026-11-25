'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowUp, Eye, EyeOff, History, Monitor, Plus, Redo2, Smartphone, Trash2, Undo2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { PageSkeleton } from '@/components/Skeleton';
import { ADDABLE, SINGLE, SECTION_LABELS, newSection, readTheme, type Section, type SectionType, type ThemeData, type ThemeSettings } from '@/lib/store/theme';
import SectionForm from './SectionForm';
import SettingsPanel from './SettingsPanel';
import { inp } from './fields';

type Snap = { at: string; settings: ThemeSettings; sections: Section[] };
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

export default function ThemeEditor({ themeId, businessId, onBack }: { themeId: string; businessId: string; onBack: () => void }) {
  const supabase = useMemo(() => createClient(), []);
  const [name, setName] = useState('');
  const [data, setData] = useState<ThemeData | null>(null);
  const [saved, setSaved] = useState('');
  const [history, setHistory] = useState<Snap[]>([]);
  const [userId, setUserId] = useState('');
  const [past, setPast] = useState<ThemeData[]>([]);
  const [future, setFuture] = useState<ThemeData[]>([]);
  const [tab, setTab] = useState<'sections' | 'settings' | 'versions'>('sections');
  const [view, setView] = useState<'edit' | 'preview'>('edit');
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [sel, setSel] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [cols, setCols] = useState<{ id: string; title: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);
  const ready = useRef(false);
  const lastPush = useRef(0);

  useEffect(() => {
    (async () => {
      const [{ data: row }, { data: u }] = await Promise.all([
        supabase.from('store_themes').select('name, settings, sections, template, history').eq('id', themeId).single(),
        supabase.auth.getUser(),
      ]);
      setUserId(u.user?.id ?? '');
      const { data: cr } = await supabase.from('collections').select('id, title').eq('business_id', businessId).order('title');
      setCols(((cr ?? []) as { id: string; title: string }[]).filter((c) => c.title));
      if (!row) return setMsg('Theme not found.');
      const t = readTheme(row);
      setName(row.name); setData(t); setSaved(JSON.stringify(t));
      setHistory(Array.isArray(row.history) ? (row.history as Snap[]) : []);
    })();
  }, [supabase, themeId, businessId]);

  const post = useCallback((t: ThemeData) => { frame.current?.contentWindow?.postMessage({ xenon: 'theme', theme: t }, window.location.origin); }, []);
  useEffect(() => { if (data && ready.current) post(data); }, [data, post]);
  useEffect(() => {
    const on = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      if (e.data?.xenon === 'ready') { ready.current = true; if (data) post(data); }
      if (e.data?.xenon === 'select' && typeof e.data.id === 'string') { setSel(e.data.id); setTab('sections'); setView('edit'); }
    };
    window.addEventListener('message', on);
    return () => window.removeEventListener('message', on);
  }, [data, post]);

  const dirty = !!data && JSON.stringify(data) !== saved;
  useEffect(() => {
    const f = (e: BeforeUnloadEvent) => { if (dirty) e.preventDefault(); };
    window.addEventListener('beforeunload', f);
    return () => window.removeEventListener('beforeunload', f);
  }, [dirty]);

  // every change goes through here so undo/redo works (quick typing is grouped into one step)
  function change(fn: (d: ThemeData) => void) {
    setData((cur) => {
      if (!cur) return cur;
      const next = clone(cur); fn(next);
      const now = Date.now();
      if (now - lastPush.current > 700) setPast((p) => [...p.slice(-49), cur]);
      lastPush.current = now;
      setFuture([]);
      return next;
    });
  }
  const undo = () => { if (!past.length || !data) return; setFuture((f) => [data, ...f]); setData(past[past.length - 1]); setPast(past.slice(0, -1)); lastPush.current = 0; };
  const redo = () => { if (!future.length || !data) return; setPast((p) => [...p, data]); setData(future[0]); setFuture(future.slice(1)); lastPush.current = 0; };

  async function save() {
    if (!data) return;
    setSaving(true); setMsg('');
    const prev = JSON.parse(saved) as ThemeData;
    const hist = [{ at: new Date().toISOString(), settings: prev.settings, sections: prev.sections }, ...history].slice(0, 10);
    const { error } = await supabase.from('store_themes').update({ name: name.trim() || 'Theme', settings: data.settings, sections: data.sections, history: hist }).eq('id', themeId);
    setSaving(false);
    if (error) return setMsg(error.message);
    setSaved(JSON.stringify(data)); setHistory(hist); setMsg('Saved. If this is your current theme, customers see it now.');
  }
  function back() { if (dirty && !window.confirm('You have changes that are not saved. Leave anyway?')) return; onBack(); }

  if (!data) return <PageSkeleton />;
  const secs = data.sections;
  const idx = (id: string) => secs.findIndex((s) => s.id === id);
  const middle = secs.filter((s) => !['announcement', 'header', 'footer'].includes(s.type));
  const fixedTop = secs.filter((s) => s.type === 'announcement' || s.type === 'header');
  const footer = secs.find((s) => s.type === 'footer');
  const current = secs.find((s) => s.id === sel) ?? null;

  const move = (id: string, dir: -1 | 1) => change((d) => {
    const mids = d.sections.filter((s) => !['announcement', 'header', 'footer'].includes(s.type));
    const i = mids.findIndex((s) => s.id === id); const j = i + dir;
    if (j < 0 || j >= mids.length) return;
    [mids[i], mids[j]] = [mids[j], mids[i]];
    d.sections = [...d.sections.filter((s) => s.type === 'announcement' || s.type === 'header'), ...mids, ...d.sections.filter((s) => s.type === 'footer')];
  });
  const toggle = (id: string) => change((d) => { const s = d.sections[idx(id)]; if (s) s.visible = !s.visible; });
  const remove = (id: string) => { change((d) => { d.sections = d.sections.filter((s) => s.id !== id); }); if (sel === id) setSel(null); };
  const add = (type: SectionType) => {
    const s = newSection(type);
    change((d) => { const f = d.sections.findIndex((x) => x.type === 'footer'); d.sections.splice(f < 0 ? d.sections.length : f, 0, s); });
    setSel(s.id);
    setTimeout(() => frame.current?.contentWindow?.postMessage({ xenon: 'focus', focus: s.id }, window.location.origin), 300);
  };
  const addable = ADDABLE.filter((t) => !SINGLE.includes(t) || !secs.some((s) => s.type === t));

  const row = (s: Section, canMove: boolean, canRemove: boolean) => (
    <div key={s.id} className={`flex items-center gap-1 rounded-lg border px-2 py-1.5 ${sel === s.id ? 'border-blue-600 bg-blue-50' : 'border-slate-200 bg-white'}`}>
      <button className="flex-1 truncate px-1 py-1.5 text-left text-sm font-medium text-slate-800" onClick={() => { setSel(s.id); frame.current?.contentWindow?.postMessage({ xenon: 'focus', focus: s.id }, window.location.origin); }}>
        <span className={s.visible ? '' : 'text-slate-400 line-through'}>{SECTION_LABELS[s.type]}</span>
      </button>
      {canMove && <><button onClick={() => move(s.id, -1)} className="p-1.5 text-slate-500" aria-label="Move up"><ArrowUp className="h-4 w-4" /></button><button onClick={() => move(s.id, 1)} className="p-1.5 text-slate-500" aria-label="Move down"><ArrowDown className="h-4 w-4" /></button></>}
      <button onClick={() => toggle(s.id)} className="p-1.5 text-slate-500" aria-label={s.visible ? 'Hide section' : 'Show section'}>{s.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}</button>
      {canRemove && <button onClick={() => remove(s.id)} className="p-1.5 text-red-500" aria-label="Delete section"><Trash2 className="h-4 w-4" /></button>}
    </div>
  );

  return (
    <div className="-mx-1 flex h-[calc(100vh-7rem)] min-h-[560px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 p-3">
        <button onClick={back} className="rounded-lg border border-slate-300 p-2" aria-label="Back"><ArrowLeft className="h-4 w-4" /></button>
        <input value={name} onChange={(e) => setName(e.target.value)} className={`${inp} max-w-[180px] font-semibold`} aria-label="Theme name" />
        <div className="ml-auto flex items-center gap-1">
          <button onClick={undo} disabled={!past.length} className="rounded-lg p-2 disabled:opacity-30" aria-label="Undo"><Undo2 className="h-4 w-4" /></button>
          <button onClick={redo} disabled={!future.length} className="rounded-lg p-2 disabled:opacity-30" aria-label="Redo"><Redo2 className="h-4 w-4" /></button>
          <button onClick={() => setDevice('desktop')} className={`hidden rounded-lg p-2 sm:block ${device === 'desktop' ? 'bg-slate-200' : ''}`} aria-label="Computer view"><Monitor className="h-4 w-4" /></button>
          <button onClick={() => setDevice('mobile')} className={`hidden rounded-lg p-2 sm:block ${device === 'mobile' ? 'bg-slate-200' : ''}`} aria-label="Phone view"><Smartphone className="h-4 w-4" /></button>
          <button onClick={save} disabled={saving} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-500">{saving ? 'Saving...' : dirty ? 'Save' : 'Saved'}</button>
        </div>
      </div>
      {msg && <p className="bg-blue-50 px-4 py-2 text-sm text-blue-800">{msg}</p>}

      <div className="flex border-b border-slate-200 sm:hidden">
        {(['edit', 'preview'] as const).map((v) => <button key={v} onClick={() => setView(v)} className={`flex-1 py-2.5 text-sm font-semibold ${view === v ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-500'}`}>{v === 'edit' ? 'Edit' : 'Preview'}</button>)}
      </div>

      <div className="flex min-h-0 flex-1">
        <aside className={`${view === 'edit' ? 'flex' : 'hidden'} w-full flex-col border-r border-slate-200 sm:flex sm:w-[340px] sm:shrink-0`}>
          <div className="flex border-b border-slate-200 text-sm font-semibold">
            {([['sections', 'Sections'], ['settings', 'Theme settings'], ['versions', 'History']] as const).map(([k, l]) => (
              <button key={k} onClick={() => { setTab(k); if (k !== 'sections') setSel(null); }} className={`flex-1 px-2 py-3 ${tab === k ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-500'}`}>{l}</button>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {tab === 'settings' && <SettingsPanel s={data.settings} upd={(fn) => change((d) => fn(d.settings))} />}
            {tab === 'versions' && (
              <div className="p-4">
                <p className="mb-3 flex items-center gap-2 text-sm text-slate-600"><History className="h-4 w-4" />Each time you save, the earlier version is kept here (last 10).</p>
                {history.length === 0 && <p className="text-sm text-slate-500">No earlier versions yet.</p>}
                {history.map((h, i) => (
                  <div key={i} className="mb-2 flex items-center justify-between rounded-lg border border-slate-200 p-3 text-sm">
                    <span>{new Date(h.at).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                    <button className="font-semibold text-blue-600" onClick={() => { if (window.confirm('Restore this version? Your current unsaved changes will be replaced.')) change((d) => { const t = readTheme({ settings: h.settings, sections: h.sections }); d.settings = t.settings; d.sections = t.sections; }); }}>Restore</button>
                  </div>
                ))}
              </div>
            )}
            {tab === 'sections' && !current && (
              <div className="space-y-2 p-4">
                {fixedTop.map((s) => row(s, false, false))}
                <p className="pt-2 text-xs font-bold uppercase text-slate-500">Home page</p>
                {middle.map((s) => row(s, true, true))}
                {addable.length > 0 && (
                  <label className="block pt-1">
                    <span className="sr-only">Add section</span>
                    <div className="flex items-center gap-2"><Plus className="h-4 w-4 text-blue-600" />
                      <select className={inp} value="" onChange={(e) => e.target.value && add(e.target.value as SectionType)}>
                        <option value="">Add section...</option>{addable.map((t) => <option key={t} value={t}>{SECTION_LABELS[t]}</option>)}
                      </select></div>
                  </label>
                )}
                <div className="pt-2">{footer && row(footer, false, false)}</div>
              </div>
            )}
            {tab === 'sections' && current && (
              <div className="p-4">
                <button onClick={() => setSel(null)} className="mb-3 flex items-center gap-1 text-sm font-semibold text-blue-600"><ArrowLeft className="h-4 w-4" />All sections</button>
                <p className="mb-3 text-base font-bold text-slate-900">{SECTION_LABELS[current.type]}</p>
                <SectionForm sec={current} collections={cols} owner={{ userId, businessId }} set={(k, v) => change((d) => { const s = d.sections.find((x) => x.id === current.id); if (s) s.s[k] = v; })} />
              </div>
            )}
          </div>
        </aside>

        <div className={`${view === 'preview' ? 'flex' : 'hidden'} min-w-0 flex-1 justify-center overflow-auto bg-slate-100 p-0 sm:flex sm:p-4`}>
          <iframe ref={frame} src="/store-preview" title="Store preview" className="h-full border-0 bg-white shadow-sm" style={{ width: device === 'mobile' ? 390 : '100%', maxWidth: '100%' }} />
        </div>
      </div>
    </div>
  );
}
