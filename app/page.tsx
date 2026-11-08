import Link from 'next/link';
import {
  ArrowRight, BarChart3, Check, ChevronRight, Headphones, Rocket, ShieldCheck, ShoppingBag, Wallet, Zap,
} from 'lucide-react';
import HomeNav, { Logo } from '@/components/home/HomeNav';
import HeroMockup from '@/components/home/HeroMockup';
import MobileHeroPhone from '@/components/home/MobileHeroPhone';
import TemplatesCarousel from '@/components/home/TemplatesCarousel';
import Faq from '@/components/home/Faq';
import PricingPlans from '@/components/PricingPlans';
import ReviewsMarquee from '@/components/ReviewsMarquee';

export const metadata = {
  title: 'Xenon | Build Your Online Store',
  description:
    'Create a beautiful online store in minutes. No coding needed. Add products, take orders and grow your business with Xenon.',
};

const perks = [
  { icon: Rocket, title: 'Lightning Fast', text: 'Performance' },
  { icon: ShieldCheck, title: 'Secure & Reliable', text: 'Orders and data' },
  { icon: Wallet, title: 'Flexible Payments', text: 'Pay on delivery & transfer' },
  { icon: Headphones, title: 'Friendly Support', text: 'Help when you need it' },
  { icon: BarChart3, title: 'Powerful Analytics', text: 'Know what sells' },
];

const pill =
  'inline-flex items-center rounded-full border border-blue-500/40 bg-blue-500/10 px-2.5 py-1 text-[10px] font-medium text-blue-200 sm:px-3 sm:text-xs';

export default function HomePage() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-[#030816] text-white">
      <HomeNav />

      {/* Hero */}
      <section className="relative">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_75%_15%,rgba(37,99,235,0.35),transparent_60%)]" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-5 pb-10 pt-6 sm:pb-14 sm:pt-12 lg:grid-cols-[1fr_1.05fr] lg:pt-20">
          <MobileHeroPhone />

          <div className="relative z-10">
            <div className="pr-[35%] sm:pr-0">
              <span className={pill}>
                <Zap className="mr-1.5 h-3 w-3 text-blue-400" />
                The Ecommerce Website Builder
                <ChevronRight className="ml-1 h-3 w-3 sm:hidden" />
              </span>
              <h1 className="font-display mt-4 text-[clamp(1.25rem,5.9vw,1.9rem)] font-extrabold leading-[1.1] sm:mt-5 sm:text-5xl lg:text-6xl">
                Build Your Dream Online Store with{' '}
                <span className="block text-[1.4em] leading-none text-blue-500 sm:inline sm:text-[1em]">Xenon</span>
              </h1>
              <p className="mt-3 text-[12px] leading-relaxed text-slate-300 sm:mt-5 sm:max-w-lg sm:text-lg">
                Create a beautiful online store in minutes. No coding. No hassle. Just sell.
              </p>
            </div>

            <div className="mt-5 flex gap-2.5 sm:mt-8 sm:gap-3">
              <Link
                href="/signup"
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-3 text-[13px] font-semibold text-white shadow-lg shadow-blue-600/30 hover:bg-blue-500 sm:gap-2 sm:px-6 sm:py-3.5 sm:text-sm"
              >
                Get Started <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </Link>
              <a
                href="#templates"
                className="inline-flex items-center rounded-xl border border-blue-400/40 px-4 py-3 text-[13px] font-semibold text-white hover:bg-white/10 sm:px-6 sm:py-3.5 sm:text-sm"
              >
                View Templates
              </a>
            </div>
            <ul className="mt-5 flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-slate-300 sm:mt-7 sm:gap-x-6 sm:gap-y-2 sm:text-sm">
              {['Set up in minutes', 'No coding needed', 'Take orders from day one'].map((t) => (
                <li key={t} className="flex items-center gap-1.5 sm:gap-2">
                  <Check className="h-3.5 w-3.5 text-blue-400 sm:h-4 sm:w-4" /> {t}
                </li>
              ))}
            </ul>
          </div>

          <div className="hidden sm:block">
            <HeroMockup />
          </div>
        </div>

        <div id="features" className="relative mx-auto max-w-7xl scroll-mt-24 px-5 pb-10 sm:pb-14">
          <div className="grid grid-cols-4 divide-x divide-white/10 rounded-2xl border border-white/10 bg-white/[0.04] py-4 md:grid-cols-5 md:gap-5 md:divide-x-0 md:p-5">
            {perks.map((p, i) => (
              <div
                key={p.title}
                className={`flex flex-col items-center gap-1.5 px-1 text-center md:flex-row md:gap-3 md:px-0 md:text-left ${
                  i === 4 ? 'hidden md:flex' : ''
                }`}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600/20 text-blue-400 md:h-11 md:w-11">
                  <p.icon className="h-5 w-5 md:h-6 md:w-6" />
                </span>
                <div className="leading-tight">
                  <p className="text-[10.5px] font-semibold md:text-sm">{p.title}</p>
                  <p className="text-[9.5px] text-slate-400 md:text-xs">{p.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Templates */}
      <section id="templates" className="mx-auto max-w-7xl scroll-mt-24 px-5 py-10 sm:py-14">
        <div className="grid grid-cols-[42%_1fr] items-center gap-5 sm:grid-cols-1 sm:gap-10 lg:grid-cols-[300px_1fr]">
          <div>
            <span className={pill}>Stunning Templates</span>
            <h2 className="font-display mt-3 text-[17px] font-bold leading-tight sm:mt-4 sm:text-3xl lg:text-4xl">
              Beautiful Designs for Every Store
            </h2>
            <p className="mt-2 text-[11px] leading-snug text-slate-300 sm:mt-4 sm:text-sm">
              Choose a professionally designed template and make it match your brand. You can switch any time without losing your products.
            </p>
            <Link
              href="/signup"
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-white px-3.5 py-2 text-[11px] font-semibold text-slate-900 hover:bg-blue-50 sm:mt-6 sm:gap-2 sm:px-5 sm:py-3 sm:text-sm"
            >
              Start Building <ArrowRight className="h-3 w-3 sm:h-4 sm:w-4" />
            </Link>
          </div>
          <TemplatesCarousel />
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="relative scroll-mt-24 py-10 sm:py-14">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(37,99,235,0.28),transparent_65%)]" />
        <div className="relative mx-auto max-w-7xl px-5">
          <PricingPlans />
        </div>
      </section>

      {/* Reviews */}
      <section id="reviews" className="mx-auto max-w-7xl scroll-mt-24 px-5 py-10 sm:py-14">
        <div className="grid items-center gap-6 sm:gap-8 lg:grid-cols-[300px_1fr]">
          <div>
            <span className={pill}>Real People. Real Results.</span>
            <h2 className="font-display mt-3 text-2xl font-bold sm:mt-4 sm:text-4xl">What Our Users Say</h2>
            <p className="mt-2 text-xs text-slate-300 sm:mt-3 sm:text-sm">
              Hear from business owners who built their websites with Xenon.
            </p>
          </div>
          <div className="min-w-0">
            <ReviewsMarquee />
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="mx-auto max-w-7xl scroll-mt-24 px-5 py-10 sm:py-14">
        <div className="grid gap-6 sm:gap-10 lg:grid-cols-[320px_1fr]">
          <div>
            <span className={pill}>FAQs</span>
            <h2 className="font-display mt-3 text-2xl font-bold sm:mt-4 sm:text-4xl">Frequently Asked Questions</h2>
            <p className="mt-2 text-xs text-slate-300 sm:mt-3 sm:text-sm">Find answers to common questions about Xenon.</p>
          </div>
          <Faq />
        </div>
      </section>

      {/* Final call to action */}
      <section className="mx-auto max-w-7xl px-5 pb-10 sm:pb-14">
        <div className="flex flex-col items-start gap-5 rounded-3xl border border-blue-400/30 bg-gradient-to-br from-[#0a1a4d] to-[#0a1230] p-6 sm:flex-row sm:items-center sm:gap-6 sm:p-8">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/40 sm:h-16 sm:w-16">
            <ShoppingBag className="h-7 w-7 sm:h-8 sm:w-8" />
          </span>
          <div className="flex-1">
            <h2 className="font-display text-xl font-bold sm:text-2xl">Ready to start your online store?</h2>
            <p className="mt-1 text-sm text-slate-300">Create your store today and get your first order this week.</p>
          </div>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3.5 text-sm font-semibold text-white hover:bg-blue-500"
          >
            Get Started <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-8 px-5 py-10 sm:py-12 md:grid-cols-[1.4fr_1fr_1fr] md:gap-10">
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2">
              <Logo />
              <span className="font-display text-xl font-bold">Xenon</span>
            </Link>
            <p className="mt-1 text-xs text-slate-400">Build. Sell. Grow.</p>
            <p className="mt-4 max-w-xs text-sm text-slate-300">The ecommerce website builder for modern entrepreneurs.</p>
          </div>
          <div>
            <p className="text-sm font-semibold">Product</p>
            <ul className="mt-3 space-y-2 text-sm text-slate-300">
              <li><a href="#templates" className="hover:text-white">Templates</a></li>
              <li><a href="#features" className="hover:text-white">Features</a></li>
              <li><a href="#pricing" className="hover:text-white">Pricing</a></li>
              <li><a href="#faq" className="hover:text-white">FAQs</a></li>
            </ul>
          </div>
          <div>
            <p className="text-sm font-semibold">Get started</p>
            <ul className="mt-3 space-y-2 text-sm text-slate-300">
              <li><Link href="/signup" className="hover:text-white">Create your store</Link></li>
              <li><Link href="/login" className="hover:text-white">Sign in</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-white/10 px-5 py-5 text-center text-xs text-slate-400">© 2026 Xenon. All rights reserved.</div>
      </footer>
    </main>
  );
}