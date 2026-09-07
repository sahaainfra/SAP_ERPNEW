/* ======================================================================== */
/*  VULCAN ERP — PART 10C: ANALYTICS & REPORTING                            */
/*  Semantic model, standard reports, report builder, BI extraction         */
/* ======================================================================== */

import type { ERPState, Res, SemanticModel, FactTable, Dimension, Report } from './types';
import { cloneState, uid, nowStamp, pushAudit, round2, fmtINR } from './engine';

/* ===================== Semantic Model ===================== */

export function initializeSemanticModel(sIn: ERPState, userId: string): Res {
  const s = cloneState(sIn);

  const facts: FactTable[] = [
    { name: 'fact_journal', description: 'Every posted journal line with full dimensions', partitionedBy: 'period', lastRefreshedAt: nowStamp(), rowCount: s.journals.reduce((sum, j) => sum + j.lines.length, 0) },
    { name: 'fact_stock_movement', description: 'Every material document line with value', partitionedBy: 'period', lastRefreshedAt: nowStamp(), rowCount: s.docs.filter((d) => d.module === 'INV').length },
    { name: 'fact_commitment', description: 'Open requisition / order / subcontract value by date', partitionedBy: 'period', lastRefreshedAt: nowStamp(), rowCount: s.docs.filter((d) => ['PR-STD', 'PO-STD', 'SO-STD'].includes(d.type)).length },
    { name: 'fact_measurement', description: 'Certified quantity by BOQ item and period', partitionedBy: 'period', lastRefreshedAt: nowStamp(), rowCount: s.measurements.length },
    { name: 'fact_billing', description: 'Submitted / certified / paid by bill and item', partitionedBy: 'period', lastRefreshedAt: nowStamp(), rowCount: s.raBills.length },
    { name: 'fact_procurement', description: 'Requisition → order → receipt → invoice cycle events', partitionedBy: 'period', lastRefreshedAt: nowStamp(), rowCount: s.docs.filter((d) => d.module === 'PRC').length },
    { name: 'fact_attendance', description: 'Punch-derived man-days by person, project, category', partitionedBy: 'period', lastRefreshedAt: nowStamp(), rowCount: s.attendancePunches.length },
    { name: 'fact_plant_log', description: 'Hours, fuel, downtime by equipment and day', partitionedBy: 'period', lastRefreshedAt: nowStamp(), rowCount: s.eqLogs.length },
    { name: 'fact_production', description: 'Batch output and raw material consumption', partitionedBy: 'period', lastRefreshedAt: nowStamp(), rowCount: s.batchTickets.length },
    { name: 'fact_quality', description: 'Inspection lots, results, non-conformances', partitionedBy: 'period', lastRefreshedAt: nowStamp(), rowCount: s.inspLots.length },
    { name: 'fact_safety', description: 'Incidents, observations, man-hours, permits', partitionedBy: 'period', lastRefreshedAt: nowStamp(), rowCount: s.incidents.length },
    { name: 'fact_budget', description: 'Budget by version, WBS, cost code, period', partitionedBy: 'period', lastRefreshedAt: nowStamp(), rowCount: Object.keys(s.budgets).length },
  ];

  const dimensions: Dimension[] = [
    { name: 'dim_date', description: 'Calendar with fiscal calendar, period, week, monsoon flag', slowlyChanging: false },
    { name: 'dim_company', description: 'Company code', slowlyChanging: false },
    { name: 'dim_site', description: 'Operating site', slowlyChanging: false },
    { name: 'dim_tax_unit', description: 'Tax registration unit', slowlyChanging: false },
    { name: 'dim_business_unit', description: 'Business unit', slowlyChanging: false },
    { name: 'dim_project', description: 'Project definition', slowlyChanging: false },
    { name: 'dim_wbs', description: 'WBS hierarchy flattened with parent path', slowlyChanging: true, hierarchy: ['project', 'package', 'reach', 'structure', 'level', 'work', 'activity'] },
    { name: 'dim_cost_code', description: 'Cost code (material, labour, plant, subcontract, overhead)', slowlyChanging: false },
    { name: 'dim_cost_centre', description: 'Cost centre', slowlyChanging: false },
    { name: 'dim_profit_centre', description: 'Profit centre', slowlyChanging: false },
    { name: 'dim_material', description: 'Material with group hierarchy', slowlyChanging: true, hierarchy: ['group', 'subgroup', 'material'] },
    { name: 'dim_partner', description: 'Business partner with role flags', slowlyChanging: true },
    { name: 'dim_employee', description: 'Employee', slowlyChanging: true },
    { name: 'dim_equipment', description: 'Equipment', slowlyChanging: false },
    { name: 'dim_account', description: 'GL account with hierarchy', slowlyChanging: false, hierarchy: ['group', 'account'] },
    { name: 'dim_document_type', description: 'Document type', slowlyChanging: false },
    { name: 'dim_reason_code', description: 'Reason code', slowlyChanging: false },
    { name: 'dim_status', description: 'Status', slowlyChanging: false },
  ];

  const measures = [
    { name: 'certified_value', definition: 'Sum of certified quantities × rates from fact_measurement joined to fact_billing', factTable: 'fact_billing' },
    { name: 'submitted_value', definition: 'Sum of submitted quantities × rates from fact_billing', factTable: 'fact_billing' },
    { name: 'paid_value', definition: 'Sum of paid amounts from fact_billing', factTable: 'fact_billing' },
    { name: 'stock_value', definition: 'Sum of stock quantity × moving average price from fact_stock_movement', factTable: 'fact_stock_movement' },
    { name: 'commitment_value', definition: 'Sum of open order value from fact_commitment', factTable: 'fact_commitment' },
    { name: 'actual_cost', definition: 'Sum of journal lines with cost object from fact_journal', factTable: 'fact_journal' },
    { name: 'budget_value', definition: 'Sum of budget from fact_budget', factTable: 'fact_budget' },
    { name: 'man_days', definition: 'Count of distinct attendance punch dates from fact_attendance', factTable: 'fact_attendance' },
    { name: 'equipment_hours', definition: 'Sum of working hours from fact_plant_log', factTable: 'fact_plant_log' },
    { name: 'fuel_consumed', definition: 'Sum of fuel litres from fact_plant_log', factTable: 'fact_plant_log' },
  ];

  s.semanticModel = { facts, dimensions, measures };

  pushAudit(s, userId, 'CONFIG', 'SEMANTIC_MODEL', 'INIT', {
    reason: `Semantic model initialized: ${facts.length} facts, ${dimensions.length} dimensions, ${measures.length} measures`,
  });

  return { s, ok: true, msg: `Semantic model initialized: ${facts.length} facts, ${dimensions.length} dimensions`, tone: 'ok' };
}

/* ===================== Standard Reports ===================== */

export function createStandardReport(
  sIn: ERPState,
  args: {
    name: string;
    category: string;
    description: string;
    query: string;
    filters: Record<string, any>;
    columns: string[];
    createdBy: string;
  },
  userId: string,
): Res {
  const s = cloneState(sIn);

  const report: Report = {
    id: uid(),
    ...args,
    createdAt: nowStamp(),
  };

  s.reports.unshift(report);

  pushAudit(s, userId, 'CHANGE', 'REPORT', report.id, {
    reason: `Standard report created: ${report.name}`,
  });

  return { s, ok: true, msg: `Report created: ${report.name}`, tone: 'ok', docId: report.id };
}

export function runReport(
  sIn: ERPState,
  reportId: string,
  userId: string,
): Res {
  const s = cloneState(sIn);
  const report = s.reports.find((r) => r.id === reportId);
  if (!report) return { s, ok: false, msg: 'Report not found', tone: 'bad' };

  // In a real implementation, this would execute the query against the semantic model
  // For now, return a mock result
  report.lastRunAt = nowStamp();

  return {
    s,
    ok: true,
    msg: `Report executed: ${report.name}`,
    tone: 'ok',
    detail: JSON.stringify({
      asAt: nowStamp(),
      rows: 0,
      columns: report.columns,
    }),
  };
}

export function getStandardReportCatalog(): { category: string; reports: string[] }[] {
  return [
    {
      category: 'Project',
      reports: ['Project MIS', 'Daily Progress', 'Hindrance Register', 'WBS Cost Report', 'BOQ Progress', 'Deviation Statement', 'Schedule Variance', 'Earned Value'],
    },
    {
      category: 'Commercial',
      reports: ['RA Bill Abstract', 'Certification Shortfall Analysis', 'Variation Register', 'Billing at Risk', 'Claims Register', 'EOT Register', 'Retention Register', 'Guarantee Register'],
    },
    {
      category: 'Procurement',
      reports: ['Purchase Register', 'Requisition Ageing', 'Order Ageing', 'Comparative Statement Archive', 'Price Variance', 'Spend by Group', 'Vendor Performance', 'Emergency Purchases'],
    },
    {
      category: 'Inventory',
      reports: ['Goods Receipt Register', 'Stock Ledger', 'Stock Valuation', 'Material Reconciliation', 'Steel Reconciliation', 'Slow/Non-Moving Stock', 'Below Reorder', 'Returnables Outstanding'],
    },
    {
      category: 'Finance',
      reports: ['Trial Balance', 'Profit & Loss', 'Balance Sheet', 'Cash Flow', 'Project Profitability', 'Cost Centre Report', 'Receivable Ageing', 'Payable Ageing', 'GR-IR Clearing', 'Bank Reconciliation', 'Fixed Asset Schedule', 'Working Capital'],
    },
    {
      category: 'Tax & Compliance',
      reports: ['Output Tax Register', 'Input Tax Register', 'Reconciliation Exceptions', 'Withholding Tax Register', 'Statutory Register Pack', 'Compliance Calendar', 'Licence Validity'],
    },
    {
      category: 'People & Plant',
      reports: ['Attendance Register', 'Attendance Exceptions', 'Manual Attendance by Site', 'Labour Cost', 'Manpower Histogram', 'Productivity vs Norm', 'Payroll Register', 'Equipment Utilisation', 'Fuel Efficiency', 'Cost per Hour', 'Maintenance & Downtime'],
    },
    {
      category: 'Quality & Safety',
      reports: ['Inspection Register', 'Test Results', 'Cube Pass Rate', 'Non-Conformance Register', 'Cost of Poor Quality', 'Safety Statistics', 'Incident Register', 'Permit Register', 'Training Status'],
    },
    {
      category: 'Portfolio',
      reports: ['Tender Pipeline', 'Win/Loss', 'Competitor Rate Analysis', 'Order Book', 'Resource Utilisation', 'Management MIS'],
    },
  ];
}

/* ===================== BI Extraction ===================== */

export function extractForBI(s: ERPState): Res {
  // In a real implementation, this would export the star schema to a warehouse
  return {
    s,
    ok: true,
    msg: 'BI extraction ready: star schema with documented measure definitions',
    tone: 'ok',
    detail: JSON.stringify({
      facts: s.semanticModel.facts.length,
      dimensions: s.semanticModel.dimensions.length,
      measures: s.semanticModel.measures.length,
    }),
  };
}
