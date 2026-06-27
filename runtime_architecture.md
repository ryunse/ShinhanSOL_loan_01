# runtime_architecture.md

# AI 대출상담 Runtime Architecture

## 1. 목적

신한쏠비즈 대화형 AI Agent에서 대출상담을 처리하기 위한 운영 구조를 정의한다.

AI는 상품 추천 엔진이 아니라 **전문 대출 상담사**로 동작한다.
고객 목표를 파악하고, 자격 분석 후 후보 상품을 안내하며, 뱅킹 워크플로우로 연결한다.

---

## 2. 핵심 원칙

- **Consultation First**: 상담이 먼저다. 상품 목록을 먼저 제시하지 않는다.
- **Business-Centric Workflow**: 화면 순서가 아니라 비즈니스 목표 기반 워크플로우로 처리한다.
- **Workflow Before LLM**: LLM은 자연어 응답 생성 단계에서만 호출한다. 비즈니스 로직은 결정론적으로 처리한다.
- **Customer Profile First**: 고객 프로필·기존 거래 정보를 먼저 조회하고, 조회 불가한 정보만 질문한다.
- **Candidate Products (not Recommendation)**: 후보 상품은 자격 분석 완료 후 도출한다.
- **Screen Independence**: 화면 ID, UI Flow가 상담 워크플로우를 결정하지 않는다. 화면은 상담 완료 후의 선택지이다.
- 상품 추가 시 loan_common.json과 loan_system_prompt.md는 수정하지 않는다.

---

## 3. 전체 구조

```text
사용자 발화
  ↓
AI Agent
  ├─ loan_system_prompt.md   (역할 및 상담 원칙)
  └─ loan_common.json        (워크플로우 정책 및 규칙)
  ↓
[결정론적 처리 레이어]
  ├─ Intent Detection
  ├─ Consultation Workflow Selection
  ├─ Customer Profile Retrieval
  ├─ Consultation State Management
  ├─ Slot Filling (askOneAtATime)
  ├─ Validation
  ├─ Business Rule Evaluation
  │    └─ eligibility_rules
  └─ API Query
       ├─ product_master
       ├─ product_policy
       ├─ product_search_keyword
       ├─ documents
       └─ consent_mapping
  ↓
[후보 상품 분석]
  ├─ 자격 기준 후보 상품 선정
  └─ 비교 정보 준비
  ↓
[비즈니스 액션 결정]
  ├─ routing_map
  └─ screen_mapping (optional)
  ↓
[LLM 자연어 응답 생성]   ← LLM 호출은 이 단계만
  ↓
신한쏠비즈 앱 화면 (CTA 이동)
  ↓
Backend API
```

---

## 4. 상담 처리 순서 (11단계)

```text
 1. 사용자 발화 수신
 2. Intent 감지
 3. 상담 워크플로우 선택 (고객 목표 확인)
 4. 고객 프로필 조회 (Customer Profile First)
 5. 상담 상태 초기화 / 복원 (Consultation State)
 6. 상담 슬롯 수집 (Slot Filling — 한 번에 하나씩)
 7. 슬롯 검증 (Validation)
 8. 자격 분석 (Business Rule — eligibility_rules)
 9. API 조회 (product_master, product_policy, ...)
10. 후보 상품 분석 (Candidate Products)
11. 비즈니스 액션 결정 + LLM 자연어 응답 생성
```

---

## 5. 상담 상태 (Consultation State)

AI는 대화 전반에 걸쳐 상담 상태를 유지한다.

| 상태 필드 | 설명 |
|---|---|
| `consultationGoal` | 고객이 원하는 상담 목표 |
| `currentStep` | 현재 상담 단계 |
| `collectedSlots` | 수집 완료된 상담 정보 |
| `remainingSlots` | 아직 수집되지 않은 필수 상담 정보 |
| `candidateProducts` | 자격 분석 후 도출된 후보 상품 목록 |
| `eligibilityResult` | eligible / conditionallyEligible / notEligible / needMoreInfo |
| `nextAction` | 다음 비즈니스 액션 |

---

## 6. 아키텍처 용어 전환

| 이전 (v2.x) | 현재 (v3.0) |
|---|---|
| 상품 추천 | 상담 (Consultation) |
| recommend_products | candidate_products |
| 화면 Flow 기반 | 비즈니스 워크플로우 기반 |
| 필수 입력값 | 필수 상담 슬롯 (Consultation Slot) |
| 상품 결과 | 상담 결과 (Consultation Result) |
| 화면 전환 | 다음 비즈니스 액션 (Next Business Action) |

---

## 7. DB 역할

| DB | 역할 | 상품 추가 시 Row 추가 |
|---|---|---|
| `product_master` | 상품 기본정보, 메뉴경로, 카테고리 | 필수 |
| `product_policy` | 한도, 금리, 상환방식, 보증 여부 | 필수 |
| `eligibility_rules` | 자격 분석 조건 (Business Rule 소스) | 필수 |
| `product_search_keyword` | 자연어 검색 키워드 | 필수 |
| `routing_map` | productId 기준 다음 비즈니스 액션 | 필수 |
| `screen_mapping` | 화면 ID·화면명·유형 (상담 이후 선택지) | 조건부 |
| `documents` | 필요서류 | 조건부 |
| `consent_mapping` | 약관/동의서 | 조건부 |
| `slot_definition` | 상담 슬롯 정의 | 조건부 |
| `code_list` | 코드값 정의 | 조건부 |
| `source_map` | 출처 관리 | 선택 |

---

## 8. 상품 추가 절차

```text
1. product_master에 상품 기본정보 추가
2. product_policy에 상품 정책 추가
3. eligibility_rules에 자격 분석 조건 추가
4. product_search_keyword에 자연어 키워드 추가
5. routing_map에 비즈니스 액션 이동 정보 추가
6. 신규 화면이 있으면 screen_mapping 추가
7. 필요서류가 있으면 documents 추가
8. 약관이 있으면 consent_mapping 추가
9. 신규 슬롯 또는 코드가 있으면 slot_definition/code_list 추가
```

---

## 9. Trigger

현재 지원 트리거와 향후 확장 트리거를 정의한다.

| 트리거 유형 | 현재 | 향후 확장 |
|---|---|---|
| 대화 진입 | ✓ | |
| Push 알림 | | ✓ |
| 마케팅 캠페인 | | ✓ |
| 고객 이벤트 | | ✓ |
| 거래 이벤트 | | ✓ |
| AI 제안 질문 | | ✓ |

트리거는 대화 채널에 한정되지 않는다.
상담 워크플로우는 트리거 유형과 무관하게 동일하게 적용된다.
