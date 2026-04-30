select o.order_number, o.source_channel, o.payment_method,
       oi.menu_item_id, oi.item_name, oi.unit_price, oi.quantity, oi.line_total
from orders o
join order_items oi on oi.order_id = o.order_id
order by o.created_at desc
limit 10;



| order_number     | source_channel | payment_method | menu_item_id            | item_name               | unit_price | quantity | line_total |
| ---------------- | -------------- | -------------- | ----------------------- | ----------------------- | ---------- | -------- | ---------- |
| CULTIV2604300002 | online         | upi            | banana-chia-yogurt-bowl | Banana Chia Yogurt Bowl | 189.00     | 1        | 189.00     |
| CULTIV2604300001 | walk_in        | upi            | banana-chia-yogurt-bowl | Banana Chia Yogurt Bowl | 189.00     | 1        | 189.00     |


----

select o.order_number, oi.item_name, ois.group_id_snapshot,
       ois.option_name, ois.price_modifier
from orders o
join order_items oi on oi.order_id = o.order_id
left join order_item_selections ois on ois.order_item_id = oi.order_item_id
order by o.created_at desc
limit 50;


| order_number     | item_name               | group_id_snapshot | option_name   | price_modifier |
| ---------------- | ----------------------- | ----------------- | ------------- | -------------- |
| CULTIV2604300002 | Banana Chia Yogurt Bowl | crunch            | Granola       | 0.00           |
| CULTIV2604300002 | Banana Chia Yogurt Bowl | add-ons           | Extra Fruit   | 30.00          |
| CULTIV2604300002 | Banana Chia Yogurt Bowl | add-ons           | Extra Granola | 20.00          |
| CULTIV2604300002 | Banana Chia Yogurt Bowl | add-ons           | Honey         | 20.00          |
| CULTIV2604300001 | Banana Chia Yogurt Bowl | add-ons           | Extra Granola | 20.00          |
| CULTIV2604300001 | Banana Chia Yogurt Bowl | add-ons           | Honey         | 20.00          |
| CULTIV2604300001 | Banana Chia Yogurt Bowl | add-ons           | Extra Fruit   | 30.00          |


