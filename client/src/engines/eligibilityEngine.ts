/**
 * eligibilityEngine.ts — 자격·상환능력 확인 계층
 *
 * 책임:
 *  - EligibilityQA    : 자격 Q&A 질문 텍스트 생성
 *  - RepaymentChecker : DSR 기반 상환 능력 추정 (Step 3)
 *
 * 이 모듈은 DB를 직접 조회하지 않는다.
 * 이 모듈은 UI(Markdown, Card, CTA)를 생성하지 않는다.
 */

import {
  LoanIntent, CustomerProfile,
  RepaymentCapacity, EligibilityCondition,
} from '@/types/loan.types'

// ─── EligibilityQA: 자격 Q&A 질문 생성 ───────────────────────────────────────

export function buildEligibilityQuestion(rule: EligibilityCondition): string {
  if (rule.conditionPolarity === 'negative') {
    return `[${rule.ruleName}]\n${rule.conditionDescription}\n\n위 항목에 해당 사항이 없으신가요?\n• 네, 해당 없습니다\n• 아니요, 해당 있습니다`
  }
  return `[${rule.ruleName}]\n${rule.conditionDescription}\n\n해당되시나요?\n• 네, 해당됩니다\n• 아니요, 해당 안 됩니다`
}

// ─── RepaymentChecker: DSR 기반 상환 능력 추정 (Step 3) ──────────────────────

export function checkRepaymentCapacity(
  loanIntent: Partial<LoanIntent>,
  customerProfile: CustomerProfile
): RepaymentCapacity {
  const { annualIncome, existingLoanAmount } = customerProfile
  const { desiredAmount, loanCategory } = loanIntent

  // 사업자 대출은 사업 매출 기반 심사 → 소득 DSR 산출 생략
  if (loanCategory === 'business') {
    return {
      dsrCheckRequired: false,
      incomeVerified: false,
      existingLoanVerified: false,
      estimatedRepaymentCapacity: 'unknown',
      reason: ['사업자 대출은 사업장 매출·신용정보 기반으로 심사하며, 정확한 상환 능력은 심사 과정에서 확인됩니다.'],
    }
  }

  if (annualIncome && desiredAmount) {
    const existingAnnual = existingLoanAmount ? existingLoanAmount * 0.04 : 0
    const newAnnual = desiredAmount * 0.06
    const dsr = (existingAnnual + newAnnual) / annualIncome

    if (dsr < 0.4) {
      return {
        dsrCheckRequired: true,
        incomeVerified: true,
        existingLoanVerified: !!existingLoanAmount,
        estimatedRepaymentCapacity: 'sufficient',
        reason: ['추정 DSR 40% 미만으로 상환 여력이 있어 보입니다.'],
      }
    } else if (dsr < 0.7) {
      return {
        dsrCheckRequired: true,
        incomeVerified: true,
        existingLoanVerified: !!existingLoanAmount,
        estimatedRepaymentCapacity: 'limited',
        reason: ['추정 DSR 40~70% 수준으로 상환 여력을 확인할 필요가 있습니다.'],
      }
    } else {
      return {
        dsrCheckRequired: true,
        incomeVerified: true,
        existingLoanVerified: !!existingLoanAmount,
        estimatedRepaymentCapacity: 'insufficient',
        reason: ['추정 DSR 70% 초과로 상환 여력이 제한될 수 있습니다.'],
      }
    }
  }

  return {
    dsrCheckRequired: true,
    incomeVerified: false,
    existingLoanVerified: false,
    estimatedRepaymentCapacity: 'unknown',
    reason: ['소득 정보가 없어 DSR을 산출할 수 없습니다. 심사 과정에서 확인됩니다.'],
  }
}
