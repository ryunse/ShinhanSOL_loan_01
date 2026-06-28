# REFACTORING_TASKS

## 목적

현재 프로젝트의 기능은 유지하면서 내부 구조를 개선한다.

이번 리팩토링은 새로운 기능을 개발하는 작업이 아니다.

목표는 다음과 같다.

- 유지보수성 향상
- 확장성 확보
- Engine 간 책임 분리
- 정책 기반 구조 강화
- 상품 및 정책 변경 시 코드 수정 최소화
- 향후 Master Agent 하위 Agent로 편입 가능한 구조 확보

---

# 공통 원칙

모든 작업은 아래 원칙을 반드시 따른다.

## 유지해야 하는 사항

- 기존 기능 변경 금지
- 기존 정책 변경 금지
- 기존 JSON 구조 유지
- 기존 DB 구조 유지
- 기존 Routing 방식 유지
- 기존 CTA 방식 유지

## 변경 가능한 사항

- TypeScript 구조
- Engine 분리
- Layer 분리
- 내부 인터페이스
- 클래스 책임
- 파일 구조

## 변경하지 않는 범위

다음 기능은 이번 MVP 범위가 아니다.

- Master Agent
- 그룹사 Agent
- Shared Context Memory
- Consent Platform
- Cross Domain Routing
- 신규 추천 알고리즘

---

# Task 1

## ConsultationEngine 역할 축소

### 목적

ConsultationEngine을 Orchestrator로 변경한다.

현재

```
Intent

↓

Slot

↓

Recommendation

↓

Response
```

권장

```
ConsultationEngine

↓

EligibilityEngine

↓

RecommendationEngine

↓

RankingEngine

↓

ResponseBuilder
```

### Acceptance Criteria

- Recommendation 로직 제거
- Ranking 제거
- Response 생성 제거
- Slot 처리 제거
- Engine 호출만 수행

---

# Task 2

## EligibilityEngine 생성

### 역할

상품 신청 가능 여부를 판단한다.

### 책임

- 신청 가능 여부 판단
- 실패 Rule 반환
- 실패 사유 생성

### 출력 예시

```json
{
  "eligible": true,
  "failedRules": [],
  "reason": []
}
```

### Acceptance Criteria

- UI 코드 없음
- Markdown 생성 없음
- DB 직접 조회 없음

---

# Task 3

## RecommendationEngine 생성

### 역할

추천 후보를 생성한다.

### 책임

- 후보 상품 생성
- 추천 사유 생성
- Ranking 입력 생성

### 출력 예시

```json
{
  "candidateProducts": [],
  "recommendationReasons": []
}
```

### Acceptance Criteria

- 화면 생성 없음
- CTA 생성 없음

---

# Task 4

## RankingEngine 생성

### 역할

추천 상품의 우선순위를 계산한다.

### 예시 기준

- 고객 목적
- 희망 금액
- 적합도
- 금리
- 상환 방식

### Acceptance Criteria

Ranking만 수행한다.

---

# Task 5

## Slot Layer 생성

생성 대상

- SlotExtractor
- SlotResolver
- SlotValidator

### 역할

Slot 처리 책임을 ConsultationEngine에서 제거한다.

### Acceptance Criteria

ConsultationEngine은 Slot API만 호출한다.

---

# Task 6

## PolicyLoader 생성

### 역할

다음 정책 데이터를 읽는다.

- product_master
- product_policy
- eligibility_rules

### 원칙

Engine은 직접 DB를 조회하지 않는다.

PolicyLoader만 호출한다.

### Acceptance Criteria

Business Logic에서 SQL 또는 CSV를 직접 참조하지 않는다.

---

# Task 7

## LoanConversationState 생성

### 목적

현재 상담 상태를 관리한다.

### 관리 항목

- intent
- slots
- missingSlots
- currentStep
- candidateProducts
- history

### 원칙

ConversationState는 Loan Agent 내부에서만 사용한다.

향후 Master Agent에서도 재사용 가능하도록 설계한다.

---

# Task 8

## ResponseBuilder 생성

### 역할

응답 표현을 담당한다.

### 생성 대상

- Markdown
- Card
- CTA
- Table
- Notice

### 원칙

Business Logic는 UI를 생성하지 않는다.

ResponseBuilder만 화면 표현을 담당한다.

---

# Task 9

## Explainable Recommendation

추천 결과는 반드시 설명 가능해야 한다.

### 포함 항목

- 추천 이유
- 제외 이유
- 적용 Rule
- 미적용 Rule
- 사용된 Slot

### 출력 예시

```json
{
  "productId": "loan001",
  "recommended": true,
  "reasons": [],
  "failedRules": [],
  "usedSlots": []
}
```

---

# Task 10

## Logging 구조 개선

추천 결과를 추적할 수 있도록 로그를 구조화한다.

### 로그 대상

- Intent
- Slot
- Eligibility
- Recommendation
- Ranking
- Response

### 목적

장애 발생 시 원인을 빠르게 찾을 수 있어야 한다.

---

# Task 11

## Layer Dependency 검토

Layer 간 순환 참조를 제거한다.

허용

```
Consultation

↓

Eligibility

↓

Recommendation

↓

Ranking

↓

Response
```

금지

```
Recommendation

↓

Consultation
```

또는

```
Response

↓

Recommendation
```

---

# Task 12

## 리팩토링 완료 조건

다음 조건을 모두 만족하면 완료로 판단한다.

### 기능

- 기존 기능 정상 동작
- 기존 상담 시나리오 유지

### 유지보수

- 상품 추가 시 코드 수정 없음
- 정책 변경 시 Engine 수정 없음

### 구조

- Engine 간 책임 분리
- Layer 간 순환참조 없음
- Policy 중심 구조 유지

### 장애 대응

추천 과정이 다음 순서로 추적 가능해야 한다.

```
Intent

↓

Slot

↓

Eligibility

↓

Recommendation

↓

Ranking

↓

Response
```

### 확장성

향후 다음 구조로 편입 가능해야 한다.

```
Master Agent

↓

Loan Consultation Agent

↓

Response
```

단, Master Agent는 이번 프로젝트에서 구현하지 않는다.