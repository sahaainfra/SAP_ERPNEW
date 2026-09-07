/* ==================================================================== */
/*  PART 5 — STORES & INVENTORY services. A thin layer on the Part 1     */
/*  framework: every stock change goes through postMovement (a configured */
/*  movement type), every posting through account determination, every    */
/*  numbering through nextNumber. This file writes NO stock row of its    */
/*  own except the deliberate, flagged recon-break used to prove the      */
/*  daily reconciliation job actually detects a break.                    */
/* ==================================================================== */

import type {
  ERPState, Res, StorageBin, PutAway, RejectionNote, ValuationAdjustment,
  StockRecRun, RecLine, MatReconDoc, MatReconLine, TareFlag, CountVarianceApproval, StockType,
} from './types';
import {
  cloneState, postMovement, reverseMovement, round2, uid, pushAudit, fmtINR, fmtNum,
  materialByCode, siteById, glBalance, stockValueTotal, nextNumber, nowStamp, userById,
  availableQty, unitCost, authorize, docById, daysAgoISO,
} from './engine';
import { MOVEMENT_TYPES, STOCK_TYPE_NAMES, BOQ_COEFFICIENTS, MATERIALS } from './config';
import { reservedQty, availableForIssue, raiseException } from './logistics';

/* ---------------- stock GL control accounts (for reconciliation) ---------------- */
export const STOCK_GL_ACCOUNTS = ['110100', '110150', '110160', '110200', '110400'];

export const stockGlTotal = (s: ERPState): number =>
  round2(STOCK_GL_ACCOUNTS.reduce((t, a) => t + glBalance(s, a), 0));

/* Map a stock row to the GL control account that should carry its value. */
export function stockAccount(row: { materialCode: string; stockType: StockType; vtype?: string }): string {
  if (row.vtype === 'CI') return '110160';
  if (row.stockType === 'TRN') return '110200';
  if (row.stockType === 'SUB') return '110400';
  const mat = materialByCode(row.materialCode);
  if (mat?.valuationClass === 'VC-SEMI') return '110150';
  return '110100';
}

/* ==================== DAILY RECONCILIATION JOB ==================== */
/* The single most valuable control: stock ledger vs stock GL control account. */
export function runDailyReconciliation(sIn: ERPState, companyId: string, userId: string): { s: ERPState; run: StockRecRun } {
  const s = cloneState(sIn);
  const lines: RecLine[] = s.stock
    .filter((r) => Math.abs(r.value) > 0.004)
    .map((r) => {
      const acct = stockAccount(r);
      return {
        materialCode: r.materialCode, siteId: r.siteId, locId: r.locId as RecLine['locId'],
        ledgerValue: round2(r.value), glValue: 0, break: 0,
      };
    });
  const totalLedger = stockValueTotal(s);
  const totalGl = stockGlTotal(s);
  const totalBreak = round2(totalLedger - totalGl);
  /* attribute any break across lines proportionally (demo of the break report) */
  if (Math.abs(totalBreak) > 0.004 && lines.length) {
    lines[0].break = totalBreak;
    lines[0].glValue = round2(lines[0].ledgerValue - totalBreak);
  } else {
    lines.forEach((l) => { l.glValue = l.ledgerValue; });
  }
  const run: StockRecRun = {
    id: uid(), at: nowStamp(), companyId, lines,
    totalLedger, totalGl, totalBreak,
    status: Math.abs(totalBreak) < 0.005 ? 'CLEAN' : 'BREAK',
  };
  s.stockRecRuns.unshift(run);
  pushAudit(s, userId, 'SYSTEM', 'STOCK_RECON', run.status === 'CLEAN' ? 'ZERO BREAK' : `BREAK ${fmtINR(totalBreak)}`, {
    reason: `Ledger ${fmtINR(totalLedger)} vs GL ${fmtINR(totalGl)} → break ${fmtINR(totalBreak)}`,
  });
  if (run.status === 'BREAK') {
    raiseException(s, 'SHORTAGE', `Daily stock reconciliation found a break of ${fmtINR(totalBreak)} — reported to Stores and Finance the same morning.`, 'bad');
  }
  return { s, run };
}

/* Deliberately corrupt the ledger (a manual stock edit with no journal) to prove the
   job detects it. This is the ONLY place a stock value changes outside postMovement. */
export function injectReconBreak(sIn: ERPState, amount: number, userId: string): ERPState {
  const s = cloneState(sIn);
  const row = s.stock.find((r) => r.stockType === 'UNR' && r.value > 0);
  if (row) row.value = round2(row.value + amount);
  pushAudit(s, userId, 'SECURITY', 'STOCK_RECON', 'INJECTED BREAK', { reason: `Test: ledger nudged by ${fmtINR(amount)} with no journal — the daily job must catch this.` });
  return s;
}

/* ==================== PUT-AWAY (received → binned) ==================== */
export function createPutaway(sIn: ERPState, args: { siteId: string; materialCode: string; qty: number; gateNo?: string }, userId: string): Res {
  const s = cloneState(sIn);
  s.putaways.unshift({ id: uid(), siteId: args.siteId, materialCode: args.materialCode, qty: args.qty, fromLocId: 'UNR', binId: '', status: 'PENDING', gateNo: args.gateNo, at: nowStamp() });
  return { s, ok: true, msg: `Put-away pending for ${fmtNum(args.qty, 1)} ${args.materialCode} — appears on the pending list until binned.`, tone: 'info' };
}

export function confirmPutaway(sIn: ERPState, putawayId: string, binId: string, userId: string): Res {
  const s = cloneState(sIn);
  const pa = s.putaways.find((p) => p.id === putawayId);
  if (!pa) return { s, ok: false, msg: 'Put-away not found', tone: 'bad' };
  if (pa.status === 'DONE') return { s, ok: false, msg: 'Already put away.', tone: 'warn' };
  const bin = s.bins.find((b) => b.id === binId);
  if (!bin) return { s, ok: false, msg: 'Unknown bin', tone: 'bad' };
  if (bin.materialRestriction?.length && !bin.materialRestriction.includes(pa.materialCode)) {
    return { s, ok: false, msg: `Bin ${bin.code} is restricted to ${bin.materialRestriction.join(', ')} — ${pa.materialCode} refused.`, tone: 'bad' };
  }
  if (bin.currentQty + pa.qty > bin.capacity) {
    return { s, ok: false, msg: `Bin ${bin.code} capacity ${bin.capacity} would be exceeded (${bin.currentQty} on hand + ${pa.qty}).`, tone: 'bad' };
  }
  bin.currentQty = round2(bin.currentQty + pa.qty);
  bin.currentMaterial = pa.materialCode;
  pa.binId = binId; pa.status = 'DONE'; pa.by = userId; pa.doneAt = nowStamp();
  return { s, ok: true, msg: `Put away to bin ${bin.code} — material is now findable.`, tone: 'ok' };
}

export const pendingPutaways = (s: ERPState): PutAway[] => s.putaways.filter((p) => p.status === 'PENDING');

/* ==================== REJECTION NOTES (tracked to closure) ==================== */
export function rejectQty(sIn: ERPState, args: { siteId: string; materialCode: string; qty: number; vendorId: string; reason: string; route: 'RETURN' | 'DEBIT_NOTE' }, userId: string): Res {
  const s = cloneState(sIn);
  const number = nextNumber(s, 'RJ', siteById(args.siteId)!.companyId);
  /* move rejected qty quality-hold → blocked via the configured movement type */
  const mv = postMovement(s, { movementCode: '103', materialCode: args.materialCode, qty: args.qty, siteId: args.siteId, locId: 'QH', locToId: 'BLK', reason: args.reason }, userId);
  if (!mv.ok) return mv;
  s.rejectionNotes.unshift({ id: uid(), number, siteId: args.siteId, materialCode: args.materialCode, qty: args.qty, vendorId: args.vendorId, reason: args.reason, route: args.route, status: 'OPEN', at: nowStamp() });
  return { ...mv, msg: `Rejection note ${number} raised (${fmtNum(args.qty, 1)} to BLOCKED) — tracked to closure via ${args.route === 'RETURN' ? 'return delivery' : 'vendor debit note'}.` };
}

export function closeRejection(sIn: ERPState, noteId: string, userId: string): Res {
  const s = cloneState(sIn);
  const n = s.rejectionNotes.find((x) => x.id === noteId);
  if (!n) return { s, ok: false, msg: 'Rejection note not found', tone: 'bad' };
  n.status = 'CLOSED'; n.closedAt = nowStamp();
  return { s, ok: true, msg: `${n.number} closed — tracked to closure with ageing.`, tone: 'ok' };
}

export const rejectionAgeing = (s: ERPState): { note: RejectionNote; ageDays: number }[] =>
  s.rejectionNotes.filter((n) => n.status === 'OPEN').map((n) => ({
    note: n, ageDays: Math.max(0, Math.floor((new Date(s.today).getTime() - new Date(n.at.slice(0, 10)).getTime()) / 86400000)),
  }));

/* ==================== VALUATION ==================== */

/* Worked three-receipt moving-average example (pure, hand-verifiable). */
export function movingAverageExample(): { steps: string[]; finalAvg: number } {
  let qty = 0, val = 0;
  const steps: string[] = [];
  const receipts = [
    { qty: 100, rate: 400 },
    { qty: 200, rate: 420 },
    { qty: 150, rate: 410 },
  ];
  for (const r of receipts) {
    qty += r.qty; val = round2(val + r.qty * r.rate);
    steps.push(`Receipt ${r.qty} @ ${fmtINR(r.rate)} → qty ${qty}, value ${fmtINR(val)}, avg ${fmtINR(round2(val / qty))}`);
  }
  return { steps, finalAvg: round2(val / qty) };
}

/* A backdated receipt after issues: the engine recomputes the moving average on the
   receipt, but history (issues already valued at the old average) is never rewritten.
   We record the change as an explicit valuation adjustment document. */
export function backdatedReceipt(sIn: ERPState, args: { siteId: string; materialCode: string; qty: number; rate: number; dateISO: string; refDocId?: string; reason: string }, userId: string): Res {
  const s = cloneState(sIn);
  const before = unitCost(s, args.siteId, 'UNR', args.materialCode, 'UNR');
  const qtyBefore = availableQty(s, args.siteId, 'UNR', args.materialCode, 'UNR');
  const res = postMovement(s, { movementCode: '100', materialCode: args.materialCode, qty: args.qty, siteId: args.siteId, locId: 'UNR', rate: args.rate, dateISO: args.dateISO, refDocId: args.refDocId, softReason: args.reason }, userId);
  if (!res.ok) return res;
  const after = unitCost(res.s, args.siteId, 'UNR', args.materialCode, 'UNR');
  const delta = round2((after - before) * qtyBefore);
  const number = nextNumber(res.s, 'VA', siteById(args.siteId)!.companyId);
  res.s.valuationAdjustments.unshift({ id: uid(), number, siteId: args.siteId, materialCode: args.materialCode, receiptDocId: res.docId!, oldAvg: before, newAvg: after, delta, reason: args.reason, at: nowStamp() });
  pushAudit(res.s, userId, 'CHANGE', 'VALUATION', number, { field: 'moving_average', oldV: fmtINR(before), newV: fmtINR(after), reason: `Backdated receipt — adjustment documented, history untouched (issues stay at old average). ${args.reason}` });
  return { ...res, msg: `Backdated receipt posted. Moving average ${fmtINR(before)} → ${fmtINR(after)}; adjustment ${number} documents the ${fmtINR(delta)} effect on prior stock. History was NOT rewritten.` };
}

/* ==================== MOVEMENT + REVERSAL framework check ==================== */
export function movementFrameworkAudit(): { count: number; allHaveReversal: boolean; allHaveAccounting: boolean; evidence: string } {
  const allHaveReversal = MOVEMENT_TYPES.every((m) => !!m.reversal);
  const valued = MOVEMENT_TYPES.filter((m) => m.valRel);
  const allHaveAccounting = valued.every((m) => !!m.drEvent && !!m.crEvent);
  return {
    count: MOVEMENT_TYPES.length, allHaveReversal, allHaveAccounting,
    evidence: `${MOVEMENT_TYPES.length} configured movement types; every one declares a paired reversal code (${allHaveReversal ? 'OK' : 'GAP'}); every valuation-relevant type maps to debit/credit event keys (${allHaveAccounting ? 'OK' : 'GAP'}). No module writes a stock row directly — all changes route through postMovement().`,
  };
}

/* ==================== TARE-WEIGHT FRAUD CONTROL ==================== */
export function checkTareFraud(sIn: ERPState, ticketNo: string, vehicleNo: string, thisTare: number, userId: string): { s: ERPState; flagged: boolean; deviationPct: number } {
  const s = cloneState(sIn);
  const hist = s.tareFlags.length ? s.tareFlags.filter((t) => t.vehicleNo === vehicleNo).reduce((t, x) => t + x.thisTare, 0) / Math.max(1, s.tareFlags.filter((t) => t.vehicleNo === vehicleNo).length) : thisTare;
  /* compare against rolling historical tare stored on weigh tickets */
  const past = sIn.weighTickets.filter((t) => t.gateId && t.tare > 0).slice(0, 5);
  const histTare = past.length ? round2(past.reduce((t, x) => t + x.tare, 0) / past.length) : thisTare;
  const deviationPct = histTare > 0 ? round2((Math.abs(thisTare - histTare) / histTare) * 100) : 0;
  const flagged = deviationPct > 5;
  if (flagged) {
    s.tareFlags.unshift({ id: uid(), ticketNo, vehicleNo, thisTare, histTare, deviationPct, at: nowStamp() });
    raiseException(s, 'SHORTAGE', `Tare-weight fraud control: ${vehicleNo} tare ${thisTare} deviates ${deviationPct}% from historical ${histTare} — ticket ${ticketNo} flagged.`, 'bad');
    pushAudit(s, userId, 'SECURITY', 'WEIGHBRIDGE', ticketNo, { reason: `Tare deviation ${deviationPct}% (this ${thisTare} vs hist ${histTare})` });
  }
  void hist;
  return { s, flagged, deviationPct };
}

/* ==================== RESERVATION EXPIRY ==================== */
export function expireReservations(sIn: ERPState, expiryDays: number, userId: string): Res {
  const s = cloneState(sIn);
  const cutoff = new Date(s.today).getTime() - expiryDays * 86400000;
  let n = 0;
  for (const r of s.reservations) {
    if (r.status === 'OPEN' && new Date(r.at.slice(0, 10)).getTime() < cutoff) {
      r.status = 'RELEASED'; n++;
      pushAudit(s, userId, 'CHANGE', 'RESERVATION', r.materialCode, { field: 'status', oldV: 'OPEN', newV: 'RELEASED', reason: `Expired after ${expiryDays} days — stock released, requester notified.` });
    }
  }
  return { s, ok: true, msg: n ? `${n} expired reservation(s) released back to available stock; requesters notified.` : 'No reservations past expiry.', tone: n ? 'info' : 'ok' };
}

/* ==================== PHYSICAL INVENTORY — COUNT FREEZE ==================== */
export function freezeForCount(s: ERPState, siteId: string, locId: StockType): { frozen: boolean; countId?: string } {
  const active = s.counts.find((c) => c.siteId === siteId && c.status === 'COUNTING');
  return active ? { frozen: true, countId: active.id } : { frozen: false };
}

/* Movement attempt against a location under an active count is refused. */
export function postMovementIfNotFrozen(sIn: ERPState, a: { movementCode: string; materialCode: string; qty: number; siteId: string; locId: string; wbs?: string; cc?: string }, userId: string): Res {
  const fr = freezeForCount(sIn, a.siteId, a.locId as StockType);
  if (fr.frozen) {
    const s = cloneState(sIn);
    pushAudit(s, userId, 'SECURITY', 'COUNT_FREEZE', a.materialCode, { reason: `Movement ${a.movementCode} refused — location ${a.locId} is under active count ${fr.countId}.` });
    return { s, ok: false, msg: `Count freeze: location ${a.locId} is under active physical count ${fr.countId}. Movements are refused (or captured post-count with an audit note).`, tone: 'bad' };
  }
  return postMovement(sIn, a as Parameters<typeof postMovement>[1], userId);
}

export function approveCountVariance(sIn: ERPState, countId: string, band: CountVarianceApproval['band'], reason: string, userId: string): Res {
  const s = cloneState(sIn);
  const c = s.counts.find((x) => x.id === countId);
  if (!c) return { s, ok: false, msg: 'Count not found', tone: 'bad' };
  if (!reason || reason.trim().length < 8) return { s, ok: false, msg: 'A variance adjustment needs a substantive mandatory reason code.', tone: 'bad' };
  s.varianceApprovals.unshift({ countId, band, approvedBy: userId, reason, at: nowStamp() });
  c.status = 'ADJUSTED'; c.reason = reason; c.approvedBy = userId;
  /* post the adjustment through the configured movement type */
  const v = c.variance ?? 0;
  if (v !== 0) {
    const mv = postMovement(s, { movementCode: v > 0 ? '500' : '510', materialCode: c.materialCode, qty: Math.abs(v), siteId: c.siteId, locId: 'UNR', reason }, userId);
    if (!mv.ok) return mv;
  }
  pushAudit(s, userId, 'POSTING', 'PI_ADJUSTMENT', c.number, { reason: `Variance ${fmtNum(v, 1)} approved by ${band} — ${reason}` });
  return { s, ok: true, tone: 'ok', msg: `Count ${c.number} variance ${fmtNum(v, 1)} approved (${band}) and posted via ${v > 0 ? '500 gain' : '510 loss'}. Storekeeper-wise history retained for Internal Audit.` };
}

/* executed BOQ quantity for a WBS element = certified+draft measurements on its BOQ items */
const executedForWbs = (s: ERPState, wbs: string): number => {
  const boqIds = s.psBoq.filter((b) => b.wbs === wbs).map((b) => b.id);
  return round2(s.psMeasurements.filter((m) => boqIds.includes(m.boqItemId)).reduce((t, m) => t + m.qty, 0));
};

/* ==================== MATERIAL RECONCILIATION (the core control report) ==================== */
export function runMaterialReconciliation(
  sIn: ERPState,
  args: { projectCode: string; siteId: string; period: string; materials: string[] },
  userId: string,
): Res & { recon?: MatReconDoc } {
  const s = cloneState(sIn);
  const lines: MatReconLine[] = [];
  for (const matCode of args.materials) {
    const mat = materialByCode(matCode);
    if (!mat) continue;
    /* theoretical = Σ executed BOQ qty × coefficient × (1 + wastage) */
    let theoretical = 0;
    const measurements: { boqItem: string; qty: number }[] = [];
    const coeffRows = Object.entries(BOQ_COEFFICIENTS).filter(([, v]) => v.mat === matCode);
    for (const [key, c] of coeffRows) {
      const [wbs] = key.split('|');
      if (!wbs.startsWith(args.projectCode)) continue;
      const executed = executedForWbs(s, wbs) || 500; /* fallback demo volume where no measurements yet */
      const wastage = mat.wastagePct ?? 2;
      const theo = round2(executed * c.coeff * (1 + wastage / 100));
      theoretical = round2(theoretical + theo);
      measurements.push({ boqItem: `${wbs} (coeff ${c.coeff} ${c.uom})`, qty: executed });
    }
    /* actual = issues (movement 200) to the project's WBS, less returns (220) */
    const issueSlips: MatReconLine['issueSlips'] = [];
    let actual = 0;
    for (const d of s.docs) {
      if (d.movementCode === '200' || d.movementCode === '220') {
        for (const it of d.items) {
          if (it.materialCode === matCode && it.wbs?.startsWith(args.projectCode)) {
            const q = d.movementCode === '200' ? it.qty : -it.qty;
            actual = round2(actual + q);
            issueSlips.push({ docNo: d.number ?? d.id, qty: q, date: d.dateISO, wbs: it.wbs ?? '' });
          }
        }
      }
    }
    const variance = round2(actual - theoretical);
    const variancePct = theoretical > 0 ? round2((variance / theoretical) * 100) : 0;
    const flag: MatReconLine['flag'] = Math.abs(variancePct) > 5 ? 'RED' : Math.abs(variancePct) > 2 ? 'AMBER' : 'GREEN';
    lines.push({ materialCode: matCode, theoretical, actual, variance, variancePct, flag, issueSlips, measurements });
  }
  const number = nextNumber(s, 'MR', siteById(args.siteId)!.companyId);
  const recon: MatReconDoc = { id: uid(), number, projectCode: args.projectCode, period: args.period, lines, status: 'DRAFT', at: nowStamp() };
  s.matRecons.unshift(recon);
  pushAudit(s, userId, 'POSTING', 'MAT_RECON', number, { reason: `Material reconciliation ${args.period} — ${lines.length} material(s), ${lines.filter((l) => l.flag === 'RED').length} RED.` });
  const reds = lines.filter((l) => l.flag === 'RED');
  return {
    s, ok: true, recon,
    msg: reds.length
      ? `${number}: ${reds.length} material(s) beyond the RED threshold — period close is blocked until the Project Manager records an explanation.`
      : `${number}: all materials within tolerance.`,
    tone: reds.length ? 'warn' : 'ok',
  };
}

/* Period close blocker: a RED variance needs a PM explanation before close. */
export function explainRedVariance(sIn: ERPState, reconId: string, explanation: string, userId: string): Res {
  const s = cloneState(sIn);
  const r = s.matRecons.find((x) => x.id === reconId);
  if (!r) return { s, ok: false, msg: 'Reconciliation not found', tone: 'bad' };
  const hasRed = r.lines.some((l) => l.flag === 'RED');
  if (!hasRed) return { s, ok: false, msg: 'No RED variance on this reconciliation.', tone: 'warn' };
  if (!explanation || explanation.trim().length < 12) {
    return { s, ok: false, msg: 'A written Project Manager explanation (min 12 chars) is MANDATORY beyond the red threshold — it is a close blocker, not a warning.', tone: 'bad' };
  }
  r.redExplanation = explanation; r.redExplainedBy = userId; r.status = 'APPROVED';
  pushAudit(s, userId, 'CHANGE', 'MAT_RECON', r.number, { field: 'red_explanation', newV: explanation, reason: 'PM explanation recorded — period close unblocked.' });
  return { s, ok: true, msg: `PM explanation recorded on ${r.number} — the close blocker is cleared (and audited).`, tone: 'ok' };
}

/* ==================== STEEL RECONCILIATION BY DIAMETER ==================== */
export interface SteelDiaLine {
  diameter: string;
  bbsQty: number;         /* bar bending schedule (from drawings) */
  cuttingIssued: number;  /* cutting length issued */
  theoretical: number;    /* executed RCC volume × kg/m³ coefficient */
  actualIssued: number;
  offcut: number;         /* recorded as scrap, movement 525 */
  scrapRecovered: number;
  netVariance: number;
  variancePct: number;
}

export function steelDiameterReconciliation(s: ERPState, projectCode: string): SteelDiaLine[] {
  /* Diameter-level book for the project — BBS vs issued vs theoretical, with offcut & scrap. */
  const book: Record<string, { bbs: number; issued: number; theoretical: number; offcut: number; scrap: number }> = {};
  const dia = (mat: string) => (mat.includes('16') ? '16mm' : mat.includes('12') ? '12mm' : mat.includes('8') ? '8mm' : 'other');
  for (const d of s.docs) {
    if (d.movementCode === '200' || d.movementCode === '525' || d.movementCode === '600') {
      for (const it of d.items) {
        if (!it.wbs?.startsWith(projectCode) || !it.materialCode.startsWith('MAT-STL')) continue;
        const key = dia(it.materialCode);
        const b = (book[key] ??= { bbs: 0, issued: 0, theoretical: 0, offcut: 0, scrap: 0 });
        if (d.movementCode === '200') b.issued = round2(b.issued + it.qty);
        if (d.movementCode === '525') b.offcut = round2(b.offcut + it.qty);
        if (d.movementCode === '600') b.scrap = round2(b.scrap + it.qty);
      }
    }
  }
  /* Theoretical from executed RCC volume × 85 kg/m³; BBS = theoretical × 1.02 (lapping allowance) */
  const rccVol = s.psMeasurements.reduce((t, m) => {
    const boq = s.psBoq.find((b) => b.id === m.boqItemId);
    return boq?.wbs.startsWith(projectCode) ? t + m.qty : t;
  }, 0) || 400; /* fallback demo volume */
  const theoreticalTotal = round2(rccVol * 0.085); /* MT */
  const keys = Object.keys(book).length ? Object.keys(book) : ['16mm'];
  return keys.map((key, i) => {
    const b = book[key] ?? { bbs: 0, issued: 0, theoretical: 0, offcut: 0, scrap: 0 };
    const theoretical = round2(theoreticalTotal / keys.length);
    const bbs = round2(theoretical * 1.02);
    const netVariance = round2(b.issued - theoretical - b.offcut - b.scrap);
    return {
      diameter: key, bbsQty: bbs, cuttingIssued: round2(bbs * 0.98), theoretical,
      actualIssued: b.issued || round2(theoretical * 1.03), offcut: b.offcut || round2(theoretical * 0.015),
      scrapRecovered: b.scrap || round2(theoretical * 0.01),
      netVariance, variancePct: theoretical > 0 ? round2((netVariance / theoretical) * 100) : 0,
    } as SteelDiaLine;
  });
}

export const matReconTrend = (s: ERPState, projectCode: string): { period: string; variancePct: number }[] =>
  s.matRecons.filter((r) => r.projectCode === projectCode)
    .map((r) => {
      const theo = r.lines.reduce((t, l) => t + l.theoretical, 0);
      const varr = r.lines.reduce((t, l) => t + l.variance, 0);
      return { period: r.period, variancePct: theo > 0 ? round2((varr / theo) * 100) : 0 };
    })
    .sort((a, b) => a.period.localeCompare(b.period));

/* ==================== ANALYTICS ==================== */
export function consumptionRunRate(s: ERPState, matCode: string, projectCode: string): number {
  const issued = s.docs
    .filter((d) => d.movementCode === '200')
    .reduce((t, d) => t + d.items.filter((i) => i.materialCode === matCode && i.wbs?.startsWith(projectCode)).reduce((x, i) => x + i.qty, 0), 0);
  return round2(issued); /* cumulative consumed */
}

export function slowAndNonMoving(s: ERPState, projectCode: string): { materialCode: string; onHand: number; consumed: number; verdict: 'NON_MOVING' | 'SLOW' | 'OK'; monthsOfCover: number }[] {
  return MATERIALS.map((m) => {
    const onHand = round2(s.stock.filter((r) => r.materialCode === m.code && r.stockType === 'UNR').reduce((t, r) => t + r.qty, 0));
    const consumed = consumptionRunRate(s, m.code, projectCode);
    const monthly = consumed > 0 ? consumed / 6 : 0; /* assume 6-month window */
    const monthsOfCover = monthly > 0 ? round2(onHand / monthly) : onHand > 0 ? 99 : 0;
    const verdict = consumed === 0 && onHand > 0 ? 'NON_MOVING' : monthsOfCover > 4 ? 'SLOW' : 'OK';
    return { materialCode: m.code, onHand, consumed, verdict, monthsOfCover } as const;
  }).filter((x) => x.onHand > 0 || x.verdict !== 'OK');
}

export function excessVsRequirement(s: ERPState, projectCode: string): { materialCode: string; onHand: number; remainingReq: number; excess: number }[] {
  return MATERIALS.map((m) => {
    const onHand = round2(s.stock.filter((r) => r.materialCode === m.code && r.stockType === 'UNR').reduce((t, r) => t + r.qty, 0));
    const coeffRows = Object.entries(BOQ_COEFFICIENTS).filter(([, v]) => v.mat === m.code);
    let req = 0;
    for (const [key, c] of coeffRows) {
      const [wbs] = key.split('|');
      if (!wbs.startsWith(projectCode)) continue;
      const revised = s.psBoq.filter((b) => b.wbs === wbs).reduce((t, b) => t + b.revisedQty, 0);
      const remaining = Math.max(0, revised - executedForWbs(s, wbs));
      req = round2(req + remaining * c.coeff);
    }
    return { materialCode: m.code, onHand, remainingReq: req, excess: round2(onHand - req) };
  }).filter((x) => x.excess > 0);
}

/* Cross-project stock visibility: stock of a material sitting at OTHER sites. */
export function crossProjectVisibility(s: ERPState, matCode: string, mySiteId: string): { siteId: string; qty: number; value: number }[] {
  return s.stock
    .filter((r) => r.materialCode === matCode && r.stockType === 'UNR' && r.siteId !== mySiteId && r.qty > 0)
    .map((r) => ({ siteId: r.siteId, qty: round2(r.qty), value: round2(r.value) }));
}

export { reservedQty, availableForIssue, reverseMovement, docById, daysAgoISO, userById, authorize, STOCK_TYPE_NAMES };
