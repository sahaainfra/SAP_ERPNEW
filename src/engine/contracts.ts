// Part 6 - Contracts, Measurement, Billing, Subcontract & Receivables Engine

export interface Contract {
  id: string;
  contractNo: string;
  clientId: string;
  projectId: string;
  contractType: 'ITEM_RATE' | 'PERCENTAGE_RATE' | 'LUMP_SUM' | 'EPC' | 'COST_PLUS' | 'ANNUITY' | 'O&M';
  loaReference: string;
  loaDate: string;
  agreementDate: string;
  agreementValue: number;
  originalValue: number;
  revisedValue: number;
  currency: string;
  timeForCompletion: number; // days
  contractualCompletion: string;
  revisedCompletion?: string;
  eotGranted?: number; // days
  milestones: Array<{
    id: string;
    date: string;
    deliverable: string;
    paymentLinkage: number;
  }>;
  retentionPct: number;
  retentionCeilingPct: number;
  releaseStages: Array<{ stage: string; pct: number }>;
  securityDepositPct: number;
  recoveryBasis: 'FROM_BILLS' | 'BY_GUARANTEE';
  mobilizationAdvancePct: number;
  advanceInterestRate: number;
  recoveryStartPct: number;
  recoveryRatePct: number;
  securedAdvanceApplicable: boolean;
  securedAdvanceMaxPct: number;
  priceAdjustmentApplicable: boolean;
  priceAdjustmentClause: string;
  ldRatePct: number;
  ldCeilingPct: number;
  defectLiabilityMonths: number;
  claimNoticeDays: number;
  eotNoticeDays: number;
  disputeNoticeDays: number;
  clauses: ContractClause[];
}

export interface ContractClause {
  id: string;
  contractId: string;
  clauseNo: string;
  subject: string;
  obligation: string;
  owner: string;
  alertRule: string;
  deadline: string;
  status: 'OPEN' | 'COMPLETED' | 'OVERDUE';
}

export interface VariationOrder {
  id: string;
  contractId: string;
  voNumber: string;
  clauseReference: string;
  justification: string;
  rateBasis: 'BOQ_RATE' | 'DERIVED_RATE' | 'NEGOTIATED' | 'ANALYSIS_BASED';
  costImpact: number;
  timeImpact: number; // days
  clientSubmissionDate: string;
  approvalStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  approvedValue?: number;
}

export interface ExtraItem {
  id: string;
  contractId: string;
  itemCode: string;
  description: string;
  rateAnalysisId: string;
  provisionalRate: number;
  clientSubmissionDate: string;
  approvalStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  approvedRate?: number;
  executedQuantity: number;
}

export interface MeasurementBook {
  id: string;
  measurementNo: string;
  projectId: string;
  contractId: string;
  wbsId: string;
  period: string;
  measuredBy: string;
  checkedBy: string;
  clientRepresentative?: string;
  jointMeasurement: boolean;
  measurementDate: string;
  items: MeasurementItem[];
  status: 'DRAFT' | 'CERTIFIED';
}

export interface MeasurementItem {
  id: string;
  measurementId: string;
  boqItemId: string;
  description: string;
  location: string;
  drawingNumber: string;
  drawingRevision: string;
  lines: MeasurementLine[];
  cumulativeMeasured: number;
  previouslyBilled: number;
  currentQuantity: number; // computed: cumulative - previously
  certified: boolean;
  certifiedInBillId?: string;
}

export interface MeasurementLine {
  id: string;
  itemId: string;
  description: string;
  nos: number;
  length: number;
  breadth: number;
  depth: number;
  formula: string;
  computedQuantity: number;
  isDeduction: boolean;
  remarks?: string;
}

export interface RateAnalysis {
  id: string;
  itemCode: string;
  description: string;
  version: number;
  effectiveDate: string;
  preparer: string;
  approver?: string;
  locked: boolean;
  components: RateComponent[];
  waterSundriesPct: number;
  siteOverheadPct: number;
  hoOverheadPct: number;
  contractorProfitPct: number;
  taxes: RateTax[];
  finalRate: number;
}

export interface RateComponent {
  id: string;
  type: 'MATERIAL' | 'LABOUR' | 'PLANT' | 'TRANSPORT' | 'ROYALTY' | 'SUB_ANALYSIS';
  description: string;
  quantity: number;
  rate: number;
  wastagePct?: number;
  leadDistance?: number; // km
  liftHeight?: number; // m
  subAnalysisId?: string;
  amount: number;
}

export interface RateTax {
  type: string;
  pct: number;
  amount: number;
}

export interface RateBook {
  id: string;
  schedule: string;
  year: number;
  items: Array<{
    chapter: string;
    itemCode: string;
    description: string;
    unit: string;
    baseRate: number;
    effectiveDate: string;
  }>;
}

export interface ClientBill {
  id: string;
  billNumber: string;
  contractId: string;
  period: string;
  status: 'DRAFT' | 'QS_CERTIFIED' | 'PM_APPROVED' | 'COMMERCIAL_REVIEWED' | 'SUBMITTED' | 'UNDER_CERTIFICATION' | 'CERTIFIED' | 'INVOICED' | 'PAID' | 'CLOSED' | 'RETURNED' | 'DISPUTED';
  
  // Step 1: Gross value
  workExecutedValue: number;
  approvedVariationValue: number;
  approvedExtraItemValue: number;
  unapprovedExtraItemValue: number;
  partRateStageValue: number;
  
  // Step 2: Escalation
  escalationAmount: number;
  escalationComponents: Array<{
    component: string;
    weightage: number;
    indexBase: number;
    indexCurrent: number;
    amount: number;
  }>;
  
  // Step 3: Secured advance
  securedAdvanceAmount: number;
  
  grossToDate: number;
  grossPreviousBills: number;
  grossThisBill: number;
  
  // Step 4: Recoveries
  mobilizationAdvanceRecovery: number;
  mobilizationAdvanceInterest: number;
  plantAdvanceRecovery: number;
  securedAdvanceRecovery: number;
  clientMaterialRecovery: number;
  clientMaterialPenalRecovery: number;
  retention: number;
  securityDeposit: number;
  liquidatedDamages: number;
  otherRecoveries: number;
  
  // Step 5: Statutory deductions
  labourCess: number;
  incomeTaxWithholding: number;
  gstWithholding: number;
  stateSpecificDeductions: number;
  
  // Step 6: Tax and net payable
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  netPayable: number;
  
  submittedAmount: number;
  certifiedAmount: number;
  paidAmount: number;
  
  certificationShortfalls: Array<{
    reason: string;
    amount: number;
  }>;
}

export interface SubcontractOrder {
  id: string;
  orderNumber: string;
  subcontractorId: string;
  projectId: string;
  wbsIds: string[];
  scopeOfWork: string;
  boqLines: Array<{
    id: string;
    clientBoqItemId: string;
    description: string;
    quantity: number;
    rate: number;
    clientRate: number;
    margin: number;
    marginPct: number;
  }>;
  ceilingValue: number;
  retentionPct: number;
  securityDepositPct: number;
  advancePct: number;
  ldClause: string;
  defectLiabilityMonths: number;
  freeIssueMaterials: Array<{
    materialId: string;
    quantity: number;
    issued: number;
    consumed: number;
  }>;
  recoverableMaterials: Array<{
    materialId: string;
    recoveryRate: number;
  }>;
  labourLicenceValidTo: string;
  pfChallanFiled: boolean;
  esiChallanFiled: boolean;
  insuranceValidTo: string;
  complianceBlocked: boolean;
  complianceBlockReason?: string;
}

export interface SubcontractorBill {
  id: string;
  billNumber: string;
  suborderId: string;
  period: string;
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'PAID';
  grossValue: number;
  recoveries: {
    advanceRecovery: number;
    securedAdvanceRecovery: number;
    retention: number;
    securityDeposit: number;
    freeIssueExcess: number;
    recoverableMaterial: number;
    equipmentHire: number;
    royaltyRecovery: number;
    ld: number;
    debitNotes: number;
    rectificationCost: number;
    incomeTaxWithholding: number;
    gstWithholding: number;
  };
  netPayable: number;
}

export interface Claim {
  id: string;
  claimId: string;
  contractId: string;
  event: string;
  clauseInvoked: string;
  eventDate: string;
  noticeDate: string;
  noticeReference: string;
  description: string;
  heads: Array<{
    head: string;
    amount: number;
    basis: string;
  }>;
  timeImpactDays: number;
  supportingBundle: Array<{
    type: string;
    ref: string;
    date: string;
  }>;
  status: 'NOTICE' | 'PARTICULARS' | 'SUBMITTED' | 'NEGOTIATED' | 'AWARDED';
  negotiatedAmount?: number;
  awardedAmount?: number;
  recoveryStatus?: string;
}

export interface Receivable {
  id: string;
  clientId: string;
  billId: string;
  billNumber: string;
  nature: 'CERTIFIED_UNPAID' | 'RETENTION' | 'SECURITY_DEPOSIT' | 'DISPUTED' | 'SUBMITTED_UNCERTIFIED' | 'ADVANCE_PENDING';
  amount: number;
  dueDate: string;
  collected: number;
  ageing: '0-30' | '31-60' | '61-90' | '91-180' | '180+';
}

export interface RetentionRelease {
  id: string;
  contractId: string;
  stage: 'PRACTICAL_COMPLETION' | 'DEFECT_LIABILITY_EXPIRY';
  pct: number;
  date: string;
  status: 'PENDING' | 'RELEASED';
}

export interface LessonLearned {
  id: string;
  projectId: string;
  kind: 'PRODUCTIVITY' | 'CONSUMPTION' | 'RATE' | 'CLAIM' | 'CLIENT';
  actual: string;
  norm: string;
  note: string;
  fedToRateLibrary: boolean;
}

// Core functions
export function createContract(data: Omit<Contract, 'id'>): Contract {
  return { ...data, id: `CN-${Date.now()}` };
}

export function createVariationOrder(data: Omit<VariationOrder, 'id'>): VariationOrder {
  return { ...data, id: `VO-${Date.now()}` };
}

export function createExtraItem(data: Omit<ExtraItem, 'id'>): ExtraItem {
  return { ...data, id: `EI-${Date.now()}` };
}

export function createMeasurementBook(data: Omit<MeasurementBook, 'id'>): MeasurementBook {
  return { ...data, id: `MB-${Date.now()}` };
}

export function computeRateAnalysis(components: RateComponent[], overheads: {
  waterSundriesPct: number;
  siteOverheadPct: number;
  hoOverheadPct: number;
  contractorProfitPct: number;
}): number {
  // Detect circular references
  const visited = new Set<string>();
  
  function computeComponent(comp: RateComponent): number {
    if (comp.type === 'SUB_ANALYSIS' && comp.subAnalysisId) {
      if (visited.has(comp.subAnalysisId)) {
        throw new Error(`Circular reference detected: ${Array.from(visited).join(' -> ')} -> ${comp.subAnalysisId}`);
      }
      visited.add(comp.subAnalysisId);
      // In real implementation, would fetch sub-analysis and compute
      return comp.amount;
    }
    
    let amount = comp.quantity * comp.rate;
    if (comp.wastagePct) {
      amount *= (1 + comp.wastagePct / 100);
    }
    if (comp.leadDistance) {
      amount += comp.leadDistance * 50; // Lead cost per km
    }
    if (comp.liftHeight) {
      amount += comp.liftHeight * 20; // Lift cost per meter
    }
    return amount;
  }
  
  const materialLabourPlantTotal = components.reduce((sum, comp) => {
    return sum + computeComponent(comp);
  }, 0);
  
  const waterSundries = materialLabourPlantTotal * overheads.waterSundriesPct / 100;
  const siteOverhead = materialLabourPlantTotal * overheads.siteOverheadPct / 100;
  const hoOverhead = materialLabourPlantTotal * overheads.hoOverheadPct / 100;
  const contractorProfit = materialLabourPlantTotal * overheads.contractorProfitPct / 100;
  
  return materialLabourPlantTotal + waterSundries + siteOverhead + hoOverhead + contractorProfit;
}

export function computeMeasurementQuantity(lines: MeasurementLine[]): number {
  return lines.reduce((sum, line) => {
    const qty = line.nos * line.length * line.breadth * line.depth;
    return line.isDeduction ? sum - qty : sum + qty;
  }, 0);
}

export function computeClientBill(
  contract: Contract,
  measurements: MeasurementItem[],
  variations: VariationOrder[],
  extraItems: ExtraItem[],
  previousBills: ClientBill[]
): ClientBill {
  // Step 1: Gross value
  const workExecutedValue = measurements
    .filter(m => m.certified)
    .reduce((sum, m) => sum + m.currentQuantity * 1000, 0); // Simplified
  
  const approvedVariationValue = variations
    .filter(v => v.approvalStatus === 'APPROVED')
    .reduce((sum, v) => sum + v.costImpact, 0);
  
  const approvedExtraItemValue = extraItems
    .filter(e => e.approvalStatus === 'APPROVED')
    .reduce((sum, e) => sum + e.executedQuantity * (e.approvedRate || 0), 0);
  
  const unapprovedExtraItemValue = extraItems
    .filter(e => e.approvalStatus === 'PENDING')
    .reduce((sum, e) => sum + e.executedQuantity * e.provisionalRate, 0);
  
  const partRateStageValue = 0; // Simplified
  
  // Step 2: Escalation (simplified)
  const escalationAmount = workExecutedValue * 0.05; // 5% escalation
  
  // Step 3: Secured advance
  const securedAdvanceAmount = contract.securedAdvanceApplicable 
    ? workExecutedValue * contract.securedAdvanceMaxPct / 100 
    : 0;
  
  const grossToDate = workExecutedValue + approvedVariationValue + approvedExtraItemValue + 
                      unapprovedExtraItemValue + escalationAmount + securedAdvanceAmount;
  
  const grossPreviousBills = previousBills.reduce((sum, b) => sum + b.grossThisBill, 0);
  const grossThisBill = grossToDate - grossPreviousBills;
  
  // Step 4: Recoveries
  const cumulativeProgress = (grossToDate / contract.revisedValue) * 100;
  
  const mobilizationAdvanceRecovery = cumulativeProgress >= contract.recoveryStartPct
    ? Math.min(contract.revisedValue * contract.mobilizationAdvancePct / 100, 
               grossThisBill * contract.recoveryRatePct / 100)
    : 0;
  
  const retention = Math.min(
    grossThisBill * contract.retentionPct / 100,
    contract.revisedValue * contract.retentionCeilingPct / 100 - 
    previousBills.reduce((sum, b) => sum + b.retention, 0)
  );
  
  const liquidatedDamages = 0; // Only after EOT determination
  
  // Step 5: Statutory deductions
  const labourCess = grossThisBill * 0.01; // 1%
  const incomeTaxWithholding = grossThisBill * 0.02; // 2%
  
  // Step 6: Tax and net payable
  const taxableValue = grossThisBill; // GST on full value, not after retention
  const cgst = taxableValue * 0.09; // 9% CGST
  const sgst = taxableValue * 0.09; // 9% SGST
  
  const netPayable = grossThisBill + cgst + sgst - 
                     mobilizationAdvanceRecovery - retention - 
                     labourCess - incomeTaxWithholding;
  
  return {
    id: `BILL-${Date.now()}`,
    billNumber: `RA-${Date.now()}`,
    contractId: contract.id,
    period: new Date().toISOString().slice(0, 7),
    status: 'DRAFT',
    workExecutedValue,
    approvedVariationValue,
    approvedExtraItemValue,
    unapprovedExtraItemValue,
    partRateStageValue,
    escalationAmount,
    escalationComponents: [],
    securedAdvanceAmount,
    grossToDate,
    grossPreviousBills,
    grossThisBill,
    mobilizationAdvanceRecovery,
    mobilizationAdvanceInterest: 0,
    plantAdvanceRecovery: 0,
    securedAdvanceRecovery: 0,
    clientMaterialRecovery: 0,
    clientMaterialPenalRecovery: 0,
    retention,
    securityDeposit: 0,
    liquidatedDamages,
    otherRecoveries: 0,
    labourCess,
    incomeTaxWithholding,
    gstWithholding: 0,
    stateSpecificDeductions: 0,
    taxableValue,
    cgst,
    sgst,
    igst: 0,
    netPayable,
    submittedAmount: 0,
    certifiedAmount: 0,
    paidAmount: 0,
    certificationShortfalls: [],
  };
}

export function checkSubcontractorCompliance(suborder: SubcontractOrder): {
  compliant: boolean;
  reason?: string;
} {
  const today = new Date();
  
  if (new Date(suborder.labourLicenceValidTo) < today) {
    return {
      compliant: false,
      reason: `Labour licence expired on ${suborder.labourLicenceValidTo}`,
    };
  }
  
  if (!suborder.pfChallanFiled) {
    return {
      compliant: false,
      reason: 'PF challan not filed for covered period',
    };
  }
  
  if (!suborder.esiChallanFiled) {
    return {
      compliant: false,
      reason: 'ESI challan not filed for covered period',
    };
  }
  
  if (new Date(suborder.insuranceValidTo) < today) {
    return {
      compliant: false,
      reason: `Insurance expired on ${suborder.insuranceValidTo}`,
    };
  }
  
  return { compliant: true };
}

export function assembleClaimBundle(
  claim: Claim,
  dprs: any[],
  hindrances: any[],
  rfis: any[],
  correspondence: any[]
): Claim {
  const bundle: Array<{ type: string; ref: string; date: string }> = [];
  
  // Add DPRs from claim period
  dprs.forEach(dpr => {
    bundle.push({
      type: 'DPR',
      ref: dpr.id,
      date: dpr.date,
    });
  });
  
  // Add hindrance entries
  hindrances.forEach(h => {
    bundle.push({
      type: 'HINDRANCE',
      ref: h.id,
      date: h.dateFrom,
    });
  });
  
  // Add RFIs
  rfis.forEach(rfi => {
    bundle.push({
      type: 'RFI',
      ref: rfi.id,
      date: rfi.dateRaised,
    });
  });
  
  // Add correspondence
  correspondence.forEach(corr => {
    bundle.push({
      type: 'CORRESPONDENCE',
      ref: corr.id,
      date: corr.date,
    });
  });
  
  return {
    ...claim,
    supportingBundle: bundle,
  };
}
