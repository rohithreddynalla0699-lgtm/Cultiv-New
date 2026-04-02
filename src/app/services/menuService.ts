import { MENU_CATEGORIES, type MenuCategoryData } from '../data/menuData';

const MENU_STORAGE_KEY = 'cultiv_operations_menu_v1';

export interface OperationsMenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  calories: number;
  protein: number;
  image: string;
  badge?: string;
  categorySlug: string;
  categoryName: string;
  isActive: boolean;
  hasAddons: boolean;
  isCustom: boolean;
}

export interface CreateMenuItemInput {
  name: string;
  description: string;
  price: number;
  categorySlug: string;
  image?: string;
  calories?: number;
  protein?: number;
  hasAddons?: boolean;
}

export interface UpdateMenuItemInput {
  name?: string;
  description?: string;
  price?: number;
  categorySlug?: string;
  isActive?: boolean;
  hasAddons?: boolean;
}

const toOperationsSeed = (): OperationsMenuItem[] => (
  MENU_CATEGORIES.flatMap((category) => category.items.map((item) => ({
    id: item.id,
    name: item.name,
    description: item.description,
    price: item.price,
    calories: item.calories,
    protein: item.protein,
    image: item.image,
    badge: item.badge,
    categorySlug: category.slug,
    categoryName: category.name,
    isActive: true,
    hasAddons: true,
    isCustom: false,
  })))
);

const readMenuState = (): OperationsMenuItem[] => {
  try {
    const raw = localStorage.getItem(MENU_STORAGE_KEY);
    if (!raw) {
      const seed = toOperationsSeed();
      localStorage.setItem(MENU_STORAGE_KEY, JSON.stringify(seed));
      return seed;
    }
    const parsed = JSON.parse(raw) as OperationsMenuItem[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      const seed = toOperationsSeed();
      localStorage.setItem(MENU_STORAGE_KEY, JSON.stringify(seed));
      return seed;
    }
    return parsed;
  } catch {
    const seed = toOperationsSeed();
    localStorage.setItem(MENU_STORAGE_KEY, JSON.stringify(seed));
    return seed;
  }
};

const writeMenuState = (items: OperationsMenuItem[]) => {
  localStorage.setItem(MENU_STORAGE_KEY, JSON.stringify(items));
};

const buildMenuCatalog = (items: OperationsMenuItem[]): MenuCategoryData[] => {
  const categoryMeta = new Map(MENU_CATEGORIES.map((entry) => [entry.slug, entry]));

  const grouped = items
    .filter((item) => item.isActive)
    .reduce<Record<string, OperationsMenuItem[]>>((acc, item) => {
      acc[item.categorySlug] = acc[item.categorySlug] ?? [];
      acc[item.categorySlug].push(item);
      return acc;
    }, {});

  return Object.entries(grouped).map(([slug, categoryItems]) => {
    const seedCategory = categoryMeta.get(slug);
    return {
      slug,
      name: seedCategory?.name ?? categoryItems[0]?.categoryName ?? slug,
      description: seedCategory?.description ?? 'Operations managed category',
      image: seedCategory?.image ?? categoryItems[0]?.image ?? 'https://images.unsplash.com/photo-1498837167922-ddd27525d352?w=1080',
      items: categoryItems.map((item) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        calories: item.calories,
        protein: item.protein,
        price: item.price,
        image: item.image,
        badge: item.badge,
      })),
    };
  });
};

export const menuService = {
  async getMenuByStore(_storeId: string) {
    return buildMenuCatalog(readMenuState());
  },

  getAllMenuItemsForOperations() {
    return readMenuState();
  },

  createMenuItem(input: CreateMenuItemInput) {
    if (!input.name.trim()) return { success: false, message: 'Menu item name is required.' };
    if (!input.categorySlug.trim()) return { success: false, message: 'Category is required.' };
    if (!Number.isFinite(input.price) || input.price < 0) return { success: false, message: 'Price must be valid.' };

    const items = readMenuState();
    const next: OperationsMenuItem = {
      id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: input.name.trim(),
      description: input.description.trim(),
      price: Number(input.price),
      calories: Math.max(0, Number(input.calories ?? 0)),
      protein: Math.max(0, Number(input.protein ?? 0)),
      image: input.image?.trim() || 'https://images.unsplash.com/photo-1498837167922-ddd27525d352?w=1080',
      categorySlug: input.categorySlug,
      categoryName: MENU_CATEGORIES.find((entry) => entry.slug === input.categorySlug)?.name ?? input.categorySlug,
      isActive: true,
      hasAddons: Boolean(input.hasAddons),
      isCustom: true,
    };

    const updated = [next, ...items];
    writeMenuState(updated);
    return { success: true, message: 'Menu item created.' };
  },

  updateMenuItem(itemId: string, updates: UpdateMenuItemInput) {
    const items = readMenuState();
    const exists = items.some((item) => item.id === itemId);
    if (!exists) return { success: false, message: 'Menu item not found.' };

    const updated = items.map((item) => {
      if (item.id !== itemId) return item;
      const categorySlug = updates.categorySlug ?? item.categorySlug;
      return {
        ...item,
        name: updates.name?.trim() ?? item.name,
        description: updates.description?.trim() ?? item.description,
        price: updates.price != null ? Math.max(0, Number(updates.price)) : item.price,
        categorySlug,
        categoryName: MENU_CATEGORIES.find((entry) => entry.slug === categorySlug)?.name ?? item.categoryName,
        isActive: updates.isActive ?? item.isActive,
        hasAddons: updates.hasAddons ?? item.hasAddons,
      };
    });

    writeMenuState(updated);
    return { success: true, message: 'Menu item updated.' };
  },

  deleteMenuItem(itemId: string) {
    const items = readMenuState();
    const updated = items.filter((item) => item.id !== itemId);
    if (updated.length === items.length) {
      return { success: false, message: 'Menu item not found.' };
    }
    writeMenuState(updated);
    return { success: true, message: 'Menu item deleted.' };
  },
};
