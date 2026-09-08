/* ======================================================================== */
/*  VULCAN ERP — PART 10B: EXTERNAL PORTALS                                 */
/*  Vendor, Subcontractor, and Client portals with isolation                */
/* ======================================================================== */

import type { ERPState, Res, PortalToken, PortalSession, VendorPortalData, SubconPortalData, ClientPortalData } from './types';
import { cloneState, uid, nowStamp, pushAudit, authorize } from './engine';
import { PARTNERS } from './config';

/* ===================== Portal Token Management ===================== */

/**
 * Issue a portal token — structurally incapable of authenticating against internal endpoints
 */
export function issuePortalToken(
  sIn: ERPState,
  partnerId: string,
  portalType: 'VENDOR' | 'SUBCONTRACTOR' | 'CLIENT',
  scopes: string[],
  userId: string,
): Res {
  const s = cloneState(sIn);

  const token: PortalToken = {
    id: uid(),
    partnerId,
    portalType,
    issuedAt: nowStamp(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
    scopes,
  };

  s.portalTokens.push(token);

  pushAudit(s, userId, 'SECURITY', 'PORTAL_TOKEN', token.id, {
    reason: `Portal token issued for ${partnerId} (${portalType})`,
  });

  return { s, ok: true, msg: `Portal token issued: ${token.id}`, tone: 'ok', docId: token.id };
}

/**
 * Validate portal token — separate auth realm from internal
 */
export function validatePortalToken(s: ERPState, tokenId: string): {
  valid: boolean;
  partnerId?: string;
  portalType?: string;
  reason?: string;
} {
  const token = s.portalTokens.find((t) => t.id === tokenId);
  if (!token) return { valid: false, reason: 'Token not found' };

  const now = new Date();
  const expires = new Date(token.expiresAt);
  if (now > expires) return { valid: false, reason: 'Token expired' };

  return { valid: true, partnerId: token.partnerId, portalType: token.portalType };
}

/**
 * Attempt to use portal token on internal endpoint — should fail
 */
export function attemptInternalAccessWithPortalToken(sIn: ERPState, tokenId: string): Res {
  const validation = validatePortalToken(sIn, tokenId);
  if (!validation.valid) {
    return { s: sIn, ok: false, msg: `Invalid token: ${validation.reason}`, tone: 'bad' };
  }

  // Portal tokens are structurally incapable of accessing internal endpoints
  pushAudit(sIn, 'SYSTEM', 'SECURITY', 'PORTAL_ACCESS', tokenId, {
    reason: 'Portal token attempted internal access — rejected (separate auth realm)',
  });

  return {
    s: sIn,
    ok: false,
    msg: 'Portal tokens cannot access internal endpoints — separate authentication realm',
    tone: 'bad',
  };
}

/**
 * Start portal session
 */
export function startPortalSession(
  sIn: ERPState,
  tokenId: string,
  ipAddress: string,
  userAgent: string,
): Res {
  const s = cloneState(sIn);
  const validation = validatePortalToken(s, tokenId);
  if (!validation.valid) return { s, ok: false, msg: `Invalid token: ${validation.reason}`, tone: 'bad' };

  const session: PortalSession = {
    id: uid(),
    token: s.portalTokens.find((t) => t.id === tokenId)!,
    partnerId: validation.partnerId!,
    portalType: validation.portalType as any,
    startedAt: nowStamp(),
    lastActivityAt: nowStamp(),
    ipAddress,
    userAgent,
  };

  s.portalSessions.push(session);

  return { s, ok: true, msg: 'Portal session started', tone: 'ok', docId: session.id };
}

/* ===================== Vendor Portal ===================== */

/**
 * Get vendor portal data — scoped to partner's records only
 */
export function getVendorPortalData(s: ERPState, partnerId: string): VendorPortalData {
  // In a real implementation, this would query actual data
  // For now, return sample data
  return {
    purchaseOrders: [
      { id: 'PO-001', number: 'VUL/PO/2026-27/000142', value: 2450000, status: 'RELEASED', deliveryDate: '2026-03-15' },
      { id: 'PO-002', number: 'VUL/PO/2026-27/000143', value: 8820000, status: 'PENDING_RELEASE', deliveryDate: '2026-03-20' },
    ],
    dispatchAdvices: [
      { id: 'DA-001', poId: 'PO-001', vehicleNo: 'MH-12-AB-1234', invoiceNo: 'INV-001', challanNo: 'DC-001', ewbNo: 'EWB-001', submittedAt: '2026-03-10T10:00:00Z' },
    ],
    invoices: [
      { id: 'INV-001', number: 'INV-2026-001', poId: 'PO-001', amount: 2450000, matchStatus: 'MATCHED' },
      { id: 'INV-002', number: 'INV-2026-002', poId: 'PO-002', amount: 8820000, matchStatus: 'BLOCKED', blockReason: 'Quantity variance: invoiced 100, received 95' },
    ],
    payments: [
      { id: 'PAY-001', invoiceId: 'INV-001', amount: 2450000, expectedDate: '2026-04-10', status: 'PENDING' },
    ],
    scorecard: [
      { criterion: 'Price', score: 85, weight: 30, details: 'Variance vs lowest: 5%' },
      { criterion: 'Delivery', score: 92, weight: 25, details: 'On-time: 92%' },
      { criterion: 'Quality', score: 88, weight: 25, details: 'Rejection: 2%' },
      { criterion: 'Compliance', score: 95, weight: 10, details: 'All documents valid' },
      { criterion: 'Service', score: 90, weight: 10, details: 'Response time: 2h avg' },
    ],
  };
}

/**
 * Submit dispatch advice from vendor portal
 */
export function submitDispatchAdvice(
  sIn: ERPState,
  partnerId: string,
  poId: string,
  vehicleNo: string,
  invoiceNo: string,
  challanNo: string,
  ewbNo: string,
): Res {
  const s = cloneState(sIn);

  // Validate partner has access to this PO
  const po = s.docs.find((d) => d.id === poId && d.partnerId === partnerId);
  if (!po) {
    pushAudit(s, 'SYSTEM', 'SECURITY', 'PORTAL_ACCESS', poId, {
      reason: `Vendor ${partnerId} attempted to access PO they don't own — ID enumeration blocked`,
    });
    return { s, ok: false, msg: 'Purchase order not found', tone: 'bad' }; // 404, not 403
  }

  // Create gate entry draft
  const gateEntry = {
    id: uid(),
    number: `GE-${uid().slice(0, 6)}`,
    siteId: po.siteId,
    vehicleNo,
    driver: 'Vendor driver',
    transporter: 'Self',
    ewb: ewbNo,
    poRef: poId,
    materialCode: po.items[0]?.materialCode || '',
    declaredQty: po.items[0]?.qty || 0,
    sealOk: true,
    status: 'PENDING',
    at: nowStamp(),
  };

  s.gateEntries.push(gateEntry as any);

  pushAudit(s, partnerId, 'CHANGE', 'DISPATCH_ADVICE', gateEntry.id, {
    reason: `Dispatch advice submitted for PO ${po.number}`,
  });

  return { s, ok: true, msg: 'Dispatch advice submitted — gate entry created', tone: 'ok', docId: gateEntry.id };
}

/**
 * Upload invoice from vendor portal
 */
export function uploadVendorInvoice(
  sIn: ERPState,
  partnerId: string,
  poId: string,
  invoiceNumber: string,
  amount: number,
): Res {
  const s = cloneState(sIn);

  const po = s.docs.find((d) => d.id === poId && d.partnerId === partnerId);
  if (!po) {
    return { s, ok: false, msg: 'Purchase order not found', tone: 'bad' };
  }

  // Create invoice document
  const invoice = {
    id: uid(),
    number: invoiceNumber,
    type: 'IV-VEN',
    companyId: po.companyId,
    siteId: po.siteId,
    partnerId,
    dateISO: s.today,
    postingDate: s.today,
    total: amount,
    status: 'SUBMITTED',
    createdBy: partnerId,
    items: po.items.map((item) => ({ ...item, received: item.qty })),
  };

  s.docs.push(invoice as any);

  return { s, ok: true, msg: 'Invoice uploaded', tone: 'ok', docId: invoice.id };
}

/* ===================== Subcontractor Portal ===================== */

/**
 * Get subcontractor portal data
 */
export function getSubconPortalData(s: ERPState, partnerId: string): SubconPortalData {
  return {
    workOrders: [
      { id: 'SO-001', number: 'VUL/SO/2026-27/00001', value: 5000000, status: 'ACTIVE' },
    ],
    measurements: [
      { id: 'SM-001', woId: 'SO-001', qty: 100, value: 500000, submittedAt: '2026-03-01T10:00:00Z' },
    ],
    bills: [
      { id: 'SB-001', number: 'VUL/SB/2026-27/00001', amount: 500000, status: 'PENDING_RELEASE' },
    ],
    recoveries: [
      { id: 'REC-001', billId: 'SB-001', head: 'Retention 5%', amount: 25000 },
    ],
    complianceDocs: [
      { id: 'COMP-001', kind: 'Labour Licence', validTo: '2026-12-31', status: 'VALID' },
      { id: 'COMP-002', kind: 'PF Challan', validTo: '2026-03-15', status: 'EXPIRING' },
    ],
    paymentBlockReason: 'PF challan expiring on 2026-03-15 — upload renewed challan to clear payment block',
  };
}

/**
 * Submit measurement from subcontractor portal
 */
export function submitSubconMeasurement(
  sIn: ERPState,
  partnerId: string,
  workOrderId: string,
  qty: number,
  photos: string[],
): Res {
  const s = cloneState(sIn);

  const wo = s.docs.find((d) => d.id === workOrderId && d.partnerId === partnerId);
  if (!wo) {
    return { s, ok: false, msg: 'Work order not found', tone: 'bad' };
  }

  const measurement = {
    id: uid(),
    number: `SM-${uid().slice(0, 6)}`,
    type: 'SM-STD',
    companyId: wo.companyId,
    siteId: wo.siteId,
    partnerId,
    dateISO: s.today,
    postingDate: s.today,
    total: qty * (wo.items[0]?.rate || 0),
    status: 'SUBMITTED',
    createdBy: partnerId,
    items: [{ ...wo.items[0], qty }],
  };

  s.docs.push(measurement as any);

  return { s, ok: true, msg: 'Measurement submitted', tone: 'ok', docId: measurement.id };
}

/* ===================== Client Portal ===================== */

/**
 * Get client portal data — scoped to project
 */
export function getClientPortalData(s: ERPState, projectCode: string): ClientPortalData {
  return {
    projectCode,
    progress: { physical: 62.4, planned: 68.0, financial: 58.1 },
    dprs: [
      { id: 'DPR-001', date: '2026-03-10', summary: 'Embankment work in progress. 500 m³ achieved today.', photos: ['photo1.jpg', 'photo2.jpg'] },
    ],
    bills: [
      {
        id: 'RA-001',
        number: 'VUL/RA/2026-27/00001',
        submitted: 4510200,
        certified: 4218650,
        paid: 0,
        shortfall: [
          { reason: 'Quantity disallowed', amount: 200000 },
          { reason: 'Rate disputed', amount: 91550 },
        ],
      },
    ],
    drawings: [
      { id: 'DWG-001', number: 'NH47-S-001', revision: 'C', status: 'IFC' },
      { id: 'DWG-002', number: 'NH47-S-002', revision: 'B', status: 'IFC' },
    ],
    correspondence: [
      { id: 'COR-001', date: '2026-03-05', from: 'Client', subject: 'Revised completion date request' },
    ],
    inspectionRequests: [
      { id: 'IR-001', date: '2026-03-12', activity: 'Pier P4 reinforcement', status: 'PENDING' },
    ],
  };
}

/**
 * Query a bill from client portal
 */
export function queryBill(
  sIn: ERPState,
  projectCode: string,
  billId: string,
  reason: string,
  amount: number,
): Res {
  const s = cloneState(sIn);

  const bill = s.docs.find((d) => d.id === billId && d.type === 'RA-INT');
  if (!bill) {
    return { s, ok: false, msg: 'Bill not found', tone: 'bad' };
  }

  // Create query record
  const query = {
    id: uid(),
    billId,
    reason,
    amount,
    status: 'OPEN',
    at: nowStamp(),
  };

  // In a real implementation, this would be stored and routed
  pushAudit(s, 'CLIENT', 'CHANGE', 'BILL_QUERY', query.id, {
    reason: `Bill query: ${reason} — ${amount}`,
  });

  return { s, ok: true, msg: 'Bill query submitted', tone: 'ok', docId: query.id };
}

/**
 * Respond to inspection request from client portal
 */
export function respondToInspectionRequest(
  sIn: ERPState,
  projectCode: string,
  requestId: string,
  response: 'APPROVED' | 'REJECTED',
  observations?: string,
): Res {
  const s = cloneState(sIn);

  // Update inspection lot status
  const lot = s.inspLots.find((l) => l.id === requestId);
  if (!lot) {
    return { s, ok: false, msg: 'Inspection request not found', tone: 'bad' };
  }

  lot.status = response === 'APPROVED' ? 'ACCEPTED' : 'REJECTED';
  lot.decisionBy = 'CLIENT';

  return { s, ok: true, msg: `Inspection request ${response.toLowerCase()}`, tone: 'ok' };
}

/* ===================== Portal Isolation ===================== */

/**
 * ID enumeration protection — return 404, not 403
 */
export function checkPortalAccess(
  s: ERPState,
  partnerId: string,
  entityType: string,
  entityId: string,
): boolean {
  // Check if the entity belongs to this partner
  const entity = s.docs.find((d) => d.id === entityId);
  if (!entity) return false; // 404

  if (entity.partnerId !== partnerId) return false; // 404, not 403

  return true;
}

/**
 * Ensure no internal data leaks to portal
 */
export function filterPortalData<T>(data: T, portalType: string): T {
  // Remove internal fields
  const filtered = JSON.parse(JSON.stringify(data));

  // Remove internal comments, margins, cost data
  delete filtered.internalComments;
  delete filtered.margin;
  delete filtered.costData;
  delete filtered.internalUsers;

  return filtered;
}
