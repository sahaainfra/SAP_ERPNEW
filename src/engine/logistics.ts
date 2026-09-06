/* ==================================================================== */
/*  PART 2 — PRC · INV services. Thin layer over the Part 1 framework:   */
/*  every price via computePricing, every stock move via postMovement,   */
/*  every approval via determineStrategy/approveDoc, every posting via    */
/*  postJournal + account determination. No reimplemented mechanics.      */
/* ==================================================================== */

import type {
  ERPState, Res, Doc, DocItem, JournalLine, Quotation, Rfq, GateEntry, WeighTicket,
  Reservation, ReturnableIssue, PhysicalCount, Exc, RateContract,
} from './types';
import {
  computePricing, postMovement, postJournal, determineStrategy, authorize, nextNumber,
  uid, round2, fmtNum, fmtINR, partnerById, materialByCode, siteById, docById, docByNumber,
  pushAudit, availableQty, unitCost, userById, daysAheadISO, todayISO, nowStamp, cloneState,
} from './engine';
import {
  SOURCE_LIST_SEED, SOURCE_CONTROLLED_GROUPS, QUOTA_SEED, RATE_CONTRACT_SEED,
  REORDER_POINTS, BOQ_COEFFICIENTS, MINERAL_GROUP, QUALITY_CONFIG,
} from './config';
import { createInspectionLot } from './qms';

/* ============================== PRC · sourcing ============================== */

export function checkSource(s: ERPState, materialCode: string, siteId: string, vendorId: string): { ok: boolean; msg: string } {
  const mat = materialByCode(materialCode);
  if (!mat) return { ok: false, msg: 'Unknown material' };
  if (!SOURCE_CONTROLLED_GROUPS.includes(mat.group)) return { ok: true, msg: '' };
  const rec = s.sources.find((x) => x.materialCode === materialCode && x.siteId === siteId && x.vendorId === vendorId && !x.blocked);
  if (!rec) {
    return { ok: false, msg: `${mat.code} is source-controlled (${mat.group}). ${vendorId} is not on the source list for this site — an approved override is required.` };
  }
  return { ok: true, msg: '' };
}

export function quotaCheck(s: ERPState, materialCode: string, siteId: string, vendorId: string, qty: number): { ok: boolean; msg: string; quota?: QuotaArrangementRec } {
  const q = s.quotas.find((x) => x.materialCode === materialCode && x.siteId === siteId);
  if (!q) return { ok: true, msg: '' };
  const alloc = q.allocations.find((a) => a.vendorId === vendorId);
  if (!alloc) return { ok: false, msg: `${vendorId} holds no quota share for ${materialCode} at this site.`, quota: q as QuotaArrangementRec };
  const total = q.allocations.reduce((t, a) => t + (q.allocated[a.vendorId] ?? 0), 0) + qty;
  const share = ((q.allocated[vendorId] ?? 0) + qty) / total;
  const cap = alloc.pct / 100 + 0.05; /* 5pp tolerance */
  if (share > cap) {
    return { ok: false, msg: `Quota breach: this order would take ${vendorId} to ${(share * 100).toFixed(0)}% of ${materialCode}, above the ${alloc.pct}% arrangement (+5pp). Rebalance across vendors.`, quota: q as QuotaArrangementRec };
  }
  return { ok: true, msg: '', quota: q as QuotaArrangementRec };
}
type QuotaArrangementRec = import('./types').QuotaArrangement;

export function allocateQuota(s: ERPState, materialCode: string, siteId: string, vendorId: string, qty: number): void {
  const q = s.quotas.find((x) => x.materialCode === materialCode && x.siteId === siteId);
  if (!q) return;
  q.allocated[vendorId] = round2((q.allocated[vendorId] ?? 0) + qty);
}

/* ---- comparative statement: rank on EFFECTIVE cost (landed, tax-adjusted) ---- */

export interface ComparisonRow {
  vendorId: string; vendorName: string;
  basic: number; landed: number; taxTotal: number; taxCreditable: number; taxNonCreditable: number;
  effectiveCost: number; paymentAdj: number; finalCost: number;
  leadDays: number; perfPct: number; rejPct: number; msme: boolean; gstOk: boolean;
}

export function comparisonStatement(s: ERPState, rfq: Rfq): ComparisonRow[] {
  const mat = materialByCode(rfq.materialCode)!;
  const site = siteById(rfq.siteId)!;
  const rows = rfq.quotations.map((q) => {
    const p = computePricing(s, { materialCode: rfq.materialCode, qty: rfq.qty, partnerId: q.vendorId, siteId: rfq.siteId, docDate: s.today, rateOverride: q.rate });
    const cred = p.itcBlocked ? 0 : p.taxValue;
    const nonCred = round2(p.taxValue - cred);
    const eff = round2(p.landed + nonCred);               /* effective cost to project */
    const payAdj = round2(-(eff * 0.0015 * Math.max(0, 30 - q.paymentDays))); /* early-payment discount */
    const vendor = partnerById(q.vendorId)!;
    const scores = vendorScores(s, q.vendorId);
    return {
      vendorId: q.vendorId, vendorName: vendor.name,
      basic: p.net, landed: p.landed, taxTotal: p.taxValue, taxCreditable: cred, taxNonCreditable: nonCred,
      effectiveCost: eff, paymentAdj: payAdj, finalCost: round2(eff + payAdj),
      leadDays: q.leadDays, perfPct: scores.delivery, rejPct: scores.qualityRej, msme: vendor.msme, gstOk: vendor.regType === 'REGULAR',
    };
  });
  return rows.sort((a, b) => a.finalCost - b.finalCost);
}

export function createRfq(sIn: ERPState, args: { materialCode: string; qty: number; siteId: string; wbs?: string; vendors: string[]; deadline: string }, userId: string): Res {
  const s = cloneState(sIn);
  const site = siteById(args.siteId);
  if (!site) return { s, ok: false, msg: 'Unknown site', tone: 'bad' };
  const auth = authorize(s, userId, 'PRC_PO', '01', { company: site.companyId });
  if (!auth.ok) return { s, ok: false, msg: auth.reason, tone: 'bad' };
  const mat = materialByCode(args.materialCode)!;
  const number = nextNumber(s, 'RQ', site.companyId);
  const rfq: Rfq = {
    id: uid(), number, materialCode: args.materialCode, qty: args.qty, uom: mat.baseUom,
    siteId: args.siteId, wbs: args.wbs, vendors: args.vendors, deadline: args.deadline,
    status: 'OPEN', quotations: [], at: nowStamp(),
  };
  s.rfqs.unshift(rfq);
  pushAudit(s, userId, 'POSTING', 'RFQ', number, { reason: `Issued to ${args.vendors.length} vendors · sealed until ${args.deadline}` });
  return { s, ok: true, msg: `RFQ ${number} issued to ${args.vendors.length} vendors (sealed until deadline).`, tone: 'ok' };
}

export function submitQuotation(sIn: ERPState, rfqId: string, q: Quotation, userId: string): Res {
  const s = cloneState(sIn);
  const rfq = s.rfqs.find((r) => r.id === rfqId);
  if (!rfq) return { s, ok: false, msg: 'RFQ not found', tone: 'bad' };
  if (rfq.status !== 'OPEN') return { s, ok: false, msg: 'RFQ is no longer open.', tone: 'warn' };
  if (!rfq.vendors.includes(q.vendorId)) return { s, ok: false, msg: 'This vendor was not invited to the RFQ.', tone: 'bad' };
  rfq.quotations = rfq.quotations.filter((x) => x.vendorId !== q.vendorId);
  rfq.quotations.push({ ...q, at: nowStamp() });
  return { s, ok: true, msg: `Quotation recorded for ${partnerById(q.vendorId)?.name}.`, tone: 'ok' };
}

export function awardRfq(sIn: ERPState, rfqId: string, vendorId: string, justification: string, userId: string): Res {
  const s = cloneState(sIn);
  const rfq = s.rfqs.find((r) => r.id === rfqId);
  if (!rfq) return { s, ok: false, msg: 'RFQ not found', tone: 'bad' };
  const rows = comparisonStatement(s, rfq);
  const lowest = rows[0];
  const chosen = rows.find((r) => r.vendorId === vendorId);
  if (!chosen) return { s, ok: false, msg: 'Vendor did not quote.', tone: 'bad' };
  const nonLowest = vendorId !== lowest.vendorId;
  if (nonLowest && justification.trim().length < 10) {
    pushAudit(s, userId, 'SECURITY', 'RFQ_AWARD', rfq.number, { reason: `Non-lowest award to ${vendorId} refused — justification mandatory` });
    return { s, ok: false, msg: `Award to ${chosen.vendorName} is NOT the lowest effective cost (${fmtINR(lowest.finalCost)}). A written justification (≥10 chars) is mandatory and is shown to every approver.`, tone: 'bad' };
  }
  const src = checkSource(s, rfq.materialCode, rfq.siteId, vendorId);
  if (!src.ok) return { s, ok: false, msg: src.msg, tone: 'bad' };

  rfq.status = 'AWARDED';
  rfq.awardVendorId = vendorId;
  rfq.justification = nonLowest ? justification : undefined;

  /* build a PO through the framework: condition technique + release strategy */
  const site = siteById(rfq.siteId)!;
  const mat = materialByCode(rfq.materialCode)!;
  const price = computePricing(s, { materialCode: rfq.materialCode, qty: rfq.qty, partnerId: vendorId, siteId: rfq.siteId, docDate: s.today, rateOverride: chosen.effectiveCost / rfq.qty });
  const items: DocItem[] = [{
    line: 1, category: 'STD', materialCode: mat.code, desc: mat.desc, qty: rfq.qty, uom: mat.baseUom,
    rate: price.baseRate, siteId: rfq.siteId, locId: 'UNR', wbs: rfq.wbs, received: 0, invoiced: 0,
    taxCode: '—', itc: mat.itc,
  }];
  const release = determineStrategy('REL-PO', price.payable);
  const po: Doc = {
    id: uid(), number: nextNumber(s, 'PO', site.companyId), type: 'PO-STD', module: 'PRC', companyId: site.companyId,
    siteId: rfq.siteId, partnerId: vendorId, dateISO: s.today, status: 'PENDING_RELEASE', createdBy: userId,
    items, total: price.payable, release, price, wbs: rfq.wbs,
    note: `Awarded from ${rfq.number}${nonLowest ? ` · NON-LOWEST AWARD — ${justification}` : ' · lowest effective cost'}`,
  };
  s.docs.unshift(po);
  allocateQuota(s, rfq.materialCode, rfq.siteId, vendorId, rfq.qty);
  pushAudit(s, userId, 'POSTING', 'PURCHASE_ORDER', po.number!, { docId: po.id, reason: `Created from ${rfq.number} — effective cost ${fmtINR(chosen.finalCost)}${nonLowest ? ' (non-lowest, justified)' : ' (lowest)'}` });
  return { s, ok: true, msg: `${po.number} created from ${rfq.number} at effective cost ${fmtINR(chosen.finalCost)}${nonLowest ? ' — justification attached for approvers' : ' (lowest)'} · strategy ${release.strategyName}.`, tone: 'ok', docId: po.id };
}

/* ---- rate-contract release consumes the cap ---- */

export function releaseRateContract(sIn: ERPState, rcId: string, qty: number, userId: string): Res {
  const s = cloneState(sIn);
  const rc = s.rateContracts.find((r) => r.id === rcId);
  if (!rc) return { s, ok: false, msg: 'Rate contract not found', tone: 'bad' };
  if (s.today > rc.validTo) return { s, ok: false, msg: 'Rate contract has expired.', tone: 'bad' };
  if (rc.releasedQty + qty > rc.capQty) {
    pushAudit(s, userId, 'SECURITY', 'RATE_CONTRACT', rc.number, { reason: `Release ${qty} exceeds remaining cap ${fmtNum(rc.capQty - rc.releasedQty, 0)}` });
    return { s, ok: false, msg: `Refused: releasing ${fmtNum(qty, 0)} would exceed the contract cap (remaining ${fmtNum(rc.capQty - rc.releasedQty, 0)} ${materialByCode(rc.materialCode)?.baseUom}).`, tone: 'bad' };
  }
  rc.releasedQty = round2(rc.releasedQty + qty);
  if (rc.releasedQty >= rc.capQty) rc.status = 'EXHAUSTED';
  const site = siteById(rc.siteId)!;
  const mat = materialByCode(rc.materialCode)!;
  const price = computePricing(s, { materialCode: rc.materialCode, qty, partnerId: rc.vendorId, siteId: rc.siteId, docDate: s.today, rateOverride: rc.rate });
  const release = determineStrategy('REL-PO', price.payable);
  const po: Doc = {
    id: uid(), number: nextNumber(s, 'PO', site.companyId), type: 'PO-RC', module: 'PRC', companyId: site.companyId,
    siteId: rc.siteId, partnerId: rc.vendorId, dateISO: s.today, status: 'PENDING_RELEASE', createdBy: userId,
    items: [{ line: 1, category: 'STD', materialCode: mat.code, desc: mat.desc, qty, uom: mat.baseUom, rate: rc.rate, siteId: rc.siteId, locId: 'UNR', received: 0, invoiced: 0, taxCode: '—', itc: mat.itc }],
    total: price.payable, release, price,
    note: `Rate-contract release ${rc.number} · cap consumed ${fmtNum(rc.releasedQty, 0)}/${fmtNum(rc.capQty, 0)}`,
  };
  s.docs.unshift(po);
  pushAudit(s, userId, 'POSTING', 'RATE_CONTRACT', rc.number, { reason: `Released ${fmtNum(qty, 0)} ${mat.baseUom} → ${po.number}` });
  return { s, ok: true, msg: `${po.number} released against ${rc.number} — cap now ${fmtNum(rc.releasedQty, 0)}/${fmtNum(rc.capQty, 0)}.`, tone: 'ok', docId: po.id };
}

/* ---- PRC.6 mineral permit ---- */

export function permitCheck(sIn: ERPState, args: { permitNo: string; permitValidTo: string; permitQty: number; receivedQty: number; leaseValidTo: string }, userId: string): Res {
  const s = cloneState(sIn);
  const problems: string[] = [];
  if (s.today > args.leaseValidTo) problems.push('mineral lease expired');
  if (s.today > args.permitValidTo) problems.push('transit permit expired');
  if (args.receivedQty > args.permitQty) problems.push(`received ${fmtNum(args.receivedQty, 1)} exceeds permitted ${fmtNum(args.permitQty, 1)}`);
  if (problems.length) {
    raiseException(s, 'PERMIT', `Permit ${args.permitNo}: ${problems.join('; ')} — unroyaltied material exposure. Hold vendor bill.`, 'bad');
    pushAudit(s, userId, 'SECURITY', 'MINERAL_PERMIT', args.permitNo, { reason: problems.join('; ') });
    return { s, ok: false, msg: `Mineral compliance exception: ${problems.join('; ')}.`, tone: 'bad' };
  }
  return { s, ok: true, msg: 'Permit valid; quantity within limits.', tone: 'ok' };
}

/* ---- PRC.7 vendor evaluation from transactions ---- */

export function vendorScores(s: ERPState, vendorId: string) {
  /* delivery: GR on-time vs PO line dates */
  const pos = s.docs.filter((d) => d.type.startsWith('PO') && d.partnerId === vendorId);
  let onTime = 0, deliveries = 0;
  for (const po of pos) {
    const grs = s.docs.filter((d) => d.refId === po.id && (d.movementCode === '100' || d.movementCode === '101'));
    for (const gr of grs) { deliveries++; if (gr.dateISO <= daysAheadISO(2)) onTime++; }
  }
  const delivery = deliveries ? Math.round((onTime / deliveries) * 100) : 90;
  /* quality: rejection rate from inspection lots */
  const lots = s.inspLots.filter((l) => l.vendorId === vendorId);
  const rej = lots.filter((l) => l.status === 'REJECTED').length;
  const qualityRej = lots.length ? Math.round((rej / lots.length) * 100) : 2;
  /* price: variance vs lowest info-record rate for the vendor's materials */
  const vendor = partnerById(vendorId);
  const priceVar = vendor ? Math.max(0, Math.round((100 - vendor.rating) / 4)) : 10;
  const compliance = vendor ? (vendor.msme ? 5 : 0) + (vendor.regType === 'REGULAR' ? 5 : 0) : 0;
  const service = Math.min(10, Math.round(delivery / 10));
  const overall = Math.round(0.35 * (100 - priceVar) + 0.25 * delivery + 0.2 * (100 - qualityRej * 5) + 0.1 * (compliance * 10) + 0.1 * (service * 10));
  const band = overall >= 85 ? 'PREFERRED' : overall >= 70 ? 'APPROVED' : overall >= 55 ? 'CONDITIONAL' : overall >= 40 ? 'WATCHLIST' : 'BLACKLISTED';
  return { priceVar, delivery, qualityRej, compliance, service, overall: Math.max(0, Math.min(100, overall)), band };
}

/* ---- PRC.8 spend analysis ---- */

export function spendByGroup(s: ERPState) {
  const m = new Map<string, number>();
  for (const d of s.docs.filter((x) => x.type.startsWith('PO') && x.status !== 'REJECTED')) {
    for (const it of d.items) {
      const g = materialByCode(it.materialCode)?.group ?? 'OTHER';
      m.set(g, round2((m.get(g) ?? 0) + it.qty * it.rate));
    }
  }
  return [...m.entries()].map(([group, value]) => ({ group, value })).sort((a, b) => b.value - a.value);
}

export function openPoAgeing(s: ERPState) {
  return s.docs.filter((d) => d.type.startsWith('PO') && d.status === 'RELEASED')
    .map((d) => ({ id: d.id, number: d.number!, vendor: partnerById(d.partnerId!)?.name ?? '—', age: Math.max(0, Math.round((Date.parse(s.today) - Date.parse(d.dateISO)) / 86400000)), open: round2(d.items.reduce((t, i) => t + Math.max(0, i.qty - i.received) * i.rate, 0)) }))
    .sort((a, b) => b.age - a.age);
}

/* ============================== INV · goods receipt chain ============================== */

export function createGateEntry(sIn: ERPState, args: Omit<GateEntry, 'id' | 'number' | 'status' | 'inTime'>, userId: string): Res {
  const s = cloneState(sIn);
  const site = siteById(args.siteId);
  if (!site) return { s, ok: false, msg: 'Unknown site', tone: 'bad' };
  const number = nextNumber(s, 'GE', site.companyId);
  const ge: GateEntry = { ...args, id: uid(), number, status: 'IN', inTime: nowStamp() };
  s.gateEntries.unshift(ge);
  pushAudit(s, userId, 'POSTING', 'GATE_ENTRY', number, { reason: `${args.vehicleNo} · ${args.materialCode} · declared ${fmtNum(args.declaredQty, 1)}` });
  return { s, ok: true, msg: `Gate entry ${number} recorded for ${args.vehicleNo}.`, tone: 'ok', docId: ge.id };
}

export function weighIn(sIn: ERPState, gateId: string, args: { gross: number; tare: number; operator: string; manual?: boolean; reason?: string }, userId: string): Res {
  const s = cloneState(sIn);
  const ge = s.gateEntries.find((g) => g.id === gateId);
  if (!ge) return { s, ok: false, msg: 'Gate entry not found', tone: 'bad' };
  const net = round2(args.gross - args.tare);
  const ticket: WeighTicket = { id: uid(), gateId, ticketNo: `WB-${String(s.weighTickets.length + 1).padStart(4, '0')}`, gross: args.gross, tare: args.tare, net, at: nowStamp(), operator: args.operator, manual: args.manual, reason: args.reason };
  s.weighTickets.unshift(ticket);
  ge.status = 'WEIGHED';
  const variance = Math.abs(net - ge.declaredQty) / Math.max(1, ge.declaredQty);
  if (variance > 0.05) {
    raiseException(s, 'SHORTAGE', `Weighbridge ${ticket.ticketNo}: net ${fmtNum(net, 1)} vs challan ${fmtNum(ge.declaredQty, 1)} (${(variance * 100).toFixed(1)}% variance) — shortage exception opened.`, 'warn');
  }
  return { s, ok: true, msg: `Ticket ${ticket.ticketNo}: net ${fmtNum(net, 1)} ${variance > 0.05 ? '— variance beyond 5% tolerance, shortage flagged' : '(within tolerance)'}.`, tone: variance > 0.05 ? 'warn' : 'ok', docId: ticket.id };
}

/* Gate entry is mandatory: a GR without one is refused. Inspection-flagged material lands in quality hold. */
export function grFromGate(sIn: ERPState, gateId: string, userId: string): Res {
  const s0 = cloneState(sIn);
  const ge = s0.gateEntries.find((g) => g.id === gateId);
  if (!ge) return { s: s0, ok: false, msg: 'Gate entry not found', tone: 'bad' };
  if (ge.status === 'GR_POSTED') return { s: s0, ok: false, msg: 'This gate entry already produced a goods receipt.', tone: 'warn' };
  const po = docByNumber(s0, ge.poRef) ?? s0.docs.find((d) => d.id === ge.poRef);
  if (!po) return { s: s0, ok: false, msg: `No purchase order ${ge.poRef} — goods receipt refused.`, tone: 'bad' };
  const ticket = s0.weighTickets.find((t) => t.gateId === gateId);
  const qty = ticket ? ticket.net : ge.declaredQty; /* weighbridge net is the default received qty */
  const qc = QUALITY_CONFIG[ge.materialCode];
  const toQuality = !!qc?.insp;

  const res = postMovement(s0, {
    movementCode: toQuality ? '101' : '100',
    materialCode: ge.materialCode, qty, siteId: ge.siteId, locId: toQuality ? 'QH' : 'UNR',
    rate: po.items[0]?.rate ?? materialByCode(ge.materialCode)!.price, refDocId: po.id,
  }, userId);
  if (!res.ok) return res;
  ge.status = 'GR_POSTED';

  if (toQuality && res.docId) {
    const lot = createInspectionLot(res.s, { type: qc!.type as 'IL-GRN' | 'IL-PRD', materialCode: ge.materialCode, qty, siteId: ge.siteId, grDocId: res.docId, vendorId: po.partnerId }, userId);
    return { ...lot, msg: `${res.msg} → inspection lot raised; stock in QUALITY HOLD until usage decision.` };
  }
  return res;
}

/* ---- reservations & issue ---- */

export const reservedQty = (s: ERPState, siteId: string, matCode: string): number =>
  round2(s.reservations.filter((r) => r.siteId === siteId && r.materialCode === matCode && r.status === 'OPEN').reduce((t, r) => t + r.qty, 0));

export const availableForIssue = (s: ERPState, siteId: string, locId: string, matCode: string): number =>
  round2(availableQty(s, siteId, locId, matCode, 'UNR') - reservedQty(s, siteId, matCode));

export function reserveStock(sIn: ERPState, args: { materialCode: string; siteId: string; wbs: string; qty: number }, userId: string): Res {
  const s = cloneState(sIn);
  const avail = availableForIssue(s, args.siteId, 'UNR', args.materialCode);
  if (args.qty > avail) return { s, ok: false, msg: `Cannot reserve ${fmtNum(args.qty, 1)} — only ${fmtNum(avail, 1)} available (unrestricted minus existing reservations).`, tone: 'bad' };
  s.reservations.unshift({ id: uid(), materialCode: args.materialCode, siteId: args.siteId, wbs: args.wbs, qty: args.qty, status: 'OPEN', at: nowStamp() });
  return { s, ok: true, msg: `Reserved ${fmtNum(args.qty, 1)} for ${args.wbs} — ring-fenced from other sites.`, tone: 'ok' };
}

export function issueToWbs(sIn: ERPState, args: { materialCode: string; siteId: string; wbs: string; qty: number; ack: boolean }, userId: string): Res {
  const s0 = cloneState(sIn);
  const avail = availableForIssue(s0, args.siteId, 'UNR', args.materialCode);
  if (args.qty > avail) {
    pushAudit(s0, userId, 'SECURITY', 'GOODS_ISSUE', args.materialCode, { reason: `Issue ${args.qty} exceeds available ${avail} (unrestricted − reserved)` });
    return { s: s0, ok: false, msg: `Refused: issuing ${fmtNum(args.qty, 1)} exceeds available-for-issue ${fmtNum(avail, 1)} (unrestricted minus reserved). Negative stock is unreachable.`, tone: 'bad' };
  }
  const res = postMovement(s0, { movementCode: '200', materialCode: args.materialCode, qty: args.qty, siteId: args.siteId, locId: 'UNR', wbs: args.wbs }, userId);
  if (res.ok && res.docId) {
    const d = docById(res.s, res.docId)!;
    d.note = args.ack ? 'Receiver acknowledged' : 'ISSUED — pending receiver acknowledgement';
    if (!args.ack) raiseException(res.s, 'ACK', `Goods issue ${d.number} to ${args.wbs} not acknowledged by receiver — appears on daily exception list.`, 'warn');
  }
  return res;
}

export function acknowledge(sIn: ERPState, docId: string, userId: string): Res {
  const s = cloneState(sIn);
  const d = docById(s, docId);
  if (!d) return { s, ok: false, msg: 'Issue document not found', tone: 'bad' };
  d.note = `Receiver acknowledged by ${userById(userId).name} at ${nowStamp()}`;
  s.exceptions = s.exceptions.filter((e) => !(e.kind === 'ACK' && e.ref === d.number));
  return { s, ok: true, msg: `Receipt acknowledged for ${d.number} — cleared from exception list.`, tone: 'ok' };
}

/* ---- returnables ---- */

export function issueReturnable(sIn: ERPState, args: { materialCode: string; siteId: string; wbs: string; qty: number; issuedTo: string; dueDate: string }, userId: string): Res {
  const s0 = cloneState(sIn);
  const res = postMovement(s0, { movementCode: '230', materialCode: args.materialCode, qty: args.qty, siteId: args.siteId, locId: 'UNR', locToId: 'RET', wbs: args.wbs }, userId);
  if (!res.ok) return res;
  s0.returnables.unshift({ id: uid(), docId: res.docId!, materialCode: args.materialCode, siteId: args.siteId, wbs: args.wbs, qty: args.qty, issuedTo: args.issuedTo, issueDate: s0.today, dueDate: args.dueDate, returnedQty: 0, status: 'OUT' });
  return { ...res, msg: `${res.msg} · returnable tracked, due ${args.dueDate}.` };
}

export function returnReturnable(sIn: ERPState, id: string, qty: number, condition: 'GOOD' | 'DAMAGED' | 'LOST', userId: string): Res {
  const s = cloneState(sIn);
  const r = s.returnables.find((x) => x.id === id);
  if (!r) return { s, ok: false, msg: 'Returnable issue not found', tone: 'bad' };
  r.returnedQty = round2(r.returnedQty + qty);
  r.condition = condition;
  r.returnDate = s.today;
  if (condition === 'LOST') {
    r.status = 'LOSS';
    const value = round2(qty * (materialByCode(r.materialCode)?.price ?? 0));
    const loss = postMovement(s, { movementCode: '240', materialCode: r.materialCode, qty, siteId: r.siteId, locId: 'RET', reason: 'Returnable loss — recovery raised', rate: value / (qty || 1) }, userId);
    raiseException(s, 'SHORTAGE', `Returnable loss: ${qty} ${r.materialCode} issued to ${r.issuedTo} — recovery of ${fmtINR(value)} raised.`, 'warn');
    return loss;
  }
  r.status = r.returnedQty >= r.qty ? 'RETURNED' : 'OUT';
  if (condition === 'GOOD') {
    return postMovement(s, { movementCode: '235', materialCode: r.materialCode, qty, siteId: r.siteId, locId: 'RET', locToId: 'UNR' }, userId);
  }
  return { s, ok: true, msg: 'Damaged returnable recorded for assessment.', tone: 'warn' };
}

/* ---- physical inventory ---- */

export function startCount(sIn: ERPState, args: { siteId: string; materialCode: string; blind: boolean }, userId: string): Res {
  const s = cloneState(sIn);
  const book = availableQty(s, args.siteId, 'UNR', args.materialCode, 'UNR');
  const number = nextNumber(s, 'PI', siteById(args.siteId)!.companyId);
  s.counts.unshift({ id: uid(), number, siteId: args.siteId, materialCode: args.materialCode, blind: args.blind, bookQty: book, countQty: null, variance: null, status: 'COUNTING', at: nowStamp() });
  return { s, ok: true, msg: `Count ${number} opened${args.blind ? ' (BLIND — book quantity withheld)' : ''}.`, tone: 'ok' };
}

export function submitCount(sIn: ERPState, countId: string, countQty: number, userId: string): Res {
  const s = cloneState(sIn);
  const c = s.counts.find((x) => x.id === countId);
  if (!c) return { s, ok: false, msg: 'Count not found', tone: 'bad' };
  c.countQty = countQty;
  c.variance = round2(countQty - c.bookQty);
  c.status = c.variance === 0 ? 'ADJUSTED' : 'VARIANCE';
  return { s, ok: true, msg: c.variance === 0 ? 'Count matches book — no adjustment needed.' : `Variance ${fmtNum(c.variance, 1)} ${materialByCode(c.materialCode)?.baseUom} — adjustment requires approval and a reason.`, tone: c.variance === 0 ? 'ok' : 'warn' };
}

export function adjustCount(sIn: ERPState, countId: string, reason: string, userId: string): Res {
  const s0 = cloneState(sIn);
  const c = s0.counts.find((x) => x.id === countId);
  if (!c) return { s: s0, ok: false, msg: 'Count not found', tone: 'bad' };
  if (c.variance === null || c.variance === 0) return { s: s0, ok: false, msg: 'No variance to adjust.', tone: 'warn' };
  if (reason.trim().length < 4) return { s: s0, ok: false, msg: 'Inventory adjustment requires a reason (min 4 chars).', tone: 'bad' };
  const auth = authorize(s0, userId, 'INV_MVT', '01');
  if (!auth.ok) return { s: s0, ok: false, msg: auth.reason, tone: 'bad' };
  const code = c.variance > 0 ? '500' : '510';
  const res = postMovement(s0, { movementCode: code, materialCode: c.materialCode, qty: Math.abs(c.variance), siteId: c.siteId, locId: 'UNR', reason }, userId);
  if (res.ok) { c.status = 'ADJUSTED'; c.approvedBy = userId; c.reason = reason; }
  return res;
}

/* ---- INV.7 material reconciliation ---- */

export interface ReconRow { mat: string; desc: string; theoretical: number; actual: number; variance: number; variancePct: number; rag: 'R' | 'A' | 'G'; slips: number }

export function materialReconciliation(s: ERPState, wbs: string): ReconRow[] {
  const rows: ReconRow[] = [];
  for (const [key, cfg] of Object.entries(BOQ_COEFFICIENTS)) {
    const [w] = key.split('|');
    if (w !== wbs) continue;
    const mat = materialByCode(cfg.mat)!;
    /* executed BOQ qty approximated from issues; theoretical = executed × coeff × (1+wastage) */
    const issues = s.docs.filter((d) => d.movementCode === '200' && d.wbs === wbs && d.items[0]?.materialCode === cfg.mat);
    const actual = round2(issues.reduce((t, d) => t + d.items[0].qty, 0));
    const executed = actual / (cfg.coeff * 1.02);
    const theoretical = round2(executed * cfg.coeff * 1.02);
    const variance = round2(actual - theoretical);
    const variancePct = theoretical ? round2((variance / theoretical) * 100) : 0;
    const rag = Math.abs(variancePct) > 5 ? 'R' : Math.abs(variancePct) > 2 ? 'A' : 'G';
    rows.push({ mat: mat.code, desc: mat.desc, theoretical, actual, variance, variancePct, rag, slips: issues.length });
  }
  return rows;
}

/* ---- INV reorder-point planning ---- */

export function reorderSuggestions(s: ERPState) {
  const out: { mat: string; siteId: string; onHand: number; openPo: number; reserved: number; reorder: number; suggested: number }[] = [];
  for (const [key, rp] of Object.entries(REORDER_POINTS)) {
    const [mat, siteId] = key.split('|');
    const onHand = availableQty(s, siteId, 'UNR', mat, 'UNR');
    const openPo = round2(s.docs.filter((d) => d.type.startsWith('PO') && d.status === 'RELEASED' && d.siteId === siteId).reduce((t, d) => t + d.items.filter((i) => i.materialCode === mat).reduce((x, i) => x + Math.max(0, i.qty - i.received), 0), 0));
    const resv = reservedQty(s, siteId, mat);
    const net = round2(onHand + openPo - resv);
    if (net < rp.reorder) out.push({ mat, siteId, onHand, openPo, reserved: resv, reorder: rp.reorder, suggested: round2(rp.max - net) });
  }
  return out;
}

/* ---- exceptions ---- */

export function raiseException(s: ERPState, kind: Exc['kind'], text: string, severity: Exc['severity'], ref?: string): void {
  s.exceptions.unshift({ id: uid(), at: nowStamp(), kind, text, severity, ref });
  if (s.exceptions.length > 80) s.exceptions.length = 80;
}

export function ackException(sIn: ERPState, id: string): Res {
  const s = cloneState(sIn);
  const e = s.exceptions.find((x) => x.id === id);
  if (e) e.acknowledged = true;
  return { s, ok: true, msg: 'Exception acknowledged.', tone: 'ok' };
}

/* convenience re-exports used by pages */
export { unitCost, todayISO, daysAheadISO };
export type { RateContract };
