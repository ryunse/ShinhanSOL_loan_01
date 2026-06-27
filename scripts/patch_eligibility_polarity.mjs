/**
 * eligibility_rules에 conditionPolarity / qaTarget 값을 패치한다.
 * 사전 조건: db/migrations/002_add_eligibility_columns.sql 실행 완료
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
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] })
)

const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY
const supabase = createClient(env.SUPABASE_URL, key, { auth: { persistSession: false } })

const patches = [
  // ── 긍정 조건 (신청 가능하려면 '해당되어야' 하는 조건) ────────────────────
  {
    ruleId: 'ELG_DD_001',
    conditionPolarity: 'positive',
    qaTarget: 'user',
    conditionDescription: '신한 배달앱 땡겨요에 입점된 개인사업자이신가요?',
  },
  {
    ruleId: 'ELG_DD_002',
    conditionPolarity: 'positive',
    qaTarget: 'user',
    conditionDescription: '개업년월일 기준 6개월 이상 경과하셨나요?',
  },
  {
    ruleId: 'ELG_RG_001',
    conditionPolarity: 'positive',
    qaTarget: 'user',
    conditionDescription: '개인사업자이신가요? (법인·공동대표는 신청 불가)',
  },
  {
    ruleId: 'ELG_RG_003',
    conditionPolarity: 'positive',
    qaTarget: 'user',
    conditionDescription: '최근 3개월 연속 매출이 발생했고, 최근 1주일 이내에도 매출이 있으신가요?',
  },

  // ── 부정 조건 (해당되면 안 되는 항목 — '없어야' 신청 가능) ───────────────
  {
    ruleId: 'ELG_DD_003',
    conditionPolarity: 'negative',
    qaTarget: 'user',
    conditionDescription: '아래 항목에 해당되지 않으셔야 신청이 가능합니다.\n• 공동사업자\n• 유흥·사행성 등 일부 제한 업종',
  },
  {
    ruleId: 'ELG_RG_002',
    conditionPolarity: 'negative',
    qaTarget: 'user',
    conditionDescription: '아래 항목 중 해당되는 사항이 없어야 보증 신청이 가능합니다.\n• 휴업·폐업 상태\n• 법인 또는 공동대표\n• 연체 또는 세금체납\n• 보증제한 업종\n• 신용상태 불량',
  },

  // ── 시스템 내부 검증 — 사용자에게 질문하지 않음 ──────────────────────────
  {
    ruleId: 'ELG_RG_004',
    conditionPolarity: 'positive',
    qaTarget: 'system',
    // conditionDescription 유지 (내부 메모용)
  },
]

for (const { ruleId, ...fields } of patches) {
  const { error } = await supabase
    .from('eligibility_rules')
    .update(fields)
    .eq('ruleId', ruleId)

  if (error) {
    console.error(`❌ ${ruleId} 패치 실패:`, error.message)
    process.exit(1)
  }
  console.log(`✅ ${ruleId} 패치 완료`)
}
