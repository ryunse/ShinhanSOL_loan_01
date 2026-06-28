# ROADMAP

## 목적

본 문서는 신한 SOL 대출상담 AI 프로젝트의 개발 로드맵을 정의한다.

현재 프로젝트의 범위를 명확히 하고,
향후 SuperSOL AI 플랫폼으로 확장하기 위한 단계별 목표를 제시한다.

이번 프로젝트는 전체 플랫폼 구축이 아닌
**Loan Consultation Agent MVP**를 검증하는 것이 목적이다.

---

# Vision

```
SuperSOL AI Platform

        │

        ▼

+----------------------+
|     Master Agent     |
+----------------------+

        │

 ┌──────┼────────┬────────┬────────┐

 ▼      ▼        ▼        ▼        ▼

Loan   Asset   Banking   Q&A    Group

Agent  Agent    Agent    Agent   Agent

        │

        ▼

Shared Context

Memory

        │

        ▼

Personalized AI Banking
```

---

# Phase 1

## Loan Consultation Agent MVP

### 목적

대출상담 기능을 하나의 독립적인 AI Agent로 구현한다.

### 범위

- 자연어 상담
- 상품 추천
- 상품 비교
- 신청 가능 여부 확인
- CTA 생성
- 정책 기반 추천

### 구현 대상

- Consultation Engine
- Recommendation Engine
- Eligibility Engine
- Ranking Engine
- Response Builder

### 검증 목표

- 독립 실행 가능
- 정책 중심 구조
- 상품 추가 용이
- Explainable Recommendation
- 장애 추적 가능

### 완료 기준

상품 추가 시

```
DB Row 추가

↓

운영 가능
```

---

# Phase 2

## Loan Agent 고도화

### 목적

대출상담 Agent 품질을 향상한다.

### 주요 기능

- 상담 Context 개선
- 추천 품질 향상
- Ranking 고도화
- 추천 사유 강화
- 상담 Flow 개선

### 예상 기능

```
사용자

↓

상황 분석

↓

상품 추천

↓

추천 이유 생성

↓

CTA
```

---

# Phase 3

## Multi Agent 구조 준비

### 목적

Loan Agent를 Master Agent에 연결할 수 있도록 준비한다.

### 추가 기능

- Agent Interface 표준화
- Agent Registry
- Agent Router
- Agent Health Check

### 결과

```
Master Agent

↓

Loan Agent
```

호출 가능

---

# Phase 4

## Personal Finance Agent

### 목적

대출 외 자산관리 영역으로 확장한다.

### 추가 Agent

- 소비 진단
- 투자 진단
- 연금 진단
- 부채 진단

### 목표

```
Master Agent

↓

Asset Agent
```

---

# Phase 5

## Shared Context Memory

### 목적

Agent 간 최소 맥락을 공유한다.

### 예시

```
Loan Agent

↓

Shared Context

↓

Investment Agent
```

공유 정보

- Intent
- Goal
- Topic
- Summary
- Next Action

개인정보는 포함하지 않는다.

---

# Phase 6

## Group Integration

### 목적

은행

카드

증권

보험

그룹사 Agent 연계를 준비한다.

### 고려 사항

- 개인정보 동의
- 신용정보 보호
- 최소 Context 공유
- Routing 정책

---

# Phase 7

## Personalized AI Banking

### 목적

고객 상황에 맞는 AI 금융 서비스를 제공한다.

### Trigger 예시

- 급여 입금
- 예금 만기
- 카드 사용 증가
- 해외 결제
- 대출 보유

### 예시

```
급여 입금

↓

여유자금 확인

↓

적금 추천

↓

가입 CTA
```

---

# Phase 8

## SuperSOL AI Platform

최종 목표

```
                   User

                     │

                     ▼

              Master Agent

                     │

 ┌───────────┬───────────┬───────────┬───────────┐

 ▼           ▼           ▼           ▼

Loan      Asset      Banking      Finance

Agent     Agent       Agent         Q&A

 │           │            │            │

 └───────────┴────────────┴────────────┘

                │

                ▼

      Shared Context Memory

                │

                ▼

       Response Orchestrator

                │

                ▼

           SuperSOL UI
```

---

# 현재 프로젝트 위치

```
Phase 1

■■■■■■■■■■□□□□□□

Loan Consultation Agent MVP
```

---

# MVP 성공 기준

이번 프로젝트에서 검증하고자 하는 핵심은 다음과 같다.

## Architecture

- Layer 분리
- Engine 분리
- Policy 기반 구조

## Maintainability

- 상품 추가 시 코드 수정 없음
- 정책 변경 시 Engine 수정 없음

## Explainability

- 추천 이유 제공
- 제외 이유 제공
- 적용 Rule 제공

## Scalability

향후

```
Master Agent

↓

Loan Agent
```

구조로 편입 가능

---

# 프로젝트 원칙

이번 프로젝트는

기능 구현보다

**구조 검증**

을 우선한다.

이번 MVP는

SuperSOL AI Platform 구축을 위한

**첫 번째 Sub Agent 구현 사례**이다.