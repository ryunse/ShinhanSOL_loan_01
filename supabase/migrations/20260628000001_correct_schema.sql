-- =============================================================================
-- 정정 마이그레이션: 실제 운영 스키마와 일치하는 테이블 구조
--
-- 이전 마이그레이션(20260627125828_create_loan_tables.sql)은 snake_case 컬럼명을
-- 사용했으나 실제 Supabase 테이블은 camelCase 컬럼명으로 구성되어 있다.
-- 이 파일이 신규 환경 구성 시 사용해야 할 기준 스키마다.
--
-- 적용 대상: 신규 dev/staging 환경 구성 시 단독 사용
--           기존 운영 DB에는 적용하지 않는다 (테이블이 이미 존재함)
-- =============================================================================

-- ─── 기존 테이블 제거 (신규 환경 구성 시) ─────────────────────────────────────

DROP TABLE IF EXISTS consent_mapping       CASCADE;
DROP TABLE IF EXISTS documents             CASCADE;
DROP TABLE IF EXISTS eligibility_rules     CASCADE;
DROP TABLE IF EXISTS routing_map           CASCADE;
DROP TABLE IF EXISTS screen_mapping        CASCADE;
DROP TABLE IF EXISTS product_search_keyword CASCADE;
DROP TABLE IF EXISTS product_policy        CASCADE;
DROP TABLE IF EXISTS product_master        CASCADE;
DROP TABLE IF EXISTS slot_definition       CASCADE;
DROP TABLE IF EXISTS code_list             CASCADE;
DROP TABLE IF EXISTS source_map            CASCADE;

-- ─── product_master ───────────────────────────────────────────────────────────
-- active: 'Y' / 'N' 문자열로 관리 (policyLoader: .eq('active', 'Y'))

CREATE TABLE product_master (
  "productId"       TEXT        PRIMARY KEY,
  "productName"     TEXT        NOT NULL,
  "productCategory" TEXT        NOT NULL,
  "menuPath"        TEXT,
  "active"          TEXT        NOT NULL DEFAULT 'Y' CHECK ("active" IN ('Y', 'N')),
  "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── product_policy ───────────────────────────────────────────────────────────

CREATE TABLE product_policy (
  "policyId"              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "productId"             TEXT        NOT NULL REFERENCES product_master("productId") ON DELETE CASCADE,
  "minAmount"             BIGINT,
  "maxAmount"             BIGINT,
  "rateType"              TEXT,
  "minRate"               NUMERIC(5, 2),
  "maxRate"               NUMERIC(5, 2),
  "rateBaseDate"          TEXT,
  "maxTerm"               TEXT,
  "repaymentOptions"      JSONB,
  "loanType"              TEXT,
  "loanPurpose"           TEXT,
  "collateralOrGuarantee" TEXT,
  "guaranteeRequired"     TEXT        CHECK ("guaranteeRequired" IN ('Y', 'N')),
  "targetCustomer"        TEXT,
  "createdAt"             TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"             TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── eligibility_rules ────────────────────────────────────────────────────────
-- policyLoader 쿼리 조건: status='active', qaTarget='user'
-- severity 판단: failAction이 'block'으로 시작하면 blocking, 아니면 advisory

CREATE TABLE eligibility_rules (
  "ruleId"               TEXT        PRIMARY KEY,
  "productId"            TEXT        NOT NULL REFERENCES product_master("productId") ON DELETE CASCADE,
  "ruleName"             TEXT        NOT NULL,
  "conditionDescription" TEXT        NOT NULL,
  "failMessage"          TEXT        NOT NULL,
  "failAction"           TEXT        NOT NULL DEFAULT 'advisory',
  "status"               TEXT        NOT NULL DEFAULT 'active' CHECK ("status" IN ('active', 'inactive')),
  "conditionPolarity"    TEXT        NOT NULL DEFAULT 'positive' CHECK ("conditionPolarity" IN ('positive', 'negative')),
  "qaTarget"             TEXT        NOT NULL DEFAULT 'user' CHECK ("qaTarget" IN ('user', 'system')),
  "createdAt"            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── product_search_keyword ───────────────────────────────────────────────────

CREATE TABLE product_search_keyword (
  "keywordId"  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "productId"  TEXT        NOT NULL REFERENCES product_master("productId") ON DELETE CASCADE,
  "keyword"    TEXT        NOT NULL,
  "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── screen_mapping ───────────────────────────────────────────────────────────

CREATE TABLE screen_mapping (
  "screenId"   TEXT        PRIMARY KEY,
  "screenName" TEXT        NOT NULL,
  "stepLabel"  TEXT,
  "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── routing_map ─────────────────────────────────────────────────────────────
-- policyLoader 쿼리 조건: actionType='navigate', screenType='screen'
-- order by routingId ASC → 상품별 첫 번째 entry CTA 선택

CREATE TABLE routing_map (
  "routingId"        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "productId"        TEXT        NOT NULL REFERENCES product_master("productId") ON DELETE CASCADE,
  "actionType"       TEXT        NOT NULL DEFAULT 'navigate',
  "targetScreenId"   TEXT        NOT NULL REFERENCES screen_mapping("screenId"),
  "targetScreenName" TEXT,
  "ctaLabel"         TEXT        NOT NULL,
  "screenType"       TEXT        NOT NULL DEFAULT 'screen' CHECK ("screenType" IN ('screen', 'dialog', 'bottomsheet')),
  "createdAt"        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── documents ────────────────────────────────────────────────────────────────
-- required: BOOLEAN (policyLoader: r.required === 'Y' || r.required === true → BOOLEAN 권장)

CREATE TABLE documents (
  "documentId"       BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "productId"        TEXT        NOT NULL REFERENCES product_master("productId") ON DELETE CASCADE,
  "documentName"     TEXT        NOT NULL,
  "required"         BOOLEAN     NOT NULL DEFAULT true,
  "collectionMethod" TEXT,
  "remarks"          TEXT,
  "createdAt"        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── slot_definition ─────────────────────────────────────────────────────────

CREATE TABLE slot_definition (
  "slotId"       TEXT PRIMARY KEY,
  "slotLabel"    TEXT    NOT NULL,
  "slotType"     TEXT    NOT NULL CHECK ("slotType" IN ('text', 'number', 'select', 'boolean', 'date')),
  "slotGroup"    TEXT    NOT NULL CHECK ("slotGroup" IN ('requiredForRecommendation', 'optionalForRecommendation', 'applicationSlots')),
  "isSensitive"  BOOLEAN NOT NULL DEFAULT false,
  "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── code_list ───────────────────────────────────────────────────────────────

CREATE TABLE code_list (
  "codeId"     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "codeGroup"  TEXT    NOT NULL,
  "codeValue"  TEXT    NOT NULL,
  "codeLabel"  TEXT    NOT NULL,
  "sortOrder"  INT     NOT NULL DEFAULT 0,
  "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE ("codeGroup", "codeValue")
);

-- ─── consent_mapping ─────────────────────────────────────────────────────────

CREATE TABLE consent_mapping (
  "consentId"      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "productId"      TEXT    NOT NULL REFERENCES product_master("productId") ON DELETE CASCADE,
  "consentName"    TEXT    NOT NULL,
  "consentType"    TEXT    NOT NULL CHECK ("consentType" IN ('필수', '선택')),
  "consentContent" TEXT,
  "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── RLS: 공개 읽기 허용 ─────────────────────────────────────────────────────

ALTER TABLE product_master          ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_policy          ENABLE ROW LEVEL SECURITY;
ALTER TABLE eligibility_rules       ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_search_keyword  ENABLE ROW LEVEL SECURITY;
ALTER TABLE screen_mapping          ENABLE ROW LEVEL SECURITY;
ALTER TABLE routing_map             ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents               ENABLE ROW LEVEL SECURITY;
ALTER TABLE slot_definition         ENABLE ROW LEVEL SECURITY;
ALTER TABLE code_list               ENABLE ROW LEVEL SECURITY;
ALTER TABLE consent_mapping         ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read" ON product_master         FOR SELECT USING (true);
CREATE POLICY "public_read" ON product_policy         FOR SELECT USING (true);
CREATE POLICY "public_read" ON eligibility_rules      FOR SELECT USING (true);
CREATE POLICY "public_read" ON product_search_keyword FOR SELECT USING (true);
CREATE POLICY "public_read" ON screen_mapping         FOR SELECT USING (true);
CREATE POLICY "public_read" ON routing_map            FOR SELECT USING (true);
CREATE POLICY "public_read" ON documents              FOR SELECT USING (true);
CREATE POLICY "public_read" ON slot_definition        FOR SELECT USING (true);
CREATE POLICY "public_read" ON code_list              FOR SELECT USING (true);
CREATE POLICY "public_read" ON consent_mapping        FOR SELECT USING (true);

-- ─── updated_at 자동 갱신 트리거 ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_product_master_updated_at
  BEFORE UPDATE ON product_master
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER trg_product_policy_updated_at
  BEFORE UPDATE ON product_policy
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
