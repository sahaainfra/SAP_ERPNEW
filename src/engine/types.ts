// Minimal, working ERP types - focused on core functionality

export type DocStatus = 'DRAFT' | 'SUBMITTED' | 'PENDING_RELEASE' | 'RELEASED' | 'POSTED' | 'REJECTED' | 'CANCELLED';

export interface Doc {
  id: string;
  number?: string;
  type: string;
  companyId: string;
  siteId: string;
  partnerId?: string;
  dateISO: string;
  total: number;
  status: DocStatus;
  items: DocItem[];
  createdBy: string;
  note?: string;
  refId?: string;
  wbs?: string;
}

export interface DocItem {
  line: number;
  materialCode: string;
  desc: string;
  qty: number;
  uom: string;
  rate: number;
  received?: number;
  invoiced?: number;
  wbs?: string;
  cc?: string;
}

export interface StockRow {
  materialCode: string;
  siteId: string;
  locId: string;
  qty: number;
  value: number;
  stockType?: string;
}

export interface AuditEntry {
  id: string;
  userId: string;
  category: string;
  action: string;
  object: string;
  key: string;
  field?: string;
  oldV?: string;
  newV?: string;
  reason?: string;
  at: string;
}

export interface Material {
  code: string;
  desc: string;
  group: string;
  baseUom: string;
  price: number;
  altUom?: string;
  conv?: number;
}

export interface Partner {
  id: string;
  name: string;
  regType?: string;
  stateName?: string;
  tdsSection?: string;
  tdsPct?: number;
}

export interface OperatingSite {
  code: string;
  name: string;
  distanceKm?: number;
  storageLocs?: any[];
}

export interface Equipment {
  code: string;
  desc: string;
  category?: string;
  ownership?: string;
  operatorId?: string;
  hourMeter?: number;
  fuelNormLph?: number;
  status?: string;
  internalRate?: number;
  wbs?: string;
}

export interface EquipmentLog {
  id: string;
  equipmentId: string;
  date: string;
  openingHm: number;
  closingHm: number;
  workHrs: number;
  idleHrs: number;
  brkdnHrs: number;
  standbyHrs: number;
  fuelL: number;
  operatorId?: string;
  wbs?: string;
}

export interface MaintOrder {
  id: string;
  number: string;
  equipmentCode: string;
  type: string;
  status: string;
  sparesCost: number;
  laborCost: number;
  extCost: number;
  downtimeHrs: number;
}

export interface InspectionLot {
  id: string;
  number: string;
  type: string;
  materialCode: string;
  qty: number;
  siteId: string;
  atCreated: string;
}

export interface TestResult {
  id: string;
  kind: string;
  material: string;
  grade: string;
  value: number;
  spec: string;
  pass: boolean;
  ageDays?: number;
  batch?: string;
  pourLoc?: string;
  challan?: string;
}

export interface Ncr {
  id: string;
  number: string;
  severity: string;
  status: string;
  dueAt: string;
  link?: any;
}

export interface SubcontractOrder {
  id: string;
  number: string;
  subconId: string;
  projectCode: string;
  wbs: string;
  lines: any[];
  retentionPct: number;
  materialRecoveryRate: Record<string, number>;
}

export interface BoqItem {
  id: string;
  contractId: string;
  itemCode: string;
  desc: string;
  tenderQty: number;
  tenderRate: number;
  executedCum: number;
  revisedQty: number;
  deviationLimitPct: number;
  approved: boolean;
  provisional?: boolean;
}

export interface ContractMaster {
  id: string;
  number: string;
  projectCode: string;
  revisedValue: number;
  mobilisationAdvancePct: number;
  recoveryStartPct: number;
  advanceInterestPct: number;
  recoveryRatePct: number;
  retentionPct: number;
  retentionCeilingPct: number;
  priceAdjustment: boolean;
}

export interface RaRunRecord {
  id: string;
  projectCode: string;
  expectedLoss: number;
}

export interface CostForecast {
  id: string;
  projectCode: string;
  forecast: number;
}

export interface RecLine {
  materialCode: string;
  siteId: string;
  locId: string;
  ledgerValue: number;
  glValue: number;
  break: number;
}

export interface StockRecRun {
  id: string;
  at: string;
  status: string;
}

export interface CountVarianceApproval {
  id: string;
  band: string;
}

export interface MatReconLine {
  materialCode: string;
  theoretical: number;
  flag: string;
}

export interface MatReconDoc {
  id: string;
  number: string;
  lines: MatReconLine[];
}

export interface HindranceEvent {
  id: string;
  contractId: string;
  eventDate: string;
}

export interface Rfi {
  id: string;
  number: string;
}

export interface SiteInstruction {
  id: string;
  number: string;
}

export interface RaPosting {
  id: string;
  projectCode: string;
}

export interface ERPState {
  v: number;
  today: string;
  userId: string;
  companyFilter: string;
  seq: Record<string, number>;
  docs: Doc[];
  stock: StockRow[];
  audit: AuditEntry[];
  materials: Material[];
  partners: Partner[];
  sites: OperatingSite[];
  equipment: Equipment[];
  eqLogs: EquipmentLog[];
  maintOrders: MaintOrder[];
  inspLots: InspectionLot[];
  tests: TestResult[];
  ncrs: Ncr[];
  suborders: SubcontractOrder[];
  boq: BoqItem[];
  contracts: ContractMaster[];
  raRunHistory: RaRunRecord[];
  costForecasts: CostForecast[];
  stockRecRuns: StockRecRun[];
  varianceApprovals: CountVarianceApproval[];
  matRecons: MatReconDoc[];
  hindranceRegs: HindranceEvent[];
  rfis: Rfi[];
  siteInstructions: SiteInstruction[];
  raPostings: RaPosting[];
  launchpadConfigs: any[];
  equipment?: Equipment[];
  suborders?: SubcontractOrder[];
}

export interface Res {
  s: ERPState;
  ok: boolean;
  msg: string;
  tone: 'ok' | 'bad' | 'warn' | 'info';
  docId?: string;
}

export interface PRItemArgs {
  materialCode: string;
  qty: number;
  wbs?: string;
  cc?: string;
  category: string;
}

export interface PriceResult {
  payable: number;
  net: number;
  gross: number;
}

export type AuditCategory = 'CHANGE' | 'SECURITY' | 'SYSTEM' | 'SYSTEM';
