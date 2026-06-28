/**
 * slotEngine.ts — Slot 처리 계층
 *
 * 책임:
 *  - SlotExtractor : 사용자 발화에서 Slot 값 추출
 *  - SlotValidator : 추출된 Slot 값 유효성 검사
 *  - SlotResolver  : 미수집 Slot 확인 및 질문 제공
 *
 * 이 모듈은 DB를 직접 조회하지 않는다.
 * 이 모듈은 UI(Markdown, Card, CTA)를 생성하지 않는다.
 */

import {
  LoanCategory, LoanIntent, CustomerProfile,
} from '@/types/loan.types'

// ─── SlotResolver: 필수 Slot 정의 및 질문 ─────────────────────────────────────

export const UNDERSTAND_INTENT_SLOTS_BUSINESS = ['loanPurposeDetail', 'desiredAmount'] as const
export const IDENTIFY_CUSTOMER_SLOTS_BUSINESS = ['customerType'] as const

export const SLOT_QUESTIONS: Record<string, string> = {
  loanPurposeDetail:
    '어떤 목적으로 사업 자금이 필요하신가요?\n\n• 운전자금 (매입비, 임차료, 급여 등)\n• 시설자금 (설비, 인테리어, 장비 등)\n• 창업자금',
  desiredAmount:
    '희망하시는 대출 금액을 알려주세요.\n예) 3천만원, 5000만원, 1억',
  customerType:
    '사업자 유형을 알려주세요.\n\n• 개인사업자\n• 법인\n• 소상공인',
}

// ─── SlotExtractor: 의도 탐지 ─────────────────────────────────────────────────

export function detectLoanCategory(text: string): LoanCategory {
  if (/전세|전셋/.test(text)) return 'jeonse'
  if (/주담대|주택담보|아파트.*대출|부동산/.test(text)) return 'housing'
  if (/신용\s*대출|마이너스통장|직장인\s*대출/.test(text)) return 'credit'
  if (/갈아타|대환/.test(text)) return 'refinance'
  if (/사업자|법인|소상공인|땡겨요|보증서|영업|사업\s*자금/.test(text)) return 'business'
  if (/생활비|긴급|개인\s*자금/.test(text)) return 'living_expense'
  return 'unknown'
}

export function detectConsultationType(text: string): LoanIntent['consultationType'] {
  if (/비교|차이|어떤\s*게\s*나|vs/.test(text)) return 'product_compare'
  if (/신청|하고\s*싶|진행/.test(text)) return 'application_ready'
  if (/금리|이자/.test(text)) return 'rate_check'
  if (/얼마|한도/.test(text)) return 'limit_check'
  return 'pre_approval'
}

export function deriveConsultationGoal(loanIntent: Partial<LoanIntent>): string | undefined {
  if (loanIntent.loanCategory === 'business') {
    if (loanIntent.loanPurposeDetail) return `사업자 ${loanIntent.loanPurposeDetail} 대출 상담`
    return '사업자 대출 상담'
  }
  if (loanIntent.loanCategory === 'jeonse') return '전세자금대출 상담'
  if (loanIntent.loanCategory === 'housing') return '주택담보대출 상담'
  if (loanIntent.loanCategory === 'credit') return '신용대출 상담'
  return undefined
}

// ─── SlotExtractor: 금액 파싱 ─────────────────────────────────────────────────

export function parseAmount(text: string): number | undefined {
  const KR: Record<string, number> = { 일: 1, 이: 2, 삼: 3, 사: 4, 오: 5, 육: 6, 칠: 7, 팔: 8, 구: 9 }
  let m: RegExpMatchArray | null

  m = text.match(/(\d+(?:\.\d+)?)\s*억\s*(\d+)\s*천\s*만/)
  if (m) return Math.round(parseFloat(m[1])) * 100_000_000 + parseInt(m[2]) * 10_000_000

  m = text.match(/(\d+(?:\.\d+)?)\s*억/)
  if (m) return Math.round(parseFloat(m[1]) * 100_000_000)

  m = text.match(/([일이삼사오육칠팔구])\s*천\s*만/)
  if (m) return (KR[m[1]] ?? 1) * 10_000_000

  m = text.match(/(\d+)\s*천\s*만/)
  if (m) return parseInt(m[1]) * 10_000_000

  if (/천\s*만/.test(text)) return 10_000_000

  m = text.match(/([일이삼사오육칠팔구])\s*백\s*만/)
  if (m) return (KR[m[1]] ?? 1) * 1_000_000

  m = text.match(/(\d+)\s*백\s*만/)
  if (m) return parseInt(m[1]) * 1_000_000

  if (/백\s*만/.test(text)) return 1_000_000

  m = text.match(/(\d+(?:,\d{3})*)\s*만/)
  if (m) return parseInt(m[1].replace(/,/g, '')) * 10_000

  m = text.match(/(\d{1,3}(?:,\d{3})+)\s*원?/)
  if (m) return parseInt(m[1].replace(/,/g, ''))

  m = text.match(/(\d{5,})\s*원?/)
  if (m) return parseInt(m[1])

  return undefined
}

// ─── SlotExtractor: LoanIntent 추출 ──────────────────────────────────────────

export function extractLoanIntent(text: string, askingSlot?: string): Partial<LoanIntent> {
  const intent: Partial<LoanIntent> = {}

  const cat = detectLoanCategory(text)
  if (cat !== 'unknown') intent.loanCategory = cat

  if (askingSlot === 'loanPurposeDetail' || !askingSlot) {
    if (/운전|운영|매입|임차|급여/.test(text)) intent.loanPurposeDetail = '운전자금'
    else if (/시설|설비|인테리어|장비/.test(text)) intent.loanPurposeDetail = '시설자금'
    else if (/창업/.test(text)) intent.loanPurposeDetail = '창업자금'
  }

  if (askingSlot === 'desiredAmount' || !askingSlot) {
    const amount = parseAmount(text)
    if (amount !== undefined) intent.desiredAmount = amount
  }

  if (/급히|긴급|바로|지금\s*당장/.test(text)) intent.urgency = 'immediate'
  else if (/이번\s*달|한\s*달/.test(text)) intent.urgency = 'within_1_month'

  intent.consultationType = detectConsultationType(text)

  return intent
}

// ─── SlotExtractor: CustomerProfile 추출 ──────────────────────────────────────

export function extractCustomerProfile(text: string, askingSlot?: string): Partial<CustomerProfile> {
  const profile: Partial<CustomerProfile> = {}

  if (askingSlot === 'customerType' || !askingSlot) {
    if (/개인\s*사업자|자영업/.test(text)) profile.customerType = '개인사업자'
    else if (/법인|기업|주식회사/.test(text)) profile.customerType = '법인'
    else if (/소상공인|소기업/.test(text)) profile.customerType = '소상공인'
  }

  if (/무보증|보증\s*없/.test(text)) profile.guaranteePreference = 'none'
  else if (/보증/.test(text)) profile.guaranteePreference = 'guarantee'

  if (/저금리|낮은\s*금리|이자\s*낮/.test(text)) profile.ratePreference = 'low'
  else if (/금리|이자/.test(text)) profile.ratePreference = 'inquire'

  return profile
}

// ─── SlotValidator: Slot 유효성 검사 ──────────────────────────────────────────

export function validateSlot(slot: string, value: unknown): { valid: boolean; message?: string } {
  if (slot === 'desiredAmount') {
    const n = value as number
    if (!n || n <= 0) return { valid: false, message: '올바른 금액을 입력해 주세요. (예: 3천만원)' }
    if (n > 10_000_000_000) return { valid: false, message: '최대 100억원까지 입력 가능합니다.' }
  }
  if (slot === 'customerType') {
    if (!['개인사업자', '법인', '소상공인'].includes(value as string))
      return { valid: false, message: '개인사업자, 법인, 소상공인 중 하나를 말씀해 주세요.' }
  }
  if (slot === 'loanPurposeDetail') {
    if (!['운전자금', '시설자금', '창업자금'].includes(value as string))
      return { valid: false, message: '운전자금, 시설자금, 창업자금 중 하나를 말씀해 주세요.' }
  }
  return { valid: true }
}

// ─── SlotExtractor: Yes/No 응답 감지 ─────────────────────────────────────────

export function detectYesNo(text: string): boolean | undefined {
  const t = text.trim()
  if (/^(네|예|맞|있어|됩니다|그렇습니다|가능합니다|했습니다|됐어|맞아요|네네|응|ㅇ|ok|OK|입점됐|이상됩니다)/i.test(t)) return true
  if (/^(아니|없어|없습니다|안돼|안됩니다|불가|못했|아직|아님|nope)/i.test(t)) return false
  return undefined
}
