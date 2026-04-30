select status, order_id, metadata
from customer_payments
order by created_at desc
limit 3;


| status    | order_id                             | metadata                                                                                                                                                                                                                                                            |
| --------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| succeeded | cf21aca9-94a6-4549-9b86-e8e035351888 | {"provider":"mock","taxable_subtotal":169,"reward_discount_amount":0,"selected_reward_entitlements":[{"reward_id":"953b7bc6-91fc-4cf0-a0d8-ca7c2fa876df","reward_code":"water","reward_type":"free_item","entitlement_id":"527c405c-f901-4be9-98d8-12e51eb7dbb1"}]} |
| succeeded | 315133f1-2b3d-47be-b631-22ee80289d85 | {"provider":"mock","taxable_subtotal":1134,"reward_discount_amount":0,"selected_reward_entitlements":[]}                                                                                                                                                            |