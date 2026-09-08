// Part 10C - Analytics Module Engine
// Semantic Layer, Reports, BI Extraction

import type { Part10CState, FactTable, Dimension, Measure, Report } from './types';

// Semantic Model - Star Schema
export function initializeSemanticModel(state: Part10CState): Part10CState {
  const factTables: FactTable[] = [
    {
      name: 'fact_journal',
      description: 'Every posted journal line with full dimensions',
      columns: ['company', 'site', 'project', 'wbs', 'cost_code', 'account', 'period', 'debit', 'credit', 'document_type', 'document_id'],
      rowCount: 0,
      lastRefresh: new Date().toISOString(),
    },
    {
      name: 'fact_stock_movement',
      description: 'Every material document line with value',
      columns: ['site', 'material', 'movement_type', 'quantity', 'value', 'period', 'document_id'],
      rowCount: 0,
      lastRefresh: new Date().toISOString(),
    },
    {
      name: 'fact_commitment',
      description: 'Open requisition / order / subcontract value by date',
      columns: ['project', 'wbs', 'document_type', 'value', 'date', 'status'],
      rowCount: 0,
      lastRefresh: new Date().toISOString(),
    },
    {
      name: 'fact_measurement',
      description: 'Certified quantity by BOQ item and period',
      columns: ['project', 'boq_item', 'quantity', 'value', 'period', 'bill_id'],
      rowCount: 0,
      lastRefresh: new Date().toISOString(),
    },
    {
      name: 'fact_billing',
      description: 'Submitted / certified / paid by bill and item',
      columns: ['project', 'bill_id', 'submitted', 'certified', 'paid', 'period'],
      rowCount: 0,
      lastRefresh: new Date().toISOString(),
    },
    {
      name: 'fact_procurement',
      description: 'Requisition → order → receipt → invoice cycle events',
      columns: ['project', 'material', 'requisition_id', 'order_id', 'receipt_id', 'invoice_id', 'value', 'date'],
      rowCount: 0,
      lastRefresh: new Date().toISOString(),
    },
    {
      name: 'fact_attendance',
      description: 'Punch-derived man-days by person, project, category',
      columns: ['project', 'employee', 'category', 'man_days', 'date'],
      rowCount: 0,
      lastRefresh: new Date().toISOString(),
    },
    {
      name: 'fact_plant_log',
      description: 'Hours, fuel, downtime by equipment and day',
      columns: ['project', 'equipment', 'working_hours', 'idle_hours', 'fuel', 'downtime', 'date'],
      rowCount: 0,
      lastRefresh: new Date().toISOString(),
    },
    {
      name: 'fact_production',
      description: 'Batch output and raw material consumption',
      columns: ['plant', 'product', 'output_qty', 'material_consumed', 'date'],
      rowCount: 0,
      lastRefresh: new Date().toISOString(),
    },
    {
      name: 'fact_quality',
      description: 'Inspection lots, results, non-conformances',
      columns: ['project', 'lot_type', 'result', 'ncr_raised', 'date'],
      rowCount: 0,
      lastRefresh: new Date().toISOString(),
    },
    {
      name: 'fact_safety',
      description: 'Incidents, observations, man-hours, permits',
      columns: ['project', 'incident_type', 'severity', 'man_hours', 'permits_active', 'date'],
      rowCount: 0,
      lastRefresh: new Date().toISOString(),
    },
    {
      name: 'fact_budget',
      description: 'Budget by version, WBS, cost code, period',
      columns: ['project', 'wbs', 'cost_code', 'version', 'amount', 'period'],
      rowCount: 0,
      lastRefresh: new Date().toISOString(),
    },
  ];

  const dimensions: Dimension[] = [
    { name: 'dim_date', description: 'Calendar with fiscal periods', hierarchy: ['year', 'quarter', 'month', 'week', 'day'] },
    { name: 'dim_company', description: 'Company codes', hierarchy: ['company'] },
    { name: 'dim_site', description: 'Operating sites', hierarchy: ['company', 'site'] },
    { name: 'dim_tax_unit', description: 'Tax registration units', hierarchy: ['company', 'tax_unit'] },
    { name: 'dim_business_unit', description: 'Business units', hierarchy: ['business_unit'] },
    { name: 'dim_project', description: 'Projects', hierarchy: ['company', 'project'] },
    { name: 'dim_wbs', description: 'Work breakdown structure', hierarchy: ['project', 'wbs_level_1', 'wbs_level_2', 'wbs_level_3'] },
    { name: 'dim_cost_code', description: 'Cost codes', hierarchy: ['cost_code'] },
    { name: 'dim_cost_centre', description: 'Cost centres', hierarchy: ['cost_centre'] },
    { name: 'dim_profit_centre', description: 'Profit centres', hierarchy: ['profit_centre'] },
    { name: 'dim_material', description: 'Materials with group hierarchy', hierarchy: ['material_group', 'material_subgroup', 'material'] },
    { name: 'dim_partner', description: 'Business partners with roles', hierarchy: ['partner_group', 'partner'] },
    { name: 'dim_employee', description: 'Employees', hierarchy: ['department', 'employee'] },
    { name: 'dim_equipment', description: 'Equipment', hierarchy: ['equipment_category', 'equipment'] },
    { name: 'dim_account', description: 'Chart of accounts', hierarchy: ['account_group', 'account'] },
    { name: 'dim_document_type', description: 'Document types', hierarchy: ['module', 'document_type'] },
    { name: 'dim_reason_code', description: 'Reason codes', hierarchy: ['reason_category', 'reason_code'] },
    { name: 'dim_status', description: 'Status values', hierarchy: ['status'] },
  ];

  const measures: Measure[] = [
    { code: 'CERTIFIED_VALUE', name: 'Certified Value', description: 'Total value certified by client', formula: 'SUM(fact_billing.certified)', unit: 'INR' },
    { code: 'SUBMITTED_VALUE', name: 'Submitted Value', description: 'Total value submitted for certification', formula: 'SUM(fact_billing.submitted)', unit: 'INR' },
    { code: 'PAID_VALUE', name: 'Paid Value', description: 'Total value paid by client', formula: 'SUM(fact_billing.paid)', unit: 'INR' },
    { code: 'STOCK_VALUE', name: 'Stock Value', description: 'Total stock value at site', formula: 'SUM(fact_stock_movement.value)', unit: 'INR' },
    { code: 'COMMITMENT_VALUE', name: 'Commitment Value', description: 'Total open commitments', formula: 'SUM(fact_commitment.value)', unit: 'INR' },
    { code: 'BUDGET_VALUE', name: 'Budget Value', description: 'Total budget allocated', formula: 'SUM(fact_budget.amount)', unit: 'INR' },
    { code: 'ACTUAL_COST', name: 'Actual Cost', description: 'Total actual cost posted', formula: 'SUM(fact_journal.debit)', unit: 'INR' },
    { code: 'MAN_DAYS', name: 'Man-Days', description: 'Total man-days worked', formula: 'SUM(fact_attendance.man_days)', unit: 'DAYS' },
    { code: 'EQUIPMENT_HOURS', name: 'Equipment Hours', description: 'Total equipment working hours', formula: 'SUM(fact_plant_log.working_hours)', unit: 'HOURS' },
    { code: 'FUEL_CONSUMED', name: 'Fuel Consumed', description: 'Total fuel consumed', formula: 'SUM(fact_plant_log.fuel)', unit: 'LITRES' },
    { code: 'PRODUCTION_OUTPUT', name: 'Production Output', description: 'Total production output', formula: 'SUM(fact_production.output_qty)', unit: 'M3' },
    { code: 'INCIDENTS', name: 'Incidents', description: 'Total safety incidents', formula: 'COUNT(fact_safety.incident_type)', unit: 'COUNT' },
    { code: 'MAN_HOURS', name: 'Man-Hours', description: 'Total man-hours worked', formula: 'SUM(fact_safety.man_hours)', unit: 'HOURS' },
    { code: 'CERTIFICATION_SHORTFALL', name: 'Certification Shortfall', description: 'Difference between submitted and certified', formula: 'SUM(fact_billing.submitted) - SUM(fact_billing.certified)', unit: 'INR' },
    { code: 'VARIANCE', name: 'Cost Variance', description: 'Actual cost minus budget', formula: 'SUM(fact_journal.debit) - SUM(fact_budget.amount)', unit: 'INR' },
  ];

  return { ...state, factTables, dimensions, measures };
}

// Report Builder
export function createReport(
  state: Part10CState,
  report: Omit<Report, 'id' | 'createdAt'>
): Part10CState {
  const newReport: Report = {
    ...report,
    id: `RPT-${Date.now()}`,
    createdAt: new Date().toISOString(),
  };
  
  return { ...state, reports: [...state.reports, newReport] };
}

export function executeReport(
  state: Part10CState,
  reportId: string,
  userAuthorization: string
): { data: any[]; asAt: string; authorized: boolean } {
  const report = state.reports.find(r => r.id === reportId);
  if (!report) {
    return { data: [], asAt: new Date().toISOString(), authorized: false };
  }
  
  // Check authorization
  const authorized = checkAuthorization(report.authorizationScope, userAuthorization);
  
  if (!authorized) {
    return { data: [], asAt: new Date().toISOString(), authorized: false };
  }
  
  // Simulate query execution against read replica
  const data = simulateQuery(report);
  
  return {
    data,
    asAt: new Date().toISOString(),
    authorized: true,
  };
}

function checkAuthorization(reportScope: string, userScope: string): boolean {
  // In real implementation, check row-level security
  // For demo, always authorized
  return true;
}

function simulateQuery(report: Report): any[] {
  // Simulate report data based on measures
  return report.measures.map(measure => ({
    measure,
    value: Math.random() * 1000000,
    period: '2024-01',
  }));
}

// Standard Report Catalog
export function getStandardReportCatalog(): Array<{name: string; category: string; description: string}> {
  return [
    // Project
    { name: 'Project MIS', category: 'Project', description: 'Comprehensive project status report' },
    { name: 'Daily Progress', category: 'Project', description: 'Daily progress summary' },
    { name: 'Hindrance Register', category: 'Project', description: 'Register of delays and hindrances' },
    { name: 'WBS Cost Report', category: 'Project', description: 'Cost by WBS element' },
    { name: 'BOQ Progress', category: 'Project', description: 'BOQ item-wise progress' },
    { name: 'Deviation Statement', category: 'Project', description: 'Quantity deviations from BOQ' },
    { name: 'Earned Value', category: 'Project', description: 'Earned value analysis' },
    
    // Commercial
    { name: 'RA Bill Abstract', category: 'Commercial', description: 'Running account bill summary' },
    { name: 'Certification Shortfall', category: 'Commercial', description: 'Analysis of certification shortfalls' },
    { name: 'Variation Register', category: 'Commercial', description: 'Variation orders register' },
    { name: 'Billing at Risk', category: 'Commercial', description: 'Unapproved extra items' },
    { name: 'Claims Register', category: 'Commercial', description: 'Claims status and value' },
    { name: 'Retention Register', category: 'Commercial', description: 'Retention money status' },
    
    // Procurement
    { name: 'Purchase Register', category: 'Procurement', description: 'All purchase orders' },
    { name: 'Requisition Ageing', category: 'Procurement', description: 'Open requisitions by age' },
    { name: 'Price Variance', category: 'Procurement', description: 'Actual vs budget prices' },
    { name: 'Spend by Vendor', category: 'Procurement', description: 'Procurement spend analysis' },
    { name: 'Vendor Performance', category: 'Procurement', description: 'Vendor rating and performance' },
    
    // Inventory
    { name: 'Stock Ledger', category: 'Inventory', description: 'Stock position by material and site' },
    { name: 'Material Reconciliation', category: 'Inventory', description: 'Theoretical vs actual consumption' },
    { name: 'Slow Moving Stock', category: 'Inventory', description: 'Stock with no movement' },
    { name: 'Below Reorder', category: 'Inventory', description: 'Stock below reorder level' },
    
    // Finance
    { name: 'Trial Balance', category: 'Finance', description: 'Trial balance as on date' },
    { name: 'Profit & Loss', category: 'Finance', description: 'Profit and loss statement' },
    { name: 'Balance Sheet', category: 'Finance', description: 'Balance sheet as on date' },
    { name: 'Cash Flow', category: 'Finance', description: 'Cash flow statement' },
    { name: 'Project Profitability', category: 'Finance', description: 'Project-wise profitability' },
    { name: 'Receivable Ageing', category: 'Finance', description: 'Receivables ageing analysis' },
    { name: 'Payable Ageing', category: 'Finance', description: 'Payables ageing analysis' },
    { name: 'MSME Dues', category: 'Finance', description: 'MSME vendor dues within 45 days' },
    { name: 'GR-IR Clearing', category: 'Finance', description: 'Goods received not invoiced' },
    { name: 'Working Capital', category: 'Finance', description: 'Working capital position' },
    
    // Tax & Compliance
    { name: 'Output Tax Register', category: 'Tax', description: 'GST output tax register' },
    { name: 'Input Tax Register', category: 'Tax', description: 'GST input tax credit register' },
    { name: 'TDS Register', category: 'Tax', description: 'Tax deducted at source register' },
    { name: 'Compliance Calendar', category: 'Compliance', description: 'Statutory compliance status' },
    
    // People & Plant
    { name: 'Attendance Register', category: 'People', description: 'Attendance by employee' },
    { name: 'Labour Cost', category: 'People', description: 'Labour cost analysis' },
    { name: 'Productivity vs Norm', category: 'People', description: 'Actual vs standard productivity' },
    { name: 'Equipment Utilisation', category: 'Plant', description: 'Equipment utilisation report' },
    { name: 'Fuel Efficiency', category: 'Plant', description: 'Fuel consumption analysis' },
    { name: 'Maintenance Report', category: 'Plant', description: 'Maintenance and downtime' },
    
    // Quality & Safety
    { name: 'Inspection Register', category: 'Quality', description: 'Inspection lots and results' },
    { name: 'NCR Register', category: 'Quality', description: 'Non-conformance register' },
    { name: 'Safety Statistics', category: 'Safety', description: 'Safety performance metrics' },
    { name: 'Incident Register', category: 'Safety', description: 'Safety incidents register' },
    
    // Portfolio
    { name: 'Tender Pipeline', category: 'Portfolio', description: 'Tender pipeline status' },
    { name: 'Win/Loss Analysis', category: 'Portfolio', description: 'Bid win/loss analysis' },
    { name: 'Order Book', category: 'Portfolio', description: 'Order book position' },
  ];
}

// BI Extraction
export function prepareBIExtraction(state: Part10CState): {
  schema: any;
  measures: Measure[];
  lastRefresh: string;
} {
  return {
    schema: {
      factTables: state.factTables.map(f => ({ name: f.name, columns: f.columns })),
      dimensions: state.dimensions.map(d => ({ name: d.name, hierarchy: d.hierarchy })),
    },
    measures: state.measures,
    lastRefresh: new Date().toISOString(),
  };
}

// Query Cost Guard
export function validateQueryComplexity(query: any): { valid: boolean; reason?: string } {
  // Check for unbounded queries
  if (!query.limit && !query.filters) {
    return { valid: false, reason: 'Query must have limit or filters to prevent unbounded execution' };
  }
  
  // Check for expensive operations
  if (query.joins && query.joins.length > 5) {
    return { valid: false, reason: 'Query has too many joins (>5). Consider breaking into multiple queries.' };
  }
  
  return { valid: true };
}
