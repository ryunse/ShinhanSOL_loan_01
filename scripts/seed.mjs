import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dirname, '../.env')
const env = Object.fromEntries(
  readFileSync(envPath, 'utf-8')
    .split('\n')
    .filter(l => l.includes('='))
    .map(l => {
      const idx = l.indexOf('=')
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()]
    })
)

const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY
if (!env.SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('⚠️  SUPABASE_SERVICE_ROLE_KEY 없음 — anon 키 사용 (RLS로 인해 실패할 수 있음)')
  console.warn('    .env에 SUPABASE_SERVICE_ROLE_KEY를 추가하세요. (Supabase 대시보드 → Settings → API → service_role)')
}
const supabase = createClient(env.SUPABASE_URL, key, {
  auth: { persistSession: false },
})

async function seed() {
  console.log('시드 시작...')

  // 1. screen_mapping
  await supabase.from('screen_mapping').delete().neq('screenId', '__never__')
  const { error: s1 } = await supabase.from('screen_mapping').insert([
    { screenId: 'SCR_PRODUCT_DETAIL', screenName: '상품 상세',  screenType: 'list',  isPopup: false, flowId: 'FLOW_LOAN', order: 1 },
    { screenId: 'SCR_LIMIT_INQUIRY',  screenName: '한도조회',    screenType: 'form',  isPopup: false, flowId: 'FLOW_LOAN', order: 2 },
    { screenId: 'SCR_APPLICATION',    screenName: '신청하기',    screenType: 'form',  isPopup: false, flowId: 'FLOW_LOAN', order: 3 },
    { screenId: 'SCR_DOCUMENT',       screenName: '필요서류',    screenType: 'list',  isPopup: false, flowId: 'FLOW_LOAN', order: 4 },
    { screenId: 'SCR_TERMS',          screenName: '약관확인',    screenType: 'popup', isPopup: true,  flowId: 'FLOW_LOAN', order: 5 },
    { screenId: 'SCR_COUNSELOR',      screenName: '상담원연결',  screenType: 'popup', isPopup: true,  flowId: 'FLOW_LOAN', order: 6 },
  ])
  if (s1) { console.error('screen_mapping 오류:', s1); process.exit(1) }
  console.log('✓ screen_mapping')

  // 2. product_master
  await supabase.from('product_master').delete().neq('productId', '__never__')
  const { error: s2 } = await supabase.from('product_master').insert([
    { productId: 'PRD_CREDIT',    productName: '사업자 신용대출',        productGroup: '사업자대출', productCategory: '신용대출', flowId: 'FLOW_LOAN', menuPath: '대출 > 사업자대출 > 신용대출' },
    { productId: 'PRD_GUARANTEE', productName: '보증서대출',              productGroup: '보증부대출', productCategory: '보증부대출', flowId: 'FLOW_LOAN', menuPath: '대출 > 사업자대출 > 보증서대출' },
    { productId: 'PRD_DANGKYEO',  productName: '땡겨요 입점 사업자대출', productGroup: '플랫폼대출', productCategory: '플랫폼대출', flowId: 'FLOW_LOAN', menuPath: '대출 > 플랫폼파트너 > 땡겨요' },
    { productId: 'PRD_MICRO',     productName: '소상공인 특별대출',       productGroup: '정책금융',   productCategory: '정책금융', flowId: 'FLOW_LOAN', menuPath: '대출 > 정책금융 > 소상공인' },
  ])
  if (s2) { console.error('product_master 오류:', s2); process.exit(1) }
  console.log('✓ product_master')

  // 3. product_policy
  await supabase.from('product_policy').delete().neq('productId', '__never__')
  const { error: s3 } = await supabase.from('product_policy').insert([
    { productId: 'PRD_CREDIT',    loanType: '신용대출', loanPurpose: '운전자금', minAmount: 10000000, maxAmount: 300000000, repaymentOptions: ['원리금균등', '원금균등'], rateType: '변동금리' },
    { productId: 'PRD_GUARANTEE', loanType: '보증부대출', loanPurpose: '운전자금', minAmount:  5000000, maxAmount: 500000000, repaymentOptions: ['원리금균등'],             rateType: '고정금리' },
    { productId: 'PRD_DANGKYEO',  loanType: '플랫폼대출', loanPurpose: '운전자금', minAmount:  5000000, maxAmount: 100000000, repaymentOptions: ['원리금균등', '만기일시'],  rateType: '변동금리' },
    { productId: 'PRD_MICRO',     loanType: '정책금융대출', loanPurpose: '운전자금', minAmount: 20000000, maxAmount: 200000000, repaymentOptions: ['원리금균등'],             rateType: '고정금리' },
  ])
  if (s3) { console.error('product_policy 오류:', s3); process.exit(1) }
  console.log('✓ product_policy')

  // 4. product_search_keyword
  await supabase.from('product_search_keyword').delete().neq('productId', '__never__')
  const kws = [
    ['PRD_CREDIT',    '사업자대출', 10], ['PRD_CREDIT', '신용대출', 10], ['PRD_CREDIT', '사업자', 8],
    ['PRD_CREDIT',    '법인대출',   8],  ['PRD_CREDIT', '기업대출', 8],  ['PRD_CREDIT', '무보증', 9],
    ['PRD_CREDIT',    '개인사업자', 8],
    ['PRD_GUARANTEE', '보증서대출', 10], ['PRD_GUARANTEE', '보증부대출', 10], ['PRD_GUARANTEE', '보증서', 9],
    ['PRD_GUARANTEE', '보증', 8],        ['PRD_GUARANTEE', '신용보증기금', 9], ['PRD_GUARANTEE', '기술보증기금', 9],
    ['PRD_GUARANTEE', '보증대출', 9],
    ['PRD_DANGKYEO',  '땡겨요', 10], ['PRD_DANGKYEO', '플랫폼', 8], ['PRD_DANGKYEO', '배달', 8],
    ['PRD_DANGKYEO',  '입점', 9],    ['PRD_DANGKYEO', '입점사', 9], ['PRD_DANGKYEO', '배달앱', 8],
    ['PRD_DANGKYEO',  '음식점', 7],
    ['PRD_MICRO',     '소상공인', 10], ['PRD_MICRO', '정책금융', 9],  ['PRD_MICRO', '특별대출', 9],
    ['PRD_MICRO',     '자영업자', 8],   ['PRD_MICRO', '소기업', 8],   ['PRD_MICRO', '소상공인대출', 10],
  ]
  const { error: s4 } = await supabase.from('product_search_keyword').insert(
    kws.map(([productId, keyword, weight]) => ({ productId, keyword, keywordType: 'natural', weight }))
  )
  if (s4) { console.error('product_search_keyword 오류:', s4); process.exit(1) }
  console.log('✓ product_search_keyword')

  // 5. routing_map
  await supabase.from('routing_map').delete().neq('intent', '__never__')
  const { error: s5 } = await supabase.from('routing_map').insert([
    { routingId: 'RT_REC_CREDIT',    intent: 'loan_recommendation',    productId: 'PRD_CREDIT',    productName: '사업자 신용대출',        actionType: 'navigate',    targetScreenId: 'SCR_PRODUCT_DETAIL', targetScreenName: '상품 상세', ctaLabel: '상품 자세히 보기', source: 'db', description: '상품 추천 후 상세 이동' },
    { routingId: 'RT_REC_GUARANTEE', intent: 'loan_recommendation',    productId: 'PRD_GUARANTEE', productName: '보증서대출',              actionType: 'navigate',    targetScreenId: 'SCR_PRODUCT_DETAIL', targetScreenName: '상품 상세', ctaLabel: '상품 자세히 보기', source: 'db', description: '상품 추천 후 상세 이동' },
    { routingId: 'RT_REC_DANGKYEO',  intent: 'loan_recommendation',    productId: 'PRD_DANGKYEO',  productName: '땡겨요 입점 사업자대출', actionType: 'navigate',    targetScreenId: 'SCR_PRODUCT_DETAIL', targetScreenName: '상품 상세', ctaLabel: '상품 자세히 보기', source: 'db', description: '상품 추천 후 상세 이동' },
    { routingId: 'RT_REC_MICRO',     intent: 'loan_recommendation',    productId: 'PRD_MICRO',     productName: '소상공인 특별대출',       actionType: 'navigate',    targetScreenId: 'SCR_PRODUCT_DETAIL', targetScreenName: '상품 상세', ctaLabel: '상품 자세히 보기', source: 'db', description: '상품 추천 후 상세 이동' },
    { routingId: 'RT_APP_CREDIT',    intent: 'loan_application',       productId: 'PRD_CREDIT',    productName: '사업자 신용대출',        actionType: 'navigate',    targetScreenId: 'SCR_LIMIT_INQUIRY',  targetScreenName: '한도조회',  ctaLabel: '한도조회',         source: 'db', description: '한도조회 화면 이동' },
    { routingId: 'RT_APP_GUARANTEE', intent: 'loan_application',       productId: 'PRD_GUARANTEE', productName: '보증서대출',              actionType: 'navigate',    targetScreenId: 'SCR_LIMIT_INQUIRY',  targetScreenName: '한도조회',  ctaLabel: '한도조회',         source: 'db', description: '한도조회 화면 이동' },
    { routingId: 'RT_APP_DANGKYEO',  intent: 'loan_application',       productId: 'PRD_DANGKYEO',  productName: '땡겨요 입점 사업자대출', actionType: 'navigate',    targetScreenId: 'SCR_APPLICATION',   targetScreenName: '신청하기',  ctaLabel: '신청하기',         source: 'db', description: '신청 화면 이동' },
    { routingId: 'RT_APP_MICRO',     intent: 'loan_application',       productId: 'PRD_MICRO',     productName: '소상공인 특별대출',       actionType: 'navigate',    targetScreenId: 'SCR_LIMIT_INQUIRY',  targetScreenName: '한도조회',  ctaLabel: '한도조회',         source: 'db', description: '한도조회 화면 이동' },
    { routingId: 'RT_ELG_CREDIT',    intent: 'loan_eligibility_check', productId: 'PRD_CREDIT',    productName: '사업자 신용대출',        actionType: 'loadRouting', targetScreenId: 'SCR_LIMIT_INQUIRY',  targetScreenName: '한도조회',  ctaLabel: '신청 가능 여부 확인', source: 'db', description: '신청 가능 여부 확인' },
    { routingId: 'RT_ELG_GUARANTEE', intent: 'loan_eligibility_check', productId: 'PRD_GUARANTEE', productName: '보증서대출',              actionType: 'loadRouting', targetScreenId: 'SCR_LIMIT_INQUIRY',  targetScreenName: '한도조회',  ctaLabel: '신청 가능 여부 확인', source: 'db', description: '신청 가능 여부 확인' },
    { routingId: 'RT_ELG_DANGKYEO',  intent: 'loan_eligibility_check', productId: 'PRD_DANGKYEO',  productName: '땡겨요 입점 사업자대출', actionType: 'loadRouting', targetScreenId: 'SCR_LIMIT_INQUIRY',  targetScreenName: '한도조회',  ctaLabel: '신청 가능 여부 확인', source: 'db', description: '신청 가능 여부 확인' },
    { routingId: 'RT_ELG_MICRO',     intent: 'loan_eligibility_check', productId: 'PRD_MICRO',     productName: '소상공인 특별대출',       actionType: 'loadRouting', targetScreenId: 'SCR_LIMIT_INQUIRY',  targetScreenName: '한도조회',  ctaLabel: '신청 가능 여부 확인', source: 'db', description: '신청 가능 여부 확인' },
    { routingId: 'RT_DOC_CREDIT',    intent: 'loan_document_inquiry',  productId: 'PRD_CREDIT',    productName: '사업자 신용대출',        actionType: 'showInfo',    targetScreenId: 'SCR_DOCUMENT',       targetScreenName: '필요서류',  ctaLabel: '필요서류 확인',    source: 'db', description: '필요서류 안내' },
    { routingId: 'RT_DOC_GUARANTEE', intent: 'loan_document_inquiry',  productId: 'PRD_GUARANTEE', productName: '보증서대출',              actionType: 'showInfo',    targetScreenId: 'SCR_DOCUMENT',       targetScreenName: '필요서류',  ctaLabel: '필요서류 확인',    source: 'db', description: '필요서류 안내' },
    { routingId: 'RT_DOC_DANGKYEO',  intent: 'loan_document_inquiry',  productId: 'PRD_DANGKYEO',  productName: '땡겨요 입점 사업자대출', actionType: 'showInfo',    targetScreenId: 'SCR_DOCUMENT',       targetScreenName: '필요서류',  ctaLabel: '필요서류 확인',    source: 'db', description: '필요서류 안내' },
    { routingId: 'RT_DOC_MICRO',     intent: 'loan_document_inquiry',  productId: 'PRD_MICRO',     productName: '소상공인 특별대출',       actionType: 'showInfo',    targetScreenId: 'SCR_DOCUMENT',       targetScreenName: '필요서류',  ctaLabel: '필요서류 확인',    source: 'db', description: '필요서류 안내' },
    { routingId: 'RT_TRM_CREDIT',    intent: 'loan_terms_inquiry',     productId: 'PRD_CREDIT',    productName: '사업자 신용대출',        actionType: 'showInfo',    targetScreenId: 'SCR_TERMS',          targetScreenName: '약관확인',  ctaLabel: '약관 확인',        source: 'db', description: '약관 안내' },
    { routingId: 'RT_TRM_GUARANTEE', intent: 'loan_terms_inquiry',     productId: 'PRD_GUARANTEE', productName: '보증서대출',              actionType: 'showInfo',    targetScreenId: 'SCR_TERMS',          targetScreenName: '약관확인',  ctaLabel: '약관 확인',        source: 'db', description: '약관 안내' },
  ])
  if (s5) { console.error('routing_map 오류:', s5); process.exit(1) }
  console.log('✓ routing_map')

  console.log('\n✅ 시드 완료! 상품 4개, 키워드 27개, 라우팅 18개 삽입됨')
}

seed().catch(console.error)
