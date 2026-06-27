'use client'

import { useState, useRef, useEffect } from 'react'
import { runConsultation, ConsultationState, ConsultationOutput, EligibilityCondition, DocumentInfo } from '@/services/consultationEngine'
import { CTAInfo, ProductInfo } from '@/services/loanRuntimeService'
import ProductRecommendationCard, { QuickActionType } from './ProductRecommendationCard'
import RuntimeDebugPanel from './RuntimeDebugPanel'

interface Message {
  id: string
  role: 'user' | 'ai'
  text?: string
  output?: ConsultationOutput
}

const SAMPLE_UTTERANCES = [
  '사업자 대출 추천해줘',
  '땡겨요 입점했는데 대출 가능해?',
  '보증서대출 신청하고 싶어',
  '보증서대출 서류 뭐 필요해?',
]

function DocumentList({ docs }: { docs: DocumentInfo[] }) {
  if (!docs.length) return null
  const required = docs.filter(d => d.required)
  const optional = docs.filter(d => !d.required)
  return (
    <div className="bg-blue-50 border border-blue-100 rounded-2xl rounded-tl-sm px-3.5 py-2.5 space-y-2">
      <p className="text-[11px] font-semibold text-blue-700">필요서류 안내</p>
      {required.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] font-medium text-blue-600 uppercase tracking-wide">필수</p>
          {required.map((d, i) => (
            <div key={i} className="flex items-start gap-1.5">
              <span className="text-blue-400 text-[11px] mt-0.5">●</span>
              <div>
                <p className="text-[12px] text-blue-900 font-medium">{d.documentName}</p>
                {d.collectionMethod && (
                  <p className="text-[11px] text-blue-500">{d.collectionMethod}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {optional.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] font-medium text-blue-500 uppercase tracking-wide">해당 시 제출</p>
          {optional.map((d, i) => (
            <div key={i} className="flex items-start gap-1.5">
              <span className="text-blue-300 text-[11px] mt-0.5">○</span>
              <div>
                <p className="text-[12px] text-blue-800">{d.documentName}</p>
                {d.remarks && (
                  <p className="text-[11px] text-blue-400">{d.remarks}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function EligibilityNotes({ notes }: { notes: EligibilityCondition[] }) {
  if (!notes.length) return null
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl rounded-tl-sm px-3.5 py-2.5 space-y-1.5">
      <p className="text-[11px] font-semibold text-amber-700">자격 분석 — 신청 조건 확인사항</p>
      {notes.map(n => (
        <div key={n.ruleId} className="flex gap-1.5">
          <span className={`text-[10px] mt-0.5 ${n.severity === 'blocking' ? 'text-red-500' : 'text-amber-500'}`}>
            {n.severity === 'blocking' ? '●' : '○'}
          </span>
          <div>
            <p className="text-[11px] text-amber-800 font-medium">{n.ruleName}</p>
            <p className="text-[11px] text-amber-600">{n.conditionDescription}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

export default function ChatPrototype() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'ai',
      text: '안녕하세요! 신한쏠비즈 AI 대출상담입니다.\n궁금하신 대출상품을 말씀해 주세요.',
    },
  ])
  const [inputText, setInputText] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [latestOutput, setLatestOutput] = useState<ConsultationOutput | null>(null)
  // ── 대화 상태 유지 — 멀티턴 slot filling 핵심 ──────────────────────────────
  const [consultationState, setConsultationState] = useState<ConsultationState | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend(text: string) {
    if (!text.trim() || isLoading) return
    setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', text }])
    setInputText('')
    setIsLoading(true)

    try {
      const output = await runConsultation(text, consultationState)
      setConsultationState(output.state)
      setLatestOutput(output)
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'ai', output }])
    } catch {
      setMessages(prev => [
        ...prev,
        { id: (Date.now() + 1).toString(), role: 'ai', text: '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  function handleCTAClick(cta: CTAInfo) {
    setMessages(prev => [
      ...prev,
      {
        id: Date.now().toString(),
        role: 'ai',
        text: `[화면 이동 CTA]\n화면: ${cta.targetScreenName}\nID: ${cta.targetScreenId}\n액션: ${cta.action}\n\n실제 신청·약정·실행은 앱 화면에서 진행됩니다.`,
      },
    ])
  }

  function handleQuickAction(type: QuickActionType, product: ProductInfo) {
    // 필요서류 — 상담 엔진 호출 (documents 테이블 조회)
    if (type === 'documents') {
      handleSend(`${product.productName} 필요서류 알려줘`)
      return
    }

    // 상환방식 / 신청조건 — 엔진 호출 없이 상품 데이터에서 직접 생성
    const fmtAmt = (n?: number) =>
      !n ? '' : n >= 100_000_000 ? `${n / 100_000_000}억원` : `${(n / 10_000).toLocaleString()}만원`

    let text = ''

    if (type === 'repayment') {
      const opts = Array.isArray(product.policy.repaymentOptions)
        ? (product.policy.repaymentOptions as string[])
        : typeof product.policy.repaymentOptions === 'string'
          ? (product.policy.repaymentOptions as string).split(',').map(s => s.trim()).filter(Boolean)
          : []
      text = opts.length
        ? `[${product.productName}] 상환방식\n\n${opts.map(o => `• ${o}`).join('\n')}`
        : `[${product.productName}] 상환방식은 심사 결과 후 결정됩니다.`
    }

    if (type === 'eligibility') {
      const p = product.policy
      const lines: string[] = [`[${product.productName}] 신청 조건 안내`]
      if (p.targetCustomer) lines.push(`\n• 대상 고객: ${p.targetCustomer}`)
      if (p.loanPurpose) lines.push(`• 자금 목적: ${String(p.loanPurpose).split(/[/,]/).map(s => s.trim()).join(' / ')}`)
      const min = fmtAmt(p.minAmount)
      const max = fmtAmt(p.maxAmount)
      if (min || max) lines.push(`• 대출 한도: ${min} ~ ${max}`)
      if (p.collateralOrGuarantee) lines.push(`• 담보 / 보증: ${p.collateralOrGuarantee}`)
      if (p.guaranteeRequired === 'Y') lines.push(`• 보증서 제출 필수`)
      lines.push('\n실제 대출 가능 여부·한도·금리는 심사 결과에 따라 달라질 수 있습니다.')
      text = lines.join('\n')
    }

    if (text) {
      setMessages(prev => [
        ...prev,
        { id: Date.now().toString(), role: 'ai', text },
      ])
    }
  }

  return (
    <div className="flex flex-col h-screen max-w-[390px] mx-auto bg-gray-50 relative shadow-xl">
      {/* 앱바 */}
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 shrink-0">
        <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-[13px] font-bold">
          S
        </div>
        <div>
          <p className="text-[15px] font-bold text-gray-900">AI 대출상담</p>
          <p className="text-[11px] text-gray-400">신한쏠비즈</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {/* 현재 step 배지 */}
          {consultationState && (
            <span className="text-[10px] bg-blue-50 text-blue-500 border border-blue-100 rounded-full px-2 py-0.5 font-mono">
              {consultationState.step}
            </span>
          )}
          <div className="w-2 h-2 bg-green-400 rounded-full" title="연결됨" />
        </div>
      </div>

      {/* 채팅 영역 */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'ai' && (
              <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-white text-[10px] font-bold mr-2 mt-1 shrink-0">
                S
              </div>
            )}
            <div className={`max-w-[82%] space-y-2 flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              {/* 단순 텍스트 버블 */}
              {msg.text && (
                <div
                  className={`rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white rounded-tr-sm'
                      : 'bg-white text-gray-800 rounded-tl-sm border border-gray-100 shadow-sm'
                  }`}
                >
                  {msg.text}
                </div>
              )}

              {/* 엔진 출력 버블 */}
              {msg.output && (
                <div className="w-full space-y-2">
                  {/* 메시지 */}
                  <div className="bg-white rounded-2xl rounded-tl-sm border border-gray-100 shadow-sm px-3.5 py-2.5 text-[13px] text-gray-800 leading-relaxed whitespace-pre-wrap">
                    {msg.output.message}
                  </div>

                  {/* 자격분석 Q&A — 예/아니요 빠른 응답 버튼 */}
                  {msg.output.step === 'eligibility_check' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSend('네, 해당됩니다')}
                        disabled={isLoading}
                        className="flex-1 text-[13px] font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-2.5 transition-colors disabled:opacity-40"
                      >
                        네, 해당됩니다
                      </button>
                      <button
                        onClick={() => handleSend('아니요, 해당 안 됩니다')}
                        disabled={isLoading}
                        className="flex-1 text-[13px] font-semibold bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-xl py-2.5 transition-colors disabled:opacity-40"
                      >
                        아니요
                      </button>
                    </div>
                  )}

                  {/* 필요서류 */}
                  <DocumentList docs={msg.output.documents} />

                  {/* 후보 상품 카드 — 필요서류 조회 시 미노출 */}
                  {msg.output.state.intent !== 'loan_document_inquiry' &&
                    msg.output.candidateProducts.map(product => (
                      <ProductRecommendationCard
                        key={product.productId}
                        product={product}
                        onCTAClick={handleCTAClick}
                        onQuickAction={handleQuickAction}
                      />
                    ))}

                  {/* 면책 문구 — 필요서류 조회 시 미노출 */}
                  {msg.output.candidateProducts.length > 0 &&
                    msg.output.state.intent !== 'loan_document_inquiry' && (
                    <p className="text-[10px] text-gray-400 px-1 leading-relaxed">
                      {msg.output.disclaimer}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-white text-[10px] font-bold mr-2 mt-1 shrink-0">
              S
            </div>
            <div className="bg-white rounded-2xl rounded-tl-sm border border-gray-100 shadow-sm px-4 py-3">
              <div className="flex gap-1 items-center h-4">
                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 하단 영역 */}
      <div className="bg-white border-t border-gray-100 shrink-0">
        <RuntimeDebugPanel data={latestOutput} />

        {/* 샘플 발화 칩 */}
        <div className="px-3 pt-2 pb-1 flex gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {SAMPLE_UTTERANCES.map(u => (
            <button
              key={u}
              onClick={() => handleSend(u)}
              disabled={isLoading}
              className="shrink-0 text-[11px] text-blue-600 bg-blue-50 border border-blue-100 rounded-full px-3 py-1.5 hover:bg-blue-100 transition-colors disabled:opacity-40"
            >
              {u}
            </button>
          ))}
        </div>

        {/* 입력창 */}
        <div className="px-3 pb-4 pt-2 flex gap-2">
          <input
            type="text"
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend(inputText)
              }
            }}
            placeholder="대출 상담 내용을 입력하세요"
            disabled={isLoading}
            className="flex-1 bg-gray-100 rounded-2xl px-4 py-2.5 text-[13px] text-gray-800 placeholder-gray-400 outline-none focus:ring-2 focus:ring-blue-200 disabled:opacity-50"
          />
          <button
            onClick={() => handleSend(inputText)}
            disabled={!inputText.trim() || isLoading}
            className="w-10 h-10 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 rounded-full flex items-center justify-center transition-colors shrink-0"
          >
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 19V5m0 0l-7 7m7-7l7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
