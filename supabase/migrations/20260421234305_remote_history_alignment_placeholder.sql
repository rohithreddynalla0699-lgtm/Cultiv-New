-- Placeholder migration to align local Supabase migration history with remote.
-- This repository no longer contains the original 20260421234305 migration body.
-- Based on commit history, this timestamp fell within the April 21 POS migration window
-- that is now represented locally by:
--   - 20260410133000_create_internal_pos_checkout_rpc.sql
--   - 20260422004755_fix_pos_payment_method_any_logic.sql
--
-- This file is intentionally a no-op so that:
-- 1. local migration history matches remote migration history
-- 2. no destructive or duplicate schema changes are applied
-- 3. fresh local resets can proceed safely

select '20260421234305 placeholder migration: no-op for history alignment' as migration_note;
