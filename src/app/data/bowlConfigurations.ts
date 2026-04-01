import type { TableBuildType } from './buildYourOwnTableData';
import { BREAKFAST_PRESET_META_BY_ID } from './menuData';

export type BowlMode = 'signature' | 'salad' | 'table' | 'breakfast' | 'generic';
export type ProteinBlend = 'veg' | 'chicken' | 'power';

export const VEG_PROTEIN_IDS = ['rajma', 'channa'] as const;
export const CHICKEN_PROTEIN_IDS = ['classic-chicken', 'spicy-chicken'] as const;

export const VEG_PROTEIN_SET = new Set<string>(VEG_PROTEIN_IDS);
export const CHICKEN_PROTEIN_SET = new Set<string>(CHICKEN_PROTEIN_IDS);

export const SIGNATURE_BASE_PRICE_BY_BLEND = {
  veg: 169,
  chicken: 189,
  power: 199,
} as const;

export interface PresetConfig {
  itemId?: string;
  title: string;
  basePrice: number;
  categoryName: string;
  mode: BowlMode;
  hideBaseStep?: boolean;
  allowedProteinIds?: string[];
  defaultSelections: Record<string, string[]>;
}

export const TABLE_BUILD_TYPE_BY_ITEM_ID: Record<string, TableBuildType> = {
  'veg-table-bowl': 'veg',
  'chicken-table-bowl': 'chicken',
  'power-table-bowl': 'both',
};

export const SIGNATURE_PRESETS: Record<string, PresetConfig> = {
  'everyday-veg-bowl': {
    title: 'Everyday Veg Bowl',
    basePrice: 169,
    categoryName: 'Signature Bowls',
    mode: 'signature',
    allowedProteinIds: [...VEG_PROTEIN_IDS],
    defaultSelections: {
      base: ['light-rice'],
      protein: ['rajma'],
      toppings: ['onion', 'cucumber'],
      sauce: ['fresh-salsa'],
      extras: [],
    },
  },
  'everyday-chicken-bowl': {
    title: 'Everyday Chicken Bowl',
    basePrice: 189,
    categoryName: 'Signature Bowls',
    mode: 'signature',
    allowedProteinIds: [...CHICKEN_PROTEIN_IDS],
    defaultSelections: {
      base: ['light-rice'],
      protein: ['classic-chicken'],
      toppings: ['onion', 'cucumber'],
      sauce: ['fresh-salsa'],
      extras: [],
    },
  },
  'everyday-power-bowl': {
    title: 'Everyday Power Bowl',
    basePrice: 199,
    categoryName: 'Signature Bowls',
    mode: 'signature',
    allowedProteinIds: [...VEG_PROTEIN_IDS, ...CHICKEN_PROTEIN_IDS],
    defaultSelections: {
      base: ['light-rice'],
      protein: ['classic-chicken', 'rajma'],
      toppings: ['lettuce'],
      sauce: ['tomato-green-chilli-salsa'],
      extras: [],
    },
  },
};

export const SALAD_PRESETS: Record<string, PresetConfig> = {
  'veg-salad-bowl': {
    title: 'Veg Salad Bowl',
    basePrice: 169,
    categoryName: 'Salad Bowls',
    mode: 'salad',
    hideBaseStep: true,
    allowedProteinIds: [...VEG_PROTEIN_IDS],
    defaultSelections: {
      base: [],
      protein: ['rajma'],
      toppings: ['onion', 'cucumber', 'lettuce'],
      sauce: ['fresh-salsa'],
      extras: [],
    },
  },
  'chicken-salad-bowl': {
    title: 'Chicken Salad Bowl',
    basePrice: 189,
    categoryName: 'Salad Bowls',
    mode: 'salad',
    hideBaseStep: true,
    allowedProteinIds: [...CHICKEN_PROTEIN_IDS],
    defaultSelections: {
      base: [],
      protein: ['classic-chicken'],
      toppings: ['lettuce', 'cucumber'],
      sauce: ['fresh-salsa'],
      extras: [],
    },
  },
  'power-salad-bowl': {
    title: 'Power Salad Bowl',
    basePrice: 199,
    categoryName: 'Salad Bowls',
    mode: 'salad',
    hideBaseStep: true,
    allowedProteinIds: [...VEG_PROTEIN_IDS, ...CHICKEN_PROTEIN_IDS],
    defaultSelections: {
      base: [],
      protein: ['classic-chicken', 'rajma'],
      toppings: ['lettuce', 'shredded-red-cabbage'],
      sauce: ['tomato-green-chilli-salsa'],
      extras: [],
    },
  },
};

export const BREAKFAST_PRESETS: Record<string, PresetConfig> = Object.fromEntries(
  Object.values(BREAKFAST_PRESET_META_BY_ID).map((item) => [
    item.itemId,
    {
      itemId: item.itemId,
      title: item.title,
      basePrice: item.basePrice,
      categoryName: 'Breakfast Bowls',
      mode: 'breakfast',
      defaultSelections: {
        fruits: item.defaultFruitIds,
        crunch: item.hasGranolaByDefault ? ['granola'] : [],
        'add-ons': [],
      },
    } satisfies PresetConfig,
  ]),
);

export const PRESETS_BY_ITEM_ID: Record<string, PresetConfig> = {
  ...SIGNATURE_PRESETS,
  ...SALAD_PRESETS,
  ...BREAKFAST_PRESETS,
};

export function resolveProteinBlend(proteinIds: string[]): ProteinBlend | null {
  if (!proteinIds.length) return null;
  const hasVeg = proteinIds.some((id) => VEG_PROTEIN_SET.has(id));
  const hasChicken = proteinIds.some((id) => CHICKEN_PROTEIN_SET.has(id));

  if (hasVeg && hasChicken) return 'power';
  if (hasVeg) return 'veg';
  if (hasChicken) return 'chicken';
  return null;
}

type MenuShape = {
  slug: string;
  name: string;
  items: Array<{ id: string; name: string; price: number }>;
};

type BreakfastMetaShape = Record<string, {
  itemId: string;
  title: string;
  basePrice: number;
  defaultFruitIds: string[];
  hasGranolaByDefault: boolean;
}>;

export function syncPresetCatalogFromMenu(
  menuCategories: MenuShape[],
  breakfastMetaById: BreakfastMetaShape,
) {
  const itemById = Object.fromEntries(
    menuCategories.flatMap((category) => category.items.map((item) => [item.id, item])),
  ) as Record<string, { id: string; name: string; price: number }>;

  const syncPreset = (preset: PresetConfig, itemId: string) => {
    const item = itemById[itemId];
    if (!item) return;
    preset.title = item.name;
    preset.basePrice = item.price;
  };

  syncPreset(SIGNATURE_PRESETS['everyday-veg-bowl'], 'everyday-veg-bowl');
  syncPreset(SIGNATURE_PRESETS['everyday-chicken-bowl'], 'everyday-chicken-bowl');
  syncPreset(SIGNATURE_PRESETS['everyday-power-bowl'], 'everyday-power-bowl');

  syncPreset(SALAD_PRESETS['veg-salad-bowl'], 'veg-salad-bowl');
  syncPreset(SALAD_PRESETS['chicken-salad-bowl'], 'chicken-salad-bowl');
  syncPreset(SALAD_PRESETS['power-salad-bowl'], 'power-salad-bowl');

  (SIGNATURE_BASE_PRICE_BY_BLEND as unknown as Record<string, number>).veg = SIGNATURE_PRESETS['everyday-veg-bowl'].basePrice;
  (SIGNATURE_BASE_PRICE_BY_BLEND as unknown as Record<string, number>).chicken = SIGNATURE_PRESETS['everyday-chicken-bowl'].basePrice;
  (SIGNATURE_BASE_PRICE_BY_BLEND as unknown as Record<string, number>).power = SIGNATURE_PRESETS['everyday-power-bowl'].basePrice;

  for (const key of Object.keys(BREAKFAST_PRESETS)) {
    delete BREAKFAST_PRESETS[key];
  }

  for (const item of Object.values(breakfastMetaById)) {
    BREAKFAST_PRESETS[item.itemId] = {
      itemId: item.itemId,
      title: item.title,
      basePrice: item.basePrice,
      categoryName: 'Breakfast Bowls',
      mode: 'breakfast',
      defaultSelections: {
        fruits: [...item.defaultFruitIds],
        crunch: item.hasGranolaByDefault ? ['granola'] : [],
        'add-ons': [],
      },
    };
  }

  for (const key of Object.keys(PRESETS_BY_ITEM_ID)) {
    delete PRESETS_BY_ITEM_ID[key];
  }

  Object.assign(PRESETS_BY_ITEM_ID, SIGNATURE_PRESETS, SALAD_PRESETS, BREAKFAST_PRESETS);
}
