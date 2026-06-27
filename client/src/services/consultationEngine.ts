/**
 * consultationEngine.ts — 공통 대출상담 프레임워크 v4.0
 *
 * 공통 8단계 상담 플로우:
 *  1. understand_intent   — 대출 의도 파악
 *  2. identify_customer   — 고객 정보 확인
 *  3. check_repayment     — 상환 능력 / DSR 확인 (자동)
 *  4. find_candidates     — 후보 상품 탐색 + 자격 Q&A
 *  5. calculate_estimate  — 예상 한도·금리 산출 (자동)
 *  6. guide_pre_approval  — 예비 승인 안내 (자동)
 *  7. guide_documents     — 필요서류 안내
 *  8. screen_transition   — 신청 화면 이동 CTA (상품카드에 포함)
 *
 * LLM은 사용하지 않는다. 모든 비즈니스 로직은 결정론적으로 처리한다.
 * 채팅창에서 대출을 실행하지 않는다. 최종 액션은 화면 이동 CTA다.
 */

import { createClient } from '@supabase/supabase-js'
import { ProductInfo, CTAInfo } from './loanRuntimeService'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ─── 공통 상담 스텝 ───────────────────────────────────────────────────────────

export type ConsultationStep =
  | 'understand_intent'    // 1. 대출 의도 파악
  | 'identify_customer'    // 2. 고객 정보 확인
  | 'check_repayment'      // 3. 상환 능력 / DSR (자동)
  | 'find_candidates'      // 4. 후보 상품 탐색
  | 'calculate_estimate'   // 5. 예상 한도·금리 산출 (자동)
  | 'guide_pre_approval'   // 6. 예비 승인 안내 (자동)
  | 'guide_documents'      // 7. 필요서류 안내
  | 'screen_transition'    // 8. 신청 화면 이동 CTA
  | 'eligibility_check'    // find_candidates 하위: 자격 Q&A
  | 'complete'             // 상담 완료

// ─── 대출 의도 ────────────────────────────────────────────────────────────────

export type LoanCategory =
  | 'housing' | 'jeonse' | 'credit' | 'refinance'
  | 'business' | 'living_expense' | 'unknown'

export interface LoanIntent {
  loanCategory: LoanCategory
  loanPurposeDetail?: string       // 사업자: 운전자금 / 시설자금 / 창업자금
  desiredAmount?: number
  urgency: 'immediate' | 'within_1_month' | 'future' | 'unknown'
  consultationType: 'limit_check' | 'rate_check' | 'product_compare' | 'pre_approval' | 'application_ready'
}

// ─── 고객 프로파일 ─────────────────────────────────────────────────────────────

export interface CustomerProfile {
  // 공통
  age?: number
  employmentType?: string          // 직장인 | 개인사업자 | 법인사업자 | 프리랜서 | 무직
  annualIncome?: number
  employmentPeriod?: number        // 개월 수
  existingLoanAmount?: number
  creditScoreRange?: string        // 고 | 중 | 저
  housingOwnership?: string
  maritalStatus?: string
  mainBankUsage?: string
  // 사업자 특화
  customerType?: string            // 개인사업자 | 법인 | 소상공인
  guaranteePreference?: string     // none | guarantee
  ratePreference?: string          // low | inquire
}

// ─── 상환 능력 ────────────────────────────────────────────────────────────────

export interface RepaymentCapacity {
  dsrCheckRequired: boolean
  incomeVerified: boolean
  existingLoanVerified: boolean
  estimatedRepaymentCapacity: 'sufficient' | 'limited' | 'insufficient' | 'unknown'
  reason: string[]
}

// ─── 예상 한도·금리 ───────────────────────────────────────────────────────────

export interface EstimatedResult {
  maxLimit?: number
  minInterestRate?: number
  maxInterestRate?: number
  monthlyRepaymentEstimate?: number
  calculationBasis: string[]
  isPreliminary: boolean
}

// ─── 예비 승인 ────────────────────────────────────────────────────────────────

export interface PreApproval {
  status: 'available' | 'conditionally_available' | 'unavailable' | 'need_more_info'
  summary: string
  reason: string[]
  nextStep: string
}

// ─── 자격 규칙 ────────────────────────────────────────────────────────────────

export interface EligibilityCondition {
  ruleId: string
  ruleName: string
  conditionDescription: string
  failMessage: string
  severity: 'blocking' | 'advisory'
  conditionPolarity: 'positive' | 'negative'
}

// ─── 필요서류 ────────────────────────────────────────────────────────────────

export interface DocumentInfo {
  documentId: string
  documentName: string
  required: boolean
  collectionMethod?: string
  remarks?: string
}

// ─── 공통 상담 상태 ───────────────────────────────────────────────────────────

export interface ConsultationState {
  consultationId?: string
  currentStep: ConsultationStep
  loanIntent: Partial<LoanIntent>
  customerProfile: CustomerProfile
  repaymentCapacity?: RepaymentCapacity
  estimatedResult?: EstimatedResult
  preApproval?: PreApproval
  selectedProductIds?: string[]
  eligibilityRules?: EligibilityCondition[]
  eligibilityPendingIdx?: number
  eligibilityAnswers?: Record<string, boolean>
  askingSlot?: string
  turnCount: number
  consultationGoal?: string
}

// ─── CandidateProduct ────────────────────────────────────────────────────────

export interface CandidateProduct extends ProductInfo {
  suitabilityExplanation?: string
}

// ─── 상담 출력 ────────────────────────────────────────────────────────────────

export interface ConsultationOutput {
  currentStep: ConsultationStep
  message: string
  askingSlot?: string
  eligibilityCurrentPolarity?: 'positive' | 'negative'
  candidateProducts: CandidateProduct[]
  eligibilityConditions: EligibilityCondition[]
  documents: DocumentInfo[]
  estimatedResult?: EstimatedResult
  preApproval?: PreApproval
  repaymentCapacity?: RepaymentCapacity
  disclaimer: string
  state: ConsultationState
  debug: {
    loanCategory: string
    consultationGoal?: string
    loanIntent: Partial<LoanIntent>
    customerProfile: CustomerProfile
    pendingSlots: string[]
    matchedKeywords: string[]
    searchMode: string
    queryMs: number
  }
}

// ─── 상수 ─────────────────────────────────────────────────────────────────────

const DISCLAIMER =
  '안내드린 정보는 입력하신 내용과 상품 조건을 기준으로 한 예비 안내이며, ' +
  '실제 대출 가능 여부·한도·금리는 심사 결과에 따라 달라질 수 있습니다.'

// 단계별 필수 슬롯 (사업자 대출 기준)
const UNDERSTAND_INTENT_SLOTS_BUSINESS = ['loanPurposeDetail', 'desiredAmount'] as const
const IDENTIFY_CUSTOMER_SLOTS_BUSINESS = ['customerType'] as const

const SLOT_QUESTIONS: Record<string, string> = {
  loanPurposeDetail:
    '어떤 목적으로 사업 자금이 필요하신가요?\n\n• 운전자금 (매입비, 임차료, 급여 등)\n• 시설자금 (설비, 인테리어, 장비 등)\n• 창업자금',
  desiredAmount:
    '희망하시는 대출 금액을 알려주세요.\n예) 3천만원, 5000만원, 1억',
  customerType:
    '사업자 유형을 알려주세요.\n\n• 개인사업자\n• 법인\n• 소상공인',
}

// ─── 의도 탐지 ────────────────────────────────────────────────────────────────

function detectLoanCategory(text: string): LoanCategory {
  if (/전세|전셋/.test(text)) return 'jeonse'
  if (/주담대|주택담보|아파트.*대출|부동산/.test(text)) return 'housing'
  if (/신용\s*대출|마이너스통장|직장인\s*대출/.test(text)) return 'credit'
  if (/갈아타|대환/.test(text)) return 'refinance'
  if (/사업자|법인|소상공인|땡겨요|보증서|영업|사업\s*자금/.test(text)) return 'business'
  if (/생활비|긴급|개인\s*자금/.test(text)) return 'living_expense'
  return 'unknown'
}

function detectConsultationType(text: string): LoanIntent['consultationType'] {
  if (/비교|차이|어떤\s*게\s*나|vs/.test(text)) return 'product_compare'
  if (/신청|하고\s*싶|진행/.test(text)) return 'application_ready'
  if (/금리|이자/.test(text)) return 'rate_check'
  if (/얼마|한도/.test(text)) return 'limit_check'
  return 'pre_approval'
}

function deriveConsultationGoal(loanIntent: Partial<LoanIntent>): string | undefined {
  if (loanIntent.loanCategory === 'business') {
    if (loanIntent.loanPurposeDetail) return `사업자 ${loanIntent.loanPurposeDetail} 대출 상담`
    return '사업자 대출 상담'
  }
  if (loanIntent.loanCategory === 'jeonse') return '전세자금대출 상담'
  if (loanIntent.loanCategory === 'housing') return '주택담보대출 상담'
  if (loanIntent.loanCategory === 'credit') return '신용대출 상담'
  return undefined
}

// ─── 슬롯 추출 ────────────────────────────────────────────────────────────────

/**
 * 자연어/숫자 표현에서 금액(원)을 추출한다.
 */
function parseAmount(text: string): number | undefined {
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

function extractLoanIntent(text: string, askingSlot?: string): Partial<LoanIntent> {
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

function extractCustomerProfile(text: string, askingSlot?: string): Partial<CustomerProfile> {
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

// ─── 슬롯 유효성 검사 ─────────────────────────────────────────────────────────

function validateSlot(slot: string, value: unknown): { valid: boolean; message?: string } {
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

// ─── 자격 Q&A 헬퍼 ───────────────────────────────────────────────────────────

function detectYesNo(text: string): boolean | undefined {
  const t = text.trim()
  if (/^(네|예|맞|있어|됩니다|그렇습니다|가능합니다|했습니다|됐어|맞아요|네네|응|ㅇ|ok|OK|입점됐|이상됩니다)/i.test(t)) return true
  if (/^(아니|없어|없습니다|안돼|안됩니다|불가|못했|아직|아님|nope)/i.test(t)) return false
  return undefined
}

function buildEligibilityQuestion(rule: EligibilityCondition): string {
  if (rule.conditionPolarity === 'negative') {
    return `[${rule.ruleName}]\n${rule.conditionDescription}\n\n위 항목에 해당 사항이 없으신가요?\n• 네, 해당 없습니다\n• 아니요, 해당 있습니다`
  }
  return `[${rule.ruleName}]\n${rule.conditionDescription}\n\n해당되시나요?\n• 네, 해당됩니다\n• 아니요, 해당 안 됩니다`
}

// ─── 자동 단계: 상환 능력 확인 (Step 3) ─────────────────────────────────────

function checkRepaymentCapacity(
  loanIntent: Partial<LoanIntent>,
  customerProfile: CustomerProfile
): RepaymentCapacity {
  const { annualIncome, existingLoanAmount } = customerProfile
  const { desiredAmount, loanCategory } = loanIntent

  // 사업자 대출은 사업 매출 기반 심사 → 소득 DSR 산출 생략, unknown 처리
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

// ─── 자동 단계: 예상 한도·금리 산출 (Step 5) ─────────────────────────────────

function formatAmount(n?: number): string {
  if (!n) return '심사 후 결정'
  if (n >= 100_000_000) return `${(n / 100_000_000).toLocaleString()}억원`
  if (n >= 10_000) return `${(n / 10_000).toLocaleString()}만원`
  return `${n.toLocaleString()}원`
}

function calculateEstimate(
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

// ─── 자동 단계: 예비 승인 안내 (Step 6) ─────────────────────────────────────

function buildPreApproval(
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

// ─── DB 쿼리 함수 ─────────────────────────────────────────────────────────────

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

async function evaluateEligibilityRules(productIds: string[]): Promise<EligibilityCondition[]> {
  const { data } = await supabase
    .from('eligibility_rules')
    .select('ruleId, productId, ruleName, conditionDescription, failMessage, failAction, status, conditionPolarity, qaTarget')
    .in('productId', productIds)
    .eq('status', 'active')
    .eq('qaTarget', 'user')

  return ((data ?? []) as any[]).map(r => ({
    ruleId: r.ruleId,
    ruleName: r.ruleName,
    conditionDescription: r.conditionDescription,
    failMessage: r.failMessage,
    severity: (r.failAction as string ?? '').startsWith('block') ? ('blocking' as const) : ('advisory' as const),
    conditionPolarity: (r.conditionPolarity ?? 'positive') as 'positive' | 'negative',
  }))
}

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

// ─── 상품 점수 / 적합도 ───────────────────────────────────────────────────────

function scoreProduct(policy: any, loanIntent: Partial<LoanIntent>, customerProfile: CustomerProfile): number {
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

function buildSuitabilityExplanation(
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

function toArray(v: unknown): string[] {
  if (Array.isArray(v)) return v as string[]
  if (typeof v === 'string' && v) {
    try { return JSON.parse(v) } catch { /* not JSON */ }
    return v.split(',').map(s => s.trim()).filter(Boolean)
  }
  return []
}

// ─── 자연어 응답 생성 ─────────────────────────────────────────────────────────

function buildMessage(
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

// ─── 메인 엔진 ───────────────────────────────────────────────────────────────

export async function runConsultation(
  userText: string,
  prevState: ConsultationState | null
): Promise<ConsultationOutput> {
  const start = Date.now()

  // ── 슬롯 추출 ──────────────────────────────────────────────────────────────
  const extractedIntent = extractLoanIntent(userText, prevState?.askingSlot)
  const extractedProfile = extractCustomerProfile(userText, prevState?.askingSlot)

  const loanIntent: Partial<LoanIntent> = { ...prevState?.loanIntent, ...extractedIntent }
  const customerProfile: CustomerProfile = { ...prevState?.customerProfile, ...extractedProfile }
  const turnCount = (prevState?.turnCount ?? 0) + 1
  const consultationGoal = prevState?.consultationGoal ?? deriveConsultationGoal(loanIntent)

  // 현재 질문 중인 슬롯 유효성 검사
  if (prevState?.askingSlot) {
    const slot = prevState.askingSlot
    const val = slot === 'desiredAmount' ? loanIntent.desiredAmount
      : slot === 'loanPurposeDetail' ? loanIntent.loanPurposeDetail
      : slot === 'customerType' ? customerProfile.customerType
      : undefined
    if (val !== undefined) {
      const result = validateSlot(slot, val)
      if (!result.valid) {
        const retryState: ConsultationState = {
          ...(prevState ?? { currentStep: 'understand_intent', loanIntent, customerProfile, turnCount }),
          loanIntent, customerProfile, turnCount, askingSlot: slot,
        }
        return {
          currentStep: prevState!.currentStep,
          message: result.message!,
          askingSlot: slot,
          candidateProducts: [], eligibilityConditions: [], documents: [],
          disclaimer: '',
          state: retryState,
          debug: { loanCategory: loanIntent.loanCategory ?? 'unknown', consultationGoal, loanIntent, customerProfile, pendingSlots: [slot], matchedKeywords: [], searchMode: 'validation_retry', queryMs: Date.now() - start },
        }
      }
    }
  }

  // ── SHORTCUT: 필요서류 조회 (always available) ────────────────────────────
  const isDocumentInquiry = /서류|필요서류|준비서류/.test(userText)
  if (isDocumentInquiry) {
    let docProductIds = prevState?.selectedProductIds ?? []
    let matchedKeywords: string[] = []
    let searchMode = 'selected_context'

    if (!docProductIds.length) {
      const kwResult = await searchProducts(userText)
      docProductIds = kwResult.productIds
      matchedKeywords = kwResult.matchedKeywords
      searchMode = 'keyword'
      if (!docProductIds.length) {
        const { data } = await supabase.from('product_master').select('productId').eq('active', 'Y')
        docProductIds = ((data ?? []) as any[]).map(r => r.productId)
        searchMode = 'slot_fallback'
      }
    }

    const { masters, policyMap } = await queryProductDetails(docProductIds)
    const documents = await queryDocuments(docProductIds)
    const ctaMap = await getBusinessActionCTA(docProductIds)
    const screenIds = Object.values(ctaMap).map((r: any) => r.targetScreenId)
    const screenMap: Record<string, any> = {}
    if (screenIds.length) {
      const { data } = await supabase.from('screen_mapping').select('screenId, screenName').in('screenId', screenIds)
      for (const s of (data ?? []) as any[]) screenMap[s.screenId] = s
    }

    const docProducts: CandidateProduct[] = masters.map(row => {
      const policy = policyMap[row.productId] ?? {}
      const routing = ctaMap[row.productId]
      const screen = routing ? screenMap[routing.targetScreenId] : null
      const cta: CTAInfo | undefined = routing ? {
        label: routing.ctaLabel, action: routing.actionType,
        targetScreenId: routing.targetScreenId,
        targetScreenName: screen?.screenName ?? routing.targetScreenName,
      } : undefined
      return {
        productId: row.productId, productName: row.productName,
        category: row.productCategory ?? '', menuPath: row.menuPath,
        policy: {
          minAmount: policy.minAmount, maxAmount: policy.maxAmount,
          rateType: policy.rateType, minRate: policy.minRate, maxRate: policy.maxRate,
          rateBaseDate: policy.rateBaseDate, maxTerm: policy.maxTerm,
          repaymentOptions: toArray(policy.repaymentOptions), loanType: policy.loanType,
          loanPurpose: policy.loanPurpose, collateralOrGuarantee: policy.collateralOrGuarantee,
          guaranteeRequired: policy.guaranteeRequired, targetCustomer: policy.targetCustomer,
        },
        cta,
      }
    })

    const docState: ConsultationState = {
      ...(prevState ?? { loanIntent: {}, customerProfile: {} }),
      currentStep: 'guide_documents',
      loanIntent, customerProfile, turnCount, consultationGoal,
      selectedProductIds: docProductIds, askingSlot: undefined,
    }
    return {
      currentStep: 'guide_documents',
      message: buildMessage('guide_documents', loanIntent, docProducts, undefined, documents),
      candidateProducts: [],
      eligibilityConditions: [], documents,
      disclaimer: '',
      state: docState,
      debug: { loanCategory: loanIntent.loanCategory ?? 'unknown', consultationGoal, loanIntent, customerProfile, pendingSlots: [], matchedKeywords, searchMode, queryMs: Date.now() - start },
    }
  }

  // ── ELIGIBILITY Q&A 진행 중 ───────────────────────────────────────────────
  if (prevState?.currentStep === 'eligibility_check' && prevState.eligibilityRules?.length) {
    const rules = prevState.eligibilityRules
    const answers = { ...(prevState.eligibilityAnswers ?? {}) }
    const pendingIdx = prevState.eligibilityPendingIdx ?? 0
    const yesNo = detectYesNo(userText)

    if (yesNo === undefined) {
      const currentRule = rules[pendingIdx]
      return {
        currentStep: 'eligibility_check',
        message: `답변을 인식하지 못했습니다. '네' 또는 '아니요'로 답변해 주세요.\n\n${buildEligibilityQuestion(currentRule)}`,
        eligibilityCurrentPolarity: currentRule.conditionPolarity,
        candidateProducts: [], eligibilityConditions: [], documents: [],
        disclaimer: '',
        state: { ...prevState, loanIntent, customerProfile, askingSlot: undefined, turnCount },
        debug: { loanCategory: loanIntent.loanCategory ?? 'unknown', consultationGoal, loanIntent, customerProfile, pendingSlots: [], matchedKeywords: [], searchMode: 'eligibility_check', queryMs: Date.now() - start },
      }
    }

    const currentRule = rules[pendingIdx]
    answers[currentRule.ruleId] = yesNo

    if (!yesNo && currentRule.severity === 'blocking') {
      const failState: ConsultationState = {
        ...prevState, loanIntent, customerProfile, askingSlot: undefined,
        currentStep: 'complete', turnCount, eligibilityAnswers: answers,
      }
      return {
        currentStep: 'complete',
        message: `신청 조건 확인 결과, 현재 조건에서는 신청이 어려울 수 있습니다.\n\n[${currentRule.ruleName}]\n${currentRule.failMessage}\n\n다른 조건이나 상품으로 상담을 원하시면 말씀해 주세요.`,
        candidateProducts: [], eligibilityConditions: [], documents: [],
        disclaimer: '',
        state: failState,
        debug: { loanCategory: loanIntent.loanCategory ?? 'unknown', consultationGoal, loanIntent, customerProfile, pendingSlots: [], matchedKeywords: [], searchMode: 'eligibility_check', queryMs: Date.now() - start },
      }
    }

    const nextIdx = rules.findIndex((r, i) => i > pendingIdx && answers[r.ruleId] === undefined)
    if (nextIdx >= 0) {
      const nextRule = rules[nextIdx]
      const nextState: ConsultationState = {
        ...prevState, loanIntent, customerProfile, askingSlot: undefined,
        currentStep: 'eligibility_check', turnCount,
        eligibilityRules: rules, eligibilityPendingIdx: nextIdx, eligibilityAnswers: answers,
      }
      return {
        currentStep: 'eligibility_check',
        message: buildEligibilityQuestion(nextRule),
        eligibilityCurrentPolarity: nextRule.conditionPolarity,
        candidateProducts: [], eligibilityConditions: [], documents: [],
        disclaimer: '',
        state: nextState,
        debug: { loanCategory: loanIntent.loanCategory ?? 'unknown', consultationGoal, loanIntent, customerProfile, pendingSlots: [], matchedKeywords: [], searchMode: 'eligibility_check', queryMs: Date.now() - start },
      }
    }
    // 모든 Q&A 완료 → fall through to auto-steps
  }

  // ── STEP 1: understand_intent 슬롯 수집 ──────────────────────────────────
  const cat = loanIntent.loanCategory ?? 'unknown'
  if (cat === 'business' || cat === 'unknown') {
    const missingIntent = UNDERSTAND_INTENT_SLOTS_BUSINESS.filter(k => {
      if (k === 'loanPurposeDetail') return !loanIntent.loanPurposeDetail
      if (k === 'desiredAmount') return loanIntent.desiredAmount == null
      return false
    })
    if (missingIntent.length > 0) {
      const nextSlot = missingIntent[0]
      const state: ConsultationState = {
        ...(prevState ?? { loanIntent: {}, customerProfile: {} }),
        currentStep: 'understand_intent', loanIntent, customerProfile,
        turnCount, consultationGoal, askingSlot: nextSlot,
      }
      return {
        currentStep: 'understand_intent',
        message: SLOT_QUESTIONS[nextSlot] ?? `${nextSlot}를 알려주세요.`,
        askingSlot: nextSlot,
        candidateProducts: [], eligibilityConditions: [], documents: [],
        disclaimer: '',
        state,
        debug: { loanCategory: cat, consultationGoal, loanIntent, customerProfile, pendingSlots: missingIntent, matchedKeywords: [], searchMode: 'slot_filling', queryMs: Date.now() - start },
      }
    }
  } else {
    // 사업자 외 대출 유형 → 현재 상품 DB에 해당 상품 없음 안내
    const unsupportedState: ConsultationState = {
      ...(prevState ?? { loanIntent: {}, customerProfile: {} }),
      currentStep: 'find_candidates', loanIntent, customerProfile, turnCount, consultationGoal, askingSlot: undefined,
    }
    return {
      currentStep: 'find_candidates',
      message: `${cat === 'jeonse' ? '전세자금' : cat === 'housing' ? '주택담보' : cat === 'credit' ? '신용' : '해당'} 대출 상담은 현재 준비 중입니다.\n사업자 대출 상담을 원하시면 말씀해 주세요.`,
      candidateProducts: [], eligibilityConditions: [], documents: [],
      disclaimer: '',
      state: unsupportedState,
      debug: { loanCategory: cat, consultationGoal, loanIntent, customerProfile, pendingSlots: [], matchedKeywords: [], searchMode: 'unsupported_category', queryMs: Date.now() - start },
    }
  }

  // ── STEP 2: identify_customer 슬롯 수집 ──────────────────────────────────
  const missingCustomer = IDENTIFY_CUSTOMER_SLOTS_BUSINESS.filter(k => {
    if (k === 'customerType') return !customerProfile.customerType
    return false
  })
  if (missingCustomer.length > 0) {
    const nextSlot = missingCustomer[0]
    const state: ConsultationState = {
      ...(prevState ?? { loanIntent: {}, customerProfile: {} }),
      currentStep: 'identify_customer', loanIntent, customerProfile,
      turnCount, consultationGoal, askingSlot: nextSlot,
    }
    return {
      currentStep: 'identify_customer',
      message: SLOT_QUESTIONS[nextSlot] ?? `${nextSlot}를 알려주세요.`,
      askingSlot: nextSlot,
      candidateProducts: [], eligibilityConditions: [], documents: [],
      disclaimer: '',
      state,
      debug: { loanCategory: cat, consultationGoal, loanIntent, customerProfile, pendingSlots: missingCustomer, matchedKeywords: [], searchMode: 'slot_filling', queryMs: Date.now() - start },
    }
  }

  // ── STEP 3: check_repayment (자동) ───────────────────────────────────────
  const repaymentCapacity = checkRepaymentCapacity(loanIntent, customerProfile)

  // ── STEP 4: find_candidates ───────────────────────────────────────────────
  let productIds: string[]
  let matchedKeywords: string[] = []
  let searchMode: string

  if (prevState?.selectedProductIds?.length && prevState.currentStep === 'eligibility_check') {
    productIds = prevState.selectedProductIds
    searchMode = 'selected_context'
  } else if (prevState?.askingSlot) {
    // Previous turn was collecting a slot answer — the user's reply is a slot value, not a
    // product search query. Skip keyword search to avoid false matches (e.g. '개인사업자'
    // matching a different product's keyword) and fall through to slot_fallback.
    productIds = []
    searchMode = 'slot_answer_fallback'
  } else {
    const kwResult = await searchProducts(userText)
    productIds = kwResult.productIds
    matchedKeywords = kwResult.matchedKeywords
    searchMode = 'keyword'
  }

  if (!productIds.length) {
    searchMode = 'slot_fallback'
    const { data } = await supabase.from('product_master').select('productId').eq('active', 'Y')
    productIds = ((data ?? []) as any[]).map(r => r.productId)
  }

  if (!productIds.length) {
    const emptyState: ConsultationState = {
      currentStep: 'find_candidates', loanIntent, customerProfile, turnCount, consultationGoal, askingSlot: undefined,
    }
    return {
      currentStep: 'find_candidates',
      message: 'DB에 등록된 상품이 없습니다.',
      candidateProducts: [], eligibilityConditions: [], documents: [],
      disclaimer: '',
      state: emptyState,
      debug: { loanCategory: cat, consultationGoal, loanIntent, customerProfile, pendingSlots: [], matchedKeywords, searchMode, queryMs: Date.now() - start },
    }
  }

  const { masters, policyMap } = await queryProductDetails(productIds)

  // 하드 필터: 금액 초과 / 자금 목적 불일치
  const filtered = masters.filter(row => {
    const policy = policyMap[row.productId]
    if (loanIntent.desiredAmount && policy?.maxAmount && loanIntent.desiredAmount > policy.maxAmount) return false
    if (loanIntent.loanPurposeDetail && policy?.loanPurpose) {
      const supported = String(policy.loanPurpose).split(/[,/]/).map((s: string) => s.trim()).filter(Boolean)
      if (supported.length && !supported.includes(loanIntent.loanPurposeDetail)) return false
    }
    return true
  })

  const scored = filtered
    .map(row => ({ row, score: scoreProduct(policyMap[row.productId], loanIntent, customerProfile) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
  const top3Ids = scored.map(p => p.row.productId)

  // 자격 Q&A 시작 (eligibility_check를 막 끝낸 게 아닌 경우)
  if (prevState?.currentStep !== 'eligibility_check' && top3Ids.length > 0) {
    const allRules = await evaluateEligibilityRules(top3Ids)
    if (allRules.length > 0) {
      const firstRule = allRules[0]
      const productNames = scored.map(p => p.row.productName).join(', ')
      const intro = top3Ids.length === 1
        ? `${productNames} 신청 조건을 함께 확인해 드릴게요.`
        : `후보 상품(${productNames}) 신청 조건을 함께 확인해 드릴게요.`
      const checkState: ConsultationState = {
        ...(prevState ?? { loanIntent: {}, customerProfile: {} }),
        currentStep: 'eligibility_check', loanIntent, customerProfile, repaymentCapacity,
        turnCount, consultationGoal, askingSlot: undefined,
        eligibilityRules: allRules, eligibilityPendingIdx: 0, eligibilityAnswers: {},
        selectedProductIds: top3Ids,
      }
      return {
        currentStep: 'eligibility_check',
        message: `${intro}\n\n${buildEligibilityQuestion(firstRule)}`,
        eligibilityCurrentPolarity: firstRule.conditionPolarity,
        candidateProducts: [], eligibilityConditions: [], documents: [],
        disclaimer: '',
        state: checkState,
        debug: { loanCategory: cat, consultationGoal, loanIntent, customerProfile, pendingSlots: [], matchedKeywords, searchMode, queryMs: Date.now() - start },
      }
    }
  }

  // ── STEP 5: calculate_estimate (자동) ─────────────────────────────────────
  const eligibilityAnswers = prevState?.eligibilityAnswers ?? {}
  const eligibilityRules = prevState?.eligibilityRules ?? []
  const estimatedResult = calculateEstimate(top3Ids, policyMap, loanIntent)

  // ── STEP 6: guide_pre_approval (자동) ────────────────────────────────────
  const preApproval = buildPreApproval(estimatedResult, eligibilityAnswers, eligibilityRules, top3Ids.length > 0)

  // ── STEP 8: CTA 빌드 (screen_transition) ────────────────────────────────
  const ctaMap = await getBusinessActionCTA(top3Ids)
  const screenIds = Object.values(ctaMap).map((r: any) => r.targetScreenId)
  const screenMap: Record<string, any> = {}
  if (screenIds.length) {
    const { data } = await supabase.from('screen_mapping').select('screenId, screenName, stepLabel').in('screenId', screenIds)
    for (const s of (data ?? []) as any[]) screenMap[s.screenId] = s
  }

  const candidateProducts: CandidateProduct[] = scored.map(({ row, score }) => {
    const policy = policyMap[row.productId] ?? {}
    const routing = ctaMap[row.productId]
    const screen = routing ? screenMap[routing.targetScreenId] : null
    const cta: CTAInfo | undefined = routing ? {
      label: routing.ctaLabel, action: routing.actionType,
      targetScreenId: routing.targetScreenId,
      targetScreenName: screen?.screenName ?? routing.targetScreenName ?? routing.targetScreenId,
    } : undefined
    return {
      productId: row.productId, productName: row.productName,
      category: row.productCategory ?? '', menuPath: row.menuPath,
      suitabilityExplanation: buildSuitabilityExplanation(row, policy, loanIntent, customerProfile),
      policy: {
        minAmount: policy.minAmount, maxAmount: policy.maxAmount,
        rateType: policy.rateType, minRate: policy.minRate, maxRate: policy.maxRate,
        rateBaseDate: policy.rateBaseDate, maxTerm: policy.maxTerm,
        repaymentOptions: toArray(policy.repaymentOptions), loanType: policy.loanType,
        loanPurpose: policy.loanPurpose, collateralOrGuarantee: policy.collateralOrGuarantee,
        guaranteeRequired: policy.guaranteeRequired, targetCustomer: policy.targetCustomer,
      },
      cta, matchScore: score,
    }
  })

  const completeState: ConsultationState = {
    currentStep: 'complete',
    loanIntent, customerProfile, repaymentCapacity, estimatedResult, preApproval,
    selectedProductIds: top3Ids, eligibilityRules, eligibilityAnswers,
    turnCount, consultationGoal, askingSlot: undefined,
  }

  return {
    currentStep: 'guide_pre_approval',
    message: buildMessage('guide_pre_approval', loanIntent, candidateProducts, preApproval),
    candidateProducts,
    eligibilityConditions: [],
    documents: [],
    estimatedResult,
    preApproval,
    repaymentCapacity,
    disclaimer: DISCLAIMER,
    state: completeState,
    debug: {
      loanCategory: cat, consultationGoal, loanIntent, customerProfile,
      pendingSlots: [], matchedKeywords, searchMode, queryMs: Date.now() - start,
    },
  }
}
