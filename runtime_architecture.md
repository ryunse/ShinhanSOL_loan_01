# runtime_architecture.md

# AI 대출상담 Runtime Architecture

## 1. 목적
신한쏠비즈 대화형 AI 챗봇에서 대출상담 및 상품추천을 처리하기 위한 운영 구조를 정의한다.

## 2. 핵심 원칙
- 상품별 JSON은 런타임에서 사용하지 않는다.
- 상품 정보는 DB Row로 관리한다.
- 화면 순서 기반 Flow가 아니라 사용자 의도 기반 Routing 구조를 사용한다.
- 실제 금융거래 실행은 채팅창이 아니라 앱 화면과 백엔드 API에서 처리한다.
- 상품 추가 시 loan_common.json과 loan_system_prompt.md는 원칙적으로 수정하지 않는다.

## 3. 전체 구조
```text
사용자 발화
  ↓
AI Engine
  ↓
loan_system_prompt.md
  ↓
loan_common.json
  ↓
Product Catalog DB
  ├─ product_master
  ├─ product_policy
  ├─ eligibility_rules
  ├─ product_search_keyword
  ├─ documents
  └─ consent_mapping
  ↓
routing_map
  ↓
screen_mapping
  ↓
화면 이동 CTA
  ↓
신한쏠비즈 앱 화면
  ↓
Backend API
```

## 4. Runtime Sequence
```text
1. 사용자 발화 수신
2. Intent 추출
3. Slot 추출
4. 부족 Slot 확인
5. 상품 후보 검색
6. 상품 정책 확인
7. 신청 가능 조건 확인
8. 상품 추천 또는 부적합 안내
9. routing_map 조회
10. screen_mapping 조회
11. 화면 이동 CTA 생성
```

## 5. DB 역할
| DB | 역할 | 상품 추가 시 Row 추가 |
|---|---|---|
| product_master | 상품 기본정보, 메뉴경로, 카테고리 | 필수 |
| product_policy | 한도, 금리, 상환방식, 보증 여부 | 필수 |
| eligibility_rules | 신청 가능/불가 조건 | 필수 |
| product_search_keyword | 자연어 검색 키워드 | 필수 |
| routing_map | intent + productId 기준 화면 이동 | 필수 |
| screen_mapping | 화면 ID와 화면명, 유형 | 조건부 |
| documents | 필요서류 | 조건부 |
| consent_mapping | 약관/동의서 | 조건부 |
| slot_definition | 신규 입력값 정의 | 조건부 |
| code_list | 신규 코드값 정의 | 조건부 |
| source_map | 출처 관리 | 선택 |
| table_manifest | 테이블 관리 문서 | 불필요 |
| README_TABLE_CSV | 설명 문서 | 불필요 |

## 6. 상품 추가 절차
```text
1. product_master에 상품 기본정보 추가
2. product_policy에 상품 정책 추가
3. eligibility_rules에 신청 가능/불가 조건 추가
4. product_search_keyword에 자연어 키워드 추가
5. routing_map에 intent별 이동 화면 추가
6. 신규 화면이 있으면 screen_mapping 추가
7. 필요서류가 있으면 documents 추가
8. 약관이 있으면 consent_mapping 추가
9. 신규 slot 또는 code가 있으면 slot_definition/code_list 추가
```
