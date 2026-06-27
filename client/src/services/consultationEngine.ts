/**
 * consultationEngine.ts
 * 대출상담 AI Agent — 상담 워크플로우 엔진 (v3.0 Consultation First)
 *
 * 처리 순서 (결정론적):
 *  1. Intent Detection
 *  2. Consultation Workflow Selection
 *  3. Customer Profile Retrieval (Customer Profile First)
 *  4. Consultation State Init / Resume
 *  5. Slot Filling (askOneAtATime)
 *  6. Validation
 *  7. Business Rule (eligibility_rules)
 *  8. API Query
 *  9. Candidate Products
 * 10. Business Action
 * 11. Natural Response
 *
 * LLM은 11단계(Natural Response)에서만 호출한다.
 * 모든 비즈니스 로직은 결정론적으로 처리한다.
 */

import { createClient } from '@supabase/supabase-js'
import { ProductInfo, CTAInfo } from './loanRuntimeService'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ─── 상담 상태 타입 ───────────────────────────────────────────────────────────

export type ConsultationStep =
  | 'intent_detection'
  | 'slot_filling'
  | 'validation'
  | 'business_rule'
  | 'eligibility_check'   // 자격 분석 대화형 Q&A
  | 'api_query'
  | 'candidate_products'
  | 'business_action'
  | 'natural_response'
  | 'complete'

export type EligibilityStatus = 'eligible' | 'conditionallyEligible' | 'notEligible' | 'needMoreInfo'

export interface ConsultationSlots {
  customerType?: string        // 고객 유형 (개인사업자 / 법인 / 소상공인)
  loanPurpose?: string         // 대출 목적 (운전자금 / 시설자금 / 창업자금)
  desiredAmount?: number       // 희망 대출 금액
  guaranteePreference?: string // 보증 선호 (none / guarantee)
  ratePreference?: string      // 금리 선호 (low / inquire)
}

export interface ConsultationState {
  consultationGoal?: string    // 고객 목표 (ex: "사업자 신용대출 상담")
  intent: string
  slots: ConsultationSlots
  pendingSlots: string[]       // 미수집 필수 슬롯
  askingSlot?: string          // 현재 질문 중인 슬롯
  step: ConsultationStep
  eligibilityStatus?: EligibilityStatus
  selectedProductIds?: string[] // 직전 상담 완료 후 제시한 후보 상품 ID 목록 (follow-up 맥락 유지)
  eligibilityRules?: EligibilityCondition[] // 자격분석 Q&A 대상 규칙 목록
  eligibilityPendingIdx?: number            // 현재 질문 중인 규칙 인덱스
  eligibilityAnswers?: Record<string, boolean> // ruleId → 통과 여부
  turnCount: number
}

export interface DocumentInfo {
  documentId: string
  documentName: string
  required: boolean
  collectionMethod?: string
  remarks?: string
}

export interface EligibilityCondition {
  ruleId: string
  ruleName: string
  conditionDescription: string
  failMessage: string
  severity: 'blocking' | 'advisory'
}

export interface CandidateProduct extends ProductInfo {
  suitabilityExplanation?: string   // 적합 이유
  eligibilityStatus?: EligibilityStatus
}

export interface ConsultationOutput {
  step: ConsultationStep
  message: string
  askingSlot?: string
  candidateProducts: CandidateProduct[]
  eligibilityConditions: EligibilityCondition[]
  documents: DocumentInfo[]      // 필요서류 (loan_document_inquiry 시 채움)
  disclaimer: string
  state: ConsultationState
  debug: {
    intent: string
    consultationGoal?: string
    slots: ConsultationSlots
    pendingSlots: string[]
    eligibilityStatus?: EligibilityStatus
    matchedKeywords: string[]
    searchMode: string
    queryMs: number
  }
}

// ─── 워크플로우 정의 ────────────────────────────────────────────────────────

// 직전 상담 완료 후 제시한 상품 맥락을 이어받는 후속 인텐트 목록
// 이 인텐트로 전환 시 selectedProductIds가 있으면 상태를 리셋하지 않는다.
const FOLLOW_UP_INTENTS = new Set([
  'loan_document_inquiry',
  'loan_terms_inquiry',
  'loan_eligibility_check',
  'loan_application',
  'loan_product_inquiry',
  'loan_product_comparison',
])

// 상담 유형별 필수 상담 슬롯 수집 순서
const CONSULTATION_REQUIRED_SLOTS: Record<string, string[]> = {
  loan_consultation:      ['customerType', 'loanPurpose', 'desiredAmount'],
  loan_eligibility_check: ['customerType', 'desiredAmount'],
  loan_product_comparison:['customerType', 'loanPurpose'],
  loan_application:       ['desiredAmount'],
  loan_product_inquiry:   [],
  loan_document_inquiry:  [],
  loan_terms_inquiry:     [],
  loan_status_inquiry:    [],
}

// 슬롯별 질문 메시지 (자연스러운 상담사 어조)
const SLOT_QUESTIONS: Record<string, string> = {
  customerType:
    '어떤 유형의 사업자이신가요?\n\n• 개인사업자\n• 법인\n• 소상공인',
  loanPurpose:
    '대출 자금 용도를 알려주세요.\n\n• 운전자금 (매입비, 임차료, 급여 등)\n• 시설자금 (설비, 인테리어 등)\n• 창업자금',
  desiredAmount:
    '희망하시는 대출 금액을 알려주세요.\n예) 3천만원, 5000만원, 1억',
}

// ─── STEP 1: Intent Detection ───────────────────────────────────────────────

function detectIntent(text: string): string {
  if (/서류|필요서류|준비서류/.test(text)) return 'loan_document_inquiry'
  if (/약관|동의서/.test(text)) return 'loan_terms_inquiry'
  if (/비교|차이|어떤\s*게\s*나|둘\s*다|vs/.test(text)) return 'loan_product_comparison'
  if (/신청|하고\s*싶|진행|접수/.test(text)) return 'loan_application'
  if (/가능|될까|되나|받을\s*수|자격|조건/.test(text)) return 'loan_eligibility_check'
  if (/상태|어디까지|심사\s*결과|진행\s*현황/.test(text)) return 'loan_status_inquiry'
  if (/땡겨요|보증서|신용대출|사업자|소상공인/.test(text)) return 'loan_consultation'
  return 'loan_consultation'
}

// 발화에서 상담 목표 추출 (자연어 키워드 기반)
function extractConsultationGoal(text: string, intent: string): string | undefined {
  if (/땡겨요/.test(text)) return '땡겨요 사업자대출 상담'
  if (/보증/.test(text)) return '보증서대출 상담'
  if (/신용\s*대출/.test(text)) return '신용대출 상담'
  if (/사업자/.test(text)) return '사업자 대출 상담'
  if (intent === 'loan_eligibility_check') return '대출 가능 여부 확인'
  if (intent === 'loan_product_comparison') return '대출 상품 비교'
  return undefined
}

// ─── STEP 3: Customer Profile First ─────────────────────────────────────────

interface CustomerProfile {
  customerType?: string
  bankingInfo?: string
}

async function retrieveCustomerProfile(): Promise<CustomerProfile> {
  // 실제 구현에서는 고객 API 호출
  // 프로토타입에서는 빈 프로필 반환 (조회 불가 → askCustomer 폴백)
  return {}
}

// ─── 자격 분석 Q&A 헬퍼 ──────────────────────────────────────────────────────

function detectYesNo(text: string): boolean | undefined {
  const t = text.trim()
  if (/^(네|예|맞|있어|됩니다|그렇습니다|해당됩니다|가능합니다|있습니다|했습니다|됐어|맞아요|네네|응|ㅇ|ok|OK|입점됐|이상됩니다)/.test(t)) return true
  if (/아니|없어|없습니다|안돼|안됩니다|불가|해당\s*(안|없)|못했|아직|아님|nope/.test(t)) return false
  return undefined
}

function buildEligibilityQuestion(rule: EligibilityCondition): string {
  return `[${rule.ruleName}]\n${rule.conditionDescription}\n\n해당되시나요?\n• 네, 해당됩니다\n• 아니요, 해당 안 됩니다`
}

// ─── STEP 5: Slot Filling ────────────────────────────────────────────────────

/**
 * 자연어/숫자 표현에서 금액(원)을 추출한다.
 * 지원 포맷:
 *   N억 M천만 / N억 / 이천만 / N천만 / 천만 / 오백만 / N백만 / 백만
 *   N만 / 콤마 숫자(1,000,000) / 순수 숫자 5자리 이상(1000000)
 */
function parseAmount(text: string): number | undefined {
  const KR: Record<string, number> = { 일: 1, 이: 2, 삼: 3, 사: 4, 오: 5, 육: 6, 칠: 7, 팔: 8, 구: 9 }
  let m: RegExpMatchArray | null

  // N억 M천만 (e.g. 1억5천만, 1억 5000만)
  m = text.match(/(\d+(?:\.\d+)?)\s*억\s*(\d+)\s*천\s*만/)
  if (m) return Math.round(parseFloat(m[1])) * 100_000_000 + parseInt(m[2]) * 10_000_000

  // N억 (e.g. 1억, 1.5억)
  m = text.match(/(\d+(?:\.\d+)?)\s*억/)
  if (m) return Math.round(parseFloat(m[1]) * 100_000_000)

  // 한국어 수사 + 천만 (이천만, 삼천만, 오천만 ...)
  m = text.match(/([일이삼사오육칠팔구])\s*천\s*만/)
  if (m) return (KR[m[1]] ?? 1) * 10_000_000

  // N천만 (숫자 접두, e.g. 3천만, 5천만원)
  m = text.match(/(\d+)\s*천\s*만/)
  if (m) return parseInt(m[1]) * 10_000_000

  // 천만 단독 (e.g. 천만원)
  if (/천\s*만/.test(text)) return 10_000_000

  // 한국어 수사 + 백만 (이백만, 오백만 ...)
  m = text.match(/([일이삼사오육칠팔구])\s*백\s*만/)
  if (m) return (KR[m[1]] ?? 1) * 1_000_000

  // N백만 (숫자 접두, e.g. 5백만, 100백만)
  m = text.match(/(\d+)\s*백\s*만/)
  if (m) return parseInt(m[1]) * 1_000_000

  // 백만 단독 (e.g. 백만원)
  if (/백\s*만/.test(text)) return 1_000_000

  // N만 (e.g. 500만, 3000만원, 3,000만)
  m = text.match(/(\d+(?:,\d{3})*)\s*만/)
  if (m) return parseInt(m[1].replace(/,/g, '')) * 10_000

  // 콤마 구분 숫자 (e.g. 1,000,000원)
  m = text.match(/(\d{1,3}(?:,\d{3})+)\s*원?/)
  if (m) return parseInt(m[1].replace(/,/g, ''))

  // 순수 숫자 5자리 이상 (e.g. 10000, 1000000원)
  m = text.match(/(\d{5,})\s*원?/)
  if (m) return parseInt(m[1])

  return undefined
}

function extractSlots(text: string, askingSlot?: string): Partial<ConsultationSlots> {
  const slots: Partial<ConsultationSlots> = {}

  // 문맥 우선 파싱 — 현재 질문 중인 슬롯에 맞춰 응답 해석
  if (askingSlot === 'customerType' || !askingSlot) {
    if (/개인\s*사업자|자영업/.test(text)) slots.customerType = '개인사업자'
    else if (/법인|기업|주식회사/.test(text)) slots.customerType = '법인'
    else if (/소상공인|소기업/.test(text)) slots.customerType = '소상공인'
  }

  if (askingSlot === 'loanPurpose' || !askingSlot) {
    if (/운전|운영|운영비|매입|임차|급여/.test(text)) slots.loanPurpose = '운전자금'
    else if (/시설|설비|인테리어|장비/.test(text)) slots.loanPurpose = '시설자금'
    else if (/창업/.test(text)) slots.loanPurpose = '창업자금'
  }

  if (askingSlot === 'desiredAmount' || !askingSlot) {
    const parsed = parseAmount(text)
    if (parsed !== undefined) slots.desiredAmount = parsed
  }

  if (/무보증|보증\s*없/.test(text)) slots.guaranteePreference = 'none'
  else if (/보증/.test(text)) slots.guaranteePreference = 'guarantee'

  if (/저금리|낮은\s*금리|이자\s*낮/.test(text)) slots.ratePreference = 'low'
  else if (/금리|이자/.test(text)) slots.ratePreference = 'inquire'

  return slots
}

// ─── STEP 6: Validation ─────────────────────────────────────────────────────

interface ValidationResult { valid: boolean; message?: string }

function validateSlot(slotKey: string, value: unknown): ValidationResult {
  if (slotKey === 'desiredAmount') {
    const n = value as number
    if (!n || n <= 0) return { valid: false, message: '올바른 금액을 입력해 주세요. (예: 3천만원)' }
    if (n > 10_000_000_000) return { valid: false, message: '최대 100억원까지 입력 가능합니다.' }
  }
  if (slotKey === 'customerType') {
    if (!['개인사업자', '법인', '소상공인'].includes(value as string)) {
      return { valid: false, message: '개인사업자, 법인, 소상공인 중 하나를 말씀해 주세요.' }
    }
  }
  if (slotKey === 'loanPurpose') {
    if (!['운전자금', '시설자금', '창업자금'].includes(value as string)) {
      return { valid: false, message: '운전자금, 시설자금, 창업자금 중 하나를 말씀해 주세요.' }
    }
  }
  return { valid: true }
}

// ─── STEP 7: Business Rule — eligibility_rules 조회 ─────────────────────────

async function evaluateEligibilityRules(productIds: string[]): Promise<EligibilityCondition[]> {
  const { data } = await supabase
    .from('eligibility_rules')
    .select('ruleId, productId, ruleName, conditionDescription, failMessage, failAction, status')
    .in('productId', productIds)
    .eq('status', 'active')

  return ((data ?? []) as any[]).map(r => ({
    ruleId: r.ruleId,
    ruleName: r.ruleName,
    conditionDescription: r.conditionDescription,
    failMessage: r.failMessage,
    severity: (r.failAction as string ?? '').startsWith('block') ? ('blocking' as const) : ('advisory' as const),
  }))
}

// ─── STEP 8: API Query ───────────────────────────────────────────────────────

async function searchProducts(userText: string): Promise<{ productIds: string[]; matchedKeywords: string[] }> {
  const keywords = userText.split(/\s+/).filter(w => w.length >= 2)
  const { data } = await supabase.from('product_search_keyword').select('productId, keyword')
  const productIdSet = new Set<string>()
  const matchedKeywords: string[] = []
  for (const row of (data ?? []) as any[]) {
    if (keywords.some(k => (row.keyword as string).includes(k) || k.includes(row.keyword as string))) {
      productIdSet.add(row.productId)
      matchedKeywords.push(row.keyword)
    }
  }
  return { productIds: Array.from(productIdSet), matchedKeywords }
}

async function queryProductDetails(productIds: string[]): Promise<{ masters: any[]; policyMap: Record<string, any> }> {
  const { data: masters } = await supabase
    .from('product_master')
    .select('productId, productName, productCategory, menuPath')
    .in('productId', productIds)
    .eq('active', 'Y')

  const { data: policies } = await supabase
    .from('product_policy')
    .select('productId, minAmount, maxAmount, rateType, minRate, maxRate, rateBaseDate, maxTerm, repaymentOptions, loanType, loanPurpose, collateralOrGuarantee, guaranteeRequired, targetCustomer')
    .in('productId', productIds)

  const policyMap: Record<string, any> = {}
  for (const p of (policies ?? []) as any[]) policyMap[p.productId] = p

  return { masters: masters ?? [], policyMap }
}

// ─── STEP 9: Candidate Products ─────────────────────────────────────────────

function scoreProduct(policy: any, slots: ConsultationSlots): number {
  let score = 0
  if (slots.desiredAmount && policy?.minAmount && policy?.maxAmount) {
    if (slots.desiredAmount >= policy.minAmount && slots.desiredAmount <= policy.maxAmount) score += 35
    else if (slots.desiredAmount < policy.minAmount) score -= 10
    else score -= 20
  }
  if (slots.guaranteePreference === 'none' && policy?.collateralOrGuarantee === '신용') score += 20
  if (slots.guaranteePreference === 'guarantee' && policy?.guaranteeRequired === 'Y') score += 20
  return score
}

function buildSuitabilityExplanation(row: any, policy: any, slots: ConsultationSlots): string {
  const reasons: string[] = []
  if (slots.customerType && policy?.targetCustomer?.includes(slots.customerType.slice(0, 3))) {
    reasons.push(`${slots.customerType} 신청 가능`)
  }
  if (slots.desiredAmount && policy?.minAmount && policy?.maxAmount) {
    if (slots.desiredAmount >= policy.minAmount && slots.desiredAmount <= policy.maxAmount) {
      reasons.push('희망 금액 범위 내 한도 해당')
    }
  }
  if (slots.guaranteePreference === 'none' && policy?.collateralOrGuarantee === '신용') {
    reasons.push('보증 없이 신청 가능')
  }
  if (slots.guaranteePreference === 'guarantee' && policy?.guaranteeRequired === 'Y') {
    reasons.push('보증서 기반 대출')
  }
  return reasons.length ? reasons.join(', ') : '상담 조건에 부합하는 상품'
}

function toArray(v: unknown): string[] {
  if (Array.isArray(v)) return v as string[]
  if (typeof v === 'string' && v) {
    try { return JSON.parse(v) } catch { /* not JSON */ }
    return v.split(',').map(s => s.trim()).filter(Boolean)
  }
  return []
}

// ─── STEP 8-b: Documents Query ───────────────────────────────────────────────

async function queryDocuments(productIds: string[]): Promise<DocumentInfo[]> {
  const { data } = await supabase
    .from('documents')
    .select('documentId, productId, documentName, required, collectionMethod, remarks')
    .in('productId', productIds)
  return ((data ?? []) as any[]).map(r => ({
    documentId: r.documentId ?? '',
    documentName: r.documentName ?? '',
    required: r.required === 'Y' || r.required === true,
    collectionMethod: r.collectionMethod ?? undefined,
    remarks: r.remarks ?? undefined,
  }))
}

// ─── STEP 10: Business Action — routing_map ──────────────────────────────────

async function getBusinessActionCTA(productIds: string[]): Promise<Record<string, any>> {
  const { data } = await supabase
    .from('routing_map')
    .select('productId, actionType, targetScreenId, targetScreenName, ctaLabel, screenType')
    .in('productId', productIds)
    .eq('actionType', 'navigate')
    .eq('screenType', 'screen')
    .order('routingId', { ascending: true })

  const ctaMap: Record<string, any> = {}
  for (const r of (data ?? []) as any[]) {
    if (!ctaMap[r.productId]) ctaMap[r.productId] = r
  }
  return ctaMap
}

// ─── STEP 11: Natural Response ───────────────────────────────────────────────
// (LLM 연동 전 템플릿 방식으로 처리)

function formatAmount(n?: number): string {
  if (!n) return '심사 후 결정'
  if (n >= 100_000_000) return `${(n / 100_000_000).toLocaleString()}억원`
  if (n >= 10_000) return `${(n / 10_000).toLocaleString()}만원`
  return `${n.toLocaleString()}원`
}

function buildNaturalResponse(
  intent: string,
  slots: ConsultationSlots,
  candidateProducts: CandidateProduct[],
  documents: DocumentInfo[] = []
): string {
  const hints: string[] = []
  if (slots.customerType) hints.push(slots.customerType)
  if (slots.loanPurpose) hints.push(slots.loanPurpose)
  if (slots.desiredAmount) hints.push(formatAmount(slots.desiredAmount))
  if (slots.guaranteePreference === 'none') hints.push('무보증')
  if (slots.guaranteePreference === 'guarantee') hints.push('보증부')
  const cond = hints.length ? ` (${hints.join(' · ')})` : ''

  if (intent === 'loan_document_inquiry') {
    if (!candidateProducts.length) return '필요서류 정보를 찾지 못했습니다. 상담원을 통해 확인해 주세요.'
    const productName = candidateProducts[0].productName
    if (documents.length === 0) {
      return `${productName} 필요서류를 안내해드립니다. 실제 제출은 앱 화면에서 진행해 주세요.`
    }
    const required = documents.filter(d => d.required)
    const optional = documents.filter(d => !d.required)
    const lines: string[] = [`[${productName}] 필요서류 안내`]
    if (required.length) {
      lines.push('\n▶ 필수 서류')
      required.forEach(d =>
        lines.push(`• ${d.documentName}${d.collectionMethod ? ` (${d.collectionMethod})` : ''}`)
      )
    }
    if (optional.length) {
      lines.push('\n▶ 해당 시 제출')
      optional.forEach(d =>
        lines.push(`• ${d.documentName}${d.remarks ? ` — ${d.remarks}` : ''}`)
      )
    }
    lines.push('\n실제 제출은 앱 화면에서 진행해 주세요.')
    return lines.join('\n')
  }
  if (intent === 'loan_terms_inquiry') {
    return '약관 및 동의서는 아래 버튼에서 확인하실 수 있습니다. 실제 동의는 앱 화면에서 진행해 주세요.'
  }
  if (intent === 'loan_product_comparison') {
    return candidateProducts.length >= 2
      ? `${cond} 조건에 해당하는 상품 ${candidateProducts.length}건을 비교해드립니다.`
      : `${cond} 조건에 해당하는 상품이 1건 있습니다.`
  }
  if (intent === 'loan_application') {
    return candidateProducts.length
      ? `${candidateProducts[0].productName} 신청 화면으로 이동하실 수 있습니다. 실제 신청은 앱에서 진행해 주세요.`
      : '신청 가능한 상품을 찾지 못했습니다.'
  }
  if (intent === 'loan_eligibility_check') {
    return candidateProducts.length
      ? `아래 상품의 신청 조건을 확인해 보세요.${cond} 실제 가능 여부는 심사 결과에 따라 달라질 수 있습니다.`
      : `입력하신 조건${cond}에 해당하는 상품을 찾지 못했습니다.`
  }
  if (intent === 'loan_status_inquiry') {
    return '대출 신청 및 심사 상태는 앱 화면에서 확인하실 수 있습니다.'
  }
  if (candidateProducts.length === 0) {
    if (slots.desiredAmount) {
      return `희망 금액${cond}을 충족할 수 있는 상품을 찾지 못했습니다.\n희망 금액을 낮추시거나 상담원 연결을 요청해 주세요.`
    }
    return `조건${cond}에 해당하는 상품을 찾지 못했습니다. 조건을 변경하거나 상담원 연결을 요청해 주세요.`
  }
  return `상담 조건${cond}을 검토한 결과, 아래 ${candidateProducts.length}건의 상품이 해당될 수 있습니다.\n실제 한도와 금리는 심사 결과에 따라 달라질 수 있습니다.`
}

// ─── 메인 엔진 ──────────────────────────────────────────────────────────────

export async function runConsultation(
  userText: string,
  prevState: ConsultationState | null
): Promise<ConsultationOutput> {
  const start = Date.now()

  // ── STEP 1: Intent Detection ─────────────────────────────────────────────
  const newIntent = detectIntent(userText)
  const intentChanged = !!(prevState && prevState.intent !== newIntent)
  // 후속 인텐트(서류·약관·자격·신청 등)이고 직전 추천 상품 ID가 있으면 → 상태 리셋 없이 맥락 유지
  const isFollowUpWithContext = !!(intentChanged && prevState?.selectedProductIds?.length && FOLLOW_UP_INTENTS.has(newIntent))

  const baseState: ConsultationState = (intentChanged && !isFollowUpWithContext) || !prevState
    ? {
        intent: newIntent,
        slots: {},
        pendingSlots: [...(CONSULTATION_REQUIRED_SLOTS[newIntent] ?? [])],
        step: 'intent_detection',
        turnCount: 0,
      }
    : { ...prevState, intent: newIntent }

  const intent = baseState.intent
  const turnCount = baseState.turnCount + 1

  // ── STEP 2: Consultation Workflow Selection ───────────────────────────────
  const consultationGoal = baseState.consultationGoal ?? extractConsultationGoal(userText, intent)
  const requiredSlots = CONSULTATION_REQUIRED_SLOTS[intent] ?? []

  // ── STEP 3: Customer Profile First ───────────────────────────────────────
  const profile = await retrieveCustomerProfile()
  const profileSlots: Partial<ConsultationSlots> = {
    ...(profile.customerType ? { customerType: profile.customerType } : {}),
  }

  // ── STEP 4 + 5: Consultation State Update + Slot Filling ─────────────────
  const extracted = extractSlots(userText, baseState.askingSlot)
  const slots: ConsultationSlots = { ...baseState.slots, ...profileSlots, ...extracted }

  // 방금 수집한 슬롯 검증 (STEP 6)
  if (baseState.askingSlot && extracted[baseState.askingSlot as keyof ConsultationSlots] !== undefined) {
    const val = extracted[baseState.askingSlot as keyof ConsultationSlots]
    const validation = validateSlot(baseState.askingSlot, val)
    if (!validation.valid) {
      const retryState: ConsultationState = {
        ...baseState, consultationGoal, slots,
        pendingSlots: requiredSlots.filter(k => slots[k as keyof ConsultationSlots] == null),
        step: 'validation', turnCount,
      }
      return {
        step: 'validation',
        message: validation.message!,
        askingSlot: baseState.askingSlot,
        candidateProducts: [],
        eligibilityConditions: [],
        documents: [],
        disclaimer: '',
        state: retryState,
        debug: {
          intent, consultationGoal, slots,
          pendingSlots: retryState.pendingSlots,
          matchedKeywords: [], searchMode: 'validation_retry',
          queryMs: Date.now() - start,
        },
      }
    }
  }

  // 미수집 필수 슬롯 계산
  const pendingSlots = requiredSlots.filter(k => {
    const v = slots[k as keyof ConsultationSlots]
    return v === undefined || v === null || v === ''
  })

  // 미수집 슬롯 있으면 질문 (Slot Filling)
  if (pendingSlots.length > 0) {
    const nextSlot = pendingSlots[0]
    const askingState: ConsultationState = {
      intent, consultationGoal, slots, pendingSlots,
      askingSlot: nextSlot, step: 'slot_filling', turnCount,
    }
    return {
      step: 'slot_filling',
      message: SLOT_QUESTIONS[nextSlot] ?? `${nextSlot}을 알려주세요.`,
      askingSlot: nextSlot,
      candidateProducts: [],
      eligibilityConditions: [],
      documents: [],
      disclaimer: '',
      state: askingState,
      debug: {
        intent, consultationGoal, slots, pendingSlots,
        matchedKeywords: [], searchMode: 'slot_filling',
        queryMs: Date.now() - start,
      },
    }
  }

  // ── STEP 8: API Query ─────────────────────────────────────────────────────
  let productIds: string[]
  let matchedKeywords: string[] = []
  let searchMode: string

  if (baseState.selectedProductIds?.length && (FOLLOW_UP_INTENTS.has(intent) || baseState.step === 'eligibility_check')) {
    // 후속 질문 또는 자격분석 Q&A 진행 중 — 직전 상담 상품 맥락 유지, 재검색 없음
    productIds = baseState.selectedProductIds
    searchMode = 'selected_context'
  } else {
    const kwResult = await searchProducts(userText)
    productIds = kwResult.productIds
    matchedKeywords = kwResult.matchedKeywords
    searchMode = 'keyword'
    if (productIds.length === 0) {
      searchMode = 'slot_fallback'
      const { data } = await supabase.from('product_master').select('productId').eq('active', 'Y')
      productIds = ((data ?? []) as any[]).map(r => r.productId)
    }
  }

  if (productIds.length === 0) {
    const emptyState: ConsultationState = {
      intent, consultationGoal, slots, pendingSlots: [], step: 'complete', turnCount,
    }
    return {
      step: 'complete',
      message: 'DB에 등록된 상품이 없습니다.',
      candidateProducts: [], eligibilityConditions: [], documents: [], disclaimer: '',
      state: emptyState,
      debug: { intent, consultationGoal, slots, pendingSlots: [], matchedKeywords, searchMode, queryMs: Date.now() - start },
    }
  }

  // ── STEP 9: Candidate Products ────────────────────────────────────────────
  const { masters, policyMap } = await queryProductDetails(productIds)

  // 하드 필터 1: 희망 금액이 상품 최대 한도를 초과하는 상품 제외
  const amountFiltered = masters.filter(row => {
    const policy = policyMap[row.productId]
    if (slots.desiredAmount && policy?.maxAmount && slots.desiredAmount > policy.maxAmount) return false
    return true
  })

  // 하드 필터 2: 자금 목적이 상품의 대출 목적과 맞지 않는 상품 제외
  const purposeFiltered = amountFiltered.filter(row => {
    const policy = policyMap[row.productId]
    if (!slots.loanPurpose || !policy?.loanPurpose) return true
    const supported = String(policy.loanPurpose).split(/[,/]/).map((s: string) => s.trim()).filter(Boolean)
    return supported.length === 0 || supported.includes(slots.loanPurpose)
  })

  const scored = purposeFiltered
    .map(row => ({ row, score: scoreProduct(policyMap[row.productId], slots) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
  const top3Ids = scored.map(p => p.row.productId)

  // ── STEP 7 (이동됨): 자격 분석 대화형 Q&A ────────────────────────────────────
  // follow-up 인텐트 (서류·약관·신청 등)에서는 자격분석 건너뜀
  if (!FOLLOW_UP_INTENTS.has(intent) && top3Ids.length > 0) {
    const productNames = scored.map(p => p.row.productName).join(', ')

    // 자격분석 Q&A 진행 중 — 답변 처리
    if (baseState.step === 'eligibility_check' && baseState.eligibilityRules?.length) {
      const rules = baseState.eligibilityRules
      const answers = { ...(baseState.eligibilityAnswers ?? {}) }
      const pendingIdx = baseState.eligibilityPendingIdx ?? 0
      const yesNo = detectYesNo(userText)

      // 답변 인식 불가 → 같은 질문 재요청
      if (yesNo === undefined) {
        const currentRule = rules[pendingIdx]
        return {
          step: 'eligibility_check',
          message: `답변을 인식하지 못했습니다. '네' 또는 '아니요'로 답변해 주세요.\n\n${buildEligibilityQuestion(currentRule)}`,
          candidateProducts: [], eligibilityConditions: [], documents: [], disclaimer: '',
          // slots: 방금 추출한 slots 저장, askingSlot 초기화 (슬롯 재요청 루프 방지)
          state: { ...baseState, slots, askingSlot: undefined, turnCount },
          debug: { intent, consultationGoal, slots, pendingSlots: [], matchedKeywords, searchMode, queryMs: Date.now() - start },
        }
      }

      const currentRule = rules[pendingIdx]
      answers[currentRule.ruleId] = yesNo

      // 필수 조건 미충족 → 신청 어려움 안내
      if (!yesNo && currentRule.severity === 'blocking') {
        const failState: ConsultationState = {
          ...baseState, slots, askingSlot: undefined, step: 'complete', turnCount,
          eligibilityAnswers: answers, selectedProductIds: top3Ids,
        }
        return {
          step: 'complete',
          message: `신청 조건 확인 결과, 현재 조건에서는 신청이 어려울 수 있습니다.\n\n[${currentRule.ruleName}]\n${currentRule.failMessage}\n\n다른 조건이나 다른 상품으로 상담을 원하시면 말씀해 주세요.`,
          candidateProducts: [], eligibilityConditions: [], documents: [], disclaimer: '',
          state: failState,
          debug: { intent, consultationGoal, slots, pendingSlots: [], matchedKeywords, searchMode, queryMs: Date.now() - start },
        }
      }

      // 다음 미답변 규칙 탐색
      const nextIdx = rules.findIndex((r, i) => i > pendingIdx && answers[r.ruleId] === undefined)
      if (nextIdx >= 0) {
        const nextState: ConsultationState = {
          ...baseState, slots, askingSlot: undefined, step: 'eligibility_check', turnCount,
          eligibilityRules: rules, eligibilityPendingIdx: nextIdx, eligibilityAnswers: answers, selectedProductIds: top3Ids,
        }
        return {
          step: 'eligibility_check',
          message: buildEligibilityQuestion(rules[nextIdx]),
          candidateProducts: [], eligibilityConditions: [], documents: [], disclaimer: '',
          state: nextState,
          debug: { intent, consultationGoal, slots, pendingSlots: [], matchedKeywords, searchMode, queryMs: Date.now() - start },
        }
      }
      // 모든 질문 완료 → fall through to candidate display

    } else if (baseState.step !== 'eligibility_check') {
      // 자격분석 Q&A 새로 시작
      const allRules = await evaluateEligibilityRules(top3Ids)
      if (allRules.length > 0) {
        const firstRule = allRules[0]
        const checkState: ConsultationState = {
          // slots: 방금 추출한 값 반드시 포함, askingSlot 초기화 (슬롯 재요청 루프 방지)
          ...baseState, slots, askingSlot: undefined, step: 'eligibility_check', turnCount,
          eligibilityRules: allRules, eligibilityPendingIdx: 0, eligibilityAnswers: {}, selectedProductIds: top3Ids,
        }
        const intro = top3Ids.length === 1
          ? `${productNames} 신청 조건을 함께 확인해 드릴게요.`
          : `후보 상품(${productNames}) 신청 조건을 함께 확인해 드릴게요.`
        return {
          step: 'eligibility_check',
          message: `${intro}\n\n${buildEligibilityQuestion(firstRule)}`,
          candidateProducts: [], eligibilityConditions: [], documents: [], disclaimer: '',
          state: checkState,
          debug: { intent, consultationGoal, slots, pendingSlots: [], matchedKeywords, searchMode, queryMs: Date.now() - start },
        }
      }
      // 규칙 없음 → fall through to candidate display
    }
  }

  // ── STEP 10: Business Action ──────────────────────────────────────────────
  const ctaMap = await getBusinessActionCTA(top3Ids)

  const screenIds = Object.values(ctaMap).map((r: any) => r.targetScreenId)
  const screenMap: Record<string, any> = {}
  if (screenIds.length > 0) {
    const { data } = await supabase
      .from('screen_mapping')
      .select('screenId, screenName, stepLabel')
      .in('screenId', screenIds)
    for (const s of (data ?? []) as any[]) screenMap[s.screenId] = s
  }

  // ── STEP 11: Natural Response ─────────────────────────────────────────────
  const candidateProducts: CandidateProduct[] = scored.map(({ row, score }) => {
    const policy = policyMap[row.productId] ?? {}
    const routing = ctaMap[row.productId]
    const screen = routing ? screenMap[routing.targetScreenId] : null
    const cta: CTAInfo | undefined = routing
      ? {
          label: routing.ctaLabel,
          action: routing.actionType,
          targetScreenId: routing.targetScreenId,
          targetScreenName: screen?.screenName ?? routing.targetScreenName ?? routing.targetScreenId,
        }
      : undefined

    return {
      productId: row.productId,
      productName: row.productName,
      category: row.productCategory ?? '',
      menuPath: row.menuPath,
      suitabilityExplanation: buildSuitabilityExplanation(row, policy, slots),
      eligibilityStatus: 'needMoreInfo' as EligibilityStatus,
      policy: {
        minAmount: policy.minAmount,
        maxAmount: policy.maxAmount,
        rateType: policy.rateType,
        minRate: policy.minRate,
        maxRate: policy.maxRate,
        rateBaseDate: policy.rateBaseDate,
        maxTerm: policy.maxTerm,
        repaymentOptions: toArray(policy.repaymentOptions),
        loanType: policy.loanType,
        loanPurpose: policy.loanPurpose,
        collateralOrGuarantee: policy.collateralOrGuarantee,
        guaranteeRequired: policy.guaranteeRequired,
        targetCustomer: policy.targetCustomer,
      },
      cta,
      matchScore: score,
    }
  })

  // 필요서류 인텐트면 documents 테이블 조회
  const documents = intent === 'loan_document_inquiry'
    ? await queryDocuments(top3Ids)
    : []

  const completeState: ConsultationState = {
    intent, consultationGoal, slots, pendingSlots: [], askingSlot: undefined,
    step: 'complete', turnCount,
    selectedProductIds: top3Ids,  // 후속 follow-up 질문에서 맥락으로 사용
  }

  return {
    step: 'complete',
    message: buildNaturalResponse(intent, slots, candidateProducts, documents),
    candidateProducts,
    eligibilityConditions: [],
    documents,
    disclaimer: '안내드린 상품 정보는 상담 정보와 상품 조건을 기준으로 한 안내이며, 실제 대출 가능 여부와 한도, 금리는 심사 결과에 따라 달라질 수 있습니다.',
    state: completeState,
    // eligibilityConditions: 자격분석은 대화형 Q&A로 처리하므로 여기선 빈 배열
    debug: {
      intent, consultationGoal, slots, pendingSlots: [],
      matchedKeywords, searchMode, queryMs: Date.now() - start,
    },
  }
}
