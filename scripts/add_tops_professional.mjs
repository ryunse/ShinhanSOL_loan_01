/**
 * LOAN_TOPS_PROFESSIONAL — Tops 전문직우대론 DB 추가 스크립트
 *
 * 데이터 출처: Figma 상품소개화면 (node-id 151:7714, 2026.06.28 기준)
 * 실행: node scripts/add_tops_professional.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const env = Object.fromEntries(
  readFileSync(resolve(__dirname, '../.env'), 'utf-8')
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
const supabase = createClient(env.SUPABASE_URL, key, { auth: { persistSession: false } })

const PRODUCT_ID = 'LOAN_TOPS_PROFESSIONAL'
const precheck = '전문직 자격증 보유 여부 및 신용상태 사전 확인 필요'
const source = 'figma_product_intro_node_151_7714'

async function insert(table, rows) {
  const { error } = await supabase.from(table).insert(rows)
  if (error) {
    console.error(`❌ ${table} 삽입 오류:`, JSON.stringify(error, null, 2))
    process.exit(1)
  }
  console.log(`✓ ${table} (${rows.length}건)`)
}

async function add() {
  console.log('Tops 전문직우대론 상품 추가 시작\n')

  // ── 1. screen_mapping ─────────────────────────────────────────────────────
  // 전문직우대론 신청 플로우 — 실제 화면 ID는 운영 시스템 확정 후 업데이트 필요
  await insert('screen_mapping', [
    { flowId: 'FLOW_TOPS_PROFESSIONAL_LOAN', order: '1',    screenId: 'N_PR_068122',     screenName: '신청전유의사항동의',   screenType: 'screen',  stepLabel: '신청 전 유의사항 동의', isPopup: false, isErrorBranch: false, nextDefaultScreen: 'N_PR_068131' },
    { flowId: 'FLOW_TOPS_PROFESSIONAL_LOAN', order: '2',    screenId: 'N_PR_068131',     screenName: '자격증확인',           screenType: 'screen',  stepLabel: '전문직 자격증 확인',    isPopup: false, isErrorBranch: false, nextDefaultScreen: 'N_PR_068133' },
    { flowId: 'FLOW_TOPS_PROFESSIONAL_LOAN', order: '3',    screenId: 'N_PR_068133',     screenName: '한도조회결과',         screenType: 'screen',  stepLabel: '한도조회 결과',         isPopup: false, isErrorBranch: false, nextDefaultScreen: 'N_PR_068151' },
    { flowId: 'FLOW_TOPS_PROFESSIONAL_LOAN', order: '4',    screenId: 'N_PR_068151',     screenName: '약관동의',             screenType: 'screen',  stepLabel: '약관 동의',             isPopup: false, isErrorBranch: false, nextDefaultScreen: 'N_PR_068161' },
    { flowId: 'FLOW_TOPS_PROFESSIONAL_LOAN', order: '5',    screenId: 'N_PR_068161',     screenName: '고객정보확인',         screenType: 'screen',  stepLabel: '고객정보 확인',         isPopup: false, isErrorBranch: false, nextDefaultScreen: 'N_PR_068162' },
    { flowId: 'FLOW_TOPS_PROFESSIONAL_LOAN', order: '6',    screenId: 'N_PR_068162',     screenName: '신청정보입력',         screenType: 'screen',  stepLabel: '신청정보 입력',         isPopup: false, isErrorBranch: false, nextDefaultScreen: 'N_PR_068169' },
    { flowId: 'FLOW_TOPS_PROFESSIONAL_LOAN', order: '6-P',  screenId: 'N_PR_002008_P01', screenName: '공통_금리물안내',     screenType: 'popup',   stepLabel: '금리물 안내',           isPopup: true,  isErrorBranch: false, nextDefaultScreen: 'previousScreen' },
    { flowId: 'FLOW_TOPS_PROFESSIONAL_LOAN', order: '7',    screenId: 'N_PR_068169',     screenName: '대출신청완료',         screenType: 'result',  stepLabel: '대출신청 완료',         isPopup: false, isErrorBranch: false, nextDefaultScreen: 'N_PR_068191' },
    { flowId: 'FLOW_TOPS_PROFESSIONAL_LOAN', order: '8',    screenId: 'N_PR_068191',     screenName: '대출약정완료',         screenType: 'result',  stepLabel: '대출약정 완료',         isPopup: false, isErrorBranch: false, nextDefaultScreen: 'home' },
  ])

  // ── 2. product_master ─────────────────────────────────────────────────────
  await insert('product_master', [
    {
      productId: PRODUCT_ID,
      productName: 'Tops 전문직우대론',
      productGroup: '개인금융',
      productCategory: '사업자대출',
      menuDepth1: '상품',
      menuDepth2: '사업자대출',
      menuDepth3: 'Tops 전문직 우대론',
      menuPath: '상품 > 사업자대출 > Tops 전문직 우대론',
      intent: 'tops_professional_loan_apply',
      flowId: 'FLOW_TOPS_PROFESSIONAL_LOAN',
      active: 'Y',
      remarks: '전문직 자격증 소지자(개인사업자·급여소득자) 전용 무보증 맞춤신용대출',
    },
  ])

  // ── 3. product_policy ─────────────────────────────────────────────────────
  // 직종별 한도: 법조계 4억원, 의료계·기타전문직 3억원 — maxAmount는 최대치 기준
  // 유동성한도대출(마이너스통장) 별도 최대 2억원
  await insert('product_policy', [
    {
      productId: PRODUCT_ID,
      loanType: '전문직 신용대출',
      targetCustomer: '전문직 자격증 소지자 (개인사업자, 급여소득자)',
      loanPurpose: '운전자금',
      collateralOrGuarantee: '신용 (무보증)',
      guaranteeRequired: 'N',
      guaranteeAgencyType: null,
      minAmount: 1000000,
      maxAmount: 400000000,      // 법조계 기준 최대 4억원 (의료계·기타전문직 3억원)
      amountStep: null,
      stampTaxCondition: '대출금액 5천만원 초과 시 인지세 발생 (은행 50% 부담), 5천만원 이하 비과세',
      rateType: '변동금리 (6개월 또는 1년 주기)',
      baseRateOptions: ['CD91일물', '금융채6개월물'],
      repaymentOptions: ['만기일시상환', '마이너스통장(유동성한도대출)'],
      applicationChannel: '신한쏠비즈 비대면',
      minRate: 4.65,
      maxRate: 5.53,
      rateBaseDate: '2026.06.28',
      maxTerm: '1년 이내 (1년 단위 최장 20년 연장 가능)',
    },
  ])

  // ── 4. eligibility_rules ──────────────────────────────────────────────────
  await insert('eligibility_rules', [
    {
      ruleId: 'ELG_TP_001',
      productId: PRODUCT_ID,
      ruleName: '전문직 자격증 보유',
      conditionDescription:
        '아래 전문직 자격증 중 하나를 보유하고 계신가요?\n' +
        '• 법조계: 판사, 검사, 변호사, 사법연수생, 변리사, 법무관\n' +
        '• 의료계: 의사, 치과의사, 한의사, 약사 등\n' +
        '• 기타전문직: 공인회계사, 세무사, 건축사, 감정평가사 등',
      failMessage: '전문직 자격증 보유자에 한해 신청 가능합니다.',
      failAction: 'block',
      status: 'active',
      conditionPolarity: 'positive',
      qaTarget: 'user',
    },
    {
      ruleId: 'ELG_TP_002',
      productId: PRODUCT_ID,
      ruleName: '신용 불량 해당 없음',
      conditionDescription:
        '아래 항목 중 해당되는 사항이 없으셔야 신청이 가능합니다.\n' +
        '• 금융기관 연체 또는 부실채권\n' +
        '• 신용회복 또는 워크아웃 진행 중\n' +
        '• 개인회생·파산 진행 중 또는 면책 후 일정 기간 미경과',
      failMessage: '신용상 불량 상태인 경우 신청이 어렵습니다. 신용상태 개선 후 재상담 바랍니다.',
      failAction: 'block',
      status: 'active',
      conditionPolarity: 'negative',
      qaTarget: 'user',
    },
    {
      ruleId: 'ELG_TP_003',
      productId: PRODUCT_ID,
      ruleName: '기존 신용대출 한도 공제',
      conditionDescription:
        '현재 당행·타행에서 신용대출을 받고 계신가요?\n' +
        '(신청 당시 보유한 당·타행 신용대출 전액이 대출한도에서 공제됩니다)',
      failMessage: '기존 신용대출 금액이 본 상품 한도를 초과하는 경우 신청이 어렵습니다.',
      failAction: 'advisory',
      status: 'active',
      conditionPolarity: 'positive',
      qaTarget: 'user',
    },
  ])

  // ── 5. product_search_keyword ─────────────────────────────────────────────
  await insert('product_search_keyword', [
    { productId: PRODUCT_ID, keywordType: '상품명',  keyword: 'Tops 전문직우대론',    weight: 100, matchIntentHint: 'tops_professional_loan_apply',        remarks: '정식 상품명' },
    { productId: PRODUCT_ID, keywordType: '상품명',  keyword: '전문직우대론',          weight: 100, matchIntentHint: 'tops_professional_loan_apply',        remarks: '핵심어' },
    { productId: PRODUCT_ID, keywordType: '상품명',  keyword: '전문직대출',            weight: 90,  matchIntentHint: 'tops_professional_loan_apply',        remarks: '상품 유형' },
    { productId: PRODUCT_ID, keywordType: '상품명',  keyword: 'tops',                  weight: 80,  matchIntentHint: 'tops_professional_loan_apply',        remarks: '브랜드명' },
    { productId: PRODUCT_ID, keywordType: '대상',    keyword: '전문직',                weight: 80,  matchIntentHint: 'tops_professional_loan_consultation', remarks: '대상 힌트' },
    { productId: PRODUCT_ID, keywordType: '대상',    keyword: '변호사대출',            weight: 80,  matchIntentHint: 'tops_professional_loan_consultation', remarks: '법조계 힌트' },
    { productId: PRODUCT_ID, keywordType: '대상',    keyword: '의사대출',              weight: 80,  matchIntentHint: 'tops_professional_loan_consultation', remarks: '의료계 힌트' },
    { productId: PRODUCT_ID, keywordType: '대상',    keyword: '자격증',                weight: 70,  matchIntentHint: 'tops_professional_loan_consultation', remarks: '대상 힌트' },
    { productId: PRODUCT_ID, keywordType: '특징',    keyword: '무보증신용대출',        weight: 70,  matchIntentHint: 'tops_professional_loan_consultation', remarks: '상품 특징' },
    { productId: PRODUCT_ID, keywordType: '특징',    keyword: '마이너스통장',          weight: 60,  matchIntentHint: 'tops_professional_loan_consultation', remarks: '상환방식 힌트' },
  ])

  // ── 6. routing_map ────────────────────────────────────────────────────────
  const menuPath = '상품 > 사업자대출 > Tops 전문직 우대론'
  const intent = 'tops_professional_loan_apply'
  const pName = 'Tops 전문직우대론'
  await insert('routing_map', [
    { routingId: 'ROUTE_TOPS_PRO_N_PR_068122',     productId: PRODUCT_ID, productName: pName, intent, actionType: 'navigate',  targetScreenId: 'N_PR_068122',     targetScreenName: '신청전유의사항동의', screenType: 'screen', ctaLabel: '신청 진행',                   precheck, description: '신청 전 유의사항 동의',    menuPath, source },
    { routingId: 'ROUTE_TOPS_PRO_N_PR_068131',     productId: PRODUCT_ID, productName: pName, intent, actionType: 'navigate',  targetScreenId: 'N_PR_068131',     targetScreenName: '자격증확인',         screenType: 'screen', ctaLabel: '자격증 확인',                 precheck, description: '전문직 자격증 확인',        menuPath, source },
    { routingId: 'ROUTE_TOPS_PRO_N_PR_068133',     productId: PRODUCT_ID, productName: pName, intent, actionType: 'navigate',  targetScreenId: 'N_PR_068133',     targetScreenName: '한도조회결과',       screenType: 'screen', ctaLabel: '한도 조회',                   precheck, description: '한도조회 결과',              menuPath, source },
    { routingId: 'ROUTE_TOPS_PRO_N_PR_068151',     productId: PRODUCT_ID, productName: pName, intent, actionType: 'navigate',  targetScreenId: 'N_PR_068151',     targetScreenName: '약관동의',           screenType: 'screen', ctaLabel: '약관 확인',                   precheck, description: '약관 동의',                  menuPath, source },
    { routingId: 'ROUTE_TOPS_PRO_N_PR_068161',     productId: PRODUCT_ID, productName: pName, intent, actionType: 'navigate',  targetScreenId: 'N_PR_068161',     targetScreenName: '고객정보확인',       screenType: 'screen', ctaLabel: '고객정보 확인',               precheck, description: '고객정보 확인',              menuPath, source },
    { routingId: 'ROUTE_TOPS_PRO_N_PR_068162',     productId: PRODUCT_ID, productName: pName, intent, actionType: 'navigate',  targetScreenId: 'N_PR_068162',     targetScreenName: '신청정보입력',       screenType: 'screen', ctaLabel: '신청 진행',                   precheck, description: '신청정보 입력',              menuPath, source },
    { routingId: 'ROUTE_TOPS_PRO_N_PR_002008_P01', productId: PRODUCT_ID, productName: pName, intent, actionType: 'showPopup', targetScreenId: 'N_PR_002008_P01', targetScreenName: '공통_금리물안내',   screenType: 'popup',  ctaLabel: '확인하기',                    precheck, description: '금리물 안내',                menuPath, source },
    { routingId: 'ROUTE_TOPS_PRO_N_PR_068169',     productId: PRODUCT_ID, productName: pName, intent, actionType: 'navigate',  targetScreenId: 'N_PR_068169',     targetScreenName: '대출신청완료',       screenType: 'result', ctaLabel: '진행상태 확인',               precheck, description: '대출신청 완료',              menuPath, source },
    { routingId: 'ROUTE_TOPS_PRO_N_PR_068191',     productId: PRODUCT_ID, productName: pName, intent, actionType: 'navigate',  targetScreenId: 'N_PR_068191',     targetScreenName: '대출약정완료',       screenType: 'result', ctaLabel: '진행상태 확인',               precheck, description: '대출약정 완료',              menuPath, source },
  ])

  console.log('\n✅ Tops 전문직우대론 추가 완료')
  console.log('   productId:', PRODUCT_ID)
  console.log('   screen_mapping: 9건 | product_master: 1건 | product_policy: 1건')
  console.log('   eligibility_rules: 3건 | product_search_keyword: 10건 | routing_map: 9건')
  console.log('\n⚠️  참고사항:')
  console.log('   - screen_mapping의 N_PR_068xxx 화면 ID는 실제 운영 시스템 ID 확정 후 업데이트 필요')
  console.log('   - 직종별 최고한도: 법조계 4억원, 의료계·기타전문직 3억원 (maxAmount는 법조계 기준 4억원)')
  console.log('   - 유동성한도대출(마이너스통장) 최대 2억원 별도 운용')
}

add().catch(console.error)
