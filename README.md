# 신한쏠비즈 대출상담 AI

신한쏠비즈 앱의 대화형 AI 챗봇에서 대출상담 및 상품추천을 처리하는 AI 시스템 설계 및 런타임 정책 저장소입니다.

## 개요

사용자의 자연어 발화를 분석해 적합한 대출상품을 추천하고, 신청 가능 여부를 확인하며, 앱 화면 이동 CTA를 생성합니다. 실제 대출 신청·약정·실행은 채팅창이 아닌 앱 화면과 백엔드 API에서 처리합니다.

```
사용자 발화 → AI 엔진 → 상품 DB 조회 → Routing → 화면 이동 CTA → 신한쏠비즈 앱
```

## 주요 파일

| 파일 | 설명 |
|---|---|
| `loan_system_prompt.md` | AI 엔진에 주입되는 시스템 프롬프트 |
| `loan_common.json` | Intent 라우팅, Slot 정책, 상품 검색, CTA 포맷 등 런타임 공통 정책 |
| `runtime_architecture.md` | 전체 데이터 흐름 및 DB 역할 정의 |
| `supabaseClient.js` | Supabase DB 연결 클라이언트 |
| `supabase/migrations/` | DB 테이블 마이그레이션 SQL |

## DB 테이블 구조

| 테이블 | 용도 | 신규 상품 추가 시 |
|---|---|---|
| `product_master` | 상품 기본정보, 카테고리, 메뉴경로 | 필수 |
| `product_policy` | 한도, 금리, 상환방식, 보증 여부 | 필수 |
| `eligibility_rules` | 신청 가능/불가 조건 | 필수 |
| `product_search_keyword` | 자연어 검색 키워드 | 필수 |
| `routing_map` | Intent + 상품 기준 화면 이동 | 필수 |
| `screen_mapping` | 화면 ID, 화면명, 화면 유형 | 조건부 |
| `documents` | 필요서류 및 제출방식 | 조건부 |
| `consent_mapping` | 약관 및 동의서 | 조건부 |
| `slot_definition` | 입력 Slot 정의 | 조건부 |
| `code_list` | 코드값 목록 | 조건부 |
| `source_map` | 출처 관리 | 선택 |

> 신규 상품 추가 시 `loan_common.json`과 `loan_system_prompt.md`는 수정하지 않고 DB Row만 추가합니다.

## 지원 Intent

| Intent | 설명 |
|---|---|
| `loan_recommendation` | 조건에 맞는 대출상품 추천 |
| `loan_product_inquiry` | 특정 상품 또는 상품군 안내 |
| `loan_application` | 대출 신청 또는 한도조회 화면 이동 |
| `loan_eligibility_check` | 신청 가능 여부 확인 |
| `loan_document_inquiry` | 필요서류 안내 |
| `loan_terms_inquiry` | 약관 및 동의서 안내 |
| `loan_status_inquiry` | 신청/심사/약정 상태 확인 |

## 시작하기

### 사전 요구사항

- Node.js 18 이상
- Supabase 프로젝트

### 설치

```bash
npm install
```

### 환경변수 설정

`.env` 파일을 생성하고 Supabase 프로젝트 정보를 입력합니다.

```
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-anon-key
```

### DB 마이그레이션

```bash
supabase link --project-ref <project-ref>
supabase db push
```

## 핵심 원칙

- **DB 중심**: 모든 상품 정보는 DB Row로 관리하며, 상품별 JSON은 사용하지 않습니다.
- **의도 기반 라우팅**: 화면 순서가 아닌 사용자 Intent와 `routing_map`을 기준으로 목적 화면을 결정합니다.
- **채팅창 내 금융거래 금지**: 대출 신청·약정·실행은 반드시 앱 화면과 백엔드 API에서 처리합니다.
- **확정 표현 금지**: 승인 여부, 한도, 금리를 확정적으로 안내하지 않습니다.
