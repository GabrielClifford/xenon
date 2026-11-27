'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowUp, Copy, Eye, EyeOff, GripVertical, History, Lock, Monitor, MousePointerClick, Redo2, Smartphone, Trash2, Undo2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { PageSkeleton } from '@/components/Skeleton';
import { ADDABLE, GROUP_ADDABLE, PAGE_ORDER, SINGLE, TEMPLATE_PAGES, newId, newSection, readTheme, sectionLabel, type PageId, type Section, type SectionType, type ThemeData, type ThemeSettings } from '@/lib/store/theme';
import AddSection from './AddSection';
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
  const [interact, setInteract] = useState(false);
  const interactRef = useRef(false);
  interactRef.current = interact;
  const [sel, setSel] = useState<string | null>(null);
  const [tpl, setTpl] = useState<PageId>('home');
  const [drag, setDrag] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [cols, setCols] = useState<{ id: string; title: string }[]>([]);
  const [prods, setProds] = useState<{ id: string; title: string }[]>([]);
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
      const { data: pr } = await supabase.from('products').select('id, name').eq('business_id', businessId).order('name').limit(500);
      setProds(((pr ?? []) as { id: string; name: string }[]).filter((p) => p.name).map((p) => ({ id: p.id, title: p.name })));
      if (!row) return setMsg('Theme not found.');
      const t = readTheme(row);
      setName(row.name); setData(t); setSaved(JSON.stringify(t));
      setHistory(Array.isArray(row.history) ? (row.history as Snap[]) : []);
    })();
  }, [supabase, themeId, businessId]);

  const post = useCallback((t: ThemeData) => { frame.current?.contentWindow?.postMessage({ xenon: 'theme', theme: t, template: tpl }, window.location.origin); }, [tpl]);
  useEffect(() => { frame.current?.contentWindow?.postMessage({ xenon: 'mode', interact }, window.location.origin); }, [interact]);
  useEffect(() => { if (data && ready.current) post(data); }, [data, post]);
  useEffect(() => {
    const on = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      if (e.data?.xenon === 'ready') { ready.current = true; if (data) post(data); frame.current?.contentWindow?.postMessage({ xenon: 'mode', interact: interactRef.current }, window.location.origin); }
      if (e.data?.xenon === 'page' && ['home', 'collection', 'product', 'cart', 'page'].includes(e.data.template)) { setTpl(e.data.template as PageId); setSel(null); }
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
  const current = secs.find((s) => s.id === sel) ?? null;
  const rebuild = (d: ThemeData, pg: PageId, list: Section[]) => { d.sections = PAGE_ORDER.flatMap((p) => (p === pg ? list : d.sections.filter((x) => x.page === p))); };
  const inGroup = (d: ThemeData, pg: PageId) => d.sections.filter((x) => x.page === pg);

  const move = (id: string, dir: -1 | 1) => change((d) => {
    const s = d.sections.find((x) => x.id === id); if (!s) return;
    const g = inGroup(d, s.page); const i = g.findIndex((x) => x.id === id); const j = i + dir;
    if (j < 0 || j >= g.length) return;
    [g[i], g[j]] = [g[j], g[i]]; rebuild(d, s.page, g);
  });
  const moveTo = (dragId: string, targetId: string) => change((d) => {
    const a = d.sections.find((x) => x.id === dragId); const b = d.sections.find((x) => x.id === targetId);
    if (!a || !b || a.page !== b.page || a.id === b.id) return;
    const g = inGroup(d, a.page).filter((x) => x.id !== a.id);
    g.splice(g.findIndex((x) => x.id === b.id), 0, a); rebuild(d, a.page, g);
  });
  const toggle = (id: string) => change((d) => { const s = d.sections[idx(id)]; if (s && s.type !== 'main') s.visible = !s.visible; });
  const remove = (id: string) => { change((d) => { d.sections = d.sections.filter((s) => s.id !== id); }); if (sel === id) setSel(null); };
  const duplicate = (id: string) => {
    const copyId = newId();
    change((d) => {
      const i = d.sections.findIndex((x) => x.id === id); const src = d.sections[i];
      if (!src || SINGLE.includes(src.type)) return;
      d.sections.splice(i + 1, 0, { ...clone(src), id: copyId });
    });
    setSel(copyId);
  };
  const add = (type: SectionType, pg: PageId) => {
    const s = newSection(type, {}, pg);
    change((d) => {
      const g = inGroup(d, pg);
      const at = pg === 'footer' ? g.findIndex((x) => x.type === 'footer') : g.length;
      g.splice(at < 0 ? g.length : at, 0, s); rebuild(d, pg, g);
    });
    setSel(s.id);
    setTimeout(() => frame.current?.contentWindow?.postMessage({ xenon: 'focus', focus: s.id }, window.location.origin), 300);
  };
  const addableFor = (pg: PageId): SectionType[] => (pg === 'header' ? GROUP_ADDABLE.header : pg === 'footer' ? GROUP_ADDABLE.footer : ADDABLE).filter((t) => !SINGLE.includes(t) || !secs.some((s) => s.type === t));
  const pick = (id: string) => { setSel(id); frame.current?.contentWindow?.postMessage({ xenon: 'focus', focus: id }, window.location.origin); };

  const row = (s: Section) => {
    const locked = ['announcement', 'header', 'footer', 'main'].includes(s.type);
    return (
      <div key={s.id} draggable onDragStart={() => setDrag(s.id)} onDragEnd={() => setDrag(null)} onDragOver={(e) => { if (drag) e.preventDefault(); }} onDrop={(e) => { e.preventDefault(); if (drag) moveTo(drag, s.id); setDrag(null); }}
        className={`flex items-center gap-0.5 rounded-lg border px-1 py-1 ${sel === s.id ? 'border-blue-600 bg-blue-50' : 'border-slate-200 bg-white'} ${drag === s.id ? 'opacity-40' : ''}`}>
        <GripVertical className="hidden h-4 w-4 shrink-0 cursor-grab text-slate-300 sm:block" aria-hidden />
        <button className="flex-1 truncate px-1 py-1.5 text-left text-sm font-medium text-slate-800" onClick={() => pick(s.id)}>
          <span className={s.visible ? '' : 'text-slate-400 line-through'}>{sectionLabel(s)}</span>
        </button>
        <button onClick={() => move(s.id, -1)} className="p-1.5 text-slate-500" aria-label="Move up"><ArrowUp className="h-4 w-4" /></button>
        <button onClick={() => move(s.id, 1)} className="p-1.5 text-slate-500" aria-label="Move down"><ArrowDown className="h-4 w-4" /></button>
        {!SINGLE.includes(s.type) && <button onClick={() => duplicate(s.id)} className="p-1.5 text-slate-500" aria-label="Duplicate section"><Copy className="h-4 w-4" /></button>}
        {s.type !== 'main' && <button onClick={() => toggle(s.id)} className="p-1.5 text-slate-500" aria-label={s.visible ? 'Hide section' : 'Show section'}>{s.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}</button>}
        {locked ? <span className="p-1.5 text-slate-300" title="Needed by your store, it can be hidden or moved but not deleted"><Lock className="h-4 w-4" /></span>
          : <button onClick={() => remove(s.id)} className="p-1.5 text-red-500" aria-label="Delete section"><Trash2 className="h-4 w-4" /></button>}
      </div>
    );
  };
  const group = (pg: PageId, title: string, hint?: string) => (
    <div key={pg} className="space-y-1.5">
      <p className="pt-3 text-xs font-bold uppercase tracking-wide text-slate-500">{title}</p>
      {hint && <p className="text-[11px] text-slate-400">{hint}</p>}
      {secs.filter((s) => s.page === pg).map(row)}
      <AddSection key={`${pg}-add`} types={addableFor(pg)} onPick={(t) => add(t, pg)} />
    </div>
  );
  const changeTpl = (v: PageId) => { setTpl(v); setSel(null); };

  return (
    <div className="-mx-1 flex h-[calc(100vh-7rem)] min-h-[560px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 p-3">
        <button onClick={back} className="rounded-lg border border-slate-300 p-2" aria-label="Back"><ArrowLeft className="h-4 w-4" /></button>
        <input value={name} onChange={(e) => setName(e.target.value)} className={`${inp} max-w-[180px] font-semibold`} aria-label="Theme name" />
        <div className="ml-auto flex items-center gap-1">
          <button onClick={undo} disabled={!past.length} className="rounded-lg p-2 disabled:opacity-30" aria-label="Undo"><Undo2 className="h-4 w-4" /></button>
          <button onClick={redo} disabled={!future.length} className="rounded-lg p-2 disabled:opacity-30" aria-label="Redo"><Redo2 className="h-4 w-4" /></button>
          <button onClick={() => setDevice('desktop')} className={`hidden rounded-lg p-2 sm:block ${device === 'desktop' ? 'bg-slate-200' : ''}`} aria-label="Computer view"><Monitor className="h-4 w-4" /></button>
          <button onClick={() => setInteract((v) => !v)} aria-pressed={interact} title="Try the store: buttons and the cart work, and clicking no longer selects sections" className={`flex items-center gap-1 rounded-lg px-2 py-2 text-xs font-semibold ${interact ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}><MousePointerClick className="h-4 w-4" /><span className="hidden sm:inline">{interact ? 'Interact: on' : 'Interact'}</span></button>
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
              <div className="p-4">
                <label className="block">
                  <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Page you are editing</span>
                  <select className={inp} value={tpl} onChange={(e) => changeTpl(e.target.value as PageId)}>{TEMPLATE_PAGES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select>
                </label>
                {group('header', 'Header', 'Shown at the top of every page')}
                {group(tpl, TEMPLATE_PAGES.find((p) => p.id === tpl)?.label ?? 'Page', tpl === 'home' ? 'Add the sections of your home page. It starts empty.' : 'The locked part fills itself in. Add sections above or below it, drag to reorder.')}
                {group('footer', 'Footer', 'Shown at the bottom of every page')}
              </div>
            )}
            {tab === 'sections' && current && (
              <div className="p-4">
                <button onClick={() => setSel(null)} className="mb-3 flex items-center gap-1 text-sm font-semibold text-blue-600"><ArrowLeft className="h-4 w-4" />All sections</button>
                <p className="mb-3 text-base font-bold text-slate-900">{sectionLabel(current)}</p>
                <SectionForm sec={current} collections={cols} productOpts={prods} owner={{ userId, businessId }} set={(k, v) => change((d) => { const s = d.sections.find((x) => x.id === current.id); if (s) s.s[k] = v; })} />
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
