import { createClient } from '@supabase/supabase-js'
import { ProductInfo, CTAInfo } from './loanRuntimeService'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ─── 상태 타입 ────────────────────────────────────────────────────────────────

export type ConsultationStep =
  | 'intent_detection'
  | 'slot_filling'
  | 'validation'
  | 'business_rule'
  | 'api_query'
  | 'candidate_products'
  | 'business_action'
  | 'natural_response'
  | 'complete'

export interface ConsultationSlots {
  customerType?: string
  loanPurpose?: string
  desiredAmount?: number
  guaranteePreference?: string
  ratePreference?: string
}

export interface ConsultationState {
  intent: string
  slots: ConsultationSlots
  pendingSlots: string[]    // 아직 수집 못한 슬롯 목록
  askingSlot?: string       // 현재 질문 중인 슬롯
  step: ConsultationStep
  turnCount: number
}

export interface EligibilityResult {
  ruleId: string
  ruleName: string
  conditionDescription: string
  failMessage: string
  status: 'info' | 'warn'
}

export interface ConsultationOutput {
  step: ConsultationStep
  message: string
  askingSlot?: string
  products: ProductInfo[]
  eligibilityNotes: EligibilityResult[]
  disclaimer: string
  state: ConsultationState
  debug: {
    intent: string
    slots: ConsultationSlots
    pendingSlots: string[]
    matchedKeywords: string[]
    searchMode: string
    queryMs: number
  }
}

// ─── 워크플로우 정의 ────────────────────────────────────────────────────────

// intent별 필수 슬롯 수집 순서
const WORKFLOW_REQUIRED_SLOTS: Record<string, string[]> = {
  loan_recommendation:    ['customerType', 'loanPurpose', 'desiredAmount'],
  loan_application:       ['desiredAmount'],
  loan_eligibility_check: ['customerType'],
  loan_document_inquiry:  [],
  loan_terms_inquiry:     [],
  loan_status_inquiry:    [],
}

// 슬롯별 질문 메시지
const SLOT_QUESTIONS: Record<string, string> = {
  customerType:
    '어떤 유형의 사업자이신가요?\n\n• 개인사업자\n• 법인\n• 소상공인',
  loanPurpose:
    '대출 자금 용도를 알려주세요.\n\n• 운전자금 (매입, 임차료, 급여 등)\n• 시설자금 (설비, 인테리어 등)\n• 창업자금',
  desiredAmount:
    '희망하시는 대출 금액을 알려주세요.\n예) 3천만원, 5000만원, 1억',
}

// ─── Intent 감지 ────────────────────────────────────────────────────────────

function detectIntent(text: string): string {
  if (/서류|필요서류|준비서류/.test(text)) return 'loan_document_inquiry'
  if (/약관|동의서/.test(text)) return 'loan_terms_inquiry'
  if (/신청|하고\s*싶|진행|접수/.test(text)) return 'loan_application'
  if (/가능|될까|되나|받을\s*수|자격|조건/.test(text)) return 'loan_eligibility_check'
  if (/상태|어디까지|심사\s*결과|진행\s*현황/.test(text)) return 'loan_status_inquiry'
  return 'loan_recommendation'
}

// ─── 슬롯 추출 ──────────────────────────────────────────────────────────────

function extractSlots(text: string, askingSlot?: string): Partial<ConsultationSlots> {
  const slots: Partial<ConsultationSlots> = {}

  // 문맥 우선: 현재 질문 중인 슬롯에 맞춰 파싱
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
    const m =
      text.match(/(\d+)\s*억\s*(\d+)\s*천/) ||
      text.match(/(\d+(?:\.\d+)?)\s*억/) ||
      text.match(/(\d+)\s*천\s*만|(\d+)\s*천만/) ||
      text.match(/(\d+)\s*백만/) ||
      text.match(/(\d+(?:,\d{3})*)\s*만/)
    if (m) {
      const raw = m[0]
      if (/억.*천/.test(raw)) slots.desiredAmount = parseInt(m[1]) * 100_000_000 + parseInt(m[2]) * 10_000_000
      else if (/억/.test(raw)) slots.desiredAmount = Math.round(parseFloat(m[1]) * 100_000_000)
      else if (/천\s*만|천만/.test(raw)) slots.desiredAmount = parseInt(m[1] ?? m[2]) * 10_000_000
      else if (/백만/.test(raw)) slots.desiredAmount = parseInt(m[1]) * 1_000_000
      else slots.desiredAmount = parseInt(m[1].replace(/,/g, '')) * 10_000
    }
  }

  if (/무보증|보증\s*없/.test(text)) slots.guaranteePreference = 'none'
  else if (/보증/.test(text)) slots.guaranteePreference = 'guarantee'

  if (/저금리|낮은\s*금리|이자\s*낮/.test(text)) slots.ratePreference = 'low'
  else if (/금리|이자/.test(text)) slots.ratePreference = 'inquire'

  return slots
}

// ─── 슬롯 검증 ──────────────────────────────────────────────────────────────

interface ValidationResult { valid: boolean; message?: string }

function validateSlot(slotKey: string, value: unknown): ValidationResult {
  if (slotKey === 'desiredAmount') {
    const n = value as number
    if (!n || n <= 0) return { valid: false, message: '올바른 금액을 입력해 주세요. (예: 3천만원)' }
    if (n > 10_000_000_000) return { valid: false, message: '최대 100억원까지 입력 가능합니다.' }
  }
  if (slotKey === 'customerType') {
    const valid = ['개인사업자', '법인', '소상공인']
    if (!valid.includes(value as string)) {
      return { valid: false, message: '개인사업자, 법인, 소상공인 중 하나를 말씀해 주세요.' }
    }
  }
  if (slotKey === 'loanPurpose') {
    const valid = ['운전자금', '시설자금', '창업자금']
    if (!valid.includes(value as string)) {
      return { valid: false, message: '운전자금, 시설자금, 창업자금 중 하나를 말씀해 주세요.' }
    }
  }
  return { valid: true }
}

// ─── DB 쿼리 레이어 ─────────────────────────────────────────────────────────

async function searchProductsByKeyword(userText: string): Promise<{ productIds: string[]; matchedKeywords: string[] }> {
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

async function queryProducts(productIds: string[]): Promise<{ masters: any[]; policyMap: Record<string, any> }> {
  const { data: masters } = await supabase
    .from('product_master')
    .select('productId, productName, productCategory, menuPath')
    .in('productId', productIds)

  const { data: policies } = await supabase
    .from('product_policy')
    .select('productId, minAmount, maxAmount, rateType, repaymentOptions, loanType, loanPurpose, collateralOrGuarantee, guaranteeRequired, targetCustomer')
    .in('productId', productIds)

  const policyMap: Record<string, any> = {}
  for (const p of (policies ?? []) as any[]) policyMap[p.productId] = p

  return { masters: masters ?? [], policyMap }
}

async function queryRoutingCTA(productIds: string[]): Promise<Record<string, any>> {
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

async function queryEligibilityRules(productIds: string[]): Promise<EligibilityResult[]> {
  const { data } = await supabase
    .from('eligibility_rules')
    .select('ruleId, productId, ruleName, conditionDescription, failMessage, status')
    .in('productId', productIds)
    .eq('status', 'active')

  return ((data ?? []) as any[]).map(r => ({
    ruleId: r.ruleId,
    ruleName: r.ruleName,
    conditionDescription: r.conditionDescription,
    failMessage: r.failMessage,
    status: (r.failAction ?? '').includes('block') ? ('warn' as const) : ('info' as const),
  }))
}

// ─── 스코어링 ─────────────────────────────────────────────────────────────

function scoreProduct(policy: any, slots: ConsultationSlots): number {
  let score = 0
  if (slots.desiredAmount && policy?.minAmount && policy?.maxAmount) {
    if (slots.desiredAmount >= policy.minAmount && slots.desiredAmount <= policy.maxAmount) score += 30
    else if (slots.desiredAmount < policy.minAmount) score -= 10
    else score -= 20
  }
  if (slots.guaranteePreference === 'none' && policy?.collateralOrGuarantee === '신용') score += 20
  if (slots.guaranteePreference === 'guarantee' && policy?.guaranteeRequired === 'Y') score += 20
  return score
}

function toArray(v: unknown): string[] {
  if (Array.isArray(v)) return v as string[]
  if (typeof v === 'string' && v) {
    try { return JSON.parse(v) } catch { /* not JSON */ }
    return v.split(',').map(s => s.trim()).filter(Boolean)
  }
  return []
}

function formatAmount(n?: number): string {
  if (!n) return '심사 후 결정'
  if (n >= 100_000_000) return `${(n / 100_000_000).toLocaleString()}억원`
  if (n >= 10_000) return `${(n / 10_000).toLocaleString()}만원`
  return `${n.toLocaleString()}원`
}

// ─── 자연어 응답 생성 ────────────────────────────────────────────────────────

function buildMessage(intent: string, slots: ConsultationSlots, products: ProductInfo[]): string {
  const hints: string[] = []
  if (slots.customerType) hints.push(slots.customerType)
  if (slots.loanPurpose) hints.push(slots.loanPurpose)
  if (slots.desiredAmount) hints.push(formatAmount(slots.desiredAmount))
  if (slots.guaranteePreference === 'none') hints.push('무보증')
  if (slots.guaranteePreference === 'guarantee') hints.push('보증부')
  const cond = hints.length ? ` (${hints.join(' · ')})` : ''

  if (intent === 'loan_document_inquiry') {
    return products.length
      ? `${products[0].productName} 필요서류를 안내해드립니다. 실제 제출은 앱 화면에서 진행해 주세요.`
      : '필요서류 정보를 찾지 못했습니다. 상담원을 통해 확인해 주세요.'
  }
  if (intent === 'loan_terms_inquiry') {
    return '약관 및 동의서는 아래 버튼에서 확인하실 수 있습니다. 실제 동의는 앱 화면에서 진행해 주세요.'
  }
  if (intent === 'loan_application') {
    return products.length
      ? `${products[0].productName} 신청 화면으로 이동하실 수 있습니다. 실제 신청은 앱에서 진행해 주세요.`
      : '신청 가능한 상품을 찾지 못했습니다.'
  }
  if (intent === 'loan_eligibility_check') {
    return products.length
      ? `아래 상품의 신청 조건을 확인해 보세요.${cond} 실제 가능 여부는 심사 결과에 따라 다를 수 있습니다.`
      : `입력하신 조건${cond}에 맞는 상품을 찾지 못했습니다.`
  }
  if (intent === 'loan_status_inquiry') {
    return '대출 신청 및 심사 상태는 앱 화면에서 확인하실 수 있습니다.'
  }
  if (products.length === 0) {
    return `조건${cond}에 맞는 상품을 찾지 못했습니다. 다른 조건으로 다시 말씀해 주세요.`
  }
  return `조건에 맞는 대출상품 ${products.length}건을 추천해드립니다.${cond}\n실제 한도와 금리는 심사 결과에 따라 달라질 수 있습니다.`
}

// ─── 메인 엔진 ──────────────────────────────────────────────────────────────

export async function runConsultation(
  userText: string,
  prevState: ConsultationState | null
): Promise<ConsultationOutput> {
  const start = Date.now()

  // ── STEP 1: Intent Detection ─────────────────────────────────────────────
  const newIntent = detectIntent(userText)
  // 이전 인텐트와 다르면 상태 초기화 (대화 전환)
  const intentChanged = prevState && prevState.intent !== newIntent
  const baseState: ConsultationState = intentChanged || !prevState
    ? {
        intent: newIntent,
        slots: {},
        pendingSlots: [...(WORKFLOW_REQUIRED_SLOTS[newIntent] ?? [])],
        step: 'intent_detection',
        turnCount: 0,
      }
    : { ...prevState }

  const intent = baseState.intent
  const turnCount = baseState.turnCount + 1

  // ── STEP 2: Consultation Workflow ─────────────────────────────────────────
  const requiredSlots = WORKFLOW_REQUIRED_SLOTS[intent] ?? []

  // ── STEP 3: Consultation State (슬롯 추출 및 병합) ────────────────────────
  const extracted = extractSlots(userText, baseState.askingSlot)
  const slots: ConsultationSlots = { ...baseState.slots, ...extracted }

  // ── STEP 4: Slot Filling (미수집 슬롯 계산) ───────────────────────────────
  const pendingSlots = requiredSlots.filter(key => {
    const v = slots[key as keyof ConsultationSlots]
    return v === undefined || v === null || v === ''
  })

  // 방금 수집한 슬롯 검증
  if (baseState.askingSlot && extracted[baseState.askingSlot as keyof ConsultationSlots] !== undefined) {
    const val = extracted[baseState.askingSlot as keyof ConsultationSlots]
    const validation = validateSlot(baseState.askingSlot, val)
    if (!validation.valid) {
      // ── STEP 5: Validation 실패 → 재질문 ───────────────────────────────
      const retryState: ConsultationState = {
        ...baseState,
        slots,
        pendingSlots,
        step: 'validation',
        turnCount,
      }
      return {
        step: 'validation',
        message: validation.message!,
        askingSlot: baseState.askingSlot,
        products: [],
        eligibilityNotes: [],
        disclaimer: '',
        state: retryState,
        debug: {
          intent, slots, pendingSlots,
          matchedKeywords: [], searchMode: 'validation_retry',
          queryMs: Date.now() - start,
        },
      }
    }
  }

  // ── STEP 4 continued: 수집 안된 슬롯 있으면 다음 질문 ────────────────────
  if (pendingSlots.length > 0) {
    const nextSlot = pendingSlots[0]
    const askingState: ConsultationState = {
      intent, slots, pendingSlots,
      askingSlot: nextSlot,
      step: 'slot_filling',
      turnCount,
    }
    return {
      step: 'slot_filling',
      message: SLOT_QUESTIONS[nextSlot] ?? `${nextSlot}을 알려주세요.`,
      askingSlot: nextSlot,
      products: [],
      eligibilityNotes: [],
      disclaimer: '',
      state: askingState,
      debug: {
        intent, slots, pendingSlots,
        matchedKeywords: [], searchMode: 'slot_filling',
        queryMs: Date.now() - start,
      },
    }
  }

  // ── STEP 6: 모든 슬롯 수집 완료 → API 쿼리 단계 ─────────────────────────

  // 키워드 검색
  const { productIds: kwIds, matchedKeywords } = await searchProductsByKeyword(userText)
  let productIds = kwIds
  let searchMode = 'keyword'

  // 키워드 미매칭이면 전체 활성 상품 폴백
  if (productIds.length === 0) {
    searchMode = 'slot_fallback'
    const { data } = await supabase.from('product_master').select('productId').eq('active', 'Y')
    productIds = ((data ?? []) as any[]).map(r => r.productId)
  }

  if (productIds.length === 0) {
    const emptyState: ConsultationState = { intent, slots, pendingSlots: [], step: 'complete', turnCount }
    return {
      step: 'complete',
      message: 'DB에 등록된 상품이 없습니다.',
      products: [], eligibilityNotes: [], disclaimer: '',
      state: emptyState,
      debug: { intent, slots, pendingSlots: [], matchedKeywords, searchMode, queryMs: Date.now() - start },
    }
  }

  // ── STEP 7: Candidate Products (스코어링 + 상위 3개) ─────────────────────
  const { masters, policyMap } = await queryProducts(productIds)
  const scored = masters
    .map(row => ({ row, score: scoreProduct(policyMap[row.productId], slots) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
  const top3Ids = scored.map(p => p.row.productId)

  // ── STEP 8: Business Rule (적격성 규칙 조회) ─────────────────────────────
  const eligibilityNotes = await queryEligibilityRules(top3Ids)

  // ── STEP 8: Business Action (routing CTA) ────────────────────────────────
  const ctaMap = await queryRoutingCTA(top3Ids)

  const screenIds = Object.values(ctaMap).map((r: any) => r.targetScreenId)
  const screenMap: Record<string, any> = {}
  if (screenIds.length > 0) {
    const { data } = await supabase
      .from('screen_mapping')
      .select('screenId, screenName, stepLabel')
      .in('screenId', screenIds)
    for (const s of (data ?? []) as any[]) screenMap[s.screenId] = s
  }

  // ── STEP 9: Natural Response ─────────────────────────────────────────────
  const products: ProductInfo[] = scored.map(({ row, score }) => {
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
      policy: {
        minAmount: policy.minAmount,
        maxAmount: policy.maxAmount,
        rateType: policy.rateType,
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

  const completeState: ConsultationState = {
    intent, slots, pendingSlots: [], askingSlot: undefined,
    step: 'complete', turnCount,
  }

  return {
    step: 'complete',
    message: buildMessage(intent, slots, products),
    products,
    eligibilityNotes,
    disclaimer: '추천 결과는 입력하신 정보와 상품 조건을 기준으로 한 안내이며, 실제 대출 가능 여부와 한도, 금리는 심사 결과에 따라 달라질 수 있습니다.',
    state: completeState,
    debug: {
      intent, slots, pendingSlots: [],
      matchedKeywords, searchMode,
      queryMs: Date.now() - start,
    },
  }
}
