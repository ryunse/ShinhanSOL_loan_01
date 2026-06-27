/**
 * product_policy 테이블에 금리·기간 정보를 패치한다.
 * 사전 조건: db/migrations/001_add_rate_columns.sql 을 Supabase SQL Editor에서 먼저 실행할 것.
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
  {
    productId: 'LOAN_DDANGYO_SOHO',
    minRate: 4.73,
    maxRate: 7.37,
    rateBaseDate: '2025.10.23',
    maxTerm: '36개월',
  },
  {
    productId: 'LOAN_REGIONAL_GUARANTEE',
    minRate: 4.33,
    maxRate: 5.76,
    rateBaseDate: '2025.07.17',
    maxTerm: '5년 이내(보증서 만기일까지)',
  },
]

for (const { productId, ...fields } of patches) {
  const { error } = await supabase
    .from('product_policy')
    .update(fields)
    .eq('productId', productId)

  if (error) {
    console.error(`❌ ${productId} 패치 실패:`, error.message)
    process.exit(1)
  }
  console.log(`✅ ${productId} 금리·기간 패치 완료`)
}
