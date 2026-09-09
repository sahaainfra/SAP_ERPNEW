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
  detail?: string;
}

// Additional types needed across the codebase
export type StockType = 'UNR' | 'QH' | 'BLK' | 'TRN' | 'SUB' | 'RET';
export type AuditCategory = 'CHANGE' | 'SECURITY' | 'SYSTEM' | 'POSTING' | 'CONFIG';
export type PartnerRole = 'VENDOR' | 'SUBCON' | 'CLIENT' | 'TRANSPORTER' | 'CONSULTANT';
export type SiteType = 'PROJECT_SITE' | 'CENTRAL_STORE' | 'WORKSHOP' | 'PRODUCTION_PLANT' | 'SUBCON_LOCATION';

export interface MovementType {
  code: string;
  desc: string;
  sign: 1 | -1;
  from: StockType | null;
  to: StockType | null;
  valRel: boolean;
  modifier: string;
  required: string[];
  drEvent: string | null;
  crEvent: string | null;
  reversal: string;
  authObject: string;
}

export interface ReleaseState {
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
    comment?: string;
    snapshot?: { total: number; at: string; by: string };
    slaHours?: number;
    slaDueAt?: string;
    escalated?: boolean;
  }>;
  indicator: 'BLOCKED' | 'PARTIALLY_RELEASED' | 'RELEASED' | 'REJECTED';
  resets?: number;
}

export interface Conversation {
  id: string;
  title: string;
  refType: string;
  refId: string;
  refNumber?: string;
  module: string;
  legalHold?: boolean;
  messages: ChatMsg[];
}

export interface ChatMsg {
  id: string;
  user: string;
  at: string;
  text: string;
  system?: boolean;
}

export interface Message {
  id: string;
  user: string;
  at: string;
  text: string;
  system?: boolean;
}

export interface Notification {
  id: string;
  eventKey: string;
  userId: string;
  at: string;
  read: boolean;
}

export interface Task {
  id: string;
  title: string;
  assignee: string;
  dueDate: string;
  status: string;
}

export interface ConversationType {
  type: string;
  name: string;
}

export interface MessageContentType {
  type: string;
  name: string;
}

export interface KpiDefinition {
  code: string;
  name: string;
  description: string;
  module: string;
  businessOwnerRole: string;
  measureExpression: string;
  dimensions: string[];
  defaultFilters: Record<string, any>;
  timeBasis: string;
  unit: string;
  decimals: number;
  scaling: string;
  displayFormat: string;
  targetSource: string;
  thresholdRules: Array<{ boundary: number; direction: string; status: string }>;
  trendBasis: string;
  trendPeriods: number;
  drillPath: string[];
  refreshPolicy: string;
  authorizationObject: string;
  cacheKeyDimensions: string[];
}

export interface TileConfig {
  id: string;
  type: string;
  title: string;
  group: string;
  kpiCode?: string;
  refreshPolicy: string;
  drillTarget: string;
  authorizationObject: string;
}

export interface TileValue {
  value: number | string;
  trend?: number;
  timestamp: string;
}

export type RagStatus = 'RED' | 'AMBER' | 'GREEN' | 'GREY';

export interface PeriodStatus {
  status: 'OPEN' | 'SOFT_CLOSED' | 'HARD_CLOSED';
}

export interface FactTable {
  name: string;
  description: string;
  columns: string[];
}

export interface Dimension {
  name: string;
  description: string;
}

export interface Measure {
  code: string;
  name: string;
  description: string;
}

export interface Report {
  id: string;
  name: string;
  description: string;
}

export interface Part10CState {
  kpiDefinitions: KpiDefinition[];
  tileConfigs: TileConfig[];
  tileValues: Record<string, TileValue>;
  profitForecasts: ProfitForecast[];
}

export interface ProfitForecast {
  id: string;
  projectCode: string;
  period: string;
  forecast: number;
}

export interface CustomField {
  id: string;
  name: string;
  type: string;
}

export interface ConfigurationTransport {
  id: string;
  name: string;
  config: any;
}

export interface Role {
  id: string;
  name: string;
  permissions: string[];
}

export interface ApprovalThreshold {
  role: string;
  amount: number;
}

export interface ApprovalMatrix {
  documentType: string;
  levels: ApprovalThreshold[];
}

export interface SoDConflict {
  role1: string;
  role2: string;
  description: string;
}

export interface StorageBin {
  id: string;
  code: string;
  name: string;
}

export interface PutAway {
  id: string;
  binId: string;
  materialCode: string;
  qty: number;
}

export interface RejectionNote {
  id: string;
  materialCode: string;
  reason: string;
}

export interface ValuationAdjustment {
  id: string;
  materialCode: string;
  adjustment: number;
}

export interface StockRecRun {
  id: string;
  date: string;
  lines: RecLine[];
}

export interface RecLine {
  materialCode: string;
  qty: number;
  value: number;
}

export interface MatReconDoc {
  id: string;
  materialCode: string;
  lines: MatReconLine[];
}

export interface MatReconLine {
  materialCode: string;
  qty: number;
  value: number;
}

export interface TareFlag {
  id: string;
  vehicleNo: string;
  tare: number;
}

export interface CountVarianceApproval {
  id: string;
  countId: string;
  approvedBy: string;
}

export interface SyncQueueItem {
  id: string;
  type: string;
  data: any;
}

export interface SyncState {
  lastSync: string;
  queue: SyncQueueItem[];
}

export interface MediaUpload {
  id: string;
  url: string;
  type: string;
}

export interface PortalToken {
  id: string;
  token: string;
  userId: string;
}

export interface PortalSession {
  id: string;
  portalId: string;
  userId: string;
}

export interface VendorPortalData {
  vendorId: string;
  orders: any[];
}

export interface SubconPortalData {
  subconId: string;
  orders: any[];
}

export interface ClientPortalData {
  clientId: string;
  projects: any[];
}

export interface MixDesign {
  id: string;
  code: string;
  grade: string;
}

export interface BatchTicket {
  id: string;
  mixDesignId: string;
  qty: number;
}

export interface ProductionOrder {
  id: string;
  mixDesignId: string;
  qty: number;
}

export interface Activity {
  id: string;
  name: string;
  duration: number;
}

export interface PsBoq {
  id: string;
  code: string;
  description: string;
}

export interface PsMeasurement {
  id: string;
  boqId: string;
  qty: number;
}

export interface DailyReport {
  id: string;
  date: string;
  content: string;
}

export interface HindranceReg {
  id: string;
  description: string;
  date: string;
}

export interface SiteInstruction {
  id: string;
  instruction: string;
  date: string;
}

export interface Rfi {
  id: string;
  question: string;
  date: string;
}

export interface CostForecast {
  id: string;
  wbs: string;
  forecast: number;
}

export interface RaPosting {
  id: string;
  wbs: string;
  amount: number;
}

export interface PsWbs {
  id: string;
  code: string;
  name: string;
}

export interface Equipment {
  id: string;
  code: string;
  name: string;
}

export interface EquipmentLog {
  id: string;
  equipmentId: string;
  date: string;
  hours: number;
}

export interface MaintOrder {
  id: string;
  equipmentId: string;
  description: string;
}

export interface PermitToWork {
  id: string;
  type: string;
  description: string;
}

export type PermitType = 'HOT_WORK' | 'CONFINED_SPACE' | 'HEIGHT';
export type IncidentSeverity = 'MINOR' | 'MAJOR' | 'CRITICAL';

export interface Incident {
  id: string;
  severity: IncidentSeverity;
  description: string;
}

export interface InspectionLot {
  id: string;
  materialCode: string;
  status: string;
}

export interface TestResult {
  id: string;
  lotId: string;
  result: string;
}

export interface Ncr {
  id: string;
  lotId: string;
  description: string;
}

export interface SubcontractOrder {
  id: string;
  vendorId: string;
  amount: number;
}

export interface WbsNode {
  code: string;
  name: string;
}

export interface RaRunRecord {
  id: string;
  wbs: string;
  amount: number;
}

export interface ContractMaster {
  id: string;
  code: string;
  value: number;
}

export interface BoqItem {
  id: string;
  code: string;
  description: string;
}

export interface RateAnalysis {
  id: string;
  code: string;
  rate: number;
}

export interface HindranceEvent {
  id: string;
  description: string;
  date: string;
}

export interface Claim {
  id: string;
  description: string;
  amount: number;
}

export interface RateComponent {
  id: string;
  description: string;
  rate: number;
}

export interface UomDef {
  code: string;
  name: string;
}

export interface UomFactor {
  from: string;
  to: string;
  factor: number;
}

export interface Geofence {
  id: string;
  name: string;
  coordinates: number[];
}

export interface ProjectTemplate {
  id: string;
  name: string;
  template: any;
}

export interface BankGuarantee {
  id: string;
  number: string;
  amount: number;
}

export interface InsurancePolicy {
  id: string;
  policyNumber: string;
  amount: number;
}

export interface Dispute {
  id: string;
  description: string;
  amount: number;
}

export interface ComplianceTask {
  id: string;
  task: string;
  dueDate: string;
}

export interface MinWage {
  id: string;
  state: string;
  wage: number;
}

export interface AssetMaster {
  id: string;
  code: string;
  value: number;
}

export interface VendorInvoiceCheck {
  id: string;
  invoiceId: string;
  status: string;
}

export interface PaymentProposal {
  id: string;
  amount: number;
  status: string;
}

export interface PaymentProposalLine {
  id: string;
  proposalId: string;
  amount: number;
}

export interface BankStatementLine {
  id: string;
  date: string;
  amount: number;
}

export interface ItcEntry {
  id: string;
  vendorId: string;
  amount: number;
}

export interface CessEntry {
  id: string;
  projectCode: string;
  amount: number;
}

export interface CloseoutItem {
  id: string;
  task: string;
  status: string;
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
  
  // Part 9 - Communication
  conversations: Conversation[];
  messages: Message[];
  notifications: Notification[];
  tasks: Task[];
  
  // Part 9 - Tools
  toolLibrary: {
    pdfEngine: any;
    importEngine: any;
    barcodeEngine: any;
    ocrEngine: any;
    formulaEngine: any;
    uomEngine: any;
    geofenceEngine: any;
    photoEngine: any;
    schedulingEngine: any;
    searchEngine: any;
    bankFileEngine: any;
    notificationEngine: any;
    reportBuilder: any;
    dashboardEngine: any;
    workflowBuilder: any;
    duplicateEngine: any;
    auditViewer: any;
    backupEngine: any;
    translationEngine: any;
    integrationFramework: any;
  };
  
  // Part 10C
  kpiDefinitions: KpiDefinition[];
  tileConfigs: TileConfig[];
  tileValues: Record<string, TileValue>;
  profitForecasts: ProfitForecast[];
  
  // Additional state properties needed
  periods?: any;
  closing?: any;
  freeze?: any;
  changes?: any;
  budgets?: any;
  physicalProgress?: any;
  measurements?: any;
  raBills?: any;
  suborders?: SubcontractOrder[];
  wbsElements?: any;
  psActivities?: any;
  psBoq?: any;
  psMeasurements?: any;
  bins?: any;
  equipment?: Equipment[];
  eqLogs?: any;
  maintOrders?: any;
  exceptions?: any;
  counts?: any;
  putaways?: any;
  rejectionNotes?: any;
  valuationAdjustments?: any;
  tareFlags?: any;
  weighTickets?: any;
  reservations?: any;
  varianceApprovals?: any;
  matRecons?: any;
  stockRecRuns?: any;
  roles?: any;
  approvalMatrix?: any;
  sodConflicts?: any;
  mobileDevices?: any;
  syncQueues?: any;
  mediaUploads?: any;
  portalTokens?: any;
  portalSessions?: any;
  itc?: any;
  cess?: any;
  guarantees?: any;
  disputes?: any;
  closeout?: any;
  minWages?: any;
  equipment?: any;
  suborders?: any;
}
