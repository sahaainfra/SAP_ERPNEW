/* ======================================================================== */
/*  VULCAN ERP — PART 10D: DATA MIGRATION & CUTOVER                         */
/*  Migration scope, reconciliation, cutover runbook                        */
/* ======================================================================== */

import type { ERPState, Res, MigrationObject, MigrationRun, CutoverActivity, GoNoGoChecklist, EndToEndTest } from './types';
import { cloneState, uid, nowStamp, pushAudit, round2 } from './engine';

/* ===================== Migration Scope ===================== */

export function initializeMigrationScope(sIn: ERPState, userId: string): Res {
  const s = cloneState(sIn);

  const objects: MigrationObject[] = [
    { id: 'MIG-01', sequence: 1, object: 'Company codes, tax units, sites, storage locations', source: 'Manual setup', reconciliation: 'Structure review sign-off', status: 'PENDING' },
    { id: 'MIG-02', sequence: 2, object: 'Chart of accounts, account determination, tax codes', source: 'Legacy books', reconciliation: 'Account count and hierarchy match', status: 'PENDING' },
    { id: 'MIG-03', sequence: 3, object: 'Cost centres, profit centres', source: 'Legacy', reconciliation: 'Count match', status: 'PENDING' },
    { id: 'MIG-04', sequence: 4, object: 'Business partners (vendors, subcontractors, clients)', source: 'Legacy + KYC files', reconciliation: 'Count match; PAN/GSTIN validity ≥ 95%', status: 'PENDING' },
    { id: 'MIG-05', sequence: 5, object: 'Material master with coefficients', source: 'Legacy + BOQ analysis', reconciliation: 'Count match; no duplicates', status: 'PENDING' },
    { id: 'MIG-06', sequence: 6, object: 'Employees and labour', source: 'HR records', reconciliation: 'Headcount match to payroll', status: 'PENDING' },
    { id: 'MIG-07', sequence: 7, object: 'Equipment and fixed assets', source: 'Asset register', reconciliation: 'Count and gross block match', status: 'PENDING' },
    { id: 'MIG-08', sequence: 8, object: 'Projects, WBS, cost codes', source: 'Project files', reconciliation: 'WBS structure review per project', status: 'PENDING' },
    { id: 'MIG-09', sequence: 9, object: 'Contracts and BOQ with executed quantities to date', source: 'Contract files + last RA bill', reconciliation: 'BOQ value ties to contract value; executed quantity ties to last certified bill', status: 'PENDING' },
    { id: 'MIG-10', sequence: 10, object: 'Project budgets', source: 'Budget files', reconciliation: 'Budget total per project matches approval', status: 'PENDING' },
    { id: 'MIG-11', sequence: 11, object: 'Rate library', source: 'Estimation files', reconciliation: 'Spot check 20 items', status: 'PENDING' },
    { id: 'MIG-12', sequence: 12, object: 'Opening stock with valuation', source: 'Physical count at cutover', reconciliation: 'Stock value ties to legacy stock account to the rupee', status: 'PENDING' },
    { id: 'MIG-13', sequence: 13, object: 'Opening trial balance', source: 'Legacy books', reconciliation: 'Ties to legacy trial balance to the rupee', status: 'PENDING' },
    { id: 'MIG-14', sequence: 14, object: 'Vendor open items, bill-wise', source: 'Legacy ageing', reconciliation: 'Sums to the payable control account', status: 'PENDING' },
    { id: 'MIG-15', sequence: 15, object: 'Customer open items, bill-wise', source: 'Legacy ageing', reconciliation: 'Sums to the receivable control account', status: 'PENDING' },
    { id: 'MIG-16', sequence: 16, object: 'Retention, security deposits, advances', source: 'Legacy', reconciliation: 'Sums to their control accounts', status: 'PENDING' },
    { id: 'MIG-17', sequence: 17, object: 'WIP / unbilled revenue', source: 'Project cost sheets', reconciliation: 'Ties to the WIP account and to project cost to date', status: 'PENDING' },
    { id: 'MIG-18', sequence: 18, object: 'Open purchase orders and commitments', source: 'Legacy', reconciliation: 'Value review; commitment reflected in budget availability', status: 'PENDING' },
    { id: 'MIG-19', sequence: 19, object: 'Open subcontract orders', source: 'Legacy', reconciliation: 'Value review', status: 'PENDING' },
    { id: 'MIG-20', sequence: 20, object: 'Guarantees and insurance policies', source: 'Register + bank confirmations', reconciliation: 'Count and value confirmed by the bank', status: 'PENDING' },
    { id: 'MIG-21', sequence: 21, object: 'Legal cases and claims', source: 'Legal files', reconciliation: 'Count review', status: 'PENDING' },
    { id: 'MIG-22', sequence: 22, object: 'Compliance registrations and licences', source: 'Compliance files', reconciliation: 'Validity dates verified', status: 'PENDING' },
    { id: 'MIG-23', sequence: 23, object: 'Drawings at current revision', source: 'DMS or file server', reconciliation: 'Current-revision count per project', status: 'PENDING' },
  ];

  // Create Pass 1 migration run
  const run: MigrationRun = {
    id: uid(),
    pass: 1,
    environment: 'SANDBOX',
    startedAt: nowStamp(),
    status: 'RUNNING',
    objects,
  };

  s.migrationRuns.push(run);

  pushAudit(s, userId, 'CONFIG', 'MIGRATION', run.id, {
    reason: `Migration scope initialized: ${objects.length} objects, Pass 1 started`,
  });

  return { s, ok: true, msg: `Migration scope initialized: ${objects.length} objects`, tone: 'ok', docId: run.id };
}

export function completeMigrationObject(sIn: ERPState, runId: string, objectId: string, count: number, userId: string): Res {
  const s = cloneState(sIn);
  const run = s.migrationRuns.find((r) => r.id === runId);
  if (!run) return { s, ok: false, msg: 'Migration run not found', tone: 'bad' };

  const obj = run.objects.find((o) => o.id === objectId);
  if (!obj) return { s, ok: false, msg: 'Migration object not found', tone: 'bad' };

  obj.count = count;
  obj.loadedAt = nowStamp();
  obj.status = 'LOADED';

  return { s, ok: true, msg: `Object ${obj.object} loaded: ${count} records`, tone: 'ok' };
}

export function reconcileMigrationObject(sIn: ERPState, runId: string, objectId: string, userId: string): Res {
  const s = cloneState(sIn);
  const run = s.migrationRuns.find((r) => r.id === runId);
  if (!run) return { s, ok: false, msg: 'Migration run not found', tone: 'bad' };

  const obj = run.objects.find((o) => o.id === objectId);
  if (!obj) return { s, ok: false, msg: 'Migration object not found', tone: 'bad' };

  if (obj.status !== 'LOADED') {
    return { s, ok: false, msg: 'Object must be loaded before reconciliation', tone: 'bad' };
  }

  obj.reconciledAt = nowStamp();
  obj.status = 'RECONCILED';

  return { s, ok: true, msg: `Object ${obj.object} reconciled`, tone: 'ok' };
}

export function signOffMigrationObject(sIn: ERPState, runId: string, objectId: string, userId: string): Res {
  const s = cloneState(sIn);
  const run = s.migrationRuns.find((r) => r.id === runId);
  if (!run) return { s, ok: false, msg: 'Migration run not found', tone: 'bad' };

  const obj = run.objects.find((o) => o.id === objectId);
  if (!obj) return { s, ok: false, msg: 'Migration object not found', tone: 'bad' };

  if (obj.status !== 'RECONCILED') {
    return { s, ok: false, msg: 'Object must be reconciled before sign-off', tone: 'bad' };
  }

  obj.signedOffBy = userId;
  obj.signedOffAt = nowStamp();
  obj.status = 'SIGNED_OFF';

  pushAudit(s, userId, 'CHANGE', 'MIGRATION_SIGNOFF', obj.id, {
    reason: `Migration object signed off: ${obj.object}`,
  });

  return { s, ok: true, msg: `Object ${obj.object} signed off by ${userId}`, tone: 'ok' };
}

export function verifyMigrationReconciliation(s: ERPState, runId: string): {
  trialBalanceMatch: boolean;
  stockValueMatch: boolean;
  openItemsMatch: boolean;
  projectCostMatch: boolean;
  guaranteeMatch: boolean;
  overall: boolean;
} {
  const run = s.migrationRuns.find((r) => r.id === runId);
  if (!run) {
    return { trialBalanceMatch: false, stockValueMatch: false, openItemsMatch: false, projectCostMatch: false, guaranteeMatch: false, overall: false };
  }

  // Check critical reconciliation points
  const tb = run.objects.find((o) => o.id === 'MIG-13');
  const stock = run.objects.find((o) => o.id === 'MIG-12');
  const vendorOI = run.objects.find((o) => o.id === 'MIG-14');
  const customerOI = run.objects.find((o) => o.id === 'MIG-15');
  const projectCost = run.objects.find((o) => o.id === 'MIG-09');
  const guarantees = run.objects.find((o) => o.id === 'MIG-20');

  const trialBalanceMatch = tb?.status === 'SIGNED_OFF';
  const stockValueMatch = stock?.status === 'SIGNED_OFF';
  const openItemsMatch = vendorOI?.status === 'SIGNED_OFF' && customerOI?.status === 'SIGNED_OFF';
  const projectCostMatch = projectCost?.status === 'SIGNED_OFF';
  const guaranteeMatch = guarantees?.status === 'SIGNED_OFF';

  const overall = trialBalanceMatch && stockValueMatch && openItemsMatch && projectCostMatch && guaranteeMatch;

  return { trialBalanceMatch, stockValueMatch, openItemsMatch, projectCostMatch, guaranteeMatch, overall };
}

/* ===================== Cutover Runbook ===================== */

export function initializeCutoverRunbook(sIn: ERPState, goLiveDate: string, userId: string): Res {
  const s = cloneState(sIn);
  const goLive = new Date(goLiveDate);
  const today = new Date(s.today);
  const daysBefore = Math.round((goLive.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  const activities: CutoverActivity[] = [
    { id: 'CUT-01', daysBeforeGoLive: 60, activity: 'Pass 1 trial load; reconciliation reports issued', owner: 'Implementation', status: 'PENDING' },
    { id: 'CUT-02', daysBeforeGoLive: 45, activity: 'Business owner sign-off per migration object', owner: 'Object owners', status: 'PENDING' },
    { id: 'CUT-03', daysBeforeGoLive: 40, activity: 'User acceptance testing begins on the loaded sandbox', owner: 'Key users', status: 'PENDING' },
    { id: 'CUT-04', daysBeforeGoLive: 30, activity: 'Pass 2 corrected load; UAT defects triaged', owner: 'Implementation', status: 'PENDING' },
    { id: 'CUT-05', daysBeforeGoLive: 21, activity: 'Penetration test complete, findings closed and retested', owner: 'IT + vendor', status: 'PENDING' },
    { id: 'CUT-06', daysBeforeGoLive: 21, activity: 'Load test executed, results published', owner: 'IT', status: 'PENDING' },
    { id: 'CUT-07', daysBeforeGoLive: 14, activity: 'Training complete; competency check per role', owner: 'HR + Implementation', status: 'PENDING' },
    { id: 'CUT-08', daysBeforeGoLive: 14, activity: 'Production environment ready; backup and restore tested', owner: 'IT', status: 'PENDING' },
    { id: 'CUT-09', daysBeforeGoLive: 7, activity: 'Configuration transport to production, verified by dry run', owner: 'Sys Admin', status: 'PENDING' },
    { id: 'CUT-10', daysBeforeGoLive: 7, activity: 'Legacy data entry freeze announced', owner: 'Management', status: 'PENDING' },
    { id: 'CUT-11', daysBeforeGoLive: 3, activity: 'Physical stock count at all sites', owner: 'Store Managers', status: 'PENDING' },
    { id: 'CUT-12', daysBeforeGoLive: 1, activity: 'Legacy system read-only; final balances extracted', owner: 'Finance', status: 'PENDING' },
    { id: 'CUT-13', daysBeforeGoLive: 0, activity: 'Pass 3 final load begins (T-1 evening)', owner: 'Implementation', status: 'PENDING' },
    { id: 'CUT-14', daysBeforeGoLive: 0, activity: 'Reconciliation review; Finance Controller sign-off; GO / NO-GO (T-0 morning)', owner: 'Finance Controller + Management', status: 'PENDING' },
    { id: 'CUT-15', daysBeforeGoLive: 0, activity: 'Production live; hypercare desk staffed on site (T+0)', owner: 'All', status: 'PENDING' },
    { id: 'CUT-16', daysBeforeGoLive: -14, activity: 'Daily reconciliation of stock ledger vs GL; daily issue triage (T+1 to T+14)', owner: 'Finance + IT', status: 'PENDING' },
    { id: 'CUT-17', daysBeforeGoLive: -30, activity: 'Parallel run for finance complete; legacy reconciled and closed (T+30)', owner: 'Finance Controller', status: 'PENDING' },
    { id: 'CUT-18', daysBeforeGoLive: -45, activity: 'Post-implementation review; benefits baseline recorded (T+45)', owner: 'Management', status: 'PENDING' },
  ];

  s.cutoverActivities = activities;

  pushAudit(s, userId, 'CONFIG', 'CUTOVER', 'INIT', {
    reason: `Cutover runbook initialized: ${activities.length} activities, go-live ${goLiveDate}`,
  });

  return { s, ok: true, msg: `Cutover runbook initialized: ${activities.length} activities`, tone: 'ok' };
}

export function completeCutoverActivity(sIn: ERPState, activityId: string, userId: string): Res {
  const s = cloneState(sIn);
  const activity = s.cutoverActivities.find((a) => a.id === activityId);
  if (!activity) return { s, ok: false, msg: 'Activity not found', tone: 'bad' };

  activity.status = 'COMPLETED';
  activity.completedAt = nowStamp();

  return { s, ok: true, msg: `Activity completed: ${activity.activity}`, tone: 'ok' };
}

/* ===================== Go/No-Go Checklist ===================== */

export function initializeGoNoGoChecklist(sIn: ERPState, userId: string): Res {
  const s = cloneState(sIn);

  const checklist: GoNoGoChecklist[] = [
    { id: 'GNG-01', criterion: 'Migration reconciliation clean per §D.3, signed by the Finance Controller', status: 'NOT_MET' },
    { id: 'GNG-02', criterion: 'All Part 1–10C acceptance gates passed', status: 'NOT_MET' },
    { id: 'GNG-03', criterion: 'Penetration test findings closed and retested', status: 'NOT_MET' },
    { id: 'GNG-04', criterion: 'Load test targets met', status: 'NOT_MET' },
    { id: 'GNG-05', criterion: 'Backup restored into a clean environment and verified', status: 'NOT_MET' },
    { id: 'GNG-06', criterion: 'Training complete with a competency check per role', status: 'NOT_MET' },
    { id: 'GNG-07', criterion: 'Hypercare staffing confirmed, including on-site presence at the pilot project', status: 'NOT_MET' },
    { id: 'GNG-08', criterion: 'Rollback procedure documented and rehearsed, with a named decision-maker and a stated decision deadline', status: 'NOT_MET' },
  ];

  s.goNoGoChecklist = checklist;

  pushAudit(s, userId, 'CONFIG', 'GO_NO_GO', 'INIT', {
    reason: `Go/No-Go checklist initialized: ${checklist.length} criteria`,
  });

  return { s, ok: true, msg: `Go/No-Go checklist initialized: ${checklist.length} criteria`, tone: 'ok' };
}

export function verifyGoNoGoCriterion(sIn: ERPState, criterionId: string, evidence: string, userId: string): Res {
  const s = cloneState(sIn);
  const criterion = s.goNoGoChecklist.find((c) => c.id === criterionId);
  if (!criterion) return { s, ok: false, msg: 'Criterion not found', tone: 'bad' };

  criterion.status = 'MET';
  criterion.evidence = evidence;
  criterion.verifiedBy = userId;
  criterion.verifiedAt = nowStamp();

  return { s, ok: true, msg: `Criterion verified: ${criterion.criterion}`, tone: 'ok' };
}

export function checkGoNoGoReadiness(s: ERPState): { ready: boolean; met: number; total: number; missing: string[] } {
  const met = s.goNoGoChecklist.filter((c) => c.status === 'MET').length;
  const total = s.goNoGoChecklist.length;
  const missing = s.goNoGoChecklist.filter((c) => c.status !== 'MET').map((c) => c.criterion);
  const ready = met === total;

  return { ready, met, total, missing };
}

/* ===================== End-to-End Tests ===================== */

export function initializeEndToEndTests(sIn: ERPState, userId: string): Res {
  const s = cloneState(sIn);

  const tests: EndToEndTest[] = [
    {
      id: 'E2E-01', number: 1,
      title: 'Tender → award → contract → project → WBS → BOQ → budget baseline',
      description: 'With the tender estimate live as plan version V0',
      steps: ['Create tender', 'Eligibility screening', 'Bid decision', 'Estimation', 'Submission', 'Award', 'Convert to contract', 'Create project', 'Generate WBS from template', 'Import BOQ', 'Set budget baseline'],
      status: 'NOT_RUN',
    },
    {
      id: 'E2E-02', number: 2,
      title: 'Requisition → RFQ → comparative → order → gate entry → weighbridge → receipt → inspection → usage decision → put-away → invoice → three-way match → payment → bank file → bank reconciliation',
      description: 'With correct postings at every step and GR-IR clearing netting to zero',
      steps: ['Create requisition', 'Issue RFQ', 'Receive quotations', 'Comparative statement', 'Create PO', 'Gate entry', 'Weighbridge', 'Goods receipt', 'Inspection lot', 'Usage decision', 'Put-away', 'Vendor invoice', 'Three-way match', 'Payment proposal', 'Bank file', 'Bank reconciliation'],
      status: 'NOT_RUN',
    },
    {
      id: 'E2E-03', number: 3,
      title: 'Material request → reservation → issue → acknowledgement → WBS consumption → project cost',
      description: 'With the stock ledger reconciling to the general ledger to the paisa',
      steps: ['Create material request', 'Create reservation', 'Issue material', 'Receiver acknowledgement', 'Post consumption to WBS', 'Verify project cost', 'Reconcile stock ledger to GL'],
      status: 'NOT_RUN',
    },
    {
      id: 'E2E-04', number: 4,
      title: 'Measurement → certification → RA bill (escalation, secured advance, all recoveries, tax) → submission → certification → invoice → receivable → collection',
      description: 'With submitted, certified and paid tracked separately and the certification shortfall categorised',
      steps: ['Create measurement', 'Certify measurement', 'Create RA bill with escalation', 'Add secured advance', 'Apply recoveries', 'Compute tax', 'Submit bill', 'Client certification', 'Generate invoice', 'Post receivable', 'Receive payment'],
      status: 'NOT_RUN',
    },
    {
      id: 'E2E-05', number: 5,
      title: 'Subcontract order → free-issue and recoverable material → measurement → bill with recoveries → compliance check → payment',
      description: 'With the compliance block demonstrated and overridden only by Legal with reason',
      steps: ['Create subcontract order', 'Issue free-issue material', 'Issue recoverable material', 'Subcontractor measurement', 'Create subcontractor bill', 'Apply recoveries', 'Compliance check (blocked)', 'Legal override with reason', 'Release payment'],
      status: 'NOT_RUN',
    },
    {
      id: 'E2E-06', number: 6,
      title: 'Employee → geo-attendance including an offline punch, a mock-location rejection, a geofence exception and a correction → approval → payroll → statutory posting → return file',
      description: 'Full attendance lifecycle with exceptions',
      steps: ['Register employee', 'Offline punch', 'Sync punch', 'Mock-location rejection', 'Geofence exception', 'Attendance correction', 'Approval', 'Payroll run', 'Statutory posting', 'Generate return file'],
      status: 'NOT_RUN',
    },
    {
      id: 'E2E-07', number: 7,
      title: 'Equipment allocation → daily log → fuel → maintenance order → settlement → project cost',
      description: 'With a fuel exception raised and an expired-insurance allocation blocked',
      steps: ['Allocate equipment', 'Daily log entry', 'Fuel entry', 'Fuel exception raised', 'Attempt allocation with expired insurance (blocked)', 'Create maintenance order', 'Issue spares', 'Settle to project cost'],
      status: 'NOT_RUN',
    },
    {
      id: 'E2E-08', number: 8,
      title: 'Production order → mix design → moisture correction → batching → dispatch → site receipt → cube test → invoice → consumption reconciliation',
      description: 'With cement variance flagged',
      steps: ['Create production order', 'Define mix design', 'Moisture correction', 'Batching', 'Dispatch', 'Site receipt', 'Cube test', 'Generate invoice', 'Consumption reconciliation', 'Flag cement variance'],
      status: 'NOT_RUN',
    },
    {
      id: 'E2E-09', number: 9,
      title: 'Hindrance → notice deadline alert → EOT claim → variation → contract amendment → revised value → LD recomputation',
      description: 'With the claim evidence bundle auto-assembled',
      steps: ['Record hindrance', 'Notice deadline alert', 'Create EOT claim', 'Auto-assemble evidence bundle', 'Create variation', 'Amend contract', 'Revised contract value', 'Recompute LD exposure'],
      status: 'NOT_RUN',
    },
    {
      id: 'E2E-10', number: 10,
      title: 'Dispute → case register → contingent provision → financial statement notes',
      description: 'With the limitation alert firing',
      steps: ['Create dispute case', 'Register in case register', 'Assess contingent liability', 'Post provision', 'Generate financial statement notes', 'Limitation alert fires'],
      status: 'NOT_RUN',
    },
    {
      id: 'E2E-11', number: 11,
      title: 'Period close: all 18 cockpit steps → soft close → reports → hard close',
      description: 'With a post-close posting attempt correctly refused and a material reconciliation variance blocking close until explained',
      steps: ['Execute 18 cockpit steps', 'Soft close', 'Generate reports', 'Attempt post-close posting (refused)', 'Material reconciliation variance', 'PM explanation', 'Hard close'],
      status: 'NOT_RUN',
    },
    {
      id: 'E2E-12', number: 12,
      title: 'Communication: defect photo in a site conversation → converted to a non-conformance → linked to the measurement → that quantity blocked from billing → resolved → thread exported as an indexed, hashed PDF',
      description: 'Full communication-to-resolution lifecycle',
      steps: ['Capture defect photo', 'Post to conversation', 'Convert to NCR', 'Link to measurement', 'Block quantity from billing', 'Resolve NCR', 'Export thread as PDF with hash'],
      status: 'NOT_RUN',
    },
  ];

  s.endToEndTests = tests;

  pushAudit(s, userId, 'CONFIG', 'E2E_TESTS', 'INIT', {
    reason: `End-to-end tests initialized: ${tests.length} scenarios`,
  });

  return { s, ok: true, msg: `End-to-end tests initialized: ${tests.length} scenarios`, tone: 'ok' };
}

export function runEndToEndTest(sIn: ERPState, testId: string, evidence: string, userId: string): Res {
  const s = cloneState(sIn);
  const test = s.endToEndTests.find((t) => t.id === testId);
  if (!test) return { s, ok: false, msg: 'Test not found', tone: 'bad' };

  test.status = 'PASSED';
  test.evidence = evidence;
  test.runAt = nowStamp();

  pushAudit(s, userId, 'CHANGE', 'E2E_TEST', test.id, {
    reason: `End-to-end test passed: ${test.title}`,
  });

  return { s, ok: true, msg: `Test passed: ${test.title}`, tone: 'ok' };
}

export function checkEndToEndCompletion(s: ERPState): { completed: number; total: number; pct: number } {
  const completed = s.endToEndTests.filter((t) => t.status === 'PASSED').length;
  const total = s.endToEndTests.length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  return { completed, total, pct };
}
