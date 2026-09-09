// Part 8 Types - People, Plant, Production, Quality & Safety

export type EmployeeGroup = 'PERMANENT' | 'CONTRACTUAL' | 'RETAINER' | 'TRAINEE' | 'LABOUR';
export type EmployeeSubgroup = 'MANAGEMENT' | 'STAFF' | 'SUPERVISOR' | 'OPERATOR' | 'SKILLED' | 'SEMI_SKILLED' | 'UNSKILLED';
export type PunchType = 'IN' | 'OUT' | 'BREAK_START' | 'BREAK_END';

export interface PersonnelArea {
  code: string;
  name: string;
  companyId: string;
  region: string;
}

export interface PersonnelSubarea {
  code: string;
  name: string;
  areaCode: string;
  type: 'SITE' | 'HEAD_OFFICE' | 'WORKSHOP' | 'PLANT' | 'CAMP';
}

export interface Employee {
  id: string;
  code: string;
  name: string;
  email: string;
  phone: string;
  areaCode: string;
  subareaCode: string;
  group: EmployeeGroup;
  subgroup: EmployeeSubgroup;
  position: string;
  managerId?: string;
  joinDate: string;
  status: 'ONBOARDING' | 'PROBATION' | 'ACTIVE' | 'ON_LEAVE' | 'TERMINATED';
  bankDetails?: {
    accountNo: string;
    ifsc: string;
    bankName: string;
  };
  statutoryIds?: {
    pan?: string;
    aadhaar?: string;
    uan?: string;
    esiNo?: string;
  };
  competencies: Competency[];
}

export interface Competency {
  type: 'OPERATOR_LICENCE' | 'WELDER_QUAL' | 'SAFETY_CERT' | 'FIRST_AID' | 'STATUTORY';
  name: string;
  validFrom: string;
  validTo: string;
  issuedBy: string;
  documentRef?: string;
}

export interface AttendancePunch {
  id: string;
  employeeId: string;
  punchType: PunchType;
  timestamp: string;
  clientTimestamp: string;
  clockSkew: number;
  latitude: number;
  longitude: number;
  accuracy: number;
  geofenceId?: string;
  deviceId: string;
  shift: string;
  workFront?: string;
  gang?: string;
  status: 'VALID' | 'FLAGGED' | 'REJECTED';
  flagReason?: string;
}

export interface AttendanceCorrection {
  id: string;
  punchId: string;
  reason: string;
  correctedBy: string;
  approvedByPM: string;
  approvedByHR: string;
  timestamp: string;
}

export interface LabourGang {
  id: string;
  code: string;
  name: string;
  supervisorId: string;
  contractorId?: string;
  trade: string;
  members: string[]; // employee IDs
  siteCode: string;
  projectCode: string;
}

export interface WageType {
  code: string;
  name: string;
  type: 'EARNING' | 'DEDUCTION' | 'EMPLOYER_CONTRIBUTION' | 'REIMBURSEMENT';
  calculationRule: string;
  statutoryTreatment: string;
  glAccount: string;
  processingSequence: number;
}

export interface PayrollRun {
  id: string;
  period: string;
  status: 'SIMULATION' | 'FINAL' | 'POSTED';
  runDate: string;
  employeeCount: number;
  totalGross: number;
  totalDeductions: number;
  totalNet: number;
  postedBy: string;
}

export interface PayrollEntry {
  id: string;
  payrollRunId: string;
  employeeId: string;
  basicPay: number;
  allowances: number;
  overtime: number;
  grossPay: number;
  deductions: {
    pf: number;
    esi: number;
    tds: number;
    other: number;
  };
  netPay: number;
  wbsCode: string;
  costCentre: string;
}

export interface Equipment {
  id: string;
  code: string;
  name: string;
  category: string;
  make: string;
  model: string;
  serialNo: string;
  purchaseDate: string;
  purchaseValue: number;
  location: string;
  siteCode?: string;
  projectCode?: string;
  status: 'AVAILABLE' | 'DEPLOYED' | 'UNDER_MAINTENANCE' | 'RETIRED';
  operatorId?: string;
  currentHm?: number;
  currentOdometer?: number;
  fuelNormLph?: number;
  documents: EquipmentDocument[];
}

export interface EquipmentDocument {
  type: 'INSURANCE' | 'FITNESS' | 'PERMIT' | 'POLLUTION' | 'ROAD_TAX';
  number: string;
  validFrom: string;
  validTo: string;
  issuedBy: string;
}

export interface EquipmentLog {
  id: string;
  equipmentId: string;
  date: string;
  shift: string;
  operatorId: string;
  projectCode?: string;
  wbsCode?: string;
  openingHm: number;
  closingHm: number;
  openingOdometer?: number;
  closingOdometer?: number;
  workingHours: number;
  idleHours: number;
  breakdownHours: number;
  standbyHours: number;
  fuelIssued: number;
  workPerformed?: string;
  quantityAchieved?: number;
  status: 'VALID' | 'FLAGGED';
  flagReason?: string;
}

export interface MaintenanceOrder {
  id: string;
  number: string;
  equipmentId: string;
  type: 'PREVENTIVE' | 'BREAKDOWN';
  description: string;
  reportedDate: string;
  plannedDate?: string;
  completedDate?: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  reportedBy: string;
  assignedTo?: string;
  rootCause?: string;
  downtimeHours: number;
  cost: {
    labour: number;
    spares: number;
    external: number;
  };
}

export interface TripSheet {
  id: string;
  number: string;
  vehicleId: string;
  driverId: string;
  date: string;
  origin: string;
  destination: string;
  material?: string;
  loadQuantity?: number;
  startOdometer: number;
  endOdometer: number;
  fuelConsumed: number;
  tollCharges: number;
  projectCode?: string;
  transportDocRef?: string;
}

export interface MixDesign {
  id: string;
  code: string;
  grade: string;
  proportions: {
    cement: number;
    scm: number;
    fineAggregate: number;
    coarseAggregate: number;
    water: number;
    admixture: number;
  };
  targetSlump: number;
  wcRatio: number;
  trialMixResults?: {
    date: string;
    slumpAchieved: number;
    strength7Day: number;
    strength28Day: number;
  };
  approvedBy: string;
  validFrom: string;
  validTo?: string;
  clientApprovalRef?: string;
}

export interface BatchTicket {
  id: string;
  number: string;
  mixDesignId: string;
  batchDate: string;
  batchTime: string;
  volume: number;
  actualWeights: {
    cement: number;
    scm: number;
    fineAggregate: number;
    coarseAggregate: number;
    water: number;
    admixture: number;
  };
  moistureCorrection: {
    sand: number;
    aggregate: number;
  };
  slumpTest: number;
  operatorId: string;
  plantCode: string;
  dispatchChallan?: string;
}

export interface InspectionLot {
  id: string;
  number: string;
  type: 'IL-GRN' | 'IL-WRK' | 'IL-PRD' | 'IL-SRC';
  sourceDocId: string;
  materialId?: string;
  projectCode?: string;
  wbsCode?: string;
  quantity: number;
  createdDate: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'ACCEPTED' | 'REJECTED' | 'ACCEPTED_WITH_DEVIATION';
  inspectionDate?: string;
  inspectorId?: string;
  usageDecision?: string;
  remarks?: string;
}

export interface TestResult {
  id: string;
  lotId: string;
  testType: 'CUBE_7DAY' | 'CUBE_28DAY' | 'SLUMP' | 'SOIL' | 'AGGREGATE' | 'STEEL' | 'NDT';
  testDate: string;
  specimenId: string;
  result: number;
  unit: string;
  specification: string;
  pass: boolean;
  testedBy: string;
  equipmentId?: string;
  certificateNo?: string;
}

export interface NonConformance {
  id: string;
  number: string;
  raisedDate: string;
  raisedBy: string;
  severity: 'MINOR' | 'MAJOR' | 'CRITICAL';
  description: string;
  location?: string;
  batchTicketId?: string;
  deliveryChallanId?: string;
  measurementId?: string;
  assignedTo?: string;
  rootCause?: string;
  correctiveAction?: string;
  preventiveAction?: string;
  verificationDate?: string;
  verifiedBy?: string;
  status: 'RAISED' | 'ASSIGNED' | 'IN_PROGRESS' | 'VERIFIED' | 'CLOSED';
  rectificationCost?: number;
}

export interface PermitToWork {
  id: string;
  number: string;
  type: 'HEIGHT' | 'CONFINED_SPACE' | 'HOT_WORK' | 'EXCAVATION' | 'ELECTRICAL' | 'LIFTING' | 'ROAD_CLOSURE' | 'NIGHT_WORK';
  issuedDate: string;
  validFrom: string;
  validTo: string;
  location: string;
  projectCode: string;
  issuerId: string;
  receiverId: string;
  preconditions: {
    description: string;
    checked: boolean;
    checkedBy?: string;
  }[];
  gasTestRequired: boolean;
  gasTestResult?: {
    oxygen: number;
    lel: number;
    h2s: number;
    co: number;
    testedBy: string;
    testTime: string;
  };
  riskAssessment?: string;
  status: 'ISSUED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  closureDate?: string;
  closedBy?: string;
}

export interface SafetyIncident {
  id: string;
  number: string;
  incidentDate: string;
  incidentTime: string;
  location: string;
  projectCode: string;
  severity: 'NEAR_MISS' | 'FIRST_AID' | 'MEDICAL_TREATMENT' | 'LOST_TIME' | 'FATALITY';
  description: string;
  personsInvolved: string[];
  reportedBy: string;
  reportedTo?: string;
  investigationDate?: string;
  rootCause?: string;
  correctiveActions?: string[];
  preventiveActions?: string[];
  daysLost?: number;
  status: 'REPORTED' | 'UNDER_INVESTIGATION' | 'CLOSED';
  closedDate?: string;
  closedBy?: string;
}

export interface SafetyStatistics {
  projectCode: string;
  period: string;
  manHoursWorked: number;
  lostTimeInjuries: number;
  daysLost: number;
  ltif: number; // Lost Time Injury Frequency
  severityRate: number;
  safeManHoursSinceLastLTI: number;
  nearMissReported: number;
  toolboxTalksHeld: number;
  toolboxTalkCoverage: number; // percentage
  ppeCompliance: number; // percentage
  permitsIssued: number;
  permitsClosed: number;
}

export interface WasteRecord {
  id: string;
  date: string;
  projectCode: string;
  wasteType: 'CD_WASTE' | 'HAZARDOUS' | 'USED_OIL' | 'OTHER';
  quantity: number;
  unit: string;
  disposedBy?: string;
  disposalManifest?: string;
  disposalDate?: string;
}
