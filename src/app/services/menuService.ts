import { MENU_CATEGORIES, hydrateMenuCatalogFromSupabase, type MenuCategoryData } from '../data/menuData';
import {
  deleteInternalMenuItem,
  loadInternalMenuDashboard,
  setInternalMenuItemAvailability,
  upsertInternalMenuItem,
  type InternalMenuDashboardItem,
  type InternalMenuOptionGroup,
} from '../lib/internalOpsApi';
import type { InternalAccessSession } from '../types/admin';

const LEGACY_MENU_STORAGE_KEY = 'cultiv_operations_menu_v1';
export const MENU_UPDATED_EVENT = 'cultiv:menu-updated';

export interface OperationsMenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  calories: number | null;
  protein: number | null;
  image: string;
  badge?: string | null;
  categorySlug: string;
  subcategorySlug: string | null;
  categoryName: string;
  isActive: boolean;
  sortOrder: number;
  optionGroupIds: string[];
  optionGroupCount: number;
}

export interface OperationsOptionGroup {
  id: string;
  name: string;
  selectionType: 'single' | 'multiple';
  isRequired: boolean;
  minSelect: number;
  maxSelect: number | null;
  sortOrder: number;
}

export interface MenuManagementDashboard {
  items: OperationsMenuItem[];
  optionGroups: OperationsOptionGroup[];
}

export interface SaveMenuItemInput {
  menuItemId?: string;
  name: string;
  description?: string | null;
  categorySlug: string;
  subcategorySlug?: string | null;
  price: number;
  isActive?: boolean;
  sortOrder?: number | null;
  imageUrl?: string | null;
  calories?: number | null;
  protein?: number | null;
  badge?: string | null;
  optionGroupIds?: string[];
}

const inBrowser = () => typeof window !== 'undefined' && typeof localStorage !== 'undefined';

export const clearLegacyMenuCache = () => {
  if (!inBrowser()) return;
  localStorage.removeItem(LEGACY_MENU_STORAGE_KEY);
};

const notifyMenuUpdated = () => {
  if (!inBrowser()) return;
  window.dispatchEvent(new CustomEvent(MENU_UPDATED_EVENT));
};

const humanizeSlug = (value: string) => value
  .replace(/[-_]+/g, ' ')
  .replace(/\b\w/g, (letter) => letter.toUpperCase());

const getFallbackCategoryName = (categorySlug: string) =>
  MENU_CATEGORIES.find((category) => category.slug === categorySlug)?.name ?? humanizeSlug(categorySlug);

const getFallbackItemMeta = (itemId: string) => (
  MENU_CATEGORIES
    .flatMap((category) => category.items)
    .find((item) => item.id === itemId)
);

const mapOperationsMenuItem = (item: InternalMenuDashboardItem): OperationsMenuItem => {
  const fallback = getFallbackItemMeta(item.menuItemId);

  return {
    id: item.menuItemId,
    name: item.name,
    description: item.description ?? fallback?.description ?? '',
    price: item.basePrice,
    calories: item.calories ?? fallback?.calories ?? null,
    protein: item.proteinGrams ?? fallback?.protein ?? null,
    image: item.imageUrl ?? fallback?.image ?? 'https://images.unsplash.com/photo-1498837167922-ddd27525d352?w=1080',
    badge: item.badge ?? fallback?.badge ?? null,
    categorySlug: item.categorySlug,
    subcategorySlug: item.subcategorySlug ?? null,
    categoryName: getFallbackCategoryName(item.categorySlug),
    isActive: item.isAvailable,
    sortOrder: item.sortOrder,
    optionGroupIds: [...item.optionGroupIds],
    optionGroupCount: item.optionGroupCount,
  };
};

const mapOptionGroup = (group: InternalMenuOptionGroup): OperationsOptionGroup => ({
  id: group.id,
  name: group.name,
  selectionType: group.selectionType,
  isRequired: group.isRequired,
  minSelect: group.minSelect,
  maxSelect: group.maxSelect,
  sortOrder: group.sortOrder,
});

const sessionPayload = (session: InternalAccessSession) => ({
  internalSessionToken: session.internalSessionToken,
  roleKey: session.roleKey,
  scopeType: session.scopeType === 'store' ? 'store' : 'global',
  scopeStoreId: session.scopeStoreId,
});

const refreshSharedMenuCatalog = async (shouldNotify = false) => {
  clearLegacyMenuCache();
  await hydrateMenuCatalogFromSupabase();
  if (shouldNotify) {
    notifyMenuUpdated();
  }
};

export const menuService = {
  async getMenuByStore(_storeId: string): Promise<MenuCategoryData[]> {
    await refreshSharedMenuCatalog(false);
    return MENU_CATEGORIES;
  },

  async getAllMenuItemsForOperations(session: InternalAccessSession): Promise<MenuManagementDashboard> {
    clearLegacyMenuCache();

    const { data, error } = await loadInternalMenuDashboard({
      ...sessionPayload(session),
    });

    if (error || !data) {
      throw new Error(error ?? 'Could not load menu dashboard.');
    }

    return {
      items: data.items.map(mapOperationsMenuItem),
      optionGroups: data.optionGroups.map(mapOptionGroup),
    };
  },

  async saveMenuItem(session: InternalAccessSession, input: SaveMenuItemInput) {
    const { data, error } = await upsertInternalMenuItem({
      ...sessionPayload(session),
      menuItemId: input.menuItemId,
      name: input.name,
      description: input.description ?? null,
      categorySlug: input.categorySlug,
      subcategorySlug: input.subcategorySlug ?? null,
      basePrice: Number(input.price),
      isAvailable: input.isActive ?? true,
      sortOrder: input.sortOrder ?? undefined,
      imageUrl: input.imageUrl ?? null,
      calories: input.calories ?? null,
      proteinGrams: input.protein ?? null,
      badge: input.badge ?? null,
      optionGroupIds: input.optionGroupIds ?? [],
    });

    if (error || !data?.success) {
      return { success: false, message: error ?? 'Could not save menu item.' };
    }

    try {
      await refreshSharedMenuCatalog(true);
    } catch (refreshError) {
      console.error('Menu save succeeded, but shared catalog refresh failed.', refreshError);
    }

    return {
      success: true,
      message: data.mode === 'created' ? 'Menu item created.' : 'Menu item updated.',
    };
  },

  async setMenuItemAvailability(session: InternalAccessSession, menuItemId: string, isAvailable: boolean) {
    const { data, error } = await setInternalMenuItemAvailability({
      ...sessionPayload(session),
      menuItemId,
      isAvailable,
    });

    if (error || !data?.success) {
      return { success: false, message: error ?? 'Could not update menu item availability.' };
    }

    try {
      await refreshSharedMenuCatalog(true);
    } catch (refreshError) {
      console.error('Menu availability update succeeded, but shared catalog refresh failed.', refreshError);
    }

    return {
      success: true,
      message: isAvailable ? 'Menu item enabled.' : 'Menu item disabled.',
    };
  },

  async deleteMenuItem(session: InternalAccessSession, menuItemId: string) {
    const { data, error } = await deleteInternalMenuItem({
      ...sessionPayload(session),
      menuItemId,
    });

    if (error || !data?.success) {
      return { success: false, message: error ?? 'Could not remove menu item.' };
    }

    try {
      await refreshSharedMenuCatalog(true);
    } catch (refreshError) {
      console.error('Menu delete succeeded, but shared catalog refresh failed.', refreshError);
    }

    return {
      success: true,
      message: data.mode === 'soft_disabled'
        ? 'Menu item has order history, so it was safely disabled instead of deleted.'
        : 'Menu item deleted.',
    };
  },
};
