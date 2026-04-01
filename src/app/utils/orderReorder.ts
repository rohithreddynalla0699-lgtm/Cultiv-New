import { MENU_CATEGORIES } from '../data/menuData';
import { createDraftLineKey, type DraftCartLine } from '../data/cartDraft';
import type { Order } from '../types/platform';
import { DEFAULT_REORDER_FALLBACK_CATEGORY_SLUG } from '../constants/business';

export function resolveReorderCategorySlug(order: Order): string {
  const candidateLabels = [order.category, ...order.items.map((item) => item.category)]
    .map((label) => label?.trim().toLowerCase())
    .filter(Boolean);

  const matched = MENU_CATEGORIES.find((category) => candidateLabels.includes(category.name.toLowerCase()));
  return matched?.slug ?? DEFAULT_REORDER_FALLBACK_CATEGORY_SLUG;
}

export function mapOrderItemsToDraftLines(order: Order): DraftCartLine[] {
  return order.items.map((item, index) => {
    const selections = item.selections.map((selection) => ({
      section: selection.section,
      choices: [...selection.choices],
    }));

    return {
      key: createDraftLineKey(`${item.id}-${index}`, selections),
      itemId: item.id,
      title: item.title,
      categoryName: item.category,
      unitPrice: item.price,
      quantity: item.quantity,
      selections,
    };
  });
}
