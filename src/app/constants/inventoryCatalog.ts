export type InventoryCategory = 'rice' | 'proteins' | 'veggies' | 'breakfast' | 'drinks' | 'packaging';

export type InventoryUnit = 'kg' | 'trays' | 'bags' | 'boxes' | 'bottles' | 'pcs' | 'cases' | 'packs';

export interface InventoryCatalogItem {
  id: string;
  displayName: string;
  category: InventoryCategory;
  unit: InventoryUnit;
  threshold: number;
}

export const INVENTORY_MASTER_LIST: InventoryCatalogItem[] = [
  { id: 'white_basmati_rice', displayName: 'White Basmati Rice', category: 'rice', unit: 'kg', threshold: 5 },
  { id: 'brown_rice', displayName: 'Brown Rice', category: 'rice', unit: 'kg', threshold: 3 },

  { id: 'classic_chicken', displayName: 'Classic Chicken', category: 'proteins', unit: 'kg', threshold: 3 },
  { id: 'spicy_chicken', displayName: 'Spicy Chicken', category: 'proteins', unit: 'kg', threshold: 3 },
  { id: 'rajma', displayName: 'Rajma', category: 'proteins', unit: 'kg', threshold: 2 },
  { id: 'channa', displayName: 'Channa', category: 'proteins', unit: 'kg', threshold: 2 },
  { id: 'eggs', displayName: 'Eggs', category: 'proteins', unit: 'trays', threshold: 2 },
  { id: 'cheese', displayName: 'Cheese', category: 'proteins', unit: 'bags', threshold: 2 },

  { id: 'onion', displayName: 'Onion', category: 'veggies', unit: 'bags', threshold: 2 },
  { id: 'cucumber', displayName: 'Cucumber', category: 'veggies', unit: 'bags', threshold: 2 },
  { id: 'lettuce', displayName: 'Lettuce', category: 'veggies', unit: 'bags', threshold: 2 },
  { id: 'capsicum', displayName: 'Capsicum', category: 'veggies', unit: 'bags', threshold: 2 },
  { id: 'green_cabbage', displayName: 'Green Cabbage', category: 'veggies', unit: 'bags', threshold: 2 },
  { id: 'red_cabbage', displayName: 'Red Cabbage', category: 'veggies', unit: 'bags', threshold: 2 },
  { id: 'carrots', displayName: 'Carrots', category: 'veggies', unit: 'bags', threshold: 2 },
  { id: 'tomato', displayName: 'Tomato', category: 'veggies', unit: 'bags', threshold: 2 },
  { id: 'lemon', displayName: 'Lemon', category: 'veggies', unit: 'bags', threshold: 2 },
  { id: 'sweet_corn', displayName: 'Sweet Corn', category: 'veggies', unit: 'bags', threshold: 2 },
  { id: 'small_chilli', displayName: 'Small Chilli', category: 'veggies', unit: 'bags', threshold: 1 },
  { id: 'big_chilli', displayName: 'Big Chilli', category: 'veggies', unit: 'bags', threshold: 1 },
  { id: 'dried_red_chilli', displayName: 'Dried Red Chilli', category: 'veggies', unit: 'bags', threshold: 1 },
  { id: 'avocado', displayName: 'Avocado', category: 'veggies', unit: 'bags', threshold: 2 },
  { id: 'ginger', displayName: 'Ginger', category: 'veggies', unit: 'bags', threshold: 1 },

  { id: 'yogurt', displayName: 'Yogurt', category: 'breakfast', unit: 'boxes', threshold: 2 },
  { id: 'chia_seeds', displayName: 'Chia Seeds', category: 'breakfast', unit: 'bags', threshold: 1 },
  { id: 'banana', displayName: 'Banana', category: 'breakfast', unit: 'boxes', threshold: 1 },
  { id: 'apple', displayName: 'Apple', category: 'breakfast', unit: 'bags', threshold: 1 },
  { id: 'mixed_berries', displayName: 'Mixed Berries', category: 'breakfast', unit: 'bags', threshold: 1 },
  { id: 'mango', displayName: 'Mango', category: 'breakfast', unit: 'bags', threshold: 1 },
  { id: 'granola', displayName: 'Granola', category: 'breakfast', unit: 'bags', threshold: 1 },
  { id: 'honey', displayName: 'Honey', category: 'breakfast', unit: 'bottles', threshold: 2 },
  { id: 'watermelon', displayName: 'Watermelon', category: 'breakfast', unit: 'pcs', threshold: 2 },

  { id: 'water_bottles', displayName: 'Water Bottles', category: 'drinks', unit: 'cases', threshold: 2 },
  { id: 'coke', displayName: 'Coke', category: 'drinks', unit: 'cases', threshold: 2 },

  { id: 'regular_bowl', displayName: 'Regular Bowl', category: 'packaging', unit: 'pcs', threshold: 50 },
  { id: 'regular_bowl_lid', displayName: 'Regular Bowl Lid', category: 'packaging', unit: 'pcs', threshold: 50 },
  { id: 'breakfast_bowl', displayName: 'Breakfast Bowl', category: 'packaging', unit: 'pcs', threshold: 40 },
  { id: 'breakfast_bowl_lid', displayName: 'Breakfast Bowl Lid', category: 'packaging', unit: 'pcs', threshold: 40 },
  { id: 'paper_cup', displayName: 'Paper Cup', category: 'packaging', unit: 'pcs', threshold: 50 },
  { id: 'paper_cup_lid', displayName: 'Paper Cup Lid', category: 'packaging', unit: 'pcs', threshold: 50 },
  { id: 'spoon', displayName: 'Spoon', category: 'packaging', unit: 'pcs', threshold: 100 },
  { id: 'paper_bag', displayName: 'Paper Bag', category: 'packaging', unit: 'pcs', threshold: 50 },
  { id: 'tissue_pack', displayName: 'Tissue Pack', category: 'packaging', unit: 'packs', threshold: 20 },
];
