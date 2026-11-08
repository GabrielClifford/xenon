'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, Search, ShoppingCart } from 'lucide-react';

type Card = { name: string; niche: string; hero: string; fit: 'cover' | 'contain'; thumbs: string[] };

const cards: Card[] = [
  {
    name: 'Aura',
    niche: 'Fashion & Apparel',
    hero: '/home/fashion.jpg',
    fit: 'cover',
    thumbs: ['/home/jacket.png', '/home/shirt.png', '/home/tshirt.png'],
  },
  {
    name: 'Nova',
    niche: 'Electronics',
    hero: '/home/headphones.png',
    fit: 'contain',
    thumbs: ['/home/watch.png', '/home/headphones-dark.jpg', '/home/headphones.png'],
  },
  {
    name: 'Luxe',
    niche: 'Beauty & Skincare',
    hero: '/home/skincare.jpg',
    fit: 'cover',
    thumbs: ['/home/lotion-vaseline.png', '/home/lotion-nivea.png', '/home/lotion-dove.png'],
  },
];

export default function TemplatesCarousel() {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  function scrollBy(dir: 1 | -1) {
    const el = ref.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: 'smooth' });
  }

  function onScroll() {
    const el = ref.current;
    if (!el) return;
    const i = Math.round(el.scrollLeft / (el.scrollWidth / cards.length));
    setActive(Math.max(0, Math.min(cards.length - 1, i)));
  }

  return (
    <div className="relative">
      <button
        onClick={() => scrollBy(-1)}
        className="absolute -left-3 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-[#0a1230] text-white hover:bg-blue-600 sm:flex"
        aria-label="Previous"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <button
        onClick={() => scrollBy(1)}
        className="absolute -right-3 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-[#0a1230] text-white hover:bg-blue-600 sm:flex"
        aria-label="Next"
      >
        <ChevronRight className="h-5 w-5" />
      </button>

      <div
        ref={ref}
        onScroll={onScroll}
        className="flex snap-x snap-mandatory gap-5 overflow-x-auto scroll-smooth pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {cards.map((c) => (
          <div
            key={c.name}
            className="min-w-[78%] snap-start rounded-2xl border border-blue-400/30 bg-[#0a1230] p-3 shadow-[0_0_40px_-12px_rgba(59,130,246,0.6)] sm:min-w-[46%] lg:min-w-[calc((100%-2.5rem)/3)]"
          >
            <div className="flex items-center justify-between px-1 pb-2 text-[10px] text-slate-300">
              <span className="font-semibold">{c.name}</span>
              <span className="flex gap-2">
                <Search className="h-3 w-3" />
                <ShoppingCart className="h-3 w-3" />
              </span>
            </div>
            <div className={`relative aspect-[4/3] overflow-hidden rounded-xl ${c.fit === 'contain' ? 'bg-gradient-to-br from-slate-200 to-slate-400' : 'bg-slate-200'}`}>
              <Image
                src={c.hero}
                alt={`${c.name} template preview`}
                fill
                sizes="(min-width: 1024px) 300px, 80vw"
                className={c.fit === 'contain' ? 'object-contain p-4' : 'object-cover'}
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3 text-white">
                <p className="font-display text-lg font-bold leading-none">{c.name}</p>
                <p className="mt-1 text-[11px] text-slate-200">{c.niche}</p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {c.thumbs.map((t, i) => (
                <div key={t + i} className="relative aspect-square overflow-hidden rounded-lg bg-white">
                  <Image src={t} alt="" fill sizes="100px" className="object-contain p-1.5" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 flex justify-center gap-2">
        {cards.map((c, i) => (
          <span key={c.name} className={`h-2 rounded-full transition-all ${i === active ? 'w-5 bg-blue-500' : 'w-2 bg-white/25'}`} />
        ))}
      </div>
    </div>
  );
}