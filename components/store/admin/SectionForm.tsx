'use client';

import type { Section } from '@/lib/store/theme';
import { TRUST_ICONS } from '@/lib/store/theme';
import { AreaF, BoolF, ColorF, ImageF, ListF, RangeF, SelectF, TextF } from './fields';

type Owner = { userId: string; businessId: string };
const sv = (v: unknown) => (typeof v === 'string' ? v : '');
type Item = Record<string, string>;
const items = (v: unknown): Item[] => (Array.isArray(v) ? (v as Item[]) : []);

export default function SectionForm({ sec, set, owner }: { sec: Section; set: (key: string, value: unknown) => void; owner: Owner }) {
  const x = sec.s;
  const T = (key: string, label: string, hint?: string) => <TextF label={label} value={sv(x[key])} onChange={(v) => set(key, v)} hint={hint} />;
  const A = (key: string, label: string, rows = 4, hint?: string) => <AreaF label={label} rows={rows} value={sv(x[key])} onChange={(v) => set(key, v)} hint={hint} />;
  const C = (key: string, label: string) => <ColorF label={label} value={sv(x[key])} allowEmpty onChange={(v) => set(key, v)} />;
  const I = (key: string, label: string) => <ImageF label={label} value={sv(x[key])} onChange={(v) => set(key, v)} owner={owner} />;
  const B = (key: string, label: string) => <BoolF label={label} value={x[key] === true} onChange={(v) => set(key, v)} />;
  const linkHint = 'Use #products to scroll to products, https://... for another website, or /b/your-store/pages/about for a page.';

  switch (sec.type) {
    case 'announcement': return <>{T('text', 'Message', 'Leave empty to hide the bar.')}{T('link', 'Link (optional)')}{C('bg', 'Background color')}{C('color', 'Text color')}</>;
    case 'header': return <>
      {T('logoText', 'Logo text', 'Leave empty to use your store name.')}{I('logoImage', 'Logo image (optional)')}
      <ListF label="Menu links" items={items(x.links)} onChange={(v) => set('links', v)} blank={{ label: '', href: '' }} fields={[{ key: 'label', label: 'Label' }, { key: 'href', label: 'Link' }]} max={8} />
      <p className="-mt-1 mb-3 text-[11px] text-slate-500">{linkHint}</p>
      {B('showMenu', 'Show menu button (opens a side menu with your links and pages)')}{B('showSearch', 'Show search')}{B('showCart', 'Show cart button')}{B('showAccount', 'Show Sign in / My account')}{B('sticky', 'Keep header at the top when scrolling')}{B('center', 'Center the logo')}{B('wide', 'Full-width header')}</>;
    case 'hero': return <>
      {I('image', 'Banner image')}{T('eyebrow', 'Small text above heading (optional)')}{T('heading', 'Heading')}{T('sub', 'Subheading')}{T('button', 'Button label')}{T('link', 'Button link', linkHint)}
      <SelectF label="Height" value={(sv(x.height) || 'medium') as 'small'} onChange={(v) => set('height', v)} options={[['small', 'Small'], ['medium', 'Medium'], ['large', 'Large']]} />
      <SelectF label="Text position" value={(sv(x.valign) || 'center') as 'center'} onChange={(v) => set('valign', v)} options={[['center', 'Middle'], ['bottom', 'Bottom']]} />
      {B('outline', 'Outline button with arrow')}
      <SelectF label="Text alignment" value={(sv(x.align) || 'center') as 'center'} onChange={(v) => set('align', v)} options={[['center', 'Center'], ['left', 'Left']]} />
      <RangeF label="Image darkening" min={0} max={80} unit="%" value={Number(x.overlay ?? 35)} onChange={(v) => set('overlay', v)} />
      {C('bg', 'Background color (when no image)')}{C('textColor', 'Text color')}</>;
    case 'products': return <>{T('heading', 'Heading')}
      <SelectF label="Layout" value={(sv(x.layout) || 'grid') as 'grid'} onChange={(v) => set('layout', v)} options={[['grid', 'Grid'], ['rows', 'Swipeable rows by category']]} />
      {B('portrait', 'Tall product photos (3:4)')}{B('showTrack', 'Show "Track my order" link')}
      <p className="text-xs text-slate-500">Products, search, cart and checkout come from your Products page. Colors and card style come from Theme settings.</p></>;
    case 'richtext': return <>{T('heading', 'Heading')}{A('text', 'Text', 6, 'You can use **bold**, *italic*, [links](https://...) and - lists.')}
      <SelectF label="Alignment" value={(sv(x.align) || 'center') as 'center'} onChange={(v) => set('align', v)} options={[['center', 'Center'], ['left', 'Left']]} />{T('button', 'Button label')}{T('link', 'Button link')}</>;
    case 'imagetext': return <>{I('image', 'Image')}{T('heading', 'Heading')}{A('text', 'Text', 6)}
      <SelectF label="Image position" value={(sv(x.imageSide) || 'left') as 'left'} onChange={(v) => set('imageSide', v)} options={[['left', 'Left'], ['right', 'Right']]} />{T('button', 'Button label')}{T('link', 'Button link')}</>;
    case 'trust': return <ListF label="Badges" items={items(x.items)} onChange={(v) => set('items', v)} blank={{ icon: 'star', title: '', text: '' }}
      fields={[{ key: 'icon', label: 'Icon', options: [...TRUST_ICONS] }, { key: 'title', label: 'Title' }, { key: 'text', label: 'Text' }]} max={6} />;
    case 'testimonials': return <>{T('heading', 'Heading')}{T('subtitle', 'Small text under heading')}
      <SelectF label="Style" value={(sv(x.style) || 'cards') as 'cards'} onChange={(v) => set('style', v)} options={[['cards', 'Cards'], ['marquee', 'Endless scrolling strip']]} />
      <ListF label="Reviews" items={items(x.items)} onChange={(v) => set('items', v)} blank={{ name: '', rating: '5', text: '' }} fields={[{ key: 'name', label: 'Customer name' }, { key: 'rating', label: 'Stars', options: ['5', '4', '3', '2', '1'] }, { key: 'text', label: 'Review', area: true }]} max={12} />
      <p className="text-[11px] text-slate-500">Only add reviews from real customers.</p></>;
    case 'faq': return <>{T('heading', 'Heading')}<ListF label="Questions" items={items(x.items)} onChange={(v) => set('items', v)} blank={{ q: '', a: '' }} fields={[{ key: 'q', label: 'Question' }, { key: 'a', label: 'Answer', area: true }]} max={12} /></>;
    case 'contact': return <>{T('heading', 'Heading')}{A('text', 'Text', 3)}{T('whatsapp', 'WhatsApp number', 'Leave empty to use your business phone. Example: 08012345678')}{T('phone', 'Phone for the Call button')}{T('button', 'Button label')}</>;
    case 'marquee': return <>
      <ListF label="Phrases" items={items(x.items)} onChange={(v) => set('items', v)} blank={{ text: '' }} fields={[{ key: 'text', label: 'Text' }]} max={10} />
      <RangeF label="Speed" min={0} max={60} value={Number(x.speed ?? 30)} onChange={(v) => set('speed', v)} />{C('bg', 'Background color')}{C('color', 'Text color')}</>;
    case 'countdown': return <>{T('heading', 'Heading')}{T('ends', 'Sale ends on', 'Date and time, like 2026-11-27 23:59')}{T('endedText', 'Message after it ends')}{T('button', 'Button label')}{T('link', 'Button link', linkHint)}{C('bg', 'Background color')}{C('color', 'Text color')}</>;
    case 'floatchat': return <>
      <p className="mb-3 text-xs text-slate-500">Buttons that float at the bottom of every page, so customers can message you while they browse.</p>
      {B('showWhatsapp', 'Show WhatsApp button')}{T('whatsapp', 'WhatsApp number', 'Leave empty to use your business phone.')}{T('message', 'Message customers start with')}
      <p className="mb-2 mt-4 text-xs font-bold uppercase text-slate-500">Live chat (optional, free with Tawk.to)</p>
      {T('tawkProperty', 'Tawk property ID', 'From your Tawk chat link: tawk.to/chat/PROPERTY_ID/WIDGET_ID')}{T('tawkWidget', 'Tawk widget ID')}</>;
    case 'footer': return <>
      {A('text', 'About text', 3, 'Leave empty to use your business description.')}
      {B('showPages', 'Show your pages (About, Contact...)')}{B('showPolicies', 'Show policy links')}{B('showStorefronts', 'Show store addresses')}
      {T('payments', 'Payment methods to show', 'Separate with commas, like Visa, Mastercard, Verve, Bank Transfer, Pay on delivery')}{T('instagram', 'Instagram link')}{T('facebook', 'Facebook link')}{T('tiktok', 'TikTok link')}{T('youtube', 'YouTube link')}{T('x', 'X (Twitter) link')}{C('bg', 'Background color')}{C('color', 'Text color')}</>;
  }
}
