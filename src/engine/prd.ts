/* ==================================================================== */
/*  PART 8 — PRD services. Production (RMC/precast): mix design,         */
/*  batching with moisture correction, dispatch, production              */
/*  reconciliation. All movements via Part 1 framework.                  */
/* ==================================================================== */

import type { ERPState, Res, MixDesign, BatchTicket, ProductionOrder } from './types';
import {
  authorize, uid, round2, fmtNum, fmtINR, pushAudit, nowStamp, cloneState, nextNumber, postMovement,
} from './engine';

/* ---- PRD.12 Mix design master ---- */

export function createMixDesign(sIn: ERPState, args: { grade: string; proportions: { material: string; qtyPerCum: number }[]; targetSlump: number; wcRatio: number; validTo: string; approvedBy: string }, userId: string): Res {
  const s = cloneState(sIn);
  const auth = authorize(s, userId, 'PRD_MIX', '01', {});
  if (!auth.ok) return { s, ok: false, msg: auth.reason, tone: 'bad' };

  const mix: MixDesign = {
    id: uid(), grade: args.grade, proportions: args.proportions,
    targetSlump: args.targetSlump, wcRatio: args.wcRatio,
    validTo: args.validTo, approvedBy: args.approvedBy,
  };
  s.mixDesigns.unshift(mix);
  pushAudit(s, userId, 'POSTING', 'MIX_DESIGN', mix.grade, { reason: `${args.proportions.length} materials · slump ${args.targetSlump}mm · w/c ${args.wcRatio}` });
  return { s, ok: true, msg: `Mix design ${mix.grade} created — ${args.proportions.length} materials, valid until ${args.validTo}.`, tone: 'ok', docId: mix.id };
}

/* ---- PRD.12 Production flow ---- */

export function createProductionOrder(sIn: ERPState, args: { type: 'EXTERNAL' | 'INTERNAL'; customerId?: string; projectCode?: string; wbs?: string; grade: string; volumeCum: number; pourDate: string; siteId: string }, userId: string): Res {
  const s = cloneState(sIn);
  const number = nextNumber(s, 'SO', 'VUL');
  const order: ProductionOrder = {
    id: uid(), number, type: args.type, customerId: args.customerId,
    projectCode: args.projectCode, wbs: args.wbs, grade: args.grade,
    volumeCum: args.volumeCum, pourDate: args.pourDate, siteId: args.siteId,
    status: 'PLANNED',
  };
  s.productionOrders.unshift(order);
  pushAudit(s, userId, 'POSTING', 'PRODUCTION_ORDER', number, { reason: `${args.grade} · ${fmtNum(args.volumeCum, 1)} m³ · ${args.pourDate}` });
  return { s, ok: true, msg: `Production order ${number} created — ${args.grade} ${fmtNum(args.volumeCum, 1)} m³ for ${args.pourDate}.`, tone: 'ok', docId: order.id };
}

export function createBatchTicket(sIn: ERPState, args: { orderId: string; mixDesignId: string; volumeCum: number; actualWeights: { material: string; qty: number }[]; moistureCorrection: { material: string; correction: number }[] }, userId: string): Res {
  const s = cloneState(sIn);
  const order = s.productionOrders.find((o) => o.id === args.orderId);
  if (!order) return { s, ok: false, msg: 'Production order not found', tone: 'bad' };
  const mix = s.mixDesigns.find((m) => m.id === args.mixDesignId);
  if (!mix) return { s, ok: false, msg: 'Mix design not found', tone: 'bad' };

  const number = nextNumber(s, 'BT', 'VUL');
  const ticket: BatchTicket = {
    id: uid(), number, mixDesignId: args.mixDesignId, grade: mix.grade,
    volumeCum: args.volumeCum, actualWeights: args.actualWeights,
    moistureCorrection: args.moistureCorrection, slumpTest: null,
    dispatched: false, delivered: false, at: nowStamp(),
  };
  s.batchTickets.unshift(ticket);
  order.status = 'BATCHED';

  /* Post raw material consumption (movement 215) */
  for (const w of args.actualWeights) {
    const corrected = w.qty - (args.moistureCorrection.find((c) => c.material === w.material)?.correction ?? 0);
    postMovement(s, { movementCode: '215', materialCode: w.material, qty: corrected, siteId: order.siteId, locId: 'UNR', wbs: order.wbs, refDocId: order.id }, userId);
  }

  /* Post production receipt (movement 140) */
  postMovement(s, { movementCode: '140', materialCode: `RMC-${mix.grade}`, qty: args.volumeCum, siteId: order.siteId, locId: 'UNR', rate: 0, refDocId: order.id }, userId);

  pushAudit(s, userId, 'POSTING', 'BATCH_TICKET', number, { reason: `${mix.grade} · ${fmtNum(args.volumeCum, 1)} m³ · moisture correction applied` });
  return { s, ok: true, msg: `Batch ticket ${number} created — ${mix.grade} ${fmtNum(args.volumeCum, 1)} m³. Raw materials consumed, production receipt posted.`, tone: 'ok', docId: ticket.id };
}

/* ---- PRD.12 Slump test and dispatch ---- */

export function recordSlumpTest(sIn: ERPState, ticketId: string, slump: number, targetSlump: number, userId: string): Res {
  const s = cloneState(sIn);
  const ticket = s.batchTickets.find((t) => t.id === ticketId);
  if (!ticket) return { s, ok: false, msg: 'Batch ticket not found', tone: 'bad' };

  const pass = Math.abs(slump - targetSlump) <= 25; // ±25mm tolerance
  ticket.slumpTest = { result: slump, pass };
  pushAudit(s, userId, 'POSTING', 'SLUMP_TEST', ticket.number, { reason: `${slump}mm vs target ${targetSlump}mm · ${pass ? 'PASS' : 'FAIL'}` });
  return { s, ok: true, msg: `Slump test recorded: ${slump}mm vs target ${targetSlump}mm — ${pass ? 'PASS' : 'FAIL'}.`, tone: pass ? 'ok' : 'warn' };
}

export function dispatchBatch(sIn: ERPState, ticketId: string, userId: string): Res {
  const s = cloneState(sIn);
  const ticket = s.batchTickets.find((t) => t.id === ticketId);
  if (!ticket) return { s, ok: false, msg: 'Batch ticket not found', tone: 'bad' };
  if (!ticket.slumpTest || !ticket.slumpTest.pass) {
    return { s, ok: false, msg: 'Dispatch blocked: slump test not passed. Concrete cannot be dispatched until slump is within tolerance.', tone: 'bad' };
  }

  ticket.dispatched = true;
  const order = s.productionOrders.find((o) => o.id === ticket.mixDesignId);
  if (order) order.status = 'DISPATCHED';

  /* Post dispatch (movement 600) */
  postMovement(s, { movementCode: '600', materialCode: `RMC-${ticket.grade}`, qty: ticket.volumeCum, siteId: 'ST-RMC', locId: 'UNR', rate: 0, refDocId: ticket.id }, userId);

  pushAudit(s, userId, 'POSTING', 'DISPATCH', ticket.number, { reason: `${ticket.grade} ${fmtNum(ticket.volumeCum, 1)} m³ dispatched` });
  return { s, ok: true, msg: `Batch ${ticket.number} dispatched — ${ticket.grade} ${fmtNum(ticket.volumeCum, 1)} m³.`, tone: 'ok' };
}

/* ---- PRD.13 Production reconciliation ---- */

export interface ProductionReconLine {
  material: string;
  theoretical: number;
  actual: number;
  variance: number;
  variancePct: number;
  flagged: boolean;
}

export function productionReconciliation(s: ERPState, period: string): ProductionReconLine[] {
  const batches = s.batchTickets.filter((b) => b.at.startsWith(period));
  const recon: Record<string, { theoretical: number; actual: number }> = {};

  for (const batch of batches) {
    const mix = s.mixDesigns.find((m) => m.id === batch.mixDesignId);
    if (!mix) continue;

    /* Theoretical from mix design proportions × volume */
    for (const prop of mix.proportions) {
      const theo = round2(prop.qtyPerCum * batch.volumeCum);
      recon[prop.material] = recon[prop.material] || { theoretical: 0, actual: 0 };
      recon[prop.material].theoretical += theo;
    }

    /* Actual from batch ticket weights */
    for (const w of batch.actualWeights) {
      recon[w.material] = recon[w.material] || { theoretical: 0, actual: 0 };
      recon[w.material].actual += w.qty;
    }
  }

  return Object.entries(recon).map(([material, r]) => {
    const variance = round2(r.actual - r.theoretical);
    const variancePct = r.theoretical > 0 ? round2((variance / r.theoretical) * 100) : 0;
    const flagged = material.includes('CEM') && Math.abs(variancePct) > 5; // Cement variance > 5% flagged
    return { material, theoretical: r.theoretical, actual: r.actual, variance, variancePct, flagged };
  });
}

/* ---- PRD.13 Cost per cubic metre ---- */

export function costPerCum(s: ERPState, grade: string): number {
  const batches = s.batchTickets.filter((b) => b.grade === grade);
  if (!batches.length) return 0;

  let totalCost = 0;
  let totalVolume = 0;
  for (const batch of batches) {
    for (const w of batch.actualWeights) {
      // Simplified: use material price from stock
      const stock = s.stock.find((st) => st.materialCode === w.material);
      const price = stock ? stock.value / stock.qty : 0;
      totalCost += w.qty * price;
    }
    totalVolume += batch.volumeCum;
  }

  return totalVolume > 0 ? round2(totalCost / totalVolume) : 0;
}
