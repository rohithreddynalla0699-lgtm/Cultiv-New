// menuRepository.ts — Supabase-backed menu fetch for runtime hydration.

// @ts-ignore - Supabase client is defined in JS module.
import { isSupabaseConfigured, supabase } from '../../lib/supabase';

export interface MenuItemRow {
  menu_item_id: string;
  category_slug: string;
  subcategory_slug: string | null;
  name: string;
  description: string | null;
  base_price: number;
  is_available: boolean;
  sort_order: number;
  image_url: string | null;
  calories: number | null;
  protein_grams: number | null;
  badge: string | null;
  updated_at: string | null;
}

export interface OptionGroupRow {
  option_group_id: string;
  name: string;
  selection_type: 'single' | 'multiple';
  is_required: boolean;
  min_select: number;
  max_select: number | null;
  sort_order: number;
}

export interface OptionItemRow {
  option_item_id: string;
  option_group_id: string;
  name: string;
  price_modifier: number;
  is_available: boolean;
  sort_order: number;
}

export interface ItemOptionGroupMapRow {
  menu_item_id: string;
  option_group_id: string;
  sort_order: number;
}

export interface MenuRepositoryPayload {
  menuItems: MenuItemRow[];
  optionGroups: OptionGroupRow[];
  optionItems: OptionItemRow[];
  itemOptionGroupMap: ItemOptionGroupMapRow[];
}

type RawRow = Record<string, unknown>;

const asString = (value: unknown): string => (typeof value === 'string' ? value : '');
const asNullableString = (value: unknown): string | null => (typeof value === 'string' ? value : null);
const asNumber = (value: unknown, fallback = 0): number => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const asNullableNumber = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};
const asBoolean = (value: unknown, fallback = false): boolean => (typeof value === 'boolean' ? value : fallback);

function pickString(row: RawRow, candidates: string[]): string {
  for (const key of candidates) {
    const value = row[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }
  }
  return '';
}

function normalizeMenuItemRow(row: RawRow): MenuItemRow | null {
  const menuItemId = pickString(row, ['menu_item_id', 'id']);
  if (!menuItemId) return null;

  return {
    menu_item_id: menuItemId,
    category_slug: asString(row.category_slug),
    subcategory_slug: asNullableString(row.subcategory_slug),
    name: asString(row.name),
    description: asNullableString(row.description),
    base_price: asNumber(row.base_price),
    is_available: asBoolean(row.is_available, true),
    sort_order: asNumber(row.sort_order),
    image_url: asNullableString(row.image_url),
    calories: asNullableNumber(row.calories),
    protein_grams: asNullableNumber(row.protein_grams),
    badge: asNullableString(row.badge),
    updated_at: asNullableString(row.updated_at),
  };
}

function normalizeOptionGroupRow(row: RawRow): OptionGroupRow | null {
  const optionGroupId = pickString(row, ['option_group_id', 'id']);
  if (!optionGroupId) return null;

  return {
    option_group_id: optionGroupId,
    name: asString(row.name),
    selection_type: asString(row.selection_type) === 'multiple' ? 'multiple' : 'single',
    is_required: asBoolean(row.is_required, false),
    min_select: asNumber(row.min_select),
    max_select: asNullableNumber(row.max_select),
    sort_order: asNumber(row.sort_order),
  };
}

function normalizeOptionItemRow(row: RawRow): OptionItemRow | null {
  const optionItemId = pickString(row, ['option_item_id', 'id']);
  const optionGroupId = pickString(row, ['option_group_id', 'group_id']);
  if (!optionItemId || !optionGroupId) return null;

  return {
    option_item_id: optionItemId,
    option_group_id: optionGroupId,
    name: asString(row.name),
    price_modifier: asNumber(row.price_modifier),
    is_available: asBoolean(row.is_available, true),
    sort_order: asNumber(row.sort_order),
  };
}

function normalizeItemOptionGroupMapRow(row: RawRow): ItemOptionGroupMapRow | null {
  const menuItemId = pickString(row, ['menu_item_id', 'item_id']);
  const optionGroupId = pickString(row, ['option_group_id', 'group_id']);
  if (!menuItemId || !optionGroupId) return null;

  return {
    menu_item_id: menuItemId,
    option_group_id: optionGroupId,
    sort_order: asNumber(row.sort_order),
  };
}

export async function fetchMenuRepositoryPayload(): Promise<MenuRepositoryPayload> {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local and restart the app.');
  }

  const [
    menuItemsResult,
    optionGroupsResult,
    optionItemsResult,
    itemOptionGroupMapResult,
  ] = await Promise.all([
    supabase
      .from('menu_items')
      .select('*')
      .eq('is_available', true)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true }),
    supabase
      .from('option_groups')
      .select('*')
      .order('sort_order', { ascending: true }),
    supabase
      .from('option_items')
      .select('*')
      .eq('is_available', true)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true }),
    supabase
      .from('item_option_group_map')
      .select('*')
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

  const menuItems = ((menuItemsResult.data ?? []) as RawRow[])
    .map(normalizeMenuItemRow)
    .filter((row): row is MenuItemRow => row !== null);

  const optionGroups = ((optionGroupsResult.data ?? []) as RawRow[])
    .map(normalizeOptionGroupRow)
    .filter((row): row is OptionGroupRow => row !== null);

  const optionItems = ((optionItemsResult.data ?? []) as RawRow[])
    .map(normalizeOptionItemRow)
    .filter((row): row is OptionItemRow => row !== null);

  const itemOptionGroupMap = ((itemOptionGroupMapResult.data ?? []) as RawRow[])
    .map(normalizeItemOptionGroupMapRow)
    .filter((row): row is ItemOptionGroupMapRow => row !== null);

  return {
    menuItems,
    optionGroups,
    optionItems,
    itemOptionGroupMap,
  };
}
