import type { CookieColors, CookieTexts } from '@/lib/privacy';

export function BannerCard({
  t,
  colors,
  privacyHref,
  flat,
  onAccept,
  onDecline,
  onManage,
}: {
  t: CookieTexts;
  colors: CookieColors;
  privacyHref?: string;
  flat?: boolean;
  onAccept?: () => void;
  onDecline?: () => void;
  onManage?: () => void;
}) {
  return (
    <div
      className={`border p-4 shadow-2xl ${flat ? 'rounded-none border-x-0 border-b-0' : 'rounded-2xl'}`}
      style={{ background: colors.bg, color: colors.text, borderColor: `${colors.text}33` }}
    >
      <div className={flat ? 'mx-auto max-w-5xl' : ''}>
        <p className="text-sm font-semibold">{t.title}</p>
        <p className="mt-1 text-sm opacity-90">
          {t.message}
          {privacyHref && (
            <>
              {' '}
              <a href={privacyHref} className="underline">
                Learn more in our privacy policy.
              </a>
            </>
          )}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onAccept}
            style={{ background: colors.button, color: colors.buttonText }}
            className="rounded-lg px-4 py-2 text-sm font-semibold"
          >
            {t.accept}
          </button>
          <button
            type="button"
            onClick={onDecline}
            style={{ borderColor: colors.text, color: colors.text }}
            className="rounded-lg border px-4 py-2 text-sm font-medium"
          >
            {t.decline}
          </button>
          <button type="button" onClick={onManage} className="px-1 text-sm underline">
            {t.manage}
          </button>
        </div>
      </div>
    </div>
  );
}

function Switch({
  on,
  disabled,
  onChange,
  colors,
}: {
  on: boolean;
  disabled?: boolean;
  onChange?: (v: boolean) => void;
  colors: CookieColors;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={() => onChange?.(!on)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition ${disabled ? 'opacity-60' : ''}`}
      style={{ background: on ? colors.button : `${colors.text}44` }}
    >
      <span
        className="absolute top-0.5 h-5 w-5 rounded-full transition-all"
        style={{ left: on ? '1.375rem' : '0.125rem', background: on ? colors.buttonText : colors.bg }}
      />
    </button>
  );
}

export function PrefsCard({
  t,
  colors,
  analytics,
  onToggle,
  onAcceptAll,
  onDeclineAll,
  onSave,
  onClose,
}: {
  t: CookieTexts;
  colors: CookieColors;
  analytics: boolean;
  onToggle?: (v: boolean) => void;
  onAcceptAll?: () => void;
  onDeclineAll?: () => void;
  onSave?: () => void;
  onClose?: () => void;
}) {
  return (
    <div
      className="rounded-2xl border p-5 shadow-2xl"
      style={{ background: colors.bg, color: colors.text, borderColor: `${colors.text}33` }}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-base font-semibold">{t.prefsTitle}</p>
        {onClose && (
          <button type="button" onClick={onClose} aria-label="Close" className="text-xl leading-none opacity-70">
            ×
          </button>
        )}
      </div>
      <p className="mt-1 text-sm opacity-90">{t.prefsText}</p>

      <div className="mt-4 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold">{t.necessaryTitle}</p>
            <p className="mt-0.5 text-xs opacity-80">{t.necessaryText}</p>
          </div>
          <Switch on disabled colors={colors} />
        </div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold">{t.analyticsTitle}</p>
            <p className="mt-0.5 text-xs opacity-80">{t.analyticsText}</p>
          </div>
          <Switch on={analytics} onChange={onToggle} colors={colors} />
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onAcceptAll}
          style={{ background: colors.button, color: colors.buttonText }}
          className="rounded-lg px-4 py-2 text-sm font-semibold"
        >
          {t.acceptAll}
        </button>
        <button
          type="button"
          onClick={onDeclineAll}
          style={{ borderColor: colors.text, color: colors.text }}
          className="rounded-lg border px-4 py-2 text-sm font-medium"
        >
          {t.declineAll}
        </button>
        <button
          type="button"
          onClick={onSave}
          style={{ borderColor: colors.text, color: colors.text }}
          className="rounded-lg border px-4 py-2 text-sm font-medium"
        >
          {t.save}
        </button>
      </div>
    </div>
  );
}