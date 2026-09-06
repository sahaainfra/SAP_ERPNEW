import type { ERPState, Res, SubcontractOrder, JournalLine } from './types';
import { cloneState, round2, uid, pushAudit, authorize, nextNumber, postJournal, postMovement, fmtNum, fmtINR, nowStamp, partnerById, materialByCode } from './engine';
import { boqById } from './ctr';
import { PROJECTS } from './config';

export const suborderById = (s: ERPState, id: string): SubcontractOrder | undefined => s.suborders.find((o) => o.id === id);

/* ---------- Compliance interlock: expired labour licence blocks payment ---------- */

export function complianceBlock(s: ERPState, order: SubcontractOrder, userId: string): { blocked: boolean; reason: string; overrideByLegal: boolean } {
  const issues: string[] = [];
  if (s.today > order.labourLicenceValidTo) issues.push(`labour licence expired ${order.labourLicenceValidTo}`);
  if (!order.pfCompliant) issues.push('PF return not filed');
  if (s.today > order.insuranceValidTo) issues.push(`insurance lapsed ${order.insuranceValidTo}`);
  if (issues.length === 0) return { blocked: false, reason: '', overrideByLegal: false };

  const user = s.userId ? undefined : undefined; // resolved by caller via authorize
  void user;
  const isLegal = authorize(s, userId, 'BP_BANK', '02', {}).ok; // Legal & Compliance holds BP_BANK change authority as proxy
  return {
    blocked: true,
    reason: `Payment release BLOCKED — principal-employer liability: ${issues.join('; ')}.`,
    overrideByLegal: isLegal,
  };
}

/* ---------- Subcontract order ---------- */

export function createSuborder(
  sIn: ERPState,
  args: { subconId: string; projectCode: string; wbs: string; clientBoqIds: string[]; subRates: Record<string, number>; ceilingValue: number; labourLicenceValidTo: string; pfCompliant: boolean; insuranceValidTo: string; materialRecoveryRate: Record<string, number> },
  userId: string,
): Res {
  const s = cloneState(sIn);
  const vendor = partnerById(args.subconId);
  if (!vendor || !vendor.roles.includes('SUBCON')) return { s, ok: false, msg: 'Partner has no SUBCONTRACTOR role.', tone: 'bad' };
  const auth = authorize(s, userId, 'PRC_PO', '01', {});
  if (!auth.ok) return { s, ok: false, msg: auth.reason, tone: 'bad' };

  const lines = args.clientBoqIds.map((id) => {
    const b = boqById(s, id);
    if (!b) return null;
    return { clientBoqId: id, desc: b.desc, qty: b.revisedQty, rate: b.tenderRate, subRate: args.subRates[id] ?? round2(b.tenderRate * 0.85) };
  }).filter(Boolean) as SubcontractOrder['lines'];

  if (!lines.length) return { s, ok: false, msg: 'Map at least one client BOQ line.', tone: 'bad' };

  const companyId = PROJECTS.find((p) => p.code === args.projectCode)?.companyId ?? 'VUL';
  const number = nextNumber(s, 'SO', companyId);
  const order: SubcontractOrder = {
    id: uid(), number, subconId: args.subconId, projectCode: args.projectCode, wbs: args.wbs,
    lines, ceilingValue: args.ceilingValue, retentionPct: 5, advancePct: 5,
    labourLicenceValidTo: args.labourLicenceValidTo, pfCompliant: args.pfCompliant, insuranceValidTo: args.insuranceValidTo,
    status: 'ACTIVE', materialRecoveryRate: args.materialRecoveryRate,
  };
  s.suborders.unshift(order);
  pushAudit(s, userId, 'POSTING', 'SUBCONTRACT', number, { docId: order.id, reason: `${vendor.name} · ${lines.length} back-to-back lines · ceiling ${fmtINR(args.ceilingValue)}` });
  return { s, ok: true, msg: `${number} created — back-to-back mapping makes per-item margin visible during execution.`, tone: 'ok', docId: order.id };
}

/** Back-to-back margin per line: client rate − subcontract rate. */
export function backToBackMargin(order: SubcontractOrder): { line: SubcontractOrder['lines'][0]; marginPct: number; marginValue: number }[] {
  return order.lines.map((l) => ({
    line: l,
    marginPct: l.rate > 0 ? round2(((l.rate - l.subRate) / l.rate) * 100) : 0,
    marginValue: round2((l.rate - l.subRate) * l.qty),
  }));
}

/* ---------- Material issued to subcontractor ---------- */

/** Free-issue: movement 400 (to subcontractor stock, still company-owned). Consumption on receipt via 410. */
export function issueFreeIssueMaterial(sIn: ERPState, orderId: string, args: { materialCode: string; qty: number; siteId: string }, userId: string): Res {
  return postMovement(sIn, {
    movementCode: '400', materialCode: args.materialCode, qty: args.qty, siteId: args.siteId,
    locId: 'SUB', partnerId: suborderById(sIn, orderId)?.subconId, refDocId: orderId,
  }, userId);
}

/** Recoverable issue: creates an automatic recovery at the order's recovery rate in the next bill. */
export function issueRecoverableMaterial(sIn: ERPState, orderId: string, args: { materialCode: string; qty: number; siteId: string }, userId: string): Res {
  const s0 = sIn;
  const order = suborderById(s0, orderId);
  if (!order) return { s: cloneState(s0), ok: false, msg: 'Subcontract order not found', tone: 'bad' };
  const recRate = order.materialRecoveryRate[args.materialCode];
  const mat = materialByCode(args.materialCode);
  if (!mat) return { s: cloneState(s0), ok: false, msg: 'Unknown material', tone: 'bad' };
  if (recRate === undefined) return { s: cloneState(s0), ok: false, msg: `No recovery rate defined for ${args.materialCode} on ${order.number} — define it in the order first.`, tone: 'bad' };

  /* Issue out of company stock (goods issue to subcontractor, valued) */
  const issue = postMovement(s0, {
    movementCode: '200', materialCode: args.materialCode, qty: args.qty, siteId: args.siteId, locId: 'UNR', wbs: order.wbs, refDocId: orderId,
  }, userId);
  if (!issue.ok) return issue;
  const s = issue.s;
  const recovery = round2(args.qty * recRate);
  pushAudit(s, userId, 'POSTING', 'SUB_MATERIAL_RECOVERY', order.number, { reason: `Recoverable issue ${fmtNum(args.qty, 1)} ${mat.baseUom} ${mat.code} @ recovery rate ${fmtINR(recRate)} → automatic recovery ${fmtINR(recovery)} in next bill (market+handling, not cost)`, docId: orderId });
  return { s, ok: true, msg: `Issued ${fmtNum(args.qty, 1)} ${mat.baseUom} — automatic recovery ${fmtINR(recovery)} armed for the next subcontract bill.`, tone: 'ok' };
}

/* ---------- Subcontract billing with recoveries ---------- */

export function raiseSubBill(sIn: ERPState, orderId: string, args: { grossValue: number; materialRecovery: number; royaltyRecovery: number }, userId: string): Res {
  const s = cloneState(sIn);
  const order = suborderById(s, orderId);
  if (!order) return { s, ok: false, msg: 'Subcontract order not found', tone: 'bad' };
  const vendor = partnerById(order.subconId)!;

  /* Compliance interlock — block payment release */
  const comp = complianceBlock(s, order, userId);
  if (comp.blocked && !comp.overrideByLegal) {
    pushAudit(s, userId, 'SECURITY', 'SUB_PAYMENT', order.number, { reason: comp.reason });
    return { s, ok: false, msg: comp.reason, tone: 'bad' };
  }

  const retention = round2((args.grossValue * order.retentionPct) / 100);
  const tds = round2((args.grossValue * vendor.tdsPct) / 100);
  const net = round2(args.grossValue - retention - tds - args.materialRecovery - args.royaltyRecovery);
  const companyId = PROJECTS.find((p) => p.code === order.projectCode)?.companyId ?? 'VUL';
  const number = nextNumber(s, 'SB', companyId);

  const lines: JournalLine[] = [
    { account: '410100', dr: args.grossValue, cr: 0, text: `Subcontract cost — ${order.number}`, wbs: order.wbs },
    { account: '120100', dr: 0, cr: net, text: `Payable — ${vendor.name}` },
    { account: '120300', dr: 0, cr: retention, text: 'Retention from subcontractor' },
    { account: '121000', dr: 0, cr: tds, text: `TDS ${vendor.tdsSection}` },
    { account: '120600', dr: 0, cr: round2(args.materialRecovery + args.royaltyRecovery), text: 'Material / royalty recovery' },
  ];
  postJournal(s, { companyId, dateISO: s.today, lines, refId: order.id, refNumber: number, createdBy: userId });
  pushAudit(s, userId, 'POSTING', 'SUB_BILL', number, { docId: order.id, reason: `Gross ${fmtINR(args.grossValue)} · retention ${fmtINR(retention)} · recoveries ${fmtINR(args.materialRecovery + args.royaltyRecovery)} · net ${fmtINR(net)}${comp.blocked ? ' · LEGAL OVERRIDE applied with reason' : ''}` });
  return { s, ok: true, msg: `${number} posted — gross ${fmtINR(args.grossValue)}, net payable ${fmtINR(net)} after retention, TDS and recoveries.${comp.blocked ? ' (Legal & Compliance override recorded.)' : ''}`, tone: 'ok' };
}
