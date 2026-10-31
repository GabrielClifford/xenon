'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { User } from '@supabase/supabase-js';
import { BarChart3, Globe, Home, LogOut, Settings, Users, Zap } from 'lucide-react';
import BusinessForm from '@/components/BusinessForm';
import ChannelsPanel from '@/components/ChannelsPanel';
import CustomersPanel from '@/components/CustomersPanel';
import DashboardOverview, { type Tab } from '@/components/DashboardOverview';
import { channels, type ChannelId } from '@/lib/channels';
import { createClient } from '@/lib/supabase/client';

type Meta = { full_name?: string; phone?: string; role?: string; trade?: string };
type Item = { id: Tab | 'analytics'; label: string; icon: React.ElementType; soon?: boolean; artisanOnly?: boolean };

const mainItems: Item[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'website', label: 'My website', icon: Globe, artisanOnly: true },
  { id: 'customers', label: 'Customers', icon: Users, artisanOnly: true },
  { id: 'analytics', label: 'Analytics', icon: BarChart3, soon: true, artisanOnly: true },
];

const rowClass = (vertical: boolean) =>
  `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
    vertical ? 'w-full' : 'shrink-0 whitespace-nowrap'
  }`;

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [tab, setTab] = useState<Tab>('home');
  const [channel, setChannel] = useState<ChannelId>('website');

  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data }) => {
        if (!data.user) router.replace('/login');
        else setUser(data.user);
      });
  }, [router]);

  async function logout() {
    await createClient().auth.signOut();
    router.push('/');
    router.refresh();
  }

  function openChannel(id: ChannelId) {
    setChannel(id);
    setTab('channels');
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 text-sm text-slate-400">
        Loading your account...
      </div>
    );
  }

  const meta = (user.user_metadata ?? {}) as Meta;
  const isArtisan = meta.role === 'artisan';
  const name = meta.full_name || user.email || 'Account';
  const initials = name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  const items = mainItems.filter((i) => isArtisan || !i.artisanOnly);

  const tone = (active: boolean) => (active ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-50');

  function mainNav(vertical: boolean) {
    return items.map(({ id, label, icon: Icon, soon }) => {
      if (soon) {
        return (
          <span key={id} className={`${rowClass(vertical)} cursor-not-allowed text-slate-400`}>
            <Icon className="h-5 w-5" /> {label}
            <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
              Soon
            </span>
          </span>
        );
      }
      return (
        <button key={id} onClick={() => setTab(id as Tab)} className={`${rowClass(vertical)} ${tone(tab === id)}`}>
          <Icon className="h-5 w-5" /> {label}
        </button>
      );
    });
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="sticky top-0 z-40 flex items-center justify-between bg-slate-950 px-4 py-3 text-white sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white">
            <Zap className="h-4 w-4" />
          </span>
          <span className="font-display text-lg font-bold">
            Xe<span className="text-blue-400">Non</span>
          </span>
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/" className="hidden text-sm text-slate-300 hover:text-white sm:block">
            View site
          </Link>
          <div className="hidden text-right leading-tight sm:block">
            <p className="text-sm font-medium">{name}</p>
            <p className="text-xs text-slate-400">{isArtisan ? 'Business owner' : 'Customer'}</p>
          </div>
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-sm font-semibold">
            {initials}
          </span>
        </div>
      </header>

      <div className="md:flex">
        {/* Desktop sidebar */}
        <aside className="hidden min-h-[calc(100vh-56px)] w-60 shrink-0 flex-col border-r border-slate-200 bg-white p-3 md:flex">
          <nav className="space-y-1">{mainNav(true)}</nav>

          {isArtisan && (
            <div className="mt-6">
              <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Sales channels</p>
              <div className="space-y-1">
                {channels.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => openChannel(id)}
                    className={`${rowClass(true)} ${tone(tab === 'channels' && channel === id)}`}
                  >
                    <Icon className="h-5 w-5" /> {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mt-auto space-y-1 pt-6">
            <button onClick={() => setTab('settings')} className={`${rowClass(true)} ${tone(tab === 'settings')}`}>
              <Settings className="h-5 w-5" /> Settings
            </button>
            <button onClick={logout} className={`${rowClass(true)} text-slate-600 hover:bg-slate-50`}>
              <LogOut className="h-5 w-5" /> Log out
            </button>
          </div>
        </aside>

        {/* Phone tabs */}
        <nav className="flex gap-1 overflow-x-auto border-b border-slate-200 bg-white px-3 py-2 md:hidden">
          {mainNav(false)}
          {isArtisan && (
            <button onClick={() => setTab('channels')} className={`${rowClass(false)} ${tone(tab === 'channels')}`}>
              <Globe className="h-5 w-5" /> Channels
            </button>
          )}
          <button onClick={() => setTab('settings')} className={`${rowClass(false)} ${tone(tab === 'settings')}`}>
            <Settings className="h-5 w-5" /> Settings
          </button>
        </nav>

        <main className="min-w-0 flex-1 p-4 sm:p-8">
          <div className="mx-auto max-w-5xl">
            {tab === 'home' && <DashboardOverview user={user} isArtisan={isArtisan} onNavigate={setTab} />}

            {tab === 'website' && isArtisan && (
              <div className="mx-auto max-w-3xl">
                <BusinessForm user={user} />
              </div>
            )}

            {tab === 'customers' && isArtisan && (
              <div className="mx-auto max-w-3xl">
                <CustomersPanel user={user} />
              </div>
            )}

            {tab === 'channels' && isArtisan && (
              <div className="mx-auto max-w-3xl">
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
                    <dd className="font-medium">{isArtisan ? `Artisan${meta.trade ? ` · ${meta.trade}` : ''}` : 'Customer'}</dd>
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
    </div>
  );
}