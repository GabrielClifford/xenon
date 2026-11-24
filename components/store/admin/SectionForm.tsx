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
      {B('showSearch', 'Show search')}{B('showCart', 'Show cart button')}{B('sticky', 'Keep header at the top when scrolling')}{B('center', 'Center the logo on small screens')}</>;
    case 'hero': return <>
      {I('image', 'Banner image')}{T('heading', 'Heading')}{T('sub', 'Subheading')}{T('button', 'Button label')}{T('link', 'Button link', linkHint)}
      <SelectF label="Height" value={(sv(x.height) || 'medium') as 'small'} onChange={(v) => set('height', v)} options={[['small', 'Small'], ['medium', 'Medium'], ['large', 'Large']]} />
      <SelectF label="Text alignment" value={(sv(x.align) || 'center') as 'center'} onChange={(v) => set('align', v)} options={[['center', 'Center'], ['left', 'Left']]} />
      <RangeF label="Image darkening" min={0} max={80} unit="%" value={Number(x.overlay ?? 35)} onChange={(v) => set('overlay', v)} />
      {C('bg', 'Background color (when no image)')}{C('textColor', 'Text color')}</>;
    case 'products': return <>{T('heading', 'Heading')}{B('showTrack', 'Show "Track my order" link')}
      <p className="text-xs text-slate-500">Products, search, cart and checkout come from your Products page. Colors and card style come from Theme settings.</p></>;
    case 'richtext': return <>{T('heading', 'Heading')}{A('text', 'Text', 6, 'You can use **bold**, *italic*, [links](https://...) and - lists.')}
      <SelectF label="Alignment" value={(sv(x.align) || 'center') as 'center'} onChange={(v) => set('align', v)} options={[['center', 'Center'], ['left', 'Left']]} />{T('button', 'Button label')}{T('link', 'Button link')}</>;
    case 'imagetext': return <>{I('image', 'Image')}{T('heading', 'Heading')}{A('text', 'Text', 6)}
      <SelectF label="Image position" value={(sv(x.imageSide) || 'left') as 'left'} onChange={(v) => set('imageSide', v)} options={[['left', 'Left'], ['right', 'Right']]} />{T('button', 'Button label')}{T('link', 'Button link')}</>;
    case 'trust': return <ListF label="Badges" items={items(x.items)} onChange={(v) => set('items', v)} blank={{ icon: 'star', title: '', text: '' }}
      fields={[{ key: 'icon', label: 'Icon', options: [...TRUST_ICONS] }, { key: 'title', label: 'Title' }, { key: 'text', label: 'Text' }]} max={6} />;
    case 'testimonials': return <>{T('heading', 'Heading')}<ListF label="Reviews" items={items(x.items)} onChange={(v) => set('items', v)} blank={{ name: '', text: '' }} fields={[{ key: 'name', label: 'Customer name' }, { key: 'text', label: 'Review', area: true }]} max={9} />
      <p className="text-[11px] text-slate-500">Only add reviews from real customers.</p></>;
    case 'faq': return <>{T('heading', 'Heading')}<ListF label="Questions" items={items(x.items)} onChange={(v) => set('items', v)} blank={{ q: '', a: '' }} fields={[{ key: 'q', label: 'Question' }, { key: 'a', label: 'Answer', area: true }]} max={12} /></>;
    case 'contact': return <>{T('heading', 'Heading')}{A('text', 'Text', 3)}{T('whatsapp', 'WhatsApp number', 'Leave empty to use your business phone. Example: 08012345678')}{T('phone', 'Phone for the Call button')}{T('button', 'Button label')}</>;
    case 'footer': return <>
      {A('text', 'About text', 3, 'Leave empty to use your business description.')}
      {B('showPages', 'Show your pages (About, Contact...)')}{B('showPolicies', 'Show policy links')}{B('showStorefronts', 'Show store addresses')}
      {T('instagram', 'Instagram link')}{T('facebook', 'Facebook link')}{T('tiktok', 'TikTok link')}{T('x', 'X (Twitter) link')}{C('bg', 'Background color')}{C('color', 'Text color')}</>;
  }
}
