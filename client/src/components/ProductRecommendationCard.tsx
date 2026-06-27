'use client'

import { ProductInfo, CTAInfo } from '@/services/loanRuntimeService'

export type QuickActionType = 'documents' | 'repayment' | 'eligibility'

interface Props {
  product: ProductInfo
  onCTAClick: (cta: CTAInfo) => void
  onQuickAction?: (type: QuickActionType, product: ProductInfo) => void
}

const QUICK_ACTIONS: { label: string; type: QuickActionType }[] = [
  { label: '필요서류', type: 'documents' },
  { label: '상환방식', type: 'repayment' },
  { label: '신청조건', type: 'eligibility' },
]

function formatAmount(amount?: number): string {
  if (!amount) return '-'
  if (amount >= 100000000) return `${(amount / 100000000).toLocaleString()}억원`
  if (amount >= 10000) return `${(amount / 10000).toLocaleString()}만원`
  return `${amount.toLocaleString()}원`
}

export default function ProductRecommendationCard({ product, onCTAClick, onQuickAction }: Props) {

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
      <div>
        <p className="text-[11px] text-blue-600 font-medium bg-blue-50 rounded-full px-2 py-0.5 inline-block mb-1">
          {product.category || '대출상품'}
        </p>
        <h3 className="text-[15px] font-bold text-gray-900">{product.productName}</h3>
      </div>

      <div className="grid grid-cols-2 gap-2 text-[12px]">
        <div className="bg-gray-50 rounded-xl p-2.5">
          <p className="text-gray-400 mb-0.5">대출 한도</p>
          <p className="font-semibold text-gray-800">
            {product.policy.minAmount || product.policy.maxAmount
              ? `${formatAmount(product.policy.minAmount)} ~ ${formatAmount(product.policy.maxAmount)}`
              : '심사 후 결정'}
          </p>
        </div>
        <div className="bg-gray-50 rounded-xl p-2.5">
          <p className="text-gray-400 mb-0.5">금리유형</p>
          <p className="font-semibold text-gray-800">
            {product.policy.rateType ?? '심사 후 결정'}
          </p>
        </div>
      </div>

      {(() => {
        const opts = Array.isArray(product.policy.repaymentOptions)
          ? product.policy.repaymentOptions
          : typeof product.policy.repaymentOptions === 'string'
            ? JSON.parse(product.policy.repaymentOptions)
            : []
        return opts.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {opts.map((opt: string, i: number) => (
              <span key={i} className="text-[11px] bg-gray-100 text-gray-600 rounded-full px-2 py-0.5">
                {opt}
              </span>
            ))}
          </div>
        ) : null
      })()}

      {onQuickAction && (
        <div className="flex gap-1.5 flex-wrap">
          {QUICK_ACTIONS.map(action => (
            <button
              key={action.type}
              onClick={() => onQuickAction(action.type, product)}
              className="text-[11px] text-blue-600 bg-blue-50 border border-blue-100 rounded-full px-2.5 py-1 hover:bg-blue-100 transition-colors"
            >
              {action.label} 확인
            </button>
          ))}
        </div>
      )}

      {product.cta ? (
        <button
          onClick={() => onCTAClick(product.cta!)}
          className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-[13px] font-semibold rounded-xl py-2.5 transition-colors"
        >
          {product.cta.label}
        </button>
      ) : (
        <button
          disabled
          className="w-full bg-gray-100 text-gray-400 text-[13px] font-semibold rounded-xl py-2.5 cursor-not-allowed"
        >
          라우팅 정보 없음
        </button>
      )}
    </div>
  )
}
