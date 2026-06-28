/**
 * responseBuilder.ts — 자연어 응답 생성 계층
 *
 * 책임:
 *  - MessageBuilder : 상담 단계(currentStep) + 상품·서류·예비승인 데이터를
 *                     사용자에게 표시할 자연어 문자열로 변환
 *
 * 이 모듈은 DB를 직접 조회하지 않는다.
 * 이 모듈은 화면 이동 CTA를 생성하지 않는다.
 * 금액 포맷은 rankingEngine.formatAmount를 위임해 사용한다.
 */

import {
  ConsultationStep, LoanIntent, CandidateProduct, PreApproval, DocumentInfo,
} from '@/types/loan.types'
import { formatAmount } from '@/engines/rankingEngine'

// ─── MessageBuilder ───────────────────────────────────────────────────────────

export function buildMessage(
  currentStep: ConsultationStep,
  loanIntent: Partial<LoanIntent>,
  candidateProducts: CandidateProduct[],
  preApproval?: PreApproval,
  documents: DocumentInfo[] = []
): string {
  const amt = loanIntent.desiredAmount ? formatAmount(loanIntent.desiredAmount) : ''
  const purpose = loanIntent.loanPurposeDetail ?? ''
  const cond = [purpose, amt].filter(Boolean).join(' · ')
  const condStr = cond ? ` (${cond})` : ''

  if (currentStep === 'guide_documents') {
    if (!candidateProducts.length) return '필요서류 정보를 찾지 못했습니다. 상담원을 통해 확인해 주세요.'
    const productName = candidateProducts[0].productName
    if (!documents.length) return `${productName} 필요서류를 안내해드립니다.`
    const req = documents.filter(d => d.required)
    const opt = documents.filter(d => !d.required)
    const lines = [`[${productName}] 필요서류 안내`]
    if (req.length) {
      lines.push('\n▶ 필수 서류')
      req.forEach(d => lines.push(`• ${d.documentName}${d.collectionMethod ? ` (${d.collectionMethod})` : ''}`))
    }
    if (opt.length) {
      lines.push('\n▶ 해당 시 제출')
      opt.forEach(d => lines.push(`• ${d.documentName}${d.remarks ? ` — ${d.remarks}` : ''}`))
    }
    lines.push('\n실제 제출은 앱 화면에서 진행해 주세요.')
    return lines.join('\n')
  }

  if (currentStep === 'guide_pre_approval' || currentStep === 'complete') {
    if (!preApproval) return '상담이 완료되었습니다.'
    if (preApproval.status === 'unavailable') {
      return `${preApproval.summary}\n\n${preApproval.nextStep}`
    }
    const lines = [preApproval.summary]
    if (preApproval.reason.length) lines.push('', ...preApproval.reason.map(r => `• ${r}`))
    lines.push('', preApproval.nextStep)
    lines.push('', '* 모든 결과는 예비 안내이며 실제 심사 결과에 따라 달라질 수 있습니다.')
    return lines.join('\n')
  }

  if (currentStep === 'find_candidates') {
    if (!candidateProducts.length)
      return `현재 입력하신 정보${condStr} 기준으로 해당하는 후보 상품을 찾지 못했습니다.\n희망 금액이나 조건을 변경해 보세요.`
    return `현재 입력하신 정보${condStr} 기준으로 확인 가능한 후보 상품은 다음과 같습니다.`
  }

  return `상담 조건${condStr}을 검토한 결과입니다.`
}
