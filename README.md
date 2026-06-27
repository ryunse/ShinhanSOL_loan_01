# 신한쏠비즈 대출상담 AI

신한쏠비즈 앱의 대화형 AI 챗봇에서 대출상담 및 상품추천을 처리하는 AI 시스템 설계 및 런타임 정책 저장소입니다.

## 개요

사용자의 자연어 발화를 분석해 적합한 대출상품을 추천하고, 신청 가능 여부를 확인하며, 앱 화면 이동 CTA를 생성합니다. 실제 대출 신청·약정·실행은 채팅창이 아닌 앱 화면과 백엔드 API에서 처리합니다.

```
사용자 발화 → 상담 엔진(결정론적) → 상품 DB 조회 → Routing → 화면 이동 CTA → 신한쏠비즈 앱
```

## 주요 파일

| 파일/폴더 | 설명 |
|---|---|
| `loan_system_prompt.md` | AI 엔진에 주입되는 시스템 프롬프트 |
| `loan_common.json` | Intent 라우팅, Slot 정책, 상품 검색, CTA 포맷 등 런타임 공통 정책 |
| `runtime_architecture.md` | 전체 데이터 흐름 및 DB 역할 정의 |
| `client/` | Next.js 채팅 프로토타입 (포트 3001) |
| `client/src/services/consultationEngine.ts` | 공통 대출상담 프레임워크 v4.0 (결정론적 8단계 상담 플로우) |
| `scripts/` | DB 데이터 초기화 및 패치 스크립트 |
| `src/` | NestJS 백엔드 스캐폴드 (포트 3000) |
| `supabase/migrations/` | DB 테이블 마이그레이션 SQL |

## 채팅 프로토타입 실행

```bash
# 백엔드 (NestJS, 포트 3000)
npm run start:dev

# 채팅 UI (Next.js, 포트 3001)
cd client && npm run dev
```

브라우저에서 `http://localhost:3001` 접속

### 환경변수

루트 `.env` 및 `client/.env.local` 모두 설정 필요:

```
# 루트 .env
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# client/.env.local
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## 상담 엔진 v4.0 — 8단계 공통 플로우

`client/src/services/consultationEngine.ts`에 구현된 결정론적 상담 흐름 (LLM 미사용):

| 단계 | step | 설명 |
|---|---|---|
| 1 | `understand_intent` | 대출 의도 파악 + 슬롯 수집 (자금목적, 희망금액) |
| 2 | `identify_customer` | 고객 유형 확인 (사업자 유형) |
| 3 | `check_repayment` | 상환 능력 / DSR 확인 (자동) |
| 4 | `find_candidates` | 후보 상품 탐색 (키워드 검색 → slot_fallback) |
| - | `eligibility_check` | 자격 조건 Q&A (find_candidates 하위 단계) |
| 5 | `calculate_estimate` | 예상 한도·금리 산출 (자동) |
| 6 | `guide_pre_approval` | 예비 승인 안내 (자동) |
| 7 | `guide_documents` | 필요서류 안내 |
| 8 | `screen_transition` | 신청 화면 이동 CTA (상품카드에 포함) |

## 등록 상품 목록

| 상품 ID | 상품명 | 카테고리 | 한도 | 금리 |
|---|---|---|---|---|
| `LOAN_DDANGYO_SOHO` | 땡겨요 사업자대출 | 사업자대출 | 최대 1억 | — |
| `LOAN_REGIONAL_GUARANTEE` | 지역신용보증재단 비대면 보증부대출 | 사업자대출 | 최대 5천만 | — |
| `LOAN_TOPS_PROFESSIONAL` | Tops 전문직우대론 | 사업자대출 | 최대 4억 | 연 4.65 ~ 5.53% |

> 신규 상품 추가 시 `loan_common.json`과 `loan_system_prompt.md`는 수정하지 않고 DB Row만 추가합니다.

## DB 테이블 구조

| 테이블 | 용도 | 신규 상품 추가 시 |
|---|---|---|
| `product_master` | 상품 기본정보, 카테고리, 메뉴경로 | 필수 |
| `product_policy` | 한도, 금리, 상환방식, 보증 여부 | 필수 |
| `eligibility_rules` | 신청 가능/불가 조건 + 자격 Q&A | 필수 |
| `product_search_keyword` | 자연어 검색 키워드 | 필수 |
| `routing_map` | Intent + 상품 기준 화면 이동 CTA | 필수 |
| `screen_mapping` | 화면 ID, 화면명, 화면 유형, 플로우 순서 | 조건부 |
| `documents` | 필요서류 및 제출방식 | 조건부 |
| `consent_mapping` | 약관 및 동의서 | 조건부 |
| `slot_definition` | 입력 Slot 정의 | 조건부 |
| `code_list` | 코드값 목록 | 조건부 |

## scripts/ — DB 데이터 스크립트

| 파일 | 용도 |
|---|---|
| `seed.mjs` | 전체 초기 데이터 시딩 |
| `add_tops_professional.mjs` | LOAN_TOPS_PROFESSIONAL 상품 데이터 추가 |
| `patch_tops_professional_screens.mjs` | Figma 화면설계 기반 실제 스크린 ID 적용 |
| `add_tops_professional_docs_consents.mjs` | Tops 전문직우대론 서류/동의서 추가 |
| `patch_rate_info.mjs` | 금리 정보 패치 |
| `patch_loan_purpose.mjs` | 자금 목적 패치 |
| `patch_eligibility_polarity.mjs` | 자격 조건 극성 패치 |

스크립트 실행:
```bash
node scripts/<script-name>.mjs
```

## 핵심 원칙

- **DB 중심**: 모든 상품 정보는 DB Row로 관리하며, 상품별 JSON은 사용하지 않습니다.
- **결정론적 상담 엔진**: LLM을 사용하지 않고 규칙 기반 8단계 플로우로 상담을 처리합니다.
- **의도 기반 라우팅**: 화면 순서가 아닌 사용자 Intent와 `routing_map`을 기준으로 목적 화면을 결정합니다.
- **채팅창 내 금융거래 금지**: 대출 신청·약정·실행은 반드시 앱 화면과 백엔드 API에서 처리합니다.
- **확정 표현 금지**: 승인 여부, 한도, 금리를 확정적으로 안내하지 않습니다.
