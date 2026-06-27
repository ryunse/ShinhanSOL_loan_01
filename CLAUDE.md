# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

이 프로젝트는 신한쏠비즈 플랫폼의 대출상담 및 상품추천을 위한 **신한쏠비즈 대출상담 AI** 설계 명세 및 프롬프트 엔지니어링 프로젝트다. 실행 가능한 코드베이스가 아니며 빌드 명령, 테스트, 패키지 매니저는 존재하지 않는다.

## 파일별 역할

| 파일 | 역할 |
|---|---|
| `loan_system_prompt.md` | 런타임에 AI 엔진에 주입되는 시스템 프롬프트. 역할, 핵심 원칙, 응답 규칙, 금지 표현, CTA 포맷을 정의한다. |
| `loan_common.json` | 공통 런타임 정책 설정 (버전 `2.1-refactored`). Intent 라우팅, Slot 정책, 상품 검색 랭킹, 신청 가능 조건 로직, CTA 유형, 가드레일, 오케스트레이션 단계를 정의한다. |
| `runtime_architecture.md` | 아키텍처 참조 문서. 사용자 발화 → AI 엔진 → DB → 라우팅 → 화면 → 백엔드 API까지의 전체 데이터 흐름을 기술한다. |

## 핵심 설계 원칙

1. **DB 중심, JSON 중심 아님**: 모든 상품 정보는 Product Catalog DB(`product_master`, `product_policy`, `eligibility_rules` 등)에서 Row로 관리한다. `loan_common.json`은 *정책*만 정의하며 상품 데이터를 포함하지 않는다.
2. **화면 순서 기반이 아닌 사용자 의도 기반 라우팅**: 화면 이동은 `routing_map`(`intent + productId + actionType` 키 조합)으로 결정하며, 순차적 화면 플로우로 처리하지 않는다.
3. **채팅창 내 금융거래 실행 금지**: 대출 신청, 약정, 실행은 채팅창에서 완료하지 않는다. AI는 앱 화면 및 백엔드 API로 이동하는 CTA만 생성한다.
4. **신규 상품 추가 시 `loan_common.json`과 `loan_system_prompt.md`는 수정하지 않는다** — DB Row만 추가한다.

## 신규 대출상품 추가 절차

신규 상품 추가 시 JSON/마크다운 파일은 수정하지 않고, 아래 DB 테이블에 Row를 추가한다.

**필수:**
- `product_master` — 상품 기본정보, 메뉴경로, 카테고리
- `product_policy` — 한도, 금리, 상환방식, 보증 여부
- `eligibility_rules` — 신청 가능/불가 조건
- `product_search_keyword` — 자연어 검색 키워드
- `routing_map` — Intent별 화면 이동 정보

**조건부 (해당하는 경우에만):**
- `screen_mapping` — 신규 화면이 추가되는 경우
- `documents` — 필요서류가 다른 경우
- `consent_mapping` — 추가 약관/동의서가 있는 경우
- `slot_definition` — 신규 입력 Slot이 필요한 경우
- `code_list` — 신규 코드값이 필요한 경우

## 지원 Intent 목록

| Intent | 다음 액션 |
|---|---|
| `loan_recommendation` | `recommendProducts` |
| `loan_product_inquiry` | `explainProduct` |
| `loan_application` | `generateRoutingCTA` |
| `loan_eligibility_check` | `checkEligibility` |
| `loan_document_inquiry` | `showDocuments` |
| `loan_terms_inquiry` | `showConsent` |
| `loan_status_inquiry` | `checkStatusOrRoute` |

## CTA 출력 포맷

모든 화면 이동 CTA는 아래 구조를 따른다 (`loan_common.json` > `ctaPolicy.outputFormat` 기준):

```json
{
  "label": "{ctaLabel}",
  "action": "{actionType}",
  "targetScreenId": "{targetScreenId}",
  "targetScreenName": "{targetScreenName}"
}
```

## 가드레일 (절대 위반 금지)

- 대출 승인, 한도, 금리를 확정적으로 표현하지 않는다.
- 채팅창에서 민감정보(주민등록번호, 계좌번호, OTP, 공동인증서 비밀번호, 보안카드)를 요청하지 않는다.
- 채팅봇 내에서 대출 신청, 약정, 실행 완료를 임의로 처리하지 않는다.
- DB에 없는 상품 조건을 추정하거나 생성하지 않는다.

## Slot 수집 정책

- 추천을 위한 필수 Slot: `customerType`, `loanPurpose`, `desiredAmount`
- 부족한 Slot은 **한 번에 하나씩** 질문한다 (`askOneAtATime: true`)
- 민감 Slot(`residentRegistrationNumber`, `accountNumber` 등)은 앱 화면에서만 수집하며 채팅창에서 요청하지 않는다.
