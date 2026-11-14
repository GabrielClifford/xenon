import Link from 'next/link';
import { ArrowRight, BarChart3, Cloud, Headphones, ShieldCheck, Zap } from 'lucide-react';

const items = [
  { icon: Zap, title: 'Easy Store Builder', text: 'Build without coding.' },
  { icon: BarChart3, title: 'Advanced Analytics', text: 'Know what works.' },
  { icon: ShieldCheck, title: 'Secure by Design', text: 'Shop with confidence.' },
  { icon: Cloud, title: 'Cloud Hosting', text: 'Fast and reliable.' },
  { icon: Headphones, title: 'Friendly Support', text: 'Help when you need it.' },
];

function GrowthLaptop() {
  const bars = [
    { x: 98, h: 24 },
    { x: 126, h: 40 },
    { x: 154, h: 56 },
    { x: 182, h: 76 },
    { x: 210, h: 98 },
  ];
  return (
    <svg
      viewBox="0 0 360 250"
      className="h-auto w-full drop-shadow-[0_0_30px_rgba(59,130,246,0.55)]"
      role="img"
      aria-label="A laptop showing a growing sales chart"
    >
      <defs>
        <linearGradient id="fsBar" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#60a5fa" />
          <stop offset="1" stopColor="#1d4ed8" />
        </linearGradient>
        <linearGradient id="fsBase" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#334155" />
          <stop offset="1" stopColor="#0f172a" />
        </linearGradient>
        <radialGradient id="fsGlow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#3b82f6" stopOpacity="0.55" />
          <stop offset="1" stopColor="#3b82f6" stopOpacity="0" />
        </radialGradient>
      </defs>

      <ellipse cx="180" cy="212" rx="165" ry="30" fill="url(#fsGlow)" />
      <ellipse cx="180" cy="212" rx="150" ry="22" fill="none" stroke="#60a5fa" strokeOpacity="0.7" strokeWidth="2.5" />

      <rect x="72" y="38" width="216" height="140" rx="10" fill="#0b1d5c" stroke="#3b82f6" strokeWidth="3" />
      <rect x="82" y="48" width="196" height="120" rx="6" fill="#06123a" />

      {[80, 108, 136].map((y) => (
        <line key={y} x1="92" x2="268" y1={y} y2={y} stroke="#1e3a8a" strokeWidth="1" />
      ))}
      {bars.map((b) => (
        <rect key={b.x} x={b.x} y={158 - b.h} width="20" height={b.h} rx="3" fill="url(#fsBar)" />
      ))}

      <polyline
        points="96,128 134,106 166,114 214,76 246,54"
        fill="none"
        stroke="#93c5fd"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <polygon points="258,48 248.9,63.3 240.3,49.9" fill="#93c5fd" />

      <path d="M52 180h256l-14 16H66z" fill="url(#fsBase)" />
      <rect x="150" y="182" width="60" height="5" rx="2.5" fill="#0f172a" />
    </svg>
  );
}

export default function FeaturesSection() {
  return (
    <section id="why-xenon" className="mx-auto max-w-7xl scroll-mt-24 px-5 py-10 sm:py-14">
      <div className="relative overflow-hidden rounded-3xl border border-blue-500/40 bg-gradient-to-br from-[#06123a] via-[#0a1a55] to-[#050b24] p-6 shadow-[0_0_80px_-20px_rgba(37,99,235,0.6)] sm:p-10">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_85%_60%,rgba(37,99,235,0.35),transparent_60%)]" />

        <div className="relative grid items-center gap-8 xl:grid-cols-[0.95fr_1.75fr_0.9fr]">
          {/* Text */}
          <div>
            <span className="inline-flex items-center rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white">
              Why Choose Xenon
            </span>
            <h2 className="font-display mt-4 text-3xl font-bold leading-tight sm:text-4xl">
              Powerful Features.
              <br />
              Limitless Possibilities.
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-slate-300">
              Everything you need to build, grow and scale your online business.
            </p>
            <Link
              href="/signup"
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/30 hover:bg-blue-500"
            >
              Get Started <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {/* Feature cards */}
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5 xl:gap-2.5 [&>li:last-child]:col-span-2 sm:[&>li:last-child]:col-span-1">
            {items.map((i) => (
              <li
                key={i.title}
                className="rounded-2xl border border-blue-400/30 bg-gradient-to-b from-white/10 to-white/[0.03] p-4 text-center shadow-[0_0_30px_-12px_rgba(59,130,246,0.7)]"
              >
                <span className="mx-auto flex h-11 w-11 items-center justify-center text-blue-400 drop-shadow-[0_0_10px_rgba(96,165,250,0.8)]">
                  <i.icon className="h-8 w-8" />
                </span>
                <p className="mt-2 text-[13px] font-semibold leading-tight">{i.title}</p>
                <p className="mt-1 text-[11px] leading-snug text-slate-400">{i.text}</p>
              </li>
            ))}
          </ul>

          {/* Laptop */}
          <div className="mx-auto w-full max-w-[300px] xl:max-w-none">
            <GrowthLaptop />
          </div>
        </div>
      </div>
    </section>
  );
}