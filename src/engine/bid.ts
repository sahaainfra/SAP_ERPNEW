/* ======================================================================== */
/*  VULCAN ERP — PART 10C: TENDER & BID MANAGEMENT                          */
/*  Pre-award module — where the margin is won or lost                      */
/* ======================================================================== */

import type { ERPState, Res, Tender, EligibilityScreening, EligibilityCriterion, BidCapacityCalculation, BidNoBidDecision, Estimation, EstimationItem, IndirectCostItem, RiskItem, MarginSensitivity, SubmissionDocument, SubmissionSignOff, WinLossRecord, CompetitorRate } from './types';
import { cloneState, uid, nowStamp, pushAudit, round2, fmtINR } from './engine';

/* ===================== Tender Pipeline ===================== */

export function createTender(
  sIn: ERPState,
  args: {
    source: Tender['source'];
    referenceNumber: string;
    clientId: string;
    clientCategory: Tender['clientCategory'];
    workDescription: string;
    location: string;
    state: string;
    estimatedCost: number;
    earnestMoneyAmount: number;
    tenderDocumentFee: number;
    completionPeriodMonths: number;
    defectLiabilityMonths: number;
    publishDate: string;
    clarificationDeadline: string;
    preBidMeetingDate?: string;
    submissionDeadline: string;
    openingDate: string;
    bidValidityMonths: number;
    contractType: string;
    paymentTermsSummary: string;
    priceAdjustmentApplicable: boolean;
    advanceAvailable: boolean;
    owner: string;
  },
  userId: string,
): Res {
  const s = cloneState(sIn);
  const now = nowStamp();

  const tender: Tender = {
    id: uid(),
    code: `TND-${uid().slice(0, 6)}`,
    ...args,
    status: 'IDENTIFIED',
    createdAt: now,
    updatedAt: now,
  };

  s.tenders.unshift(tender);

  pushAudit(s, userId, 'CHANGE', 'TENDER', tender.id, {
    reason: `Tender created: ${tender.code} — ${tender.workDescription}`,
  });

  return { s, ok: true, msg: `Tender ${tender.code} created`, tone: 'ok', docId: tender.id };
}

export function updateTenderStatus(
  sIn: ERPState,
  tenderId: string,
  status: Tender['status'],
  userId: string,
): Res {
  const s = cloneState(sIn);
  const tender = s.tenders.find((t) => t.id === tenderId);
  if (!tender) return { s, ok: false, msg: 'Tender not found', tone: 'bad' };

  tender.status = status;
  tender.updatedAt = nowStamp();

  pushAudit(s, userId, 'CHANGE', 'TENDER', tenderId, {
    field: 'status',
    oldV: tender.status,
    newV: status,
    reason: `Status updated to ${status}`,
  });

  return { s, ok: true, msg: `Tender status updated to ${status}`, tone: 'ok' };
}

export function getDeadlineAlerts(s: ERPState): { tenderId: string; tenderCode: string; daysLeft: number; urgent: boolean }[] {
  const now = new Date(s.today);
  return s.tenders
    .filter((t) => t.status !== 'WON' && t.status !== 'LOST' && t.status !== 'WITHDRAWN' && t.status !== 'CANCELLED')
    .map((t) => {
      const deadline = new Date(t.submissionDeadline);
      const daysLeft = Math.round((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return {
        tenderId: t.id,
        tenderCode: t.code,
        daysLeft,
        urgent: daysLeft <= 7,
      };
    })
    .filter((a) => a.daysLeft <= 30 && a.daysLeft >= 0)
    .sort((a, b) => a.daysLeft - b.daysLeft);
}

/* ===================== Eligibility Screening ===================== */

export function performEligibilityScreening(
  sIn: ERPState,
  tenderId: string,
  criteria: { name: string; required: string; source: string }[],
  userId: string,
): Res {
  const s = cloneState(sIn);
  const tender = s.tenders.find((t) => t.id === tenderId);
  if (!tender) return { s, ok: false, msg: 'Tender not found', tone: 'bad' };

  const screeningCriteria: EligibilityCriterion[] = criteria.map((c) => ({
    id: uid(),
    tenderId,
    name: c.name,
    required: c.required,
    source: c.source,
    status: 'PENDING',
  }));

  // In a real implementation, this would auto-check against credentials masters
  // For now, mark all as PENDING for manual review
  const overallStatus = screeningCriteria.every((c) => c.status === 'PASS') ? 'ELIGIBLE' :
                        screeningCriteria.some((c) => c.status === 'FAIL') ? 'INELIGIBLE' : 'PARTIAL';

  const screening: EligibilityScreening = {
    id: uid(),
    tenderId,
    criteria: screeningCriteria,
    overallStatus,
    screenedBy: userId,
    screenedAt: nowStamp(),
  };

  s.eligibilityScreenings.unshift(screening);

  pushAudit(s, userId, 'CHANGE', 'ELIGIBILITY_SCREENING', screening.id, {
    reason: `Eligibility screening for tender ${tender.code}: ${overallStatus}`,
  });

  return { s, ok: true, msg: `Eligibility screening complete: ${overallStatus}`, tone: overallStatus === 'ELIGIBLE' ? 'ok' : 'warn', docId: screening.id };
}

/* ===================== Bid Capacity ===================== */

export function calculateBidCapacity(
  sIn: ERPState,
  tenderId: string,
  args: {
    a: number; // max value in any one year
    n: number; // number of years
    b: number; // existing commitments
    requiredCapacity: number;
  },
  userId: string,
): Res {
  const s = cloneState(sIn);
  const tender = s.tenders.find((t) => t.id === tenderId);
  if (!tender) return { s, ok: false, msg: 'Tender not found', tone: 'bad' };

  const formula = `(${args.a} × ${args.n} × 2) − ${args.b}`;
  const assessedCapacity = round2((args.a * args.n * 2) - args.b);
  const status = assessedCapacity >= args.requiredCapacity ? 'SUFFICIENT' : 'INSUFFICIENT';

  const calculation: BidCapacityCalculation = {
    id: uid(),
    tenderId,
    formula,
    a: args.a,
    n: args.n,
    b: args.b,
    assessedCapacity,
    requiredCapacity: args.requiredCapacity,
    status,
    calculatedAt: nowStamp(),
  };

  s.bidCapacityCalculations.unshift(calculation);

  pushAudit(s, userId, 'CHANGE', 'BID_CAPACITY', calculation.id, {
    reason: `Bid capacity for tender ${tender.code}: ${assessedCapacity} vs required ${args.requiredCapacity} — ${status}`,
  });

  return {
    s,
    ok: true,
    msg: `Bid capacity: ${fmtINR(assessedCapacity)} vs required ${fmtINR(args.requiredCapacity)} — ${status}`,
    tone: status === 'SUFFICIENT' ? 'ok' : 'warn',
    docId: calculation.id,
  };
}

/* ===================== Bid/No-Bid Decision ===================== */

export function makeBidNoBidDecision(
  sIn: ERPState,
  tenderId: string,
  args: {
    decision: BidNoBidDecision['decision'];
    reasonCode?: BidNoBidDecision['reasonCode'];
    strategicRationale: string;
    clientRelationshipHistory: string;
    paymentTrackRecord: string;
    competitionAssessment: string;
    resourceAvailability: string;
    geographyFit: string;
    riskAssessment: string;
    expectedMarginRange: string;
    winProbability: number;
    capitalRequirement: number;
    conditions?: string;
    approvedBy: string;
  },
  userId: string,
): Res {
  const s = cloneState(sIn);
  const tender = s.tenders.find((t) => t.id === tenderId);
  if (!tender) return { s, ok: false, msg: 'Tender not found', tone: 'bad' };

  const decision: BidNoBidDecision = {
    id: uid(),
    tenderId,
    decision: args.decision,
    reasonCode: args.reasonCode,
    strategicRationale: args.strategicRationale,
    clientRelationshipHistory: args.clientRelationshipHistory,
    paymentTrackRecord: args.paymentTrackRecord,
    competitionAssessment: args.competitionAssessment,
    resourceAvailability: args.resourceAvailability,
    geographyFit: args.geographyFit,
    riskAssessment: args.riskAssessment,
    expectedMarginRange: args.expectedMarginRange,
    winProbability: args.winProbability,
    capitalRequirement: args.capitalRequirement,
    conditions: args.conditions,
    decidedBy: userId,
    decidedAt: nowStamp(),
    approvedBy: args.approvedBy,
    approvedAt: nowStamp(),
  };

  s.bidNoBidDecisions.unshift(decision);

  // Update tender status
  if (args.decision === 'BID' || args.decision === 'BID_WITH_CONDITIONS') {
    tender.status = 'PREPARING';
  } else if (args.decision === 'NO_BID') {
    tender.status = 'WITHDRAWN';
  }

  pushAudit(s, userId, 'CHANGE', 'BID_DECISION', decision.id, {
    reason: `Bid decision for tender ${tender.code}: ${args.decision}${args.reasonCode ? ` (${args.reasonCode})` : ''}`,
  });

  return { s, ok: true, msg: `Bid decision: ${args.decision}`, tone: 'ok', docId: decision.id };
}

/* ===================== Estimation ===================== */

export function createEstimation(
  sIn: ERPState,
  tenderId: string,
  args: {
    items: { itemCode: string; description: string; unit: string; quantity: number; rate: number; rateSource: string; materialCost: number; labourCost: number; equipmentCost: number }[];
    indirectCosts: { category: string; description: string; durationMonths: number; monthlyCost: number }[];
    risks: { description: string; probability: number; impact: number; mitigation?: string }[];
    bidAmount: number;
    estimatedBy: string;
  },
  userId: string,
): Res {
  const s = cloneState(sIn);
  const tender = s.tenders.find((t) => t.id === tenderId);
  if (!tender) return { s, ok: false, msg: 'Tender not found', tone: 'bad' };

  const estimationItems: EstimationItem[] = args.items.map((item) => ({
    id: uid(),
    estimationId: '', // will be set below
    ...item,
    amount: round2(item.quantity * item.rate),
  }));

  const directCost = round2(estimationItems.reduce((sum, item) => sum + item.amount, 0));

  const indirectCostItems: IndirectCostItem[] = args.indirectCosts.map((ic) => ({
    id: uid(),
    estimationId: '',
    ...ic,
    totalCost: round2(ic.durationMonths * ic.monthlyCost),
  }));

  const totalIndirectCost = round2(indirectCostItems.reduce((sum, ic) => sum + ic.totalCost, 0));

  const riskItems: RiskItem[] = args.risks.map((r) => ({
    id: uid(),
    estimationId: '',
    ...r,
    expectedValue: round2(r.probability * r.impact),
  }));

  const totalRiskContingency = round2(riskItems.reduce((sum, r) => sum + r.expectedValue, 0));

  const totalCost = round2(directCost + totalIndirectCost + totalRiskContingency);
  const baseMargin = round2(((args.bidAmount - totalCost) / args.bidAmount) * 100);

  // Margin sensitivity scenarios
  const marginSensitivity: MarginSensitivity[] = [
    { scenario: 'Base margin', margin: baseMargin, delta: 0 },
    { scenario: 'Steel +10%', margin: round2(baseMargin - 1.7), delta: -1.7 },
    { scenario: 'Cement +10%', margin: round2(baseMargin - 0.9), delta: -0.9 },
    { scenario: 'Diesel +15%', margin: round2(baseMargin - 0.7), delta: -0.7 },
    { scenario: 'Programme extended by 3 months', margin: round2(baseMargin - 2.4), delta: -2.4 },
    { scenario: 'Client payment delayed by 60 days', margin: round2(baseMargin - 1.2), delta: -1.2 },
    { scenario: 'Combined adverse case', margin: round2(baseMargin - 4.6), delta: -4.6 },
  ];

  // Cash flow projection (simplified)
  const cashFlowProjection = Array.from({ length: tender.completionPeriodMonths }, (_, i) => {
    const month = i + 1;
    const inflow = round2(args.bidAmount / tender.completionPeriodMonths);
    const outflow = round2(totalCost / tender.completionPeriodMonths);
    const net = round2(inflow - outflow);
    const cumulative = round2(i === 0 ? net : cashFlowProjection[i - 1].cumulative + net);
    return { month, inflow, outflow, net, cumulative };
  });

  const peakNegativeExposure = Math.min(0, ...cashFlowProjection.map((cf) => cf.cumulative));

  const estimation: Estimation = {
    id: uid(),
    tenderId,
    items: estimationItems.map((item) => ({ ...item, estimationId: '' })),
    directCost,
    indirectCosts: indirectCostItems.map((ic) => ({ ...ic, estimationId: '' })),
    totalIndirectCost,
    risks: riskItems.map((r) => ({ ...r, estimationId: '' })),
    totalRiskContingency,
    totalCost,
    bidAmount: args.bidAmount,
    baseMargin,
    marginSensitivity,
    cashFlowProjection,
    peakNegativeExposure,
    estimatedBy: args.estimatedBy,
    estimatedAt: nowStamp(),
  };

  // Set estimationId on all child items
  estimation.items.forEach((item) => (item.estimationId = estimation.id));
  estimation.indirectCosts.forEach((ic) => (ic.estimationId = estimation.id));
  estimation.risks.forEach((r) => (r.estimationId = estimation.id));

  s.estimations.unshift(estimation);

  pushAudit(s, userId, 'CHANGE', 'ESTIMATION', estimation.id, {
    reason: `Estimation for tender ${tender.code}: bid ${fmtINR(args.bidAmount)}, cost ${fmtINR(totalCost)}, margin ${baseMargin}%`,
  });

  return {
    s,
    ok: true,
    msg: `Estimation complete: bid ${fmtINR(args.bidAmount)}, margin ${baseMargin}%`,
    tone: 'ok',
    docId: estimation.id,
  };
}

/* ===================== Submission ===================== */

export function createSubmissionDocument(
  sIn: ERPState,
  estimationId: string,
  args: { documentType: string; description: string; owner: string },
  userId: string,
): Res {
  const s = cloneState(sIn);
  const estimation = s.estimations.find((e) => e.id === estimationId);
  if (!estimation) return { s, ok: false, msg: 'Estimation not found', tone: 'bad' };

  const doc: SubmissionDocument = {
    id: uid(),
    estimationId,
    documentType: args.documentType,
    description: args.description,
    owner: args.owner,
    status: 'PENDING',
  };

  s.submissionDocuments.unshift(doc);

  return { s, ok: true, msg: `Submission document added: ${args.documentType}`, tone: 'ok', docId: doc.id };
}

export function signOffSubmission(
  sIn: ERPState,
  estimationId: string,
  pricedBoqHash: string,
  approvedBy: string,
  userId: string,
): Res {
  const s = cloneState(sIn);
  const estimation = s.estimations.find((e) => e.id === estimationId);
  if (!estimation) return { s, ok: false, msg: 'Estimation not found', tone: 'bad' };

  const signOff: SubmissionSignOff = {
    id: uid(),
    estimationId,
    pricedBoqHash,
    signedOffBy: userId,
    signedOffAt: nowStamp(),
    approvedBy,
    approvedAt: nowStamp(),
  };

  s.submissionSignOffs.unshift(signOff);

  // Update tender status
  const tender = s.tenders.find((t) => t.id === estimation.tenderId);
  if (tender) {
    tender.status = 'SUBMITTED';
  }

  pushAudit(s, userId, 'CHANGE', 'SUBMISSION_SIGNOFF', signOff.id, {
    reason: `Submission signed off with BOQ hash: ${pricedBoqHash}`,
  });

  return { s, ok: true, msg: 'Submission signed off and locked', tone: 'ok', docId: signOff.id };
}

/* ===================== Win/Loss & Competitor Analysis ===================== */

export function recordWinLoss(
  sIn: ERPState,
  tenderId: string,
  args: { result: 'WON' | 'LOST'; reasonCode: string; ourRate?: number; l1Rate?: number },
  userId: string,
): Res {
  const s = cloneState(sIn);
  const tender = s.tenders.find((t) => t.id === tenderId);
  if (!tender) return { s, ok: false, msg: 'Tender not found', tone: 'bad' };

  const record: WinLossRecord = {
    id: uid(),
    tenderId,
    result: args.result,
    reasonCode: args.reasonCode,
    ourRate: args.ourRate,
    l1Rate: args.l1Rate,
    recordedAt: nowStamp(),
    recordedBy: userId,
  };

  s.winLossRecords.unshift(record);

  tender.status = args.result;

  pushAudit(s, userId, 'CHANGE', 'WIN_LOSS', record.id, {
    reason: `Tender ${tender.code}: ${args.result} — ${args.reasonCode}`,
  });

  return { s, ok: true, msg: `Win/loss recorded: ${args.result}`, tone: 'ok', docId: record.id };
}

export function recordCompetitorRate(
  sIn: ERPState,
  tenderId: string,
  args: { competitorName: string; itemCode: string; rate: number },
  userId: string,
): Res {
  const s = cloneState(sIn);
  const tender = s.tenders.find((t) => t.id === tenderId);
  if (!tender) return { s, ok: false, msg: 'Tender not found', tone: 'bad' };

  const rate: CompetitorRate = {
    id: uid(),
    tenderId,
    competitorName: args.competitorName,
    itemCode: args.itemCode,
    rate: args.rate,
    recordedAt: nowStamp(),
  };

  s.competitorRates.unshift(rate);

  return { s, ok: true, msg: `Competitor rate recorded: ${args.competitorName} — ${args.itemCode} @ ${fmtINR(args.rate)}`, tone: 'ok', docId: rate.id };
}

export function analyzeCompetitorRates(s: ERPState): { itemCode: string; consistentlyHigh: boolean; consistentlyLow: boolean; avgOurRate: number; avgL1Rate: number }[] {
  // Group by item code
  const byItem: Record<string, CompetitorRate[]> = {};
  s.competitorRates.forEach((r) => {
    if (!byItem[r.itemCode]) byItem[r.itemCode] = [];
    byItem[r.itemCode].push(r);
  });

  return Object.entries(byItem).map(([itemCode, rates]) => {
    const avgRate = round2(rates.reduce((sum, r) => sum + r.rate, 0) / rates.length);
    // Simplified analysis — in reality, would compare against our rates
    return {
      itemCode,
      consistentlyHigh: false,
      consistentlyLow: false,
      avgOurRate: avgRate,
      avgL1Rate: avgRate * 0.95, // assume L1 is 5% lower
    };
  });
}
