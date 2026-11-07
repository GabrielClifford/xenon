'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { User } from '@supabase/supabase-js';
import {
  BarChart3, Bell, ChevronDown, Crown, Globe, Headphones, Home, LayoutGrid, LogOut,
  Megaphone, MoreHorizontal, Package, Search, Settings, ShoppingBag, Tag, Users, X, Zap,
} from 'lucide-react';
import BusinessForm from '@/components/BusinessForm';
import ChannelsPanel from '@/components/ChannelsPanel';
import CustomersPanel from '@/components/CustomersPanel';
import DiscountsPanel from '@/components/DiscountsPanel';
import OrdersPanel from '@/components/OrdersPanel';
import ProductsPanel from '@/components/ProductsPanel';
import DashboardOverview, { type Tab } from '@/components/DashboardOverview';
import { channels, type ChannelId } from '@/lib/channels';
import { createClient } from '@/lib/supabase/client';
import TemplatesPanel from '@/components/TemplatesPanel';
import AnalyticsPanel from '@/components/AnalyticsPanel';

type Meta = { full_name?: string; phone?: string; role?: string; trade?: string };
type NavId = Tab | 'analytics' | 'marketing' | 'templates' | 'support';
type Item = { id: NavId; label: string; icon: React.ElementType; soon?: boolean; artisanOnly?: boolean };
type Biz = { id: string; name: string; slug: string; published: boolean };

const mainItems: Item[] = [
  { id: 'home', label: 'Dashboard', icon: Home },
  { id: 'orders', label: 'Orders', icon: ShoppingBag, artisanOnly: true },
  { id: 'website', label: 'My website', icon: Globe, artisanOnly: true },
  { id: 'products', label: 'Products', icon: Package, artisanOnly: true },
  { id: 'customers', label: 'Customers', icon: Users, artisanOnly: true },
  { id: 'discounts', label: 'Discounts', icon: Tag, artisanOnly: true },
  { id: 'analytics', label: 'Analytics', icon: BarChart3, soon: true, artisanOnly: true },
    { id: 'analytics', label: 'Analytics', icon: BarChart3, artisanOnly: true },
    { id: 'templates', label: 'Templates', icon: LayoutGrid, artisanOnly: true },
  { id: 'support', label: 'Support', icon: Headphones, soon: true, artisanOnly: true },
];

const row = 'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition';
const tone = (active: boolean) => (active ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100');

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [tab, setTab] = useState<Tab>('home');
  const [channel, setChannel] = useState<ChannelId>('website');
  const [biz, setBiz] = useState<Biz | null>(null);
  const [newOrders, setNewOrders] = useState(0);
  const [newEnq, setNewEnq] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [warm, setWarm] = useState(false);
  const [homeKey, setHomeKey] = useState(0);
    const homeLoaded = useRef(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setUser(data.session.user);
    });
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) router.replace('/login');
      else setUser((u) => (u?.id === data.user.id ? u : data.user));
    });
  }, [router]);

  // after Home appears, quietly load the other pages in the background
    useEffect(() => {
    homeLoaded.current = Date.now();
    const t = setTimeout(() => setWarm(true), 1200);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const uid = user?.id;
    if (!uid) return;
    const supabase = createClient();
    (async () => {
      const { data: b } = await supabase
        .from('businesses')
        .select('id,name,slug,published')
        .eq('owner_id', uid)
        .maybeSingle();
      if (!b) {
        setBiz(null);
        return;
      }
      setBiz(b as Biz);
      const [o, e] = await Promise.all([
        supabase.from('orders').select('id', { count: 'exact', head: true }).eq('business_id', b.id).eq('status', 'new'),
        supabase.from('enquiries').select('id', { count: 'exact', head: true }).eq('business_id', b.id).eq('status', 'new'),
      ]);
      setNewOrders(o.count ?? 0);
      setNewEnq(e.count ?? 0);
    })();
  }, [user?.id, tab]); // eslint-disable-line react-hooks/exhaustive-deps

  async function logout() {
    await createClient().auth.signOut();
    router.push('/');
    router.refresh();
  }

  function go(t: Tab) {
    // refresh Home if it has been more than 2 minutes since it last loaded
    if (t === 'home' && Date.now() - homeLoaded.current > 120000) {
      setHomeKey((k) => k + 1);
      homeLoaded.current = Date.now();
    }
    setTab(t);
    setMoreOpen(false);
    setMenuOpen(false);
    setQuery('');
    setSearchOpen(false);
  }

  function openChannel(id: ChannelId) {
    setChannel(id);
    setTab('channels');
    setMoreOpen(false);
  }

  if (!user) return <div className="min-h-screen bg-slate-50" />;

  const meta = (user.user_metadata ?? {}) as Meta;
  const isArtisan = meta.role === 'artisan';
  const name = meta.full_name || user.email || 'Account';
  const initials = name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  const items = mainItems.filter((i) => isArtisan || !i.artisanOnly);
  const alerts = newOrders + newEnq;
  const show = (id: Tab) => (tab === id ? '' : 'hidden');
  const mount = (id: Tab) => tab === id || warm;

  const pages = [...items.filter((i) => !i.soon), { id: 'settings' as NavId, label: 'Settings', icon: Settings }];
  const matches = query.trim()
    ? pages.filter((p) => p.label.toLowerCase().includes(query.trim().toLowerCase()))
    : [];

  const searchBox = (autoFocus: boolean) => (
    <div className="relative">
      <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoFocus={autoFocus}
        placeholder="Search pages, e.g. Orders, Products..."
        className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-blue-500"
      />
      {matches.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          {matches.map((m) => (
            <button
              key={m.id}
              onClick={() => go(m.id as Tab)}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-slate-50"
            >
              <m.icon className="h-4 w-4 text-slate-500" /> {m.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
  function navItem({ id, label, icon: Icon, soon }: Item) {
    if (soon) {
      return (
        <span key={id} className={`${row} cursor-not-allowed text-slate-400`}>
          <Icon className="h-5 w-5" /> {label}
          <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
            Soon
          </span>
        </span>
      );
    }
    const active = tab === id;
    return (
      <button key={id} onClick={() => go(id as Tab)} className={`${row} ${tone(active)}`}>
        <Icon className="h-5 w-5" /> {label}
        {id === 'orders' && newOrders > 0 && (
          <span
            className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold ${
              active ? 'bg-white text-blue-600' : 'bg-blue-600 text-white'
            }`}
          >
            {newOrders}
          </span>
        )}
      </button>
    );
  }

  const logo = (
    <Link href="/" className="flex items-center gap-2">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white">
        <Zap className="h-5 w-5" />
      </span>
      <span className="font-display text-xl font-bold">
        Xe<span className="text-blue-600">Non</span>
      </span>
    </Link>
  );

  const tabBtn = (id: Tab, label: string, Icon: React.ElementType, badge = 0) => (
    <button
      key={id}
      onClick={() => go(id)}
      className={`relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${
        tab === id ? 'text-blue-600' : 'text-slate-500'
      }`}
    >
      <Icon className="h-5 w-5" />
      {label}
      {badge > 0 && (
        <span className="absolute right-[28%] top-1 rounded-full bg-blue-600 px-1.5 text-[9px] font-semibold text-white">
          {badge}
        </span>
      )}
    </button>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 md:flex">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white p-4 md:sticky md:top-0 md:flex md:h-screen md:overflow-y-auto">
        <div className="px-2 pb-6 pt-1">{logo}</div>
        <nav className="space-y-1">{items.map(navItem)}</nav>

        {isArtisan && (
          <div className="mt-6">
            <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Sales channels</p>
            <div className="space-y-1">
              {channels.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => openChannel(id)}
                  className={`${row} ${tone(tab === 'channels' && channel === id)}`}
                >
                  <Icon className="h-5 w-5" /> {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {isArtisan && (
          <div className="mt-6 rounded-2xl bg-blue-50 p-4">
            <Crown className="h-6 w-6 text-blue-600" />
            <p className="mt-2 font-display font-bold leading-tight">Upgrade to Pro Plan</p>
            <p className="mt-1 text-xs text-slate-600">Unlock more features and grow bigger.</p>
            <Link
              href="/#pricing"
              className="mt-3 block rounded-xl bg-blue-600 py-2 text-center text-xs font-semibold text-white hover:bg-blue-700"
            >
              Upgrade now
            </Link>
          </div>
        )}

        <div className="mt-auto space-y-1 pt-6">
          {biz?.published && (
            <Link
              href={`/b/${biz.slug}`}
              className="mb-2 flex items-center gap-3 rounded-2xl bg-blue-50 p-3 hover:bg-blue-100"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white">
                <ShoppingBag className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block truncate text-sm font-semibold">{biz.name}</span>
                <span className="block text-xs text-slate-500">Built with Xenon</span>
              </span>
            </Link>
          )}
          <button onClick={() => go('settings')} className={`${row} ${tone(tab === 'settings')}`}>
            <Settings className="h-5 w-5" /> Settings
          </button>
          <button onClick={logout} className={`${row} text-slate-600 hover:bg-slate-100`}>
            <LogOut className="h-5 w-5" /> Log out
          </button>
        </div>
      </aside>

      <div className="min-w-0 flex-1 pb-20 md:pb-0">
        {/* Top bar */}
                <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
          <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
            <div className="md:hidden">{logo}</div>
            <div className="hidden max-w-xl flex-1 md:block">{searchBox(false)}</div>

            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={() => setSearchOpen(true)}
                className="rounded-full p-2 text-slate-600 hover:bg-slate-100 md:hidden"
                aria-label="Search"
              >
                <Search className="h-5 w-5" />
              </button>
              {isArtisan && (
                <button
                  onClick={() => go(newOrders > 0 ? 'orders' : 'customers')}
                  className="relative rounded-full p-2 text-slate-600 hover:bg-slate-100"
                  aria-label="Notifications"
                >
                  <Bell className="h-5 w-5" />
                  {alerts > 0 && (
                    <span className="absolute right-0.5 top-0 rounded-full bg-red-500 px-1.5 text-[10px] font-semibold text-white">
                      {alerts}
                    </span>
                  )}
                </button>
              )}
              <div className="relative">
                <button onClick={() => setMenuOpen((o) => !o)} className="flex items-center gap-1.5 rounded-full p-1 hover:bg-slate-100">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-sm font-semibold text-white">
                    {initials}
                  </span>
                  <ChevronDown className="h-4 w-4 text-slate-500" />
                </button>
                {menuOpen && (
                  <>
                    <button className="fixed inset-0 z-40 cursor-default" onClick={() => setMenuOpen(false)} aria-label="Close menu" />
                    <div className="absolute right-0 z-50 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
                      <div className="border-b border-slate-100 px-3 pb-2 pt-1">
                        <p className="truncate text-sm font-semibold">{name}</p>
                        <p className="text-xs text-slate-500">{isArtisan ? 'Business owner' : 'Customer'}</p>
                      </div>
                      <button onClick={() => go('settings')} className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-slate-50">
                        <Settings className="h-4 w-4" /> Settings
                      </button>
                      <button onClick={logout} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-slate-50">
                        <LogOut className="h-4 w-4" /> Log out
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {searchOpen && (
            <div className="absolute inset-x-0 top-0 z-10 flex items-center gap-2 bg-white px-4 py-3 md:hidden">
              <div className="flex-1">{searchBox(true)}</div>
              <button
                onClick={() => {
                  setSearchOpen(false);
                  setQuery('');
                }}
                className="rounded-full p-2 text-slate-600 hover:bg-slate-100"
                aria-label="Close search"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          )}
        </header>
        
        <main className="min-w-0 p-4 sm:p-8">
          <div className="mx-auto max-w-6xl">
            <div className={show('home')}>
              <DashboardOverview key={homeKey} user={user} isArtisan={isArtisan} onNavigate={setTab} />
            </div>

            {isArtisan && mount('orders') && (
              <div className={`mx-auto max-w-3xl ${show('orders')}`}>
                <OrdersPanel user={user} active={tab === 'orders'} />
              </div>
            )}
            {isArtisan && mount('website') && (
              <div className={`mx-auto max-w-3xl ${show('website')}`}>
                                <BusinessForm key={formKey} user={user} />
              </div>
            )}
            {isArtisan && mount('products') && (
              <div className={`mx-auto max-w-3xl ${show('products')}`}>
                <ProductsPanel user={user} />
              </div>
            )}
            {isArtisan && mount('customers') && (
              <div className={`mx-auto max-w-3xl ${show('customers')}`}>
                <CustomersPanel user={user} />
              </div>
            )}
            {isArtisan && mount('discounts') && (
              <div className={`mx-auto max-w-3xl ${show('discounts')}`}>
                <DiscountsPanel user={user} />
              </div>
            )}

                        {isArtisan && mount('templates') && (
              <div className={`mx-auto max-w-5xl ${show('templates')}`}>
                <TemplatesPanel user={user} onChanged={() => setFormKey((k) => k + 1)} />
              </div>
            )}
            
            {isArtisan && mount('analytics') && (
              <div className={show('analytics')}>
                <AnalyticsPanel user={user} active={tab === 'analytics'} onNavigate={setTab} />
              </div>
            )}

            {isArtisan && mount('channels') && (
              <div className={`mx-auto max-w-3xl ${show('channels')}`}>
                <ChannelsPanel user={user} channel={channel} onSelect={setChannel} />
              </div>
            )}

            {tab === 'settings' && (
              <div className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h1 className="font-display text-2xl font-bold text-slate-900">Settings</h1>
                <dl className="mt-6 space-y-4 text-sm">
                  <div className="flex justify-between gap-4 border-b border-slate-100 pb-3">
                    <dt className="text-slate-500">Name</dt>
                    <dd className="font-medium">{meta.full_name || '-'}</dd>
                  </div>
                  <div className="flex justify-between gap-4 border-b border-slate-100 pb-3">
                    <dt className="text-slate-500">Email</dt>
                    <dd className="break-all font-medium">{user.email}</dd>
                  </div>
                  <div className="flex justify-between gap-4 border-b border-slate-100 pb-3">
                    <dt className="text-slate-500">Phone</dt>
                    <dd className="font-medium">{meta.phone || '-'}</dd>
                  </div>
                  <div className="flex justify-between gap-4 border-b border-slate-100 pb-3">
                    <dt className="text-slate-500">Account type</dt>
                    <dd className="font-medium">{isArtisan ? `Business owner${meta.trade ? ` · ${meta.trade}` : ''}` : 'Customer'}</dd>
                  </div>
                </dl>
                <button
                  onClick={logout}
                  className="mt-6 rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  Log out
                </button>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Phone bottom tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-slate-200 bg-white md:hidden">
        {tabBtn('home', 'Home', Home)}
        {isArtisan && tabBtn('orders', 'Orders', ShoppingBag, newOrders)}
        {isArtisan && tabBtn('website', 'Website', Globe)}
        {isArtisan && tabBtn('products', 'Products', Package)}
        <button
          onClick={() => setMoreOpen(true)}
          className="flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium text-slate-500"
        >
          <MoreHorizontal className="h-5 w-5" />
          More
        </button>
      </nav>

      {/* Phone "More" sheet */}
      {moreOpen && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/40 md:hidden" onClick={() => setMoreOpen(false)}>
          <div
            className="max-h-[80vh] w-full overflow-y-auto rounded-t-3xl bg-white p-4 pb-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between px-2">
              <p className="font-display text-lg font-bold">More</p>
              <button onClick={() => setMoreOpen(false)} className="rounded-lg p-2 hover:bg-slate-100" aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-1">
              {items.filter((i) => !['home', 'orders', 'website', 'products'].includes(i.id)).map(navItem)}
            </div>
            {isArtisan && (
              <>
                <p className="px-3 pb-2 pt-4 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Sales channels
                </p>
                <div className="space-y-1">
                  {channels.map(({ id, label, icon: Icon }) => (
                    <button
                      key={id}
                      onClick={() => openChannel(id)}
                      className={`${row} ${tone(tab === 'channels' && channel === id)}`}
                    >
                      <Icon className="h-5 w-5" /> {label}
                    </button>
                  ))}
                </div>
              </>
            )}
            <div className="mt-4 space-y-1 border-t border-slate-100 pt-4">
              <button onClick={() => go('settings')} className={`${row} ${tone(tab === 'settings')}`}>
                <Settings className="h-5 w-5" /> Settings
              </button>
              <button onClick={logout} className={`${row} text-slate-600 hover:bg-slate-100`}>
                <LogOut className="h-5 w-5" /> Log out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}