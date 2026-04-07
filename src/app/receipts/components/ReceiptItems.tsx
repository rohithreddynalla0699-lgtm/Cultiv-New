import type { ReceiptLineItem } from '../types/receipt';

export function ReceiptItems({ items }: { items: ReceiptLineItem[] }) {
  return (
    <div className="mb-4">
      <div className="font-semibold text-sm mb-2">Items</div>
      <ul className="divide-y divide-gray-200">
        {items.map((item) => (
          <li key={item.id} className="py-2 flex flex-col">
            <div className="flex justify-between items-center">
              <span className="font-medium text-gray-800">{item.quantity}× {item.title}</span>
              <span className="text-gray-700">₹{item.price.toFixed(2)}</span>
            </div>
            {item.selections && item.selections.length > 0 && (
              <ul className="ml-4 mt-1 text-xs text-gray-500 space-y-0.5">
                {item.selections.map((sel, idx) => (
                  <li key={idx}>
                    <span className="font-semibold">{sel.section}:</span> {sel.choices.join(', ')}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
