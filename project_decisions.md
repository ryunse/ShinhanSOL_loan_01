# PROJECT_DECISIONS

> Architecture Decision Record (ADR)

## 목적

본 문서는 신한 SOL 대출상담 AI 프로젝트의 주요 아키텍처 의사결정을 기록한다.

향후 프로젝트가 확장되거나 개발자가 변경되더라도
왜 현재 구조를 선택했는지 이해할 수 있도록 한다.

새로운 구조를 도입하거나 변경할 경우에는
새로운 ADR을 추가하는 것을 원칙으로 한다.

---

# ADR-001

## 제목

DB 중심(Product Catalog) 구조 채택

### 상태

Accepted

### 배경

상품 정보는 지속적으로 변경된다.

- 신규 상품 출시
- 상품 종료
- 금리 변경
- 한도 변경
- 우대조건 변경

상품 정보를 코드나 Prompt에 포함하면
유지보수가 매우 어려워진다.

### 결정

상품 데이터는 DB(Product Catalog)에서 관리한다.

사용 테이블

- product_master
- product_policy
- eligibility_rules
- product_search_keyword

loan_common.json에는 정책만 정의한다.

### 기대효과

- 상품 추가 시 코드 수정 없음
- Prompt 수정 없음
- 정책 변경 최소화
- 운영 편의성 향상

---

# ADR-002

## 제목

Policy Driven Architecture 채택

### 상태

Accepted

### 배경

은행 상품은 정책 변경이 빈번하다.

예시

- 신청 가능 연령
- 소득 조건
- 우대금리
- 신청 가능 대상

### 결정

정책은

- JSON
- DB

에서 관리한다.

Business Logic에는 정책을 하드코딩하지 않는다.

### 기대효과

- 운영자가 정책 수정 가능
- 코드 수정 최소화
- 유지보수 향상

---

# ADR-003

## 제목

Loan Consultation Agent를 독립 Agent로 설계

### 상태

Accepted

### 배경

최종 목표는 SuperSOL AI Platform이다.

그러나 MVP 단계에서
전체 플랫폼을 구현하는 것은 범위가 크다.

### 결정

Loan Consultation 기능만 독립 Agent로 구현한다.

향후

Master Agent

↓

Loan Agent

구조로 편입한다.

### 기대효과

- MVP 구현 가능
- 기능 검증 가능
- 향후 플랫폼 확장 가능

---

# ADR-004

## 제목

Master Agent 구현 제외

### 상태

Accepted

### 배경

현재 프로젝트 목적은

Loan Agent 검증이다.

Master Agent까지 구현하면

- 범위 증가
- 일정 증가
- 복잡도 증가

가 발생한다.

### 결정

Master Agent는 구현하지 않는다.

Interface만 고려한다.

### 기대효과

- MVP 집중
- 일정 단축
- 구조 단순화

---

# ADR-005

## 제목

ConsultationEngine를 Orchestrator로 변경

### 상태

Accepted

### 배경

현재 ConsultationEngine이

- Slot
- Recommendation
- Response

를 모두 수행한다.

### 결정

ConsultationEngine은

상담 흐름만 담당한다.

추천은

RecommendationEngine

응답은

ResponseBuilder

가 담당한다.

### 기대효과

- 책임 분리
- 테스트 용이
- 유지보수 향상

---

# ADR-006

## 제목

Recommendation과 Response 분리

### 상태

Accepted

### 배경

추천 정책과

UI 생성은

변경 주기가 다르다.

### 결정

추천 결과는

RecommendationEngine

UI는

ResponseBuilder

가 생성한다.

### 기대효과

추천 정책 변경이

UI에 영향을 주지 않는다.

---

# ADR-007

## 제목

Explainable Recommendation 적용

### 상태

Accepted

### 배경

금융 서비스는

추천 결과를 설명할 수 있어야 한다.

### 결정

추천 결과에는 반드시

- 추천 이유
- 제외 이유
- 적용 Rule
- 미적용 Rule
- 사용 Slot

을 포함한다.

### 기대효과

- 고객 설명 가능
- 장애 분석 가능
- QA 용이

---

# ADR-008

## 제목

상품 추가 시 Engine 수정 금지

### 상태

Accepted

### 배경

상품은 지속적으로 추가된다.

Engine 수정이 필요하면

운영 비용이 증가한다.

### 결정

상품 추가는

- product_master
- product_policy
- eligibility_rules

추가만으로 가능해야 한다.

### 기대효과

상품 10개

↓

100개

↓

500개

가 되어도

Engine 변경 없이 운영 가능

---

# ADR-009

## 제목

ResponseBuilder 도입

### 상태

Accepted

### 배경

현재 Business Logic에서

Markdown

Card

CTA

생성을 수행한다.

### 결정

ResponseBuilder를 도입한다.

Business Logic는

데이터만 생성한다.

### 기대효과

UI 변경이

Business Logic에 영향을 주지 않는다.

---

# ADR-010

## 제목

MVP 우선 전략

### 상태

Accepted

### 배경

현재 프로젝트는

구조 검증이 목적이다.

기능을 많이 만드는 것이 목표가 아니다.

### 결정

다음 항목을 우선한다.

1. 유지보수성

2. 확장성

3. 정책 중심 구조

4. 장애 대응

5. Explainable Recommendation

신규 기능은 최소화한다.

### 기대효과

고객사 PoC 수행

↓

구조 검증

↓

R&D

↓

SuperSOL 플랫폼 고도화