// Part 10C - BID Module Engine
// Tender & Bid Management

import type { Part10CState, Tender, TenderStatus, EligibilityCriterion, BidDecision, RiskItem, MarginSensitivity, WinLossRecord } from './types';

// Initialize state
export function createInitialState(): Part10CState {
  return {
    tenders: [],
    eligibilityCriteria: [],
    bidDecisions: [],
    risks: [],
    marginSensitivities: [],
    winLossRecords: [],
    factTables: [],
    dimensions: [],
    measures: [],
    reports: [],
    aiQueries: [],
    aiGuardrails: [],
    customFields: [],
    configTransports: [],
    aiEnabled: true,
  };
}

// Tender Pipeline
export function createTender(
  state: Part10CState,
  tender: Omit<Tender, 'id' | 'createdAt'>
): Part10CState {
  const newTender: Tender = {
    ...tender,
    id: `TENDER-${Date.now()}`,
    createdAt: new Date().toISOString(),
  };
  return { ...state, tenders: [...state.tenders, newTender] };
}

export function updateTenderStatus(
  state: Part10CState,
  tenderId: string,
  status: TenderStatus
): Part10CState {
  return {
    ...state,
    tenders: state.tenders.map(t => 
      t.id === tenderId ? { ...t, status } : t
    ),
  };
}

export function getPipelineByStatus(state: Part10CState): Record<TenderStatus, Tender[]> {
  const pipeline: Record<TenderStatus, Tender[]> = {
    IDENTIFIED: [],
    SCREENED: [],
    GO_NO_GO: [],
    PREPARING: [],
    SUBMITTED: [],
    OPENED: [],
    NEGOTIATING: [],
    WON: [],
    LOST: [],
    WITHDRAWN: [],
    CANCELLED: [],
  };
  
  state.tenders.forEach(t => {
    pipeline[t.status].push(t);
  });
  
  return pipeline;
}

export function getDeadlineAlerts(state: Part10CState, today: string): Array<{tender: Tender; daysLeft: number; alertLevel: string}> {
  const alerts: Array<{tender: Tender; daysLeft: number; alertLevel: string}> = [];
  
  state.tenders.forEach(tender => {
    if (['IDENTIFIED', 'SCREENED', 'GO_NO_GO', 'PREPARING'].includes(tender.status)) {
      const deadline = new Date(tender.submissionDeadline);
      const now = new Date(today);
      const daysLeft = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysLeft <= 30 && daysLeft >= 0) {
        let alertLevel = 'INFO';
        if (daysLeft <= 1) alertLevel = 'CRITICAL';
        else if (daysLeft <= 3) alertLevel = 'URGENT';
        else if (daysLeft <= 7) alertLevel = 'HIGH';
        else if (daysLeft <= 15) alertLevel = 'MEDIUM';
        
        alerts.push({ tender, daysLeft, alertLevel });
      }
    }
  });
  
  return alerts.sort((a, b) => a.daysLeft - b.daysLeft);
}

// Eligibility Screening
export function screenEligibility(
  state: Part10CState,
  tenderId: string,
  criteria: Array<{name: string; required: string; actual: string}>
): Part10CState {
  const screened: EligibilityCriterion[] = criteria.map((c, idx) => {
    const pass = checkCriterion(c.required, c.actual);
    return {
      id: `ELIG-${tenderId}-${idx}`,
      tenderId,
      name: c.name,
      required: c.required,
      actual: c.actual,
      pass,
      gap: pass ? undefined : calculateGap(c.required, c.actual),
    };
  });
  
  return {
    ...state,
    eligibilityCriteria: [...state.eligibilityCriteria.filter(c => c.tenderId !== tenderId), ...screened],
  };
}

function checkCriterion(required: string, actual: string): boolean {
  // Parse numeric comparisons
  const reqMatch = required.match(/([≥<>]=?\s*)?([\d,]+\.?\d*)/);
  const actMatch = actual.match(/([\d,]+\.?\d*)/);
  
  if (reqMatch && actMatch) {
    const reqNum = parseFloat(reqMatch[2].replace(/,/g, ''));
    const actNum = parseFloat(actMatch[1].replace(/,/g, ''));
    const operator = reqMatch[1]?.trim() || '>=';
    
    switch (operator) {
      case '>=': return actNum >= reqNum;
      case '>': return actNum > reqNum;
      case '<=': return actNum <= reqNum;
      case '<': return actNum < reqNum;
      case '=': return actNum === reqNum;
      default: return actNum >= reqNum;
    }
  }
  
  // String comparison
  return actual.toLowerCase().includes(required.toLowerCase());
}

function calculateGap(required: string, actual: string): string {
  const reqMatch = required.match(/([\d,]+\.?\d*)/);
  const actMatch = actual.match(/([\d,]+\.?\d*)/);
  
  if (reqMatch && actMatch) {
    const reqNum = parseFloat(reqMatch[1].replace(/,/g, ''));
    const actNum = parseFloat(actMatch[1].replace(/,/g, ''));
    const gap = reqNum - actNum;
    return `Short by ${gap.toLocaleString()}`;
  }
  
  return 'Does not meet requirement';
}

// Bid Capacity Calculation
export function calculateBidCapacity(
  completedWorks: Array<{year: number; value: number}>,
  ongoingWorks: Array<{value: number; completionDate: string}>,
  tenderCompletionYears: number,
  priceIndex: number = 1.0
): { assessedCapacity: number; working: string } {
  // A = maximum value in any one year during last N years, updated to current price
  const recentYears = completedWorks
    .filter(w => w.year >= new Date().getFullYear() - tenderCompletionYears)
    .map(w => w.value * priceIndex);
  
  const A = recentYears.length > 0 ? Math.max(...recentYears) : 0;
  const N = tenderCompletionYears;
  
  // B = value of existing commitments to be completed during next N years
  const now = new Date();
  const futureDate = new Date();
  futureDate.setFullYear(futureDate.getFullYear() + N);
  
  const B = ongoingWorks
    .filter(w => new Date(w.completionDate) <= futureDate)
    .reduce((sum, w) => sum + w.value, 0);
  
  // Assessed bid capacity = (A × N × 2) − B
  const assessedCapacity = (A * N * 2) - B;
  
  const working = `
Bid Capacity Calculation:
A = Maximum annual turnover (last ${N} years, price-adjusted) = ₹${A.toLocaleString()}
N = Completion period = ${N} years
B = Existing commitments (next ${N} years) = ₹${B.toLocaleString()}

Assessed Capacity = (A × N × 2) − B
                  = (${A.toLocaleString()} × ${N} × 2) − ${B.toLocaleString()}
                  = ₹${assessedCapacity.toLocaleString()}
  `.trim();
  
  return { assessedCapacity, working };
}

// Bid/No-Bid Decision
export function recordBidDecision(
  state: Part10CState,
  decision: Omit<BidDecision, 'id' | 'approvedAt'>
): Part10CState {
  const newDecision: BidDecision = {
    ...decision,
    id: `BID-${Date.now()}`,
    approvedAt: new Date().toISOString(),
  };
  
  return {
    ...state,
    bidDecisions: [...state.bidDecisions, newDecision],
  };
}

export function getNoBidRegister(state: Part10CState): BidDecision[] {
  return state.bidDecisions.filter(d => d.decision === 'NO_BID');
}

// Risk Contingency
export function addRisk(
  state: Part10CState,
  risk: Omit<RiskItem, 'id'>
): Part10CState {
  const newRisk: RiskItem = {
    ...risk,
    id: `RISK-${Date.now()}`,
  };
  
  return { ...state, risks: [...state.risks, newRisk] };
}

export function calculateRiskContingency(state: Part10CState, tenderId: string): number {
  const tenderRisks = state.risks.filter(r => r.tenderId === tenderId);
  return tenderRisks.reduce((sum, r) => sum + (r.probability * r.impact), 0);
}

// Margin Sensitivity
export function calculateMarginSensitivity(
  baseMargin: number,
  scenarios: Array<{name: string; impact: number}>
): MarginSensitivity[] {
  return scenarios.map(s => ({
    scenario: s.name,
    margin: baseMargin + s.impact,
    delta: s.impact,
  }));
}

// Submission & Award
export function lockAndHashBOQ(state: Part10CState, tenderId: string, boqData: any): {state: Part10CState; hash: string} {
  // Simple hash for demo - in production use proper crypto
  const dataStr = JSON.stringify(boqData);
  let hash = 0;
  for (let i = 0; i < dataStr.length; i++) {
    const char = dataStr.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  const hashStr = `SHA256:${Math.abs(hash).toString(16).padStart(16, '0')}`;
  return { state, hash: hashStr };
}

export function convertTenderToProject(
  state: Part10CState,
  tenderId: string
): Part10CState {
  // This would create project, WBS, BOQ, budget from tender
  // For now, just update status
  return updateTenderStatus(state, tenderId, 'WON');
}

// Win/Loss Analysis
export function recordWinLoss(
  state: Part10CState,
  record: Omit<WinLossRecord, 'id' | 'recordedAt'>
): Part10CState {
  const newRecord: WinLossRecord = {
    ...record,
    id: `WL-${Date.now()}`,
    recordedAt: new Date().toISOString(),
  };
  
  return { ...state, winLossRecords: [...state.winLossRecords, newRecord] };
}

export function analyzeCompetitorRates(state: Part10CState): {
  consistentlyHigh: string[];
  consistentlyLow: string[];
} {
  const itemPerformance: Record<string, {high: number; low: number; total: number}> = {};
  
  state.winLossRecords.forEach(record => {
    if (record.competitorRates) {
      Object.entries(record.competitorRates).forEach(([item, competitorRate]) => {
        if (!itemPerformance[item]) {
          itemPerformance[item] = { high: 0, low: 0, total: 0 };
        }
        
        itemPerformance[item].total++;
        
        if (record.ourRate > competitorRate * 1.1) {
          itemPerformance[item].high++;
        } else if (record.ourRate < competitorRate * 0.9) {
          itemPerformance[item].low++;
        }
      });
    }
  });
  
  const consistentlyHigh: string[] = [];
  const consistentlyLow: string[] = [];
  
  Object.entries(itemPerformance).forEach(([item, perf]) => {
    if (perf.total >= 3) {
      if (perf.high / perf.total > 0.6) {
        consistentlyHigh.push(item);
      }
      if (perf.low / perf.total > 0.6) {
        consistentlyLow.push(item);
      }
    }
  });
  
  return { consistentlyHigh, consistentlyLow };
}
