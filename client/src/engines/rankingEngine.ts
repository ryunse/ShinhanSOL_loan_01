/**
 * rankingEngine.ts — 한도·금리 산출 및 예비 승인 계층
 *
 * 책임:
 *  - EstimateCalculator : 후보 상품 policyMap 기반 예상 한도·금리 산출 (Step 5)
 *  - PreApprovalBuilder : 자격 Q&A 결과 + 예상 한도 기반 예비 승인 판정 (Step 6)
 *  - formatAmount       : 금액(원) → 사람이 읽기 쉬운 문자열 변환 유틸리티
 *
 * 이 모듈은 DB를 직접 조회하지 않는다.
 * 이 모듈은 화면 이동 CTA를 생성하지 않는다.
 */

import { LoanIntent, EstimatedResult, PreApproval, EligibilityCondition } from '@/types/loan.types'

// ─── 유틸리티 ─────────────────────────────────────────────────────────────────

export function formatAmount(n?: number): string {
  if (!n) return '심사 후 결정'
  if (n >= 100_000_000) return `${(n / 100_000_000).toLocaleString()}억원`
  if (n >= 10_000) return `${(n / 10_000).toLocaleString()}만원`
  return `${n.toLocaleString()}원`
}

// ─── EstimateCalculator: 예상 한도·금리 산출 (Step 5) ────────────────────────

export function calculateEstimate(
  top3Ids: string[],
  policyMap: Record<string, any>,
  loanIntent: Partial<LoanIntent>
): EstimatedResult {
  const policies = top3Ids.map(id => policyMap[id]).filter(Boolean)

  if (policies.length === 0) {
    return { calculationBasis: ['후보 상품 없음'], isPreliminary: true }
  }

  const minRates = policies.filter(p => p.minRate != null).map(p => p.minRate as number)
  const maxRates = policies.filter(p => p.maxRate != null).map(p => p.maxRate as number)
  const maxAmounts = policies.filter(p => p.maxAmount != null).map(p => p.maxAmount as number)

  const minInterestRate = minRates.length ? Math.min(...minRates) : undefined
  const maxInterestRate = maxRates.length ? Math.max(...maxRates) : undefined
  const productCap = maxAmounts.length ? Math.min(...maxAmounts) : undefined

  const desiredAmount = loanIntent.desiredAmount
  const maxLimit = desiredAmount && productCap
    ? Math.min(desiredAmount, productCap)
    : productCap ?? desiredAmount

  // 원금균등분할 기준 월 상환액 (최저금리, 36개월)
  let monthlyRepaymentEstimate: number | undefined
  if (maxLimit && minInterestRate) {
    const r = (minInterestRate / 100) / 12
    const n = 36
    monthlyRepaymentEstimate = r > 0
      ? Math.round(maxLimit * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1))
      : Math.round(maxLimit / n)
  }

  return {
    maxLimit,
    minInterestRate,
    maxInterestRate,
    monthlyRepaymentEstimate,
    calculationBasis: [
      '입력 정보 기준 산출 (예비 결과)',
      '최저금리 기준 원금균등분할 36개월 기준 월 상환액',
      '실제 한도·금리는 심사 결과에 따라 달라집니다',
    ],
    isPreliminary: true,
  }
}

// ─── PreApprovalBuilder: 예비 승인 판정 (Step 6) ─────────────────────────────

export function buildPreApproval(
  estimatedResult: EstimatedResult,
  eligibilityAnswers: Record<string, boolean>,
  rules: EligibilityCondition[],
  hasProducts: boolean
): PreApproval {
  if (!hasProducts) {
    return {
      status: 'unavailable',
      summary: '현재 조건에서 신청 가능한 후보 상품을 찾지 못했습니다.',
      reason: ['입력하신 조건에 맞는 상품이 없습니다.'],
      nextStep: '조건을 변경하거나 상담원 연결을 요청해 주세요.',
    }
  }

  const blockingFailed = rules.some(
    r => r.severity === 'blocking' && eligibilityAnswers[r.ruleId] === false
  )
  if (blockingFailed) {
    return {
      status: 'unavailable',
      summary: '신청 필수 조건이 충족되지 않아 현재 신청이 어렵습니다.',
      reason: ['필수 자격 조건 미충족'],
      nextStep: '다른 상품이나 조건으로 재상담을 원하시면 말씀해 주세요.',
    }
  }

  const reasons: string[] = []
  if (estimatedResult.maxLimit) reasons.push(`예상 한도: 최대 ${formatAmount(estimatedResult.maxLimit)}`)
  if (estimatedResult.minInterestRate != null)
    reasons.push(`예상 금리: 연 ${estimatedResult.minInterestRate}% ~ 연 ${estimatedResult.maxInterestRate}%`)
  if (estimatedResult.monthlyRepaymentEstimate)
    reasons.push(`월 예상 상환액: 약 ${formatAmount(estimatedResult.monthlyRepaymentEstimate)} (최저금리·36개월 기준)`)

  return {
    status: 'available',
    summary: '입력하신 정보 기준으로 대출 신청 검토가 가능합니다.',
    reason: reasons,
    nextStep: '아래 상품 카드에서 신청 화면으로 이동하시거나, 필요서류를 먼저 확인해 주세요.',
  }
}
