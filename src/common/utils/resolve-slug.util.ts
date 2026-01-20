import * as fs from 'fs';
import * as path from 'path';

type I18nNamespace = 'category' | 'subcategory';

interface ResolveI18nSlugParams {
  name: string;
  lang: string;
  namespace: I18nNamespace;
}

export function resolveI18nSlug({
  name,
  lang,
  namespace,
}: ResolveI18nSlugParams): string {
  const filePath = path.join(
    process.cwd(),
    'src',
    'i18n',
    lang,
    `${namespace}.json`,
  );

  if (!fs.existsSync(filePath)) {
    throw new Error(`i18n file not found for ${namespace} (${lang})`);
  }

  const data: Record<string, string> = JSON.parse(
    fs.readFileSync(filePath, 'utf-8'),
  );

  const entry = Object.entries(data).find(([, value]) => value === name);

  if (!entry) {
    throw new Error(`${namespace} "${name}" not found in ${lang} translations`);
  }

  const [slug] = entry;
  return slug;
}
