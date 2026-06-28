/**
 * consultationEngine.ts — 대출상담 오케스트레이터
 *
 * 이 파일은 비즈니스 로직을 포함하지 않는다.
 * 각 상담 단계를 전담 계층에 위임하고 상태를 조합해 ConsultationOutput을 반환한다.
 *
 * 레이어 구조 (단방향 의존):
 *   policyLoader  — DB 접근 (Supabase 쿼리)
 *   slotEngine    — 슬롯 추출·검증·질문 (Step 1, 2)
 *   eligibilityEngine — 상환능력·자격 Q&A (Step 3, 4)
 *   recommendationEngine — 상품 점수화·적합도 (Step 4)
 *   rankingEngine — 한도·금리 산출·예비승인 (Step 5, 6)
 *   responseBuilder — 자연어 메시지 생성 (Step 7)
 *
 * LLM은 사용하지 않는다. 모든 비즈니스 로직은 결정론적으로 처리한다.
 * 채팅창에서 대출을 실행하지 않는다. 최종 액션은 화면 이동 CTA다.
 */

import {
  CTAInfo, ProductInfo,
  ConsultationStep, LoanCategory, LoanIntent, CustomerProfile,
  RepaymentCapacity, EstimatedResult, PreApproval,
  EligibilityCondition, DocumentInfo,
  ConsultationState, CandidateProduct, ConsultationOutput,
} from '@/types/loan.types'
import * as policyLoader from '@/loaders/policyLoader'
import * as slotEngine from '@/engines/slotEngine'
import * as eligibilityEngine from '@/engines/eligibilityEngine'
import * as recommendationEngine from '@/engines/recommendationEngine'
import * as rankingEngine from '@/engines/rankingEngine'
import * as responseBuilder from '@/builders/responseBuilder'

export type {
  CTAInfo, ProductInfo,
  ConsultationStep, LoanCategory, LoanIntent, CustomerProfile,
  RepaymentCapacity, EstimatedResult, PreApproval,
  EligibilityCondition, DocumentInfo,
  ConsultationState, CandidateProduct, ConsultationOutput,
}

const DISCLAIMER =
  '안내드린 정보는 입력하신 내용과 상품 조건을 기준으로 한 예비 안내이며, ' +
  '실제 대출 가능 여부·한도·금리는 심사 결과에 따라 달라질 수 있습니다.'

export async function runConsultation(
  userText: string,
  prevState: ConsultationState | null
): Promise<ConsultationOutput> {
  const start = Date.now()

  // ── 슬롯 추출 ──────────────────────────────────────────────────────────────
  const extractedIntent = slotEngine.extractLoanIntent(userText, prevState?.askingSlot)
  const extractedProfile = slotEngine.extractCustomerProfile(userText, prevState?.askingSlot)

  const loanIntent: Partial<LoanIntent> = { ...prevState?.loanIntent, ...extractedIntent }
  const customerProfile: CustomerProfile = { ...prevState?.customerProfile, ...extractedProfile }
  const turnCount = (prevState?.turnCount ?? 0) + 1
  const consultationGoal = prevState?.consultationGoal ?? slotEngine.deriveConsultationGoal(loanIntent)

  // blocking 실패 후 잔여 상품이 있을 때 fall-through 경로에서 사용
  let eligibilityFilteredProductIds: string[] | null = null
  let eligibilityFilteredAnswers: Record<string, boolean> | null = null
  let eligibilityFilteredRules: EligibilityCondition[] | null = null

  // 현재 질문 중인 슬롯 유효성 검사
  if (prevState?.askingSlot) {
    const slot = prevState.askingSlot
    const val = slot === 'desiredAmount' ? loanIntent.desiredAmount
      : slot === 'loanPurposeDetail' ? loanIntent.loanPurposeDetail
      : slot === 'customerType' ? customerProfile.customerType
      : undefined
    if (val !== undefined) {
      const result = slotEngine.validateSlot(slot, val)
      if (!result.valid) {
        const retryState: ConsultationState = {
          ...(prevState ?? { currentStep: 'understand_intent', loanIntent, customerProfile, turnCount }),
          loanIntent, customerProfile, turnCount, askingSlot: slot,
        }
        return {
          currentStep: prevState!.currentStep,
          message: result.message!,
          askingSlot: slot,
          candidateProducts: [], eligibilityConditions: [], documents: [],
          disclaimer: '',
          state: retryState,
          debug: { loanCategory: loanIntent.loanCategory ?? 'unknown', consultationGoal, loanIntent, customerProfile, pendingSlots: [slot], matchedKeywords: [], searchMode: 'validation_retry', queryMs: Date.now() - start },
        }
      }
    }
  }

  // ── SHORTCUT: 필요서류 조회 (always available) ────────────────────────────
  const isDocumentInquiry = /서류|필요서류|준비서류/.test(userText)
  if (isDocumentInquiry) {
    let docProductIds = prevState?.selectedProductIds ?? []
    let matchedKeywords: string[] = []
    let searchMode = 'selected_context'

    if (!docProductIds.length) {
      const kwResult = await policyLoader.searchByKeyword(userText)
      docProductIds = kwResult.productIds
      matchedKeywords = kwResult.matchedKeywords
      searchMode = 'keyword'
      if (!docProductIds.length) {
        docProductIds = await policyLoader.getAllActiveProductIds()
        searchMode = 'slot_fallback'
      }
    }

    const { masters, policyMap } = await policyLoader.getProductDetails(docProductIds)
    const documents = await policyLoader.getDocuments(docProductIds)
    const ctaMap = await policyLoader.getBusinessActionCTA(docProductIds)
    const screenIds = Object.values(ctaMap).map(r => r.targetScreenId)
    const screenMap = await policyLoader.getScreenMapping(screenIds)

    const docProducts: CandidateProduct[] = masters.map(row => {
      const policy = policyMap[row.productId] ?? {}
      const routing = ctaMap[row.productId]
      const screen = routing ? screenMap[routing.targetScreenId] : null
      const cta: CTAInfo | undefined = routing ? {
        label: routing.ctaLabel, action: routing.actionType,
        targetScreenId: routing.targetScreenId,
        targetScreenName: screen?.screenName ?? routing.targetScreenName,
      } : undefined
      return {
        productId: row.productId, productName: row.productName,
        category: row.productCategory ?? '', menuPath: row.menuPath,
        policy: {
          minAmount: policy.minAmount, maxAmount: policy.maxAmount,
          rateType: policy.rateType, minRate: policy.minRate, maxRate: policy.maxRate,
          rateBaseDate: policy.rateBaseDate, maxTerm: policy.maxTerm,
          repaymentOptions: recommendationEngine.toArray(policy.repaymentOptions), loanType: policy.loanType,
          loanPurpose: policy.loanPurpose, collateralOrGuarantee: policy.collateralOrGuarantee,
          guaranteeRequired: policy.guaranteeRequired, targetCustomer: policy.targetCustomer,
        },
        cta,
      }
    })

    const docState: ConsultationState = {
      ...(prevState ?? { loanIntent: {}, customerProfile: {} }),
      currentStep: 'guide_documents',
      loanIntent, customerProfile, turnCount, consultationGoal,
      selectedProductIds: docProductIds, askingSlot: undefined,
    }
    return {
      currentStep: 'guide_documents',
      message: responseBuilder.buildMessage('guide_documents', loanIntent, docProducts, undefined, documents),
      candidateProducts: [],
      eligibilityConditions: [], documents,
      disclaimer: '',
      state: docState,
      debug: { loanCategory: loanIntent.loanCategory ?? 'unknown', consultationGoal, loanIntent, customerProfile, pendingSlots: [], matchedKeywords, searchMode, queryMs: Date.now() - start },
    }
  }

  // ── ELIGIBILITY Q&A 진행 중 ───────────────────────────────────────────────
  if (prevState?.currentStep === 'eligibility_check' && prevState.eligibilityRules?.length) {
    const rules = prevState.eligibilityRules
    const answers = { ...(prevState.eligibilityAnswers ?? {}) }
    const pendingIdx = prevState.eligibilityPendingIdx ?? 0
    const yesNo = slotEngine.detectYesNo(userText)

    if (yesNo === undefined) {
      const currentRule = rules[pendingIdx]
      return {
        currentStep: 'eligibility_check',
        message: `답변을 인식하지 못했습니다. '네' 또는 '아니요'로 답변해 주세요.\n\n${eligibilityEngine.buildEligibilityQuestion(currentRule)}`,
        eligibilityCurrentPolarity: currentRule.conditionPolarity,
        candidateProducts: [], eligibilityConditions: [], documents: [],
        disclaimer: '',
        state: { ...prevState, loanIntent, customerProfile, askingSlot: undefined, turnCount },
        debug: { loanCategory: loanIntent.loanCategory ?? 'unknown', consultationGoal, loanIntent, customerProfile, pendingSlots: [], matchedKeywords: [], searchMode: 'eligibility_check', queryMs: Date.now() - start },
      }
    }

    const currentRule = rules[pendingIdx]
    answers[currentRule.ruleId] = yesNo

    // 현재 활성 상품 목록 — blocking 실패 시 해당 상품만 제거
    let activeProductIds = [...(prevState.selectedProductIds ?? [])]
    let eliminatedProductName: string | null = null

    if (!yesNo && currentRule.severity === 'blocking') {
      activeProductIds = activeProductIds.filter(id => id !== currentRule.productId)
      eliminatedProductName = currentRule.ruleName

      if (activeProductIds.length === 0) {
        // 모든 후보 상품 제거 → 상담 종료
        const failState: ConsultationState = {
          ...prevState, loanIntent, customerProfile, askingSlot: undefined,
          currentStep: 'complete', turnCount, eligibilityAnswers: answers,
        }
        return {
          currentStep: 'complete',
          message: `신청 조건 확인 결과, 현재 조건에서는 신청 가능한 상품을 찾지 못했습니다.\n\n[${currentRule.ruleName}]\n${currentRule.failMessage}\n\n다른 조건이나 상품으로 상담을 원하시면 말씀해 주세요.`,
          candidateProducts: [], eligibilityConditions: [], documents: [],
          disclaimer: '',
          state: failState,
          debug: { loanCategory: loanIntent.loanCategory ?? 'unknown', consultationGoal, loanIntent, customerProfile, pendingSlots: [], matchedKeywords: [], searchMode: 'eligibility_check', queryMs: Date.now() - start },
        }
      }
    }

    // 잔여 활성 상품의 다음 미답변 규칙 탐색
    const nextIdx = rules.findIndex((r, i) =>
      i > pendingIdx &&
      answers[r.ruleId] === undefined &&
      activeProductIds.includes(r.productId)
    )

    if (nextIdx >= 0) {
      const nextRule = rules[nextIdx]
      const elimMsg = eliminatedProductName
        ? `[${eliminatedProductName}] 조건을 충족하지 않아 해당 상품이 제외되었습니다.\n\n다른 후보 상품의 조건을 확인해 드릴게요.\n\n`
        : ''
      const nextState: ConsultationState = {
        ...prevState, loanIntent, customerProfile, askingSlot: undefined,
        currentStep: 'eligibility_check', turnCount,
        eligibilityRules: rules, eligibilityPendingIdx: nextIdx, eligibilityAnswers: answers,
        selectedProductIds: activeProductIds,
      }
      return {
        currentStep: 'eligibility_check',
        message: `${elimMsg}${eligibilityEngine.buildEligibilityQuestion(nextRule)}`,
        eligibilityCurrentPolarity: nextRule.conditionPolarity,
        candidateProducts: [], eligibilityConditions: [], documents: [],
        disclaimer: '',
        state: nextState,
        debug: { loanCategory: loanIntent.loanCategory ?? 'unknown', consultationGoal, loanIntent, customerProfile, pendingSlots: [], matchedKeywords: [], searchMode: 'eligibility_check', queryMs: Date.now() - start },
      }
    }

    // 모든 Q&A 완료 (또는 잔여 상품에 해당하는 규칙 없음) → fall through to auto-steps
    // blocking 실패로 일부 상품이 제거된 경우, 잔여 상품 정보를 fall-through 변수에 저장
    if (eliminatedProductName) {
      eligibilityFilteredProductIds = activeProductIds
      eligibilityFilteredAnswers = Object.fromEntries(
        Object.entries(answers).filter(([ruleId]) =>
          rules.some(r => r.ruleId === ruleId && activeProductIds.includes(r.productId))
        )
      )
      eligibilityFilteredRules = rules.filter(r => activeProductIds.includes(r.productId))
    }
  }

  // ── 상품명 직접 언급 SHORTCUT ────────────────────────────────────────────────
  // 슬롯이 아직 수집되지 않은 상태에서 상품명 키워드가 매칭되면 슬롯 수집 없이 즉시 상품 카드 반환.
  // prevState가 없거나(첫 턴) 슬롯 수집 전(understand_intent) 단계이고,
  // eligibility_check나 blocking 필터 fall-through가 아닌 경우에만 적용한다.
  if (
    eligibilityFilteredProductIds === null &&
    prevState?.currentStep !== 'eligibility_check' &&
    !prevState?.askingSlot &&
    (prevState == null || prevState.currentStep === 'understand_intent')
  ) {
    const kwResult = await policyLoader.searchByKeyword(userText)
    if (kwResult.hasProductNameMatch && kwResult.productIds.length > 0) {
      const { masters, policyMap } = await policyLoader.getProductDetails(kwResult.productIds)
      const ctaMap = await policyLoader.getBusinessActionCTA(kwResult.productIds)
      const screenIds = Object.values(ctaMap).map(r => r.targetScreenId)
      const screenMap = await policyLoader.getScreenMapping(screenIds)

      const candidateProducts: CandidateProduct[] = masters.map(row => {
        const policy = policyMap[row.productId] ?? {}
        const routing = ctaMap[row.productId]
        const screen = routing ? screenMap[routing.targetScreenId] : null
        const cta: CTAInfo | undefined = routing ? {
          label: routing.ctaLabel, action: routing.actionType,
          targetScreenId: routing.targetScreenId,
          targetScreenName: screen?.screenName ?? routing.targetScreenName ?? routing.targetScreenId,
        } : undefined
        return {
          productId: row.productId, productName: row.productName,
          category: row.productCategory ?? '', menuPath: row.menuPath,
          suitabilityExplanation: '',
          policy: {
            minAmount: policy.minAmount, maxAmount: policy.maxAmount,
            rateType: policy.rateType, minRate: policy.minRate, maxRate: policy.maxRate,
            rateBaseDate: policy.rateBaseDate, maxTerm: policy.maxTerm,
            repaymentOptions: recommendationEngine.toArray(policy.repaymentOptions),
            loanType: policy.loanType, loanPurpose: policy.loanPurpose,
            collateralOrGuarantee: policy.collateralOrGuarantee,
            guaranteeRequired: policy.guaranteeRequired, targetCustomer: policy.targetCustomer,
          },
          cta, matchScore: 0,
        }
      })

      const productNames = masters.map(r => r.productName).join(', ')
      const shortcutState: ConsultationState = {
        ...(prevState ?? { loanIntent: {}, customerProfile: {} }),
        currentStep: 'find_candidates', loanIntent, customerProfile,
        turnCount, consultationGoal, askingSlot: undefined,
        selectedProductIds: kwResult.productIds,
      }
      return {
        currentStep: 'find_candidates',
        message: `${productNames} 상품 정보입니다.\n상담이 필요하시면 대출 목적이나 희망 금액을 말씀해 주세요.`,
        candidateProducts,
        eligibilityConditions: [], documents: [],
        disclaimer: DISCLAIMER,
        state: shortcutState,
        debug: {
          loanCategory: loanIntent.loanCategory ?? 'unknown', consultationGoal,
          loanIntent, customerProfile, pendingSlots: [],
          matchedKeywords: kwResult.matchedKeywords, searchMode: 'product_name_shortcut',
          queryMs: Date.now() - start,
        },
      }
    }
  }

  // ── STEP 1: understand_intent 슬롯 수집 ──────────────────────────────────
  const cat = loanIntent.loanCategory ?? 'unknown'
  if (cat === 'business' || cat === 'unknown') {
    const missingIntent = slotEngine.UNDERSTAND_INTENT_SLOTS_BUSINESS.filter((k: string) => {
      if (k === 'loanPurposeDetail') return !loanIntent.loanPurposeDetail
      if (k === 'desiredAmount') return loanIntent.desiredAmount == null
      return false
    })
    if (missingIntent.length > 0) {
      const nextSlot = missingIntent[0]
      const state: ConsultationState = {
        ...(prevState ?? { loanIntent: {}, customerProfile: {} }),
        currentStep: 'understand_intent', loanIntent, customerProfile,
        turnCount, consultationGoal, askingSlot: nextSlot,
      }
      return {
        currentStep: 'understand_intent',
        message: slotEngine.SLOT_QUESTIONS[nextSlot] ?? `${nextSlot}를 알려주세요.`,
        askingSlot: nextSlot,
        candidateProducts: [], eligibilityConditions: [], documents: [],
        disclaimer: '',
        state,
        debug: { loanCategory: cat, consultationGoal, loanIntent, customerProfile, pendingSlots: missingIntent, matchedKeywords: [], searchMode: 'slot_filling', queryMs: Date.now() - start },
      }
    }
  } else {
    // 사업자 외 대출 유형 → 현재 상품 DB에 해당 상품 없음 안내
    const unsupportedState: ConsultationState = {
      ...(prevState ?? { loanIntent: {}, customerProfile: {} }),
      currentStep: 'find_candidates', loanIntent, customerProfile, turnCount, consultationGoal, askingSlot: undefined,
    }
    return {
      currentStep: 'find_candidates',
      message: `${cat === 'jeonse' ? '전세자금' : cat === 'housing' ? '주택담보' : cat === 'credit' ? '신용' : '해당'} 대출 상담은 현재 준비 중입니다.\n사업자 대출 상담을 원하시면 말씀해 주세요.`,
      candidateProducts: [], eligibilityConditions: [], documents: [],
      disclaimer: '',
      state: unsupportedState,
      debug: { loanCategory: cat, consultationGoal, loanIntent, customerProfile, pendingSlots: [], matchedKeywords: [], searchMode: 'unsupported_category', queryMs: Date.now() - start },
    }
  }

  // ── STEP 2: identify_customer 슬롯 수집 ──────────────────────────────────
  const missingCustomer = slotEngine.IDENTIFY_CUSTOMER_SLOTS_BUSINESS.filter((k: string) => {
    if (k === 'customerType') return !customerProfile.customerType
    return false
  })
  if (missingCustomer.length > 0) {
    const nextSlot = missingCustomer[0]
    const state: ConsultationState = {
      ...(prevState ?? { loanIntent: {}, customerProfile: {} }),
      currentStep: 'identify_customer', loanIntent, customerProfile,
      turnCount, consultationGoal, askingSlot: nextSlot,
    }
    return {
      currentStep: 'identify_customer',
      message: slotEngine.SLOT_QUESTIONS[nextSlot] ?? `${nextSlot}를 알려주세요.`,
      askingSlot: nextSlot,
      candidateProducts: [], eligibilityConditions: [], documents: [],
      disclaimer: '',
      state,
      debug: { loanCategory: cat, consultationGoal, loanIntent, customerProfile, pendingSlots: missingCustomer, matchedKeywords: [], searchMode: 'slot_filling', queryMs: Date.now() - start },
    }
  }

  // ── STEP 3: check_repayment (자동) ───────────────────────────────────────
  const repaymentCapacity = eligibilityEngine.checkRepaymentCapacity(loanIntent, customerProfile)

  // ── STEP 4: find_candidates ───────────────────────────────────────────────
  let productIds: string[]
  let matchedKeywords: string[] = []
  let searchMode: string

  if (eligibilityFilteredProductIds !== null) {
    productIds = eligibilityFilteredProductIds
    searchMode = 'eligibility_filtered'
  } else if (prevState?.selectedProductIds?.length && prevState.currentStep === 'eligibility_check') {
    productIds = prevState.selectedProductIds
    searchMode = 'selected_context'
  } else if (prevState?.askingSlot) {
    // Previous turn was collecting a slot answer — the user's reply is a slot value, not a
    // product search query. Skip keyword search to avoid false matches (e.g. '개인사업자'
    // matching a different product's keyword) and fall through to slot_fallback.
    productIds = []
    searchMode = 'slot_answer_fallback'
  } else {
    const kwResult = await policyLoader.searchByKeyword(userText)
    productIds = kwResult.productIds
    matchedKeywords = kwResult.matchedKeywords
    searchMode = 'keyword'
  }

  if (!productIds.length) {
    searchMode = 'slot_fallback'
    productIds = await policyLoader.getAllActiveProductIds()
  }

  if (!productIds.length) {
    const emptyState: ConsultationState = {
      currentStep: 'find_candidates', loanIntent, customerProfile, turnCount, consultationGoal, askingSlot: undefined,
    }
    return {
      currentStep: 'find_candidates',
      message: 'DB에 등록된 상품이 없습니다.',
      candidateProducts: [], eligibilityConditions: [], documents: [],
      disclaimer: '',
      state: emptyState,
      debug: { loanCategory: cat, consultationGoal, loanIntent, customerProfile, pendingSlots: [], matchedKeywords, searchMode, queryMs: Date.now() - start },
    }
  }

  const { masters, policyMap } = await policyLoader.getProductDetails(productIds)

  // 하드 필터: 금액 초과 / 자금 목적 불일치
  const filtered = masters.filter(row => {
    const policy = policyMap[row.productId]
    if (loanIntent.desiredAmount && policy?.maxAmount && loanIntent.desiredAmount > policy.maxAmount) return false
    if (loanIntent.loanPurposeDetail && policy?.loanPurpose) {
      const supported = String(policy.loanPurpose).split(/[,/]/).map((s: string) => s.trim()).filter(Boolean)
      if (supported.length && !supported.includes(loanIntent.loanPurposeDetail)) return false
    }
    return true
  })

  const scored = filtered
    .map(row => ({ row, score: recommendationEngine.scoreProduct(policyMap[row.productId], loanIntent, customerProfile) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
  const top3Ids = scored.map(p => p.row.productId)

  // 자격 Q&A 시작 (eligibility_check를 막 끝낸 경우, 또는 blocking 필터 후 fall-through 경우는 제외)
  if (prevState?.currentStep !== 'eligibility_check' && eligibilityFilteredProductIds === null && top3Ids.length > 0) {
    const allRules = await policyLoader.getEligibilityRules(top3Ids)
    if (allRules.length > 0) {
      const firstRule = allRules[0]
      const productNames = scored.map(p => p.row.productName).join(', ')
      const intro = top3Ids.length === 1
        ? `${productNames} 신청 조건을 함께 확인해 드릴게요.`
        : `후보 상품(${productNames}) 신청 조건을 함께 확인해 드릴게요.`
      const checkState: ConsultationState = {
        ...(prevState ?? { loanIntent: {}, customerProfile: {} }),
        currentStep: 'eligibility_check', loanIntent, customerProfile, repaymentCapacity,
        turnCount, consultationGoal, askingSlot: undefined,
        eligibilityRules: allRules, eligibilityPendingIdx: 0, eligibilityAnswers: {},
        selectedProductIds: top3Ids,
      }
      return {
        currentStep: 'eligibility_check',
        message: `${intro}\n\n${eligibilityEngine.buildEligibilityQuestion(firstRule)}`,
        eligibilityCurrentPolarity: firstRule.conditionPolarity,
        candidateProducts: [], eligibilityConditions: [], documents: [],
        disclaimer: '',
        state: checkState,
        debug: { loanCategory: cat, consultationGoal, loanIntent, customerProfile, pendingSlots: [], matchedKeywords, searchMode, queryMs: Date.now() - start },
      }
    }
  }

  // ── STEP 5: calculate_estimate (자동) ─────────────────────────────────────
  // blocking 필터 후 fall-through인 경우, 잔여 상품의 규칙/답변만 사용
  const eligibilityAnswers = eligibilityFilteredAnswers ?? prevState?.eligibilityAnswers ?? {}
  const eligibilityRules = eligibilityFilteredRules ?? prevState?.eligibilityRules ?? []
  const estimatedResult = rankingEngine.calculateEstimate(top3Ids, policyMap, loanIntent)

  // ── STEP 6: guide_pre_approval (자동) ────────────────────────────────────
  const preApproval = rankingEngine.buildPreApproval(estimatedResult, eligibilityAnswers, eligibilityRules, top3Ids.length > 0)

  // ── STEP 8: CTA 빌드 (screen_transition) ────────────────────────────────
  const ctaMap = await policyLoader.getBusinessActionCTA(top3Ids)
  const screenIds = Object.values(ctaMap).map(r => r.targetScreenId)
  const screenMap = await policyLoader.getScreenMapping(screenIds)

  const candidateProducts: CandidateProduct[] = scored.map(({ row, score }) => {
    const policy = policyMap[row.productId] ?? {}
    const routing = ctaMap[row.productId]
    const screen = routing ? screenMap[routing.targetScreenId] : null
    const cta: CTAInfo | undefined = routing ? {
      label: routing.ctaLabel, action: routing.actionType,
      targetScreenId: routing.targetScreenId,
      targetScreenName: screen?.screenName ?? routing.targetScreenName ?? routing.targetScreenId,
    } : undefined
    return {
      productId: row.productId, productName: row.productName,
      category: row.productCategory ?? '', menuPath: row.menuPath,
      suitabilityExplanation: recommendationEngine.buildSuitabilityExplanation(row, policy, loanIntent, customerProfile),
      policy: {
        minAmount: policy.minAmount, maxAmount: policy.maxAmount,
        rateType: policy.rateType, minRate: policy.minRate, maxRate: policy.maxRate,
        rateBaseDate: policy.rateBaseDate, maxTerm: policy.maxTerm,
        repaymentOptions: recommendationEngine.toArray(policy.repaymentOptions), loanType: policy.loanType,
        loanPurpose: policy.loanPurpose, collateralOrGuarantee: policy.collateralOrGuarantee,
        guaranteeRequired: policy.guaranteeRequired, targetCustomer: policy.targetCustomer,
      },
      cta, matchScore: score,
    }
  })

  const completeState: ConsultationState = {
    currentStep: 'complete',
    loanIntent, customerProfile, repaymentCapacity, estimatedResult, preApproval,
    selectedProductIds: top3Ids, eligibilityRules, eligibilityAnswers,
    turnCount, consultationGoal, askingSlot: undefined,
  }

  return {
    currentStep: 'guide_pre_approval',
    message: responseBuilder.buildMessage('guide_pre_approval', loanIntent, candidateProducts, preApproval),
    candidateProducts,
    eligibilityConditions: [],
    documents: [],
    estimatedResult,
    preApproval,
    repaymentCapacity,
    disclaimer: DISCLAIMER,
    state: completeState,
    debug: {
      loanCategory: cat, consultationGoal, loanIntent, customerProfile,
      pendingSlots: [], matchedKeywords, searchMode, queryMs: Date.now() - start,
    },
  }
}
