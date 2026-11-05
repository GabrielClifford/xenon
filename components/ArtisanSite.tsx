'use client';

import { useState } from 'react';
import Link from 'next/link';
import ClassicTheme from '@/components/themes/ClassicTheme';
import BoldTheme from '@/components/themes/BoldTheme';
import SparkTheme from '@/components/themes/SparkTheme';
import SiteProducts, { type SiteProduct } from '@/components/SiteProducts';
import { Provider } from '@/data/providers';
import { SiteSettings, ThemeName, themes } from '@/data/sites';

export default function ArtisanSite({
  p,
  s,
  sample = true,
  products = [],
}: {
  p: Provider;
  s: SiteSettings;
  sample?: boolean;
  products?: SiteProduct[];
}) {
  const [theme, setTheme] = useState<ThemeName>(s.theme);
  const Active = theme === 'bold' ? BoldTheme : theme === 'spark' ? SparkTheme : ClassicTheme;

  return (
    <>
      <Active p={p} s={s} />

      <SiteProducts products={products} />

      <footer className={`bg-slate-900 px-5 py-6 text-center text-xs text-slate-400 ${sample ? 'pb-24' : ''}`}>
        <p>
          {sample ? 'Sample website for demonstration. ' : ''}Made with{' '}
          <Link href="/" className="font-semibold text-blue-400">Xenon</Link>
        </p>
        <Link href="/signup" className="mt-1 inline-block text-blue-400 underline">
          Get your own website
        </Link>
      </footer>

      {sample && (
        <div className="fixed bottom-4 left-1/2 z-50 flex max-w-[calc(100vw-1rem)] -translate-x-1/2 items-center gap-1 rounded-full border border-slate-200 bg-white p-1 text-xs shadow-xl">
          <span className="hidden px-3 font-medium text-slate-500 sm:block">Demo theme</span>
          {themes.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTheme(t.id)}
              className={`rounded-full px-4 py-2 font-semibold transition ${
                theme === t.id ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}
    </>
  );
}