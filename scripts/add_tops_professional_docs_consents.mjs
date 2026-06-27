/**
 * LOAN_TOPS_PROFESSIONAL — documents / consent_mapping 추가
 *
 * 실행: node scripts/add_tops_professional_docs_consents.mjs
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

const PRODUCT_ID = 'LOAN_TOPS_PROFESSIONAL'

async function del(table, col, val) {
  const { error } = await supabase.from(table).delete().eq(col, val)
  if (error) { console.error(`❌ ${table} 삭제 오류:`, error.message); process.exit(1) }
}

async function insert(table, rows) {
  const { error } = await supabase.from(table).insert(rows)
  if (error) { console.error(`❌ ${table} 삽입 오류:`, JSON.stringify(error, null, 2)); process.exit(1) }
  console.log(`✓ ${table} (${rows.length}건)`)
}

async function add() {
  console.log('Tops 전문직우대론 documents / consent_mapping 추가 시작\n')

  // ── 기존 데이터 삭제 (재실행 안전) ──────────────────────────────────────────
  await del('documents',       'productId', PRODUCT_ID)
  await del('consent_mapping', 'productId', PRODUCT_ID)
  console.log('✓ 기존 데이터 초기화\n')

  // ── 1. documents — 필요서류 ──────────────────────────────────────────────────
  // collectionMethod: '스크래핑' | '무방문서류제출' | '영업점 제출'
  // required: 'Y' (필수) | 'N' (필요 시 제출)
  await insert('documents', [
    // ── 필수 서류 ──────────────────────────────────────────────────────────────
    {
      productId:        PRODUCT_ID,
      documentId:       'DOC_TP_PROFESSIONAL_LICENSE',
      documentName:     '전문직 자격증',
      required:         'Y',
      collectionMethod: '무방문서류제출',
      usedFor:          '전문직 자격 확인',
      failureAction:    '신청 제한 — 자격증 미보유 시 신청 불가',
      remarks:          '판사·검사·변호사·사법연수생·변리사·법무관·의사·치과의사·한의사·약사·공인회계사·세무사 등',
    },
    {
      productId:        PRODUCT_ID,
      documentId:       'DOC_TP_BIZ_REG_CERT',
      documentName:     '사업자등록증 사본',
      required:         'Y',
      collectionMethod: '스크래핑',
      usedFor:          '사업자 확인/심사',
      failureAction:    '스크래핑 실패 시 무방문서류제출',
      remarks:          '개인사업자 해당자에 한함',
    },
    {
      productId:        PRODUCT_ID,
      documentId:       'DOC_TP_INCOME_AMOUNT',
      documentName:     '소득금액증명원',
      required:         'Y',
      collectionMethod: '스크래핑',
      usedFor:          '소득 확인',
      failureAction:    '스크래핑 실패 시 무방문서류제출',
      remarks:          '국세청 발급 — 최근 연도 기준',
    },
    {
      productId:        PRODUCT_ID,
      documentId:       'DOC_TP_NATIONAL_TAX_CLEARANCE',
      documentName:     '국세납세증명서',
      required:         'Y',
      collectionMethod: '스크래핑',
      usedFor:          '국세 체납 확인',
      failureAction:    '스크래핑 실패 시 무방문서류제출',
      remarks:          '국세청 발급',
    },
    {
      productId:        PRODUCT_ID,
      documentId:       'DOC_TP_LOCAL_TAX_CLEARANCE',
      documentName:     '지방세납세증명서',
      required:         'Y',
      collectionMethod: '스크래핑',
      usedFor:          '지방세 체납 확인',
      failureAction:    '스크래핑 실패 시 추가정보 입력 후 무방문서류제출',
      remarks:          '주민등록등본상 자택주소 일치 필요 (N_PR_014134 추가정보 입력)',
    },
    {
      productId:        PRODUCT_ID,
      documentId:       'DOC_TP_VAT_STANDARD',
      documentName:     '부가세과세표준증명원',
      required:         'Y',
      collectionMethod: '스크래핑',
      usedFor:          '매출 및 소득 확인',
      failureAction:    '스크래핑 실패 시 무방문서류제출',
      remarks:          '국세청 발급',
    },
    // ── 추가 준비서류 (필요 시) ────────────────────────────────────────────────
    {
      productId:        PRODUCT_ID,
      documentId:       'DOC_TP_LOAN_BALANCE_CERT',
      documentName:     '금융거래 확인서 (대출보유 금융기관)',
      required:         'N',
      collectionMethod: '무방문서류제출',
      usedFor:          '기존 대출 잔액 확인 (한도 공제 기준)',
      failureAction:    '무방문서류제출 또는 영업점 제출',
      remarks:          '당·타행 신용대출 보유 시 제출 — 신청 한도에서 전액 공제',
    },
    {
      productId:        PRODUCT_ID,
      documentId:       'DOC_TP_BRANCH_ADDITIONAL',
      documentName:     '영업점 심사 시 추가서류',
      required:         'N',
      collectionMethod: '영업점 제출',
      usedFor:          '심사 보완',
      failureAction:    '영업점 안내',
      remarks:          '영업점 심사 결과에 따라 추가 요청될 수 있음 — 구체적 항목은 담당 심사역 안내 기준',
    },
  ])

  // ── 2. consent_mapping — 약관 및 동의서 ─────────────────────────────────────
  // 약관동의 화면: N_PR_014151
  // required: 'Y' (필수) | 'N' (선택)
  // category: '여신공통' | '개인신용정보' | '서비스신청'
  await insert('consent_mapping', [
    {
      productId:    PRODUCT_ID,
      consentId:    'CONS_TP_COMMON_CREDIT_USE',
      consentName:  '[공통필수]개인(신용)정보 수집·이용·제공 동의서(여신)',
      required:     'Y',
      category:     '개인신용정보',
      screenId:     'N_PR_014151',
      displayOrder: 1,
      remarks:      '여신 공통 필수 동의서',
    },
    {
      productId:    PRODUCT_ID,
      consentId:    'CONS_TP_SOHO_CSS_CREDIT',
      consentName:  '[필수]개인(신용)정보 수집·이용·제공·조회 동의서(SOHO CSS 대안정보)',
      required:     'Y',
      category:     '개인신용정보',
      screenId:     'N_PR_014151',
      displayOrder: 2,
      remarks:      'SOHO CSS 대안정보 기반 신용평가 동의',
    },
    {
      productId:    PRODUCT_ID,
      consentId:    'CONS_TP_PRIVACY_RIGHTS',
      consentName:  '개인(신용)정보 수집·이용 및 제공 관련 고객 권리 안내문',
      required:     'Y',
      category:     '개인신용정보',
      screenId:     'N_PR_014151',
      displayOrder: 3,
      remarks:      '고객 권리 안내 (열람·정정·삭제·처리정지 요구권)',
    },
    {
      productId:    PRODUCT_ID,
      consentId:    'CONS_TP_CREDIT_INQUIRY',
      consentName:  '개인(신용)정보 조회 동의서',
      required:     'Y',
      category:     '개인신용정보',
      screenId:     'N_PR_014151',
      displayOrder: 4,
      remarks:      '신용정보회사·금융기관 신용조회 동의',
    },
    {
      productId:    PRODUCT_ID,
      consentId:    'CONS_TP_PRODUCT_DESC',
      consentName:  '기업대출 상품설명서',
      required:     'Y',
      category:     '여신공통',
      screenId:     'N_PR_014151',
      displayOrder: 5,
      remarks:      '대출 주요 조건·리스크 사전 고지',
    },
    {
      productId:    PRODUCT_ID,
      consentId:    'CONS_TP_SCRAPING_SERVICE',
      consentName:  '서류제출자동화(스크래핑)서비스 이용신청서(사업자대출용)',
      required:     'Y',
      category:     '서비스신청',
      screenId:     'N_PR_014151',
      displayOrder: 6,
      remarks:      '국세청·행안부 등 공공기관 스크래핑 서비스 이용 동의',
    },
    {
      productId:    PRODUCT_ID,
      consentId:    'CONS_TP_CREDIT_FINANCIAL_STMT',
      consentName:  '신용정보 수집 이용 제공 동의서(재무제표 수집 등)',
      required:     'Y',
      category:     '개인신용정보',
      screenId:     'N_PR_014151',
      displayOrder: 7,
      remarks:      '재무제표·매출 등 대안 신용정보 수집 동의',
    },
    {
      productId:    PRODUCT_ID,
      consentId:    'CONS_TP_LOAN_AGREEMENT',
      consentName:  '여신거래약정서(기업용)',
      required:     'Y',
      category:     '여신공통',
      screenId:     'N_PR_014151',
      displayOrder: 8,
      remarks:      '대출 실행 전 체결 — 한도·금리 확정 후 적용',
    },
    {
      productId:    PRODUCT_ID,
      consentId:    'CONS_TP_BANK_BASIC_TERMS',
      consentName:  '은행여신거래기본약관(기업용)',
      required:     'Y',
      category:     '여신공통',
      screenId:     'N_PR_014151',
      displayOrder: 9,
      remarks:      '은행 여신 기본 약관',
    },
  ])

  console.log('\n✅ 추가 완료')
  console.log('   documents: 8건 (필수 6건 + 추가준비서류 2건)')
  console.log('   consent_mapping: 9건 (전체 필수)')
  console.log('   약관동의 화면: N_PR_014151')
}

add().catch(console.error)
