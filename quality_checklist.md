# QUALITY_CHECKLIST

## 목적

본 문서는 리팩토링 완료 후 구조와 기능을 검증하기 위한 체크리스트이다.

Claude Code는 모든 작업 완료 후
아래 항목을 스스로 검증한다.

---

# 1. 기능 검증

## 기존 기능 유지

- [ ] 기존 상담 시나리오가 정상 동작한다.
- [ ] 기존 Intent가 변경되지 않았다.
- [ ] 기존 CTA가 변경되지 않았다.
- [ ] 기존 Routing이 변경되지 않았다.
- [ ] 기존 JSON Schema가 변경되지 않았다.

---

# 2. 정책 검증

## Policy Driven Architecture

- [ ] 상품 데이터가 코드에 하드코딩되지 않았다.
- [ ] 상품 데이터는 DB(Product Catalog)에서 관리된다.
- [ ] 정책은 JSON 또는 DB에서 관리된다.
- [ ] Engine 내부에 상품 조건을 하드코딩하지 않았다.

---

# 3. 유지보수 검증

## 상품 추가

다음을 수정하지 않아도 신규 상품 추가가 가능한가?

- [ ] ConsultationEngine
- [ ] RecommendationEngine
- [ ] EligibilityEngine
- [ ] RankingEngine

필요한 작업은 다음만 수행한다.

- [ ] product_master 추가
- [ ] product_policy 추가
- [ ] eligibility_rules 추가

---

## 정책 변경

다음을 수정하지 않아도 정책 변경이 가능한가?

- [ ] Engine
- [ ] Response
- [ ] UI

필요한 작업

- [ ] eligibility_rules 수정

---

# 4. Layer 검증

다음 Layer가 존재하는가?

- [ ] Consultation
- [ ] Slot
- [ ] Eligibility
- [ ] Recommendation
- [ ] Ranking
- [ ] Response

---

각 Layer가 하나의 책임만 가지는가?

- [ ] YES

---

# 5. Engine 검증

ConsultationEngine

- [ ] Orchestrator 역할만 수행한다.

EligibilityEngine

- [ ] 신청 가능 여부만 판단한다.

RecommendationEngine

- [ ] 추천 후보만 생성한다.

RankingEngine

- [ ] 추천 순위만 계산한다.

ResponseBuilder

- [ ] UI만 생성한다.

---

# 6. Dependency 검증

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

- [ ] Response → Recommendation

- [ ] Recommendation → Consultation

- [ ] Ranking → Eligibility

Layer 간 순환 참조가 없다.

---

# 7. Explainable Recommendation

추천 결과에 다음이 포함되는가?

- [ ] 추천 이유
- [ ] 제외 이유
- [ ] 적용 Rule
- [ ] 미적용 Rule
- [ ] 사용 Slot

---

# 8. Logging

로그에 다음이 기록되는가?

- [ ] Intent

- [ ] Slot

- [ ] Eligibility

- [ ] Recommendation

- [ ] Ranking

- [ ] Response

---

# 9. 테스트 가능성

다음 Engine을 독립 테스트할 수 있는가?

- [ ] Slot

- [ ] Eligibility

- [ ] Recommendation

- [ ] Ranking

---

# 10. MVP 범위 검증

이번 프로젝트 범위를 벗어나지 않았는가?

다음을 구현하지 않았다.

- [ ] Master Agent

- [ ] Shared Context Memory

- [ ] Consent Platform

- [ ] Group Agent

- [ ] Cross Domain Routing

---

# 11. 미래 확장성

향후

```
Master Agent

↓

Loan Consultation Agent
```

구조로 편입 가능한가?

- [ ] YES

---

# 12. 최종 완료 기준

다음을 모두 만족해야 완료로 판단한다.

## 기능

- [ ] 기존 기능 유지

## 구조

- [ ] Layer 분리

- [ ] Engine 분리

- [ ] Policy 기반 구조

## 유지보수

- [ ] 상품 추가 시 코드 수정 없음

- [ ] 정책 변경 시 Engine 수정 없음

## 장애 대응

- [ ] Layer별 원인 추적 가능

## 추천

- [ ] Explainable Recommendation 제공

## 확장성

- [ ] Master Agent 편입 가능

---

# Claude Self Review

리팩토링 완료 후 아래 항목을 요약한다.

## Architecture

PASS / FAIL

## Maintainability

PASS / FAIL

## Scalability

PASS / FAIL

## Explainability

PASS / FAIL

## MVP Scope

PASS / FAIL

## Overall

PASS / FAIL

PASS가 아닌 항목은
원인과 개선 방안을 함께 작성한다.