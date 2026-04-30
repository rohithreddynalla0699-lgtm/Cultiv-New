// @ts-nocheck

export const GST_RATE = 0.05;
export const MONEY_TOLERANCE = 0.01;

const normalizeToken = (value: unknown) => String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
const roundMoney = (value: unknown) => Number((Number(value ?? 0) + Number.EPSILON).toFixed(2));
const toNumber = (value: unknown) => Number(String(value ?? '').trim());

const sameMoney = (left: number, right: number) => Math.abs(roundMoney(left) - roundMoney(right)) <= MONEY_TOLERANCE;

const isNonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

const BREAKFAST_PRESET_FAMILIES: Array<{
  menu_item_id: string;
  family: 'chia-yogurt' | 'overnight-oats';
  fruit_mode: 'fixed' | 'selectable';
}> = [
  { menu_item_id: 'banana-chia-yogurt-bowl', family: 'chia-yogurt', fruit_mode: 'fixed' },
  { menu_item_id: 'apple-chia-yogurt-bowl', family: 'chia-yogurt', fruit_mode: 'fixed' },
  { menu_item_id: 'mango-chia-yogurt-bowl', family: 'chia-yogurt', fruit_mode: 'fixed' },
  { menu_item_id: 'berry-chia-yogurt-bowl', family: 'chia-yogurt', fruit_mode: 'fixed' },
  { menu_item_id: 'power-chia-yogurt-bowl', family: 'chia-yogurt', fruit_mode: 'selectable' },
  { menu_item_id: 'banana-overnight-oats', family: 'overnight-oats', fruit_mode: 'fixed' },
  { menu_item_id: 'apple-cinnamon-overnight-oats', family: 'overnight-oats', fruit_mode: 'fixed' },
  { menu_item_id: 'mango-overnight-oats', family: 'overnight-oats', fruit_mode: 'fixed' },
  { menu_item_id: 'berry-overnight-oats', family: 'overnight-oats', fruit_mode: 'fixed' },
  { menu_item_id: 'power-overnight-oats', family: 'overnight-oats', fruit_mode: 'selectable' },
];
const BREAKFAST_PRESET_BY_ID = new Map(BREAKFAST_PRESET_FAMILIES.map((entry) => [entry.menu_item_id, entry]));

const loadCanonicalCatalog = async (db: any, menuItemIds: string[]) => {
  const uniqueItemIds = Array.from(new Set(menuItemIds.filter((value) => isNonEmptyString(value)).map((value) => value.trim())));

  const [menuItemsResult, mapResult] = await Promise.all([
    db
      .from('menu_items')
      .select('menu_item_id, category_slug, name, base_price, is_available')
      .in('menu_item_id', uniqueItemIds),
    db
      .from('item_option_group_map')
      .select('menu_item_id, group_id, sort_order')
      .in('menu_item_id', uniqueItemIds),
  ]);

  if (menuItemsResult.error) {
    throw new Error(`Could not load canonical menu items: ${menuItemsResult.error.message}`);
  }

  if (mapResult.error) {
    throw new Error(`Could not load menu option mappings: ${mapResult.error.message}`);
  }

  const menuItems = menuItemsResult.data ?? [];
  const missingItemIds = uniqueItemIds.filter((itemId) => !menuItems.some((row: any) => row.menu_item_id === itemId));
  if (missingItemIds.length > 0) {
    throw new Error(`Menu items not found: ${missingItemIds.join(', ')}`);
  }

  const mappedGroupIds = Array.from(new Set((mapResult.data ?? []).map((row: any) => row.group_id).filter(Boolean)));

  const [groupsResult, optionsResult] = await Promise.all([
    mappedGroupIds.length > 0
      ? db
        .from('option_groups')
        .select('group_id, name, selection_type, is_required, min_select, max_select')
        .in('group_id', mappedGroupIds)
      : Promise.resolve({ data: [], error: null }),
    mappedGroupIds.length > 0
      ? db
        .from('option_items')
        .select('option_item_id, group_id, name, price_modifier, is_available')
        .in('group_id', mappedGroupIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (groupsResult.error) {
    throw new Error(`Could not load canonical option groups: ${groupsResult.error.message}`);
  }

  if (optionsResult.error) {
    throw new Error(`Could not load canonical option items: ${optionsResult.error.message}`);
  }

  const menuItemById = new Map(menuItems.map((row: any) => [row.menu_item_id, row]));
  const groupIdsByItemId = new Map<string, string[]>();
  for (const row of mapResult.data ?? []) {
    const existing = groupIdsByItemId.get(row.menu_item_id) ?? [];
    existing.push(row.group_id);
    groupIdsByItemId.set(row.menu_item_id, existing);
  }

  const groupById = new Map((groupsResult.data ?? []).map((row: any) => [row.group_id, row]));
  const optionsById = new Map((optionsResult.data ?? []).map((row: any) => [row.option_item_id, row]));
  const optionsByGroupId = new Map<string, any[]>();
  for (const row of optionsResult.data ?? []) {
    const existing = optionsByGroupId.get(row.group_id) ?? [];
    existing.push(row);
    optionsByGroupId.set(row.group_id, existing);
  }

  return {
    menuItemById,
    groupIdsByItemId,
    groupById,
    optionsById,
    optionsByGroupId,
  };
};

const resolveRewardLine = (line: any) => {
  const quantity = Number(line.quantity ?? 0);
  const unitPriceHint = roundMoney(line.unit_price ?? line.price ?? 0);
  const lineTotalHint = roundMoney(line.line_total ?? (unitPriceHint * quantity));

  if (!isNonEmptyString(line.item_name ?? line.title) || quantity <= 0) {
    throw new Error('Invalid reward line payload.');
  }

  if (!sameMoney(unitPriceHint, 0) || !sameMoney(lineTotalHint, 0)) {
    throw new Error('Reward lines must be zero-priced.');
  }

  return {
    menu_item_id: null,
    item_name: String(line.item_name ?? line.title).trim(),
    item_category: String(line.item_category ?? line.category ?? 'Rewards').trim() || 'Rewards',
    unit_price: 0,
    quantity,
    line_total: 0,
    selections: [],
  };
};

const resolveOptionByName = (options: any[], optionName: string) => {
  const normalizedOptionName = normalizeToken(optionName);
  return options.find((option) => normalizeToken(option.name) === normalizedOptionName) ?? null;
};

const canonicalizeSelectionsFromSnapshot = (
  line: any,
  allowedGroupIds: string[],
  groupById: Map<string, any>,
  optionsById: Map<string, any>,
  optionsByGroupId: Map<string, any[]>,
) => {
  const selectionRows = Array.isArray(line.selections) ? line.selections : [];
  const selectionsByGroupId = new Map<string, any[]>();

  for (const selectionRow of selectionRows) {
    if (!selectionRow || typeof selectionRow !== 'object') continue;

    const optionIdHint = isNonEmptyString(selectionRow.option_item_id) ? selectionRow.option_item_id.trim() : '';
    const groupIdHint = isNonEmptyString(selectionRow.group_id_snapshot) ? selectionRow.group_id_snapshot.trim() : '';
    const groupNameHint = isNonEmptyString(selectionRow.group_name_snapshot) ? selectionRow.group_name_snapshot.trim() : '';
    const optionNameHint = isNonEmptyString(selectionRow.option_name) ? selectionRow.option_name.trim() : '';

    let resolvedOption = optionIdHint ? optionsById.get(optionIdHint) ?? null : null;
    let resolvedGroupId = resolvedOption?.group_id ?? '';

    if ((!resolvedOption || !allowedGroupIds.includes(resolvedGroupId)) && groupIdHint && allowedGroupIds.includes(groupIdHint)) {
      const candidateOptions = optionsByGroupId.get(groupIdHint) ?? [];
      resolvedOption = optionNameHint ? resolveOptionByName(candidateOptions, optionNameHint) : null;
      resolvedGroupId = groupIdHint;
    }

    if ((!resolvedOption || !allowedGroupIds.includes(resolvedGroupId)) && groupNameHint) {
      const matchingGroupId = allowedGroupIds.find((groupId) => normalizeToken(groupById.get(groupId)?.name) === normalizeToken(groupNameHint));
      if (matchingGroupId) {
        const candidateOptions = optionsByGroupId.get(matchingGroupId) ?? [];
        resolvedOption = optionNameHint ? resolveOptionByName(candidateOptions, optionNameHint) : null;
        resolvedGroupId = matchingGroupId;
      }
    }

    if (!resolvedOption || !allowedGroupIds.includes(resolvedOption.group_id)) {
      throw new Error(`Invalid option selection "${optionNameHint || optionIdHint || 'unknown'}" for menu item.`);
    }

    if (resolvedOption.is_available === false) {
      throw new Error(`Selected option "${resolvedOption.name}" is unavailable.`);
    }

    const existing = selectionsByGroupId.get(resolvedOption.group_id) ?? [];
    if (!existing.some((entry) => entry.option_item_id === resolvedOption.option_item_id)) {
      existing.push({
        option_item_id: resolvedOption.option_item_id,
        group_id_snapshot: resolvedOption.group_id,
        group_name_snapshot: (groupById.get(resolvedOption.group_id)?.name ?? groupNameHint) || resolvedOption.group_id,
        option_name: resolvedOption.name,
        price_modifier: roundMoney(resolvedOption.price_modifier ?? 0),
      });
      selectionsByGroupId.set(resolvedOption.group_id, existing);
    }
  }

  return selectionsByGroupId;
};

const canonicalizeSelectionsFromSectionChoices = (
  line: any,
  allowedGroupIds: string[],
  groupById: Map<string, any>,
  optionsByGroupId: Map<string, any[]>,
) => {
  const selectionRows = Array.isArray(line.selections) ? line.selections : [];
  const selectionsByGroupId = new Map<string, any[]>();

  for (const selectionRow of selectionRows) {
    if (!selectionRow || typeof selectionRow !== 'object' || !isNonEmptyString(selectionRow.section)) {
      continue;
    }

    const matchingGroupId = allowedGroupIds.find((groupId) => normalizeToken(groupById.get(groupId)?.name) === normalizeToken(selectionRow.section));
    if (!matchingGroupId) {
      throw new Error(`Invalid selection group "${String(selectionRow.section)}" for menu item.`);
    }

    const choiceNames = Array.isArray(selectionRow.choices) ? selectionRow.choices : [];
    const resolvedSelections = selectionsByGroupId.get(matchingGroupId) ?? [];

    for (const choiceName of choiceNames) {
      if (!isNonEmptyString(choiceName)) continue;
      const resolvedOption = resolveOptionByName(optionsByGroupId.get(matchingGroupId) ?? [], choiceName);
      if (!resolvedOption) {
        throw new Error(`Invalid selection "${String(choiceName)}" for group "${String(selectionRow.section)}".`);
      }
      if (resolvedOption.is_available === false) {
        throw new Error(`Selected option "${resolvedOption.name}" is unavailable.`);
      }
      if (!resolvedSelections.some((entry) => entry.option_item_id === resolvedOption.option_item_id)) {
        resolvedSelections.push({
          option_item_id: resolvedOption.option_item_id,
          group_id_snapshot: matchingGroupId,
          group_name_snapshot: groupById.get(matchingGroupId)?.name ?? String(selectionRow.section).trim(),
          option_name: resolvedOption.name,
          price_modifier: roundMoney(resolvedOption.price_modifier ?? 0),
        });
      }
    }

    selectionsByGroupId.set(matchingGroupId, resolvedSelections);
  }

  return selectionsByGroupId;
};

const validateSelectionCounts = (
  allowedGroupIds: string[],
  groupById: Map<string, any>,
  selectionsByGroupId: Map<string, any[]>,
) => {
  for (const groupId of allowedGroupIds) {
    const group = groupById.get(groupId);
    if (!group) continue;

    const selectedCount = (selectionsByGroupId.get(groupId) ?? []).length;
    const minSelect = Number(group.min_select ?? 0);
    const maxSelect = group.max_select == null ? null : Number(group.max_select);

    if (selectedCount < minSelect) {
      throw new Error(`Selection group "${group.name}" requires at least ${minSelect} choice(s).`);
    }

    if (maxSelect !== null && selectedCount > maxSelect) {
      throw new Error(`Selection group "${group.name}" allows at most ${maxSelect} choice(s).`);
    }
  }
};

const validateBreakfastSelections = (menuItemId: string, selectionsByGroupId: Map<string, any[]>) => {
  const breakfastRule = BREAKFAST_PRESET_BY_ID.get(menuItemId);
  if (!breakfastRule) return;

  const fruitSelections = selectionsByGroupId.get('fruits') ?? [];
  if (breakfastRule.fruit_mode === 'fixed' && fruitSelections.length > 0) {
    throw new Error('This breakfast bowl has a fixed fruit and cannot accept fruit changes.');
  }
  if (breakfastRule.fruit_mode === 'selectable' && fruitSelections.length === 0) {
    throw new Error('Power breakfast bowls require at least one fruit selection.');
  }
};

export const canonicalizeOrderPricing = async (
  db: any,
  params: {
    items: any[];
    requestedSubtotal?: unknown;
    requestedDiscount?: unknown;
    requestedTaxAmount?: unknown;
    requestedTipAmount?: unknown;
    requestedTipPercentage?: unknown;
    requestedTotal?: unknown;
  },
) => {
  const items = Array.isArray(params.items) ? params.items : [];
  if (items.length === 0) {
    throw new Error('Order must include at least one item.');
  }

  const menuItemIds = items
    .map((line) => String(line.menu_item_id ?? line.itemId ?? '').trim())
    .filter((value) => value.length > 0);

  const catalog = await loadCanonicalCatalog(db, menuItemIds);
  const canonicalItems = [];

  for (const line of items) {
    const menuItemId = String(line.menu_item_id ?? line.itemId ?? '').trim();
    if (!menuItemId) {
      canonicalItems.push(resolveRewardLine(line));
      continue;
    }

    const menuItem = catalog.menuItemById.get(menuItemId);
    if (!menuItem) {
      throw new Error(`Menu item "${menuItemId}" was not found.`);
    }
    if (menuItem.is_available === false) {
      throw new Error(`Menu item "${menuItem.name}" is unavailable.`);
    }

    const quantity = Number(line.quantity ?? 0);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new Error(`Invalid quantity for menu item "${menuItem.name}".`);
    }

    const allowedGroupIds = catalog.groupIdsByItemId.get(menuItemId) ?? [];
    const selectionsByGroupId = Array.isArray(line.selections) && line.selections.some((selectionRow) => selectionRow && typeof selectionRow === 'object' && 'option_item_id' in selectionRow)
      ? canonicalizeSelectionsFromSnapshot(line, allowedGroupIds, catalog.groupById, catalog.optionsById, catalog.optionsByGroupId)
      : canonicalizeSelectionsFromSectionChoices(line, allowedGroupIds, catalog.groupById, catalog.optionsByGroupId);

    validateSelectionCounts(allowedGroupIds, catalog.groupById, selectionsByGroupId);

    validateBreakfastSelections(menuItemId, selectionsByGroupId);

    const canonicalSelections = Array.from(selectionsByGroupId.values()).flat();
    const basePrice = roundMoney(menuItem.base_price ?? 0);
    const optionPrice = roundMoney(canonicalSelections.reduce((sum, selection) => sum + roundMoney(selection.price_modifier), 0));
    const unitPrice = roundMoney(basePrice + optionPrice);
    const lineTotal = roundMoney(unitPrice * quantity);

    const unitPriceHint = line.unit_price ?? line.price;
    if (unitPriceHint != null && !sameMoney(roundMoney(unitPriceHint), unitPrice)) {
      throw new Error(`Client price mismatch for "${menuItem.name}".`);
    }
    const lineTotalHint = line.line_total;
    if (lineTotalHint != null && !sameMoney(roundMoney(lineTotalHint), lineTotal)) {
      throw new Error(`Client line total mismatch for "${menuItem.name}".`);
    }

    canonicalItems.push({
      menu_item_id: menuItemId,
      item_name: menuItem.name,
      item_category: String(line.item_category ?? line.category ?? menuItem.category_slug ?? 'Menu').trim() || 'Menu',
      unit_price: unitPrice,
      quantity,
      line_total: lineTotal,
      selections: canonicalSelections,
    });
  }

  const subtotal = roundMoney(canonicalItems.reduce((sum, item) => sum + item.line_total, 0));
  const discount = roundMoney(params.requestedDiscount ?? 0);
  if (!Number.isFinite(discount) || discount < 0) {
    throw new Error('Discount must be a non-negative number.');
  }
  if (discount - subtotal > MONEY_TOLERANCE) {
    throw new Error('Discount cannot exceed subtotal.');
  }

  const taxableSubtotal = roundMoney(Math.max(0, subtotal - discount));
  const taxAmount = roundMoney(taxableSubtotal * GST_RATE);

  const requestedTipPercentage = roundMoney(params.requestedTipPercentage ?? 0);
  const requestedTipAmount = roundMoney(params.requestedTipAmount ?? 0);
  if (!Number.isFinite(requestedTipAmount) || requestedTipAmount < 0 || !Number.isFinite(requestedTipPercentage) || requestedTipPercentage < 0) {
    throw new Error('Tip values must be non-negative numbers.');
  }

  const tipAmount = requestedTipPercentage > 0
    ? roundMoney(taxableSubtotal * (requestedTipPercentage / 100))
    : requestedTipAmount;

  const total = roundMoney(taxableSubtotal + taxAmount + tipAmount);

  if (params.requestedSubtotal != null && !sameMoney(roundMoney(params.requestedSubtotal), subtotal)) {
    throw new Error('Client subtotal mismatch.');
  }
  if (params.requestedTaxAmount != null && !sameMoney(roundMoney(params.requestedTaxAmount), taxAmount)) {
    throw new Error('Client GST mismatch.');
  }
  if (params.requestedTipAmount != null && !sameMoney(roundMoney(params.requestedTipAmount), tipAmount)) {
    throw new Error('Client tip mismatch.');
  }
  if (params.requestedTotal != null && !sameMoney(roundMoney(params.requestedTotal), total)) {
    throw new Error('Client total mismatch.');
  }

  return {
    items: canonicalItems,
    subtotal,
    discount,
    taxableSubtotal,
    taxAmount,
    tipAmount,
    tipPercentage: requestedTipPercentage,
    total,
  };
};
