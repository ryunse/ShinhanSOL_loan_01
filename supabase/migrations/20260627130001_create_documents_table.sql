CREATE TABLE documents (
  id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "productId"        TEXT NOT NULL,
  "documentName"     TEXT NOT NULL,
  "submissionMethod" TEXT,
  "isRequired"       BOOLEAN NOT NULL DEFAULT true,
  "createdAt"        TIMESTAMPTZ NOT NULL DEFAULT now()
);
