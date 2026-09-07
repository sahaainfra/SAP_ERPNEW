/* ------------------------------------------------------------------ */
/* VULCAN ERP — platform core domain model (original implementation)   */
/* ------------------------------------------------------------------ */

export type ModuleCode =
  | 'PLT' | 'ORG' | 'FIN' | 'CTL' | 'PRC' | 'INV' | 'PRJ' | 'CTR' | 'BIL' | 'SUB'
  | 'EAM' | 'PRD' | 'QMS' | 'HCM' | 'EHS' | 'DMS' | 'BID' | 'CMP' | 'ANA' | 'EXT';

export type StockType = 'UNR' | 'QH' | 'BLK' | 'TRN' | 'SUB' | 'RET';
export type StockTypeName = 'Unrestricted' | 'Quality Hold' | 'Blocked' | 'Transit' | 'At Subcontractor' | 'Returnable';

export type MasterStatus =
  | 'DRAFT' | 'PENDING' | 'PENDING_REVIEW' | 'PENDING_APPROVAL'
  | 'ACTIVE' | 'BLOCKED' | 'MARKED_FOR_DELETION';
export type DocStatus =
  | 'DRAFT' | 'SUBMITTED' | 'PENDING_RELEASE' | 'PARTIALLY_RELEASED' | 'RELEASED'
  | 'POSTED' | 'REJECTED' | 'CANCELLED' | 'REVERSED' | 'CONVERTED';

export type ITCClass = 'ELIGIBLE' | 'BLOCKED_IMMOVABLE' | 'CAPITAL_GOODS' | 'INELIGIBLE';
export type ItemCategory = 'STD' | 'CNS' | 'SVC' | 'SUB' | 'CNG' | 'LIM' | 'TXT' | 'FOC';

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

export interface StorageLocation {
  code: string;
  name: string;
  stockTypes: StockType[];
}

export type SiteType = 'PROJECT_SITE' | 'CENTRAL_STORE' | 'WORKSHOP' | 'PRODUCTION_PLANT' | 'SUBCON_LOCATION';

export interface OperatingSite {
  code: string;
  name: string;
  type: SiteType;
  companyId: string;
  truId: string;
  state: string;
  city: string;
  distanceKm: number;
  storageLocs: StorageLocation[];
}

export interface WbsElement { code: string; name: string; }

export interface ProjectDef {
  code: string;
  name: string;
  companyId: string;
  siteCode: string;
  budget: number;
  wbs: { code: string; name: string }[];
}

export interface CostCentre { code: string; name: string; companyId: string; group: string; }

export interface GLAccount {
  code: string;
  name: string;
  group: 'ASSET' | 'LIABILITY' | 'EXPENSE' | 'REVENUE';
  control?: 'STOCK' | 'GRIR' | 'VENDOR' | 'CUSTOMER' | 'TAX';
  special?: string; // special G/L indicator A/M/R/S/E/G/D
  noted?: boolean;   // noted item — off balance sheet
}

export interface Material {
  code: string;
  desc: string;
  spec: string;
  group: string;          // material group
  accountGroup: string;   // RAWM / CONS / SPAR / FUEL / ASST / SERV / SEMI / SCRP
  baseUom: string;
  altUom?: string;
  conv?: number;
  hsn: string;
  valuationClass: string;
  priceControl: 'MAP' | 'STD';
  price: number;          // moving average price
  views: string[];        // completed view segments
  status: MasterStatus;
  itc: ITCClass;
  royalty?: boolean;
  createdBy: string;
  /* ---- Part 2 MDM ---- */
  structuredName?: { noun: string; modifier?: string; size?: string; grade?: string; make?: string };
  densityT?: number;            // t/m³ — enables mass↔volume
  sectionalWeightKg?: number;   // steel kg per running metre (stored per diameter)
  coefficient?: number;         // theoretical consumption per unit of executed work
  coefficientBasis?: string;    // e.g. "bags per m³ M25"
  wastagePct?: number;          // norm-based permitted wastage
  budgetRate?: number;          // rate used in project budgets
  reorderLevel?: number;
  safetyStock?: number;
  mrpType?: 'MANUAL' | 'REORDER' | 'PROJECT';
  cycleClass?: 'A' | 'B' | 'C';
  batchManaged?: boolean;
  sourceControlled?: boolean;
  inspectionRequired?: boolean;
  substitutes?: string[];       // approved alternate material codes
  splitValuation?: string;      // valuation category (domestic/imported, client-issued/purchased...)
  version?: number;             // optimistic locking
}

export type PartnerRole = 'VENDOR' | 'SUBCON' | 'CLIENT' | 'TRANSPORTER' | 'CONSULTANT';

export interface Partner {
  id: string;
  name: string;
  legalName: string;
  roles: PartnerRole[];
  accountGroup: string;
  pan: string;
  gstin: { state: string; no: string }[];
  regType: 'REGULAR' | 'COMPOSITION' | 'UNREGISTERED';
  state: string;
  stateName: string;
  tdsSection: string;
  tdsPct: number;
  reconAccount: string;
  bank: { bankName: string; acct: string; ifsc: string };
  msme: boolean;
  rating: number; // 0..100
  status: MasterStatus;
  createdBy: string;
  /* ---- Part 2 MDM ---- */
  blacklist?: { flag: boolean; reason?: string; raisedBy?: string; at?: string };
  labourLicence?: { no: string; validTo: string; strength: number };
  ldc?: { certNo: string; rate: number; limit: number; consumed: number; validTo: string };
  version?: number; // optimistic locking
}

export interface InfoRecord {
  vendorId: string;
  materialCode: string;
  rate: number;
  validFrom: string;
  validTo?: string;
}

export interface ConditionRecord {
  condType: string;
  key: string;        // e.g. "VENDOR|MAT" , "MATGROUP|STATE"
  rate: number;
  per: 'PCT' | 'UNIT' | 'ABS';
  validFrom: string;
  validTo?: string;
}

export interface TaxCode {
  code: string;
  hsnPrefix: string;
  desc: string;
  ratePct: number;
  validFrom: string;
  validTo?: string;
}

export interface DocumentType {
  code: string;
  module: ModuleCode;
  desc: string;
  numberRange: string;
  itemCategories: ItemCategory[];
  pricingProcedure: string;
  releaseGroup?: string;
  postingBehaviour: 'STATISTICAL' | 'VALUE' | 'STOCK';
  reversalType?: string;
  followOn?: string[];
}

export interface MovementType {
  code: string;
  desc: string;
  sign: 1 | -1;
  from: StockType | null;
  to: StockType | null;
  valRel: boolean;
  modifier: string;           // drives account determination
  required: ('WBS' | 'CC' | 'PO' | 'REASON' | 'RATE' | 'SITE_TO' | 'PARTNER')[];
  drEvent: string | null;
  crEvent: string | null;
  reversal: string;
  authObject: string;
}

export interface PriceStep {
  step: number;
  code: string;
  desc: string;
  kind: 'COND' | 'SUBTOTAL' | 'INFO';
  rate?: number;
  per?: string;
  value: number;
  source?: string;
  stat?: boolean;
  acctKey?: string;
}

export interface PriceResult {
  steps: PriceStep[];
  baseRate: number;
  net: number;
  landed: number;
  taxPct: number;
  taxKind: 'CGST+SGST' | 'IGST' | 'UTGS' | 'NONE';
  taxValue: number;
  gross: number;
  tds: number;
  rounding: number;
  payable: number;
  itcBlocked: boolean;
}

export interface DocItem {
  line: number;
  category: ItemCategory;
  materialCode: string;
  desc: string;
  qty: number;
  uom: string;
  rate: number;
  siteId: string;
  locId: string;
  wbs?: string;
  cc?: string;
  received: number;
  invoiced: number;
  taxCode: string;
  itc: ITCClass;
}

export interface ReleaseStepRec {
  code: string;
  title: string;
  role: string;
  valueLimit: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SKIPPED';
  by?: string;
  at?: string;
  comment?: string;
  snapshot?: { total: number; at: string; by: string };
  slaHours?: number;
  slaDueAt?: string;
  escalated?: boolean;
}

export interface ReleaseState {
  groupId: string;
  strategyId: string;
  strategyName: string;
  steps: ReleaseStepRec[];
  indicator: 'BLOCKED' | 'PARTIALLY_RELEASED' | 'RELEASED' | 'REJECTED';
  resets: number;
}

export interface Doc {
  id: string;
  number: string | null;
  type: string;
  module: ModuleCode;
  companyId: string;
  siteId?: string;
  partnerId?: string;
  dateISO: string;
  status: DocStatus;
  createdBy: string;
  items: DocItem[];
  total: number;
  refId?: string;
  refNumber?: string;
  movementCode?: string;
  mvtValue?: number;
  stockType?: StockType;
  locId?: string;
  locToId?: string;
  siteToId?: string;
  wbs?: string;
  cc?: string;
  reason?: string;
  release?: ReleaseState;
  price?: PriceResult;
  note?: string;
  reversedBy?: string;
  reversalOf?: string;
  snapshots?: { at: string; by: string; total: number; step: string }[];
  softCloseAdjust?: boolean;
  version?: number;               /* optimistic locking */
  conversationId?: string;        /* context-bound thread (COM) */
  rejectedSnapshot?: { total: number; rate: number; at: string };
}

export interface JournalLine {
  account: string;
  dr: number;
  cr: number;
  text: string;
  wbs?: string;
  cc?: string;
  indicator?: string;
}

export interface Journal {
  id: string;
  number: string;
  companyId: string;
  dateISO: string;
  fy: string;
  period: number;
  lines: JournalLine[];
  refId: string;
  refNumber: string;
  status: 'POSTED' | 'REVERSED';
  noted?: string;
  createdBy: string;
  softCloseAdjust?: boolean;
  reason?: string;
  reversalOf?: string;   /* linked contra — both entries reference each other */
  reversedBy?: string;
}

/* ---------------- context-bound communication (COM) ---------------- */

export interface ChatMsg {
  id: string;
  user: string;
  at: string;
  text: string;
  system?: boolean;
}

export interface Conversation {
  id: string;
  type: ConversationType;
  title: string;
  icon?: string;
  createdBy: string;
  createdAt: string;
  companyId: string;
  projectCode?: string;
  linkedObjectType?: string;
  linkedObjectId?: string;
  visibility: 'INTERNAL' | 'EXTERNAL_INCLUDED';
  retentionClass: 'OPERATIONAL' | 'PROJECT' | 'CONTRACTUAL' | 'LEGAL';
  legalHold: boolean;
  archived: boolean;
  participants: string[]; // userId[]
  lastMessageAt?: string;
  lastMessagePreview?: string;
  sequenceCounter: number;
  // Legacy fields for backward compatibility
  refType?: string;
  refId?: string;
  refNumber?: string;
  module?: string;
  messages?: ChatMsg[];
}

export interface StockRow {
  siteId: string;
  locId: string;
  materialCode: string;
  stockType: StockType;
  qty: number;
  value: number;
  vtype?: string;   // split valuation type: PUR (purchased) | CI (client-issued) | IMP (imported)
  special?: string; // special stock indicator O/SC/CI/RT/PR
  batch?: string;
}

export interface FlowLink { from: string; to: string; }

export type AuditCategory = 'CHANGE' | 'SECURITY' | 'SYSTEM' | 'POSTING' | 'CONFIG';

export interface AuditEntry {
  id: string;
  at: string;
  user: string;
  category: AuditCategory;
  object: string;
  key: string;
  field?: string;
  oldV?: string;
  newV?: string;
  reason?: string;
  docId?: string;
}

export interface ChangeRequest {
  id: string;
  object: string;       // 'MATERIAL' | 'PARTNER_BANK' | 'VALUATION_CLASS' ...
  key: string;
  field: string;
  oldV: string;
  newV: string;
  reason: string;
  proposer: string;
  approvals: { user: string; at: string }[];
  needed: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  freezePartnerId?: string;
}

export type PeriodStatus = 'OPEN' | 'SOFT_CLOSED' | 'HARD_CLOSED';

export interface PeriodState { status: PeriodStatus; by?: string; reason?: string; }

export interface ClosingStep {
  id: string;
  title: string;
  module: ModuleCode;
  ownerRole: string;
  done: boolean;
  by?: string;
  at?: string;
}

export interface RoleDef {
  id: string;
  name: string;
  objects: AuthObjectGrant[];
}

export interface AuthObjectGrant {
  obj: string;
  activities: string[];
  fields?: Record<string, string[]>;
  valueLimit?: number;
}

export interface UserDef {
  id: string;
  name: string;
  title: string;
  roles: string[];
  color: string;
}

export interface ERPState {
  v: number;
  today: string;
  userId: string;
  companyFilter: string; // 'ALL' or company code
  seq: Record<string, number>;
  docs: Doc[];
  journals: Journal[];
  stock: StockRow[];
  flow: FlowLink[];
  audit: AuditEntry[];
  changes: ChangeRequest[];
  periods: Record<string, { FIN: PeriodState; LOG: PeriodState }>;
  closing: ClosingStep[];
  freeze: Record<string, string>; // partnerId -> frozen until ISO
  authFailCount: number;
  /* ---- Part 1/10 platform services ---- */
  conversations: Conversation[];
  idem: Record<string, { ok: boolean; msg: string; docId?: string }>;
  /* ---- Part 2/10 MDM ---- */
  uomFactors: UomFactor[];
  geofences: Geofence[];
  importRuns: ImportRun[];
  consumption: ConsumptionRow[];
  mdmOverrides: DuplicateOverride[];
  /* ---- Part 2 : logistics domain objects ---- */
  sources: SourceListItem[];
  quotas: QuotaArrangement[];
  rateContracts: RateContract[];
  rfqs: Rfq[];
  gateEntries: GateEntry[];
  weighTickets: WeighTicket[];
  reservations: Reservation[];
  returnables: ReturnableIssue[];
  counts: PhysicalCount[];
  equipment: Equipment[];
  eqLogs: EquipmentLog[];
  maintOrders: MaintOrder[];
  inspLots: InspectionLot[];
  tests: TestResult[];
  ncrs: Ncr[];
  exceptions: Exc[];
  /* ---- Part 3 : commercial & financial domain objects ---- */
  budgets: Record<string, BudgetLine>;        // wbsCode -> budget
  contracts: ContractMaster[];
  boq: BoqItem[];
  measurements: MeasurementEntry[];
  raBills: RaBill[];
  suborders: SubcontractOrder[];
  rateLibrary: RateAnalysis[];
  hindrances: HindranceEvent[];
  claims: Claim[];
  payProposals: PaymentProposal[];
  bankLines: BankStatementLine[];
  assets: AssetMaster[];
  profitForecasts: ProfitForecast[];
  itc: ItcEntry[];
  cess: CessEntry[];
  guarantees: BankGuarantee[];
  insurances: InsurancePolicy[];
  disputes: Dispute[];
  compliance: ComplianceTask[];
  minWages: MinWage[];
  closeout: Record<string, CloseoutItem[]>;   // projectCode -> checklist
  wbsVersions: Record<string, WbsVersion[]>;  // projectCode -> versions
  physicalProgress: Record<string, number>;   // wbsCode -> %
  raRunHistory: RaRunRecord[];                // results-analysis postings

  /* ---- Part 3/10 : project system domain objects ---- */
  wbsElements: PsWbs[];
  psActivities: Activity[];
  baselines: { projectCode: string; version: number; reason: string; at: string; snapshot: Record<string, { es: number; ef: number }> }[];
  psBoq: PsBoq[];
  psMeasurements: PsMeasurement[];
  dprs: DailyReport[];
  hindranceRegs: HindranceReg[];
  siteInstructions: SiteInstruction[];
  rfis: Rfi[];
  costForecasts: CostForecast[];
  raPostings: RaPosting[];

  /* ---- Part 5 : stores & inventory ---- */
  bins: StorageBin[];
  putaways: PutAway[];
  rejectionNotes: RejectionNote[];
  valuationAdjustments: ValuationAdjustment[];
  stockRecRuns: StockRecRun[];
  matRecons: MatReconDoc[];
  tareFlags: TareFlag[];
  varianceApprovals: CountVarianceApproval[];

  /* ---- Part 6 : contracts · measurement · billing · subcontract ---- */
  contractClauses: ContractClause[];
  notices: ContractNotice[];
  variations: VariationOrder[];
  extraItems: ExtraItem[];
  rateBuilds: RateBuild[];
  rateBooks: RateBook[];
  drawings: Drawing[];
  mbEntries: MbEntry[];
  clientBills: ClientBill[];
  subOrdersP6: SubOrderP6[];
  subBills: SubBill[];
  claimCases: ClaimCase[];
  receivables: ReceivableItem[];
  retentionSchedule: RetentionRelease[];
  lessonsLearned: Lesson[];

  /* ---- Part 8 : HCM · PRD · EHS ---- */
  employees: Employee[];
  attendancePunches: AttendancePunch[];
  labourGangs: LabourGang[];
  mixDesigns: MixDesign[];
  batchTickets: BatchTicket[];
  productionOrders: ProductionOrder[];
  permits: PermitToWork[];
  incidents: Incident[];
  inductions: SafetyInduction[];

  /* ---- Part 9 : communication & collaboration ---- */
  messages: Message[];
  notifications: Notification[];
  tasks: Task[];
  toolLibrary: ToolLibrary;

  /* ---- Part 10A : launchpad & design system ---- */
  kpiDefinitions: KpiDefinition[];
  launchpadConfigs: LaunchpadConfig[];
  tileValues: Record<string, TileValue>;

  /* ---- Part 10B : mobile, sync & portals ---- */
  mobileDevices: MobileDevice[];
  syncQueues: Record<string, SyncState>; // deviceId -> state
  mediaUploads: MediaUpload[];
  portalTokens: PortalToken[];
  portalSessions: PortalSession[];
  vendorPortalData: Record<string, VendorPortalData>; // partnerId -> data
  subconPortalData: Record<string, SubconPortalData>; // partnerId -> data
  clientPortalData: Record<string, ClientPortalData>; // projectCode -> data

  /* ---- Part 10C : BID, analytics, AI, extensibility ---- */
  tenders: Tender[];
  eligibilityScreenings: EligibilityScreening[];
  bidCapacityCalculations: BidCapacityCalculation[];
  bidNoBidDecisions: BidNoBidDecision[];
  estimations: Estimation[];
  submissionDocuments: SubmissionDocument[];
  submissionSignOffs: SubmissionSignOff[];
  winLossRecords: WinLossRecord[];
  competitorRates: CompetitorRate[];
  semanticModel: SemanticModel;
  reports: Report[];
  assistantQueries: AssistantQuery[];
  assistantResponses: AssistantResponse[];
  customFields: CustomField[];
  configTransports: ConfigTransport[];

  /* ---- Part 10D : roles, approval, migration, cutover ---- */
  roles: Role[];
  approvalThresholds: ApprovalThreshold[];
  approvalMatrix: ApprovalMatrix[];
  sodConflicts: SoDConflict[];
  migrationRuns: MigrationRun[];
  cutoverActivities: CutoverActivity[];
  goNoGoChecklist: GoNoGoChecklist[];
  endToEndTests: EndToEndTest[];
}

/* =========================== Part 10A — Launchpad & Design System =========================== */

export type TileType = 'COUNT' | 'KPI' | 'MICRO_CHART' | 'COMPARISON' | 'MONITORING' | 'ACTION';
export type RefreshPolicy = 'REALTIME' | 'ON_LOAD' | 'CACHED';
export type ThresholdDirection = 'HIGHER_BETTER' | 'LOWER_BETTER' | 'MONITORED';
export type RagStatus = 'RED' | 'AMBER' | 'GREEN' | 'GREY';

export interface KpiDefinition {
  code: string;
  name: string;
  description: string;
  module: ModuleCode;
  businessOwnerRole: string;
  measureExpression: string;
  dimensions: string[];
  defaultFilters?: Record<string, any>;
  timeBasis: 'PERIOD' | 'CUMULATIVE' | 'ROLLING_N' | 'AS_ON';
  unit: string;
  decimals: number;
  scaling: 'ABSOLUTE' | 'THOUSAND' | 'LAKH' | 'CRORE';
  displayFormat: string;
  targetSource: 'BUDGET' | 'PLAN' | 'PRIOR_PERIOD' | 'FIXED' | 'NONE';
  thresholdRules: { boundary: number; direction: ThresholdDirection; status: RagStatus }[];
  trendBasis: 'PERIOD_ON_PERIOD' | 'CUMULATIVE' | 'ROLLING';
  trendPeriods: number;
  drillPath: string[]; // MANDATORY - ordered target views
  refreshPolicy: RefreshPolicy;
  authorizationObject: string;
  cacheKeyDimensions?: string[];
}

export interface TileConfig {
  id: string;
  type: TileType;
  kpiCode?: string; // For KPI tiles
  title: string;
  subtitle?: string;
  group: string; // 'MY_WORK' | 'PROJECT' | 'PROCUREMENT' | etc.
  refreshPolicy: RefreshPolicy;
  cacheIntervalMinutes?: number;
  drillTarget: string; // Screen/page to open
  drillFilters?: Record<string, any>;
  authorizationObject: string;
  minValue?: number;
  maxValue?: number;
  icon?: string;
  color?: string;
}

export interface TileValue {
  tileId: string;
  value: number | string;
  unit?: string;
  trend?: number; // % change
  trendDirection?: 'UP' | 'DOWN' | 'FLAT';
  status?: RagStatus;
  timestamp: string; // "as at" for cached tiles
  drillCount?: number; // Must match value for count tiles
}

export interface LaunchpadConfig {
  role: string;
  tiles: TileConfig[];
  tileOrder: string[]; // User-customizable order
}

/* =========================== Part 9 — COM =========================== */

export type ConversationType =
  | 'DIRECT' | 'GROUP' | 'PROJECT' | 'WORKFRONT' | 'SITE'
  | 'DOCUMENT' | 'ROLE_BROADCAST' | 'EXTERNAL' | 'SUPPORT';

export type MessageContentType =
  | 'TEXT' | 'VOICE_NOTE' | 'IMAGE' | 'VIDEO' | 'DOCUMENT'
  | 'LOCATION' | 'CONTACT' | 'OBJECT_CARD' | 'TASK'
  | 'APPROVAL_REQUEST' | 'FORM' | 'POLL' | 'SYSTEM';

export type DeliveryState = 'SENT' | 'DELIVERED' | 'READ';

export interface Conversation {
  id: string;
  type: ConversationType;
  title: string;
  icon?: string;
  createdBy: string;
  createdAt: string;
  companyId: string;
  projectCode?: string;
  linkedObjectType?: string;
  linkedObjectId?: string;
  visibility: 'INTERNAL' | 'EXTERNAL_INCLUDED';
  retentionClass: 'OPERATIONAL' | 'PROJECT' | 'CONTRACTUAL' | 'LEGAL';
  legalHold: boolean;
  archived: boolean;
  participants: string[]; // userId[]
  lastMessageAt?: string;
  lastMessagePreview?: string;
  sequenceCounter: number;
}

export interface Message {
  id: string;
  clientMessageId: string; // idempotency key
  conversationId: string;
  senderId: string;
  senderType: 'USER' | 'SYSTEM' | 'BOT' | 'EXTERNAL';
  sequenceNumber: number;
  serverTimestamp: string;
  clientTimestamp: string;
  contentType: MessageContentType;
  body: string;
  attachments?: Attachment[];
  replyToMessageId?: string;
  mentions?: string[];
  linkedObjectType?: string;
  linkedObjectId?: string;
  editedAt?: string;
  editHistory?: { at: string; body: string }[];
  deletedAt?: string;
  deletionReason?: string;
  reactions?: { emoji: string; userId: string }[];
  pinned: boolean;
  starredBy?: string[];
  deliveryStates?: Record<string, DeliveryState>;
}

export interface Attachment {
  id: string;
  type: 'IMAGE' | 'VIDEO' | 'DOCUMENT' | 'VOICE';
  url: string;
  name: string;
  size: number;
  mimeType: string;
  gps?: { lat: number; lng: number };
  timestamp?: string;
  annotations?: Annotation[];
}

export interface Annotation {
  type: 'ARROW' | 'CIRCLE' | 'RECTANGLE' | 'FREEHAND' | 'TEXT' | 'MEASUREMENT';
  x: number;
  y: number;
  width?: number;
  height?: number;
  text?: string;
  points?: { x: number; y: number }[];
}

export type NotificationChannel = 'IN_APP' | 'PUSH' | 'EMAIL' | 'SMS' | 'WHATSAPP' | 'CHAT';
export type NotificationPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';

export interface Notification {
  id: string;
  eventKey: string;
  userId: string;
  channel: NotificationChannel;
  priority: NotificationPriority;
  title: string;
  body: string;
  linkedObjectType?: string;
  linkedObjectId?: string;
  sentAt: string;
  readAt?: string;
  actedAt?: string;
  aggregated?: boolean;
  aggregationCount?: number;
}

export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type TaskStatus = 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface Task {
  id: string;
  title: string;
  description?: string;
  assigneeId: string;
  creatorId: string;
  dueDate?: string;
  priority: TaskPriority;
  status: TaskStatus;
  checklist?: { text: string; done: boolean }[];
  linkedObjectType?: string;
  linkedObjectId?: string;
  createdAt: string;
  completedAt?: string;
}

export interface ToolLibrary {
  pdfEngine: { enabled: boolean; templateCount: number };
  importEngine: { enabled: boolean; lastImportAt?: string };
  barcodeEngine: { enabled: boolean; scansToday: number };
  ocrEngine: { enabled: boolean; extractionsToday: number };
  formulaEngine: { enabled: boolean; evaluationsToday: number };
  uomEngine: { enabled: boolean; conversionsToday: number };
  geofenceEngine: { enabled: boolean; checksToday: number };
  photoEngine: { enabled: boolean; uploadsToday: number };
  schedulingEngine: { enabled: boolean; networksComputed: number };
  searchEngine: { enabled: boolean; indexedDocuments: number };
  bankFileEngine: { enabled: boolean; filesGenerated: number };
  notificationEngine: { enabled: boolean; notificationsSent: number };
  reportBuilder: { enabled: boolean; reportsRun: number };
  dashboardEngine: { enabled: boolean; kpisDefined: number };
  workflowBuilder: { enabled: boolean; strategiesConfigured: number };
  duplicateEngine: { enabled: boolean; duplicatesFlagged: number };
  auditViewer: { enabled: boolean; auditEntries: number };
  backupEngine: { enabled: boolean; lastBackupAt?: string };
  translationEngine: { enabled: boolean; languagesSupported: number };
  integrationFramework: { enabled: boolean; connectorsActive: number };
}

/* =========================== Part 2 — PRC =========================== */

export interface SourceListItem {
  materialCode: string;
  siteId: string;
  vendorId: string;
  validFrom: string;
  validTo?: string;
  fixed?: boolean;
  blocked?: boolean;
}

export interface QuotaArrangement {
  materialCode: string;
  siteId: string;
  allocations: { vendorId: string; pct: number }[];
  allocated: Record<string, number>; // vendorId -> qty allocated
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
  status: 'ACTIVE' | 'EXHAUSTED' | 'EXPIRED';
}

export interface Quotation {
  vendorId: string;
  rate: number;        // basic rate / unit
  discPct: number;
  freightPerUnit: number;
  leadDays: number;
  paymentDays: number;
  validUntil: string;
  at: string;
}

export interface Rfq {
  id: string;
  number: string;
  materialCode: string;
  qty: number;
  uom: string;
  siteId: string;
  wbs?: string;
  vendors: string[];
  deadline: string;
  status: 'OPEN' | 'CLOSED' | 'AWARDED';
  quotations: Quotation[];
  awardVendorId?: string;
  justification?: string;
  at: string;
}

export interface PoVersion {
  v: number;
  at: string;
  by: string;
  note: string;
  total: number;
  items: DocItem[];
}

/* =========================== Part 2 — INV =========================== */

export interface GateEntry {
  id: string;
  number: string;
  siteId: string;
  vehicleNo: string;
  driver: string;
  transporter: string;
  ewb: string;
  poRef: string;
  materialCode: string;
  declaredQty: number;
  inTime: string;
  sealOk: boolean;
  status: 'IN' | 'WEIGHED' | 'GR_POSTED' | 'REJECTED';
}

export interface WeighTicket {
  id: string;
  gateId: string;
  ticketNo: string;
  gross: number;
  tare: number;
  net: number;
  at: string;
  operator: string;
  manual?: boolean;
  reason?: string;
}

export interface Reservation {
  id: string;
  materialCode: string;
  siteId: string;
  wbs: string;
  qty: number;
  status: 'OPEN' | 'CONSUMED' | 'RELEASED';
  at: string;
}

export interface ReturnableIssue {
  id: string;
  docId: string;
  materialCode: string;
  siteId: string;
  wbs: string;
  qty: number;
  issuedTo: string;
  issueDate: string;
  dueDate: string;
  returnedQty: number;
  returnDate?: string;
  condition?: 'GOOD' | 'DAMAGED' | 'LOST';
  status: 'OUT' | 'RETURNED' | 'LOSS';
}

export interface PhysicalCount {
  id: string;
  number: string;
  siteId: string;
  materialCode: string;
  blind: boolean;
  bookQty: number;
  countQty: number | null;
  variance: number | null;
  status: 'COUNTING' | 'VARIANCE' | 'ADJUSTED';
  reason?: string;
  approvedBy?: string;
  at: string;
}

export interface Exc {
  id: string;
  at: string;
  kind: 'SHORTAGE' | 'FUEL' | 'PERMIT' | 'CALIBRATION' | 'NCR_SLA' | 'REORDER' | 'ACK';
  text: string;
  severity: 'warn' | 'bad' | 'info';
  ref?: string;
  acknowledged?: boolean;
}

/* =========================== Part 2 — EAM =========================== */

export interface EquipmentDoc { kind: string; no: string; validTo: string; }

export interface Equipment {
  code: string;
  desc: string;
  category: string;
  make: string;
  model: string;
  serial: string;
  regNo: string;
  ownership: 'OWNED' | 'HIRED' | 'SUBCON';
  acqValue: number;
  siteId: string;
  wbs?: string;
  operatorId: string;
  operatorLicValidTo: string;
  status: 'AVAILABLE' | 'RUNNING' | 'IDLE' | 'BREAKDOWN' | 'MAINTENANCE';
  hourMeter: number;
  fuelType: string;
  fuelNormLph: number;   // litres per hour norm
  internalRate: number;  // ₹ per productive hour
  docs: EquipmentDoc[];
  pmEveryHrs: number;
  lastPmHm: number;
}

export interface EquipmentLog {
  id: string;
  docId: string;
  equipmentCode: string;
  date: string;
  openingHm: number;
  closingHm: number;
  workHrs: number;
  idleHrs: number;
  brkdnHrs: number;
  standbyHrs: number;
  operatorId: string;
  fuelL: number;
  wbs?: string;
}

export interface MaintOrder {
  id: string;
  number: string;
  equipmentCode: string;
  type: 'PRV' | 'BRK';
  status: 'OPEN' | 'IN_PROGRESS' | 'COMPLETED';
  sparesCost: number;
  laborCost: number;
  extCost: number;
  downtimeHrs: number;
  rootCause?: string;
  at: string;
  settled?: boolean;
}

/* =========================== Part 2 — QMS =========================== */

export interface InspectionLot {
  id: string;
  number: string;
  type: 'IL-GRN' | 'IL-WRK' | 'IL-PRD' | 'IL-SRC';
  materialCode: string;
  qty: number;
  siteId: string;
  grDocId?: string;
  vendorId?: string;
  status: 'OPEN' | 'ACCEPTED' | 'REJECTED' | 'REWORK';
  decisionBy?: string;
  at?: string;
  atCreated: string;
}

export interface TestResult {
  id: string;
  lotId?: string;
  kind: 'CUBE' | 'SOIL' | 'AGG' | 'BITUMEN' | 'STEEL';
  material: string;
  grade: string;
  ageDays?: number;
  value: number;
  spec: string;
  pass: boolean;
  batch?: string;
  pourLoc?: string;
  challan?: string;
  equipId?: string;
  welderId?: string;
  at: string;
}

export interface Ncr {
  id: string;
  number: string;
  title: string;
  severity: 'MINOR' | 'MAJOR' | 'CRITICAL';
  status: 'RAISED' | 'ASSIGNED' | 'ROOT_CAUSE' | 'CORRECTIVE' | 'PREVENTIVE' | 'VERIFICATION' | 'CLOSED';
  raisedAt: string;
  dueAt: string;
  cost: number;
  vendorId?: string;
  link?: { lotId?: string; batch?: string; pourLoc?: string; challan?: string };
}

export interface Res {
  s: ERPState;
  ok: boolean;
  msg: string;
  tone: 'ok' | 'bad' | 'warn' | 'info';
  docId?: string;
  detail?: string;
}

/* =========================== Part 3 — PRJ =========================== */

export type WbsNodeType = 'SUMMARY' | 'ACCOUNT_ASSIGNMENT' | 'BILLING' | 'BOTH';
export type WbsStatus = 'CREATED' | 'RELEASED' | 'TECH_COMPLETE' | 'CLOSED';

export interface WbsNode {
  code: string;
  name: string;
  projectCode: string;
  parent?: string;
  nodeType: WbsNodeType;
  planning: boolean;
  budgetElement: boolean;
  costObject: boolean;
  billingElement: boolean;
  responsible?: string;
  costCentre?: string;
  profitCentre?: string;
  uom?: string;
  status: WbsStatus;
}

export interface BudgetLine { org: number; sup: number; ret: number; }

export interface WbsVersion {
  version: number;
  at: string;
  by: string;
  reason: string;
  mapping: { from: string; to: string }[];  // old node -> new node
}

export interface RaRunRecord {
  id: string;
  projectCode: string;
  period: string;          // YYYY-MM
  pocCost: number;         // % cost basis
  pocPhysical: number;     // % physical basis
  calculatedRevenue: number;
  billedToDate: number;
  unbilled: number;        // contract asset
  billingInAdvance: number;// contract liability
  expectedLoss: number;    // onerous provision
  journalNumber?: string;
  reversedBy?: string;
  at: string;
  by: string;
}

/* =========================== Part 3 — CTR =========================== */

export type ContractType = 'ITEM_RATE' | 'PCT_RATE' | 'LUMP_SUM' | 'EPC' | 'COST_PLUS' | 'ANNUITY';

export interface ContractMaster {
  id: string;
  number: string;
  clientId: string;
  projectCode: string;
  type: ContractType;
  loaRef: string;
  agreementDate: string;
  originalValue: number;
  revisedValue: number;
  completionDate: string;
  revisedCompletion?: string;
  eotGrantedDays: number;
  retentionPct: number;
  retentionCeilingPct: number;
  securityDepositPct: number;
  mobilisationAdvancePct: number;
  advanceInterestPct: number;
  recoveryStartPct: number;   // begin recovery when cumulative progress >= this %
  recoveryRatePct: number;
  priceAdjustment: boolean;
  ldRatePctPerWeek: number;
  ldCeilingPct: number;
  defectLiabilityMonths: number;
  claimNoticeDays: number;
  eotNoticeDays: number;
  disputeNoticeDays: number;
  status: 'ACTIVE' | 'PRACTICAL_COMPLETION' | 'CLOSED';
}

export interface BoqItem {
  id: string;
  contractId: string;
  itemCode: string;
  desc: string;
  spec: string;
  unit: string;
  tenderQty: number;
  tenderRate: number;
  revisedQty: number;
  executedCum: number;        // cumulative measured
  previouslyBilled: number;
  deviationLimitPct: number;  // permitted deviation
  wbs: string;
  costCode: string;
  rateVersion: number;
  rateEffective: string;
  approved: boolean;          // extra item approved?
  provisional?: boolean;
}

export interface RateComponent {
  kind: 'MATERIAL' | 'LABOUR' | 'PLANT' | 'TRANSPORT' | 'ROYALTY' | 'OVERHEAD' | 'SUB_ANALYSIS';
  desc: string;
  qty: number;
  rate: number;
  wastagePct?: number;
  unit: string;
  subAnalysisId?: string;     // nested sub-analysis
}

export interface RateAnalysis {
  id: string;
  code: string;
  desc: string;
  unit: string;
  components: RateComponent[];
  siteOverheadPct: number;
  hoOverheadPct: number;
  profitPct: number;
  version: number;
  effective: string;
  locked?: boolean;
  lockedReason?: string;
  preparer: string;
  approver?: string;
}

export type HindranceType =
  | 'CLIENT_DRAWING' | 'LAND_ROW' | 'UTILITY_SHIFTING' | 'STATUTORY_APPROVAL'
  | 'CLIENT_MATERIAL' | 'RAIN' | 'LAW_ORDER' | 'LABOUR_UNREST' | 'DESIGN_CHANGE';

export interface HindranceEvent {
  id: string;
  contractId: string;
  type: HindranceType;
  desc: string;
  eventDate: string;
  endDate?: string;
  frontsAffected: string;
  impactDays: number;
  noticeServed: boolean;
  noticeDate?: string;
  noticeRef?: string;
  linkedActivity?: string;
  feedsEotId?: string;
}

export interface Claim {
  id: string;
  number: string;
  contractId: string;
  clause: string;
  eventDate: string;
  noticeDate: string;
  noticeTimely: boolean;
  desc: string;
  heads: { head: string; amount: number }[];
  timeImpactDays: number;
  status: 'NOTICE' | 'PARTICULARS' | 'SUBMITTED' | 'NEGOTIATED' | 'AWARDED' | 'REJECTED';
  awarded: number;
  hindranceId?: string;
}

/* =========================== Part 3 — BIL =========================== */

export interface MeasurementEntry {
  id: string;
  contractId: string;
  boqItemId: string;
  mbNo: string;
  period: string;
  location: string;
  drawingNo: string;
  drawingRev: string;
  drawingStatus: 'IFC' | 'SUPERSEDED' | 'DRAFT';
  nos: number;
  length: number;
  breadth: number;
  depth: number;
  formula: string;
  qty: number;
  isDeduction: boolean;
  isDeviation: boolean;       // correction of an earlier certified entry
  correctsId?: string;
  certifiedIn?: string;       // raBill id once certified
  measuredBy: string;
  checkedBy: string;
  status: 'DRAFT' | 'CERTIFIED';
  at: string;
}

export interface RaBillStep { label: string; value: number; detail?: string; flagged?: boolean; }

export interface RaBill {
  id: string;
  number: string;
  contractId: string;
  period: string;
  grossToDate: number;
  grossPrev: number;
  grossThisBill: number;
  escalation: number;
  escalationDetail: { component: string; weight: number; indexBase: number; indexCur: number; amount: number }[];
  securedAdvance: number;
  recoveries: { head: string; amount: number; note?: string }[];
  statutory: { head: string; amount: number }[];
  taxableValue: number;
  gst: number;
  netPayable: number;
  submitted: number;
  certified: number;
  paid: number;
  status: 'DRAFT' | 'QS_CERTIFIED' | 'PM_APPROVED' | 'COMMERCIAL' | 'SUBMITTED' | 'UNDER_CERTIFICATION' | 'CERTIFIED' | 'INVOICED' | 'PAID' | 'CLOSED' | 'RETURNED' | 'DISPUTED';
  certShortfalls: { reason: string; amount: number }[];
  steps: RaBillStep[];
  at: string;
}

/* =========================== Part 3 — SUB =========================== */

export interface SubcontractOrder {
  id: string;
  number: string;
  subconId: string;
  projectCode: string;
  wbs: string;
  lines: { clientBoqId: string; desc: string; qty: number; rate: number; subRate: number }[];
  ceilingValue: number;
  retentionPct: number;
  advancePct: number;
  labourLicenceValidTo: string;
  pfCompliant: boolean;
  insuranceValidTo: string;
  status: 'ACTIVE' | 'CLOSED';
  materialRecoveryRate: Record<string, number>; // materialCode -> recovery rate
}

export interface SubBillRecovery { head: string; amount: number; }

/* =========================== Part 3 — FIN =========================== */

export interface VendorInvoiceCheck { label: string; ok: boolean; note: string; }

export interface PaymentProposalLine {
  invoiceId: string;
  vendorId: string;
  dueDate: string;
  amount: number;
  priority: 'STATUTORY' | 'MSME' | 'CRITICAL' | 'NORMAL';
  msmeDays?: number;
  msmeInterest?: number;
  blocked?: boolean;
  blockReason?: string;
}

export interface PaymentProposal {
  id: string;
  number: string;
  lines: PaymentProposalLine[];
  total: number;
  status: 'PROPOSED' | 'CHECKED' | 'RELEASED' | 'FILE_EXPORTED';
  maker: string;
  checker?: string;
  bankFileTotal?: number;
  at: string;
}

export interface BankStatementLine {
  id: string;
  dateISO: string;
  ref: string;
  desc: string;
  amount: number;       // +ve credit, -ve debit
  matchedInvoiceId?: string;
  matchedBy?: 'AUTO' | 'MANUAL';
  status: 'MATCHED' | 'UNMATCHED';
  ageDays: number;
}

export interface AssetMaster {
  id: string;
  code: string;
  desc: string;
  cls: string;
  acqDate: string;
  acqValue: number;
  usefulLifeYears: number;
  location: string;
  projectCode?: string;
  equipmentCode?: string;
  depCoLaw: number;     // accumulated — company law
  depTax: number;       // accumulated — tax law
  coLawRatePct: number;
  taxRatePct: number;
}

/* =========================== Part 3 — CTL =========================== */

export interface ProfitForecast {
  id: string;
  key: string;            // project / client / BU
  dimension: 'PROJECT' | 'CLIENT' | 'BU';
  period: string;
  revenue: number;
  cost: number;
  margin: number;
  version: number;        // retain prior forecasts for trend
  at: string;
}

/* =========================== Part 3 — CMP =========================== */

export interface ItcEntry {
  id: string;
  vendorId: string;
  invoiceNo: string;
  dateISO: string;
  taxable: number;
  tax: number;
  eligible: 'ELIGIBLE' | 'BLOCKED_IMMOVABLE' | 'INELIGIBLE';
  inStatement: boolean;
  status: 'MATCHED' | 'NOT_IN_STATEMENT' | 'VALUE_MISMATCH' | 'REVERSE_CHARGE';
}

export interface CessEntry { id: string; projectCode: string; base: number; ratePct: number; amount: number; challan?: string; at: string; }

export type BgType = 'EARNEST_MONEY' | 'PERFORMANCE' | 'ADVANCE' | 'RETENTION' | 'MOBILISATION';

export interface BankGuarantee {
  id: string;
  number: string;
  bank: string;
  type: BgType;
  beneficiary: string;
  contractId?: string;
  amount: number;
  marginBlocked: number;
  issueDate: string;
  expiryDate: string;
  claimPeriodEnd: string;
  autoRenew: boolean;
  status: 'LIVE' | 'RELEASED' | 'INVOKED' | 'EXPIRED';
}

export interface InsurancePolicy {
  id: string;
  kind: string;
  policyNo: string;
  insurer: string;
  sumInsured: number;
  projectCode?: string;
  validTo: string;
  status: 'LIVE' | 'LAPSED' | 'CLAIMED';
}

export interface Dispute {
  id: string;
  ref: string;
  forum: string;
  oppositeParty: string;
  subject: string;
  contractId?: string;
  amountClaimed: number;
  filingDate: string;
  limitationEnd: string;
  status: 'FILED' | 'HEARING' | 'AWARDED' | 'EXECUTION' | 'CLOSED';
  contingentProvision: number;
}

export interface ComplianceTask {
  id: string;
  obligation: string;
  dueDate: string;
  owner: string;
  state: string;
  projectCode?: string;
  status: 'GREEN' | 'AMBER' | 'RED' | 'DONE';
  evidence?: boolean;
}

export interface MinWage {
  id: string;
  state: string;
  zone: string;
  skill: string;
  dailyRate: number;
  effective: string;
  notificationRef: string;
}

export interface CloseoutItem { id: string; task: string; done: boolean; mandatory: boolean; }

/* =========================== Part 2 — MDM =========================== */

export type UomDim = 'MASS' | 'VOLUME' | 'LENGTH' | 'COUNT' | 'AREA' | 'TIME';

export interface UomDef { code: string; name: string; dim: UomDim; }

export interface UomFactor {
  from: string;
  to: string;
  factor: number;
  materialCode?: string;    // material-specific overrides generic
  rounding?: 'UP' | 'DOWN' | 'NEAREST' | 'NONE';
}

export interface Geofence {
  id: string;
  code: string;
  siteId: string;
  projectCode?: string;
  name: string;
  type: 'ATTENDANCE' | 'SITE_BOUNDARY' | 'RESTRICTED' | 'MATERIAL_YARD' | 'CAMP';
  shape:
    | { kind: 'CIRCLE'; lat: number; lng: number; radiusM: number }
    | { kind: 'POLYGON'; pts: [number, number][] };
  minAccuracyM: number;
  validFrom: string;
  validTo: string;
  priority: number;
}

export interface ImportRow {
  row: number;
  desc: string;
  group: string;
  uom: string;
  price: number;
  valid: boolean;
  error?: string;
}

export interface ImportRun {
  id: string;
  fileName: string;
  totalRows: number;
  validRows: number;
  errorRows: ImportRow[];
  corrected: boolean;
  confirmed: boolean;
  importedCodes: string[];
  at: string;
}

export interface ConsumptionRow { materialCode: string; month: string; qty: number; }

export interface DuplicateOverride {
  id: string;
  kind: 'MATERIAL' | 'PARTNER';
  desc: string;
  reason: string;
  by: string;
  at: string;
}

export interface ProjectTemplate {
  code: string;
  name: string;
  wbs: { code: string; name: string; nodeType: string }[];
}

/* ==================== Part 3/10 — PROJECT SYSTEM ==================== */
/* WbsStatus ('CREATED'|'RELEASED'|'TECH_COMPLETE'|'CLOSED') is reused from Part 1 PRJ types above */
export type NodeType = 'SUMMARY' | 'WORK';

export interface PsWbs {
  code: string;
  desc: string;
  level: number;
  parent?: string;
  projectCode: string;
  nodeType: NodeType;
  planningElement: boolean;
  budgetElement: boolean;
  costObject: boolean;
  billingElement: boolean;
  responsible?: string;
  costCentre?: string;
  profitCentre?: string;
  uom?: string;
  plannedQty?: number;
  chainageFrom?: string;
  chainageTo?: string;
  drawingRefs?: string[];
  status: WbsStatus;
  version: number;
  postedTo?: boolean; // set true once any cost lands here
}

export type DependencyType = 'FS' | 'SS' | 'FF' | 'SF';
export interface Activity {
  id: string;
  wbs: string;
  desc: string;
  duration: number; // working days
  deps: { activityId: string; type: DependencyType; lag: number }[];
  calendar?: string;
  resources?: string;
  milestone?: boolean;
  es?: number; ef?: number; ls?: number; lf?: number; float?: number;
  baselineStart?: number; baselineFinish?: number;
  actualStart?: number; actualFinish?: number;
  pctComplete: number;
  progressMethod: 'UNITS' | 'MILESTONE' | 'SF' | 'DURATION' | 'LOE';
}

export interface BillingStage { stage: string; desc: string; pct: number; }

export interface PsBoq {
  id: string;
  contractId: string;
  projectCode: string;
  itemCode: string;
  parentItem?: string;
  level: number;
  itemType: 'HEADING' | 'ITEM' | 'SUB_ITEM' | 'PROVISIONAL' | 'DAYWORK' | 'EXTRA';
  desc: string;
  spec?: string;
  unit: string;
  tenderQty: number;
  tenderRate: number;
  revisedQty: number;
  deviationPct: number; // permitted
  wbs: string;
  costCode: string;
  billingStages?: BillingStage[];
  materialCoeff?: { material: string; coeff: number }[];
  labourNorm?: number;
  rateVersion: number;
  rateEffective: string;
  variationApproved?: boolean;
}

export interface PsMeasurement {
  id: string;
  boqItemId: string;
  qty: number;
  stage?: string; // for part-rate billing
  dateISO: string;
  certified: boolean;
  certifiedBillId?: string;
}

export type DprStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REVISION';
export interface DprActivity { wbs: string; activityId?: string; desc: string; qty: number; unit: string; cumulative: number; pct: number; }
export interface DailyReport {
  id: string;
  number: string;
  projectCode: string;
  dateISO: string;
  shift: 'DAY' | 'NIGHT' | 'FULL';
  reportedBy: string;
  approvedBy?: string;
  status: DprStatus;
  revisionOf?: string;
  revisionReason?: string;
  weather: { condition: string; tempC: number; rainMm: number; hrsLost: number };
  activities: DprActivity[];
  manpower: { agency: string; trade: string; category: string; count: number }[];
  equipment: { code: string; hrs: number; idleHrs: number; breakdown: boolean }[];
  materialsReceived: { material: string; qty: number }[];
  materialsConsumed: { material: string; qty: number }[];
  safety: { observations: number; incidents: number; toolboxTalk: boolean };
  hindranceIds: string[];
  instructionIds: string[];
  photos: { name: string; gps: string; at: string }[];
  nextDayPlan: string;
  remarks: string;
}

export interface HindranceReg {
  id: string;
  number: string;
  projectCode: string;
  dateFrom: string;
  dateTo?: string;
  type: string;
  desc: string;
  frontsAffected: string;
  activityIds: string[];
  manpowerIdle?: number;
  equipmentIdle?: number;
  qtyNotExecuted?: number;
  noticeServed: boolean;
  noticeDate?: string;
  noticeRef?: string;
  noticeDeadline?: string; // contractual
  status: 'OPEN' | 'CLEARED' | 'LINKED_EOT';
  eotClaimId?: string;
}

export interface SiteInstruction {
  id: string;
  number: string;
  projectCode: string;
  dateReceived: string;
  from: string;
  subject: string;
  clause?: string;
  costImplication?: 'YES' | 'NO' | 'TBD';
  costAmount?: number;
  timeImplication?: number;
  responseSent: boolean;
  variationId?: string;
  status: 'OPEN' | 'RESPONDED' | 'CLOSED';
}

export interface Rfi {
  id: string;
  number: string;
  projectCode: string;
  dateRaised: string;
  toWhom: string;
  query: string;
  drawingRef?: string;
  requiredBy: string;
  responseDate?: string;
  status: 'OPEN' | 'ANSWERED';
}

export interface CostForecast {
  id: string;
  projectCode: string;
  wbs: string;
  period: string;
  version: number;
  forecastEac: number;
  forecastMargin: number;
  basis: 'BUDGET_RATE' | 'LATEST_ACTUAL' | 'LATEST_PURCHASE' | 'MANUAL';
  basisNote?: string;
  preparedBy: string;
  approvedBy?: string;
  at: string;
}

export interface RaPosting {
  id: string;
  projectCode: string;
  period: string;
  pocCost: number;
  pocPhysical: number;
  calculatedRevenue: number;
  billedRevenue: number;
  unbilledRevenue: number; // contract asset
  billingInAdvance: number; // contract liability
  expectedLoss: number;
  journalNumber?: string;
  status: 'POSTED' | 'REVERSED';
  reversedBy?: string;
  at: string;
}

/* ==================== Part 5 — Stores & Inventory ==================== */

export type StockLoc =
  | 'UNR' | 'QH' | 'BLK' | 'RET' | 'SUB' | 'CLI' | 'TRN' | 'SCR';

export interface StorageBin {
  id: string;
  siteId: string;
  locId: StockLoc;
  code: string;              // row/rack/level e.g. A-01-3
  capacity: number;
  uom: string;
  materialRestriction?: string[];  // material codes allowed (empty = any)
  currentQty: number;
  currentMaterial?: string;
}

export interface PutAway {
  id: string;
  siteId: string;
  materialCode: string;
  qty: number;
  fromLocId: StockLoc;
  binId: string;
  status: 'PENDING' | 'DONE';
  gateNo?: string;
  at: string;
  by?: string;
  doneAt?: string;
}

export interface RejectionNote {
  id: string;
  number: string;
  siteId: string;
  materialCode: string;
  qty: number;
  vendorId: string;
  reason: string;
  route: 'RETURN' | 'DEBIT_NOTE';
  status: 'OPEN' | 'CLOSED';
  at: string;
  closedAt?: string;
}

export interface ValuationAdjustment {
  id: string;
  number: string;
  siteId: string;
  materialCode: string;
  receiptDocId: string;
  oldAvg: number;
  newAvg: number;
  delta: number;            // value posted to price difference
  reason: string;
  at: string;
}

export interface RecLine {
  materialCode: string;
  siteId: string;
  locId: StockLoc;
  ledgerValue: number;      // from stock rows
  glValue: number;          // from stock GL control account
  break: number;
}

export interface StockRecRun {
  id: string;
  at: string;
  companyId: string;
  lines: RecLine[];
  totalLedger: number;
  totalGl: number;
  totalBreak: number;
  status: 'CLEAN' | 'BREAK';
}

export interface MatReconLine {
  materialCode: string;
  diameter?: string;        // steel by diameter
  theoretical: number;      // from BOQ execution x coefficient x (1+wastage)
  actual: number;           // opening + receipts - closing - returns - transfers - with subcon
  variance: number;
  variancePct: number;
  flag: 'GREEN' | 'AMBER' | 'RED';
  issueSlips: { docNo: string; qty: number; date: string; wbs: string }[];
  measurements: { boqItem: string; qty: number }[];
}

export interface MatReconDoc {
  id: string;
  number: string;
  projectCode: string;
  period: string;           // YYYY-MM
  lines: MatReconLine[];
  status: 'DRAFT' | 'APPROVED';
  redExplanation?: string;  // PM explanation required to clear RED
  redExplainedBy?: string;
  at: string;
}

export interface TareFlag {
  id: string;
  ticketNo: string;
  vehicleNo: string;
  thisTare: number;
  histTare: number;
  deviationPct: number;
  at: string;
}

export interface CountFreeze {
  siteId: string;
  locId: StockLoc;
  countId: string;
  at: string;
}

export interface CountVarianceApproval {
  countId: string;
  band: 'STOREKEEPER' | 'STORE_MANAGER' | 'CONTROLLER';
  approvedBy: string;
  reason: string;
  at: string;
}

/* ==================== Part 8 — HCM ==================== */

export type EmployeeGroup = 'PERMANENT' | 'CONTRACTUAL' | 'RETAINER' | 'TRAINEE' | 'LABOUR';
export type EmployeeSubgroup = 'MANAGEMENT' | 'STAFF' | 'SUPERVISOR' | 'OPERATOR' | 'SKILLED' | 'SEMI_SKILLED' | 'UNSKILLED';

export interface Employee {
  id: string;
  code: string;
  name: string;
  group: EmployeeGroup;
  subgroup: EmployeeSubgroup;
  personnelArea: string;
  personnelSubarea: string;
  joinDate: string;
  supervisorId?: string;
  supervisorHistory: { supervisorId: string; from: string; to?: string }[];
  certifications: { type: string; validTo: string; renewed?: boolean }[];
  status: 'ONBOARDING' | 'PROBATION' | 'ACTIVE' | 'EXIT';
  onboardingComplete: boolean;
}

export interface AttendancePunch {
  id: string;
  employeeId: string;
  punchType: 'IN' | 'OUT' | 'BREAK_START' | 'BREAK_END';
  serverTime: string;
  clientTime: string;
  lat: number;
  lng: number;
  accuracy: number;
  geofenceId?: string;
  deviceId: string;
  deviceRegistered: boolean;
  mockLocation: boolean;
  developerMode: boolean;
  faceMatchScore?: number;
  shift: string;
  workFront?: string;
  gang?: string;
  synced: boolean;
  correctionOf?: string;
  correctionReason?: string;
  correctionApprovedBy?: string;
}

export interface LabourGang {
  id: string;
  code: string;
  supervisorId: string;
  trade: string;
  siteId: string;
  members: string[]; // employee IDs
}

/* ==================== Part 8 — PRD ==================== */

export interface MixDesign {
  id: string;
  grade: string;
  proportions: { material: string; qtyPerCum: number }[];
  targetSlump: number;
  wcRatio: number;
  validTo: string;
  approvedBy: string;
}

export interface BatchTicket {
  id: string;
  number: string;
  mixDesignId: string;
  grade: string;
  volumeCum: number;
  actualWeights: { material: string; qty: number }[];
  moistureCorrection: { material: string; correction: number }[];
  slumpTest: { result: number; pass: boolean } | null;
  dispatched: boolean;
  delivered: boolean;
  at: string;
}

export interface ProductionOrder {
  id: string;
  number: string;
  type: 'EXTERNAL' | 'INTERNAL';
  customerId?: string;
  projectCode?: string;
  wbs?: string;
  grade: string;
  volumeCum: number;
  pourDate: string;
  siteId: string;
  status: 'PLANNED' | 'BATCHED' | 'DISPATCHED' | 'DELIVERED' | 'REJECTED';
}

/* ==================== Part 8 — EHS ==================== */

export type PermitType = 'HEIGHT' | 'CONFINED_SPACE' | 'HOT_WORK' | 'EXCAVATION' | 'ELECTRICAL' | 'LIFTING' | 'ROAD_CLOSURE' | 'NIGHT_WORK';

export interface PermitToWork {
  id: string;
  number: string;
  type: PermitType;
  issuerId: string;
  receiverId: string;
  receiverCertValid: boolean;
  validFrom: string;
  validTo: string;
  preconditions: { check: string; met: boolean }[];
  gasTest?: { result: string; safe: boolean };
  riskAssessment: string;
  status: 'ISSUED' | 'ACTIVE' | 'CLOSED' | 'CANCELLED';
  closedAt?: string;
}

export type IncidentSeverity = 'NEAR_MISS' | 'FIRST_AID' | 'MEDICAL_TREATMENT' | 'LOST_TIME' | 'FATATLITY';

export interface Incident {
  id: string;
  number: string;
  severity: IncidentSeverity;
  dateISO: string;
  location: string;
  description: string;
  personsInvolved: string[];
  rootCause?: string;
  correctiveAction?: string;
  status: 'REPORTED' | 'INVESTIGATING' | 'CLOSED';
  daysLost: number;
  escalated: boolean;
}

export interface SafetyInduction {
  id: string;
  employeeId: string;
  dateISO: string;
  trainer: string;
  valid: boolean;
}

/* ==================== Part 6 — Contracts & Billing ==================== */

export interface ContractClause {
  id: string;
  contractId: string;
  clauseNo: string;
  subject: string;
  obligation: string;
  owner: string;            // role or user
  deadline: string;
  alertDaysBefore: number;
  recurring?: 'MONTHLY' | 'QUARTERLY';
  status: 'OPEN' | 'DONE' | 'BREACHED';
}

export interface ContractNotice {
  id: string;
  number: string;
  contractId: string;
  direction: 'ISSUED' | 'RECEIVED';
  clause: string;
  date: string;
  deadline: string;
  subject: string;
  acknowledged: boolean;
}

export interface VariationOrder {
  id: string;
  number: string;
  contractId: string;
  boqItemId?: string;
  clauseRef: string;
  justification: string;
  rateBasis: 'BOQ_RATE' | 'DERIVED' | 'NEGOTIATED' | 'ANALYSIS';
  costImpact: number;
  timeImpactDays: number;
  submittedDate: string;
  status: 'SUBMITTED' | 'APPROVED' | 'REJECTED';
  approvedValue?: number;
  feedsEot: boolean;
}

export interface ExtraItem {
  id: string;
  number: string;
  contractId: string;
  desc: string;
  unit: string;
  qty: number;
  provisionalRate: number;
  rateBuildId?: string;
  status: 'UNAPPROVED' | 'APPROVED';
  approvedRate?: number;
}

export interface RateBuildComponent {
  kind: 'MATERIAL' | 'LABOUR' | 'PLANT' | 'LEAD_LIFT' | 'ROYALTY' | 'SUNDRIES' | 'SUB_ANALYSIS';
  desc: string;
  qty: number;
  rate: number;
  wastagePct?: number;
  outputNorm?: number;      // labour output norm
  subId?: string;           // nested sub-analysis
  leadKm?: number;          // lead & lift
  liftM?: number;
}

export interface RateBuild {
  id: string;
  code: string;
  desc: string;
  unit: string;
  components: RateBuildComponent[];
  sundriesPct: number;
  siteOhPct: number;
  hoOhPct: number;
  profitPct: number;
  version: number;
  effective: string;
  preparer: string;
  approver?: string;
  locked?: boolean;
  lockedRef?: string;       // tender / approved extra item reference
}

export interface RateBookItem {
  itemCode: string;
  desc: string;
  unit: string;
  rate: number;
  mat: number;
  lab: number;
  mach: number;
}

export interface RateBook {
  id: string;
  schedule: string;
  year: number;
  chapter: string;
  items: RateBookItem[];
}

export interface Drawing {
  id: string;
  no: string;
  rev: string;              // R0, R1, ...
  status: 'IFC' | 'SUPERSEDED' | 'DRAFT' | 'FOR_APPROVAL';
  supersededBy?: string;
}

export interface MbLine {
  desc: string;
  nos: number;
  length: number;
  breadth: number;
  depth: number;
  formula: 'RECT' | 'TRAPEZOID' | 'PRISMOIDAL' | 'XSECTION' | 'CIRCULAR' | 'TRIANGLE' | 'CUSTOM';
  qty: number;
  deduction: boolean;
  remarks?: string;
}

export interface MbEntry {
  id: string;
  number: string;
  contractId: string;
  boqItemId: string;
  wbs: string;
  period: string;
  drawingId: string;
  location: string;
  lines: MbLine[];
  measuredQty: number;      // computed = sum of lines (deductions negative)
  cumulative: number;       // computed: measured to date incl. this entry
  previouslyCertified: number;
  currentQty: number;       // computed: cumulative - previously certified
  amount: number;
  joint: boolean;
  measuredBy: string;
  status: 'DRAFT' | 'CERTIFIED';
  certifiedIn?: string;     // bill id
  isDeviation: boolean;     // MB-DEV correction entry
  correctsId?: string;
  qualityHold: boolean;     // failed test / uncleared hold point
  offlineSynced?: boolean;
  at: string;
}

export interface BillRecovery { head: string; amount: number; note?: string; }

export interface ClientBill {
  id: string;
  number: string;
  contractId: string;
  period: string;
  kind: 'RA-INT' | 'RA-FIN';
  /* step 1 */
  workExecuted: number;
  variations: number;
  approvedExtras: number;
  provisionalExtras: number;   // flagged billing-at-risk
  partRate: number;
  escalation: number;
  escalationLines: { component: string; weight: number; baseIdx: number; curIdx: number; amount: number }[];
  escalationRestatement: number;
  securedAdvance: number;
  grossToDate: number;
  grossPrev: number;
  grossThisBill: number;
  /* step 4 */
  recoveries: BillRecovery[];
  /* step 5 */
  statutory: BillRecovery[];
  /* step 6 */
  taxableValue: number;
  gstRate: number;
  gst: number;
  netPayable: number;
  /* lifecycle */
  status: 'DRAFT' | 'QS_CERTIFIED' | 'PM_APPROVED' | 'COMMERCIAL' | 'SUBMITTED' | 'UNDER_CERTIFICATION' | 'CERTIFIED' | 'INVOICED' | 'PAID' | 'CLOSED' | 'RETURNED' | 'DISPUTED';
  submittedAmt: number;
  certifiedAmt: number;
  paidAmt: number;
  shortfalls: { reason: string; amount: number; date: string }[];
  revenueJournal?: string;
  invoiceNo?: string;
  at: string;
}

export interface SubBoqLine {
  clientBoqId: string;
  desc: string;
  qty: number;
  clientRate: number;
  subRate: number;
  ownAdditions: number;
}

export interface SubOrderP6 {
  id: string;
  number: string;
  subconId: string;
  projectCode: string;
  wbs: string;
  lines: SubBoqLine[];
  ceilingValue: number;
  retentionPct: number;
  advancePct: number;
  penalRatePct: number;       // excess consumption penal rate
  labourLicenceValidTo: string;
  pfFiled: boolean;
  esiFiled: boolean;
  insuranceValidTo: string;
  cwRegistered: boolean;
  minWageOk: boolean;
  recoverableRate: Record<string, number>;  // materialCode -> recovery rate (market+handling, NOT cost)
  status: 'ACTIVE' | 'CLOSED';
}

export interface SubBill {
  id: string;
  number: string;
  subOrderId: string;
  period: string;
  grossValue: number;
  recoveries: BillRecovery[];
  tds: number;
  netPayable: number;
  status: 'DRAFT' | 'SUBMITTED' | 'RELEASED' | 'PAID' | 'BLOCKED';
  blockReason?: string;
  overrideBy?: string;
  overrideReason?: string;
  at: string;
}

export interface ClaimCase {
  id: string;
  number: string;
  contractId: string;
  event: string;
  clause: string;
  eventDate: string;
  noticeDate: string;
  noticeRef: string;
  noticeTimely: boolean;
  heads: { head: string; amount: number; basis: string }[];
  timeImpactDays: number;
  status: 'NOTICE' | 'PARTICULARS' | 'SUBMITTED' | 'NEGOTIATED' | 'AWARDED';
  bundle?: { kind: string; ref: string; date: string }[];
  awarded?: number;
}

export interface ReceivableItem {
  id: string;
  clientId: string;
  billId: string;
  billNo: string;
  nature: 'CERTIFIED_UNPAID' | 'RETENTION' | 'SECURITY_DEPOSIT' | 'DISPUTED' | 'SUBMITTED_UNCERTIFIED' | 'ADVANCE_PENDING';
  amount: number;
  dueDate: string;
  collected: number;
}

export interface RetentionRelease {
  id: string;
  contractId: string;
  stage: 'PRACTICAL_COMPLETION' | 'DEFECT_LIABILITY_EXPIRY';
  pct: number;
  date: string;
  status: 'PENDING' | 'RELEASED';
}

export interface Lesson {
  id: string;
  projectCode: string;
  kind: 'PRODUCTIVITY' | 'CONSUMPTION' | 'RATE' | 'CLAIM' | 'CLIENT';
  actual: string;
  norm: string;
  note: string;
  fedToRateLibrary: boolean;
  at: string;
}

/* =========================== Part 10B — Mobile, Sync & Portals =========================== */

export type MobileRole = 'SITE_ENGINEER' | 'STOREKEEPER' | 'PROJECT_MANAGER' | 'LABOUR_SUPERVISOR' | 'PLANT_OPERATOR' | 'SAFETY_OFFICER';

export interface MobileDevice {
  id: string;
  userId: string;
  deviceId: string;
  appVersion: string;
  registeredAt: string;
  lastSyncAt?: string;
  encrypted: boolean;
}

export interface SyncQueueItem {
  id: string;
  clientUuid: string;
  deviceId: string;
  entity: string;
  payload: any;
  clientTimestamp: string;
  dependsOn: string[];
  status: 'QUEUED' | 'UPLOADING' | 'ACCEPTED' | 'REJECTED' | 'CONFLICT';
  serverTimestamp?: string;
  rejectionReason?: string;
  conflictDetails?: { serverVersion: any; clientVersion: any };
  retryCount: number;
}

export interface SyncState {
  deviceId: string;
  lastSyncAt?: string;
  serverCursor: number;
  queueDepth: number;
  items: SyncQueueItem[];
  cacheSize: number;
  encrypted: boolean;
}

export interface MediaUpload {
  id: string;
  uploadId: string;
  parentId: string;
  parentEntity: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  chunkSize: number;
  totalChunks: number;
  uploadedChunks: number;
  status: 'INIT' | 'UPLOADING' | 'COMPLETE' | 'FAILED';
  attachmentId?: string;
}

export interface PortalToken {
  id: string;
  partnerId: string;
  portalType: 'VENDOR' | 'SUBCONTRACTOR' | 'CLIENT';
  issuedAt: string;
  expiresAt: string;
  scopes: string[];
}

export interface PortalSession {
  id: string;
  token: PortalToken;
  partnerId: string;
  portalType: 'VENDOR' | 'SUBCONTRACTOR' | 'CLIENT';
  startedAt: string;
  lastActivityAt: string;
  ipAddress: string;
  userAgent: string;
}

export interface VendorPortalData {
  purchaseOrders: { id: string; number: string; value: number; status: string; deliveryDate: string }[];
  dispatchAdvices: { id: string; poId: string; vehicleNo: string; invoiceNo: string; challanNo: string; ewbNo: string; submittedAt: string }[];
  invoices: { id: string; number: string; poId: string; amount: number; matchStatus: 'MATCHED' | 'BLOCKED'; blockReason?: string }[];
  payments: { id: string; invoiceId: string; amount: number; expectedDate: string; status: 'PENDING' | 'PAID' }[];
  scorecard: { criterion: string; score: number; weight: number; details: string }[];
}

export interface SubconPortalData {
  workOrders: { id: string; number: string; value: number; status: string }[];
  measurements: { id: string; woId: string; qty: number; value: number; submittedAt: string }[];
  bills: { id: string; number: string; amount: number; status: string }[];
  recoveries: { id: string; billId: string; head: string; amount: number }[];
  complianceDocs: { id: string; kind: string; validTo: string; status: 'VALID' | 'EXPIRING' | 'EXPIRED' }[];
  paymentBlockReason?: string;
}

export interface ClientPortalData {
  projectCode: string;
  progress: { physical: number; planned: number; financial: number };
  dprs: { id: string; date: string; summary: string; photos: string[] }[];
  bills: { id: string; number: string; submitted: number; certified: number; paid: number; shortfall?: { reason: string; amount: number }[] }[];
  drawings: { id: string; number: string; revision: string; status: 'IFC' | 'SUPERSEDED' }[];
  correspondence: { id: string; date: string; from: string; subject: string }[];
  inspectionRequests: { id: string; date: string; activity: string; status: 'PENDING' | 'APPROVED' | 'REJECTED' }[];
}

/* =========================== Part 10C — BID, Analytics, AI, Extensibility =========================== */

// BID Module - Tender & Bid Management
export type TenderStatus = 'IDENTIFIED' | 'SCREENED' | 'GO_NO_GO' | 'PREPARING' | 'SUBMITTED' | 'OPENED' | 'NEGOTIATING' | 'WON' | 'LOST' | 'WITHDRAWN' | 'CANCELLED';
export type TenderSource = 'PUBLIC_PORTAL' | 'DEPARTMENT' | 'PRIVATE' | 'NOMINATION' | 'JV_INVITATION';
export type ClientCategory = 'CENTRAL' | 'STATE' | 'PSU' | 'PRIVATE' | 'INTERNATIONAL';

export interface Tender {
  id: string;
  code: string;
  source: TenderSource;
  referenceNumber: string;
  clientId: string;
  clientCategory: ClientCategory;
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
  status: TenderStatus;
  owner: string;
  estimatorAssigned?: string;
  probability?: number;
  expectedMargin?: number;
  createdAt: string;
  updatedAt: string;
}

export interface EligibilityCriterion {
  id: string;
  tenderId: string;
  name: string;
  required: string;
  actual?: string;
  source: string;
  status: 'PASS' | 'FAIL' | 'PENDING';
  gap?: string;
}

export interface EligibilityScreening {
  id: string;
  tenderId: string;
  criteria: EligibilityCriterion[];
  overallStatus: 'ELIGIBLE' | 'INELIGIBLE' | 'PARTIAL';
  screenedBy: string;
  screenedAt: string;
}

export interface BidCapacityCalculation {
  id: string;
  tenderId: string;
  formula: string;
  a: number; // max value in any one year
  n: number; // number of years
  b: number; // existing commitments
  assessedCapacity: number;
  requiredCapacity: number;
  status: 'SUFFICIENT' | 'INSUFFICIENT';
  calculatedAt: string;
}

export type BidDecision = 'BID' | 'BID_WITH_CONDITIONS' | 'NO_BID';
export type NoBidReason = 'CAPACITY' | 'RISK' | 'GEOGRAPHY' | 'CLIENT' | 'COMPETITION' | 'RESOURCE' | 'STRATEGIC';

export interface BidNoBidDecision {
  id: string;
  tenderId: string;
  decision: BidDecision;
  reasonCode?: NoBidReason;
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
  decidedBy: string;
  decidedAt: string;
  approvedBy: string;
  approvedAt: string;
}

export interface EstimationItem {
  id: string;
  estimationId: string;
  itemCode: string;
  description: string;
  unit: string;
  quantity: number;
  rate: number;
  amount: number;
  rateSource: string;
  materialCost: number;
  labourCost: number;
  equipmentCost: number;
}

export interface IndirectCostItem {
  id: string;
  estimationId: string;
  category: string;
  description: string;
  durationMonths: number;
  monthlyCost: number;
  totalCost: number;
}

export interface RiskItem {
  id: string;
  estimationId: string;
  description: string;
  probability: number; // 0-1
  impact: number; // amount
  expectedValue: number;
  mitigation?: string;
}

export interface MarginSensitivity {
  scenario: string;
  margin: number;
  delta: number;
}

export interface Estimation {
  id: string;
  tenderId: string;
  items: EstimationItem[];
  directCost: number;
  indirectCosts: IndirectCostItem[];
  totalIndirectCost: number;
  risks: RiskItem[];
  totalRiskContingency: number;
  totalCost: number;
  bidAmount: number;
  baseMargin: number;
  marginSensitivity: MarginSensitivity[];
  cashFlowProjection: { month: number; inflow: number; outflow: number; net: number; cumulative: number }[];
  peakNegativeExposure: number;
  estimatedBy: string;
  estimatedAt: string;
}

export interface SubmissionDocument {
  id: string;
  estimationId: string;
  documentType: string;
  description: string;
  owner: string;
  status: 'PENDING' | 'READY' | 'SUBMITTED';
  submittedAt?: string;
}

export interface SubmissionSignOff {
  id: string;
  estimationId: string;
  pricedBoqHash: string;
  signedOffBy: string;
  signedOffAt: string;
  approvedBy: string;
  approvedAt: string;
}

export interface WinLossRecord {
  id: string;
  tenderId: string;
  result: 'WON' | 'LOST';
  reasonCode: string;
  ourRate?: number;
  l1Rate?: number;
  recordedAt: string;
  recordedBy: string;
}

export interface CompetitorRate {
  id: string;
  tenderId: string;
  competitorName: string;
  itemCode: string;
  rate: number;
  recordedAt: string;
}

// Analytics - Semantic Model
export interface FactTable {
  name: string;
  description: string;
  partitionedBy: string;
  lastRefreshedAt: string;
  rowCount: number;
}

export interface Dimension {
  name: string;
  description: string;
  slowlyChanging: boolean;
  hierarchy?: string[];
}

export interface SemanticModel {
  facts: FactTable[];
  dimensions: Dimension[];
  measures: { name: string; definition: string; factTable: string }[];
}

export interface Report {
  id: string;
  name: string;
  category: string;
  description: string;
  query: string;
  filters: Record<string, any>;
  columns: string[];
  createdBy: string;
  createdAt: string;
  lastRunAt?: string;
  scheduled?: boolean;
  scheduleRecipients?: string[];
}

// AI Layer
export interface AssistantQuery {
  id: string;
  userId: string;
  query: string;
  timestamp: string;
}

export interface AssistantResponse {
  id: string;
  queryId: string;
  answer: string;
  citations: { type: string; id: string; label: string }[];
  machineGenerated: boolean;
  timestamp: string;
}

// Part 10D — Roles, Approval Matrix, Migration, Cutover

export interface Role {
  id: string;
  name: string;
  description: string;
  category: 'ADMIN' | 'MANAGEMENT' | 'FINANCE' | 'PROCUREMENT' | 'STORES' | 'PROJECT' | 'COMMERCIAL' | 'HR' | 'OPERATIONS' | 'QUALITY' | 'SAFETY' | 'PORTAL' | 'SELF_SERVICE';
  authorizationObjects: string[];
  restrictions?: string[];
  portalAccess?: boolean;
  read_only?: boolean;
}

export interface ApprovalThreshold {
  id: string;
  companyCode: string;
  fiscalYear: string;
  documentType: string;
  level: number;
  amountFrom: number;
  amountTo: number;
  approverRole: string;
  approverName: string;
}

export interface ApprovalMatrix {
  id: string;
  documentType: string;
  description: string;
  levels: {
    level: number;
    role: string;
    amountThreshold?: number;
    conditions?: string[];
  }[];
}

export interface SoDConflict {
  id: string;
  role1: string;
  role2: string;
  risk: string;
  description: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface MigrationObject {
  id: string;
  sequence: number;
  object: string;
  source: string;
  reconciliation: string;
  status: 'PENDING' | 'LOADED' | 'RECONCILED' | 'SIGNED_OFF';
  count?: number;
  loadedAt?: string;
  reconciledAt?: string;
  signedOffBy?: string;
  signedOffAt?: string;
}

export interface MigrationRun {
  id: string;
  pass: 1 | 2 | 3;
  environment: 'SANDBOX' | 'PRODUCTION';
  startedAt: string;
  completedAt?: string;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED';
  objects: MigrationObject[];
  reconciliationReport?: string;
  errorLog?: string;
  signedOffBy?: string;
  signedOffAt?: string;
}

export interface CutoverActivity {
  id: string;
  daysBeforeGoLive: number;
  activity: string;
  owner: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  completedAt?: string;
}

export interface GoNoGoChecklist {
  id: string;
  criterion: string;
  status: 'NOT_MET' | 'MET' | 'WAIVED';
  evidence?: string;
  verifiedBy?: string;
  verifiedAt?: string;
}

export interface EndToEndTest {
  id: string;
  number: number;
  title: string;
  description: string;
  steps: string[];
  status: 'NOT_RUN' | 'RUNNING' | 'PASSED' | 'FAILED';
  evidence?: string;
  runAt?: string;
}

// Extensibility
export interface CustomField {
  id: string;
  entity: string; // e.g., 'Material', 'Partner', 'Doc'
  fieldName: string;
  fieldType: 'TEXT' | 'NUMBER' | 'DATE' | 'BOOLEAN' | 'SELECT';
  label: string;
  required: boolean;
  searchable: boolean;
  reportable: boolean;
  authorization?: string;
  options?: string[]; // for SELECT type
  createdAt: string;
  createdBy: string;
}

export interface ConfigTransport {
  id: string;
  name: string;
  sourceEnvironment: string;
  targetEnvironment: string;
  items: { type: string; id: string; name: string }[];
  dependencyCheck: 'PASS' | 'FAIL';
  dryRunReport: string;
  status: 'DRAFT' | 'VALIDATED' | 'DEPLOYED' | 'ROLLED_BACK';
  deployedAt?: string;
  deployedBy?: string;
  rolledBackAt?: string;
  rolledBackBy?: string;
  createdAt: string;
  createdBy: string;
}
