import slugify from "slugify";
import { transliterate } from "transliteration";


export function generateSlug(title: string): string {

let processsed = transliterate(title)

  let baseSlug = slugify(processsed, {
    lower: true,
    strict: true,
    trim: true,
  });

  return baseSlug;
}
