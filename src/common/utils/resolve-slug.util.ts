import slugify from 'slugify';

interface TranslationInput {
  languageCode: string;
  name: string;
}

export function generateSlugFromTranslations(
  translations: TranslationInput[],
  fallbackPrefix: string,
): string {
  if (!translations || translations.length === 0) {
    return `${fallbackPrefix}-${Date.now()}`;
  }

  // Pick first non-empty name (language-agnostic)
  const source = translations.find((t) => t.name?.trim());

  if (source) {
    const slug = slugify(source.name, {
      lower: true,
      strict: true, // removes non-ascii chars safely
      trim: true,
    });

    if (slug.length > 0) {
      return slug;
    }
  }

  return `${fallbackPrefix}-${Date.now()}`;
}
