/**
 * recommendationEngine.ts — 상품 추천 계층
 *
 * 책임:
 *  - ProductScorer      : 후보 상품에 점수를 부여 (의도·프로파일 일치도 기반)
 *  - SuitabilityBuilder : 상품 적합 이유 문장 생성
 *  - toArray            : DB 컬럼(JSON 문자열 또는 배열) → string[] 변환 유틸리티
 *
 * 이 모듈은 DB를 직접 조회하지 않는다.
 * 이 모듈은 화면 이동 CTA 또는 Markdown 레이아웃을 생성하지 않는다.
 */

import { LoanIntent, CustomerProfile } from '@/types/loan.types'

// ─── 유틸리티 ─────────────────────────────────────────────────────────────────

export function toArray(v: unknown): string[] {
  if (Array.isArray(v)) return v as string[]
  if (typeof v === 'string' && v) {
    try { return JSON.parse(v) } catch { /* not JSON */ }
    return v.split(',').map(s => s.trim()).filter(Boolean)
  }
  return []
}

// ─── ProductScorer: 상품 점수화 ───────────────────────────────────────────────

export function scoreProduct(
  policy: any,
  loanIntent: Partial<LoanIntent>,
  customerProfile: CustomerProfile
): number {
  let score = 0
  const { desiredAmount } = loanIntent
  if (desiredAmount && policy?.minAmount && policy?.maxAmount) {
    if (desiredAmount >= policy.minAmount && desiredAmount <= policy.maxAmount) score += 35
    else if (desiredAmount < policy.minAmount) score -= 10
    else score -= 20
  }
  if (customerProfile.guaranteePreference === 'none' && policy?.collateralOrGuarantee === '신용') score += 20
  if (customerProfile.guaranteePreference === 'guarantee' && policy?.guaranteeRequired === 'Y') score += 20
  return score
}

// ─── SuitabilityBuilder: 적합 이유 문장 생성 ──────────────────────────────────

export function buildSuitabilityExplanation(
  row: any,
  policy: any,
  loanIntent: Partial<LoanIntent>,
  customerProfile: CustomerProfile
): string {
  const reasons: string[] = []
  if (customerProfile.customerType && policy?.targetCustomer?.includes(customerProfile.customerType.slice(0, 3)))
    reasons.push(`${customerProfile.customerType} 신청 가능`)
  if (loanIntent.desiredAmount && policy?.minAmount && policy?.maxAmount) {
    if (loanIntent.desiredAmount >= policy.minAmount && loanIntent.desiredAmount <= policy.maxAmount)
      reasons.push('희망 금액 범위 내 한도 해당')
  }
  if (customerProfile.guaranteePreference === 'none' && policy?.collateralOrGuarantee === '신용')
    reasons.push('보증 없이 신청 가능')
  if (customerProfile.guaranteePreference === 'guarantee' && policy?.guaranteeRequired === 'Y')
    reasons.push('보증서 기반 대출')
  return reasons.length ? reasons.join(', ') : '상담 조건에 부합하는 후보 상품'
}
