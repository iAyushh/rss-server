import slugify from "slugify";


export function generateSlug(title: string): string {
  let baseSlug = slugify(title, {
    lower: true,
    strict: true,
    trim: true,
  });

  return baseSlug;
}
