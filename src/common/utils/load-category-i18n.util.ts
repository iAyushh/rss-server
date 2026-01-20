// src/categories/utils/load-category-i18n.util.ts
import * as fs from 'fs';
import * as path from 'path';

export function loadCategoryTranslations(
  lang: 'hi' | 'en' = 'hi',
): Record<string, string> {
  const filePath = path.join(process.cwd(), 'src/i18n', lang, 'category.json');

  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}
