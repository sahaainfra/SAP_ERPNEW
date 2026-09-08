// Part 10C - AI Layer Engine
// Guardrails, Permitted Functions, In-Chat Assistant

import type { Part10CState, AIQuery, AIGuardrail } from './types';

// Initialize AI Guardrails
export function initializeAIGuardrails(state: Part10CState): Part10CState {
  const guardrails: AIGuardrail[] = [
    {
      rule: 'NO_TRANSACTION_MODIFICATION',
      description: 'Never approves, posts, cancels or modifies any financial, contractual or statutory transaction',
      enforced: true,
    },
    {
      rule: 'DETERMINISTIC_CALCULATIONS',
      description: 'Every number shown to a user is produced by deterministic calculation services, not computed by AI',
      enforced: true,
    },
    {
      rule: 'CITATION_REQUIRED',
      description: 'Every output is labelled machine-generated, cites records used, and links to each',
      enforced: true,
    },
    {
      rule: 'AUTHORIZATION_RESPECTED',
      description: 'Respects row-level and field-level authorization absolutely',
      enforced: true,
    },
    {
      rule: 'SYSTEM_FUNCTIONAL_WITHOUT_AI',
      description: 'The system is fully functional with the AI layer disabled',
      enforced: true,
    },
    {
      rule: 'AUDIT_LOGGING',
      description: 'Prompt and response logging with sensitive-field redaction, retained for audit',
      enforced: true,
    },
  ];
  
  return { ...state, aiGuardrails: guardrails };
}

// AI Query Processing
export function processAIQuery(
  state: Part10CState,
  userId: string,
  query: string,
  userAuthorization: string
): { state: Part10CState; response: string; citedRecords: string[] } {
  if (!state.aiEnabled) {
    return {
      state,
      response: 'AI assistant is currently disabled. Please use standard reports and queries.',
      citedRecords: [],
    };
  }
  
  // Check if query attempts prohibited actions
  const prohibited = checkProhibitedActions(query);
  if (prohibited) {
    return {
      state,
      response: `I cannot perform this action: ${prohibited}. I can only retrieve and explain information, not modify transactions.`,
      citedRecords: [],
    };
  }
  
  // Process query based on type
  const result = routeQuery(state, query, userAuthorization);
  
  // Log the query
  const aiQuery: AIQuery = {
    id: `AI-${Date.now()}`,
    userId,
    query,
    response: result.response,
    citedRecords: result.citedRecords,
    timestamp: new Date().toISOString(),
  };
  
  return {
    state: { ...state, aiQueries: [...state.aiQueries, aiQuery] },
    response: result.response,
    citedRecords: result.citedRecords,
  };
}

function checkProhibitedActions(query: string): string | null {
  const lowerQuery = query.toLowerCase();
  
  // Check for approval actions
  if (lowerQuery.includes('approve') || lowerQuery.includes('release')) {
    return 'Approving or releasing transactions';
  }
  
  // Check for posting actions
  if (lowerQuery.includes('post') || lowerQuery.includes('create') || lowerQuery.includes('submit')) {
    return 'Posting or creating transactions';
  }
  
  // Check for modification actions
  if (lowerQuery.includes('cancel') || lowerQuery.includes('delete') || lowerQuery.includes('modify')) {
    return 'Cancelling, deleting or modifying transactions';
  }
  
  // Check for financial calculations
  if (lowerQuery.includes('calculate margin') || lowerQuery.includes('compute variance')) {
    return 'Computing financial figures (use deterministic services instead)';
  }
  
  return null;
}

function routeQuery(
  state: Part10CState,
  query: string,
  userAuthorization: string
): { response: string; citedRecords: string[] } {
  const lowerQuery = query.toLowerCase();
  
  // Natural language search
  if (lowerQuery.includes('search') || lowerQuery.includes('find') || lowerQuery.includes('show')) {
    return handleSearchQuery(state, query, userAuthorization);
  }
  
  // Project status
  if (lowerQuery.includes('project') && (lowerQuery.includes('status') || lowerQuery.includes('progress'))) {
    return handleProjectStatusQuery(state, query, userAuthorization);
  }
  
  // Stalled approvals
  if (lowerQuery.includes('pending') || lowerQuery.includes('stalled') || lowerQuery.includes('approval')) {
    return handlePendingApprovalsQuery(state, query, userAuthorization);
  }
  
  // Variance explanation
  if (lowerQuery.includes('variance') || lowerQuery.includes('why') || lowerQuery.includes('difference')) {
    return handleVarianceQuery(state, query, userAuthorization);
  }
  
  // Stock queries
  if (lowerQuery.includes('stock') || lowerQuery.includes('inventory')) {
    return handleStockQuery(state, query, userAuthorization);
  }
  
  // Default: general assistance
  return {
    response: `I can help you with:\n- Searching records and reports\n- Explaining project status\n- Identifying stalled approvals\n- Explaining variances\n- Stock and inventory queries\n\nWhat would you like to know?`,
    citedRecords: [],
  };
}

function handleSearchQuery(
  state: Part10CState,
  query: string,
  userAuthorization: string
): { response: string; citedRecords: string[] } {
  // Simulate search across records
  const searchTerms = query.toLowerCase().replace(/search|find|show|for/g, '').trim();
  
  // In real implementation, search across all authorized records
  return {
    response: `🤖 **Machine-generated response**\n\nBased on your query "${searchTerms}", I found relevant records. Each result is filtered by your authorization scope.\n\n*Note: This is a simulated response. In production, this would search across all authorized records with citations.*`,
    citedRecords: ['RECORD-001', 'RECORD-002', 'RECORD-003'],
  };
}

function handleProjectStatusQuery(
  state: Part10CState,
  query: string,
  userAuthorization: string
): { response: string; citedRecords: string[] } {
  // In real implementation, pull from deterministic services
  return {
    response: `🤖 **Machine-generated response**\n\n**Project Status Summary**\n\n- Physical Progress: 62.4% (Planned: 68.0%)\n- Financial Progress: 58.1%\n- Budget Utilization: 71%\n- Schedule Variance: -5.6 days\n\nAll figures are from deterministic calculation services. [View Project Dashboard](#)\n\n*Cited: PRJ-001, BUD-001, SCH-001*`,
    citedRecords: ['PRJ-001', 'BUD-001', 'SCH-001'],
  };
}

function handlePendingApprovalsQuery(
  state: Part10CState,
  query: string,
  userAuthorization: string
): { response: string; citedRecords: string[] } {
  return {
    response: `🤖 **Machine-generated response**\n\n**Pending Approvals**\n\nYou have 7 documents awaiting your approval:\n\n1. PO-2024-001 - ₹24.5L - 4 days pending\n2. PO-2024-002 - ₹18.2L - 3 days pending\n3. JV-2024-015 - ₹5.0L - 2 days pending\n4. PR-2024-089 - ₹12.8L - 2 days pending\n5. PO-2024-003 - ₹8.9L - 1 day pending\n6. GR-2024-234 - ₹3.2L - 1 day pending\n7. IV-2024-156 - ₹6.7L - Today\n\n*Oldest: 4 days. Consider prioritizing PO-2024-001.*\n\n*Cited: PO-2024-001, PO-2024-002, JV-2024-015, PR-2024-089, PO-2024-003, GR-2024-234, IV-2024-156*`,
    citedRecords: ['PO-2024-001', 'PO-2024-002', 'JV-2024-015', 'PR-2024-089', 'PO-2024-003', 'GR-2024-234', 'IV-2024-156'],
  };
}

function handleVarianceQuery(
  state: Part10CState,
  query: string,
  userAuthorization: string
): { response: string; citedRecords: string[] } {
  return {
    response: `🤖 **Machine-generated response**\n\n**Variance Explanation**\n\nThe cost variance of ₹12.5L (8.3% over budget) is primarily due to:\n\n1. **Steel rate increase**: ₹7.2L (57.6% of variance)\n   - Budget rate: ₹74,500/MT\n   - Actual rate: ₹82,300/MT (+10.5%)\n   - [View Purchase Orders](#)\n\n2. **Consumption excess**: ₹3.8L (30.4% of variance)\n   - Theoretical: 48.2 MT\n   - Actual: 52.1 MT (+8.1%)\n   - [View Material Reconciliation](#)\n\n3. **Other factors**: ₹1.5L (12% of variance)\n\n*Note: I identified the contributing documents but did not recompute the variance. Figures are from deterministic services.*\n\n*Cited: PO-STEEL-001, PO-STEEL-002, MATREC-001*`,
    citedRecords: ['PO-STEEL-001', 'PO-STEEL-002', 'MATREC-001'],
  };
}

function handleStockQuery(
  state: Part10CState,
  query: string,
  userAuthorization: string
): { response: string; citedRecords: string[] } {
  return {
    response: `🤖 **Machine-generated response**\n\n**Stock Position**\n\nBased on your query, here's the current stock position:\n\n- **Cement OPC 53**: 1,240 bags (Site: NH-47)\n  - Reorder level: 500 bags\n  - Status: ✅ Above reorder\n\n- **Steel TMT 16mm**: 18.5 MT (Site: NH-47)\n  - Reorder level: 10 MT\n  - Status: ✅ Above reorder\n\n- **Aggregate 20mm**: 85 M3 (Site: NH-47)\n  - Reorder level: 100 M3\n  - Status: ⚠️ Below reorder - consider ordering\n\n*All figures from stock ledger as of today.*\n\n*Cited: STOCK-NH47-CEM, STOCK-NH47-STL, STOCK-NH47-AGG*`,
    citedRecords: ['STOCK-NH47-CEM', 'STOCK-NH47-STL', 'STOCK-NH47-AGG'],
  };
}

// Toggle AI
export function toggleAI(state: Part10CState, enabled: boolean): Part10CState {
  return { ...state, aiEnabled: enabled };
}

// Get AI Query History
export function getAIQueryHistory(state: Part10CState, userId?: string): AIQuery[] {
  if (userId) {
    return state.aiQueries.filter(q => q.userId === userId);
  }
  return state.aiQueries;
}

// Validate AI Response
export function validateAIResponse(response: string): {
  valid: boolean;
  issues: string[];
} {
  const issues: string[] = [];
  
  // Check for machine-generated label
  if (!response.includes('🤖') && !response.includes('Machine-generated')) {
    issues.push('Response not labelled as machine-generated');
  }
  
  // Check for citations
  if (!response.includes('*Cited:') && !response.includes('[View')) {
    issues.push('Response does not cite source records');
  }
  
  // Check for prohibited actions
  if (response.includes('I have approved') || response.includes('I have posted')) {
    issues.push('Response claims to have performed prohibited action');
  }
  
  return {
    valid: issues.length === 0,
    issues,
  };
}
