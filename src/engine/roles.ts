/* ======================================================================== */
/*  VULCAN ERP — PART 10D: ROLES & APPROVAL MATRIX                          */
/*  Role catalog, approval workflows, segregation of duties                 */
/* ======================================================================== */

import type { ERPState, Res, Role, ApprovalThreshold, ApprovalMatrix, SoDConflict } from './types';
import { cloneState, uid, nowStamp, pushAudit } from './engine';

/* ===================== Role Catalog ===================== */

export function initializeRoles(sIn: ERPState, userId: string): Res {
  const s = cloneState(sIn);

  const roles: Role[] = [
    // Administrative
    { id: 'ROLE-SYS-ADMIN', name: 'System Administrator', description: 'Enterprise structure, roles, authorizations, numbering, document types, workflows, geofences, tax and compliance configuration', category: 'ADMIN', authorizationObjects: ['PLT_CONFIG', 'ORG_STRUCT', 'PLT_AUTH', 'HCM_GEOFENCE'] },
    { id: 'ROLE-IT-ADMIN', name: 'IT Administrator', description: 'Infrastructure, backups, integrations, technical support, provisioning, security monitoring', category: 'ADMIN', authorizationObjects: ['PLT_INFRA', 'PLT_INTEGRATION'], restrictions: ['No business data access'] },

    // Management
    { id: 'ROLE-DIR', name: 'Management / Director', description: 'Executive launchpad, control tower, company-wide financials, final release above thresholds, budget and bid approval', category: 'MANAGEMENT', authorizationObjects: ['*_DISPLAY', '*_RELEASE_TOP'] },

    // Finance
    { id: 'ROLE-FIN-CTRL', name: 'Finance Controller', description: 'Chart of accounts, financial policy, period close, statement sign-off, high-value journal release, tax oversight', category: 'FINANCE', authorizationObjects: ['FIN_DOC_ALL', 'FIN_PERIOD', 'FIN_COA', 'CTL_ALL'] },
    { id: 'ROLE-FIN-MGR', name: 'Finance Manager', description: 'Cash flow, banking, guarantee margins, loan schedules, payment proposal review, ageing', category: 'FINANCE', authorizationObjects: ['FIN_BANK', 'FIN_PAY_RELEASE_F', 'CMP_INSTRUMENT'] },
    { id: 'ROLE-ACCT-MGR', name: 'Accounts Manager', description: 'Bookkeeping supervision, match exceptions, tax return data, asset register, bank reconciliation', category: 'FINANCE', authorizationObjects: ['FIN_DOC_02_43', 'FIN_ASSET', 'FIN_RECON'] },
    { id: 'ROLE-ACCT-EXEC', name: 'Accounts Executive', description: 'Voucher entry, routine invoice verification, cash and petty cash', category: 'FINANCE', authorizationObjects: ['FIN_DOC_01_02'], restrictions: ['No release authority'] },

    // Procurement
    { id: 'ROLE-PRC-MGR', name: 'Procurement Manager', description: 'Sourcing policy, vendor empanelment, order release within limit, vendor evaluation, rate contracts', category: 'PROCUREMENT', authorizationObjects: ['PRC_PO_43_LIMIT', 'PRC_VENDOR', 'PRC_CONTRACT'] },
    { id: 'ROLE-PRC-OFF', name: 'Purchase Officer', description: 'RFQ, quotation comparison, order creation within limit, delivery follow-up', category: 'PROCUREMENT', authorizationObjects: ['PRC_PR', 'PRC_RFQ', 'PRC_PO_01_02_LIMIT'] },

    // Stores
    { id: 'ROLE-STR-MGR', name: 'Store Manager', description: 'Stock accuracy, adjustment approval within limit, physical inventory sign-off, reorder discipline', category: 'STORES', authorizationObjects: ['INV_MOVE_43', 'INV_COUNT'] },
    { id: 'ROLE-STR-KPR', name: 'Store Keeper', description: 'Gate entry, goods receipt, issue, returns, bin management, counting', category: 'STORES', authorizationObjects: ['INV_MOVE_01_02_SITE'] },

    // Project
    { id: 'ROLE-PM', name: 'Project Manager', description: 'Project delivery — schedule, cost, quality, safety, client interface. Approves DPR, measurement, bill submission, site requisitions, attendance corrections. Owns project P&L', category: 'PROJECT', authorizationObjects: ['PRJ_WBS_ALL_SCOPED', 'BIL_MB_43', 'HCM_ATT_43'] },
    { id: 'ROLE-PE', name: 'Project Engineer', description: 'Work package execution, subcontractor and gang coordination, material requests, measurement verification', category: 'PROJECT', authorizationObjects: ['PRJ_WBS_01_02_03_SCOPED'] },
    { id: 'ROLE-SITE-ENG', name: 'Site Engineer', description: 'DPR, field measurement, material requests, hindrance recording, quality and safety field reporting', category: 'PROJECT', authorizationObjects: ['PRJ_DPR', 'BIL_MB_01', 'INV_REQ_01'] },
    { id: 'ROLE-QS', name: 'Quantity Surveyor', description: 'Measurement certification, client and subcontractor bills, variation and extra-item tracking, quantity reconciliation', category: 'PROJECT', authorizationObjects: ['BIL_MB_43', 'BIL_RA_01_02', 'CTR_VO'] },
    { id: 'ROLE-PLAN-ENG', name: 'Planning Engineer', description: 'Schedule, baseline, progress, look-ahead, delay analysis, resource simulation', category: 'PROJECT', authorizationObjects: ['PRJ_SCHED', 'PRJ_BASELINE_43'] },

    // Commercial
    { id: 'ROLE-COM-MGR', name: 'Commercial Manager', description: 'Contract administration, variations, EOT, claims, notices, LD exposure, instrument status', category: 'COMMERCIAL', authorizationObjects: ['CTR_ALL', 'BIL_RA_43', 'CMP_INSTRUMENT'] },
    { id: 'ROLE-CON-MGR', name: 'Contracts Manager', description: 'Work orders and subcontract agreements, claims register, final settlements', category: 'COMMERCIAL', authorizationObjects: ['SUB_SO', 'CTR_CLAIM'] },
    { id: 'ROLE-TENDER-MGR', name: 'Tender Manager', description: 'Pipeline, eligibility, bid decision, submission package, consortium coordination, win-loss analytics', category: 'COMMERCIAL', authorizationObjects: ['BID_ALL'] },
    { id: 'ROLE-EST-ENG', name: 'Estimation Engineer', description: 'Rate analysis, cost estimates, rate library, bid costing', category: 'COMMERCIAL', authorizationObjects: ['CTR_RATE', 'BID_EST'] },

    // HR
    { id: 'ROLE-HR-MGR', name: 'HR Manager', description: 'Employee lifecycle, leave and payroll approval, statutory registers with Legal, attendance exception review', category: 'HR', authorizationObjects: ['HCM_EMP_ALL_GROUPS', 'HCM_ATT_43', 'HCM_PAY_43'] },
    { id: 'ROLE-PAY-OFF', name: 'Payroll Officer', description: 'Payroll processing, salary structures, statutory deductions and returns, employee records', category: 'HR', authorizationObjects: ['HCM_PAY_01_02', 'HCM_EMP_COMPENSATION'] },

    // Operations
    { id: 'ROLE-SAFETY-MGR', name: 'Safety Manager', description: 'Inductions, toolbox talks, permits, inspections, incident investigation, statistics', category: 'SAFETY', authorizationObjects: ['EHS_ALL'] },
    { id: 'ROLE-QC-MGR', name: 'QA/QC Manager', description: 'Inspection plans, checklist library, usage decisions, test results, material approvals, NCR closure, calibration', category: 'QUALITY', authorizationObjects: ['QMS_ALL_43'] },
    { id: 'ROLE-PLANT-MGR', name: 'Plant Manager', description: 'Equipment allocation, transfers, maintenance plans, fuel efficiency, document validity, cost per hour', category: 'OPERATIONS', authorizationObjects: ['EAM_ALL_43'] },
    { id: 'ROLE-PROD-MGR', name: 'Production Manager', description: 'Mix design, production planning, batching, dispatch, quality clearance, production reconciliation', category: 'OPERATIONS', authorizationObjects: ['PRD_ALL'] },
    { id: 'ROLE-DOC-CTRL', name: 'Document Controller', description: 'Drawing register, revisions, transmittals, issued-for-construction currency, retention', category: 'OPERATIONS', authorizationObjects: ['DMS_ALL_43'] },

    // Legal
    { id: 'ROLE-LEGAL', name: 'Legal & Compliance Officer', description: 'Disputes and arbitration, compliance calendar with HR, guarantee and insurance registers, contract risk', category: 'COMMERCIAL', authorizationObjects: ['CMP_LEGAL', 'CMP_STATUTORY', 'CMP_INSTRUMENT'] },

    // Audit
    { id: 'ROLE-AUDITOR', name: 'Internal Auditor', description: 'Read-only across all modules with full change-document visibility; reviews approval adherence and duty-segregation exceptions', category: 'ADMIN', authorizationObjects: ['*_03', 'PLT_AUDIT_03'], read_only: true },

    // Self-service
    { id: 'ROLE-EMP', name: 'Employee', description: 'Own attendance, leave, payslips, documents; raises requests routed to the reporting manager', category: 'SELF_SERVICE', authorizationObjects: ['SELF_SERVICE'] },
    { id: 'ROLE-LABOUR', name: 'Labour', description: 'Geofenced or supervisor-marked attendance; own wage and attendance record; wage queries', category: 'SELF_SERVICE', authorizationObjects: ['SELF_SERVICE'] },

    // Portal roles
    { id: 'ROLE-VENDOR', name: 'Vendor (portal)', description: 'Own orders, invoices, payment status, compliance uploads, queries', category: 'PORTAL', authorizationObjects: ['PORTAL_VENDOR'], portalAccess: true },
    { id: 'ROLE-SUBCON', name: 'Subcontractor (portal)', description: 'Own order and BOQ, measurements, bills, recoveries, compliance uploads', category: 'PORTAL', authorizationObjects: ['PORTAL_SUBCON'], portalAccess: true },
    { id: 'ROLE-CLIENT', name: 'Client / Consultant (portal)', description: 'Own project progress, reports, photographs, bill and measurement approval, issued drawings, site instructions', category: 'PORTAL', authorizationObjects: ['PORTAL_CLIENT'], portalAccess: true },
  ];

  s.roles = roles;

  pushAudit(s, userId, 'CONFIG', 'ROLES', 'INIT', {
    reason: `Role catalog initialized: ${roles.length} roles`,
  });

  return { s, ok: true, msg: `Role catalog initialized: ${roles.length} roles`, tone: 'ok' };
}

/* ===================== Approval Matrix ===================== */

export function initializeApprovalMatrix(sIn: ERPState, userId: string): Res {
  const s = cloneState(sIn);

  const matrix: ApprovalMatrix[] = [
    {
      id: 'AM-PR',
      documentType: 'PR-STD',
      description: 'Purchase Requisition',
      levels: [
        { level: 1, role: 'ROLE-PE' },
        { level: 2, role: 'ROLE-PM', amountThreshold: 100000 },
        { level: 3, role: 'ROLE-PRC-MGR', amountThreshold: 500000 },
        { level: 4, role: 'ROLE-DIR', amountThreshold: 1000000 },
      ],
    },
    {
      id: 'AM-PO',
      documentType: 'PO-STD',
      description: 'Purchase Order',
      levels: [
        { level: 1, role: 'ROLE-PRC-OFF' },
        { level: 2, role: 'ROLE-PRC-MGR' },
        { level: 3, role: 'ROLE-FIN-MGR', amountThreshold: 2000000, conditions: ['Co-sign required'] },
        { level: 4, role: 'ROLE-DIR', amountThreshold: 5000000 },
      ],
    },
    {
      id: 'AM-PAY',
      documentType: 'PV-VEN',
      description: 'Payment Release',
      levels: [
        { level: 1, role: 'ROLE-ACCT-EXEC' },
        { level: 2, role: 'ROLE-ACCT-MGR' },
        { level: 3, role: 'ROLE-FIN-MGR' },
        { level: 4, role: 'ROLE-DIR', amountThreshold: 10000000 },
      ],
    },
    {
      id: 'AM-SO',
      documentType: 'SO-STD',
      description: 'Subcontract Order',
      levels: [
        { level: 1, role: 'ROLE-COM-MGR' },
        { level: 2, role: 'ROLE-PM' },
        { level: 3, role: 'ROLE-DIR', amountThreshold: 5000000 },
      ],
    },
    {
      id: 'AM-BILL',
      documentType: 'RA-INT',
      description: 'Client RA Bill',
      levels: [
        { level: 1, role: 'ROLE-QS' },
        { level: 2, role: 'ROLE-PM' },
        { level: 3, role: 'ROLE-COM-MGR' },
        { level: 4, role: 'ROLE-DIR', conditions: ['Disputed amounts'] },
      ],
    },
    {
      id: 'AM-MEAS',
      documentType: 'MB-STD',
      description: 'Measurement Entry',
      levels: [
        { level: 1, role: 'ROLE-SITE-ENG' },
        { level: 2, role: 'ROLE-QS' },
        { level: 3, role: 'ROLE-PE', conditions: ['Verification'] },
        { level: 4, role: 'ROLE-PM' },
      ],
    },
    {
      id: 'AM-VO',
      documentType: 'VO-STD',
      description: 'Variation / Extra Item',
      levels: [
        { level: 1, role: 'ROLE-PE' },
        { level: 2, role: 'ROLE-PM' },
        { level: 3, role: 'ROLE-COM-MGR' },
        { level: 4, role: 'ROLE-DIR', amountThreshold: 1000000 },
      ],
    },
    {
      id: 'AM-BID',
      documentType: 'BID-DEC',
      description: 'Bid Go / No-Go',
      levels: [
        { level: 1, role: 'ROLE-TENDER-MGR' },
        { level: 2, role: 'ROLE-EST-ENG' },
        { level: 3, role: 'ROLE-COM-MGR' },
        { level: 4, role: 'ROLE-DIR', conditions: ['Strategic decisions'] },
      ],
    },
    {
      id: 'AM-BUD',
      documentType: 'BUD-SUP',
      description: 'Project Budget / Supplement',
      levels: [
        { level: 1, role: 'ROLE-PM' },
        { level: 2, role: 'ROLE-COM-MGR' },
        { level: 3, role: 'ROLE-FIN-CTRL' },
        { level: 4, role: 'ROLE-DIR' },
      ],
    },
    {
      id: 'AM-JV',
      documentType: 'JV-GEN',
      description: 'Journal Voucher',
      levels: [
        { level: 1, role: 'ROLE-ACCT-EXEC' },
        { level: 2, role: 'ROLE-ACCT-MGR' },
        { level: 3, role: 'ROLE-FIN-CTRL', amountThreshold: 5000000 },
      ],
    },
    {
      id: 'AM-PERIOD',
      documentType: 'PERIOD-CLOSE',
      description: 'Period Close / Reopen',
      levels: [
        { level: 1, role: 'ROLE-ACCT-MGR' },
        { level: 2, role: 'ROLE-FIN-CTRL' },
        { level: 3, role: 'ROLE-DIR', conditions: ['Reopen only'] },
      ],
    },
    {
      id: 'AM-PAYROLL',
      documentType: 'PY-RUN',
      description: 'Payroll Run',
      levels: [
        { level: 1, role: 'ROLE-PAY-OFF' },
        { level: 2, role: 'ROLE-HR-MGR' },
        { level: 3, role: 'ROLE-FIN-MGR', conditions: ['Funding confirmation'] },
        { level: 4, role: 'ROLE-FIN-CTRL' },
      ],
    },
    {
      id: 'AM-BG',
      documentType: 'BG-ISSUE',
      description: 'Guarantee Issue / Release',
      levels: [
        { level: 1, role: 'ROLE-COM-MGR' },
        { level: 2, role: 'ROLE-LEGAL' },
        { level: 3, role: 'ROLE-FIN-CTRL' },
        { level: 4, role: 'ROLE-DIR', conditions: ['Signing authority'] },
      ],
    },
    {
      id: 'AM-VENDOR-BANK',
      documentType: 'VENDOR-BANK',
      description: 'Vendor Bank Change',
      levels: [
        { level: 1, role: 'ROLE-ACCT-EXEC' },
        { level: 2, role: 'ROLE-ACCT-MGR' },
        { level: 3, role: 'ROLE-FIN-MGR' },
        { level: 4, role: 'ROLE-FIN-CTRL' },
      ],
    },
  ];

  s.approvalMatrix = matrix;

  pushAudit(s, userId, 'CONFIG', 'APPROVAL_MATRIX', 'INIT', {
    reason: `Approval matrix initialized: ${matrix.length} document types`,
  });

  return { s, ok: true, msg: `Approval matrix initialized: ${matrix.length} document types`, tone: 'ok' };
}

/* ===================== Segregation of Duties ===================== */

export function initializeSoDConflicts(sIn: ERPState, userId: string): Res {
  const s = cloneState(sIn);

  const conflicts: SoDConflict[] = [
    { id: 'SOD-01', role1: 'PRC_VENDOR', role2: 'FIN_PAY_RELEASE', risk: 'Payment to a fictitious or altered vendor', description: 'Vendor master maintenance + payment release', severity: 'HIGH' },
    { id: 'SOD-02', role1: 'VENDOR_BANK', role2: 'FIN_PAY_RELEASE', risk: 'The primary fraud vector in the industry', description: 'Vendor bank change + payment release', severity: 'HIGH' },
    { id: 'SOD-03', role1: 'INV_GR', role2: 'FIN_IV_POST', risk: 'Payment for goods never received', description: 'Goods receipt + invoice posting', severity: 'HIGH' },
    { id: 'SOD-04', role1: 'PRC_PO_CREATE', role2: 'PRC_PO_RELEASE', risk: 'Uncontrolled commitment', description: 'Purchase order creation + order release', severity: 'MEDIUM' },
    { id: 'SOD-05', role1: 'BIL_MB_ENTRY', role2: 'BIL_MB_CERTIFY', risk: 'Overstated execution', description: 'Measurement entry + measurement certification', severity: 'HIGH' },
    { id: 'SOD-06', role1: 'BIL_MB_CERTIFY', role2: 'BIL_RA_APPROVE', risk: 'Overstated billing', description: 'Measurement certification + bill approval', severity: 'HIGH' },
    { id: 'SOD-07', role1: 'PRJ_BUDGET_OWNER', role2: 'PRJ_BUDGET_SUPPLEMENT', risk: 'Uncontrolled budget growth', description: 'Budget owner + budget supplement approval', severity: 'MEDIUM' },
    { id: 'SOD-08', role1: 'INV_ADJ_ENTRY', role2: 'INV_ADJ_APPROVE', risk: 'Concealment of shortage', description: 'Stock adjustment entry + adjustment approval', severity: 'HIGH' },
    { id: 'SOD-09', role1: 'HCM_PAY_PROCESS', role2: 'HCM_PAY_RELEASE', risk: 'Ghost employees', description: 'Payroll processing + payroll release', severity: 'HIGH' },
    { id: 'SOD-10', role1: 'HCM_EMP_MAINTAIN', role2: 'HCM_PAY_PROCESS', risk: 'Ghost employees', description: 'Employee master maintenance + payroll processing', severity: 'HIGH' },
    { id: 'SOD-11', role1: 'FIN_JV_ENTRY', role2: 'FIN_PERIOD_CLOSE', risk: 'Concealment of unposted adjustment', description: 'Journal entry + period close', severity: 'MEDIUM' },
    { id: 'SOD-12', role1: 'PLT_CONFIG_CHANGE', role2: 'PLT_CONFIG_TRANSPORT', risk: 'Unreviewed control change', description: 'Configuration change + transport to production', severity: 'MEDIUM' },
  ];

  s.sodConflicts = conflicts;

  pushAudit(s, userId, 'CONFIG', 'SOD_CONFLICTS', 'INIT', {
    reason: `SoD conflict matrix initialized: ${conflicts.length} conflicts`,
  });

  return { s, ok: true, msg: `SoD conflict matrix initialized: ${conflicts.length} conflicts`, tone: 'ok' };
}

/* ===================== Approval Engine Rules ===================== */

export function checkMakerChecker(s: ERPState, docId: string, approverId: string): Res {
  const doc = s.docs.find((d) => d.id === docId);
  if (!doc) return { s, ok: false, msg: 'Document not found', tone: 'bad' };

  // Maker ≠ checker ≠ approver, absolutely
  if (doc.createdBy === approverId) {
    return { s, ok: false, msg: 'Maker ≠ checker: initiator cannot approve their own document', tone: 'bad' };
  }

  return { s, ok: true, msg: 'Maker-checker check passed', tone: 'ok' };
}

export function checkBulkApproval(s: ERPState, docType: string): Res {
  // Bulk approval permitted only for explicitly configured document types
  const bulkApprovable = ['PR-STD', 'PO-STD', 'IV-VEN'];
  const highRisk = ['PV-VEN', 'PO-AMD', 'CN-CLI', 'BG-ISSUE', 'PERIOD-REOPEN'];

  if (highRisk.includes(docType)) {
    return { s, ok: false, msg: `Bulk approval not permitted for ${docType} — high-risk document`, tone: 'bad' };
  }

  if (!bulkApprovable.includes(docType)) {
    return { s, ok: false, msg: `Bulk approval not configured for ${docType}`, tone: 'bad' };
  }

  return { s, ok: true, msg: 'Bulk approval permitted', tone: 'ok' };
}

export function getApprovalPath(s: ERPState, docType: string, amount: number): { level: number; role: string; conditions?: string[] }[] {
  const matrix = s.approvalMatrix.find((m) => m.documentType === docType);
  if (!matrix) return [];

  return matrix.levels
    .filter((level) => !level.amountThreshold || amount >= level.amountThreshold)
    .map((level) => ({ level: level.level, role: level.role, conditions: level.conditions }));
}
