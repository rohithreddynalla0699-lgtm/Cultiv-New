// buildYourOwnTableData.ts — shared config for Build Your Own Bowl table-order chooser and defaults.

export type TableBuildType = 'chicken' | 'veg' | 'both';

export interface TableBuildOption {
  type: TableBuildType;
  title: string;
  description: string;
  serves: string;
  caloriesRange: string;
  proteinRange: string;
  image: string;
  basePrice: number;
  defaultSelections: Record<string, string[]>;
}

export const TABLE_BUILD_OPTIONS: TableBuildOption[] = [
  {
    type: 'chicken',
    title: 'Chicken Table Bowl',
    description:
      'Built for the table with classic and spicy chicken, rice, fresh toppings, and salsa. Balanced and shareable for 4-5 people.',
    serves: 'Serves 4-5 people',
    caloriesRange: 'approximately 1800-2400 cal',
    proteinRange: 'approximately 100-130g',
    image: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=720&q=80&auto=format&fit=crop',
    basePrice: 699,
    defaultSelections: {
      base: ['light-rice', 'power-rice'],
      protein: ['classic-chicken', 'spicy-chicken'],
      toppings: ['onion', 'cucumber', 'lettuce', 'sauteed-veggies'],
      sauce: ['fresh-salsa', 'roasted-chilli-corn-salsa'],
      extras: [],
    },
  },
  {
    type: 'veg',
    title: 'Veg Table Bowl',
    description:
      'A plant-forward table bowl with rajma, channa, rice, fresh toppings, and salsa — designed for easy sharing.',
    serves: 'Serves 4-5 people',
    caloriesRange: 'approximately 1400-1900 cal',
    proteinRange: 'approximately 60-90g',
    image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=720&q=80&auto=format&fit=crop',
    basePrice: 599,
    defaultSelections: {
      base: ['light-rice', 'power-rice'],
      protein: ['rajma', 'channa'],
      toppings: ['onion', 'cucumber', 'lettuce', 'sauteed-veggies'],
      sauce: ['fresh-salsa', 'tomato-green-chilli-salsa'],
      extras: [],
    },
  },
  {
    type: 'both',
    title: 'Power Table Bowl',
    description:
      'All four proteins — Rajma, Channa, Classic and Spicy Chicken — with all bases, toppings, and salsas across the table.',
    serves: 'Serves 4-5 people',
    caloriesRange: 'approximately 2000-2700 cal',
    proteinRange: 'approximately 120-155g',
    image: 'https://images.unsplash.com/photo-1498837167922-ddd27525d352?w=720&q=80&auto=format&fit=crop',
    basePrice: 799,
    defaultSelections: {
      base: ['light-rice', 'power-rice'],
      protein: ['rajma', 'channa', 'classic-chicken', 'spicy-chicken'],
      toppings: ['onion', 'cucumber', 'lettuce', 'sauteed-veggies'],
      sauce: ['fresh-salsa', 'roasted-chilli-corn-salsa', 'tomato-green-chilli-salsa', 'tomato-red-chilli-salsa'],
      extras: [],
    },
  },
];

export const TABLE_BUILD_OPTIONS_BY_TYPE: Record<TableBuildType, TableBuildOption> = {
  chicken: TABLE_BUILD_OPTIONS[0],
  veg: TABLE_BUILD_OPTIONS[1],
  both: TABLE_BUILD_OPTIONS[2],
};

export const TABLE_BUILD_DISPLAY_ORDER: TableBuildType[] = ['chicken', 'veg', 'both'];
