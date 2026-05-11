import { LOCALE } from '../types';

export const LANGUAGE = {
  [LOCALE.ZH_TW]: '繁體中文',
  [LOCALE.ZH]: '简体中文',
  [LOCALE.EN]: 'English',
  [LOCALE.DE]: 'German',
  [LOCALE.ES]: 'Spanish',
  [LOCALE.FR]: 'French',
  [LOCALE.HI]: 'Hindi',
  [LOCALE.PL]: 'Polish',
  [LOCALE.PT]: 'Portuguese',
  [LOCALE.RU]: 'Russian',
  [LOCALE.VI]: 'Vietnamese',
  [LOCALE.DA]: 'Danish'
};

export const LANGUAGES = Object.keys(LANGUAGE).map((lang) => ({
  id: lang,
  text: LANGUAGE[lang]
}));
