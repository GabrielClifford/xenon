export const DEFAULT_LANGUAGE = 'en';
export const MAX_LANGUAGES = 20; // including the default language

export type Language = { code: string; name: string; native: string };

export const LANGUAGES: Language[] = [
  { code: 'en', name: 'English', native: 'English' },
  { code: 'yo', name: 'Yoruba', native: 'Yorùbá' },
  { code: 'ig', name: 'Igbo', native: 'Igbo' },
  { code: 'ha', name: 'Hausa', native: 'Hausa' },
  { code: 'pcm', name: 'Nigerian Pidgin', native: 'Naijá' },
  { code: 'fr', name: 'French', native: 'Français' },
  { code: 'es', name: 'Spanish', native: 'Español' },
  { code: 'pt', name: 'Portuguese', native: 'Português' },
  { code: 'de', name: 'German', native: 'Deutsch' },
  { code: 'it', name: 'Italian', native: 'Italiano' },
  { code: 'nl', name: 'Dutch', native: 'Nederlands' },
  { code: 'ar', name: 'Arabic', native: 'العربية' },
  { code: 'sw', name: 'Swahili', native: 'Kiswahili' },
  { code: 'zu', name: 'Zulu', native: 'isiZulu' },
  { code: 'af', name: 'Afrikaans', native: 'Afrikaans' },
  { code: 'am', name: 'Amharic', native: 'አማርኛ' },
  { code: 'tw', name: 'Twi', native: 'Twi' },
  { code: 'zh', name: 'Chinese', native: '中文' },
  { code: 'ja', name: 'Japanese', native: '日本語' },
  { code: 'ko', name: 'Korean', native: '한국어' },
  { code: 'hi', name: 'Hindi', native: 'हिन्दी' },
  { code: 'ur', name: 'Urdu', native: 'اردو' },
  { code: 'bn', name: 'Bengali', native: 'বাংলা' },
  { code: 'ru', name: 'Russian', native: 'Русский' },
  { code: 'tr', name: 'Turkish', native: 'Türkçe' },
  { code: 'pl', name: 'Polish', native: 'Polski' },
  { code: 'sv', name: 'Swedish', native: 'Svenska' },
  { code: 'id', name: 'Indonesian', native: 'Bahasa Indonesia' },
  { code: 'th', name: 'Thai', native: 'ไทย' },
  { code: 'vi', name: 'Vietnamese', native: 'Tiếng Việt' },
];

export type StoreLanguage = { code: string; published: boolean };

export const langName = (code: string) => LANGUAGES.find((l) => l.code === code)?.name ?? code;

// reads what is saved in businesses.languages_options (English is always there, so it is not stored)
export function readLanguages(raw: unknown): StoreLanguage[] {
  const list = (raw as { languages?: unknown } | null)?.languages;
  if (!Array.isArray(list)) return [];
  const seen = new Set<string>([DEFAULT_LANGUAGE]);
  const out: StoreLanguage[] = [];
  for (const x of list) {
    const r = (x ?? {}) as Record<string, unknown>;
    const code = typeof r.code === 'string' ? r.code : '';
    if (!code || seen.has(code) || !LANGUAGES.some((l) => l.code === code)) continue;
    seen.add(code);
    out.push({ code, published: r.published === true });
  }
  return out.slice(0, MAX_LANGUAGES - 1);
}
