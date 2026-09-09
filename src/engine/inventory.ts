// Part 5 - Stores & Inventory Engine
// Movement Types, Gate to Bin, Valuation, Reconciliation

import type { ERPState, Res, Material, MovementType, Doc, DocItem } from './types';

// Movement Types - 30+ types covering all stock movements
export const MOVEMENT_TYPES: MovementType[] = [
  // Goods Receipt
  { code: '100', name: 'Goods Receipt against Order', sign: '+', fromType: null, toType: 'UNR', valuationRelevant: true, accountModifier: 'GR', reversal: '105' },
  { code: '101', name: 'Goods Receipt to Quality Hold', sign: '+', fromType: null, toType: 'QH', valuationRelevant: true, accountModifier: 'GR', reversal: '105' },
  { code: '102', name: 'Usage Decision: Hold to Unrestricted', sign: 'T', fromType: 'QH', toType: 'UNR', valuationRelevant: false, accountModifier: null, reversal: null },
  { code: '103', name: 'Usage Decision: Hold to Blocked', sign: 'T', fromType: 'QH', toType: 'BLK', valuationRelevant: false, accountModifier: null, reversal: null },
  { code: '104', name: 'Usage Decision: Accept with Deviation', sign: 'T', fromType: 'QH', toType: 'UNR', valuationRelevant: true, accountModifier: 'PD', reversal: null },
  { code: '105', name: 'Reversal of Goods Receipt', sign: '-', fromType: 'UNR', toType: null, valuationRelevant: true, accountModifier: 'GR', reversal: '100' },
  { code: '110', name: 'Return to Vendor', sign: '-', fromType: 'UNR', toType: null, valuationRelevant: true, accountModifier: 'GR', reversal: null },
  { code: '120', name: 'Receipt without Order', sign: '+', fromType: null, toType: 'UNR', valuationRelevant: true, accountModifier: 'GR', reversal: null },
  { code: '130', name: 'Client-Issued Material Receipt', sign: '+', fromType: null, toType: 'CI', valuationRelevant: true, accountModifier: 'CI', reversal: null },
  { code: '140', name: 'Receipt of Production Output', sign: '+', fromType: null, toType: 'UNR', valuationRelevant: true, accountModifier: 'PR', reversal: null },
  
  // Issues
  { code: '200', name: 'Issue to WBS Element', sign: '-', fromType: 'UNR', toType: null, valuationRelevant: true, accountModifier: 'CO', reversal: '220' },
  { code: '205', name: 'Issue to Cost Centre', sign: '-', fromType: 'UNR', toType: null, valuationRelevant: true, accountModifier: 'CC', reversal: null },
  { code: '210', name: 'Issue to Maintenance Order', sign: '-', fromType: 'UNR', toType: null, valuationRelevant: true, accountModifier: 'MO', reversal: null },
  { code: '215', name: 'Issue to Production Order', sign: '-', fromType: 'UNR', toType: null, valuationRelevant: true, accountModifier: 'PO', reversal: null },
  { code: '220', name: 'Return from WBS to Store', sign: '+', fromType: null, toType: 'UNR', valuationRelevant: true, accountModifier: 'CO', reversal: '200' },
  
  // Returnables
  { code: '230', name: 'Returnable Issue Out', sign: 'T', fromType: 'UNR', toType: 'RET', valuationRelevant: false, accountModifier: null, reversal: '235' },
  { code: '235', name: 'Returnable Return In', sign: 'T', fromType: 'RET', toType: 'UNR', valuationRelevant: false, accountModifier: null, reversal: '230' },
  { code: '240', name: 'Returnable Loss/Damage Recovery', sign: '-', fromType: 'RET', toType: null, valuationRelevant: true, accountModifier: 'RC', reversal: null },
  
  // Transfers
  { code: '300', name: 'Site-to-Site Transfer - Issue', sign: '-', fromType: 'UNR', toType: 'TRN', valuationRelevant: true, accountModifier: 'TT', reversal: '301' },
  { code: '301', name: 'Site-to-Site Transfer - Receipt', sign: '+', fromType: 'TRN', toType: 'UNR', valuationRelevant: true, accountModifier: 'TT', reversal: '300' },
  { code: '305', name: 'Transit Loss on Transfer', sign: '-', fromType: 'TRN', toType: null, valuationRelevant: true, accountModifier: 'TL', reversal: null },
  { code: '310', name: 'Storage Location Transfer', sign: 'T', fromType: 'UNR', toType: 'UNR', valuationRelevant: false, accountModifier: null, reversal: null },
  { code: '320', name: 'Bin Transfer', sign: 'T', fromType: 'UNR', toType: 'UNR', valuationRelevant: false, accountModifier: null, reversal: null },
  
  // Subcontractor
  { code: '400', name: 'Issue Components to Subcontractor', sign: 'T', fromType: 'UNR', toType: 'SUB', valuationRelevant: false, accountModifier: null, reversal: '420' },
  { code: '410', name: 'Component Consumption on Subcontract Receipt', sign: '-', fromType: 'SUB', toType: null, valuationRelevant: true, accountModifier: 'SC', reversal: null },
  { code: '420', name: 'Return from Subcontractor', sign: 'T', fromType: 'SUB', toType: 'UNR', valuationRelevant: false, accountModifier: null, reversal: '400' },
  { code: '430', name: 'Recoverable Issue to Subcontractor', sign: '-', fromType: 'UNR', toType: null, valuationRelevant: true, accountModifier: 'SR', reversal: null },
  
  // Physical Inventory
  { code: '500', name: 'Physical Inventory Gain', sign: '+', fromType: null, toType: 'UNR', valuationRelevant: true, accountModifier: 'ID', reversal: '510' },
  { code: '510', name: 'Physical Inventory Loss', sign: '-', fromType: 'UNR', toType: null, valuationRelevant: true, accountModifier: 'ID', reversal: '500' },
  { code: '520', name: 'Scrapping / Write-off', sign: '-', fromType: 'UNR', toType: null, valuationRelevant: true, accountModifier: 'WO', reversal: null },
  { code: '525', name: 'Scrap Generation', sign: '+', fromType: null, toType: 'SCR', valuationRelevant: true, accountModifier: 'SG', reversal: null },
  { code: '530', name: 'Revaluation', sign: 'T', fromType: 'UNR', toType: 'UNR', valuationRelevant: true, accountModifier: 'RV', reversal: null },
  
  // Sales
  { code: '600', name: 'Goods Issue for Sale', sign: '-', fromType: 'UNR', toType: null, valuationRelevant: true, accountModifier: 'SL', reversal: '610' },
  { code: '610', name: 'Sales Return', sign: '+', fromType: null, toType: 'UNR', valuationRelevant: true, accountModifier: 'SL', reversal: '600' },
];

// Stock Structure
export interface StockRow {
  id: string;
  materialCode: string;
  siteId: string;
  locId: string;
  batch?: string;
  specialStock?: string;
  qty: number;
  value: number;
  avgPrice: number;
}

export interface GateEntry {
  id: string;
  number: string;
  siteId: string;
  vehicleNo: string;
  driver: string;
  transporter: string;
  poRef?: string;
  materialCode: string;
  declaredQty: number;
  sealOk: boolean;
  status: 'PENDING' | 'COMPLETED';
  at: string;
}

export interface WeighTicket {
  id: string;
  number: string;
  gateEntryId: string;
  grossWeight: number;
  tareWeight: number;
  netWeight: number;
  operator: string;
  manualEntry: boolean;
  tareFlagged: boolean;
  at: string;
}

export interface Reservation {
  id: string;
  materialCode: string;
  siteId: string;
  wbs: string;
  qty: number;
  reservedAt: string;
  expiresAt: string;
  status: 'ACTIVE' | 'EXPIRED' | 'RELEASED';
}

export interface ReturnableIssue {
  id: string;
  materialCode: string;
  siteId: string;
  wbs: string;
  qty: number;
  issuedTo: string;
  issuedAt: string;
  expectedReturnDate: string;
  returnedQty: number;
  returnedAt?: string;
  condition?: 'SERVICEABLE' | 'REPAIRABLE' | 'SCRAP';
  lossQty: number;
  recoveryValue: number;
  status: 'ISSUED' | 'PARTIAL_RETURN' | 'RETURNED' | 'LOST';
}

export interface PhysicalCount {
  id: string;
  number: string;
  siteId: string;
  locId: string;
  materialCode: string;
  bookQty: number;
  countedQty: number;
  variance: number;
  blind: boolean;
  reason?: string;
  status: 'DRAFT' | 'APPROVED' | 'POSTED';
  countDate: string;
  postedAt?: string;
}

export interface MaterialReconciliation {
  id: string;
  projectCode: string;
  wbs: string;
  materialCode: string;
  period: string;
  theoretical: number;
  actual: number;
  variance: number;
  variancePct: number;
  flag: 'GREEN' | 'AMBER' | 'RED';
  issueSlips: string[];
  measurements: string[];
  status: 'DRAFT' | 'APPROVED';
  pmExplanation?: string;
}

// Core Functions

export function postMovement(
  state: ERPState,
  args: {
    movementCode: string;
    materialCode: string;
    qty: number;
    siteId: string;
    locId?: string;
    locToId?: string;
    wbs?: string;
    cc?: string;
    reason?: string;
    docRef?: string;
  },
  userId: string
): Res {
  const mvt = MOVEMENT_TYPES.find(m => m.code === args.movementCode);
  if (!mvt) {
    return { s: state, ok: false, msg: `Movement type ${args.movementCode} not found` };
  }

  // Validate negative stock
  if (mvt.sign === '-' || mvt.sign === 'T') {
    const currentStock = state.stock.find(
      s => s.materialCode === args.materialCode && 
           s.siteId === args.siteId && 
           s.locId === (mvt.fromType || args.locId)
    );
    if (!currentStock || currentStock.qty < args.qty) {
      return { s: state, ok: false, msg: 'Insufficient stock - negative stock not permitted' };
    }
  }

  // Create material document
  const docId = `MAT-${Date.now()}`;
  const doc: Doc = {
    id: docId,
    number: `MVT-${mvt.code}-${Date.now()}`,
    type: `MVT-${mvt.code}`,
    companyId: 'VUL',
    siteId: args.siteId,
    partnerId: '',
    dateISO: state.today,
    postingDate: state.today,
    status: 'POSTED',
    total: 0,
    createdBy: userId,
    items: [{
      id: `${docId}-1`,
      line: 1,
      materialCode: args.materialCode,
      description: mvt.name,
      qty: args.qty,
      uom: 'EA',
      rate: 0,
      amount: 0,
      wbs: args.wbs,
      cc: args.cc,
    }],
  };

  // Update stock
  const newStock = [...state.stock];
  
  if (mvt.sign === '+') {
    // Add stock
    const existingIdx = newStock.findIndex(
      s => s.materialCode === args.materialCode && 
           s.siteId === args.siteId && 
           s.locId === mvt.toType
    );
    if (existingIdx >= 0) {
      const existing = newStock[existingIdx];
      const newValue = existing.value + (args.qty * existing.avgPrice);
      newStock[existingIdx] = {
        ...existing,
        qty: existing.qty + args.qty,
        value: newValue,
      };
    } else {
      newStock.push({
        id: `STK-${Date.now()}`,
        materialCode: args.materialCode,
        siteId: args.siteId,
        locId: mvt.toType!,
        qty: args.qty,
        value: args.qty * 100, // Default price
        avgPrice: 100,
      });
    }
  } else if (mvt.sign === '-') {
    // Remove stock
    const existingIdx = newStock.findIndex(
      s => s.materialCode === args.materialCode && 
           s.siteId === args.siteId && 
           s.locId === mvt.fromType
    );
    if (existingIdx >= 0) {
      const existing = newStock[existingIdx];
      const removedValue = args.qty * existing.avgPrice;
      newStock[existingIdx] = {
        ...existing,
        qty: existing.qty - args.qty,
        value: existing.value - removedValue,
      };
      if (newStock[existingIdx].qty === 0) {
        newStock.splice(existingIdx, 1);
      }
    }
  } else if (mvt.sign === 'T') {
    // Transfer
    const fromIdx = newStock.findIndex(
      s => s.materialCode === args.materialCode && 
           s.siteId === args.siteId && 
           s.locId === mvt.fromType
    );
    const toIdx = newStock.findIndex(
      s => s.materialCode === args.materialCode && 
           s.siteId === args.siteId && 
           s.locId === mvt.toType
    );
    
    if (fromIdx >= 0) {
      const from = newStock[fromIdx];
      const transferValue = args.qty * from.avgPrice;
      
      newStock[fromIdx] = {
        ...from,
        qty: from.qty - args.qty,
        value: from.value - transferValue,
      };
      
      if (newStock[fromIdx].qty === 0) {
        newStock.splice(fromIdx, 1);
      }
      
      if (toIdx >= 0) {
        newStock[toIdx] = {
          ...newStock[toIdx],
          qty: newStock[toIdx].qty + args.qty,
          value: newStock[toIdx].value + transferValue,
        };
      } else {
        newStock.push({
          id: `STK-${Date.now()}`,
          materialCode: args.materialCode,
          siteId: args.siteId,
          locId: mvt.toType!,
          qty: args.qty,
          value: transferValue,
          avgPrice: from.avgPrice,
        });
      }
    }
  }

  // Create journal entry if valuation relevant
  if (mvt.valuationRelevant) {
    const journalId = `JRN-${Date.now()}`;
    const value = args.qty * 100; // Default price
    
    state.journals.push({
      id: journalId,
      number: `JV-${journalId}`,
      companyId: 'VUL',
      dateISO: state.today,
      fy: '2026-27',
      period: 10,
      lines: [
        { account: '300000', dr: value, cr: 0, text: mvt.name },
        { account: '400000', dr: 0, cr: value, text: mvt.name },
      ],
      refId: docId,
      refNumber: doc.number,
      status: 'POSTED',
      createdBy: userId,
    });
  }

  return {
    s: { ...state, docs: [...state.docs, doc], stock: newStock },
    ok: true,
    msg: `Movement ${mvt.code} posted successfully`,
    docId,
  };
}

export function createGateEntry(
  state: ERPState,
  args: {
    siteId: string;
    vehicleNo: string;
    driver: string;
    transporter: string;
    poRef?: string;
    materialCode: string;
    declaredQty: number;
    sealOk: boolean;
  },
  userId: string
): Res {
  const gateEntry: GateEntry = {
    id: `GE-${Date.now()}`,
    number: `GE-IN-${Date.now()}`,
    siteId: args.siteId,
    vehicleNo: args.vehicleNo,
    driver: args.driver,
    transporter: args.transporter,
    poRef: args.poRef,
    materialCode: args.materialCode,
    declaredQty: args.declaredQty,
    sealOk: args.sealOk,
    status: 'PENDING',
    at: state.today,
  };

  return {
    s: { ...state, gateEntries: [...state.gateEntries, gateEntry] },
    ok: true,
    msg: 'Gate entry created',
    docId: gateEntry.id,
  };
}

export function createWeighTicket(
  state: ERPState,
  args: {
    gateEntryId: string;
    grossWeight: number;
    tareWeight: number;
    operator: string;
    manualEntry: boolean;
  },
  userId: string
): Res {
  const gateEntry = state.gateEntries.find(g => g.id === args.gateEntryId);
  if (!gateEntry) {
    return { s: state, ok: false, msg: 'Gate entry not found' };
  }

  // Check tare weight fraud
  const historicalTares = state.weighTickets
    .filter(w => w.gateEntryId === args.gateEntryId)
    .map(w => w.tareWeight);
  
  const avgTare = historicalTares.length > 0 
    ? historicalTares.reduce((a, b) => a + b, 0) / historicalTares.length 
    : args.tareWeight;
  
  const tareFlagged = Math.abs(args.tareWeight - avgTare) > avgTare * 0.1;

  const weighTicket: WeighTicket = {
    id: `WT-${Date.now()}`,
    number: `WB-TKT-${Date.now()}`,
    gateEntryId: args.gateEntryId,
    grossWeight: args.grossWeight,
    tareWeight: args.tareWeight,
    netWeight: args.grossWeight - args.tareWeight,
    operator: args.operator,
    manualEntry: args.manualEntry,
    tareFlagged,
    at: state.today,
  };

  return {
    s: { ...state, weighTickets: [...state.weighTickets, weighTicket] },
    ok: true,
    msg: tareFlagged ? 'Weigh ticket created - tare weight flagged for review' : 'Weigh ticket created',
    docId: weighTicket.id,
  };
}

export function createReservation(
  state: ERPState,
  args: {
    materialCode: string;
    siteId: string;
    wbs: string;
    qty: number;
    daysValid: number;
  },
  userId: string
): Res {
  // Check available stock
  const stock = state.stock.find(
    s => s.materialCode === args.materialCode && 
         s.siteId === args.siteId && 
         s.locId === 'UNR'
  );

  const reserved = state.reservations
    .filter(r => r.materialCode === args.materialCode && 
                 r.siteId === args.siteId && 
                 r.status === 'ACTIVE')
    .reduce((sum, r) => sum + r.qty, 0);

  const available = (stock?.qty || 0) - reserved;

  if (available < args.qty) {
    return { s: state, ok: false, msg: `Insufficient stock - available: ${available}, requested: ${args.qty}` };
  }

  const expiresAt = new Date(state.today);
  expiresAt.setDate(expiresAt.getDate() + args.daysValid);

  const reservation: Reservation = {
    id: `RES-${Date.now()}`,
    materialCode: args.materialCode,
    siteId: args.siteId,
    wbs: args.wbs,
    qty: args.qty,
    reservedAt: state.today,
    expiresAt: expiresAt.toISOString().split('T')[0],
    status: 'ACTIVE',
  };

  return {
    s: { ...state, reservations: [...state.reservations, reservation] },
    ok: true,
    msg: 'Reservation created',
    docId: reservation.id,
  };
}

export function createReturnableIssue(
  state: ERPState,
  args: {
    materialCode: string;
    siteId: string;
    wbs: string;
    qty: number;
    issuedTo: string;
    expectedReturnDate: string;
  },
  userId: string
): Res {
  const returnable: ReturnableIssue = {
    id: `RET-${Date.now()}`,
    materialCode: args.materialCode,
    siteId: args.siteId,
    wbs: args.wbs,
    qty: args.qty,
    issuedTo: args.issuedTo,
    issuedAt: state.today,
    expectedReturnDate: args.expectedReturnDate,
    returnedQty: 0,
    lossQty: 0,
    recoveryValue: 0,
    status: 'ISSUED',
  };

  // Post movement 230
  const moveRes = postMovement(state, {
    movementCode: '230',
    materialCode: args.materialCode,
    qty: args.qty,
    siteId: args.siteId,
    wbs: args.wbs,
  }, userId);

  if (!moveRes.ok) {
    return moveRes;
  }

  return {
    s: { ...moveRes.s, returnables: [...moveRes.s.returnables, returnable] },
    ok: true,
    msg: 'Returnable issued',
    docId: returnable.id,
  };
}

export function createPhysicalCount(
  state: ERPState,
  args: {
    siteId: string;
    locId: string;
    materialCode: string;
    countedQty: number;
    blind: boolean;
    reason?: string;
  },
  userId: string
): Res {
  const stock = state.stock.find(
    s => s.materialCode === args.materialCode && 
         s.siteId === args.siteId && 
         s.locId === args.locId
  );

  const bookQty = stock?.qty || 0;
  const variance = args.countedQty - bookQty;

  const count: PhysicalCount = {
    id: `CNT-${Date.now()}`,
    number: `PI-${Date.now()}`,
    siteId: args.siteId,
    locId: args.locId,
    materialCode: args.materialCode,
    bookQty,
    countedQty: args.countedQty,
    variance,
    blind: args.blind,
    reason: args.reason,
    status: 'DRAFT',
    countDate: state.today,
  };

  return {
    s: { ...state, counts: [...state.counts, count] },
    ok: true,
    msg: `Physical count created - variance: ${variance}`,
    docId: count.id,
  };
}

export function calculateMaterialReconciliation(
  state: ERPState,
  args: {
    projectCode: string;
    wbs: string;
    materialCode: string;
    period: string;
  }
): MaterialReconciliation {
  // Theoretical consumption from BOQ
  const boqItems = state.boq.filter(b => b.wbsId === args.wbs);
  const theoretical = boqItems.reduce((sum, b) => {
    const coeff = b.materialCoefficients.find(c => c.materialId === args.materialCode);
    return sum + (coeff ? b.executedCumulative * coeff.coefficient : 0);
  }, 0);

  // Actual consumption from movements
  const receipts = state.docs
    .filter(d => d.type === 'GR-PO' && d.items.some(i => i.materialCode === args.materialCode))
    .reduce((sum, d) => sum + d.items.find(i => i.materialCode === args.materialCode)!.qty, 0);

  const issues = state.docs
    .filter(d => d.type === 'GI-PRJ' && d.items.some(i => i.materialCode === args.materialCode && i.wbs === args.wbs))
    .reduce((sum, d) => sum + d.items.find(i => i.materialCode === args.materialCode)!.qty, 0);

  const actual = issues;

  const variance = actual - theoretical;
  const variancePct = theoretical > 0 ? (variance / theoretical) * 100 : 0;

  let flag: 'GREEN' | 'AMBER' | 'RED' = 'GREEN';
  if (Math.abs(variancePct) > 10) flag = 'RED';
  else if (Math.abs(variancePct) > 5) flag = 'AMBER';

  return {
    id: `RECON-${Date.now()}`,
    projectCode: args.projectCode,
    wbs: args.wbs,
    materialCode: args.materialCode,
    period: args.period,
    theoretical,
    actual,
    variance,
    variancePct,
    flag,
    issueSlips: [],
    measurements: [],
    status: 'DRAFT',
  };
}

export function runStockReconciliation(
  state: ERPState,
  companyId: string
): { ok: boolean; break: number; details: string[] } {
  // Sum stock ledger value
  const stockValue = state.stock.reduce((sum, s) => sum + s.value, 0);

  // Get GL stock account balance
  const stockAccount = state.journals
    .flatMap(j => j.lines)
    .filter(l => l.account === '300000')
    .reduce((sum, l) => sum + l.dr - l.cr, 0);

  const breakAmount = Math.abs(stockValue - stockAccount);
  const ok = breakAmount < 0.01;

  return {
    ok,
    break: breakAmount,
    details: ok ? ['Stock ledger reconciles with GL'] : [`Break detected: ₹${breakAmount.toLocaleString()}`],
  };
}
