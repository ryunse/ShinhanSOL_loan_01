-- [SUPERSEDED] 이 마이그레이션은 20260628000001_correct_schema.sql에 통합되었다.
-- migration: 001_add_rate_columns
-- product_policy 테이블에 금리·기간 컬럼 추가
-- Supabase SQL Editor에서 한 번만 실행하면 됩니다.

ALTER TABLE product_policy
  ADD COLUMN IF NOT EXISTS "minRate"     NUMERIC,
  ADD COLUMN IF NOT EXISTS "maxRate"     NUMERIC,
  ADD COLUMN IF NOT EXISTS "rateBaseDate" TEXT,
  ADD COLUMN IF NOT EXISTS "maxTerm"     TEXT;
