import ms from './guideTranslations.ms';
import id from './guideTranslations.id';
import th from './guideTranslations.th';

const guideTranslations: Record<string, Record<string, string>> = { ms, id, th };

export function translateGuideText(locale: string, english: string): string {
  return guideTranslations[locale]?.[english] || english;
}
