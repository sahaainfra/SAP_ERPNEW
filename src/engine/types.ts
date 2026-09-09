// Complete ERP Type System - Parts 1-4 Foundation

// ===== Part 1: Platform Foundation =====
export type ModuleCode = 'PLT' | 'ORG' | 'FIN' | 'CTL' | 'PRC' | 'INV' | 'PRJ' | 'CTR' | 'BIL' | 'SUB' | 'EAM' | 'PRD' | 'QMS' | 'HCM' | 'EHS' | 'DMS' | 'BID' | 'CMP' | 'ANA' | 'EXT';

export type DocStatus = 'DRAFT' | 'SUBMITTED' | 'PENDING_RELEASE' | 'PARTIALLY_RELEASED' | 'RELEASED' | 'POSTED' | 'REJECTED' | 'CANCELLED' | 'REVERSED';

export type MasterStatus = 'DRAFT' | 'PENDING' | 'PENDING_REVIEW' | 'PENDING_APPROVAL' | 'ACTIVE' | 'BLOCKED' | 'MARKED_FOR_DELETION';

export type ItemCategory = 'STD' | 'CNS' | 'SVC' | 'SUB' | 'CNG' | 'LIM' | 'TXT' | 'FOC';

export type ITCClass = 'ELIGIBLE' | 'BLOCKED_IMMOVABLE' | 'CAPITAL_GOODS' | 'INELIGIBLE';

export interface Company {
  code: string;
  name: string;
  cin: string;
  pan: string;
  controllingArea: string;
  coa: string;
  currency: 'INR';
  fyVariant: string;
  hqState: string;
}

export interface TaxRegistrationUnit {
  code: string;
  companyId: string;
  gstin: string;
  state: string;
  stateName: string;
}

export interface OperatingSite {
  code: string;
  name: string;
  type: 'PROJECT_SITE' | 'CENTRAL_STORE' | 'WORKSHOP' | 'PRODUCTION_PLANT' | 'SUBCON_LOCATION';
  companyId: string;
  truId: string;
  state: string;
  city: string;
}

export interface Material {
  code: string;
  desc: string;
  spec: string;
  group: string;
  accountGroup: string;
  baseUom: string;
  hsn: string;
  valuationClass: string;
  priceControl: 'MAP' | 'STD';
  price: number;
  views: string[];
  status: MasterStatus;
  itc: ITCClass;
  royalty?: boolean;
  coefficient?: number;
  wastagePct?: number;
  reorderLevel?: number;
}

export interface Partner {
  id: string;
  name: string;
  legalName: string;
  roles: string[];
  accountGroup: string;
  pan: string;
  gstin: string;
  state: string;
  reconAccount: string;
  bank: { bankName: string; acct: string; ifsc: string };
  msme: boolean;
  rating: number;
  status: MasterStatus;
  blacklist?: { flag: boolean; reason?: string };
  labourLicence?: { no: string; validTo: string };
  ldc?: { certNo: string; rate: number; limit: number; consumed: number; validTo: string };
}

export interface DocItem {
  lineNo: number;
  materialCode?: string;
  desc: string;
  qty: number;
  uom: string;
  rate: number;
  amount: number;
  category: ItemCategory;
  wbs?: string;
  costCode?: string;
  taxCode: string;
  itc: ITCClass;
  received?: number;
  invoiced?: number;
}

export interface Doc {
  id: string;
  number?: string;
  type: string;
  module: ModuleCode;
  companyId: string;
  siteId: string;
  partnerId?: string;
  dateISO: string;
  postingDate: string;
  total: number;
  status: DocStatus;
  items: DocItem[];
  createdBy: string;
  release?: {
    groupId: string;
    strategyId: string;
    strategyName: string;
    steps: Array<{
      code: string;
      title: string;
      role: string;
      valueLimit: number;
      status: 'PENDING' | 'APPROVED' | 'REJECTED';
      by?: string;
      at?: string;
    }>;
    indicator: 'BLOCKED' | 'PARTIALLY_RELEASED' | 'RELEASED' | 'REJECTED';
  };
  price?: PriceResult;
  conversationId?: string;
}

export interface PriceResult {
  steps: PriceStep[];
  baseValue: number;
  netValue: number;
  landedValue: number;
  taxValue: number;
  grossValue: number;
  tds: number;
  rounding: number;
  netPayable: number;
  taxKind: 'CGST+SGST' | 'IGST' | 'UTGS' | 'NONE';
  taxPct: number;
  itcBlocked: boolean;
}

export interface PriceStep {
  step: number;
  cond: string;
  desc: string;
  value: number;
  base?: string;
  source?: string;
}

export interface JournalLine {
  account: string;
  dr: number;
  cr: number;
  text: string;
  wbs?: string;
  cc?: string;
  partnerId?: string;
  materialCode?: string;
}

export interface Journal {
  id: string;
  number: string;
  companyId: string;
  dateISO: string;
  lines: JournalLine[];
  refId: string;
  refNumber: string;
  status: 'POSTED' | 'REVERSED';
  createdBy: string;
}

export interface StockRow {
  materialCode: string;
  siteId: string;
  locId: string;
  qty: number;
  value: number;
  batch?: string;
  vtype?: string;
}

export interface FlowLink {
  from: string;
  to: string;
  qty: number;
  value: number;
}

export interface AuditEntry {
  id: string;
  userId: string;
  category: string;
  action: string;
  object: string;
  objectId: string;
  field?: string;
  oldV?: string;
  newV?: string;
  reason?: string;
  at: string;
}

export interface Res {
  s: ERPState;
  ok: boolean;
  msg: string;
  tone: 'ok' | 'bad' | 'warn' | 'info';
  docId?: string;
}

// ===== Part 4: Procurement =====
export interface PurchasingInfoRecord {
  id: string;
  vendorId: string;
  materialCode: string;
  purchasingOrg: string;
  siteId: string;
  lastPrice: number;
  lastPriceDate: string;
  lastOrderRef?: string;
  effectivePrice: number;
  plannedDeliveryDays: number;
  actualDeliveryDays: number;
  minOrderQty: number;
  orderUom: string;
  underTolerancePct: number;
  overTolerancePct: number;
  grBasedIV: boolean;
  priceHistory: Array<{ date: string; orderRef: string; qty: number; rate: number; landedRate: number }>;
  qualityHistory: { receipts: number; rejections: number; rejectionPct: number };
}

export interface SourceListItem {
  id: string;
  materialCode: string;
  siteId: string;
  vendorId: string;
  validFrom: string;
  validTo: string;
  fixed: boolean;
  blocked: boolean;
}

export interface QuotaArrangement {
  id: string;
  materialCode: string;
  siteId: string;
  allocations: Array<{ vendorId: string; pct: number }>;
  allocated: Record<string, number>;
}

export interface RateContract {
  id: string;
  number: string;
  vendorId: string;
  materialCode: string;
  siteId: string;
  rate: number;
  capQty: number;
  releasedQty: number;
  validFrom: string;
  validTo: string;
  status: 'ACTIVE' | 'EXPIRED' | 'EXHAUSTED';
}

export interface Rfq {
  id: string;
  number: string;
  materialCode: string;
  qty: number;
  siteId: string;
  wbs?: string;
  vendors: string[];
  deadline: string;
  sealed: boolean;
  status: 'DRAFT' | 'ISSUED' | 'OPENED' | 'CLOSED';
  quotations: Quotation[];
}

export interface Quotation {
  id: string;
  rfqId: string;
  vendorId: string;
  rate: number;
  discPct: number;
  freightPerUnit: number;
  leadDays: number;
  paymentDays: number;
  validUntil: string;
  submittedAt: string;
  sealed: boolean;
  openedAt?: string;
  openedBy?: string[];
}

export interface ComparativeStatement {
  rfqId: string;
  vendors: Array<{
    vendorId: string;
    basicValue: number;
    discount: number;
    netValue: number;
    freight: number;
    leadLift: number;
    loading: number;
    royalty: number;
    landedValue: number;
    taxValue: number;
    invoiceValue: number;
    creditableTax: number;
    effectiveCost: number;
    paymentTermAdj: number;
    comparableCost: number;
    rank: number;
    onTimePct: number;
    rejectionPct: number;
    msme: boolean;
    gstFilingStatus: string;
    blacklist: boolean;
  }>;
  lowestVendorId: string;
  selectedVendorId?: string;
  justification?: string;
}

export interface MineralTransitPermit {
  id: string;
  number: string;
  sourceQuarry: string;
  leaseNo: string;
  leaseValidTo: string;
  royaltyRate: number;
  royaltyBorneBy: 'CONTRACTOR' | 'VENDOR';
  permitNo: string;
  permitValidTo: string;
  permittedQty: number;
  vehicleNo: string;
  issuingAuthority: string;
}

export interface VendorEvaluation {
  vendorId: string;
  period: string;
  priceScore: number;
  deliveryScore: number;
  qualityScore: number;
  complianceScore: number;
  serviceScore: number;
  overallScore: number;
  status: 'PREFERRED' | 'APPROVED' | 'CONDITIONAL' | 'WATCHLIST' | 'BLACKLISTED';
}

// ===== ERP State =====
export interface ERPState {
  v: number;
  today: string;
  userId: string;
  companyFilter: string;
  
  // Part 1
  companies: Company[];
  taxUnits: TaxRegistrationUnit[];
  sites: OperatingSite[];
  materials: Material[];
  partners: Partner[];
  docs: Doc[];
  journals: Journal[];
  stock: StockRow[];
  flow: FlowLink[];
  audit: AuditEntry[];
  seq: Record<string, number>;
  authFailCount: number;
  
  // Part 4
  infoRecords: PurchasingInfoRecord[];
  sourceList: SourceListItem[];
  quotas: QuotaArrangement[];
  rateContracts: RateContract[];
  rfqs: Rfq[];
  comparativeStatements: ComparativeStatement[];
  transitPermits: MineralTransitPermit[];
  vendorEvaluations: VendorEvaluation[];
}
