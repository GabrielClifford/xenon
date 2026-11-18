// Roles and permissions for the Xenon dashboard.
// The Roles page uses this to build its permission tree, and it is also what
// you will use later to hide or block screens for staff.

export type RoleCategory = 'store' | 'organization';

export type PermDef = {
  key: string;
  label: string;
  needs?: string[]; // permissions that must be on for this one to work
  org?: boolean; // only organization roles can hold this
};
export type PermGroup = { id: string; label: string; perms: PermDef[] };

const p = (key: string, label: string, needs?: string[], org?: boolean): PermDef => ({ key, label, needs, org });

export const permissionGroups: PermGroup[] = [
  { id: 'home', label: 'Home', perms: [p('home.view', 'View the home dashboard')] },
  {
    id: 'orders',
    label: 'Orders',
    perms: [
      p('orders.view', 'View orders'),
      p('orders.create', 'Create orders', ['orders.view']),
      p('orders.edit', 'Edit orders', ['orders.view']),
      p('orders.fulfill', 'Mark orders as fulfilled', ['orders.view']),
      p('orders.cancel', 'Cancel orders', ['orders.view']),
      p('orders.refund', 'Refund orders', ['orders.view']),
      p('orders.export', 'Export orders', ['orders.view']),
      p('orders.delete', 'Delete orders', ['orders.view']),
    ],
  },
  {
    id: 'products',
    label: 'Products',
    perms: [
      p('products.view', 'View products'),
      p('products.create', 'Create products', ['products.view']),
      p('products.edit', 'Edit products', ['products.view']),
      p('products.delete', 'Delete products', ['products.view']),
      p('products.inventory', 'Change stock levels', ['products.view']),
      p('products.export', 'Export products', ['products.view']),
      p('products.catalogs', 'Manage catalogs', ['products.view']),
    ],
  },
  {
    id: 'customers',
    label: 'Customers',
    perms: [
      p('customers.view', 'View customers'),
      p('customers.create', 'Create customers', ['customers.view']),
      p('customers.edit', 'Edit customers', ['customers.view']),
      p('customers.delete', 'Delete customers', ['customers.view']),
      p('customers.export', 'Export customers', ['customers.view']),
      p('customers.message', 'Send messages to customers', ['customers.view']),
    ],
  },
  {
    id: 'discounts',
    label: 'Discounts',
    perms: [
      p('discounts.view', 'View discounts'),
      p('discounts.manage', 'Create and edit discounts', ['discounts.view']),
      p('discounts.delete', 'Delete discounts', ['discounts.view']),
    ],
  },
  {
    id: 'content',
    label: 'Content',
    perms: [
      p('content.view', 'View custom content'),
      p('content.edit', 'Create and edit entries', ['content.view']),
      p('content.delete', 'Delete entries', ['content.view']),
      p('content.definitions', 'Manage content types and fields', ['content.view']),
    ],
  },
  {
    id: 'markets',
    label: 'Markets',
    perms: [p('markets.view', 'View markets'), p('markets.manage', 'Create and edit markets', ['markets.view'])],
  },
  {
    id: 'checkout',
    label: 'Checkout and customer accounts',
    perms: [p('checkout.manage', 'Manage checkout settings'), p('accounts.manage', 'Manage customer accounts')],
  },
  {
    id: 'marketing',
    label: 'Marketing',
    perms: [
      p('marketing.view', 'View marketing'),
      p('marketing.pixels', 'Manage customer events and pixels', ['marketing.view']),
      p('marketing.notifications', 'Manage notifications', ['marketing.view']),
      p('marketing.channels', 'Manage sales channels', ['marketing.view']),
    ],
  },
  {
    id: 'analytics',
    label: 'Analytics',
    perms: [p('analytics.view', 'View analytics'), p('analytics.export', 'Export analytics', ['analytics.view'])],
  },
  {
    id: 'website',
    label: 'Online store',
    perms: [
      p('website.view', 'View website design'),
      p('website.edit', 'Edit website design', ['website.view']),
      p('website.publish', 'Publish website changes', ['website.view']),
    ],
  },
  {
    id: 'settings',
    label: 'Settings',
    perms: [
      p('settings.general', 'Edit general settings'),
      p('settings.payments', 'Manage payments'),
      p('settings.shipping', 'Manage shipping and delivery'),
      p('settings.taxes', 'Manage taxes and duties'),
      p('settings.locations', 'Manage locations'),
      p('settings.domains', 'Manage domains'),
      p('settings.languages', 'Manage languages'),
      p('settings.privacy', 'Manage customer privacy'),
      p('settings.policies', 'Manage policies'),
      p('settings.plan_billing', 'View plan and billing', undefined, true),
      p('settings.users', 'Manage users', undefined, true),
      p('settings.roles', 'Manage roles', undefined, true),
    ],
  },
];

export const allPerms: PermDef[] = permissionGroups.flatMap((g) => g.perms);
export const allKeys: string[] = allPerms.map((x) => x.key);
export const permByKey: Record<string, PermDef> = Object.fromEntries(allPerms.map((x) => [x.key, x]));

export const keysFor = (category: RoleCategory) => allPerms.filter((x) => category === 'organization' || !x.org).map((x) => x.key);

// Turn one permission on or off. Turning one on also turns on what it needs;
// turning one off also turns off everything that needs it.
export function togglePerm(selected: ReadonlySet<string>, key: string, on: boolean): Set<string> {
  const next = new Set(selected);
  if (on) {
    const add = (k: string) => {
      if (!permByKey[k] || next.has(k)) return;
      next.add(k);
      permByKey[k].needs?.forEach(add);
    };
    add(key);
  } else {
    const drop = (k: string) => {
      next.delete(k);
      for (const x of allPerms) if (x.needs?.includes(k) && next.has(x.key)) drop(x.key);
    };
    drop(key);
  }
  return next;
}

// Removes unknown keys and keys the category may not hold, then adds anything still needed.
export function cleanPermissions(category: RoleCategory, keys: readonly string[]): string[] {
  const allowed = new Set(keysFor(category));
  let out = new Set<string>();
  for (const k of keys) if (allowed.has(k)) out = togglePerm(out, k, true);
  return allKeys.filter((k) => out.has(k));
}

export type DefaultRole = {
  key: string;
  name: string;
  description: string;
  category: RoleCategory;
  permissions: string[];
  summary?: { privileges: string[]; limitations: string[] };
};

const only = (g: string, ...except: string[]) => permissionGroups.find((x) => x.id === g)!.perms.map((x) => x.key).filter((k) => !except.includes(k));

// Roles that come with Xenon. They cannot be edited, but any of them can be duplicated.
export const defaultRoles: DefaultRole[] = [
  {
    key: 'administrator',
    name: 'Administrator',
    description: 'Full access to everything in your Xenon dashboard.',
    category: 'organization',
    permissions: allKeys,
  },
  {
    key: 'app-developer',
    name: 'App developer',
    description: 'Can set up tracking pixels and notification webhooks.',
    category: 'organization',
    permissions: ['home.view', 'marketing.view', 'marketing.pixels', 'marketing.notifications'],
    summary: {
      privileges: ['Add, edit and remove custom pixels in Customer events', 'Set up notification webhooks'],
      limitations: ['Unable to see orders, customers or products', 'Unable to access payments, billing or plan information'],
    },
  },
  {
    key: 'customer-support',
    name: 'Customer support',
    description: 'Can look after orders and talk to customers.',
    category: 'store',
    permissions: ['home.view', 'orders.view', 'orders.edit', 'orders.fulfill', 'orders.cancel', 'orders.refund', 'customers.view', 'customers.message'],
  },
  {
    key: 'limited-permissions',
    name: 'Limited permissions',
    description: 'A starting point with access to the home page only. Duplicate it to build your own role.',
    category: 'store',
    permissions: ['home.view'],
  },
  {
    key: 'marketer',
    name: 'Marketer',
    description: 'Can run marketing, view customers and read analytics.',
    category: 'store',
    permissions: ['home.view', 'customers.view', 'customers.export', ...only('marketing'), 'content.view', 'analytics.view', 'analytics.export', 'discounts.view'],
  },
  {
    key: 'online-store-editor',
    name: 'Online store editor',
    description: 'Can edit and publish the website design and its content.',
    category: 'store',
    permissions: ['home.view', ...only('website'), 'content.view', 'content.edit', 'content.delete'],
  },
  {
    key: 'store-manager',
    name: 'Store manager',
    description: 'Runs day-to-day sales: orders, products, customers and discounts.',
    category: 'store',
    permissions: [
      'home.view',
      ...only('orders', 'orders.delete'),
      ...only('products', 'products.delete'),
      'customers.view',
      'customers.create',
      'customers.edit',
      'customers.message',
      'discounts.view',
      'discounts.manage',
      'content.view',
      'markets.view',
      'marketing.view',
      'analytics.view',
      'website.view',
      'settings.locations',
    ],
  },
];

// Which permission opens which Settings page. Use it later to hide pages from staff.
export const pagePermission: Record<string, string | null> = {
  general: 'settings.general',
  plan: 'settings.plan_billing',
  billing: 'settings.plan_billing',
  users: 'settings.users',
  roles: 'settings.roles',
  security: null, // everyone can change their own password
  payments: 'settings.payments',
  checkout: 'checkout.manage',
  accounts: 'accounts.manage',
  shipping: 'settings.shipping',
  taxes: 'settings.taxes',
  locations: 'settings.locations',
  markets: 'markets.view',
  channels: 'marketing.channels',
  domains: 'settings.domains',
  events: 'marketing.pixels',
  notifications: 'marketing.notifications',
  metafields: 'content.definitions',
  languages: 'settings.languages',
  privacy: 'settings.privacy',
  policies: 'settings.policies',
};

export const can = (permissions: readonly string[], key: string | null) => key === null || permissions.includes(key);
