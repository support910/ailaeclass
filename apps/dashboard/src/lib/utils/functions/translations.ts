import { LOCALE } from '$lib/utils/types';
import i18n from '@sveltekit-i18n/base';
import parser from '@sveltekit-i18n/parser-icu';
import { writable } from 'svelte/store';

export const config = {
  parser: parser(),
  initLocale: 'zh-TW',
  loaders: [
    {
      locale: 'en',
      key: '',
      loader: async () => (await import('../translations/en.json')).default
    },
    {
      locale: 'hi',
      key: '',
      loader: async () => (await import('../translations/hi.json')).default
    },
    {
      locale: 'fr',
      key: '',
      loader: async () => (await import('../translations/fr.json')).default
    },
    {
      locale: 'pl',
      key: '',
      loader: async () => (await import('../translations/pl.json')).default
    },
    {
      locale: 'pt',
      key: '',
      loader: async () => (await import('../translations/pt.json')).default
    },
    {
      locale: 'de',
      key: '',
      loader: async () => (await import('../translations/de.json')).default
    },
    {
      locale: 'vi',
      key: '',
      loader: async () => (await import('../translations/vi.json')).default
    },
    {
      locale: 'ru',
      key: '',
      loader: async () => (await import('../translations/ru.json')).default
    },
    {
      locale: 'es',
      key: '',
      loader: async () => (await import('../translations/es.json')).default
    },
    {
      locale: 'da',
      key: '',
      loader: async () => (await import('../translations/da.json')).default
    },
    {
      locale: 'zh',
      key: '',
      loader: async () => (await import('../translations/zh.json')).default
    },
    {
      locale: 'zh-TW',
      key: '',
      loader: async () => (await import('../translations/zh-TW.json')).default
    }
  ]
};

export const { t, loading, locales, locale, initialized, translations, loadTranslations } =
  new i18n(config);

export const selectedLocale = writable<string>('zh-TW');

const LOCALE_STORAGE_KEY = 'classroomio_locale';

// Translations logs
loading.subscribe(async ($loading) => {
  if ($loading) {
    console.log('Loading translations...');

    await loading.toPromise();
  }
});

export async function handleLocaleChange(newLocale: string): Promise<void> {
  if (!newLocale) {
    return;
  }

  locale.set(newLocale);
  selectedLocale.set(newLocale);

  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(LOCALE_STORAGE_KEY, newLocale);
  }

  try {
    await loadTranslations(newLocale);
  } catch (e) {
    console.error('Failed to load translations for locale:', newLocale, e);
  }
}

export function getStoredLocale(): string {
  if (typeof localStorage === 'undefined') return '';
  return localStorage.getItem(LOCALE_STORAGE_KEY) || '';
}

export function lessonFallbackNote(
  note: string,
  translation: Record<LOCALE, string>,
  locale: LOCALE
) {
  if (!translation) {
    return note;
  }

  const content = translation[locale];

  // if locale is english and no translated content for english but note exists
  if (locale === LOCALE.EN && !content && note?.length) {
    return note;
  }

  return content;
}
