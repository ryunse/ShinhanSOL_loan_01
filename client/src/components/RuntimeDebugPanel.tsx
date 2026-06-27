'use client'

import { useState } from 'react'
import { ConsultationOutput } from '@/services/consultationEngine'

interface Props {
  data: ConsultationOutput | null
}

const STEP_LABELS: Record<string, string> = {
  intent_detection:  'Intent',
  slot_filling:      'Slot Filling',
  validation:        'Validation',
  business_rule:     'Business Rule',
  eligibility_check: 'Eligibility Q&A',
  api_query:         'API',
  candidate_products:'Candidates',
  business_action:   'Action',
  natural_response:  'Response',
  complete:          'Complete',
}

export default function RuntimeDebugPanel({ data }: Props) {
  const [isOpen, setIsOpen] = useState(false)

  if (!data) return null

  const { step, debug, candidateProducts, eligibilityConditions } = data

  return (
    <div className="border-t border-gray-200 bg-gray-50">
      <button
        onClick={() => setIsOpen(prev => !prev)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-[12px] text-gray-500 hover:bg-gray-100 transition-colors"
      >
        <span className="font-medium">런타임 디버그</span>
        <div className="flex items-center gap-2">
          <span className="bg-blue-100 text-blue-700 text-[10px] font-mono px-1.5 py-0.5 rounded">
            {STEP_LABELS[step] ?? step}
          </span>
          <span className="bg-green-100 text-green-700 text-[10px] font-mono px-1.5 py-0.5 rounded">
            {debug.queryMs}ms
          </span>
          <span className={`transform transition-transform ${isOpen ? 'rotate-180' : ''}`}>▾</span>
        </div>
      </button>

      {isOpen && (
        <div className="px-4 pb-4 space-y-2">
          {/* 칩 행 */}
          <div className="flex gap-1.5 flex-wrap">
            <span className="text-[11px] bg-blue-100 text-blue-700 rounded-full px-2 py-0.5 font-mono">
              intent: {debug.intent}
            </span>
            <span className="text-[11px] bg-gray-100 text-gray-600 rounded-full px-2 py-0.5 font-mono">
              candidates: {candidateProducts.length}
            </span>
            <span className="text-[11px] bg-gray-100 text-gray-500 rounded-full px-2 py-0.5 font-mono">
              mode: {debug.searchMode}
            </span>
            <span className="text-[11px] bg-yellow-100 text-yellow-700 rounded-full px-2 py-0.5 font-mono">
              pending: [{debug.pendingSlots.join(', ')}]
            </span>
            {Object.entries(debug.slots).map(([k, v]) =>
              v != null ? (
                <span key={k} className="text-[11px] bg-orange-100 text-orange-700 rounded-full px-2 py-0.5 font-mono">
                  {k}: {String(v)}
                </span>
              ) : null
            )}
            {eligibilityConditions.length > 0 && (
              <span className="text-[11px] bg-red-100 text-red-600 rounded-full px-2 py-0.5 font-mono">
                eligibility: {eligibilityConditions.length}건
              </span>
            )}
            {debug.consultationGoal && (
              <span className="text-[11px] bg-green-100 text-green-700 rounded-full px-2 py-0.5 font-mono">
                goal: {debug.consultationGoal}
              </span>
            )}
          </div>

          {/* 플로우 스텝 시각화 */}
          <div className="flex gap-1 items-center overflow-x-auto py-1">
            {Object.keys(STEP_LABELS).map((s, i, arr) => (
              <div key={s} className="flex items-center gap-1 shrink-0">
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                  s === step ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'
                }`}>
                  {STEP_LABELS[s]}
                </span>
                {i < arr.length - 1 && <span className="text-gray-300 text-[10px]">→</span>}
              </div>
            ))}
          </div>

          {/* JSON 덤프 */}
          <pre className="text-[11px] bg-gray-900 text-green-400 rounded-xl p-3 overflow-auto max-h-48 font-mono leading-relaxed">
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}
