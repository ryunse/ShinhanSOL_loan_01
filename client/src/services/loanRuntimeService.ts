import {
  CTAInfo, ProductInfo, ExtractedSlots, LoanRuntimeInput, LoanRuntimeOutput,
} from '@/types/loan.types'
import * as policyLoader from '@/loaders/policyLoader'
import { toArray } from '@/engines/recommendationEngine'
import { formatAmount } from '@/engines/rankingEngine'

export type { CTAInfo, ProductInfo, ExtractedSlots, LoanRuntimeInput, LoanRuntimeOutput }

// ─── Intent 탐지 ──────────────────────────────────────────────────────────────

function extractIntent(userText: string): { intent: string; confidence: number; source: string } {
  const t = userText
  if (/서류|필요서류|준비서류/.test(t)) return { intent: 'loan_document_inquiry', confidence: 0.9, source: 'keyword' }
  if (/약관|동의서|동의/.test(t)) return { intent: 'loan_terms_inquiry', confidence: 0.9, source: 'keyword' }
  if (/신청|하고\s*싶|진행|접수/.test(t)) return { intent: 'loan_application', confidence: 0.85, source: 'keyword' }
  if (/가능|될까|되나|받을\s*수|자격/.test(t)) return { intent: 'loan_eligibility_check', confidence: 0.85, source: 'keyword' }
  if (/상태|어디까지|심사\s*결과|진행\s*현황/.test(t)) return { intent: 'loan_status_inquiry', confidence: 0.8, source: 'keyword' }
  return { intent: 'loan_recommendation', confidence: 0.7, source: 'default' }
}

// ─── Slot 추출 ─────────────────────────────────────────────────────────────────

function extractSlots(userText: string): ExtractedSlots {
  const slots: ExtractedSlots = {}

  const amountMatch =
    userText.match(/(\d+)\s*억\s*(\d+)\s*천/) ||
    userText.match(/(\d+(?:\.\d+)?)\s*억/) ||
    userText.match(/(\d+)\s*천\s*만/) ||
    userText.match(/(\d+)\s*천만/) ||
    userText.match(/(\d+)\s*백만/) ||
    userText.match(/(\d+(?:,\d{3})*)\s*만/)

  if (amountMatch) {
    const raw = amountMatch[0]
    if (/억.*천/.test(raw)) {
      slots.desiredAmount = parseInt(amountMatch[1]) * 100000000 + parseInt(amountMatch[2]) * 10000000
    } else if (/억/.test(raw)) {
      slots.desiredAmount = Math.round(parseFloat(amountMatch[1]) * 100000000)
    } else if (/천\s*만|천만/.test(raw)) {
      slots.desiredAmount = parseInt(amountMatch[1]) * 10000000
    } else if (/백만/.test(raw)) {
      slots.desiredAmount = parseInt(amountMatch[1]) * 1000000
    } else if (/만/.test(raw)) {
      slots.desiredAmount = parseInt(amountMatch[1].replace(/,/g, '')) * 10000
    }
  }

  if (/개인\s*사업자|자영업자?/.test(userText)) slots.customerType = '개인사업자'
  else if (/법인|기업|주식회사|유한회사/.test(userText)) slots.customerType = '법인'
  else if (/소상공인|소기업/.test(userText)) slots.customerType = '소상공인'

  if (/운전\s*자금|운영\s*자금|운영비/.test(userText)) slots.loanPurpose = '운전자금'
  else if (/시설|설비|인테리어|장비|리모델링/.test(userText)) slots.loanPurpose = '시설자금'
  else if (/창업/.test(userText)) slots.loanPurpose = '창업자금'

  if (/무보증|보증\s*없이|보증\s*없는/.test(userText)) slots.guaranteePreference = 'none'
  else if (/보증/.test(userText)) slots.guaranteePreference = 'guarantee'

  if (/저금리|금리\s*낮|낮은\s*금리|이자\s*낮/.test(userText)) slots.ratePreference = 'low'
  else if (/금리|이자/.test(userText)) slots.ratePreference = 'inquire'

  return slots
}

// ─── 상품 점수화 (ExtractedSlots 기반) ────────────────────────────────────────

function scoreProduct(policy: any, slots: ExtractedSlots): number {
  let score = 0
  if (slots.desiredAmount && policy?.minAmount && policy?.maxAmount) {
    if (slots.desiredAmount >= policy.minAmount && slots.desiredAmount <= policy.maxAmount) score += 30
    else if (slots.desiredAmount < policy.minAmount) score -= 10
    else score -= 20
  }
  if (slots.guaranteePreference === 'none' && policy?.collateralOrGuarantee === '신용') score += 20
  if (slots.guaranteePreference === 'guarantee' && policy?.guaranteeRequired === 'Y') score += 20
  if (slots.ratePreference === 'low') score += 5
  return score
}

// ─── 응답 메시지 생성 ─────────────────────────────────────────────────────────

function buildMessage(intent: string, products: ProductInfo[], slots: ExtractedSlots): string {
  const hints: string[] = []
  if (slots.desiredAmount) hints.push(`${formatAmount(slots.desiredAmount)} 기준`)
  if (slots.customerType) hints.push(slots.customerType)
  if (slots.loanPurpose) hints.push(slots.loanPurpose)
  if (slots.guaranteePreference === 'none') hints.push('무보증')
  if (slots.guaranteePreference === 'guarantee') hints.push('보증부')
  if (slots.ratePreference === 'low') hints.push('저금리 우선')
  const hint = hints.length > 0 ? ` (${hints.join(', ')})` : ''

  if (intent === 'loan_document_inquiry') {
    if (products.length === 0) return '필요서류 정보를 찾지 못했습니다. 상담원을 통해 확인해 주세요.'
    return `${products[0].productName} 관련 서류 안내입니다. 실제 제출은 앱 화면에서 진행해 주세요.`
  }
  if (intent === 'loan_terms_inquiry') {
    return '약관 및 동의서는 아래 버튼에서 확인하실 수 있습니다. 실제 동의는 앱 화면에서 진행해 주세요.'
  }
  if (intent === 'loan_application') {
    if (products.length === 0) return '신청 가능한 상품을 찾지 못했습니다. 더 자세한 조건을 말씀해 주세요.'
    return `${products[0].productName} 신청 화면으로 이동하실 수 있습니다.${hint} 실제 신청은 앱 화면에서 진행해 주세요.`
  }
  if (intent === 'loan_eligibility_check') {
    if (products.length === 0) return `입력하신 조건${hint}에 맞는 상품을 찾지 못했습니다.`
    return `신청 가능 여부는 심사 결과에 따라 달라질 수 있습니다.${hint} 아래 상품을 확인해 보세요.`
  }
  if (intent === 'loan_status_inquiry') {
    return '대출 신청 및 심사 상태는 앱 화면에서 확인하실 수 있습니다.'
  }
  if (products.length === 0) {
    return `조건${hint}에 맞는 상품을 찾지 못했습니다. 더 자세한 조건을 말씀해 주세요.`
  }
  return `조건에 맞는 대출상품 ${products.length}개를 추천해드립니다.${hint} 실제 한도와 금리는 심사 결과에 따라 달라질 수 있습니다.`
}

// ─── 런타임 메인 ──────────────────────────────────────────────────────────────

export async function runLoanRuntime(input: LoanRuntimeInput): Promise<LoanRuntimeOutput> {
  const start = Date.now()
  const { userText } = input

  const { intent, confidence, source } = input.intent
    ? { intent: input.intent, confidence: 1.0, source: 'provided' }
    : extractIntent(userText)

  const slots = extractSlots(userText)

  // 1. 키워드 기반 상품 검색
  const { productIds: keywordIds, matchedKeywords } = await policyLoader.searchByKeyword(userText)
  let productIds = keywordIds
  let searchMode = 'keyword'

  // 2. 키워드 미매칭 시 전체 상품 폴백
  if (!productIds.length) {
    searchMode = 'slot_fallback'
    productIds = await policyLoader.getAllActiveProductIds()
  }

  if (!productIds.length) {
    return {
      intent, confidence,
      message: 'DB에 등록된 상품이 없습니다. Supabase에 상품 데이터를 먼저 입력해 주세요.',
      products: [],
      extractedSlots: slots,
      missingSlots: ['customerType', 'loanPurpose', 'desiredAmount'],
      disclaimer: '',
      raw: { matchedKeywords, queryMs: Date.now() - start, intentSource: source, searchMode },
    }
  }

  // 3. 상품 상세 조회
  const { masters, policyMap } = await policyLoader.getProductDetails(productIds)

  // 4. 슬롯 기반 랭킹 후 상위 3개
  const scoredProducts = masters
    .map(row => ({ row, score: scoreProduct(policyMap[row.productId], slots) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)

  const top3Ids = scoredProducts.map(p => p.row.productId)

  // 5. CTA + 화면 조회
  const ctaMap = await policyLoader.getBusinessActionCTA(top3Ids)
  const screenIds = Object.values(ctaMap).map(r => r.targetScreenId)
  const screenMap = await policyLoader.getScreenMapping(screenIds)

  // 6. 결과 조합
  const products: ProductInfo[] = scoredProducts.map(({ row, score }) => {
    const policy = policyMap[row.productId] ?? {}
    const routing = ctaMap[row.productId]
    const screen = routing ? screenMap[routing.targetScreenId] : null
    const cta: CTAInfo | undefined = routing ? {
      label: routing.ctaLabel,
      action: routing.actionType,
      targetScreenId: routing.targetScreenId,
      targetScreenName: screen?.screenName ?? routing.targetScreenName ?? routing.targetScreenId,
    } : undefined

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

  const missingSlots: string[] = []
  if (!slots.customerType) missingSlots.push('customerType')
  if (!slots.desiredAmount) missingSlots.push('desiredAmount')

  return {
    intent,
    confidence,
    message: buildMessage(intent, products, slots),
    products,
    extractedSlots: slots,
    missingSlots,
    disclaimer:
      '추천 결과는 입력하신 정보와 상품 조건을 기준으로 한 안내이며, 실제 대출 가능 여부와 한도, 금리는 심사 결과에 따라 달라질 수 있습니다.',
    raw: {
      matchedKeywords,
      queryMs: Date.now() - start,
      intentSource: source,
      searchMode,
    },
  }
}
