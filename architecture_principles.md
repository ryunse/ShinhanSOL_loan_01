# ARCHITECTURE_PRINCIPLES

## 목적

본 문서는 신한 SOL 대출상담 AI(Loan Consultation Agent)의
아키텍처 설계 원칙을 정의한다.

모든 구현과 리팩토링은 본 문서의 원칙을 우선적으로 따른다.

새로운 기능을 추가하거나 구조를 변경하더라도
아래 원칙은 유지되어야 한다.

---

# Principle 1

## Single Responsibility

모든 Layer와 Engine은 하나의 책임만 가진다.

잘못된 예

```
ConsultationEngine

↓

추천

↓

응답 생성

↓

CTA 생성
```

권장

```
ConsultationEngine

↓

RecommendationEngine

↓

ResponseBuilder
```

---

# Principle 2

## Business Logic와 UI 분리

Business Logic는 화면을 생성하지 않는다.

Business Logic는

- Markdown
- Card
- CTA
- Table

를 생성하지 않는다.

화면 표현은 ResponseBuilder만 담당한다.

---

# Principle 3

## Policy Driven Architecture

정책은 코드가 아닌 데이터로 관리한다.

정책 변경 시

Engine을 수정하지 않는다.

예시

상품 조건 변경

↓

eligibility_rules 수정

↓

운영

---

# Principle 4

## DB First

상품 정보는 DB에서 관리한다.

다음 정보를

Prompt

JSON

TypeScript

에 하드코딩하지 않는다.

- 상품명
- 금리
- 한도
- 신청 조건
- 상환 방식

관리 대상

- product_master
- product_policy
- eligibility_rules

---

# Principle 5

## Explainable Recommendation

모든 추천 결과는 설명 가능해야 한다.

반드시 확인 가능해야 하는 정보

- 추천 이유
- 제외 이유
- 적용 Rule
- 미적용 Rule
- 사용 Slot

추천 결과는 블랙박스가 되어서는 안 된다.

---

# Principle 6

## Layer Separation

권장 구조

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

Layer 간 책임을 혼합하지 않는다.

---

# Principle 7

## One Way Dependency

Layer는 아래 방향으로만 의존한다.

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

반대 방향 호출을 금지한다.

금지 예시

```
Response

↓

Recommendation
```

또는

```
Recommendation

↓

Consultation
```

---

# Principle 8

## Product Scalability

상품이 증가해도

Engine은 변경하지 않는다.

상품 추가는

- product_master
- product_policy
- eligibility_rules

추가만으로 가능해야 한다.

목표

```
상품 10개

↓

상품 100개

↓

상품 500개
```

가 되어도

Engine 구조는 동일해야 한다.

---

# Principle 9

## Maintainability

유지보수는

코드 수정이 아니라

정책 수정

데이터 수정

으로 해결하는 것을 목표로 한다.

우선순위

1. DB 수정

2. Policy 수정

3. Engine 수정

---

# Principle 10

## Failure Isolation

장애 발생 시

원인을 Layer 단위로 추적할 수 있어야 한다.

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

각 Layer는 독립적으로 테스트 가능해야 한다.

---

# Principle 11

## Loan Agent Boundary

현재 프로젝트는

Loan Consultation Agent

하나만 구현한다.

다음은 구현 대상이 아니다.

- Master Agent
- 그룹사 Agent
- Shared Context Memory
- Consent Platform
- Cross Domain Routing

향후 Master Agent에서 호출 가능한 구조만 고려한다.

---

# Principle 12

## Backward Compatibility

리팩토링은

기존 기능을 유지하는 것을 전제로 한다.

다음을 변경하지 않는다.

- Intent
- Routing
- Policy 구조
- CTA 구조
- JSON Schema
- DB Schema

구조는 변경할 수 있지만

동작은 변경하지 않는다.

---

# Principle 13

## Testability

모든 Engine은

독립 테스트가 가능해야 한다.

예시

EligibilityEngine

↓

Input

↓

Output

RecommendationEngine

↓

Input

↓

Output

외부 UI나 화면 없이 검증 가능해야 한다.

---

# Principle 14

## Future Compatibility

현재 프로젝트는

Loan Consultation Agent MVP이다.

향후

```
SuperSOL Master Agent

↓

Loan Consultation Agent

↓

Response
```

구조로 편입될 수 있도록 설계한다.

단,

Master Agent 구현은 이번 프로젝트 범위가 아니다.

---

# Principle 15

## MVP First

이번 프로젝트는

기능 추가보다

구조 검증이 목적이다.

성공 기준

- 기존 기능 유지
- 구조 개선
- 유지보수성 확보
- 상품 추가 용이
- 정책 변경 용이
- Explainable Recommendation
- Master Agent 편입 가능

새로운 기능보다
아키텍처 품질을 우선한다.