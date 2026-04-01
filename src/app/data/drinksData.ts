import type { FoodItem } from './menuData';

export type DrinkSection = 'dispenser' | 'fresh' | 'packaged';

export interface DrinkItem extends FoodItem {
  section: DrinkSection;
  sectionChip: 'Fizzy' | 'Fresh' | 'Packaged';
  isDispenser?: boolean;
}

export interface DrinkSectionMeta {
  id: DrinkSection;
  title: string;
  subtitle: string;
  accentLabel?: string;
}

export const DRINK_SECTION_META: DrinkSectionMeta[] = [
  {
    id: 'dispenser',
    title: 'Dispenser Drinks',
    subtitle: 'Cup-based fizzy pours with a consistent quick-serve price.',
    accentLabel: 'FIZZY POUR',
  },
  {
    id: 'fresh',
    title: 'Fresh',
    subtitle: 'Light, clean refreshers made for everyday hydration.',
    accentLabel: 'FRESH POUR',
  },
  {
    id: 'packaged',
    title: 'Packaged',
    subtitle: 'Grab-and-go sealed options for easy add-ons.',
  },
];

export const DRINK_ITEMS: DrinkItem[] = [
  {
    id: 'lemon-mint-soda',
    name: 'Lemon Mint Soda',
    description: 'Lemon + mint + soda',
    calories: 110,
    protein: 0,
    price: 69,
    image: 'https://images.unsplash.com/photo-1523362628745-0c100150b504?w=1080',
    section: 'dispenser',
    sectionChip: 'Fizzy',
    isDispenser: true,
  },
  {
    id: 'orange-spark',
    name: 'Orange Spark',
    description: 'Sweet orange soda',
    calories: 120,
    protein: 0,
    price: 69,
    image: 'https://images.unsplash.com/photo-1499638673689-79a0b5115d87?w=1080',
    section: 'dispenser',
    sectionChip: 'Fizzy',
    isDispenser: true,
  },
  {
    id: 'ginger-lemon-fizz',
    name: 'Ginger Lemon Fizz',
    description: 'Ginger + lemon + soda',
    calories: 95,
    protein: 0,
    price: 69,
    image: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=1080',
    section: 'dispenser',
    sectionChip: 'Fizzy',
    isDispenser: true,
  },
  {
    id: 'fresh-lemon-cooler',
    name: 'Fresh Lemon Cooler',
    description: 'Fresh lemon + chilled water',
    calories: 35,
    protein: 0,
    price: 29,
    image: 'https://images.unsplash.com/photo-1502741224143-90386d7f8c82?w=1080',
    section: 'fresh',
    sectionChip: 'Fresh',
  },
  {
    id: 'classic-buttermilk',
    name: 'Classic Buttermilk',
    description: 'Spiced yogurt drink',
    calories: 65,
    protein: 3,
    price: 39,
    image: 'https://images.unsplash.com/photo-1620052087057-bfd8234e847d?w=1080',
    section: 'fresh',
    sectionChip: 'Fresh',
  },
  {
    id: 'watermelon-fresh',
    name: 'Watermelon Fresh',
    description: 'Fresh watermelon juice',
    calories: 55,
    protein: 1,
    price: 49,
    image: 'https://images.unsplash.com/photo-1600271886742-f049cd451bba?w=1080',
    section: 'fresh',
    sectionChip: 'Fresh',
  },
  {
    id: 'cucumber-mint-cooler',
    name: 'Cucumber Mint Cooler',
    description: 'Cucumber + mint cooler',
    calories: 40,
    protein: 0,
    price: 49,
    image: 'https://images.unsplash.com/photo-1505576399279-565b52d4ac71?w=1080',
    section: 'fresh',
    sectionChip: 'Fresh',
  },
  {
    id: 'water-bottle',
    name: 'Water Bottle',
    description: 'Still packaged drinking water',
    calories: 0,
    protein: 0,
    price: 20,
    image: 'https://images.unsplash.com/photo-1564419439220-5a3f4f2f4f9d?w=1080',
    section: 'packaged',
    sectionChip: 'Packaged',
  },
  {
    id: 'flavoured-water',
    name: 'Flavoured Water',
    description: 'Lightly flavoured packaged water',
    calories: 20,
    protein: 0,
    price: 40,
    image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=1080',
    section: 'packaged',
    sectionChip: 'Packaged',
  },
  {
    id: 'coke-zero',
    name: 'Coke Zero',
    description: 'Zero-sugar carbonated drink',
    calories: 1,
    protein: 0,
    price: 60,
    image: 'https://images.unsplash.com/photo-1554866585-cd94860890b7?w=1080',
    section: 'packaged',
    sectionChip: 'Packaged',
  },
];

export const DRINKS_BY_SECTION: Record<DrinkSection, DrinkItem[]> = {
  dispenser: DRINK_ITEMS.filter((drink) => drink.section === 'dispenser'),
  fresh: DRINK_ITEMS.filter((drink) => drink.section === 'fresh'),
  packaged: DRINK_ITEMS.filter((drink) => drink.section === 'packaged'),
};

function replaceArray<T>(target: T[], next: T[]) {
  target.splice(0, target.length, ...next);
}

export function hydrateDrinksCatalog(nextDrinkItems: DrinkItem[]) {
  replaceArray(DRINK_ITEMS, nextDrinkItems);
  replaceArray(DRINKS_BY_SECTION.dispenser, nextDrinkItems.filter((drink) => drink.section === 'dispenser'));
  replaceArray(DRINKS_BY_SECTION.fresh, nextDrinkItems.filter((drink) => drink.section === 'fresh'));
  replaceArray(DRINKS_BY_SECTION.packaged, nextDrinkItems.filter((drink) => drink.section === 'packaged'));
}
