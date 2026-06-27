'use client'

import { useState } from 'react'
import { LoanRuntimeOutput } from '@/services/loanRuntimeService'

interface Props {
  data: LoanRuntimeOutput | null
}

export default function RuntimeDebugPanel({ data }: Props) {
  const [isOpen, setIsOpen] = useState(false)

  if (!data) return null

  return (
    <div className="border-t border-gray-200 bg-gray-50">
      <button
        onClick={() => setIsOpen(prev => !prev)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-[12px] text-gray-500 hover:bg-gray-100 transition-colors"
      >
        <span className="font-medium">런타임 결과 디버그</span>
        <div className="flex items-center gap-2">
          <span className="bg-green-100 text-green-700 text-[10px] font-mono px-1.5 py-0.5 rounded">
            {data.raw.queryMs}ms
          </span>
          <span className={`transform transition-transform ${isOpen ? 'rotate-180' : ''}`}>▾</span>
        </div>
      </button>

      {isOpen && (
        <div className="px-4 pb-4">
          <div className="flex gap-1.5 mb-2 flex-wrap">
            <span className="text-[11px] bg-blue-100 text-blue-700 rounded-full px-2 py-0.5 font-mono">
              intent: {data.intent}
            </span>
            <span className="text-[11px] bg-purple-100 text-purple-700 rounded-full px-2 py-0.5 font-mono">
              {(data.confidence * 100).toFixed(0)}%
            </span>
            <span className="text-[11px] bg-gray-100 text-gray-600 rounded-full px-2 py-0.5 font-mono">
              products: {data.products.length}
            </span>
            <span className="text-[11px] bg-gray-100 text-gray-500 rounded-full px-2 py-0.5 font-mono">
              mode: {data.raw.searchMode}
            </span>
            {Object.entries(data.extractedSlots).map(([k, v]) =>
              v != null ? (
                <span key={k} className="text-[11px] bg-orange-100 text-orange-700 rounded-full px-2 py-0.5 font-mono">
                  {k}: {String(v)}
                </span>
              ) : null
            )}
          </div>
          <pre className="text-[11px] bg-gray-900 text-green-400 rounded-xl p-3 overflow-auto max-h-48 font-mono leading-relaxed">
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}
