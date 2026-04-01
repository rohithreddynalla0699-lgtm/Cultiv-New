import { MENU_CATEGORIES } from '../data/menuData';

const CATEGORY_ALIAS_MAP: Record<string, string> = {
  'high protein': 'high-protein-cups',
  'high protein bowl': 'high-protein-cups',
  'high protein cups': 'high-protein-cups',
  'signature bowls': 'signature-bowls',
  'breakfast bowls': 'breakfast-bowls',
  'drinks & juices': 'drinks-juices',
  'drinks and juices': 'drinks-juices',
  'kids meal': 'kids-meal',
  'salad bowls': 'salad-bowls',
  'build your own bowl': 'build-your-own-bowl',
};

export function resolveCategorySlugFromLabel(categoryLabel: string): string | null {
  const normalized = categoryLabel.trim().toLowerCase();
  const direct = MENU_CATEGORIES.find((category) => category.name.toLowerCase() === normalized);
  if (direct) return direct.slug;
  return CATEGORY_ALIAS_MAP[normalized] ?? null;
}
