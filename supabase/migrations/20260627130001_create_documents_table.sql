-- [SUPERSEDED] documents 테이블은 20260628000001_correct_schema.sql에 통합되었다.
-- 컬럼명 정정: "isRequired" → "required", "submissionMethod" → "collectionMethod", remarks 추가
CREATE TABLE documents (
  id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "productId"        TEXT NOT NULL,
  "documentName"     TEXT NOT NULL,
  "submissionMethod" TEXT,
  "isRequired"       BOOLEAN NOT NULL DEFAULT true,
  "createdAt"        TIMESTAMPTZ NOT NULL DEFAULT now()
);
