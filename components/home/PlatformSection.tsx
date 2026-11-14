import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, BarChart3, CalendarCheck, LifeBuoy, Rocket } from 'lucide-react';

const items = [
  { icon: BarChart3, title: 'Powerful Analytics', text: 'Track your growth in real-time.' },
  { icon: CalendarCheck, title: 'Manage Orders', text: 'Handle orders with ease.' },
  { icon: Rocket, title: 'Grow Your Business', text: 'Turn visitors into customers.' },
  { icon: LifeBuoy, title: 'Get Expert Support', text: "We're here to help when you need it." },
];

export default function PlatformSection() {
  return (
    <section id="platform" className="mx-auto max-w-7xl scroll-mt-24 px-5 py-10 sm:py-14">
      <div className="relative overflow-hidden rounded-3xl border border-blue-500/40 bg-gradient-to-br from-[#06123a] via-[#0a1a55] to-[#050b24] p-6 shadow-[0_0_80px_-20px_rgba(37,99,235,0.6)] sm:p-10">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_55%_50%,rgba(37,99,235,0.35),transparent_60%)]" />

        <div className="relative grid items-center gap-10 lg:grid-cols-[1fr_1.25fr_0.85fr]">
          {/* Text */}
          <div>
            <span className="inline-flex items-center rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white">
              More Than a Website Builder
            </span>
            <h2 className="font-display mt-4 text-3xl font-bold leading-tight sm:text-4xl">
              Your Complete Business Platform
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-slate-300 sm:text-base">
              Get more than just a website. Manage your business, track growth, and turn visitors into loyal customers —
              all in one powerful platform.
            </p>
            <Link
              href="/signup"
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/30 hover:bg-blue-500"
            >
              Explore Dashboard <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {/* Dashboard on a laptop */}
          <div className="mx-auto w-full max-w-[560px] [perspective:1400px]">
            <div className="origin-center transition-transform duration-500 lg:[transform:rotateY(-14deg)_rotateX(4deg)] lg:hover:[transform:rotateY(-6deg)_rotateX(2deg)]">
              <div className="overflow-hidden rounded-2xl border-[5px] border-slate-800 bg-slate-900 shadow-[0_30px_80px_-20px_rgba(37,99,235,0.8)]">
                <Image
                  src="/home/dashboard-preview.png"
                  alt="The Xenon dashboard"
                  width={1774}
                  height={887}
                  sizes="(min-width: 1024px) 560px, 90vw"
                  className="h-auto w-full"
                />
              </div>
              <div className="mx-auto h-3 w-[108%] -translate-x-[3.7%] rounded-b-2xl bg-gradient-to-b from-slate-600 to-slate-900" />
            </div>
          </div>

          {/* Features */}
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-1">
            {items.map((i) => (
              <li key={i.title} className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600/25 text-blue-400">
                  <i.icon className="h-5 w-5" />
                </span>
                <div className="leading-tight">
                  <p className="text-sm font-semibold">{i.title}</p>
                  <p className="mt-1 text-xs text-slate-400">{i.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}