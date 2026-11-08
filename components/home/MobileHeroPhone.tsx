import Image from 'next/image';
import { Search, ShoppingCart } from 'lucide-react';

const tiles = [
  '/home/headphones.png',
  '/home/watch.png',
  '/home/jacket.png',
  '/home/jordan.png',
  '/home/shirt.png',
  '/home/tshirt.png',
];

export default function MobileHeroPhone() {
  return (
    <div className="pointer-events-none absolute right-3 top-6 z-0 w-[33%] rotate-[9deg] sm:hidden">
      <div className="rounded-[1.4rem] border-[4px] border-slate-700 bg-slate-900 shadow-[0_20px_50px_-10px_rgba(37,99,235,0.8)]">
        <div className="overflow-hidden rounded-[1.1rem] bg-white">
          <div className="flex items-center justify-between px-2 py-1.5 text-[7px] font-bold text-slate-800">
            <span>YourStore</span>
            <span className="flex gap-1">
              <Search className="h-2 w-2" />
              <ShoppingCart className="h-2 w-2" />
            </span>
          </div>
          <div className="relative aspect-[5/4] bg-[#0b2a8a]">
            <Image src="/home/hero-shoe.jpg" alt="" fill sizes="140px" className="object-cover object-right" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#061a5c]/90 via-[#061a5c]/30 to-transparent" />
            <div className="absolute left-1.5 top-1/2 -translate-y-1/2 text-white">
              <p className="text-[7px] font-bold leading-tight">
                Premium
                <br />
                Style. Better
                <br />
                You.
              </p>
              <span className="mt-1 inline-block rounded bg-white px-1.5 py-0.5 text-[5px] font-semibold text-slate-900">
                Shop Now →
              </span>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1.5">
            {tiles.map((src) => (
              <div key={src} className="relative aspect-square overflow-hidden rounded bg-white">
                <Image src={src} alt="" fill sizes="40px" className="object-contain p-0.5" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}