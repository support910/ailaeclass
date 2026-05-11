import { config, loadTranslations, getStoredLocale } from '$lib/utils/functions/translations';
import { profile } from '$lib/utils/store/user';
import { get } from 'svelte/store';

const SUPPORTED_LANGUAGES = config?.loaders?.map((loader) => loader.locale) || [];

export const load = async ({ url, data }) => {
  const { pathname } = url;

  const profileStore = get(profile);

  const serverLang = data.serverLang || '';

  const storedLocale = getStoredLocale();
  const userLocale = storedLocale || (profileStore.id ? profileStore.locale : getInitialLocale(serverLang));

  const initLocale = getInitialLocale(userLocale);
  await loadTranslations(initLocale, pathname); // keep this just before the `return`

  return data;
};

function getInitialLocale(lang: string): string {
  if (!lang) return 'zh-TW';

  // Parse accept-language header format: "zh-TW,zh;q=0.9,en;q=0.8"
  const primaryLang = lang.split(',')[0].split(';')[0].trim();
  if (!primaryLang) return 'zh-TW';

  // Check full locale first (e.g. 'zh-TW' before falling back to 'zh')
  const fullLocale = primaryLang.toLowerCase();
  const matchFull = SUPPORTED_LANGUAGES.find((l) => l.toLowerCase() === fullLocale);
  if (matchFull) return matchFull;

  const locale = primaryLang.split('-')[0];
  const matchBase = SUPPORTED_LANGUAGES.find((l) => l.toLowerCase() === locale);
  if (matchBase) return matchBase;

  return 'zh-TW';
}
