/**
 * LOAN_TOPS_PROFESSIONAL — 화면설계 Figma(node-id 152:8381) 기반
 * 플레이스홀더 screen_mapping / routing_map 을 실제 화면 ID로 교체한다.
 *
 * 실행: node scripts/patch_tops_professional_screens.mjs
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
    .map(l => { const idx = l.indexOf('='); return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()] })
)

const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY
if (!env.SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('⚠️  SUPABASE_SERVICE_ROLE_KEY 없음 — anon 키 사용')
}
const supabase = createClient(env.SUPABASE_URL, key, { auth: { persistSession: false } })

const PRODUCT_ID  = 'LOAN_TOPS_PROFESSIONAL'
const FLOW_ID     = 'FLOW_TOPS_PROFESSIONAL_LOAN'
const precheck    = '전문직 자격증 보유 여부 및 신용상태 사전 확인 필요'
const source      = 'figma_screen_design_node_152_8381'
const menuPath    = '상품 > 사업자대출 > Tops 전문직 우대론'
const intent      = 'tops_professional_loan_apply'
const pName       = 'Tops 전문직우대론'

async function del(table, col, val) {
  const { error } = await supabase.from(table).delete().eq(col, val)
  if (error) { console.error(`❌ ${table} 삭제 오류:`, error.message); process.exit(1) }
}

async function insert(table, rows) {
  const { error } = await supabase.from(table).insert(rows)
  if (error) { console.error(`❌ ${table} 삽입 오류:`, JSON.stringify(error, null, 2)); process.exit(1) }
  console.log(`✓ ${table} (${rows.length}건)`)
}

async function patch() {
  console.log('Tops 전문직우대론 화면 ID 패치 시작\n')

  // ── 기존 플레이스홀더 삭제 ──────────────────────────────────────────────────
  await del('routing_map',    'productId', PRODUCT_ID)
  await del('screen_mapping', 'flowId',    FLOW_ID)
  console.log('✓ 기존 플레이스홀더 삭제 완료\n')

  // ── 1. screen_mapping — 실제 화면 ID 기준 ──────────────────────────────────
  // Figma node 152:8381 "Tops 전문직 우대론" 섹션 x 좌표 순서 기준
  await insert('screen_mapping', [
    {
      flowId: FLOW_ID, order: '1',
      screenId: 'N_PR_014151', screenName: '약관동의',
      screenType: 'screen', stepLabel: '약관 동의',
      isPopup: false, isErrorBranch: false, nextDefaultScreen: 'N_PR_014134',
    },
    {
      flowId: FLOW_ID, order: '2',
      screenId: 'N_PR_014134', screenName: '공동인증서사업장정보조회',
      screenType: 'screen', stepLabel: '공동인증서 기반 사업장정보·본인추가정보 입력',
      isPopup: false, isErrorBranch: false, nextDefaultScreen: 'N_PR_014131',
    },
    {
      flowId: FLOW_ID, order: '3',
      screenId: 'N_PR_014131', screenName: '사업자정보확인',
      screenType: 'screen', stepLabel: '사업자정보 확인',
      isPopup: false, isErrorBranch: false, nextDefaultScreen: 'N_PR_014132',
    },
    {
      flowId: FLOW_ID, order: '4',
      screenId: 'N_PR_014132', screenName: '소득금액입력및서류제출',
      screenType: 'screen', stepLabel: '소득금액 입력 및 서류제출',
      isPopup: false, isErrorBranch: false, nextDefaultScreen: 'N_PR_014133',
    },
    {
      flowId: FLOW_ID, order: '5',
      screenId: 'N_PR_014133', screenName: '한도조회결과',
      screenType: 'screen', stepLabel: '한도조회 결과',
      isPopup: false, isErrorBranch: false, nextDefaultScreen: 'N_PR_014161',
    },
    {
      flowId: FLOW_ID, order: '6',
      screenId: 'N_PR_014161', screenName: '고객정보확인',
      screenType: 'screen', stepLabel: '고객정보 확인 (자택·사업장 주소)',
      isPopup: false, isErrorBranch: false, nextDefaultScreen: 'N_PR_014162',
    },
    {
      flowId: FLOW_ID, order: '7',
      screenId: 'N_PR_014162', screenName: '신청정보입력',
      screenType: 'screen', stepLabel: '신청정보 입력 (신청금액·상환방식·대출기간)',
      isPopup: false, isErrorBranch: false, nextDefaultScreen: 'N_PR_014169',
    },
    {
      flowId: FLOW_ID, order: '7-P',
      screenId: 'N_PR_014162_B01', screenName: '자금용도선택',
      screenType: 'bottomSheet', stepLabel: '자금용도 선택',
      isPopup: true, isErrorBranch: false, nextDefaultScreen: 'N_PR_014162',
    },
    {
      flowId: FLOW_ID, order: '8',
      screenId: 'N_PR_014169', screenName: '대출신청완료',
      screenType: 'result', stepLabel: '대출신청 완료',
      isPopup: false, isErrorBranch: false, nextDefaultScreen: 'N_PR_014169_sub',
    },
    {
      flowId: FLOW_ID, order: '9',
      screenId: 'N_PR_014169_sub', screenName: '미비서류제출',
      screenType: 'screen', stepLabel: '미비서류 제출 (심사중 상태)',
      isPopup: false, isErrorBranch: false, nextDefaultScreen: 'home',
    },
    {
      flowId: FLOW_ID, order: 'common',
      screenId: 'N_PR_002008_P01', screenName: '공통_금리물안내',
      screenType: 'popup', stepLabel: '금리물 안내',
      isPopup: true, isErrorBranch: false, nextDefaultScreen: 'previousScreen',
    },
  ])

  // ── 2. routing_map — CTA 라우트 ──────────────────────────────────────────────
  await insert('routing_map', [
    {
      routingId: 'ROUTE_TOPS_PRO_000_014151_ENTRY', // 000_ prefix: ensure this entry point sorts first
      productId: PRODUCT_ID, productName: pName, intent,
      actionType: 'navigate', targetScreenId: 'N_PR_014151',
      targetScreenName: '약관동의',
      screenType: 'screen', ctaLabel: '약관 동의 후 신청 시작',
      precheck, description: '약관 동의', menuPath, source,
    },
    {
      routingId: 'ROUTE_TOPS_PRO_014134',
      productId: PRODUCT_ID, productName: pName, intent,
      actionType: 'navigate', targetScreenId: 'N_PR_014134',
      targetScreenName: '공동인증서사업장정보조회',
      screenType: 'screen', ctaLabel: '사업장정보 조회',
      precheck, description: '공동인증서 기반 사업장정보·본인추가정보 입력', menuPath, source,
    },
    {
      routingId: 'ROUTE_TOPS_PRO_014131',
      productId: PRODUCT_ID, productName: pName, intent,
      actionType: 'navigate', targetScreenId: 'N_PR_014131',
      targetScreenName: '사업자정보확인',
      screenType: 'screen', ctaLabel: '사업자정보 확인',
      precheck, description: '사업자정보 확인', menuPath, source,
    },
    {
      routingId: 'ROUTE_TOPS_PRO_014132',
      productId: PRODUCT_ID, productName: pName, intent,
      actionType: 'navigate', targetScreenId: 'N_PR_014132',
      targetScreenName: '소득금액입력및서류제출',
      screenType: 'screen', ctaLabel: '소득금액 입력',
      precheck, description: '소득금액 입력 및 서류제출', menuPath, source,
    },
    {
      routingId: 'ROUTE_TOPS_PRO_014133',
      productId: PRODUCT_ID, productName: pName, intent,
      actionType: 'navigate', targetScreenId: 'N_PR_014133',
      targetScreenName: '한도조회결과',
      screenType: 'screen', ctaLabel: '한도 조회 결과 확인',
      precheck, description: '한도조회 결과', menuPath, source,
    },
    {
      routingId: 'ROUTE_TOPS_PRO_014161',
      productId: PRODUCT_ID, productName: pName, intent,
      actionType: 'navigate', targetScreenId: 'N_PR_014161',
      targetScreenName: '고객정보확인',
      screenType: 'screen', ctaLabel: '고객정보 확인',
      precheck, description: '고객정보 확인 (자택·사업장 주소)', menuPath, source,
    },
    {
      routingId: 'ROUTE_TOPS_PRO_014162',
      productId: PRODUCT_ID, productName: pName, intent,
      actionType: 'navigate', targetScreenId: 'N_PR_014162',
      targetScreenName: '신청정보입력',
      screenType: 'screen', ctaLabel: '신청 진행',
      precheck, description: '신청정보 입력 (신청금액·상환방식·대출기간)', menuPath, source,
    },
    {
      routingId: 'ROUTE_TOPS_PRO_014162_B01',
      productId: PRODUCT_ID, productName: pName, intent,
      actionType: 'showPopup', targetScreenId: 'N_PR_014162_B01',
      targetScreenName: '자금용도선택',
      screenType: 'bottomSheet', ctaLabel: '자금용도 선택',
      precheck, description: '자금용도 선택 바텀시트', menuPath, source,
    },
    {
      routingId: 'ROUTE_TOPS_PRO_014169',
      productId: PRODUCT_ID, productName: pName, intent,
      actionType: 'navigate', targetScreenId: 'N_PR_014169',
      targetScreenName: '대출신청완료',
      screenType: 'result', ctaLabel: '진행상태 확인',
      precheck, description: '대출신청 완료', menuPath, source,
    },
    {
      routingId: 'ROUTE_TOPS_PRO_014169_sub',
      productId: PRODUCT_ID, productName: pName, intent,
      actionType: 'navigate', targetScreenId: 'N_PR_014169_sub',
      targetScreenName: '미비서류제출',
      screenType: 'screen', ctaLabel: '미비서류 제출',
      precheck, description: '대출신청 후 미비서류 제출 (심사중)', menuPath, source,
    },
    {
      routingId: 'ROUTE_TOPS_PRO_002008_P01',
      productId: PRODUCT_ID, productName: pName, intent,
      actionType: 'showPopup', targetScreenId: 'N_PR_002008_P01',
      targetScreenName: '공통_금리물안내',
      screenType: 'popup', ctaLabel: '확인하기',
      precheck, description: '금리물 안내', menuPath, source,
    },
  ])

  console.log('\n✅ 화면 ID 패치 완료')
  console.log('   screen_mapping: 11건 | routing_map: 11건')
  console.log('   플로우: N_PR_014151 → 014134 → 014131 → 014132 → 014133 → 014161 → 014162 → 014169')
}

patch().catch(console.error)
