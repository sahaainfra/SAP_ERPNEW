// Part 7 Types - Finance, Controlling, Taxation, Statutory Compliance, Legal & Instruments

// ==================== FIN - Financial Accounting ====================

// General Ledger
export interface JournalEntry {
  id: string;
  number: string;
  date: string;
  postingDate: string;
  companyId: string;
  fiscalYear: string;
  period: number;
  documentType: string;
  reference?: string;
  narration: string;
  lines: JournalLine[];
  status: 'DRAFT' | 'POSTED' | 'REVERSED';
  reversedBy?: string;
  createdBy: string;
  createdAt: string;
  attachmentCount: number;
}

export interface JournalLine {
  id: string;
  accountCode: string;
  debit: number;
  credit: number;
  costCenter?: string;
  profitCenter?: string;
  project?: string;
  wbs?: string;
  partner?: string;
  taxCode?: string;
  narration: string;
  // Document splitting dimensions
  segment?: string;
  businessUnit?: string;
}

// Accounts Payable
export interface VendorInvoice {
  id: string;
  number: string;
  vendorId: string;
  date: string;
  postingDate: string;
  companyId: string;
  poId?: string;
  grId?: string;
  items: InvoiceItem[];
  totalAmount: number;
  taxAmount: number;
  tdsAmount: number;
  netPayable: number;
  status: 'DRAFT' | 'SUBMITTED' | 'VERIFIED' | 'BLOCKED' | 'POSTED' | 'PAID';
  blocks: InvoiceBlock[];
  createdBy: string;
  createdAt: string;
}

export interface InvoiceItem {
  id: string;
  materialCode?: string;
  description: string;
  quantity: number;
  rate: number;
  amount: number;
  taxCode: string;
  hsnCode: string;
  poQuantity?: number;
  grQuantity?: number;
}

export interface InvoiceBlock {
  id: string;
  type: 'QUANTITY_VARIANCE' | 'PRICE_VARIANCE' | 'TAX_VARIANCE' | 'HSN_MISMATCH' | 'DUPLICATE' | 'NO_GR' | 'EXCEEDS_ORDER' | 'SHORT_CLOSED' | 'VENDOR_BLOCKED' | 'BANK_COOLING';
  description: string;
  severity: 'ERROR' | 'WARNING';
  resolved: boolean;
  resolvedBy?: string;
  resolvedAt?: string;
  reason?: string;
}

export interface PaymentProposal {
  id: string;
  number: string;
  date: string;
  companyId: string;
  invoices: string[];
  totalAmount: number;
  priority: 'STATUTORY' | 'MSME' | 'CRITICAL' | 'NORMAL';
  status: 'DRAFT' | 'APPROVED' | 'RELEASED' | 'EXPORTED' | 'PAID';
  bankFileId?: string;
  createdBy: string;
  approvedBy?: string;
  releasedBy?: string;
  createdAt: string;
}

export interface BankFile {
  id: string;
  number: string;
  bankCode: string;
  format: string;
  totalAmount: number;
  transactionCount: number;
  checksum: string;
  status: 'GENERATED' | 'EXPORTED' | 'PROCESSED';
  exportedAt?: string;
  exportedBy?: string;
}

// Accounts Receivable
export interface CustomerBill {
  id: string;
  number: string;
  customerId: string;
  date: string;
  companyId: string;
  projectId: string;
  billType: 'RA_INTERIM' | 'RA_FINAL' | 'OTHER';
  submittedAmount: number;
  certifiedAmount: number;
  paidAmount: number;
  retentionAmount: number;
  status: 'SUBMITTED' | 'CERTIFIED' | 'PARTIALLY_PAID' | 'PAID';
  aging: AgingBucket[];
}

export interface AgingBucket {
  days: string;
  amount: number;
}

export interface CustomerPayment {
  id: string;
  number: string;
  customerId: string;
  date: string;
  amount: number;
  bills: PaymentClearing[];
  status: 'POSTED' | 'REVERSED';
}

export interface PaymentClearing {
  billId: string;
  amount: number;
  discount?: number;
}

// Banking & Treasury
export interface BankAccount {
  id: string;
  code: string;
  bankName: string;
  branchName: string;
  accountNumber: string;
  ifscCode: string;
  accountType: 'CURRENT' | 'SAVINGS' | 'CC' | 'OD';
  companyId: string;
  balance: number;
  sanctionedLimit?: number;
  drawingPower?: number;
}

export interface BankStatement {
  id: string;
  accountId: string;
  date: string;
  entries: BankStatementEntry[];
  importedAt: string;
  importedBy: string;
}

export interface BankStatementEntry {
  id: string;
  date: string;
  reference: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
  matchedInvoiceId?: string;
  matchStatus: 'MATCHED' | 'UNMATCHED' | 'MANUAL';
}

export interface CashFlowForecast {
  id: string;
  companyId: string;
  startDate: string;
  endDate: string;
  weeks: CashFlowWeek[];
  createdAt: string;
}

export interface CashFlowWeek {
  weekNumber: number;
  startDate: string;
  endDate: string;
  inflows: number;
  outflows: number;
  netFlow: number;
  closingBalance: number;
}

// Asset Accounting
export interface FixedAsset {
  id: string;
  code: string;
  description: string;
  assetClass: string;
  companyId: string;
  location?: string;
  project?: string;
  custodian?: string;
  equipmentId?: string;
  acquisitionDate: string;
  acquisitionValue: number;
  usefulLifeYears: number;
  salvageValue: number;
  depreciationMethod: 'SLM' | 'WDV';
  status: 'ACTIVE' | 'DISPOSED' | 'FULLY_DEPRECIATED';
  depreciationAreas: DepreciationArea[];
}

export interface DepreciationArea {
  area: 'COMPANY_LAW' | 'TAX_LAW';
  rate: number;
  method: 'SLM' | 'WDV';
  accumulatedDepreciation: number;
  netBookValue: number;
  lastDepreciationDate: string;
}

export interface DepreciationRun {
  id: string;
  date: string;
  period: string;
  companyId: string;
  assets: AssetDepreciation[];
  totalDepreciation: number;
  status: 'SIMULATED' | 'POSTED';
  postedBy?: string;
  postedAt?: string;
}

export interface AssetDepreciation {
  assetId: string;
  area: 'COMPANY_LAW' | 'TAX_LAW';
  depreciation: number;
  accumulatedDepreciation: number;
  netBookValue: number;
}

// Period Close
export interface ClosingCockpit {
  id: string;
  companyId: string;
  fiscalYear: string;
  period: number;
  steps: ClosingStep[];
  status: 'OPEN' | 'IN_PROGRESS' | 'SOFT_CLOSED' | 'HARD_CLOSED';
  closedAt?: string;
  closedBy?: string;
}

export interface ClosingStep {
  id: string;
  sequence: number;
  task: string;
  owner: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'BLOCKED';
  completedAt?: string;
  completedBy?: string;
  notes?: string;
  blocking?: boolean;
}

// ==================== CTL - Controlling ====================

export interface CostCenter {
  id: string;
  code: string;
  name: string;
  companyId: string;
  category: 'PRODUCTION' | 'ADMIN' | 'SALES' | 'OVERHEAD';
  responsible: string;
  status: 'ACTIVE' | 'LOCKED';
}

export interface CostCenterActual {
  id: string;
  costCenterId: string;
  period: string;
  costCode: string;
  amount: number;
  journalEntryId: string;
}

export interface OverheadAllocation {
  id: string;
  name: string;
  senderCostCenter: string;
  receiverCostCenters: AllocationReceiver[];
  driver: 'DIRECT_COST' | 'MAN_HOURS' | 'REVENUE' | 'QUANTITY';
  driverValues: Record<string, number>;
  period: string;
  status: 'PLANNED' | 'POSTED' | 'REVERSED';
}

export interface AllocationReceiver {
  costCenterId: string;
  percentage: number;
  amount: number;
}

export interface ProfitabilityAnalysis {
  id: string;
  companyId: string;
  period: string;
  segments: ProfitabilitySegment[];
}

export interface ProfitabilitySegment {
  project?: string;
  client?: string;
  businessUnit?: string;
  contractType?: string;
  region?: string;
  revenue: number;
  cost: number;
  margin: number;
  marginPercent: number;
}

// ==================== CMP - Taxation, Statutory, Legal ====================

// Indirect Tax
export interface TaxInvoice {
  id: string;
  number: string;
  date: string;
  customerId: string;
  companyId: string;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalTax: number;
  totalAmount: number;
  placeOfSupply: string;
  irn?: string;
  qrCode?: string;
  status: 'DRAFT' | 'GENERATED' | 'CANCELLED';
  cancelledAt?: string;
  cancellationReason?: string;
}

export interface InputTaxCredit {
  id: string;
  period: string;
  vendorId: string;
  invoiceId: string;
  taxableValue: number;
  igst: number;
  cgst: number;
  sgst: number;
  eligibility: 'ELIGIBLE' | 'INELIGIBLE' | 'BLOCKED';
  blockReason?: string;
  matchedInStatement: boolean;
}

export interface GSTRReturn {
  id: string;
  formType: 'GSTR-1' | 'GSTR-3B' | 'GSTR-2A';
  period: string;
  companyId: string;
  status: 'DRAFT' | 'FILED' | 'ACKNOWLEDGED';
  filedAt?: string;
  acknowledgementNumber?: string;
}

// Withholding Tax
export interface TDSRecord {
  id: string;
  section: string;
  vendorId: string;
  invoiceId: string;
  date: string;
  taxableAmount: number;
  rate: number;
  tdsAmount: number;
  certificateNumber?: string;
  deposited: boolean;
  depositedAt?: string;
  challanNumber?: string;
}

export interface LowerDeductionCertificate {
  id: string;
  certificateNumber: string;
  vendorId: string;
  section: string;
  validFrom: string;
  validTo: string;
  lowerRate: number;
  limit: number;
  consumed: number;
  status: 'ACTIVE' | 'EXPIRED' | 'LIMIT_EXHAUSTED';
}

// Statutory Compliance
export interface LabourLicence {
  id: string;
  number: string;
  contractorId: string;
  projectId: string;
  validFrom: string;
  validTo: string;
  sanctionedStrength: number;
  deployedStrength: number;
  status: 'VALID' | 'EXPIRING' | 'EXPIRED' | 'OVER_STRENGTH';
}

export interface PFRecord {
  id: string;
  employeeId: string;
  period: string;
  basicWage: number;
  da: number;
  employeeContribution: number;
  employerContribution: number;
  totalContribution: number;
  deposited: boolean;
  challanNumber?: string;
}

export interface ESIRecord {
  id: string;
  employeeId: string;
  period: string;
  grossWage: number;
  employeeContribution: number;
  employerContribution: number;
  totalContribution: number;
  deposited: boolean;
  challanNumber?: string;
}

export interface MinimumWage {
  id: string;
  state: string;
  zone: string;
  skillLevel: 'UNSKILLED' | 'SEMI_SKILLED' | 'SKILLED' | 'HIGHLY_SKILLED';
  dailyRate: number;
  effectiveFrom: string;
  notificationNumber: string;
}

export interface ComplianceObligation {
  id: string;
  name: string;
  type: string;
  state: string;
  frequency: 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY' | 'ONE_TIME';
  dueDate: string;
  owner: string;
  status: 'PENDING' | 'COMPLETED' | 'OVERDUE';
  evidence?: string;
}

// Financial Instruments
export interface BankGuarantee {
  id: string;
  number: string;
  type: 'EARNEST_MONEY' | 'PERFORMANCE' | 'ADVANCE' | 'RETENTION' | 'MOBILIZATION' | 'CUSTOM';
  bankName: string;
  branchName: string;
  beneficiary: string;
  contractId?: string;
  projectId?: string;
  amount: number;
  currency: string;
  marginBlocked: number;
  commissionRate: number;
  commissionPaid: number;
  issueDate: string;
  expiryDate: string;
  claimPeriodEnd: string;
  autoRenew: boolean;
  status: 'ACTIVE' | 'EXPIRING' | 'EXPIRED' | 'RELEASED' | 'INVOKED';
  extensionHistory: BGExtension[];
}

export interface BGExtension {
  id: string;
  extendedTo: string;
  extendedAt: string;
  extendedBy: string;
  reason: string;
}

export interface InsurancePolicy {
  id: string;
  type: 'CAR' | 'WC' | 'TPL' | 'MARINE' | 'PLANT' | 'VEHICLE' | 'PI' | 'GROUP_MEDICAL';
  policyNumber: string;
  insurer: string;
  insuredAmount: number;
  premium: number;
  deductible: number;
  projectId?: string;
  validFrom: string;
  validTo: string;
  status: 'ACTIVE' | 'EXPIRING' | 'EXPIRED' | 'CLAIMED';
  claims: InsuranceClaim[];
}

export interface InsuranceClaim {
  id: string;
  claimNumber: string;
  incidentId: string;
  date: string;
  claimedAmount: number;
  settledAmount: number;
  status: 'FILED' | 'UNDER_PROCESS' | 'SETTLED' | 'REJECTED';
}

// Legal & Disputes
export interface LegalCase {
  id: string;
  caseNumber: string;
  forum: 'FACILITATION_COUNCIL' | 'ARBITRATION' | 'COMMERCIAL_COURT' | 'HIGH_COURT' | 'CONSUMER_FORUM' | 'TRIBUNAL';
  title: string;
  oppositeParty: string;
  subjectMatter: string;
  linkedContract?: string;
  linkedBill?: string;
  claimAmount: number;
  interestClaimed: number;
  reliefSought: string;
  counterClaimAmount?: number;
  filingDate: string;
  limitationDate: string;
  status: 'PRE_LITIGATION' | 'FILED' | 'PLEADINGS' | 'EVIDENCE' | 'ARGUMENTS' | 'RESERVED' | 'DISPOSED' | 'UNDER_EXECUTION' | 'SETTLED';
  hearingDiary: HearingEntry[];
  counsel: string;
  lawFirm: string;
  feeArrangement: string;
  litigationCost: number;
  documentBundle: string[];
  award?: string;
  executionStatus?: string;
  recoveryStatus?: string;
  contingentLiability: number;
}

export interface HearingEntry {
  id: string;
  date: string;
  purpose: string;
  outcome: string;
  nextDate?: string;
}

// ==================== ERPState Extension ====================

export interface Part7State {
  // Finance
  journalEntries: JournalEntry[];
  vendorInvoices: VendorInvoice[];
  paymentProposals: PaymentProposal[];
  bankFiles: BankFile[];
  customerBills: CustomerBill[];
  customerPayments: CustomerPayment[];
  bankAccounts: BankAccount[];
  bankStatements: BankStatement[];
  cashFlowForecasts: CashFlowForecast[];
  fixedAssets: FixedAsset[];
  depreciationRuns: DepreciationRun[];
  closingCockpits: ClosingCockpit[];

  // Controlling
  costCenters: CostCenter[];
  costCenterActuals: CostCenterActual[];
  overheadAllocations: OverheadAllocation[];
  profitabilityAnalyses: ProfitabilityAnalysis[];

  // Taxation
  taxInvoices: TaxInvoice[];
  inputTaxCredits: InputTaxCredit[];
  gstrReturns: GSTRReturn[];
  tdsRecords: TDSRecord[];
  lowerDeductionCertificates: LowerDeductionCertificate[];

  // Statutory
  labourLicences: LabourLicence[];
  pfRecords: PFRecord[];
  esiRecords: ESIRecord[];
  minimumWages: MinimumWage[];
  complianceObligations: ComplianceObligation[];

  // Financial Instruments
  bankGuarantees: BankGuarantee[];
  insurancePolicies: InsurancePolicy[];

  // Legal
  legalCases: LegalCase[];
}
