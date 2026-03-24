import zhTW from './zh-TW.json';
import en from './en.json';
import ja from './ja.json';

const translations: Record<string, Record<string, string>> = {
  'zh-TW': zhTW,
  'en': en,
  'ja': ja,
};

export function getLocale(url: URL): string {
  const [, locale] = url.pathname.split('/');
  if (locale === 'en' || locale === 'ja') return locale;
  return 'zh-TW';
}

export function t(locale: string, key: string): string {
  return translations[locale]?.[key] || translations['zh-TW']?.[key] || key;
}

export function localePath(locale: string, path: string): string {
  if (locale === 'zh-TW') return path;
  return `/${locale}${path}`;
}

export const locales = ['zh-TW', 'en', 'ja'] as const;
export type Locale = typeof locales[number];
