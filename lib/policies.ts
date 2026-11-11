export type PolicyType = 'refund' | 'privacy' | 'terms' | 'shipping' | 'contact' | 'legal';

export const policyTypes: { type: PolicyType; label: string; required?: boolean }[] = [
  { type: 'refund', label: 'Return and refund policy' },
  { type: 'privacy', label: 'Privacy policy' },
  { type: 'terms', label: 'Terms of service' },
  { type: 'shipping', label: 'Shipping policy' },
  { type: 'contact', label: 'Contact information', required: true },
  { type: 'legal', label: 'Legal notice' },
];

export type PolicyDoc = { text: string; published: boolean };
export type ContactInfo = {
  email: string;
  phone: string;
  whatsapp: string;
  address: string;
  hours: string;
  published: boolean;
};
export type Policies = {
  showLinks: boolean;
  refund: PolicyDoc;
  privacy: PolicyDoc & { auto: boolean };
  terms: PolicyDoc;
  shipping: PolicyDoc;
  legal: PolicyDoc;
  contact: ContactInfo;
};

export const defaultPolicies: Policies = {
  showLinks: true,
  refund: { text: '', published: false },
  privacy: { text: '', published: true, auto: true },
  terms: { text: '', published: false },
  shipping: { text: '', published: false },
  legal: { text: '', published: false },
  contact: { email: '', phone: '', whatsapp: '', address: '', hours: '', published: false },
};

function obj(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
}

export function readPolicies(raw: unknown): Policies {
  const r = obj(raw);
  const d = defaultPolicies;
  return {
    showLinks: typeof r.showLinks === 'boolean' ? r.showLinks : d.showLinks,
    refund: { ...d.refund, ...obj(r.refund) } as PolicyDoc,
    privacy: { ...d.privacy, ...obj(r.privacy) } as Policies['privacy'],
    terms: { ...d.terms, ...obj(r.terms) } as PolicyDoc,
    shipping: { ...d.shipping, ...obj(r.shipping) } as PolicyDoc,
    legal: { ...d.legal, ...obj(r.legal) } as PolicyDoc,
    contact: { ...d.contact, ...obj(r.contact) } as ContactInfo,
  };
}

// ---------- return and cancellation rules ----------
export type Rule = {
  id: string;
  name: string;
  categories: string[];
  finalSale: boolean;
  returnDays: number;
  returnFeePct: number;
  cancelFeePct: number;
};
export type Rules = { configured: boolean; default: Rule; custom: Rule[] };

export const defaultRule: Rule = {
  id: 'default',
  name: 'Default rules',
  categories: [],
  finalSale: false,
  returnDays: 14,
  returnFeePct: 0,
  cancelFeePct: 0,
};

function readRule(raw: unknown, fallback: Rule): Rule {
  const r = obj(raw);
  return {
    id: typeof r.id === 'string' ? r.id : fallback.id,
    name: typeof r.name === 'string' ? r.name : fallback.name,
    categories: Array.isArray(r.categories) ? (r.categories as unknown[]).filter((x): x is string => typeof x === 'string') : [],
    finalSale: !!r.finalSale,
    returnDays: Number(r.returnDays) > 0 ? Number(r.returnDays) : fallback.returnDays,
    returnFeePct: Number(r.returnFeePct) || 0,
    cancelFeePct: Number(r.cancelFeePct) || 0,
  };
}

export function readRules(raw: unknown): Rules {
  const r = obj(raw);
  return {
    configured: 'default' in r,
    default: readRule(r.default, defaultRule),
    custom: Array.isArray(r.custom)
      ? (r.custom as unknown[]).map((x, i) => readRule(x, { ...defaultRule, id: `rule-${i}`, name: 'Rule' }))
      : [],
  };
}

export function ruleSummary(rules: Rules): string {
  if (!rules.configured) return 'No rules set';
  const d = rules.default;
  const returns = d.finalSale ? 'Final sale' : `${d.returnDays}-day returns`;
  return `${returns} · ${d.returnFeePct}% return fee`;
}

// ---------- status, links and text ----------
export function policyStatus(type: PolicyType, pol: Policies): string {
  if (type === 'contact') {
    const c = pol.contact;
    const has = c.email || c.phone || c.whatsapp || c.address || c.hours;
    return !has ? 'No policy set' : c.published ? 'Published' : 'Draft';
  }
  if (type === 'privacy') {
    const p = pol.privacy;
    if (p.auto) return p.published ? 'Published · Automated' : 'Not published · Automated';
    return !p.text.trim() ? 'No policy set' : p.published ? 'Published' : 'Draft';
  }
  const d = pol[type];
  return !d.text.trim() ? 'No policy set' : d.published ? 'Published' : 'Draft';
}

export function isPublished(pol: Policies, type: PolicyType): boolean {
  if (type === 'contact') {
    const c = pol.contact;
    return c.published && !!(c.email || c.phone || c.whatsapp || c.address);
  }
  if (type === 'privacy') return pol.privacy.published && (pol.privacy.auto || !!pol.privacy.text.trim());
  return pol[type].published && !!pol[type].text.trim();
}

export function publishedLinks(raw: unknown, slug: string): { label: string; href: string }[] {
  const pol = readPolicies(raw);
  if (!pol.showLinks) return [];
  return policyTypes
    .filter((t) => isPublished(pol, t.type))
    .map((t) => ({ label: t.label, href: `/b/${slug}/policies/${t.type}` }));
}

export type PolicyCtx = { name: string; contact: string; rules: Rules };

export function contactLine(pol: Policies, bizPhone: string): string {
  const c = pol.contact;
  const parts = [c.email, c.phone || bizPhone, c.whatsapp ? `WhatsApp ${c.whatsapp}` : ''].filter(Boolean);
  return parts.length ? parts.join(', ') : 'the details on our contact page';
}

export function contactText(c: ContactInfo, name: string): string {
  const lines = [`Get in touch with ${name || 'us'}.`, ''];
  if (c.email) lines.push(`Email: ${c.email}`);
  if (c.phone) lines.push(`Phone: ${c.phone}`);
  if (c.whatsapp) lines.push(`WhatsApp: ${c.whatsapp}`);
  if (c.address) lines.push(`Address: ${c.address}`);
  if (c.hours) lines.push(`Opening hours: ${c.hours}`);
  return lines.join('\n');
}

export function templateFor(type: PolicyType, c: PolicyCtx): string {
  const name = c.name || 'our store';
  const d = c.rules.default;

  if (type === 'refund') {
    const finals = c.rules.custom.filter((r) => r.finalSale && r.categories.length).flatMap((r) => r.categories);
    const L: string[] = [];
    L.push(`Thank you for shopping with ${name}. If something is not right with your order, we want to help.`, '', 'Returns');
    L.push(
      d.finalSale
        ? 'Items are final sale and cannot be returned unless they arrive damaged or wrong.'
        : `You can ask to return an order within ${d.returnDays} days of ordering. Items must be unused and in their original condition.`
    );
    if (finals.length) L.push(`These items are final sale and cannot be returned: ${finals.join(', ')}.`);
    if (!d.finalSale && d.returnFeePct > 0) L.push(`A restocking fee of ${d.returnFeePct}% of the item price may apply to returns.`);
    L.push('', 'Cancellations');
    L.push(
      'You can ask to cancel an order before we start preparing it.' +
        (d.cancelFeePct > 0 ? ` A cancellation fee of ${d.cancelFeePct}% of the item price may apply.` : '')
    );
    L.push('', 'How to ask', 'Sign in to your account on our store and choose Cancel order or Return order, or contact us using the details on our contact page.');
    L.push('', 'Refunds', 'When we approve a return or cancellation, we will refund you the way you paid, or give you store credit. Refunds take [number] working days.');
    return L.join('\n');
  }

  if (type === 'privacy') {
    return [
      `${name} respects your privacy. This policy explains what information we collect and how we use it.`,
      '',
      'Information we collect',
      '- When you place an order: your name, phone number, delivery address, order notes, the items you order and, if we ask for it, your email address.',
      '- When you create an account: your name, email address, phone number, order history and store credit balance.',
      '- When you visit our website: simple visit statistics, such as how many people visit and which link they came from.',
      '',
      'How we use your information',
      '- To process, deliver and follow up on your orders.',
      '- To manage your account and answer your questions.',
      '- To send news and offers, only if you agreed to receive them.',
      '- To understand how our website is used and improve it.',
      '',
      'Sharing',
      'We do not sell your information. We only share it with people who help us serve you, such as delivery partners, and with Xenon, the platform that runs this online store.',
      '',
      'Your choices',
      `You can ask to see, correct or delete your information, or stop news and offers, by contacting us: ${c.contact}.`,
    ].join('\n');
  }

  if (type === 'terms') {
    return [
      `By placing an order on the ${name} website you agree to these terms.`,
      '',
      'Orders',
      '- Placing an order is a request to buy. We confirm it by contacting you or by marking your order as being prepared.',
      '- Prices are in Nigerian naira (₦). If we make a pricing mistake, we will tell you before we go ahead.',
      '- Items are subject to availability.',
      '',
      'Payment',
      'You can pay on delivery or by bank transfer, as shown at checkout. For bank transfer, use your order number as the reference.',
      '',
      'Delivery, returns and cancellations',
      'Please read our shipping policy and our return and refund policy.',
      '',
      'Contact',
      `Questions about these terms: ${c.contact}.`,
    ].join('\n');
  }

  if (type === 'shipping') {
    return [
      `Delivery with ${name}`,
      '',
      'Where we deliver: [list the areas you deliver to]',
      'How long it takes: usually [number] working days after your order is confirmed.',
      'Delivery fee: [say how much, or write Free]',
      '',
      'Please give us a correct address and phone number so our rider can reach you. If your order is delayed, we will contact you.',
    ].join('\n');
  }

  if (type === 'legal') {
    return [
      name,
      'Registered business name: [your registered business name]',
      'Registration number: [your business registration number, if you have one]',
      'Address: [your business address]',
    ].join('\n');
  }

  return '';
}

export function policyText(type: PolicyType, pol: Policies, c: PolicyCtx): string {
  if (type === 'contact') return contactText(pol.contact, c.name);
  if (type === 'privacy') return pol.privacy.auto ? templateFor('privacy', c) : pol.privacy.text;
  return pol[type].text;
}