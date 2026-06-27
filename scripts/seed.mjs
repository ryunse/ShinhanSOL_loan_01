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
}
const supabase = createClient(env.SUPABASE_URL, key, {
  auth: { persistSession: false },
})

// CSV의 Y/N 문자열을 boolean으로 변환
const yn = v => v === 'Y' || v === 'y'

// 쉼표 구분 문자열을 배열로 변환
const csvArr = v => v ? v.split(',').map(s => s.trim()).filter(Boolean) : []

async function clearTable(table, key, sentinel = '__never__') {
  const { error } = await supabase.from(table).delete().neq(key, sentinel)
  if (error) { console.error(`${table} 삭제 오류:`, error); process.exit(1) }
}

async function insert(table, rows) {
  const { error } = await supabase.from(table).insert(rows)
  if (error) { console.error(`${table} 삽입 오류:`, error); process.exit(1) }
  console.log(`✓ ${table} (${rows.length}건)`)
}

async function seed() {
  console.log('시드 시작 — CSV 원본 데이터 기준\n')

  // ── 1. screen_mapping ───────────────────────────────────────────────────────
  await clearTable('screen_mapping', 'screenId')
  await insert('screen_mapping', [
    // FLOW_BIZ_LOAN (땡겨요 사업자대출)
    { flowId: 'FLOW_BIZ_LOAN',       order: '1',       screenId: 'N_PR_067122',     screenName: '신청전유의사항동의',         screenType: 'screen',      stepLabel: '신청 전 유의사항 동의',         isPopup: false, isErrorBranch: false, nextDefaultScreen: 'N_PR_067131' },
    { flowId: 'FLOW_BIZ_LOAN',       order: '2',       screenId: 'N_PR_067131',     screenName: '사업자정보확인',             screenType: 'screen',      stepLabel: '사업자정보 확인',               isPopup: false, isErrorBranch: false, nextDefaultScreen: 'N_PR_067133' },
    { flowId: 'FLOW_BIZ_LOAN',       order: '3',       screenId: 'N_PR_067133',     screenName: '한도조회결과',               screenType: 'screen',      stepLabel: '한도조회 결과',                 isPopup: false, isErrorBranch: false, nextDefaultScreen: 'N_PR_067134' },
    { flowId: 'FLOW_BIZ_LOAN',       order: '4',       screenId: 'N_PR_067134',     screenName: '공동인증서사업장정보조회',   screenType: 'screen',      stepLabel: '공동인증서 기반 사업장정보 조회', isPopup: false, isErrorBranch: false, nextDefaultScreen: 'N_PR_067151' },
    { flowId: 'FLOW_BIZ_LOAN',       order: '5',       screenId: 'N_PR_067151',     screenName: '약관동의',                   screenType: 'screen',      stepLabel: '약관 동의',                     isPopup: false, isErrorBranch: false, nextDefaultScreen: 'N_PR_067161' },
    { flowId: 'FLOW_BIZ_LOAN',       order: '6',       screenId: 'N_PR_067161',     screenName: '고객정보확인',               screenType: 'screen',      stepLabel: '고객정보 확인',                 isPopup: false, isErrorBranch: false, nextDefaultScreen: 'N_PR_067162' },
    { flowId: 'FLOW_BIZ_LOAN',       order: '7',       screenId: 'N_PR_067162',     screenName: '신청정보입력',               screenType: 'screen',      stepLabel: '신청정보 입력',                 isPopup: false, isErrorBranch: false, nextDefaultScreen: 'N_PR_067169' },
    { flowId: 'FLOW_BIZ_LOAN',       order: '7-P',     screenId: 'N_PR_002008_P01', screenName: '공통_금리물안내',           screenType: 'popup',       stepLabel: '금리물 안내',                   isPopup: true,  isErrorBranch: false, nextDefaultScreen: 'previousScreen' },
    { flowId: 'FLOW_BIZ_LOAN',       order: '8',       screenId: 'N_PR_067169',     screenName: '대출신청완료',               screenType: 'result',      stepLabel: '대출신청 완료',                 isPopup: false, isErrorBranch: false, nextDefaultScreen: 'N_PR_067191' },
    { flowId: 'FLOW_BIZ_LOAN',       order: '9',       screenId: 'N_PR_067191',     screenName: '대출약정완료',               screenType: 'result',      stepLabel: '대출약정 완료',                 isPopup: false, isErrorBranch: false, nextDefaultScreen: 'home' },
    // FLOW_GUARANTEE_LOAN (지역신용보증재단 비대면보증부대출)
    { flowId: 'FLOW_GUARANTEE_LOAN', order: '1',       screenId: 'N_PR_066121_D01', screenName: '개인사업자제한안내',         screenType: 'dialog',      stepLabel: '상품 진입 제한',                isPopup: false, isErrorBranch: true,  nextDefaultScreen: 'previousScreen' },
    { flowId: 'FLOW_GUARANTEE_LOAN', order: '2',       screenId: 'N_PR_066122',     screenName: '신용보증재단선택',           screenType: 'screen',      stepLabel: '신용보증재단 및 대출관리점 선택', isPopup: false, isErrorBranch: false, nextDefaultScreen: 'N_PR_066123' },
    { flowId: 'FLOW_GUARANTEE_LOAN', order: '2-P',     screenId: 'N_PR_066122_B01', screenName: '지역신용보증재단선택',       screenType: 'bottomSheet', stepLabel: '지역신용보증재단 선택',         isPopup: true,  isErrorBranch: false, nextDefaultScreen: 'N_PR_066122' },
    { flowId: 'FLOW_GUARANTEE_LOAN', order: '3',       screenId: 'N_PR_066123',     screenName: '신청전유의사항',             screenType: 'screen',      stepLabel: '신청 전 유의사항 동의',         isPopup: false, isErrorBranch: false, nextDefaultScreen: 'N_PR_066131' },
    { flowId: 'FLOW_GUARANTEE_LOAN', order: '4',       screenId: 'N_PR_066131',     screenName: '사업자정보확인',             screenType: 'screen',      stepLabel: '사업자정보 확인',               isPopup: false, isErrorBranch: false, nextDefaultScreen: 'N_PR_066134' },
    { flowId: 'FLOW_GUARANTEE_LOAN', order: '5',       screenId: 'N_PR_066134',     screenName: '공동인증서사업장정보조회',   screenType: 'screen',      stepLabel: '공동인증서/매출정보 제출',       isPopup: false, isErrorBranch: false, nextDefaultScreen: 'N_PR_066139' },
    { flowId: 'FLOW_GUARANTEE_LOAN', order: '6',       screenId: 'N_PR_066139',     screenName: '보증한도조회결과',           screenType: 'screen',      stepLabel: '보증한도조회 결과',             isPopup: false, isErrorBranch: false, nextDefaultScreen: 'N_PR_066151' },
    { flowId: 'FLOW_GUARANTEE_LOAN', order: '7',       screenId: 'N_PR_066151',     screenName: '약관동의',                   screenType: 'screen',      stepLabel: '약관 동의',                     isPopup: false, isErrorBranch: false, nextDefaultScreen: 'N_PR_066161' },
    { flowId: 'FLOW_GUARANTEE_LOAN', order: '8',       screenId: 'N_PR_066161',     screenName: '사업장정보입력',             screenType: 'screen',      stepLabel: '사업장정보 입력',               isPopup: false, isErrorBranch: false, nextDefaultScreen: 'N_PR_066162' },
    { flowId: 'FLOW_GUARANTEE_LOAN', order: '8-P',     screenId: 'N_PR_066161_B01', screenName: '건물층선택',                 screenType: 'bottomSheet', stepLabel: '건물층 선택',                   isPopup: true,  isErrorBranch: false, nextDefaultScreen: 'N_PR_066161' },
    { flowId: 'FLOW_GUARANTEE_LOAN', order: '9',       screenId: 'N_PR_066162',     screenName: '본인추가정보입력',           screenType: 'screen',      stepLabel: '본인 추가정보 입력',             isPopup: false, isErrorBranch: false, nextDefaultScreen: 'N_PR_066163' },
    { flowId: 'FLOW_GUARANTEE_LOAN', order: '10',      screenId: 'N_PR_066163',     screenName: '신청정보입력',               screenType: 'screen',      stepLabel: '신청정보 입력',                 isPopup: false, isErrorBranch: false, nextDefaultScreen: 'N_PR_066169' },
    { flowId: 'FLOW_GUARANTEE_LOAN', order: '10-P',    screenId: 'N_PR_066163_B01', screenName: '자금용도선택',               screenType: 'bottomSheet', stepLabel: '자금용도 선택',                 isPopup: true,  isErrorBranch: false, nextDefaultScreen: 'N_PR_066163' },
    { flowId: 'FLOW_GUARANTEE_LOAN', order: '11',      screenId: 'N_PR_066169',     screenName: '대출신청완료',               screenType: 'result',      stepLabel: '보증 및 대출신청 완료',         isPopup: false, isErrorBranch: false, nextDefaultScreen: 'N_PR_066291' },
    { flowId: 'FLOW_GUARANTEE_LOAN', order: '12',      screenId: 'N_PR_066291',     screenName: '보증약정및대출약정완료',     screenType: 'result',      stepLabel: '보증 약정 및 대출 약정 완료',   isPopup: false, isErrorBranch: false, nextDefaultScreen: 'home' },
    { flowId: 'FLOW_GUARANTEE_LOAN', order: 'common',  screenId: 'N_PR_002008_P01', screenName: '공통_금리물안내',           screenType: 'popup',       stepLabel: '금리물 안내',                   isPopup: true,  isErrorBranch: false, nextDefaultScreen: 'previousScreen' },
  ])

  // ── 2. product_master ────────────────────────────────────────────────────────
  await clearTable('product_master', 'productId')
  await insert('product_master', [
    {
      productId: 'LOAN_DDANGYO_SOHO',
      productName: '땡겨요 사업자대출',
      productGroup: '사업자금융',
      productCategory: '사업자대출',
      menuDepth1: '상품',
      menuDepth2: '사업자대출',
      menuDepth3: '땡겨요 사업자대출',
      menuPath: '상품 > 사업자대출 > 땡겨요 사업자대출',
      intent: 'business_loan_dangyo_apply',
      flowId: 'FLOW_BIZ_LOAN',
      active: 'Y',
      remarks: '땡겨요 입점 개인사업자 대상 신용대출',
    },
    {
      productId: 'LOAN_REGIONAL_GUARANTEE',
      productName: '지역신용보증재단 비대면보증부대출',
      productGroup: '사업자금융',
      productCategory: '보증서대출',
      menuDepth1: '상품',
      menuDepth2: '보증서대출',
      menuDepth3: '지역신용보증재단비대면보증부대출',
      menuPath: '상품 > 보증서대출 > 지역신용보증재단비대면보증부대출',
      intent: 'regional_guarantee_business_loan_apply',
      flowId: 'FLOW_GUARANTEE_LOAN',
      active: 'Y',
      remarks: '지역신용보증재단 보증 기반 비대면 보증서대출',
    },
  ])

  // ── 3. product_policy ────────────────────────────────────────────────────────
  await clearTable('product_policy', 'productId')
  await insert('product_policy', [
    {
      productId: 'LOAN_DDANGYO_SOHO',
      loanType: '개인사업자 신용대출',
      targetCustomer: '개업년월일 6개월 이상인 신한 배달앱(땡겨요) 입점사업자',
      loanPurpose: '운전자금',
      collateralOrGuarantee: '신용',
      guaranteeRequired: 'N',
      guaranteeAgencyType: null,
      minAmount: 1000000,
      maxAmount: 30000000,
      amountStep: null,
      stampTaxCondition: '대출금액 5천만원 초과 시 인지세 발생 가능',
      rateType: '시장금리 변동',
      baseRateOptions: ['CD91일물', '금융채6개월물'],
      repaymentOptions: ['일시상환', '원금균등분할상환'],
      applicationChannel: '신한쏠비즈 비대면',
      minRate: 4.73,
      maxRate: 7.37,
      rateBaseDate: '2025.10.23',
      maxTerm: '36개월',
    },
    {
      productId: 'LOAN_REGIONAL_GUARANTEE',
      loanType: '보증부 사업자대출',
      targetCustomer: '개인사업자',
      loanPurpose: '운전자금/시설자금/창업자금',
      collateralOrGuarantee: '지역신용보증재단 보증',
      guaranteeRequired: 'Y',
      guaranteeAgencyType: '지역신용보증재단',
      minAmount: 5000000,
      maxAmount: 70000000,
      amountStep: 100000,
      stampTaxCondition: '대출금액 5천만원 초과 시 인지세 발생 가능',
      rateType: '시장금리부 변동',
      baseRateOptions: ['CD91일물', '금융채6개월물'],
      repaymentOptions: ['거치 후 원금분할상환', '일시상환'],
      applicationChannel: '신한쏠비즈 비대면 + 재단 상담/심사',
      minRate: 4.33,
      maxRate: 5.76,
      rateBaseDate: '2025.07.17',
      maxTerm: '5년 이내(보증서 만기일까지)',
    },
  ])

  // ── 4. product_search_keyword ─────────────────────────────────────────────
  await clearTable('product_search_keyword', 'productId')
  await insert('product_search_keyword', [
    { productId: 'LOAN_DDANGYO_SOHO',       keywordType: '상품명', keyword: '땡겨요',                           weight: 100, matchIntentHint: 'business_loan_dangyo_apply',          remarks: '상품명 핵심어' },
    { productId: 'LOAN_DDANGYO_SOHO',       keywordType: '상품명', keyword: '땡겨요 사업자대출',               weight: 100, matchIntentHint: 'business_loan_dangyo_apply',          remarks: '정식 상품명' },
    { productId: 'LOAN_DDANGYO_SOHO',       keywordType: '대상',   keyword: '배달앱',                           weight: 70,  matchIntentHint: 'business_loan_consultation',          remarks: '대상/업종 힌트' },
    { productId: 'LOAN_DDANGYO_SOHO',       keywordType: '대상',   keyword: '입점사업자',                       weight: 80,  matchIntentHint: 'business_loan_consultation',          remarks: '대상 힌트' },
    { productId: 'LOAN_DDANGYO_SOHO',       keywordType: '대상',   keyword: '음식점',                           weight: 50,  matchIntentHint: 'business_loan_consultation',          remarks: '가능 후보' },
    { productId: 'LOAN_REGIONAL_GUARANTEE', keywordType: '상품명', keyword: '지역신용',                         weight: 100, matchIntentHint: 'regional_guarantee_business_loan_apply', remarks: '상품명 핵심어' },
    { productId: 'LOAN_REGIONAL_GUARANTEE', keywordType: '상품명', keyword: '신용보증재단',                     weight: 100, matchIntentHint: 'regional_guarantee_business_loan_apply', remarks: '상품명 핵심어' },
    { productId: 'LOAN_REGIONAL_GUARANTEE', keywordType: '상품명', keyword: '보증서대출',                       weight: 100, matchIntentHint: 'regional_guarantee_business_loan_apply', remarks: '카테고리 핵심어' },
    { productId: 'LOAN_REGIONAL_GUARANTEE', keywordType: '상품명', keyword: '지역신용보증재단비대면보증부대출', weight: 100, matchIntentHint: 'regional_guarantee_business_loan_apply', remarks: '정식 상품명' },
    { productId: 'LOAN_REGIONAL_GUARANTEE', keywordType: '대상',   keyword: '소상공인',                         weight: 70,  matchIntentHint: 'business_loan_consultation',          remarks: '대상 힌트' },
    { productId: 'LOAN_REGIONAL_GUARANTEE', keywordType: '대상',   keyword: '개인사업자',                       weight: 70,  matchIntentHint: 'business_loan_consultation',          remarks: '대상 힌트' },
    { productId: 'LOAN_REGIONAL_GUARANTEE', keywordType: '업무',   keyword: '보증',                             weight: 80,  matchIntentHint: 'regional_guarantee_business_loan_apply', remarks: '보증 업무 힌트' },
  ])

  // ── 5. routing_map ────────────────────────────────────────────────────────
  await clearTable('routing_map', 'routingId')
  const precheck = '상품별/고객별 사전조건은 eligibility_rules.csv 및 product_policy.csv 참조'
  const ddSource = 'generated_from_product_master_and_screen_mapping'
  await insert('routing_map', [
    // LOAN_DDANGYO_SOHO
    { routingId: 'ROUTE_LOAN_DDANGYO_SOHO_N_PR_067122',       productId: 'LOAN_DDANGYO_SOHO',       productName: '땡겨요 사업자대출', intent: 'business_loan_dangyo_apply',             actionType: 'navigate',   targetScreenId: 'N_PR_067122',     targetScreenName: '신청전유의사항동의',       screenType: 'screen',      ctaLabel: '신청 진행',                       precheck, description: '신청 전 유의사항 동의',            menuPath: '상품 > 사업자대출 > 땡겨요 사업자대출', source: ddSource },
    { routingId: 'ROUTE_LOAN_DDANGYO_SOHO_N_PR_067131',       productId: 'LOAN_DDANGYO_SOHO',       productName: '땡겨요 사업자대출', intent: 'business_loan_dangyo_apply',             actionType: 'navigate',   targetScreenId: 'N_PR_067131',     targetScreenName: '사업자정보확인',           screenType: 'screen',      ctaLabel: '사업자정보 확인 이동',             precheck, description: '사업자정보 확인',                menuPath: '상품 > 사업자대출 > 땡겨요 사업자대출', source: ddSource },
    { routingId: 'ROUTE_LOAN_DDANGYO_SOHO_N_PR_067133',       productId: 'LOAN_DDANGYO_SOHO',       productName: '땡겨요 사업자대출', intent: 'business_loan_dangyo_apply',             actionType: 'navigate',   targetScreenId: 'N_PR_067133',     targetScreenName: '한도조회결과',             screenType: 'screen',      ctaLabel: '한도조회 결과 확인',               precheck, description: '한도조회 결과',                  menuPath: '상품 > 사업자대출 > 땡겨요 사업자대출', source: ddSource },
    { routingId: 'ROUTE_LOAN_DDANGYO_SOHO_N_PR_067134',       productId: 'LOAN_DDANGYO_SOHO',       productName: '땡겨요 사업자대출', intent: 'business_loan_dangyo_apply',             actionType: 'navigate',   targetScreenId: 'N_PR_067134',     targetScreenName: '공동인증서사업장정보조회', screenType: 'screen',      ctaLabel: '공동인증서 기반 사업장정보 조회 이동', precheck, description: '공동인증서 기반 사업장정보 조회', menuPath: '상품 > 사업자대출 > 땡겨요 사업자대출', source: ddSource },
    { routingId: 'ROUTE_LOAN_DDANGYO_SOHO_N_PR_067151',       productId: 'LOAN_DDANGYO_SOHO',       productName: '땡겨요 사업자대출', intent: 'business_loan_dangyo_apply',             actionType: 'navigate',   targetScreenId: 'N_PR_067151',     targetScreenName: '약관동의',                 screenType: 'screen',      ctaLabel: '약관 확인',                        precheck, description: '약관 동의',                      menuPath: '상품 > 사업자대출 > 땡겨요 사업자대출', source: ddSource },
    { routingId: 'ROUTE_LOAN_DDANGYO_SOHO_N_PR_067161',       productId: 'LOAN_DDANGYO_SOHO',       productName: '땡겨요 사업자대출', intent: 'business_loan_dangyo_apply',             actionType: 'navigate',   targetScreenId: 'N_PR_067161',     targetScreenName: '고객정보확인',             screenType: 'screen',      ctaLabel: '고객정보 확인 이동',               precheck, description: '고객정보 확인',                  menuPath: '상품 > 사업자대출 > 땡겨요 사업자대출', source: ddSource },
    { routingId: 'ROUTE_LOAN_DDANGYO_SOHO_N_PR_067162',       productId: 'LOAN_DDANGYO_SOHO',       productName: '땡겨요 사업자대출', intent: 'business_loan_dangyo_apply',             actionType: 'navigate',   targetScreenId: 'N_PR_067162',     targetScreenName: '신청정보입력',             screenType: 'screen',      ctaLabel: '신청 진행',                        precheck, description: '신청정보 입력',                  menuPath: '상품 > 사업자대출 > 땡겨요 사업자대출', source: ddSource },
    { routingId: 'ROUTE_LOAN_DDANGYO_SOHO_N_PR_002008_P01',   productId: 'LOAN_DDANGYO_SOHO',       productName: '땡겨요 사업자대출', intent: 'business_loan_dangyo_apply',             actionType: 'showPopup',  targetScreenId: 'N_PR_002008_P01', targetScreenName: '공통_금리물안내',         screenType: 'popup',       ctaLabel: '확인하기',                         precheck, description: '금리물 안내',                    menuPath: '상품 > 사업자대출 > 땡겨요 사업자대출', source: ddSource },
    { routingId: 'ROUTE_LOAN_DDANGYO_SOHO_N_PR_067169',       productId: 'LOAN_DDANGYO_SOHO',       productName: '땡겨요 사업자대출', intent: 'business_loan_dangyo_apply',             actionType: 'navigate',   targetScreenId: 'N_PR_067169',     targetScreenName: '대출신청완료',             screenType: 'result',      ctaLabel: '진행상태 확인',                    precheck, description: '대출신청 완료',                  menuPath: '상품 > 사업자대출 > 땡겨요 사업자대출', source: ddSource },
    { routingId: 'ROUTE_LOAN_DDANGYO_SOHO_N_PR_067191',       productId: 'LOAN_DDANGYO_SOHO',       productName: '땡겨요 사업자대출', intent: 'business_loan_dangyo_apply',             actionType: 'navigate',   targetScreenId: 'N_PR_067191',     targetScreenName: '대출약정완료',             screenType: 'result',      ctaLabel: '진행상태 확인',                    precheck, description: '대출약정 완료',                  menuPath: '상품 > 사업자대출 > 땡겨요 사업자대출', source: ddSource },
    // LOAN_REGIONAL_GUARANTEE
    { routingId: 'ROUTE_LOAN_REGIONAL_GUARANTEE_N_PR_066121_D01',  productId: 'LOAN_REGIONAL_GUARANTEE', productName: '지역신용보증재단 비대면보증부대출', intent: 'regional_guarantee_business_loan_apply', actionType: 'navigate',   targetScreenId: 'N_PR_066121_D01', targetScreenName: '개인사업자제한안내',       screenType: 'dialog',      ctaLabel: '상품 진입 제한 이동',              precheck, description: '상품 진입 제한',                menuPath: '상품 > 보증서대출 > 지역신용보증재단비대면보증부대출', source: ddSource },
    { routingId: 'ROUTE_LOAN_REGIONAL_GUARANTEE_N_PR_066122',       productId: 'LOAN_REGIONAL_GUARANTEE', productName: '지역신용보증재단 비대면보증부대출', intent: 'regional_guarantee_business_loan_apply', actionType: 'navigate',   targetScreenId: 'N_PR_066122',     targetScreenName: '신용보증재단선택',         screenType: 'screen',      ctaLabel: '신용보증재단 및 대출관리점 선택 이동', precheck, description: '신용보증재단 및 대출관리점 선택', menuPath: '상품 > 보증서대출 > 지역신용보증재단비대면보증부대출', source: ddSource },
    { routingId: 'ROUTE_LOAN_REGIONAL_GUARANTEE_N_PR_066122_B01',   productId: 'LOAN_REGIONAL_GUARANTEE', productName: '지역신용보증재단 비대면보증부대출', intent: 'regional_guarantee_business_loan_apply', actionType: 'showPopup',  targetScreenId: 'N_PR_066122_B01', targetScreenName: '지역신용보증재단선택',     screenType: 'bottomSheet', ctaLabel: '확인하기',                         precheck, description: '지역신용보증재단 선택',          menuPath: '상품 > 보증서대출 > 지역신용보증재단비대면보증부대출', source: ddSource },
    { routingId: 'ROUTE_LOAN_REGIONAL_GUARANTEE_N_PR_066123',       productId: 'LOAN_REGIONAL_GUARANTEE', productName: '지역신용보증재단 비대면보증부대출', intent: 'regional_guarantee_business_loan_apply', actionType: 'navigate',   targetScreenId: 'N_PR_066123',     targetScreenName: '신청전유의사항',           screenType: 'screen',      ctaLabel: '신청 진행',                        precheck, description: '신청 전 유의사항 동의',          menuPath: '상품 > 보증서대출 > 지역신용보증재단비대면보증부대출', source: ddSource },
    { routingId: 'ROUTE_LOAN_REGIONAL_GUARANTEE_N_PR_066131',       productId: 'LOAN_REGIONAL_GUARANTEE', productName: '지역신용보증재단 비대면보증부대출', intent: 'regional_guarantee_business_loan_apply', actionType: 'navigate',   targetScreenId: 'N_PR_066131',     targetScreenName: '사업자정보확인',           screenType: 'screen',      ctaLabel: '사업자정보 확인 이동',             precheck, description: '사업자정보 확인',                menuPath: '상품 > 보증서대출 > 지역신용보증재단비대면보증부대출', source: ddSource },
    { routingId: 'ROUTE_LOAN_REGIONAL_GUARANTEE_N_PR_066134',       productId: 'LOAN_REGIONAL_GUARANTEE', productName: '지역신용보증재단 비대면보증부대출', intent: 'regional_guarantee_business_loan_apply', actionType: 'navigate',   targetScreenId: 'N_PR_066134',     targetScreenName: '공동인증서사업장정보조회', screenType: 'screen',      ctaLabel: '공동인증서/매출정보 제출 이동',    precheck, description: '공동인증서/매출정보 제출',        menuPath: '상품 > 보증서대출 > 지역신용보증재단비대면보증부대출', source: ddSource },
    { routingId: 'ROUTE_LOAN_REGIONAL_GUARANTEE_N_PR_066139',       productId: 'LOAN_REGIONAL_GUARANTEE', productName: '지역신용보증재단 비대면보증부대출', intent: 'regional_guarantee_business_loan_apply', actionType: 'navigate',   targetScreenId: 'N_PR_066139',     targetScreenName: '보증한도조회결과',         screenType: 'screen',      ctaLabel: '한도조회 결과 확인',               precheck, description: '보증한도조회 결과',              menuPath: '상품 > 보증서대출 > 지역신용보증재단비대면보증부대출', source: ddSource },
    { routingId: 'ROUTE_LOAN_REGIONAL_GUARANTEE_N_PR_066151',       productId: 'LOAN_REGIONAL_GUARANTEE', productName: '지역신용보증재단 비대면보증부대출', intent: 'regional_guarantee_business_loan_apply', actionType: 'navigate',   targetScreenId: 'N_PR_066151',     targetScreenName: '약관동의',                 screenType: 'screen',      ctaLabel: '약관 확인',                        precheck, description: '약관 동의',                      menuPath: '상품 > 보증서대출 > 지역신용보증재단비대면보증부대출', source: ddSource },
    { routingId: 'ROUTE_LOAN_REGIONAL_GUARANTEE_N_PR_066161',       productId: 'LOAN_REGIONAL_GUARANTEE', productName: '지역신용보증재단 비대면보증부대출', intent: 'regional_guarantee_business_loan_apply', actionType: 'navigate',   targetScreenId: 'N_PR_066161',     targetScreenName: '사업장정보입력',           screenType: 'screen',      ctaLabel: '사업장정보 입력 이동',             precheck, description: '사업장정보 입력',                menuPath: '상품 > 보증서대출 > 지역신용보증재단비대면보증부대출', source: ddSource },
    { routingId: 'ROUTE_LOAN_REGIONAL_GUARANTEE_N_PR_066161_B01',   productId: 'LOAN_REGIONAL_GUARANTEE', productName: '지역신용보증재단 비대면보증부대출', intent: 'regional_guarantee_business_loan_apply', actionType: 'showPopup',  targetScreenId: 'N_PR_066161_B01', targetScreenName: '건물층선택',               screenType: 'bottomSheet', ctaLabel: '확인하기',                         precheck, description: '건물층 선택',                    menuPath: '상품 > 보증서대출 > 지역신용보증재단비대면보증부대출', source: ddSource },
    { routingId: 'ROUTE_LOAN_REGIONAL_GUARANTEE_N_PR_066162',       productId: 'LOAN_REGIONAL_GUARANTEE', productName: '지역신용보증재단 비대면보증부대출', intent: 'regional_guarantee_business_loan_apply', actionType: 'navigate',   targetScreenId: 'N_PR_066162',     targetScreenName: '본인추가정보입력',         screenType: 'screen',      ctaLabel: '본인 추가정보 입력 이동',          precheck, description: '본인 추가정보 입력',              menuPath: '상품 > 보증서대출 > 지역신용보증재단비대면보증부대출', source: ddSource },
    { routingId: 'ROUTE_LOAN_REGIONAL_GUARANTEE_N_PR_066163',       productId: 'LOAN_REGIONAL_GUARANTEE', productName: '지역신용보증재단 비대면보증부대출', intent: 'regional_guarantee_business_loan_apply', actionType: 'navigate',   targetScreenId: 'N_PR_066163',     targetScreenName: '신청정보입력',             screenType: 'screen',      ctaLabel: '신청 진행',                        precheck, description: '신청정보 입력',                  menuPath: '상품 > 보증서대출 > 지역신용보증재단비대면보증부대출', source: ddSource },
    { routingId: 'ROUTE_LOAN_REGIONAL_GUARANTEE_N_PR_066163_B01',   productId: 'LOAN_REGIONAL_GUARANTEE', productName: '지역신용보증재단 비대면보증부대출', intent: 'regional_guarantee_business_loan_apply', actionType: 'showPopup',  targetScreenId: 'N_PR_066163_B01', targetScreenName: '자금용도선택',             screenType: 'bottomSheet', ctaLabel: '확인하기',                         precheck, description: '자금용도 선택',                  menuPath: '상품 > 보증서대출 > 지역신용보증재단비대면보증부대출', source: ddSource },
    { routingId: 'ROUTE_LOAN_REGIONAL_GUARANTEE_N_PR_066169',       productId: 'LOAN_REGIONAL_GUARANTEE', productName: '지역신용보증재단 비대면보증부대출', intent: 'regional_guarantee_business_loan_apply', actionType: 'navigate',   targetScreenId: 'N_PR_066169',     targetScreenName: '대출신청완료',             screenType: 'result',      ctaLabel: '진행상태 확인',                    precheck, description: '보증 및 대출신청 완료',          menuPath: '상품 > 보증서대출 > 지역신용보증재단비대면보증부대출', source: ddSource },
    { routingId: 'ROUTE_LOAN_REGIONAL_GUARANTEE_N_PR_066291',       productId: 'LOAN_REGIONAL_GUARANTEE', productName: '지역신용보증재단 비대면보증부대출', intent: 'regional_guarantee_business_loan_apply', actionType: 'navigate',   targetScreenId: 'N_PR_066291',     targetScreenName: '보증약정및대출약정완료',   screenType: 'result',      ctaLabel: '진행상태 확인',                    precheck, description: '보증 약정 및 대출 약정 완료',    menuPath: '상품 > 보증서대출 > 지역신용보증재단비대면보증부대출', source: ddSource },
    { routingId: 'ROUTE_LOAN_REGIONAL_GUARANTEE_N_PR_002008_P01',   productId: 'LOAN_REGIONAL_GUARANTEE', productName: '지역신용보증재단 비대면보증부대출', intent: 'regional_guarantee_business_loan_apply', actionType: 'showPopup',  targetScreenId: 'N_PR_002008_P01', targetScreenName: '공통_금리물안내',         screenType: 'popup',       ctaLabel: '확인하기',                         precheck, description: '금리물 안내',                    menuPath: '상품 > 보증서대출 > 지역신용보증재단비대면보증부대출', source: ddSource },
  ])

  console.log('\n✅ 시드 완료! CSV 원본 구조 기준 복원 완료')
  console.log('   상품: LOAN_DDANGYO_SOHO, LOAN_REGIONAL_GUARANTEE')
  console.log('   screen_mapping: 26건 | routing_map: 26건 | product_search_keyword: 12건')
}

seed().catch(console.error)
