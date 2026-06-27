-- =============================================
-- 상품 기본정보
-- =============================================
CREATE TABLE product_master (
  product_id    TEXT PRIMARY KEY,
  product_name  TEXT NOT NULL,
  category      TEXT NOT NULL,
  customer_type TEXT NOT NULL,
  menu_path     TEXT,
  description   TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- 상품 정책 (한도, 금리, 상환방식, 보증)
-- =============================================
CREATE TABLE product_policy (
  id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product_id        TEXT NOT NULL REFERENCES product_master(product_id) ON DELETE CASCADE,
  min_amount        BIGINT,
  max_amount        BIGINT,
  min_rate          NUMERIC(5, 2),
  max_rate          NUMERIC(5, 2),
  repayment_options TEXT[],
  guarantee_type    TEXT,
  loan_period_months INT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- 신청 가능/불가 조건
-- =============================================
CREATE TABLE eligibility_rules (
  id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product_id         TEXT NOT NULL REFERENCES product_master(product_id) ON DELETE CASCADE,
  rule_type          TEXT NOT NULL CHECK (rule_type IN ('eligible', 'not_eligible', 'manual_review', 'consultation')),
  condition_key      TEXT NOT NULL,
  condition_operator TEXT NOT NULL,
  condition_value    TEXT NOT NULL,
  description        TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- 자연어 검색 키워드
-- =============================================
CREATE TABLE product_search_keyword (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES product_master(product_id) ON DELETE CASCADE,
  keyword    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- 화면 ID / 화면명 / 유형
-- =============================================
CREATE TABLE screen_mapping (
  screen_id   TEXT PRIMARY KEY,
  screen_name TEXT NOT NULL,
  screen_type TEXT NOT NULL,
  is_popup    BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- intent + productId 기준 화면 이동 라우팅
-- =============================================
CREATE TABLE routing_map (
  id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  intent           TEXT NOT NULL,
  product_id       TEXT REFERENCES product_master(product_id) ON DELETE CASCADE,
  action_type      TEXT NOT NULL,
  target_screen_id TEXT NOT NULL REFERENCES screen_mapping(screen_id),
  cta_label        TEXT NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- Slot 정의
-- =============================================
CREATE TABLE slot_definition (
  slot_id      TEXT PRIMARY KEY,
  slot_label   TEXT NOT NULL,
  slot_type    TEXT NOT NULL CHECK (slot_type IN ('text', 'number', 'select', 'boolean', 'date')),
  slot_group   TEXT NOT NULL CHECK (slot_group IN ('requiredForRecommendation', 'optionalForRecommendation', 'applicationSlots')),
  is_sensitive BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- 코드 목록
-- =============================================
CREATE TABLE code_list (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code_group TEXT NOT NULL,
  code_value TEXT NOT NULL,
  code_label TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (code_group, code_value)
);

-- =============================================
-- 필요서류
-- =============================================
CREATE TABLE documents (
  id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product_id        TEXT NOT NULL REFERENCES product_master(product_id) ON DELETE CASCADE,
  document_name     TEXT NOT NULL,
  submission_method TEXT,
  is_required       BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- 약관 / 동의서
-- =============================================
CREATE TABLE consent_mapping (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product_id      TEXT NOT NULL REFERENCES product_master(product_id) ON DELETE CASCADE,
  consent_name    TEXT NOT NULL,
  consent_type    TEXT NOT NULL CHECK (consent_type IN ('필수', '선택')),
  consent_content TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- 출처 관리 (관리용)
-- =============================================
CREATE TABLE source_map (
  id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  table_name         TEXT NOT NULL,
  source_description TEXT,
  source_url         TEXT,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- updated_at 자동 갱신 트리거
-- =============================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_product_master_updated_at
  BEFORE UPDATE ON product_master
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_product_policy_updated_at
  BEFORE UPDATE ON product_policy
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
