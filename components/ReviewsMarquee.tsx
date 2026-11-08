type Review = {
  name: string;
  business: string;
  location: string;
  review: string;
  initials: string;
};

const reviews: Review[] = [
  {
    name: "Emeka Okafor",
    business: "Emeka Electrical Services",
    location: "Port Harcourt",
    review: "Xenon made it easy for my customers to find my electrical services online. I now have a professional website without knowing how to code.",
    initials: "EO",
  },
  {
    name: "Ada Johnson",
    business: "Ada Fashion House",
    location: "Lagos",
    review: "The website looks beautiful and professional. I love how easy it is to update my services and show customers what my business offers.",
    initials: "AJ",
  },
  {
    name: "Tunde Bamidele",
    business: "Tunde Cleaning Services",
    location: "Abuja",
    review: "I wanted something that would make my business look more established. Xenon delivered exactly that.",
    initials: "TB",
  },
  {
    name: "Chiamaka Eze",
    business: "Chiamaka Interiors",
    location: "Enugu",
    review: "I was impressed by the different templates. I could choose a design that actually represents my business.",
    initials: "CE",
  },
  {
    name: "Ibrahim Musa",
    business: "Musa Plumbing Solutions",
    location: "Kano",
    review: "Having my own website makes it easier to show people my work. I can simply share my website link.",
    initials: "IM",
  },
  {
    name: "Chinedu Williams",
    business: "CW Construction",
    location: "Port Harcourt",
    review: "The design is clean, mobile-friendly and professional. I especially like how everything works properly on phones.",
    initials: "CW",
  },
];

function ReviewCard({ review }: { review: Review }) {
  return (
    <article className="w-[285px] shrink-0 rounded-2xl border border-white/10 bg-[#0a1230] p-5 shadow-[0_0_30px_-12px_rgba(59,130,246,0.5)] sm:w-[330px]">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-500/20 font-bold text-blue-300">
          {review.initials}
        </div>

        <div className="min-w-0">
          <h3 className="truncate text-sm font-bold text-white">{review.name}</h3>
          <p className="truncate text-xs text-slate-400">{review.business}</p>
        </div>
      </div>

      <div className="mt-4 text-sm tracking-wider text-amber-400">★★★★★</div>

      <p className="mt-3 min-h-[100px] text-sm leading-6 text-slate-300">&ldquo;{review.review}&rdquo;</p>

      <div className="mt-4 border-t border-white/10 pt-3">
        <span className="text-xs font-medium text-slate-400">{review.location}</span>
      </div>
    </article>
  );
}

export default function ReviewsMarquee() {
  return (
    <div className="w-full min-w-0 overflow-hidden [-webkit-mask-image:linear-gradient(to_right,transparent,black_6%,black_94%,transparent)] [mask-image:linear-gradient(to_right,transparent,black_6%,black_94%,transparent)]">
      <div className="reviews-track flex w-max gap-0">
        {[0, 1].map((group) => (
          <div key={group} className="flex shrink-0 gap-4 pr-4" aria-hidden={group === 1}>
            {reviews.map((review, index) => (
              <ReviewCard key={`${group}-${index}`} review={review} />
            ))}
          </div>
        ))}
      </div>

      <style>{`
        .reviews-track {
          animation: xenon-scroll 42s linear infinite !important;
          animation-play-state: running !important;
          will-change: transform;
          touch-action: pan-y;
        }

        @keyframes xenon-scroll {
          from {
            transform: translateX(0);
          }
          to {
            transform: translateX(-50%);
          }
        }
      `}</style>
    </div>
  );
}