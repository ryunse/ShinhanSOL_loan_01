'use client'

import { useState, useRef, useEffect } from 'react'
import { runConsultation, ConsultationState, ConsultationOutput, EligibilityCondition } from '@/services/consultationEngine'
import { CTAInfo } from '@/services/loanRuntimeService'
import ProductRecommendationCard from './ProductRecommendationCard'
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

                  {/* 자격 분석 조건 */}
                  <EligibilityNotes notes={msg.output.eligibilityConditions} />

                  {/* 후보 상품 카드 */}
                  {msg.output.candidateProducts.map(product => (
                    <ProductRecommendationCard
                      key={product.productId}
                      product={product}
                      onCTAClick={handleCTAClick}
                    />
                  ))}

                  {/* 면책 문구 */}
                  {msg.output.candidateProducts.length > 0 && (
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
