-- 20260409180000_harden_menu_security.sql
-- Migration: Harden menu table security for production

REVOKE INSERT, UPDATE, DELETE ON menu_items FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON item_option_group_map FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON option_groups FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON option_items FROM anon, authenticated;

GRANT SELECT ON menu_items TO anon, authenticated;
GRANT SELECT ON item_option_group_map TO anon, authenticated;
GRANT SELECT ON option_groups TO anon, authenticated;
GRANT SELECT ON option_items TO anon, authenticated;
