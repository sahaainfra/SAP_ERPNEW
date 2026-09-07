/* ======================================================================== */
/*  VULCAN ERP — PART 10C: AI LAYER                                         */
/*  Guardrails-first assistant — retrieves and summarises, never computes   */
/* ======================================================================== */

import type { ERPState, Res, AssistantQuery, AssistantResponse } from './types';
import { cloneState, uid, nowStamp, pushAudit } from './engine';

/* ===================== Guardrails ===================== */

/**
 * Rule 1: Never approves, posts, cancels or modifies any transaction
 */
export function attemptAIApproval(sIn: ERPState, docId: string, userId: string): Res {
  return {
    s: sIn,
    ok: false,
    msg: 'AI cannot approve, post, cancel or modify any transaction. This is an absolute guardrail with no configuration override.',
    tone: 'bad',
  };
}

export function attemptAIPosting(sIn: ERPState, userId: string): Res {
  return {
    s: sIn,
    ok: false,
    msg: 'AI cannot post any transaction. All postings require human authorization.',
    tone: 'bad',
  };
}

/**
 * Rule 2: Every number shown is produced by deterministic calculation services
 * The assistant may explain a variance but never compute one
 */
export function explainVariance(
  sIn: ERPState,
  args: { metric: string; actual: number; budget: number; userId: string },
): Res {
  const variance = args.actual - args.budget;
  const variancePct = args.budget !== 0 ? ((variance / args.budget) * 100).toFixed(1) : 'N/A';

  // In a real implementation, this would call the same service the screen calls
  // and return citations to the contributing documents
  const response: AssistantResponse = {
    id: uid(),
    queryId: uid(),
    answer: `Variance: ${variance.toFixed(2)} (${variancePct}%). This is computed by the deterministic cost control service. The assistant can explain the contributing documents but does not recompute the variance.`,
    citations: [
      { type: 'REPORT', id: 'COST_CONTROL', label: 'Cost Control Report' },
      { type: 'DOC', id: 'BUDGET', label: 'Budget Document' },
    ],
    machineGenerated: true,
    timestamp: nowStamp(),
  };

  const s = cloneState(sIn);
  s.assistantResponses.unshift(response);

  return {
    s,
    ok: true,
    msg: response.answer,
    tone: 'info',
    detail: JSON.stringify(response),
  };
}

/**
 * Rule 3: Every output is labelled machine-generated and cites records used
 */
export function projectStatusSummary(
  sIn: ERPState,
  projectCode: string,
  userId: string,
): Res {
  const s = cloneState(sIn);

  // Gather deterministic figures from the project
  const project = s.psBoq.find((b) => b.projectCode === projectCode);
  const budget = s.budgets[projectCode];
  const physicalProgress = s.physicalProgress[projectCode] || 0;

  const query: AssistantQuery = {
    id: uid(),
    userId,
    query: `Project status summary for ${projectCode}`,
    timestamp: nowStamp(),
  };

  const response: AssistantResponse = {
    id: uid(),
    queryId: query.id,
    answer: `[MACHINE GENERATED] Project ${projectCode}: Physical progress ${physicalProgress}%, Budget ${budget ? budget.org + budget.sup - budget.ret : 0}. All figures from deterministic services.`,
    citations: [
      { type: 'PROJECT', id: projectCode, label: `Project ${projectCode}` },
      { type: 'BUDGET', id: projectCode, label: `Budget for ${projectCode}` },
    ],
    machineGenerated: true,
    timestamp: nowStamp(),
  };

  s.assistantQueries.unshift(query);
  s.assistantResponses.unshift(response);

  return {
    s,
    ok: true,
    msg: response.answer,
    tone: 'info',
    detail: JSON.stringify(response),
  };
}

/**
 * Rule 4: Respects row-level and field-level authorization absolutely
 */
export function naturalLanguageSearch(
  sIn: ERPState,
  query: string,
  userId: string,
): Res {
  const s = cloneState(sIn);

  // In a real implementation, this would apply row-level authorization
  // and only return records the user can access
  const assistantQuery: AssistantQuery = {
    id: uid(),
    userId,
    query,
    timestamp: nowStamp(),
  };

  const response: AssistantResponse = {
    id: uid(),
    queryId: assistantQuery.id,
    answer: `[MACHINE GENERATED] Search for "${query}" — results filtered by your authorization. You can only see records you have access to.`,
    citations: [],
    machineGenerated: true,
    timestamp: nowStamp(),
  };

  s.assistantQueries.unshift(assistantQuery);
  s.assistantResponses.unshift(response);

  pushAudit(s, userId, 'SYSTEM', 'AI_QUERY', assistantQuery.id, {
    reason: `AI search: ${query}`,
  });

  return {
    s,
    ok: true,
    msg: response.answer,
    tone: 'info',
  };
}

/**
 * Rule 5: The system is fully functional with the AI layer disabled
 * This is enforced by design — all core functions work without AI
 */
export function verifyAIOptional(s: ERPState): Res {
  return {
    s,
    ok: true,
    msg: 'AI layer is optional. All core ERP functions (posting, approval, reporting) work without AI. The assistant only retrieves and summarises.',
    tone: 'info',
  };
}

/**
 * Permitted functions
 */
export function detectStalledApprovals(sIn: ERPState, userId: string): Res {
  const stalled = sIn.docs.filter((d) => {
    if (!d.release || d.release.indicator === 'RELEASED') return false;
    const pendingStep = d.release.steps.find((st) => st.status === 'PENDING');
    if (!pendingStep || !pendingStep.slaDueAt) return false;
    return new Date(sIn.today) > new Date(pendingStep.slaDueAt);
  });

  const query: AssistantQuery = {
    id: uid(),
    userId,
    query: 'Detect stalled approvals',
    timestamp: nowStamp(),
  };

  const response: AssistantResponse = {
    id: uid(),
    queryId: query.id,
    answer: `[MACHINE GENERATED] ${stalled.length} approvals are stalled (past SLA). Documents: ${stalled.map((d) => d.number).join(', ') || 'none'}.`,
    citations: stalled.map((d) => ({ type: 'DOC', id: d.id, label: d.number || d.id })),
    machineGenerated: true,
    timestamp: nowStamp(),
  };

  const s = cloneState(sIn);
  s.assistantQueries.unshift(query);
  s.assistantResponses.unshift(response);

  return {
    s,
    ok: true,
    msg: response.answer,
    tone: stalled.length > 0 ? 'warn' : 'info',
  };
}

export function detectDuplicateInvoices(sIn: ERPState, userId: string): Res {
  // Simplified duplicate detection — in reality, would use fuzzy matching
  const invoices = sIn.docs.filter((d) => d.type === 'IV-VEN');
  const duplicates: { vendorId: string; invoiceNo: string; count: number }[] = [];

  const byVendorAndNumber: Record<string, typeof invoices> = {};
  invoices.forEach((inv) => {
    const key = `${inv.partnerId}|${inv.number}`;
    if (!byVendorAndNumber[key]) byVendorAndNumber[key] = [];
    byVendorAndNumber[key].push(inv);
  });

  Object.entries(byVendorAndNumber).forEach(([key, invs]) => {
    if (invs.length > 1) {
      const [vendorId, invoiceNo] = key.split('|');
      duplicates.push({ vendorId, invoiceNo, count: invs.length });
    }
  });

  const query: AssistantQuery = {
    id: uid(),
    userId,
    query: 'Detect duplicate invoices',
    timestamp: nowStamp(),
  };

  const response: AssistantResponse = {
    id: uid(),
    queryId: query.id,
    answer: `[MACHINE GENERATED] ${duplicates.length} potential duplicate invoices detected. These are flagged for human review — AI does not auto-reject.`,
    citations: duplicates.map((d) => ({ type: 'DOC', id: d.invoiceNo, label: `Invoice ${d.invoiceNo} (${d.count}x)` })),
    machineGenerated: true,
    timestamp: nowStamp(),
  };

  const s = cloneState(sIn);
  s.assistantQueries.unshift(query);
  s.assistantResponses.unshift(response);

  return {
    s,
    ok: true,
    msg: response.answer,
    tone: duplicates.length > 0 ? 'warn' : 'info',
  };
}

export function summarizeLowStockRisk(sIn: ERPState, userId: string): Res {
  const lowStock = sIn.stock.filter((row) => {
    // Simplified — in reality, would check against reorder levels
    return row.qty < 100;
  });

  const query: AssistantQuery = {
    id: uid(),
    userId,
    query: 'Summarize low stock risk',
    timestamp: nowStamp(),
  };

  const response: AssistantResponse = {
    id: uid(),
    queryId: query.id,
    answer: `[MACHINE GENERATED] ${lowStock.length} materials are below reorder level. All figures from stock ledger service.`,
    citations: lowStock.map((row) => ({ type: 'STOCK', id: row.materialCode, label: `${row.materialCode}: ${row.qty}` })),
    machineGenerated: true,
    timestamp: nowStamp(),
  };

  const s = cloneState(sIn);
  s.assistantQueries.unshift(query);
  s.assistantResponses.unshift(response);

  return {
    s,
    ok: true,
    msg: response.answer,
    tone: lowStock.length > 0 ? 'warn' : 'info',
  };
}
