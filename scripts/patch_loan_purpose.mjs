/**
 * LOAN_REGIONAL_GUARANTEE 의 loanPurpose를
 * '운전자금/사업자금' → '운전자금/시설자금/창업자금' 으로 패치한다.
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

const { error } = await supabase
  .from('product_policy')
  .update({ loanPurpose: '운전자금/시설자금/창업자금' })
  .eq('productId', 'LOAN_REGIONAL_GUARANTEE')

if (error) {
  console.error('❌ 패치 실패:', error.message)
  process.exit(1)
} else {
  console.log('✅ LOAN_REGIONAL_GUARANTEE loanPurpose 패치 완료')
}
