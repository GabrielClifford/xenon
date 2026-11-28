'use client';

import type { Section } from '@/lib/store/theme';
import { MAX_BLOCKS, TRUST_ICONS } from '@/lib/store/theme';
import type { ListKind } from './fields';
import { AreaF, BoolF, ColorF, ImageF, ListF, RangeF, SelectF, Seg, TextF } from './fields';

type Owner = { userId: string; businessId: string };
const sv = (v: unknown) => (typeof v === 'string' ? v : '');
type Item = Record<string, string>;
const items = (v: unknown): Item[] => (Array.isArray(v) ? (v as Item[]) : []);

const BLOCK_KINDS: Record<string, ListKind<Item>> = {
  heading: { label: 'Heading', titleKey: 'text', blank: { type: 'heading', text: '', size: 'medium' }, fields: [{ key: 'text', label: 'Heading' }, { key: 'size', label: 'Size', options: [['small', 'Small'], ['medium', 'Medium'], ['large', 'Large']] }] },
  text: { label: 'Text', titleKey: 'text', blank: { type: 'text', text: '' }, fields: [{ key: 'text', label: 'Text (you can use **bold**, *italic*, [links](https://...) and - lists)', area: true }] },
  button: { label: 'Button', titleKey: 'label', blank: { type: 'button', label: '', link: '', style: 'solid' }, fields: [{ key: 'label', label: 'Button text' }, { key: 'link', label: 'Link' }, { key: 'style', label: 'Style', options: [['solid', 'Solid'], ['outline', 'Outline']] }] },
  image: { label: 'Image', titleKey: 'alt', blank: { type: 'image', image: '', alt: '', link: '', width: 'medium' }, fields: [{ key: 'image', label: 'Image', image: true }, { key: 'alt', label: 'Describe the image (for screen readers)' }, { key: 'link', label: 'Link (optional)' }, { key: 'width', label: 'Width', options: [['small', 'Small'], ['medium', 'Medium'], ['full', 'Full width']] }] },
  divider: { label: 'Divider line', blank: { type: 'divider' }, fields: [] },
  spacer: { label: 'Space', titleKey: 'height', blank: { type: 'spacer', height: '40' }, fields: [{ key: 'height', label: 'Height in pixels (0 to 200)' }] },
};

export type ColOpt = { id: string; title: string; handle?: string };

function SectionFields({ sec, set, owner, collections = [], productOpts = [] }: { sec: Section; set: (key: string, value: unknown) => void; owner: Owner; collections?: ColOpt[]; productOpts?: ColOpt[] }) {
  const x = sec.s;
  const T = (key: string, label: string, hint?: string) => <TextF label={label} value={sv(x[key])} onChange={(v) => set(key, v)} hint={hint} />;
  // a link box with a list of the store's own pages to pick from, so nobody has to type an address
  const LK = (key: string, label: string, hint?: string) => (
    <>
      <TextF label={label} value={sv(x[key])} onChange={(v) => set(key, v)} hint={hint} />
      <SelectF label="Or pick a page" value="" onChange={(v) => { if (v) set(key, v); }} options={[['', 'Choose a page...'], ['{store}/collections/all', 'Shop all (all products)'], ...collections.filter((c) => c.handle).map((c) => [`{store}/collections/${c.handle}`, `Collection: ${c.title}`] as [string, string]), ['{store}/cart', 'Cart page'], ['{store}', 'Home page'], ['#products', 'Products section on this page']]} />
    </>
  );
  const A = (key: string, label: string, rows = 4, hint?: string) => <AreaF label={label} rows={rows} value={sv(x[key])} onChange={(v) => set(key, v)} hint={hint} />;
  const C = (key: string, label: string) => <ColorF label={label} value={sv(x[key])} allowEmpty onChange={(v) => set(key, v)} />;
  const I = (key: string, label: string) => <ImageF label={label} value={sv(x[key])} onChange={(v) => set(key, v)} owner={owner} />;
  const B = (key: string, label: string) => <BoolF label={label} value={x[key] === true} onChange={(v) => set(key, v)} />;
  const colOpts: [string, string][] = [['all', 'All products (Shop all)'], ...collections.map((c) => [c.id, c.title] as [string, string])];
  const colHint = collections.length === 0 ? 'You have no collections yet. Create them under Products > Collections, then pick them here.' : undefined;
  const linkHint = 'Use #products to scroll to products, https://... for another website, or /b/your-store/pages/about for a page.';

  switch (sec.type) {
    case 'announcement': return <>{T('text', 'Message', 'Leave empty to hide the bar.')}{T('ends', 'Countdown ends on (optional)', 'Shows a live countdown next to the message, like 2026-11-27 23:59')}{LK('link', 'Link (optional)')}{C('bg', 'Background color')}{C('color', 'Text color')}</>;
    case 'header': return <>
      {T('logoText', 'Logo text', 'Leave empty to use your store name.')}{I('logoImage', 'Logo image (optional)')}
      <ListF label="Menu links" noun="link" items={items(x.links)} onChange={(v) => set('links', v)} blank={{ label: '', href: '' }} fields={[{ key: 'label', label: 'Label' }, { key: 'href', label: 'Link' }]} max={8} />
      <p className="-mt-1 mb-3 text-[11px] text-slate-500">{linkHint}</p>
      {B('showMenu', 'Show menu button (opens a side menu with your links and pages)')}{B('showSearch', 'Show search')}{B('showCart', 'Show cart button')}{B('showAccount', 'Show Sign in / My account')}{B('sticky', 'Keep header at the top when scrolling')}{B('center', 'Center the logo')}{B('wide', 'Full-width header')}</>;
    case 'hero': return <>
      {I('image', 'Banner image')}{T('eyebrow', 'Small text above heading (optional)')}{T('heading', 'Heading')}{T('sub', 'Subheading')}{T('button', 'Button label')}{LK('link', 'Button link', linkHint)}
      {T('ends', 'Sale countdown ends on (optional)', 'Shows a countdown on the banner, like 2026-11-27 23:59')}{T('endsLabel', 'Text above the countdown')}
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
    case 'multicolumn': return <>
      {T('heading', 'Heading (optional)')}
      <ListF label="Columns" noun="column" titleKey="heading" items={items(x.cols)} onChange={(v) => set('cols', v)} blank={{ image: '', heading: '', text: '', button: '', link: '' }} owner={owner} fields={[{ key: 'image', label: 'Image', image: true }, { key: 'heading', label: 'Heading' }, { key: 'text', label: 'Text', area: true }, { key: 'button', label: 'Link label (optional)' }, { key: 'link', label: 'Link' }]} max={12} />
      <p className="-mt-1 mb-3 text-[11px] text-slate-500">{linkHint} With no link label, the picture itself becomes the link.</p>
      <Seg label="Columns per row on phones" value={(sv(x.phoneCols) || '2') as '2'} onChange={(v) => set('phoneCols', v)} options={[['1', '1'], ['2', '2'], ['3', '3'], ['4', '4']]} />
      <p className="-mt-1 mb-3 text-[11px] text-slate-500">Fewer columns make the pictures bigger. 2 gives big tiles like a category grid. Used when "On phones" below is Side by side.</p>
      <SelectF label="Heading position" value={(sv(x.textOn) || 'below') as 'below'} onChange={(v) => set('textOn', v)} options={[['below', 'Below the picture'], ['image', 'On top of the picture']]} />
      {B('tight', 'Small gaps between pictures')}
      <SelectF label="On phones" value={(sv(x.phone) || 'row') as 'row'} onChange={(v) => set('phone', v)} options={[['row', 'Side by side, like on a computer'], ['swipe', 'Swipe sideways'], ['stack', 'One under another']]} />
      <Seg label="Columns per row" value={(sv(x.perRow) || '3') as '3'} onChange={(v) => set('perRow', v)} options={[['2', '2'], ['3', '3'], ['4', '4']]} />
      <SelectF label="Picture shape" value={(sv(x.shape) || 'portrait') as 'portrait'} onChange={(v) => set('shape', v)} options={[['portrait', 'Tall'], ['square', 'Square'], ['landscape', 'Wide'], ['round', 'Round']]} />
      <Seg label="Alignment" value={(sv(x.align) || 'center') as 'center'} onChange={(v) => set('align', v)} options={[['left', 'Left'], ['center', 'Center']]} />
      {T('button', 'Shared link text (optional)', 'A small underlined link under each column that has a link but no label, like "Learn more".')}</>;
    case 'featured': return <>
      <SelectF label="Product" value={sv(x.product)} onChange={(v) => set('product', v)} options={[['', 'Choose a product...'], ...productOpts.map((p) => [p.id, p.title] as [string, string])]} />
      {productOpts.length === 0 && <p className="-mt-2 mb-3 text-[11px] text-amber-700">You have no products yet. Add one under Products, then pick it here.</p>}
      {T('heading', 'Heading (optional)')}{T('button', 'Button label')}{B('showDesc', 'Show a short description')}
      <SelectF label="Picture position" value={x.imageRight === true ? 'right' : 'left'} onChange={(v) => set('imageRight', v === 'right')} options={[['left', 'Left'], ['right', 'Right']]} /></>;
    case 'video': return <>
      {T('url', 'Video link', 'Paste a YouTube or Vimeo link, or a direct https link to an .mp4 file.')}{T('heading', 'Heading (optional)')}{T('title', 'What the video is about (for screen readers)')}
      {I('poster', 'Cover image (optional)')}
      <SelectF label="Shape" value={(sv(x.ratio) || '16:9') as '16:9'} onChange={(v) => set('ratio', v)} options={[['16:9', 'Wide (16:9)'], ['4:3', 'Classic (4:3)'], ['1:1', 'Square'], ['9:16', 'Tall phone video (9:16)']]} />
      {B('narrow', 'Make it narrower')}</>;
    case 'slideshow': return <>
      <ListF label="Slides" noun="slide" titleKey="heading" items={items(x.slides)} onChange={(v) => set('slides', v)} blank={{ image: '', eyebrow: '', heading: '', sub: '', button: '', link: '' }} owner={owner} fields={[{ key: 'image', label: 'Image', image: true }, { key: 'eyebrow', label: 'Small text above heading (optional)' }, { key: 'heading', label: 'Heading' }, { key: 'sub', label: 'Subheading' }, { key: 'button', label: 'Button label' }, { key: 'link', label: 'Button link' }]} max={8} />
      <p className="-mt-1 mb-3 text-[11px] text-slate-500">{linkHint} Slides with no image and no heading stay hidden.</p>
      <SelectF label="Height" value={(sv(x.height) || 'medium') as 'small'} onChange={(v) => set('height', v)} options={[['small', 'Small'], ['medium', 'Medium'], ['large', 'Large']]} />
      <SelectF label="Text alignment" value={(sv(x.align) || 'center') as 'center'} onChange={(v) => set('align', v)} options={[['center', 'Center'], ['left', 'Left']]} />
      {B('autoplay', 'Change slides automatically')}
      <RangeF label="Seconds per slide" min={3} max={12} unit="s" value={Number(x.seconds ?? 5)} onChange={(v) => set('seconds', v)} />
      {B('arrows', 'Show arrows')}{B('dots', 'Show dots')}{B('outline', 'Outline button with arrow')}
      <RangeF label="Image darkening" min={0} max={80} unit="%" value={Number(x.overlay ?? 35)} onChange={(v) => set('overlay', v)} />
      {C('bg', 'Background color (when a slide has no image)')}{C('textColor', 'Text color')}</>;
    case 'custom': return <>
      <Seg label="Layout" value={(sv(x.columns) || '1') as '1'} onChange={(v) => set('columns', v)} options={[['1', 'Stacked'], ['2', '2 columns'], ['3', '3 columns']]} />
      <Seg label="Alignment" value={(sv(x.align) || 'center') as 'center'} onChange={(v) => set('align', v)} options={[['left', 'Left'], ['center', 'Center'], ['right', 'Right']]} />
      <ListF label="Blocks" noun="block" items={items(x.blocks)} onChange={(v) => set('blocks', v)} kinds={BLOCK_KINDS} owner={owner} max={MAX_BLOCKS} />
      <p className="-mt-1 mb-3 text-[11px] text-slate-500">{linkHint} Blocks show in this order, from top to bottom (or across, with columns).</p>
    </>;
    case 'richtext': return <>{T('heading', 'Heading')}{A('text', 'Text', 6, 'You can use **bold**, *italic*, [links](https://...) and - lists.')}
      <SelectF label="Alignment" value={(sv(x.align) || 'center') as 'center'} onChange={(v) => set('align', v)} options={[['center', 'Center'], ['left', 'Left']]} />{T('button', 'Button label')}{LK('link', 'Button link')}</>;
    case 'imagetext': return <>{I('image', 'Image')}{T('heading', 'Heading')}{A('text', 'Text', 6)}
      <SelectF label="Image position" value={(sv(x.imageSide) || 'left') as 'left'} onChange={(v) => set('imageSide', v)} options={[['left', 'Left'], ['right', 'Right']]} />{T('button', 'Button label')}{LK('link', 'Button link')}</>;
    case 'trust': return <ListF label="Badges" noun="badge" items={items(x.items)} onChange={(v) => set('items', v)} blank={{ icon: 'star', title: '', text: '' }}
      fields={[{ key: 'icon', label: 'Icon', options: [...TRUST_ICONS] }, { key: 'title', label: 'Title' }, { key: 'text', label: 'Text' }]} max={6} />;
    case 'testimonials': return <>{T('heading', 'Heading')}{T('subtitle', 'Small text under heading')}
      <SelectF label="Style" value={(sv(x.style) || 'cards') as 'cards'} onChange={(v) => set('style', v)} options={[['cards', 'Cards'], ['marquee', 'Endless scrolling strip']]} />
      <ListF label="Reviews" noun="review" items={items(x.items)} onChange={(v) => set('items', v)} blank={{ name: '', rating: '5', text: '' }} fields={[{ key: 'name', label: 'Customer name' }, { key: 'rating', label: 'Stars', options: ['5', '4', '3', '2', '1'] }, { key: 'text', label: 'Review', area: true }]} max={12} />
      <p className="text-[11px] text-slate-500">Only add reviews from real customers.</p></>;
    case 'faq': return <>{T('heading', 'Heading')}<ListF label="Questions" noun="question" items={items(x.items)} onChange={(v) => set('items', v)} blank={{ q: '', a: '' }} fields={[{ key: 'q', label: 'Question' }, { key: 'a', label: 'Answer', area: true }]} max={12} /></>;
    case 'contact': return <>{T('heading', 'Heading')}{A('text', 'Text', 3)}{T('whatsapp', 'WhatsApp number', 'Leave empty to use your business phone. Example: 08012345678')}{T('phone', 'Phone for the Call button')}{T('button', 'Button label')}</>;
    case 'marquee': return <>
      <ListF label="Phrases" noun="phrase" items={items(x.items)} onChange={(v) => set('items', v)} blank={{ text: '' }} fields={[{ key: 'text', label: 'Text' }]} max={10} />
      <RangeF label="Speed" min={0} max={60} value={Number(x.speed ?? 30)} onChange={(v) => set('speed', v)} />{C('bg', 'Background color')}{C('color', 'Text color')}</>;
    case 'countdown': return <>{T('heading', 'Heading')}{T('ends', 'Sale ends on', 'Date and time, like 2026-11-27 23:59')}{T('endedText', 'Message after it ends')}{T('button', 'Button label')}{LK('link', 'Button link', linkHint)}{C('bg', 'Background color')}{C('color', 'Text color')}</>;
    case 'floatchat': return <>
      <p className="mb-3 text-xs text-slate-500">Buttons that float at the bottom of every page, so customers can message you while they browse.</p>
      {B('showWhatsapp', 'Show WhatsApp button')}{T('whatsapp', 'WhatsApp number', 'Leave empty to use your business phone.')}{T('message', 'Message customers start with')}
      <p className="mb-2 mt-4 text-xs font-bold uppercase text-slate-500">Live chat (optional, free with Tawk.to)</p>
      {T('tawkProperty', 'Tawk property ID', 'From your Tawk chat link: tawk.to/chat/PROPERTY_ID/WIDGET_ID')}{T('tawkWidget', 'Tawk widget ID')}</>;
    case 'main': return <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">This part fills itself in with your {sec.page === 'collection' ? 'collection products, search and sorting' : sec.page === 'product' ? 'product photo, price and Add to cart' : sec.page === 'cart' ? 'items in the cart, quantities and the Checkout button' : 'page text'}. You can drag it up or down to put other sections above or below it.</p>;
    case 'ticker': return <>
      <p className="mb-3 text-xs text-slate-500">A thin strip under the header. Messages rotate by themselves and customers can use the arrows.</p>
      <ListF label="Messages" noun="message" items={items(x.items)} onChange={(v) => set('items', v)} blank={{ text: '', link: '' }} fields={[{ key: 'text', label: 'Message' }, { key: 'link', label: 'Link (optional)' }]} max={8} />
      <RangeF label="Seconds per message" min={2} max={15} value={Number(x.seconds ?? 5)} onChange={(v) => set('seconds', v)} />{C('bg', 'Background color')}{C('color', 'Text color')}</>;
    case 'collection': return <>
      <SelectF label="Collection" value={sv(x.collection)} onChange={(v) => set('collection', v)} options={[['', 'Choose a collection...'], ...colOpts]} />
      {colHint && <p className="-mt-2 mb-3 text-[11px] text-amber-700">{colHint}</p>}
      {T('heading', 'Heading', 'Leave empty to use the collection name.')}{T('button', '"Shop now" button label', 'Opens the page that lists every product of this collection. Leave empty to hide it.')}
      <RangeF label="Products shown" min={2} max={12} value={Number(x.limit ?? 8)} onChange={(v) => set('limit', v)} />{B('portrait', 'Tall product photos (3:4)')}</>;
    case 'collectiontabs': return <>{T('heading', 'Heading')}
      <ListF label="Tabs" noun="tab" items={items(x.tabs)} onChange={(v) => set('tabs', v)} blank={{ collection: 'all', label: '' }} fields={[{ key: 'collection', label: 'Collection', options: colOpts }, { key: 'label', label: 'Tab name (optional)' }]} max={6} />
      <p className="-mt-1 mb-3 text-[11px] text-slate-500">Add a tab for each collection you want to show. With no tabs the section stays hidden.</p>
      {T('button', '"Shop now" button label')}<RangeF label="Products shown" min={2} max={12} value={Number(x.limit ?? 8)} onChange={(v) => set('limit', v)} />{B('portrait', 'Tall product photos (3:4)')}</>;
    case 'collectionlist': return <>{T('heading', 'Heading (optional)')}
      <Seg label="Tiles per row" value={String(x.columns ?? 4)} onChange={(v) => set('columns', Number(v))} options={[['2', '2'], ['3', '3'], ['4', '4']]} />
      <ListF label="Tiles" noun="tile" owner={owner} items={items(x.items)} onChange={(v) => set('items', v)} blank={{ collection: 'all', title: '', image: '', button: 'Shop now' }} fields={[{ key: 'collection', label: 'Collection', options: colOpts }, { key: 'image', label: 'Picture (optional)', image: true }, { key: 'title', label: 'Title (optional)' }, { key: 'button', label: 'Link text' }]} max={8} />
      <p className="-mt-1 mb-3 text-[11px] text-slate-500">Add a tile for each collection. With no tiles the section stays hidden. No picture chosen = the collection's first product photo.</p></>;
    case 'infotiles': return <>{T('heading', 'Heading')}{A('text', 'Text under heading', 2)}
      <ListF label="Tiles" noun="tile" items={items(x.items)} onChange={(v) => set('items', v)} blank={{ icon: 'star', title: '', text: '' }} fields={[{ key: 'icon', label: 'Icon', options: [...TRUST_ICONS] }, { key: 'title', label: 'Title' }, { key: 'text', label: 'Text', area: true }]} max={8} /></>;
    case 'people': return <>{T('heading', 'Heading')}{T('subtitle', 'Small text under heading')}
      <ListF label="People" noun="person" owner={owner} items={items(x.items)} onChange={(v) => set('items', v)} blank={{ image: '', name: '', tag: '', role: '', verified: 'yes', link: '' }} fields={[{ key: 'image', label: 'Photo', image: true }, { key: 'name', label: 'Name' }, { key: 'tag', label: 'Label on the photo (like Football)' }, { key: 'role', label: 'Small text under name' }, { key: 'verified', label: 'Verified tick', options: [['yes', 'Show'], ['no', 'Hide']] }, { key: 'link', label: 'Link (optional)' }]} max={12} />
      <p className="text-[11px] text-slate-500">Only show people who really use or wear your products.</p></>;
    case 'gallery': return <>{T('heading', 'Heading', 'Like Follow @yourbrand. Leave empty to build it from the handle below.')}{T('handle', 'Instagram handle', 'Example: @yourbrand')}{LK('link', 'Link to your page')}
      <ListF label="Photos" noun="photo" owner={owner} items={items(x.items)} onChange={(v) => set('items', v)} blank={{ image: '', link: '' }} fields={[{ key: 'image', label: 'Photo', image: true }, { key: 'link', label: 'Link (optional)' }]} max={12} /></>;
    case 'newsletter': return <>{T('heading', 'Heading')}{A('text', 'Text', 2)}{T('button', 'Button label')}{T('success', 'Message after signing up')}{C('bg', 'Background color')}{C('color', 'Text color')}
      <p className="text-xs text-slate-500">Sign-ups are saved in Online Store &gt; Preferences &gt; Newsletter sign-ups.</p></>;
    case 'footer': return <>
      <Seg label="Layout" value={(sv(x.layout) || 'classic') as 'classic'} onChange={(v) => set('layout', v)} options={[['classic', 'Simple'], ['columns', '4 columns']]} />
      {x.layout === 'columns' && <>{T('aboutHeading', 'About column title')}{T('shopHeading', 'Shop column title', 'Lists your collections.')}{T('supportHeading', 'Support column title', 'Lists your pages and policies.')}{B('newsletter', 'Newsletter box in the 4th column')}{T('newsHeading', 'Newsletter title')}{T('newsText', 'Newsletter text')}</>}
      {A('text', 'About text', 3, 'Shown only if you write something here.')}{T('phone', 'Contact phone', 'Shown only if you add it.')}{T('whatsapp', 'WhatsApp number', 'Adds a WhatsApp icon. Leave empty to hide it.')}
      {B('showPages', 'Show your pages (About, Contact...)')}{B('showPolicies', 'Show policy links')}{B('showStorefronts', 'Show store addresses')}
      {T('payments', 'Payment methods to show', 'Separate with commas, like Visa, Mastercard, Verve, Bank Transfer, Pay on delivery')}{T('instagram', 'Instagram link')}{T('facebook', 'Facebook link')}{T('tiktok', 'TikTok link')}{T('youtube', 'YouTube link')}{T('x', 'X (Twitter) link')}{C('bg', 'Background color')}{C('color', 'Text color')}</>;
  }
}

// Section style: the same few settings on every section, like Shopify's section padding and color settings
export default function SectionForm(props: { sec: Section; set: (key: string, value: unknown) => void; owner: Owner; collections?: ColOpt[]; productOpts?: ColOpt[] }) {
  const { sec, set } = props;
  const x = sec.s;
  const styleable = sec.type !== 'header' && sec.type !== 'floatchat';
  const n = (k: string) => (sv(x[k]) === '' ? 0 : Number(x[k]));
  const touched = ['_pt', '_pb', '_bg', '_color', '_width', '_scheme'].some((k) => sv(x[k]) !== '') || x._hm === true || x._hd === true;
  return (
    <>
      <SectionFields {...props} />
      {styleable && (
        <details className="mt-5 rounded-lg border border-slate-200 p-3" open={touched}>
          <summary className="cursor-pointer text-sm font-semibold text-slate-800">Section style</summary>
          <div className="mt-3 space-y-3">
            <RangeF label="Space above" value={n('_pt')} onChange={(v) => set('_pt', String(v))} min={0} max={160} unit="px" />
            <RangeF label="Space below" value={n('_pb')} onChange={(v) => set('_pb', String(v))} min={0} max={160} unit="px" />
            <Seg label="Width" value={(sv(x._width) || 'default') as 'default'} onChange={(v) => set('_width', v === 'default' ? '' : v)} options={[['default', 'Page'], ['narrow', 'Narrow'], ['full', 'Full width']] as [string, string][] as ['default' | 'narrow' | 'full', string][]} />
            <SelectF label="Color scheme" value={sv(x._scheme)} onChange={(v) => set('_scheme', v)} options={[['', 'Theme colors'], ['1', 'Scheme 1'], ['2', 'Scheme 2'], ['3', 'Scheme 3']]} />
            <ColorF label="Section background" value={sv(x._bg)} allowEmpty onChange={(v) => set('_bg', v)} />
            <ColorF label="Section text color" value={sv(x._color)} allowEmpty onChange={(v) => set('_color', v)} />
            <BoolF label="Hide on phones" value={x._hm === true} onChange={(v) => set('_hm', v)} />
            <BoolF label="Hide on computers" value={x._hd === true} onChange={(v) => set('_hd', v)} />
            {touched && <button type="button" className="text-xs font-semibold text-blue-600 hover:underline" onClick={() => { for (const k of ['_pt', '_pb', '_bg', '_color', '_width', '_scheme']) set(k, ''); set('_hm', false); set('_hd', false); }}>Reset section style</button>}
          </div>
        </details>
      )}
    </>
  );
}
