// ─── CTA / 상품 공통 타입 ─────────────────────────────────────────────────────
// 출처: loanRuntimeService.ts (공통 타입 파일로 이동)

export interface CTAInfo {
  label: string
  action: string
  targetScreenId: string
  targetScreenName: string
}

export interface ProductInfo {
  productId: string
  productName: string
  category: string
  menuPath?: string
  policy: {
    minAmount?: number
    maxAmount?: number
    rateType?: string
    minRate?: number
    maxRate?: number
    rateBaseDate?: string
    maxTerm?: string
    repaymentOptions?: string[]
    loanType?: string
    loanPurpose?: string
    collateralOrGuarantee?: string
    guaranteeRequired?: string
    targetCustomer?: string
  }
  cta?: CTAInfo
  matchScore?: number
}

export interface ExtractedSlots {
  desiredAmount?: number
  customerType?: string
  loanPurpose?: string
  guaranteePreference?: string
  ratePreference?: string
}

export interface LoanRuntimeInput {
  userText: string
  intent?: string
  slots?: Record<string, string>
}

export interface LoanRuntimeOutput {
  intent: string
  confidence: number
  message: string
  products: ProductInfo[]
  extractedSlots: ExtractedSlots
  missingSlots: string[]
  disclaimer: string
  raw: {
    matchedKeywords: string[]
    queryMs: number
    intentSource: string
    searchMode: string
  }
}

// ─── 상담 단계 / 의도 타입 ────────────────────────────────────────────────────
// 출처: consultationEngine.ts (공통 타입 파일로 이동)

export type ConsultationStep =
  | 'understand_intent'    // 1. 대출 의도 파악
  | 'identify_customer'    // 2. 고객 정보 확인
  | 'check_repayment'      // 3. 상환 능력 / DSR (자동)
  | 'find_candidates'      // 4. 후보 상품 탐색
  | 'calculate_estimate'   // 5. 예상 한도·금리 산출 (자동)
  | 'guide_pre_approval'   // 6. 예비 승인 안내 (자동)
  | 'guide_documents'      // 7. 필요서류 안내
  | 'screen_transition'    // 8. 신청 화면 이동 CTA
  | 'eligibility_check'    // find_candidates 하위: 자격 Q&A
  | 'complete'             // 상담 완료

export type LoanCategory =
  | 'housing' | 'jeonse' | 'credit' | 'refinance'
  | 'business' | 'living_expense' | 'unknown'

export interface LoanIntent {
  loanCategory: LoanCategory
  loanPurposeDetail?: string       // 사업자: 운전자금 / 시설자금 / 창업자금
  desiredAmount?: number
  urgency: 'immediate' | 'within_1_month' | 'future' | 'unknown'
  consultationType: 'limit_check' | 'rate_check' | 'product_compare' | 'pre_approval' | 'application_ready'
}

export interface CustomerProfile {
  // 공통
  age?: number
  employmentType?: string          // 직장인 | 개인사업자 | 법인사업자 | 프리랜서 | 무직
  annualIncome?: number
  employmentPeriod?: number        // 개월 수
  existingLoanAmount?: number
  creditScoreRange?: string        // 고 | 중 | 저
  housingOwnership?: string
  maritalStatus?: string
  mainBankUsage?: string
  // 사업자 특화
  customerType?: string            // 개인사업자 | 법인 | 소상공인
  guaranteePreference?: string     // none | guarantee
  ratePreference?: string          // low | inquire
}

export interface RepaymentCapacity {
  dsrCheckRequired: boolean
  incomeVerified: boolean
  existingLoanVerified: boolean
  estimatedRepaymentCapacity: 'sufficient' | 'limited' | 'insufficient' | 'unknown'
  reason: string[]
}

export interface EstimatedResult {
  maxLimit?: number
  minInterestRate?: number
  maxInterestRate?: number
  monthlyRepaymentEstimate?: number
  calculationBasis: string[]
  isPreliminary: boolean
}

export interface PreApproval {
  status: 'available' | 'conditionally_available' | 'unavailable' | 'need_more_info'
  summary: string
  reason: string[]
  nextStep: string
}

export interface EligibilityCondition {
  ruleId: string
  productId: string
  ruleName: string
  conditionDescription: string
  failMessage: string
  severity: 'blocking' | 'advisory'
  conditionPolarity: 'positive' | 'negative'
}

export interface DocumentInfo {
  documentId: string
  documentName: string
  required: boolean
  collectionMethod?: string
  remarks?: string
}

export interface ConsultationState {
  consultationId?: string
  currentStep: ConsultationStep
  loanIntent: Partial<LoanIntent>
  customerProfile: CustomerProfile
  repaymentCapacity?: RepaymentCapacity
  estimatedResult?: EstimatedResult
  preApproval?: PreApproval
  selectedProductIds?: string[]
  eligibilityRules?: EligibilityCondition[]
  eligibilityPendingIdx?: number
  eligibilityAnswers?: Record<string, boolean>
  askingSlot?: string
  turnCount: number
  consultationGoal?: string
}

export interface CandidateProduct extends ProductInfo {
  suitabilityExplanation?: string
}

export interface ConsultationOutput {
  currentStep: ConsultationStep
  message: string
  askingSlot?: string
  eligibilityCurrentPolarity?: 'positive' | 'negative'
  candidateProducts: CandidateProduct[]
  eligibilityConditions: EligibilityCondition[]
  documents: DocumentInfo[]
  estimatedResult?: EstimatedResult
  preApproval?: PreApproval
  repaymentCapacity?: RepaymentCapacity
  disclaimer: string
  state: ConsultationState
  debug: {
    loanCategory: string
    consultationGoal?: string
    loanIntent: Partial<LoanIntent>
    customerProfile: CustomerProfile
    pendingSlots: string[]
    matchedKeywords: string[]
    searchMode: string
    queryMs: number
  }
}
