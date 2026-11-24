'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { FontRole, HKey, ThemeSettings } from '@/lib/store/theme';
import { BoolF, ColorF, FontF, Field, RangeF, Seg, inp } from './fields';

type Upd = (fn: (s: ThemeSettings) => void) => void;

function Group({ title, open, onToggle, children }: { title: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div className="border-b border-slate-200">
      <button onClick={onToggle} className="flex w-full items-center justify-between px-4 py-3.5 text-left text-sm font-semibold text-slate-900">{title}<ChevronDown className={`h-4 w-4 transition ${open ? 'rotate-180' : ''}`} /></button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

const COLOR_LABELS: [keyof ThemeSettings['colors'], string][] = [
  ['background', 'Page background'], ['text', 'Text'], ['muted', 'Soft text'], ['primary', 'Buttons and highlights'], ['primaryText', 'Text on buttons'], ['accent', 'Links and accents'],
  ['card', 'Product card background'], ['border', 'Borders'], ['saleBg', 'Sale badge background'], ['saleText', 'Sale badge text'], ['soldBg', 'Badge background'], ['soldText', 'Badge text'],
  ['inputBg', 'Input background'], ['inputText', 'Input text'], ['inputBorder', 'Input border'], ['drawerBg', 'Cart drawer background'],
];
const TRI: [string, string][] = [['tight', 'Tight'], ['normal', 'Normal'], ['loose', 'Loose']];
const ROLES: [FontRole, string][] = [['body', 'Body'], ['subheading', 'Subheading'], ['heading', 'Heading'], ['accent', 'Accent']];
const HS: HKey[] = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'];

export default function SettingsPanel({ s, upd }: { s: ThemeSettings; upd: Upd }) {
  const [open, setOpen] = useState<string>('Colors');
  const g = (t: string, children: React.ReactNode) => <Group title={t} open={open === t} onToggle={() => setOpen(open === t ? '' : t)}>{children}</Group>;
  return (
    <div>
      {g('Colors', COLOR_LABELS.map(([k, l]) => <ColorF key={k} label={l} value={s.colors[k]} onChange={(v) => upd((d) => { d.colors[k] = v; })} />))}
      {g('Typography', <>
        {ROLES.map(([r, l]) => <FontF key={r} label={`${l} font`} value={s.fonts[r]} onChange={(v) => upd((d) => { d.fonts[r] = v; })} />)}
        <RangeF label="Paragraph size" min={12} max={20} unit="px" value={s.paragraph.size} onChange={(v) => upd((d) => { d.paragraph.size = v; })} />
        <Seg label="Paragraph line height" value={s.paragraph.lh} options={TRI as [typeof s.paragraph.lh, string][]} onChange={(v) => upd((d) => { d.paragraph.lh = v; })} />
        {HS.map((k) => (
          <details key={k} className="mb-2 rounded-lg border border-slate-200 p-3">
            <summary className="cursor-pointer text-sm font-semibold uppercase">{k}</summary>
            <div className="mt-3">
              <Field label="Font"><select className={inp} value={s.h[k].font} onChange={(e) => upd((d) => { d.h[k].font = e.target.value as FontRole; })}>{ROLES.map(([r, l]) => <option key={r} value={r}>{l}</option>)}</select></Field>
              <RangeF label="Size" min={10} max={80} unit="px" value={s.h[k].size} onChange={(v) => upd((d) => { d.h[k].size = v; })} />
              <Seg label="Line height" value={s.h[k].lh} options={TRI as [typeof s.h.h1.lh, string][]} onChange={(v) => upd((d) => { d.h[k].lh = v; })} />
              <Seg label="Letter spacing" value={s.h[k].ls} options={TRI as [typeof s.h.h1.ls, string][]} onChange={(v) => upd((d) => { d.h[k].ls = v; })} />
              <BoolF label="Capital letters" value={s.h[k].upper} onChange={(v) => upd((d) => { d.h[k].upper = v; })} />
            </div>
          </details>
        ))}
      </>)}
      {g('Layout', <Seg label="Page width" value={s.page.width} options={[['narrow', 'Narrow'], ['normal', 'Normal'], ['wide', 'Wide']]} onChange={(v) => upd((d) => { d.page.width = v; })} />)}
      {g('Animations', <>
        <Seg label="Product card hover" value={s.anim.hover} options={[['none', 'None'], ['lift', 'Lift'], ['scale', 'Scale'], ['zoom', 'Zoom']]} onChange={(v) => upd((d) => { d.anim.hover = v; })} />
        <BoolF label="Cart button bounces when you add an item" value={s.anim.cartBump} onChange={(v) => upd((d) => { d.anim.cartBump = v; })} /></>)}
      {g('Badges', <>
        <Seg label="Position on product" value={s.badges.position} options={[['tl', 'Top left'], ['tr', 'Top right'], ['bl', 'Bottom left']]} onChange={(v) => upd((d) => { d.badges.position = v; })} />
        <RangeF label="Corner radius" min={0} max={100} value={s.badges.radius} onChange={(v) => upd((d) => { d.badges.radius = v; })} />
        <BoolF label="Capital letters" value={s.badges.upper} onChange={(v) => upd((d) => { d.badges.upper = v; })} /></>)}
      {g('Buttons', <>
        <p className="mb-2 text-xs font-bold uppercase text-slate-500">Primary</p>
        <RangeF label="Corner radius" min={0} max={60} unit="px" value={s.buttons.radius} onChange={(v) => upd((d) => { d.buttons.radius = v; })} />
        <RangeF label="Border thickness" min={0} max={6} unit="px" value={s.buttons.border} onChange={(v) => upd((d) => { d.buttons.border = v; })} />
        <BoolF label="Capital letters" value={s.buttons.upper} onChange={(v) => upd((d) => { d.buttons.upper = v; })} />
        <Seg label="Button font" value={s.buttons.font} options={[['body', 'Body'], ['accent', 'Accent']]} onChange={(v) => upd((d) => { d.buttons.font = v; })} />
        <p className="mb-2 mt-4 text-xs font-bold uppercase text-slate-500">Secondary</p>
        <RangeF label="Corner radius" min={0} max={60} unit="px" value={s.buttons.sRadius} onChange={(v) => upd((d) => { d.buttons.sRadius = v; })} />
        <RangeF label="Border thickness" min={1} max={6} unit="px" value={s.buttons.sBorder} onChange={(v) => upd((d) => { d.buttons.sBorder = v; })} />
        <p className="mb-2 mt-4 text-xs font-bold uppercase text-slate-500">Pills</p>
        <RangeF label="Corner radius" min={0} max={60} unit="px" value={s.buttons.pill} onChange={(v) => upd((d) => { d.buttons.pill = v; })} /></>)}
      {g('Icons', <Seg label="Icon stroke" value={s.icons.stroke} options={[['thin', 'Thin'], ['default', 'Default'], ['heavy', 'Heavy']]} onChange={(v) => upd((d) => { d.icons.stroke = v; })} />)}
      {g('Input fields', <>
        <RangeF label="Corner radius" min={0} max={30} unit="px" value={s.inputs.radius} onChange={(v) => upd((d) => { d.inputs.radius = v; })} />
        <RangeF label="Border thickness" min={0} max={4} unit="px" value={s.inputs.border} onChange={(v) => upd((d) => { d.inputs.border = v; })} /></>)}
      {g('Popovers and drawers', <>
        <RangeF label="Corner radius" min={0} max={40} unit="px" value={s.popovers.radius} onChange={(v) => upd((d) => { d.popovers.radius = v; })} />
        <RangeF label="Border thickness" min={0} max={4} unit="px" value={s.popovers.border} onChange={(v) => upd((d) => { d.popovers.border = v; })} />
        <BoolF label="Drop shadow" value={s.popovers.shadow} onChange={(v) => upd((d) => { d.popovers.shadow = v; })} /></>)}
      {g('Product cards', <>
        <Seg label="Add to cart button" value={s.cards.quickAdd} options={[['always', 'Always show'], ['hover', 'On hover']]} onChange={(v) => upd((d) => { d.cards.quickAdd = v; })} />
        <RangeF label="Corner radius" min={0} max={40} unit="px" value={s.cards.radius} onChange={(v) => upd((d) => { d.cards.radius = v; })} />
        <Seg label="Card border" value={s.cards.border} options={[['solid', 'Show'], ['none', 'Hide']]} onChange={(v) => upd((d) => { d.cards.border = v; })} />
        <RangeF label="Products per row (computer)" min={2} max={6} value={s.cards.columns} onChange={(v) => upd((d) => { d.cards.columns = v; })} />
        <RangeF label="Products per row (phone)" min={1} max={3} value={s.cards.mobileColumns} onChange={(v) => upd((d) => { d.cards.mobileColumns = v; })} /></>)}
      {g('Prices', <BoolF label="Show currency code (NGN) with prices" value={s.prices.code} onChange={(v) => upd((d) => { d.prices.code = v; })} />)}
      {g('Custom CSS', <Field label="Advanced styling" hint="Only for people who know CSS. Write plain rules such as .xs-card { box-shadow: none }. Imports and scripts are removed for safety.">
        <textarea rows={8} className={`${inp} font-mono text-xs`} value={s.css} onChange={(e) => upd((d) => { d.css = e.target.value; })} placeholder=".xs-btn { letter-spacing: 1px; }" /></Field>)}
    </div>
  );
}
