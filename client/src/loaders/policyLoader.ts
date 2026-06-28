/**
 * policyLoader.ts — DB 정책 데이터 접근 계층
 *
 * Engine이 Supabase를 직접 호출하지 않는다.
 * 모든 DB 쿼리는 이 모듈을 통해서만 이루어진다.
 *
 * 상품 추가 시 이 파일은 수정하지 않는다 — DB Row만 추가한다.
 */

import { createClient } from '@supabase/supabase-js'
import { DocumentInfo, EligibilityCondition } from '@/types/loan.types'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ─── DB Row 타입 ──────────────────────────────────────────────────────────────

export interface ProductMasterRow {
  productId: string
  productName: string
  productCategory: string
  menuPath?: string
}

export interface ProductPolicyRow {
  productId: string
  minAmount?: number
  maxAmount?: number
  rateType?: string
  minRate?: number
  maxRate?: number
  rateBaseDate?: string
  maxTerm?: string
  repaymentOptions?: string | string[]
  loanType?: string
  loanPurpose?: string
  collateralOrGuarantee?: string
  guaranteeRequired?: string
  targetCustomer?: string
}

export interface RoutingRow {
  productId: string
  actionType: string
  targetScreenId: string
  targetScreenName: string
  ctaLabel: string
  screenType: string
}

export interface ScreenRow {
  screenId: string
  screenName: string
  stepLabel?: string
}

// ─── 키워드 검색 ──────────────────────────────────────────────────────────────

// DB 키워드가 유저 토큰을 포함(부분 매칭)하려면 토큰이 최소 3자 이상이어야 한다.
// 2자 이하 토큰("대출" 등)이 "전문직대출" 같은 전문 상품 키워드에 오매칭되는 것을 방지한다.
const KEYWORD_PARTIAL_MATCH_MIN_LEN = 3

export async function searchByKeyword(
  userText: string
): Promise<{ productIds: string[]; matchedKeywords: string[]; hasProductNameMatch: boolean }> {
  const keywords = userText.split(/\s+/).filter(w => w.length >= 2)
  const { data } = await supabase
    .from('product_search_keyword')
    .select('productId, keyword, keywordType')
  const productIdSet = new Set<string>()
  const matchedKeywords: string[] = []
  let hasProductNameMatch = false
  for (const row of (data ?? []) as { productId: string; keyword: string; keywordType?: string }[]) {
    if (keywords.some(k =>
      (k.length >= KEYWORD_PARTIAL_MATCH_MIN_LEN && row.keyword.includes(k)) ||
      k.includes(row.keyword)
    )) {
      productIdSet.add(row.productId)
      matchedKeywords.push(row.keyword)
      if (row.keywordType === '상품명') hasProductNameMatch = true
    }
  }
  return { productIds: Array.from(productIdSet), matchedKeywords, hasProductNameMatch }
}

// ─── 활성 상품 전체 조회 ──────────────────────────────────────────────────────

export async function getAllActiveProductIds(): Promise<string[]> {
  const { data } = await supabase.from('product_master').select('productId').eq('active', 'Y')
  return ((data ?? []) as { productId: string }[]).map(r => r.productId)
}

// ─── 상품 상세 조회 ───────────────────────────────────────────────────────────

export async function getProductDetails(
  productIds: string[]
): Promise<{ masters: ProductMasterRow[]; policyMap: Record<string, ProductPolicyRow> }> {
  const { data: mastersData } = await supabase
    .from('product_master')
    .select('productId, productName, productCategory, menuPath')
    .in('productId', productIds)
    .eq('active', 'Y')

  const { data: policies } = await supabase
    .from('product_policy')
    .select('productId, minAmount, maxAmount, rateType, minRate, maxRate, rateBaseDate, maxTerm, repaymentOptions, loanType, loanPurpose, collateralOrGuarantee, guaranteeRequired, targetCustomer')
    .in('productId', productIds)

  const policyMap: Record<string, ProductPolicyRow> = {}
  for (const p of (policies ?? []) as ProductPolicyRow[]) policyMap[p.productId] = p

  return { masters: (mastersData ?? []) as ProductMasterRow[], policyMap }
}

// ─── 필요서류 조회 ────────────────────────────────────────────────────────────

export async function getDocuments(productIds: string[]): Promise<DocumentInfo[]> {
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

// ─── 자격 조건 조회 ───────────────────────────────────────────────────────────

export async function getEligibilityRules(productIds: string[]): Promise<EligibilityCondition[]> {
  const { data } = await supabase
    .from('eligibility_rules')
    .select('ruleId, productId, ruleName, conditionDescription, failMessage, failAction, status, conditionPolarity, qaTarget')
    .in('productId', productIds)
    .eq('status', 'active')
    .eq('qaTarget', 'user')

  return ((data ?? []) as any[]).map(r => ({
    ruleId: r.ruleId,
    productId: r.productId,
    ruleName: r.ruleName,
    conditionDescription: r.conditionDescription,
    failMessage: r.failMessage,
    severity: (r.failAction as string ?? '').startsWith('block') ? ('blocking' as const) : ('advisory' as const),
    conditionPolarity: (r.conditionPolarity ?? 'positive') as 'positive' | 'negative',
  }))
}

// ─── 비즈니스 액션 CTA 조회 ───────────────────────────────────────────────────

export async function getBusinessActionCTA(
  productIds: string[]
): Promise<Record<string, RoutingRow>> {
  const { data } = await supabase
    .from('routing_map')
    .select('productId, actionType, targetScreenId, targetScreenName, ctaLabel, screenType')
    .in('productId', productIds)
    .eq('actionType', 'navigate')
    .eq('screenType', 'screen')
    .order('routingId', { ascending: true })

  const ctaMap: Record<string, RoutingRow> = {}
  for (const r of (data ?? []) as RoutingRow[]) {
    if (!ctaMap[r.productId]) ctaMap[r.productId] = r
  }
  return ctaMap
}

// ─── 화면 매핑 조회 ───────────────────────────────────────────────────────────

export async function getScreenMapping(screenIds: string[]): Promise<Record<string, ScreenRow>> {
  if (!screenIds.length) return {}
  const { data } = await supabase
    .from('screen_mapping')
    .select('screenId, screenName, stepLabel')
    .in('screenId', screenIds)
  const screenMap: Record<string, ScreenRow> = {}
  for (const s of (data ?? []) as ScreenRow[]) screenMap[s.screenId] = s
  return screenMap
}
