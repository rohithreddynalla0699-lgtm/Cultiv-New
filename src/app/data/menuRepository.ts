// menuRepository.ts — Supabase-backed menu fetch for runtime hydration.

// @ts-ignore - Supabase client is defined in JS module.
import { supabase } from '../../lib/supabase';

export interface MenuItemRow {
  id: string;
  category_slug: string;
  subcategory_slug: string | null;
  name: string;
  base_price: number;
  is_available: boolean;
  sort_order: number;
}

export interface OptionGroupRow {
  id: string;
  name: string;
  selection_type: 'single' | 'multiple';
  is_required: boolean;
  min_select: number;
  max_select: number | null;
  sort_order: number;
}

export interface OptionItemRow {
  id: string;
  group_id: string;
  name: string;
  price_modifier: number;
  is_available: boolean;
  sort_order: number;
}

export interface ItemOptionGroupMapRow {
  item_id: string;
  group_id: string;
  sort_order: number;
}

export interface MenuRepositoryPayload {
  menuItems: MenuItemRow[];
  optionGroups: OptionGroupRow[];
  optionItems: OptionItemRow[];
  itemOptionGroupMap: ItemOptionGroupMapRow[];
}

export async function fetchMenuRepositoryPayload(): Promise<MenuRepositoryPayload> {
  const [
    menuItemsResult,
    optionGroupsResult,
    optionItemsResult,
    itemOptionGroupMapResult,
  ] = await Promise.all([
    supabase
      .from('menu_items')
      .select('id, category_slug, subcategory_slug, name, base_price, is_available, sort_order')
      .eq('is_available', true)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true }),
    supabase
      .from('option_groups')
      .select('id, name, selection_type, is_required, min_select, max_select, sort_order')
      .order('sort_order', { ascending: true }),
    supabase
      .from('option_items')
      .select('id, group_id, name, price_modifier, is_available, sort_order')
      .eq('is_available', true)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true }),
    supabase
      .from('item_option_group_map')
      .select('item_id, group_id, sort_order')
      .order('sort_order', { ascending: true }),
  ]);

  if (menuItemsResult.error) {
    throw new Error(`Failed to fetch menu_items: ${menuItemsResult.error.message}`);
  }
  if (optionGroupsResult.error) {
    throw new Error(`Failed to fetch option_groups: ${optionGroupsResult.error.message}`);
  }
  if (optionItemsResult.error) {
    throw new Error(`Failed to fetch option_items: ${optionItemsResult.error.message}`);
  }
  if (itemOptionGroupMapResult.error) {
    throw new Error(`Failed to fetch item_option_group_map: ${itemOptionGroupMapResult.error.message}`);
  }

  return {
    menuItems: (menuItemsResult.data ?? []) as MenuItemRow[],
    optionGroups: (optionGroupsResult.data ?? []) as OptionGroupRow[],
    optionItems: (optionItemsResult.data ?? []) as OptionItemRow[],
    itemOptionGroupMap: (itemOptionGroupMapResult.data ?? []) as ItemOptionGroupMapRow[],
  };
}
