/* ------------------------------------------------------------------ */
/* VULCAN ERP — platform core domain model (original implementation)   */
/* ------------------------------------------------------------------ */

export type ModuleCode =
  | 'PLT' | 'ORG' | 'FIN' | 'CTL' | 'PRC' | 'INV' | 'PRJ' | 'CTR' | 'BIL' | 'SUB'
  | 'EAM' | 'PRD' | 'QMS' | 'HCM' | 'EHS' | 'DMS' | 'BID' | 'CMP' | 'ANA' | 'EXT';

export type StockType = 'UNR' | 'QH' | 'BLK' | 'TRN' | 'SUB' | 'RET';
export type StockTypeName = 'Unrestricted' | 'Quality Hold' | 'Blocked' | 'Transit' | 'At Subcontractor' | 'Returnable';

export type MasterStatus = 'DRAFT' | 'PENDING' | 'ACTIVE' | 'BLOCKED';
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
  wbs: WbsElement[];
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
}

export interface StockRow {
  siteId: string;
  locId: string;
  materialCode: string;
  stockType: StockType;
  qty: number;
  value: number;
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
}

export interface Res {
  s: ERPState;
  ok: boolean;
  msg: string;
  tone: 'ok' | 'bad' | 'warn' | 'info';
  docId?: string;
}
