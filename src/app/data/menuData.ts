// menuData.ts — centralized menu data: categories, food items, and bowl builder steps with nutrition.

import { TABLE_BUILD_OPTIONS_BY_TYPE } from './buildYourOwnTableData';
import { DRINK_ITEMS, hydrateDrinksCatalog, type DrinkItem, type DrinkSection } from './drinksData';
import { fetchMenuRepositoryPayload } from './menuRepository';

// ─── Food item (shown on category pages) ────────────────────────────────────

export interface FoodItem {
  id: string;
  name: string;
  description: string;
  calories: number;
  protein: number; // grams
  price: number;
  image: string;
  badge?: string;
}

// ─── Menu category (shown on /menu) ─────────────────────────────────────────

export interface MenuCategoryData {
  slug: string;
  name: string;
  description: string;
  image: string;
  items: FoodItem[];
}

// ─── Bowl builder ────────────────────────────────────────────────────────────

export interface BuilderIngredient {
  id: string;
  name: string;
  description?: string;
  calories: number;
  protein: number; // grams
  price: number;   // 0 = included, >0 = add-on cost
}

export interface BuilderStep {
  id: string;
  title: string;
  subtitle: string;
  type: 'single' | 'multiple';
  required: boolean;
  ingredients: BuilderIngredient[];
}

export type BreakfastFamily = 'chia-yogurt' | 'overnight-oats';

export const BREAKFAST_MANGO_AVAILABLE = true;

interface BreakfastPresetConfig {
  id: string;
  name: string;
  description: string;
  calories: number;
  protein: number;
  basePrice: number;
  image: string;
  family: BreakfastFamily;
  seasonalFruitId?: 'mango';
  defaultFruitIds: string[] | 'all-available';
  badge?: string;
}

const BREAKFAST_PRESET_CONFIGS: BreakfastPresetConfig[] = [
  {
    id: 'banana-chia-yogurt-bowl',
    name: 'Banana Chia Yogurt Bowl',
    description: 'Yogurt + Chia + Banana + Honey + Granola',
    calories: 250,
    protein: 10,
    basePrice: 119,
    image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=1080',
    family: 'chia-yogurt',
    defaultFruitIds: ['banana'],
  },
  {
    id: 'apple-chia-yogurt-bowl',
    name: 'Apple Chia Yogurt Bowl',
    description: 'Yogurt + Chia + Apple + Honey + Granola',
    calories: 250,
    protein: 10,
    basePrice: 119,
    image: 'https://images.unsplash.com/photo-1498837167922-ddd27525d352?w=1080',
    family: 'chia-yogurt',
    defaultFruitIds: ['apple'],
  },
  {
    id: 'mango-chia-yogurt-bowl',
    name: 'Mango Chia Yogurt Bowl',
    description: 'Yogurt + Chia + Mango + Honey + Granola',
    calories: 260,
    protein: 10,
    basePrice: 129,
    image: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=1080',
    family: 'chia-yogurt',
    defaultFruitIds: ['mango'],
    seasonalFruitId: 'mango',
    badge: 'Seasonal',
  },
  {
    id: 'berry-chia-yogurt-bowl',
    name: 'Berry Chia Yogurt Bowl',
    description: 'Yogurt + Chia + Mixed Berries + Honey + Granola',
    calories: 280,
    protein: 11,
    basePrice: 139,
    image: 'https://images.unsplash.com/photo-1464306076886-da185f6a9d05?w=1080',
    family: 'chia-yogurt',
    defaultFruitIds: ['mixed-berries'],
  },
  {
    id: 'power-chia-yogurt-bowl',
    name: 'Power Chia Yogurt Bowl',
    description: 'Yogurt + Chia + Banana + Apple + Mango + Mixed Berries + Honey + Granola',
    calories: 330,
    protein: 13,
    basePrice: 159,
    image: 'https://images.unsplash.com/photo-1517673400267-0251440c45dc?w=1080',
    family: 'chia-yogurt',
    defaultFruitIds: 'all-available',
  },
  {
    id: 'banana-overnight-oats',
    name: 'Banana Overnight Oats',
    description: 'Oats + Milk + Chia + Banana + Honey',
    calories: 240,
    protein: 9,
    basePrice: 109,
    image: 'https://images.unsplash.com/photo-1517673400267-0251440c45dc?w=1080',
    family: 'overnight-oats',
    defaultFruitIds: ['banana'],
  },
  {
    id: 'apple-cinnamon-overnight-oats',
    name: 'Apple Cinnamon Overnight Oats',
    description: 'Oats + Milk + Chia + Apple + Cinnamon + Honey',
    calories: 260,
    protein: 9,
    basePrice: 119,
    image: 'https://images.unsplash.com/photo-1498837167922-ddd27525d352?w=1080',
    family: 'overnight-oats',
    defaultFruitIds: ['apple'],
  },
  {
    id: 'mango-overnight-oats',
    name: 'Mango Overnight Oats',
    description: 'Oats + Milk + Chia + Mango + Honey',
    calories: 270,
    protein: 9,
    basePrice: 129,
    image: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=1080',
    family: 'overnight-oats',
    defaultFruitIds: ['mango'],
    seasonalFruitId: 'mango',
    badge: 'Seasonal',
  },
  {
    id: 'berry-overnight-oats',
    name: 'Berry Overnight Oats',
    description: 'Oats + Milk + Chia + Mixed Berries + Honey',
    calories: 280,
    protein: 10,
    basePrice: 139,
    image: 'https://images.unsplash.com/photo-1543332164-6e82f355badc?w=1080',
    family: 'overnight-oats',
    defaultFruitIds: ['mixed-berries'],
  },
  {
    id: 'power-overnight-oats',
    name: 'Power Overnight Oats',
    description: 'Oats + Milk + Chia + Banana + Apple + Mango + Mixed Berries + Honey',
    calories: 340,
    protein: 13,
    basePrice: 159,
    image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=1080',
    family: 'overnight-oats',
    defaultFruitIds: 'all-available',
  },
];

function isBreakfastFruitAvailable(fruitId: string) {
  if (fruitId === 'mango') return BREAKFAST_MANGO_AVAILABLE;
  return true;
}

const BREAKFAST_VISIBLE_PRESET_CONFIGS = BREAKFAST_PRESET_CONFIGS.filter(
  (item) => !item.seasonalFruitId || isBreakfastFruitAvailable(item.seasonalFruitId),
);

export const BREAKFAST_AVAILABLE_FRUIT_IDS = ['banana', 'apple', 'mango', 'mixed-berries'].filter(
  (fruitId) => isBreakfastFruitAvailable(fruitId),
);

const BREAKFAST_DEFAULT_FRUIT_IDS_BY_ITEM_ID: Record<string, string[]> = Object.fromEntries(
  BREAKFAST_VISIBLE_PRESET_CONFIGS.map((item) => [
    item.id,
    item.defaultFruitIds === 'all-available'
      ? [...BREAKFAST_AVAILABLE_FRUIT_IDS]
      : item.defaultFruitIds.filter((fruitId) => isBreakfastFruitAvailable(fruitId)),
  ]),
);

export const BREAKFAST_PRESET_META_BY_ID = Object.fromEntries(
  BREAKFAST_VISIBLE_PRESET_CONFIGS.map((item) => [
    item.id,
    {
      itemId: item.id,
      title: item.name,
      family: item.family,
      basePrice: item.basePrice,
      defaultFruitIds: BREAKFAST_DEFAULT_FRUIT_IDS_BY_ITEM_ID[item.id],
      hasGranolaByDefault: item.family === 'chia-yogurt',
    },
  ]),
) as Record<
  string,
  {
    itemId: string;
    title: string;
    family: BreakfastFamily;
    basePrice: number;
    defaultFruitIds: string[];
    hasGranolaByDefault: boolean;
  }
>;

export const BREAKFAST_PRESET_ITEMS: FoodItem[] = BREAKFAST_VISIBLE_PRESET_CONFIGS.map((item) => ({
  id: item.id,
  name: item.name,
  description: item.description,
  calories: item.calories,
  protein: item.protein,
  price: item.basePrice,
  image: item.image,
  badge: item.badge,
}));

export const BREAKFAST_SECTION_ITEM_IDS: Record<'chiaYogurtBowls' | 'overnightOats', string[]> = {
  chiaYogurtBowls: BREAKFAST_VISIBLE_PRESET_CONFIGS
    .filter((item) => item.family === 'chia-yogurt')
    .map((item) => item.id),
  overnightOats: BREAKFAST_VISIBLE_PRESET_CONFIGS
    .filter((item) => item.family === 'overnight-oats')
    .map((item) => item.id),
};

export const BREAKFAST_DYNAMIC_PRICING = {
  'chia-yogurt': {
    oneFruit: 119,
    twoFruits: 139,
    threeFruits: 149,
    power: 159,
  },
  'overnight-oats': {
    oneFruit: 109,
    twoFruits: 129,
    threeFruits: 139,
    power: 149,
  },
} as const;

export function getBreakfastFamilyFromItemId(itemId: string): BreakfastFamily | null {
  if (BREAKFAST_SECTION_ITEM_IDS.chiaYogurtBowls.includes(itemId)) return 'chia-yogurt';
  if (BREAKFAST_SECTION_ITEM_IDS.overnightOats.includes(itemId)) return 'overnight-oats';
  return null;
}

export function resolveBreakfastPriceFromFruitSelections(family: BreakfastFamily, selectedFruitIds: string[]) {
  const selectedCount = new Set(selectedFruitIds.filter((id) => BREAKFAST_AVAILABLE_FRUIT_IDS.includes(id))).size;
  const availableFruitCount = BREAKFAST_AVAILABLE_FRUIT_IDS.length;
  const normalizedCount = Math.max(1, selectedCount);
  const pricing = BREAKFAST_DYNAMIC_PRICING[family];
  const isPower = normalizedCount >= availableFruitCount;

  if (isPower) {
    return {
      basePrice: pricing.power,
      isPower: true,
    };
  }

  if (normalizedCount >= 3) {
    return {
      basePrice: pricing.threeFruits,
      isPower: false,
    };
  }

  if (normalizedCount === 2) {
    return {
      basePrice: pricing.twoFruits,
      isPower: false,
    };
  }

  return {
    basePrice: pricing.oneFruit,
    isPower: false,
  };
}

const BREAKFAST_FRUIT_INGREDIENTS_BY_ID: Record<string, BuilderIngredient> = {
  banana: { id: 'banana', name: 'Banana', calories: 25, protein: 0, price: 0 },
  apple: { id: 'apple', name: 'Apple', calories: 25, protein: 0, price: 0 },
  mango: { id: 'mango', name: 'Mango (Seasonal)', calories: 30, protein: 0, price: 0 },
  'mixed-berries': { id: 'mixed-berries', name: 'Mixed Berries', calories: 30, protein: 1, price: 0 },
};

export const BREAKFAST_CUSTOMIZE_STEPS: BuilderStep[] = [
  {
    id: 'fruits',
    title: 'Choose fruits',
    subtitle: 'Pick one or more',
    type: 'multiple',
    required: true,
    ingredients: BREAKFAST_AVAILABLE_FRUIT_IDS.map((fruitId) => BREAKFAST_FRUIT_INGREDIENTS_BY_ID[fruitId]),
  },
  {
    id: 'crunch',
    title: 'Add crunch',
    subtitle: 'Optional texture add-on',
    type: 'single',
    required: false,
    ingredients: [
      { id: 'granola', name: 'Granola', calories: 55, protein: 2, price: 0 },
    ],
  },
  {
    id: 'add-ons',
    title: 'Add add-ons',
    subtitle: 'Extra Fruit means extra portion of selected fruits',
    type: 'multiple',
    required: false,
    ingredients: [
      { id: 'honey', name: 'Honey', calories: 20, protein: 0, price: 10 },
      { id: 'extra-fruit', name: 'Extra Fruit', calories: 30, protein: 0, price: 20 },
      { id: 'extra-granola', name: 'Extra Granola', calories: 55, protein: 2, price: 20 },
    ],
  },
];

// ─── Category data ────────────────────────────────────────────────────────────

export const MENU_CATEGORIES: MenuCategoryData[] = [
  {
    slug: 'build-your-own-bowl',
    name: 'Build Your Own Bowl',
    description: 'Build a shareable table bowl for 4-5 people — your choice of protein, veggies, and sauce.',
    image: 'https://images.unsplash.com/photo-1543332164-6e82f355badc?w=1080',
    items: [
      {
        id: 'veg-table-bowl',
        name: TABLE_BUILD_OPTIONS_BY_TYPE.veg.title,
        description: 'Serves 4-5 people. Rajma and Channa with rice, fresh toppings, and salsa.',
        calories: 1600,
        protein: 72,
        price: TABLE_BUILD_OPTIONS_BY_TYPE.veg.basePrice,
        image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=1080',
        badge: 'Serves 4-5',
      },
      {
        id: 'chicken-table-bowl',
        name: TABLE_BUILD_OPTIONS_BY_TYPE.chicken.title,
        description: 'Serves 4-5 people. Classic and Spicy Chicken with rice, fresh toppings, and salsa.',
        calories: 2000,
        protein: 110,
        price: TABLE_BUILD_OPTIONS_BY_TYPE.chicken.basePrice,
        image: 'https://images.unsplash.com/photo-1543332164-6e82f355badc?w=1080',
        badge: 'Serves 4-5',
      },
      {
        id: 'power-table-bowl',
        name: TABLE_BUILD_OPTIONS_BY_TYPE.both.title,
        description: 'Serves 4-5 people. All four proteins — Rajma, Channa, Classic and Spicy Chicken.',
        calories: 2400,
        protein: 140,
        price: TABLE_BUILD_OPTIONS_BY_TYPE.both.basePrice,
        image: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=1080',
        badge: 'Best Value',
      },
    ],
  },
  {
    slug: 'breakfast-bowls',
    name: 'Breakfast Bowls',
    description: 'Preset breakfast bowls with optional customization paths.',
    image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=1080',
    items: BREAKFAST_PRESET_ITEMS,
  },
  {
    slug: 'signature-bowls',
    name: 'Signature Bowls',
    description: 'Single person bowls with everyday balanced ingredient builds.',
    image: 'https://images.unsplash.com/photo-1625944374530-cd0f5489ec77?w=1080',
    items: [
      {
        id: 'everyday-veg-bowl',
        name: 'Everyday Veg Bowl',
        description: 'Light Rice, Rajma or Channa, Onion, Cucumber, and Fresh Salsa.',
        calories: 410,
        protein: 18,
        price: 169,
        image: 'https://images.unsplash.com/photo-1625944374530-cd0f5489ec77?w=1080',
        badge: 'Best Seller',
      },
      {
        id: 'everyday-chicken-bowl',
        name: 'Everyday Chicken Bowl',
        description: 'Light Rice, Classic Chicken, Onion, Cucumber, and Fresh Salsa.',
        calories: 460,
        protein: 30,
        price: 189,
        image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=1080',
      },
      {
        id: 'everyday-power-bowl',
        name: 'Everyday Power Bowl',
        description: 'Light Rice, Chicken, Rajma or Channa, Lettuce, and Tomato Green Chilli Salsa.',
        calories: 510,
        protein: 34,
        price: 199,
        image: 'https://images.unsplash.com/photo-1543332164-6e82f355badc?w=1080',
        badge: 'Power Pick',
      },
    ],
  },
  {
    slug: 'high-protein-cups',
    name: 'High Protein Cups',
    description: 'Complete protein cups for quick add-ons, routine refuels, and high-protein meals.',
    image: 'https://images.unsplash.com/photo-1543332164-6e82f355badc?w=1080',
    items: [
      {
        id: 'classic-chicken-cup-small',
        name: 'Classic Chicken Cup (Small)',
        description: 'Lightly seasoned classic chicken. Clean and simple.',
        calories: 80,
        protein: 14,
        price: 40,
        image: 'https://images.unsplash.com/photo-1543332164-6e82f355badc?w=1080',
      },
      {
        id: 'classic-chicken-cup-large',
        name: 'Classic Chicken Cup (Large)',
        description: 'A larger portion of classic seasoned chicken.',
        calories: 160,
        protein: 28,
        price: 70,
        image: 'https://images.unsplash.com/photo-1543332164-6e82f355badc?w=1080',
        badge: 'Large',
      },
      {
        id: 'spicy-chicken-cup-small',
        name: 'Spicy Chicken Cup (Small)',
        description: 'Spiced and juicy chicken with a gentle kick.',
        calories: 85,
        protein: 14,
        price: 40,
        image: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=1080',
      },
      {
        id: 'spicy-chicken-cup-large',
        name: 'Spicy Chicken Cup (Large)',
        description: 'A generous portion of spicy chicken.',
        calories: 170,
        protein: 28,
        price: 70,
        image: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=1080',
        badge: 'Large',
      },
      {
        id: 'rajma-cup-small',
        name: 'Rajma Cup (Small)',
        description: 'Slow-cooked kidney beans, lightly spiced.',
        calories: 70,
        protein: 5,
        price: 30,
        image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=1080',
      },
      {
        id: 'rajma-cup-large',
        name: 'Rajma Cup (Large)',
        description: 'A bigger bowl of slow-cooked kidney beans.',
        calories: 140,
        protein: 10,
        price: 55,
        image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=1080',
        badge: 'Large',
      },
      {
        id: 'channa-cup-small',
        name: 'Channa Cup (Small)',
        description: 'Warm, spiced chickpeas with a clean flavour.',
        calories: 65,
        protein: 5,
        price: 30,
        image: 'https://images.unsplash.com/photo-1625944374530-cd0f5489ec77?w=1080',
      },
      {
        id: 'channa-cup-large',
        name: 'Channa Cup (Large)',
        description: 'A larger cup of spiced chickpeas.',
        calories: 130,
        protein: 10,
        price: 55,
        image: 'https://images.unsplash.com/photo-1625944374530-cd0f5489ec77?w=1080',
        badge: 'Large',
      },
      {
        id: 'egg-protein-cup',
        name: 'Egg Protein Cup',
        description: 'Two scrambled eggs. Soft, light, and protein-packed.',
        calories: 140,
        protein: 12,
        price: 35,
        image: 'https://images.unsplash.com/photo-1547592180-85f173990554?w=1080',
      },
      {
        id: 'mixed-protein-cup',
        name: 'Mixed Protein Cup',
        description: 'A mix of chicken, rajma, and channa — ideal alongside any bowl.',
        calories: 180,
        protein: 20,
        price: 75,
        image: 'https://images.unsplash.com/photo-1498837167922-ddd27525d352?w=1080',
        badge: 'Best Mix',
      },
    ],
  },
  {
    slug: 'salad-bowls',
    name: 'Salad Bowls',
    description: 'Single person salad bowls with everyday balanced builds and no rice base.',
    image: 'https://images.unsplash.com/photo-1512058556646-c4da40fba323?w=1080',
    items: [
      {
        id: 'veg-salad-bowl',
        name: 'Veg Salad Bowl',
        description: 'Greens, veg proteins, crunchy toppings, and fresh salsa. No rice included.',
        calories: 310,
        protein: 16,
        price: 169,
        image: 'https://images.unsplash.com/photo-1512058556646-c4da40fba323?w=1080',
        badge: 'Fresh',
      },
      {
        id: 'chicken-salad-bowl',
        name: 'Chicken Salad Bowl',
        description: 'Greens, chicken proteins, fresh toppings, and salsa. No rice included.',
        calories: 360,
        protein: 28,
        price: 189,
        image: 'https://images.unsplash.com/photo-1547592180-85f173990554?w=1080',
      },
      {
        id: 'power-salad-bowl',
        name: 'Power Salad Bowl',
        description: 'Greens with both veg and chicken proteins for a balanced power salad. No rice included.',
        calories: 410,
        protein: 34,
        price: 199,
        image: 'https://images.unsplash.com/photo-1625944374530-cd0f5489ec77?w=1080',
        badge: 'Power Pick',
      },
    ],
  },
  {
    slug: 'kids-meal',
    name: 'Kids Meal',
    description: 'Smaller, milder portions built for lighter appetites and family routines.',
    image: 'https://images.unsplash.com/photo-1547592180-85f173990554?w=1080',
    items: [
      {
        id: 'soft-rice-chicken',
        name: 'Soft Rice & Chicken',
        description: 'Soft white rice with mild grilled chicken and a fruit cup.',
        calories: 270,
        protein: 18,
        price: 139,
        image: 'https://images.unsplash.com/photo-1547592180-85f173990554?w=1080',
        badge: 'Popular',
      },
      {
        id: 'egg-rice-kids',
        name: 'Egg Rice Bowl',
        description: 'Soft white rice with scrambled egg and sweet corn.',
        calories: 240,
        protein: 14,
        price: 129,
        image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=1080',
      },
      {
        id: 'veggie-soft-bowl',
        name: 'Veggie Soft Bowl',
        description: 'Veggie base with paneer and a yogurt side.',
        calories: 200,
        protein: 10,
        price: 119,
        image: 'https://images.unsplash.com/photo-1543332164-6e82f355badc?w=1080',
        badge: 'Veggie',
      },
    ],
  },
  {
    slug: 'drinks-juices',
    name: 'Drinks & Juices',
    description: 'Fresh juices and clean beverages to round out every order.',
    image: 'https://images.unsplash.com/photo-1610970881699-44a5587cabec?w=1080',
    items: DRINK_ITEMS,
  },
];

const DEFAULT_OPTION_GROUPS_BY_CATEGORY_SLUG: Record<string, string[]> = {
  'build-your-own-bowl': ['base', 'protein', 'toppings', 'sauce', 'extras'],
  'signature-bowls': ['base', 'protein', 'toppings', 'sauce', 'extras'],
  'salad-bowls': ['protein', 'toppings', 'sauce', 'extras'],
  'breakfast-bowls': ['fruits', 'crunch', 'add-ons'],
};

const DEFAULT_ITEM_OPTION_GROUPS_BY_ITEM_ID: Record<string, string[]> = Object.fromEntries(
  MENU_CATEGORIES.flatMap((category) =>
    category.items.map((item) => [item.id, [...(DEFAULT_OPTION_GROUPS_BY_CATEGORY_SLUG[category.slug] ?? [])]]),
  ),
);

const TABLE_ITEM_ID_ALIAS_TO_MENU_ITEM_ID: Record<string, string> = {
  'table-veg': 'veg-table-bowl',
  'table-chicken': 'chicken-table-bowl',
  'table-both': 'power-table-bowl',
  'table-power': 'power-table-bowl',
};

export const ITEM_OPTION_GROUPS_BY_ITEM_ID: Record<string, string[]> = {
  ...DEFAULT_ITEM_OPTION_GROUPS_BY_ITEM_ID,
};

export function getAllowedOptionGroupIdsForItem(itemId: string): string[] | null {
  const normalizedItemId = TABLE_ITEM_ID_ALIAS_TO_MENU_ITEM_ID[itemId] ?? itemId;
  const groups = ITEM_OPTION_GROUPS_BY_ITEM_ID[normalizedItemId];
  if (!groups || groups.length === 0) return null;
  return [...groups];
}

// Slug → category lookup
export const CATEGORY_BY_SLUG: Record<string, MenuCategoryData> =
  Object.fromEntries(MENU_CATEGORIES.map((cat) => [cat.slug, cat]));

// ─── Bowl builder steps ───────────────────────────────────────────────────────

export const BOWL_BASE_PRICE = 169;

export const BOWL_BUILDER_STEPS: BuilderStep[] = [
  {
    id: 'base',
    title: 'Choose your base',
    subtitle: 'Pick one or two, or skip for a salad bowl',
    type: 'multiple',
    required: false,
    ingredients: [
      { id: 'light-rice', name: 'Light Rice', calories: 180, protein: 4, price: 0 },
      { id: 'power-rice', name: 'Power Rice', description: 'Brown rice with added fibre and nutrients', calories: 210, protein: 5, price: 0 },
    ],
  },
  {
    id: 'protein',
    title: 'Choose your protein',
    subtitle: 'Pick one or more',
    type: 'multiple',
    required: true,
    ingredients: [
      { id: 'rajma',           name: 'Rajma',           description: 'Slow-cooked kidney beans',         calories: 95,  protein: 7,  price: 0 },
      { id: 'channa',          name: 'Channa',           description: 'Spiced chickpeas',                 calories: 90,  protein: 6,  price: 0 },
      { id: 'classic-chicken', name: 'Classic Chicken',  description: 'Lightly seasoned grilled chicken',  calories: 140, protein: 24, price: 0 },
      { id: 'spicy-chicken',   name: 'Spicy Chicken',    description: 'Bold spiced grilled chicken',       calories: 145, protein: 24, price: 0 },
    ],
  },
  {
    id: 'toppings',
    title: 'Add toppings',
    subtitle: 'Pick as many as you like (all included)',
    type: 'multiple',
    required: false,
    ingredients: [
      { id: 'onion',                  name: 'Onion',                  calories: 12, protein: 0, price: 0 },
      { id: 'cucumber',               name: 'Cucumber',               calories: 10, protein: 0, price: 0 },
      { id: 'lettuce',                name: 'Lettuce',                calories: 10, protein: 1, price: 0 },
      { id: 'sauteed-veggies',        name: 'Sautéed Veggies',        calories: 45, protein: 2, price: 0 },
      { id: 'shredded-green-cabbage', name: 'Shredded Green Cabbage', calories: 10, protein: 1, price: 0 },
      { id: 'shredded-red-cabbage',   name: 'Shredded Red Cabbage',   calories: 12, protein: 1, price: 0 },
      { id: 'shredded-carrot',        name: 'Shredded Carrot',        calories: 16, protein: 0, price: 0 },
    ],
  },
  {
    id: 'sauce',
    title: 'Add a sauce',
    subtitle: 'Pick as many as you like (all included)',
    type: 'multiple',
    required: false,
    ingredients: [
      { id: 'fresh-salsa',               name: 'Fresh Salsa',               calories: 18, protein: 1, price: 0 },
      { id: 'roasted-chilli-corn-salsa', name: 'Roasted Chilli Corn Salsa', calories: 40, protein: 1, price: 0 },
      { id: 'tomato-green-chilli-salsa', name: 'Tomato Green Chilli Salsa', calories: 20, protein: 1, price: 0 },
      { id: 'tomato-red-chilli-salsa',   name: 'Tomato Red Chilli Salsa',   calories: 22, protein: 1, price: 0 },
    ],
  },
  {
    id: 'extras',
    title: 'Add extras',
    subtitle: 'Optional paid upgrades',
    type: 'multiple',
    required: false,
    ingredients: [
      { id: 'extra-chicken', name: 'Extra Chicken', calories: 120, protein: 22, price: 40 },
      { id: 'extra-rajma',   name: 'Extra Rajma',   calories: 80,  protein: 6,  price: 20 },
      { id: 'extra-channa',  name: 'Extra Channa',  calories: 80,  protein: 6,  price: 20 },
      { id: 'scrambled-egg', name: 'Scrambled Egg', calories: 90,  protein: 7,  price: 20 },
      { id: 'guacamole',     name: 'Guacamole',     calories: 95,  protein: 1,  price: 40 },
      { id: 'cheese',        name: 'Cheese',        calories: 70,  protein: 4,  price: 15 },
    ],
  },
];

function replaceArray<T>(target: T[], next: T[]) {
  target.splice(0, target.length, ...next);
}

function replaceObject<T extends Record<string, unknown>>(target: T, next: T) {
  for (const key of Object.keys(target)) {
    delete target[key as keyof T];
  }
  Object.assign(target, next);
}

const CATEGORY_ORDER = [
  'build-your-own-bowl',
  'breakfast-bowls',
  'signature-bowls',
  'high-protein-cups',
  'salad-bowls',
  'kids-meal',
  'drinks-juices',
] as const;

const CATEGORY_META_FALLBACK = Object.fromEntries(
  MENU_CATEGORIES.map((category) => [
    category.slug,
    {
      name: category.name,
      description: category.description,
      image: category.image,
    },
  ]),
) as Record<string, { name: string; description: string; image: string }>;

const ITEM_META_FALLBACK = Object.fromEntries(
  MENU_CATEGORIES.flatMap((category) =>
    category.items.map((item) => [
      item.id,
      {
        description: item.description,
        calories: item.calories,
        protein: item.protein,
        image: item.image,
        badge: item.badge,
      },
    ]),
  ),
) as Record<string, { description: string; calories: number; protein: number; image: string; badge?: string }>;

const INGREDIENT_META_FALLBACK = Object.fromEntries(
  [...BOWL_BUILDER_STEPS, ...BREAKFAST_CUSTOMIZE_STEPS].flatMap((step) =>
    step.ingredients.map((ingredient) => [
      ingredient.id,
      {
        description: ingredient.description,
        calories: ingredient.calories,
        protein: ingredient.protein,
      },
    ]),
  ),
) as Record<string, { description?: string; calories: number; protein: number }>;

const BREAKFAST_DEFAULTS_FALLBACK = Object.fromEntries(
  Object.values(BREAKFAST_PRESET_META_BY_ID).map((meta) => [meta.itemId, [...meta.defaultFruitIds]]),
) as Record<string, string[]>;

const BREAKFAST_GRANOLA_FALLBACK = Object.fromEntries(
  Object.values(BREAKFAST_PRESET_META_BY_ID).map((meta) => [meta.itemId, meta.hasGranolaByDefault]),
) as Record<string, boolean>;

function inferBreakfastFamily(itemId: string, subcategorySlug: string | null): BreakfastFamily {
  if (subcategorySlug === 'overnight-oats') return 'overnight-oats';
  if (subcategorySlug === 'chia-yogurt') return 'chia-yogurt';
  return itemId.includes('overnight-oats') ? 'overnight-oats' : 'chia-yogurt';
}

function inferDrinkSection(itemId: string, subcategorySlug: string | null): DrinkSection {
  if (subcategorySlug === 'dispenser' || subcategorySlug === 'fresh' || subcategorySlug === 'packaged') {
    return subcategorySlug;
  }
  const existing = DRINK_ITEMS.find((drink) => drink.id === itemId);
  return existing?.section ?? 'packaged';
}

function inferDrinkChip(section: DrinkSection): 'Fizzy' | 'Fresh' | 'Packaged' {
  if (section === 'dispenser') return 'Fizzy';
  if (section === 'fresh') return 'Fresh';
  return 'Packaged';
}

export async function hydrateMenuCatalogFromSupabase() {
  const payload = await fetchMenuRepositoryPayload();

  if (!payload.menuItems.length) {
    throw new Error('menu_items is empty in Supabase.');
  }

  const visibleMenuItems = payload.menuItems.filter((item) => item.is_available !== false);
  const groupedByCategory = new Map<string, typeof visibleMenuItems>();
  for (const item of visibleMenuItems) {
    const list = groupedByCategory.get(item.category_slug) ?? [];
    list.push(item);
    groupedByCategory.set(item.category_slug, list);
  }

  const subcategoryByItemId = Object.fromEntries(visibleMenuItems.map((item) => [item.menu_item_id, item.subcategory_slug]));


  // Known categories in order
  const knownCategories: MenuCategoryData[] = CATEGORY_ORDER
    .filter((slug) => groupedByCategory.has(slug))
    .map((slug) => {
      const categoryItems = (groupedByCategory.get(slug) ?? [])
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name));
      const meta = CATEGORY_META_FALLBACK[slug] ?? {
        name: slug,
        description: 'Menu items',
        image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=1080',
      };
      return {
        slug,
        name: meta.name,
        description: meta.description,
        image: meta.image,
        items: categoryItems.map((row) => {
          const fallback = ITEM_META_FALLBACK[row.menu_item_id] ?? {
            description: '',
            calories: 0,
            protein: 0,
            image: meta.image,
          };
          return {
            id: row.menu_item_id,
            name: row.name,
            description: row.description ?? fallback.description,
            calories: row.calories ?? fallback.calories,
            protein: row.protein_grams ?? fallback.protein,
            price: row.base_price,
            image: row.image_url ?? fallback.image,
            badge: row.badge ?? fallback.badge,
          };
        }),
      };
    });

  // Unknown categories (not in CATEGORY_ORDER)
  const unknownCategorySlugs = Array.from(groupedByCategory.keys()).filter(
    (slug) => !CATEGORY_ORDER.includes(slug as any)
  );
  const unknownCategories: MenuCategoryData[] = unknownCategorySlugs.map((slug) => {
    const categoryItems = (groupedByCategory.get(slug) ?? [])
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name));
    const meta = CATEGORY_META_FALLBACK[slug] ?? {
      name: slug,
      description: 'Menu items',
      image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=1080',
    };
    return {
      slug,
      name: meta.name,
      description: meta.description,
      image: meta.image,
      items: categoryItems.map((row) => {
        const fallback = ITEM_META_FALLBACK[row.menu_item_id] ?? {
          description: '',
          calories: 0,
          protein: 0,
          image: meta.image,
        };
        return {
          id: row.menu_item_id,
          name: row.name,
          description: row.description ?? fallback.description,
          calories: row.calories ?? fallback.calories,
          protein: row.protein_grams ?? fallback.protein,
          price: row.base_price,
          image: row.image_url ?? fallback.image,
          badge: row.badge ?? fallback.badge,
        };
      }),
    };
  });

  const nextCategories: MenuCategoryData[] = [...knownCategories, ...unknownCategories];

  replaceArray(MENU_CATEGORIES, nextCategories);
  replaceObject(CATEGORY_BY_SLUG, Object.fromEntries(nextCategories.map((category) => [category.slug, category])) as Record<string, MenuCategoryData>);

  const groupsById = Object.fromEntries(payload.optionGroups.map((group) => [group.option_group_id, group]));
  const optionItemsByGroupId = payload.optionItems
    .reduce((acc, item) => {
      const list = acc.get(item.option_group_id) ?? [];
      list.push(item);
      acc.set(item.option_group_id, list);
      return acc;
    }, new Map<string, typeof payload.optionItems>());

  const toStep = (
    groupId: string,
    title: string,
    subtitle: string,
    requiredFallback: boolean,
  ): BuilderStep | null => {
    const group = groupsById[groupId];
    const optionItems = (optionItemsByGroupId.get(groupId) ?? [])
      .filter((item) => item.is_available !== false)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name));

    if (!group || optionItems.length === 0) return null;

    return {
      id: groupId,
      title,
      subtitle,
      type: group.selection_type,
      required: group.is_required ?? requiredFallback,
      ingredients: optionItems.map((item) => {
        const fallback = INGREDIENT_META_FALLBACK[item.option_item_id] ?? { calories: 0, protein: 0 };
        return {
          id: item.option_item_id,
          name: item.name,
          description: fallback.description,
          calories: fallback.calories,
          protein: fallback.protein,
          price: item.price_modifier,
        };
      }),
    };
  };

  const nextBowlSteps = [
    toStep('base', 'Choose your base', 'Pick one or two, or skip for a salad bowl', false),
    toStep('protein', 'Choose your protein', 'Pick one or more', true),
    toStep('toppings', 'Add toppings', 'Pick as many as you like (all included)', false),
    toStep('sauce', 'Add a sauce', 'Pick as many as you like (all included)', false),
    toStep('extras', 'Add extras', 'Optional paid upgrades', false),
  ].filter(Boolean) as BuilderStep[];

  if (nextBowlSteps.length >= 4) {
    replaceArray(BOWL_BUILDER_STEPS, nextBowlSteps);
  }

  const nextBreakfastSteps = [
    toStep('fruits', 'Choose fruits', 'Pick one or more', true),
    toStep('crunch', 'Add crunch', 'Optional texture add-on', false),
    toStep('add-ons', 'Add add-ons', 'Extra Fruit means extra portion of selected fruits', false),
  ].filter(Boolean) as BuilderStep[];

  if (nextBreakfastSteps.length >= 2) {
    replaceArray(BREAKFAST_CUSTOMIZE_STEPS, nextBreakfastSteps);
  }

  const breakfastCategory = nextCategories.find((category) => category.slug === 'breakfast-bowls');
  const breakfastItems = breakfastCategory?.items ?? [];
  replaceArray(BREAKFAST_PRESET_ITEMS, breakfastItems);

  const nextFruitIds = (nextBreakfastSteps.find((step) => step.id === 'fruits')?.ingredients ?? []).map((item) => item.id);
  if (nextFruitIds.length > 0) {
    replaceArray(BREAKFAST_AVAILABLE_FRUIT_IDS, nextFruitIds);
  }

  const chiaIds = breakfastItems
    .filter((item) => inferBreakfastFamily(item.id, subcategoryByItemId[item.id] ?? null) === 'chia-yogurt')
    .map((item) => item.id);
  const overnightIds = breakfastItems
    .filter((item) => inferBreakfastFamily(item.id, subcategoryByItemId[item.id] ?? null) === 'overnight-oats')
    .map((item) => item.id);

  replaceArray(BREAKFAST_SECTION_ITEM_IDS.chiaYogurtBowls, chiaIds);
  replaceArray(BREAKFAST_SECTION_ITEM_IDS.overnightOats, overnightIds);

  const nextBreakfastMeta = Object.fromEntries(
    breakfastItems.map((item) => {
      const family = inferBreakfastFamily(item.id, subcategoryByItemId[item.id] ?? null);
      return [
        item.id,
        {
          itemId: item.id,
          title: item.name,
          family,
          basePrice: item.price,
          defaultFruitIds: BREAKFAST_DEFAULTS_FALLBACK[item.id] ?? [...BREAKFAST_AVAILABLE_FRUIT_IDS],
          hasGranolaByDefault: BREAKFAST_GRANOLA_FALLBACK[item.id] ?? family === 'chia-yogurt',
        },
      ];
    }),
  ) as typeof BREAKFAST_PRESET_META_BY_ID;

  if (Object.keys(nextBreakfastMeta).length > 0) {
    replaceObject(BREAKFAST_PRESET_META_BY_ID, nextBreakfastMeta);
  }

  const nextDrinks: DrinkItem[] = visibleMenuItems
    .filter((item) => item.category_slug === 'drinks-juices')
    .map((row) => {
      const existing = DRINK_ITEMS.find((drink) => drink.id === row.menu_item_id);
      const section = inferDrinkSection(row.menu_item_id, row.subcategory_slug);
      const fallback = ITEM_META_FALLBACK[row.menu_item_id] ?? {
        description: existing?.description ?? '',
        calories: existing?.calories ?? 0,
        protein: existing?.protein ?? 0,
        image: existing?.image ?? 'https://images.unsplash.com/photo-1502741224143-90386d7f8c82?w=1080',
      };

      return {
        id: row.menu_item_id,
        name: row.name,
        description: row.description ?? fallback.description,
        calories: row.calories ?? fallback.calories,
        protein: row.protein_grams ?? fallback.protein,
        price: row.base_price,
        image: row.image_url ?? fallback.image,
        badge: row.badge ?? ITEM_META_FALLBACK[row.menu_item_id]?.badge,
        section,
        sectionChip: inferDrinkChip(section),
        isDispenser: section === 'dispenser',
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  if (nextDrinks.length > 0) {
    hydrateDrinksCatalog(nextDrinks);
  }

  const nextItemOptionGroups = payload.itemOptionGroupMap
    .reduce((acc, row) => {
      const list = acc.get(row.menu_item_id) ?? [];
      list.push(row);
      acc.set(row.menu_item_id, list);
      return acc;
    }, new Map<string, typeof payload.itemOptionGroupMap>())
    ;

  const mappedGroups = Object.fromEntries(
    Array.from(nextItemOptionGroups.entries()).map(([itemId, rows]) => [
      itemId,
      rows
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
        .map((row) => row.option_group_id),
    ]),
  ) as Record<string, string[]>;

  replaceObject(ITEM_OPTION_GROUPS_BY_ITEM_ID, {
    ...DEFAULT_ITEM_OPTION_GROUPS_BY_ITEM_ID,
    ...mappedGroups,
  });
}
