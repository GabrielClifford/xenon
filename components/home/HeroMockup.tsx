import Image from 'next/image';
import { Search, ShoppingCart } from 'lucide-react';

const tiles = ['/home/headphones.png', '/home/watch.png', '/home/jacket.png', '/home/jordan.png'];

export default function HeroMockup() {
  return (
    <div className="relative mx-auto w-full max-w-[580px] pb-8">
      {/* laptop */}
      <div className="rounded-t-2xl border-[6px] border-slate-800 bg-slate-900 shadow-[0_30px_90px_-20px_rgba(37,99,235,0.7)]">
        <div className="overflow-hidden rounded-md bg-white">
          <div className="flex items-center justify-between px-4 py-2 text-[10px] text-slate-800">
            <span className="font-bold">YourStore</span>
            <span className="hidden gap-4 text-slate-500 sm:flex">
              <span>Shop</span>
              <span>About</span>
              <span>Contact</span>
            </span>
            <span className="flex gap-2 text-slate-700">
              <Search className="h-3 w-3" />
              <ShoppingCart className="h-3 w-3" />
            </span>
          </div>
          <div className="relative aspect-[2/1] bg-[#0b2a8a]">
            <Image
              src="/home/hero-shoe.jpg"
              alt="Blue sneaker"
              fill
              priority
              sizes="(min-width: 1024px) 560px, 100vw"
              className="object-cover object-right"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#061a5c]/90 via-[#061a5c]/30 to-transparent" />
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white sm:left-6">
              <p className="font-display text-base font-bold leading-tight sm:text-2xl">
                Premium
                <br />
                Style. Better
                <br />
                You.
              </p>
              <p className="mt-1 hidden text-[10px] text-blue-100 sm:block">Discover top-quality products for a better you.</p>
              <span className="mt-2 inline-block rounded bg-white px-3 py-1 text-[9px] font-semibold text-slate-900 sm:text-[10px]">
                Shop Now →
              </span>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2 bg-slate-100 p-3">
            {tiles.map((src) => (
              <div key={src} className="relative aspect-square overflow-hidden rounded-lg bg-white">
                <Image src={src} alt="" fill sizes="120px" className="object-contain p-1.5" />
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="mx-auto h-3 w-[108%] -translate-x-[3.7%] rounded-b-2xl bg-gradient-to-b from-slate-600 to-slate-900" />

      {/* phone */}
      <div className="absolute -bottom-2 right-0 w-[27%] rounded-[1.4rem] border-[5px] border-slate-800 bg-slate-900 shadow-2xl sm:-right-3">
        <div className="overflow-hidden rounded-[1rem] bg-white">
          <div className="flex items-center justify-between px-2 py-1.5 text-[7px] font-bold text-slate-800">
            YourStore <span>≡</span>
          </div>
          <div className="relative aspect-[4/3] bg-[#0b2a8a]">
            <Image src="/home/hero-shoe.jpg" alt="" fill sizes="150px" className="object-cover object-right" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#061a5c]/85 to-transparent" />
            <p className="absolute left-2 top-1/2 -translate-y-1/2 text-[8px] font-bold leading-tight text-white">
              Premium
              <br />
              Style. Better
              <br />
              You.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-1 bg-slate-100 p-1.5">
            {['/home/jacket.png', '/home/jordan.png'].map((src) => (
              <div key={src} className="relative aspect-square overflow-hidden rounded bg-white">
                <Image src={src} alt="" fill sizes="60px" className="object-contain p-0.5" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}