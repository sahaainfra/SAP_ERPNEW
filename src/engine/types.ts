// Part 10C Types - Tender & Bid, Analytics, AI, Extensibility

export type TenderStatus = 
  | 'IDENTIFIED' | 'SCREENED' | 'GO_NO_GO' | 'PREPARING' 
  | 'SUBMITTED' | 'OPENED' | 'NEGOTIATING' 
  | 'WON' | 'LOST' | 'WITHDRAWN' | 'CANCELLED';

export interface Tender {
  id: string;
  code: string;
  source: 'PUBLIC_PORTAL' | 'DEPARTMENT' | 'PRIVATE' | 'NOMINATION' | 'JV_INVITATION';
  referenceNumber: string;
  client: string;
  clientCategory: 'CENTRAL' | 'STATE' | 'PSU' | 'PRIVATE' | 'INTERNATIONAL';
  workDescription: string;
  location: string;
  state: string;
  estimatedCost: number;
  earnestMoney: number;
  tenderFee: number;
  completionPeriod: number; // days
  defectLiabilityPeriod: number; // months
  publishDate: string;
  clarificationDeadline: string;
  preBidMeetingDate?: string;
  submissionDeadline: string;
  openingDate: string;
  bidValidityPeriod: number; // days
  contractType: string;
  status: TenderStatus;
  owner: string;
  estimatorAssigned?: string;
  probability?: number;
  expectedMargin?: number;
  createdAt: string;
}

export interface EligibilityCriterion {
  id: string;
  tenderId: string;
  name: string;
  required: string;
  actual: string;
  pass: boolean;
  gap?: string;
}

export interface BidDecision {
  id: string;
  tenderId: string;
  decision: 'BID' | 'BID_WITH_CONDITIONS' | 'NO_BID';
  reasonCode: string;
  strategicRationale: string;
  clientHistory: string;
  competitionAssessment: string;
  resourceAvailability: string;
  riskAssessment: string;
  expectedMarginRange: string;
  winProbability: number;
  capitalRequirement: number;
  approvedBy: string;
  approvedAt: string;
}

export interface RiskItem {
  id: string;
  tenderId: string;
  description: string;
  probability: number; // 0-1
  impact: number; // monetary value
  mitigation: string;
}

export interface MarginSensitivity {
  scenario: string;
  margin: number;
  delta: number;
}

export interface WinLossRecord {
  id: string;
  tenderId: string;
  result: 'WON' | 'LOST';
  reasonCode: string;
  ourRate: number;
  l1Rate?: number;
  competitorRates?: Record<string, number>;
  recordedAt: string;
}

// Analytics - Semantic Layer
export interface FactTable {
  name: string;
  description: string;
  columns: string[];
  rowCount: number;
  lastRefresh: string;
}

export interface Dimension {
  name: string;
  description: string;
  hierarchy: string[];
}

export interface Measure {
  code: string;
  name: string;
  description: string;
  formula: string;
  unit: string;
}

export interface Report {
  id: string;
  name: string;
  category: string;
  measures: string[];
  filters: Record<string, any>;
  authorizationScope: string;
  createdAt: string;
}

// AI Layer
export interface AIQuery {
  id: string;
  userId: string;
  query: string;
  response: string;
  citedRecords: string[];
  timestamp: string;
}

export interface AIGuardrail {
  rule: string;
  description: string;
  enforced: boolean;
}

// Extensibility
export interface CustomField {
  id: string;
  entity: string;
  fieldName: string;
  fieldType: 'TEXT' | 'NUMBER' | 'DATE' | 'BOOLEAN' | 'SELECT';
  label: string;
  required: boolean;
  authorization: string;
  searchable: boolean;
  reportable: boolean;
}

export interface ConfigurationTransport {
  id: string;
  name: string;
  objects: string[];
  fromEnvironment: string;
  toEnvironment: string;
  status: 'DRAFT' | 'VALIDATED' | 'APPLIED' | 'ROLLED_BACK';
  appliedBy?: string;
  appliedAt?: string;
  rollbackAvailable: boolean;
}

// State
export interface Part10CState {
  tenders: Tender[];
  eligibilityCriteria: EligibilityCriterion[];
  bidDecisions: BidDecision[];
  risks: RiskItem[];
  marginSensitivities: MarginSensitivity[];
  winLossRecords: WinLossRecord[];
  factTables: FactTable[];
  dimensions: Dimension[];
  measures: Measure[];
  reports: Report[];
  aiQueries: AIQuery[];
  aiGuardrails: AIGuardrail[];
  customFields: CustomField[];
  configTransports: ConfigurationTransport[];
  aiEnabled: boolean;
}
