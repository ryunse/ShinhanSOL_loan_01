# Architecture Review

## 목적

본 문서는 현재 **신한 SOL 대출상담 AI (Loan Consultation Agent)** MVP의 구조를 분석하고,
유지해야 할 설계와 개선이 필요한 구조를 정의하기 위한 문서이다.

이번 리뷰의 목적은 기능을 추가하는 것이 아니다.

다음을 만족하는 구조를 만드는 것이 목표이다.

- 유지보수성 향상
- 확장성 확보
- 장애 대응 용이성 확보
- 상품 및 정책 변경 시 코드 수정 최소화
- 향후 SuperSOL Master Agent 하위 Agent로 편입 가능한 구조 확보

---

# 프로젝트 범위

현재 프로젝트는 **SuperSOL 전체 AI 플랫폼**을 구현하는 프로젝트가 아니다.

현재 범위는 다음과 같다.

```
사용자

↓

Loan Consultation Agent

↓

상품 추천

↓

CTA
```

향후

```
Master Agent

↓

Loan Consultation Agent

↓

Response
```

형태로 편입될 수 있도록 설계한다.

이번 프로젝트에서는 아래 기능은 구현 대상이 아니다.

- Master Agent
- 그룹사 Agent
- Shared Context Memory
- Consent Platform
- Cross Domain Routing

---

# 현재 구조 평가

## Overall

현재 프로젝트는 Loan Consultation Agent MVP 기준으로
상당히 적절한 구조를 가지고 있다.

특히

- DB 중심 설계
- 정책 분리
- 화면 분리
- Intent 기반 구조

는 유지해야 한다.

---

# 유지해야 하는 구조

## 1. DB 중심 구조

상품 데이터는

- product_master
- product_policy
- eligibility_rules

에서 관리한다.

상품 데이터는 JSON이나 Prompt에 포함하지 않는다.

### 유지 이유

상품 추가 및 약관 변경 시
코드 수정 없이 운영이 가능하다.

---

## 2. 정책 분리

loan_common.json은

- Intent
- Slot
- Ranking
- CTA

등 정책만 관리한다.

상품 데이터는 포함하지 않는다.

현재 구조를 유지한다.

---

## 3. 화면 분리

현재

- screen_mapping
- flow_mapping
- routing_map

으로 화면과 업무 로직을 분리하였다.

현재 구조를 유지한다.

---

## 4. Intent 기반 라우팅

사용자의 의도를 기준으로 처리한다.

화면 순서를 기준으로 상담을 진행하지 않는다.

현재 구조를 유지한다.

---

# 개선이 필요한 구조

## Issue 1

### ConsultationEngine

### 현재

ConsultationEngine이

- Intent
- Slot
- Recommendation
- Response

까지 모두 수행한다.

### 문제

하나의 Engine이 너무 많은 책임을 가진다.

상품 증가

정책 증가

Slot 증가

시 유지보수가 어려워진다.

### 개선안

ConsultationEngine은
상담 흐름만 관리하는 Orchestrator 역할만 수행한다.

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

### 기대효과

- 책임 분리
- 테스트 용이
- 유지보수 향상

---

## Issue 2

### Slot Layer

### 현재

Slot 처리가 ConsultationEngine 내부에 존재한다.

### 개선안

Slot Layer를 독립시킨다.

```
SlotExtractor

↓

SlotResolver

↓

SlotValidator
```

### 기대효과

- Slot 정책 변경 용이
- 테스트 용이
- 재사용성 향상

---

## Issue 3

### Recommendation Layer

### 현재

추천과 응답 생성이 함께 이루어진다.

### 개선안

추천 과정을 분리한다.

```
Eligibility

↓

Recommendation

↓

Ranking

↓

Response
```

### 기대효과

추천 정책과 UI 변경을 독립적으로 수행할 수 있다.

---

## Issue 4

### Response Layer

### 현재

Business Logic에서

- Markdown
- Card
- CTA

를 직접 생성한다.

### 개선안

ResponseBuilder를 생성한다.

Business Logic은
데이터만 전달한다.

### 기대효과

UI 변경이 Business Logic에 영향을 주지 않는다.

---

# 유지보수 목표

## 상품 추가

기존

```
Engine 수정
```

↓

목표

```
product_master

+

product_policy

+

eligibility_rules
```

Row 추가만으로 운영 가능

---

## 정책 변경

기존

```
Engine 수정
```

↓

목표

```
eligibility_rules 수정
```

으로 운영 가능

---

# 장애 대응 목표

추천 결과 이상 발생 시

다음 Layer를 순차적으로 확인한다.

```
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

Layer별 책임이 분리되어 있어야
빠르게 원인을 찾을 수 있다.

---

# MVP 성공 기준

이번 프로젝트는 기능 개수가 성공 기준이 아니다.

다음을 만족하면 성공이다.

- 상품 추가 시 코드 수정 없음
- 정책 변경 시 Engine 수정 없음
- 추천 결과 설명 가능
- Layer 간 책임 분리
- 장애 원인 추적 가능
- 향후 Master Agent 편입 가능

---

# 결론

현재 구조는 충분히 좋은 기반을 가지고 있다.

이번 리팩토링은
새로운 기능을 만드는 것이 아니라

**기존 구조를 더욱 모듈화하고 유지보수하기 쉽게 개선하는 것**을 목표로 한다.

Business Logic를 변경하지 않는다.

기존 기능을 유지하는 것이 가장 중요하다.