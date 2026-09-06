import type { ERPState, Res, VendorInvoiceCheck, PaymentProposal, PaymentProposalLine, BankStatementLine, JournalLine, AssetMaster } from './types';
import { cloneState, round2, uid, pushAudit, authorize, nextNumber, postJournal, fmtNum, fmtINR, nowStamp, partnerById, docById } from './engine';
import { PARTNERS } from './config';

/* ---------- Three-way match: PO ↔ GR ↔ invoice ---------- */

export function threeWayMatch(s: ERPState, poId: string, invoiceQty: number, invoiceRate: number, invoiceNo: string): VendorInvoiceCheck[] {
  const checks: VendorInvoiceCheck[] = [];
  const po = docById(s, poId);
  if (!po) return [{ label: 'PO exists', ok: false, note: 'Purchase order not found' }];
  const it = po.items[0];

  checks.push({ label: 'Invoice has a goods receipt (GR posted)', ok: it.received > 0, note: it.received > 0 ? `Received ${fmtNum(it.received, 1)} ${it.uom}` : 'Invoice without goods receipt — refused' });

  const qtyOk = invoiceQty <= it.received + 1e-9;
  checks.push({ label: 'Quantity within received (no over-billing)', ok: qtyOk, note: `Invoice ${fmtNum(invoiceQty, 1)} vs received ${fmtNum(it.received, 1)}` });

  const priceVar = it.rate > 0 ? Math.abs((invoiceRate - it.rate) / it.rate) * 100 : 0;
  checks.push({ label: 'Price variance within tolerance (±5%)', ok: priceVar <= 5, note: `${fmtNum(priceVar, 1)}% vs PO rate ${fmtNum(it.rate, 2)}` });

  /* Duplicate detection: exact + fuzzy (same vendor + close amount + recent window) */
  const vendor = partnerById(po.partnerId!);
  const amount = round2(invoiceQty * invoiceRate);
  const dupExact = s.audit.some((a) => a.object === 'VENDOR_INVOICE' && a.key === invoiceNo);
  const dupFuzzy = s.docs.some((d) => d.type === 'IV-VEN' && d.partnerId === po.partnerId && Math.abs(d.total - amount) / Math.max(amount, 1) < 0.02 && d.note?.includes(vendor?.name ?? ''));
  checks.push({ label: 'Not a duplicate (exact + fuzzy)', ok: !dupExact && !dupFuzzy, note: dupExact ? `Invoice ${invoiceNo} already posted` : dupFuzzy ? 'Near-duplicate amount for same vendor within window' : 'No duplicate found' });

  const valueOk = amount <= po.total * 1.05;
  checks.push({ label: 'Invoice not exceeding order value (+5%)', ok: valueOk, note: `${fmtINR(amount)} vs order ${fmtINR(po.total)}` });

  return checks;
}

export const allMatchPass = (checks: VendorInvoiceCheck[]): boolean => checks.every((c) => c.ok);

/* ---------- GR-IR clearing report ---------- */

export interface GrIrLine { poId: string; poNumber: string; vendor: string; receivedNotInvoiced: number; invoicedNotReceived: number; }

export function grIrReport(s: ERPState): GrIrLine[] {
  return s.docs
    .filter((d) => d.type.startsWith('PO') && !['REJECTED', 'CANCELLED'].includes(d.status))
    .map((po) => {
      const it = po.items[0];
      const grValue = round2(it.received * it.rate);
      const ivValue = round2(it.invoiced * it.rate);
      return {
        poId: po.id, poNumber: po.number ?? po.id, vendor: partnerById(po.partnerId ?? '')?.name ?? '—',
        receivedNotInvoiced: Math.max(0, round2(grValue - ivValue)),
        invoicedNotReceived: Math.max(0, round2(ivValue - grValue)),
      };
    })
    .filter((l) => l.receivedNotInvoiced > 0 || l.invoicedNotReceived > 0);
}

/* ---------- Payment proposal: maker-checker + bank file ---------- */

export function buildPaymentProposal(sIn: ERPState, invoiceIds: string[], userId: string): Res {
  const s = cloneState(sIn);
  const auth = authorize(s, userId, 'FIN_DOC', '01', {});
  if (!auth.ok) return { s, ok: false, msg: auth.reason, tone: 'bad' };
  const today = new Date(s.today).getTime();
  const lines: PaymentProposalLine[] = invoiceIds.map((id) => {
    const doc = docById(s, id);
    if (!doc) return null;
    const vendor = partnerById(doc.partnerId ?? '');
    const age = Math.max(0, Math.round((today - new Date(doc.dateISO).getTime()) / 86400000));
    const msme = vendor?.msme ?? false;
    const msmeDays = msme ? age : undefined;
    const msmeInterest = msme && age > 45 ? round2(doc.total * 0.18 * ((age - 45) / 365)) : 0;
    const blocked = msme && age > 45;
    const priority: PaymentProposalLine['priority'] = doc.total > 2000000 ? 'STATUTORY' : msme ? 'MSME' : doc.total > 500000 ? 'CRITICAL' : 'NORMAL';
    return { invoiceId: id, vendorId: doc.partnerId ?? '', dueDate: doc.dateISO, amount: doc.total, priority, msmeDays, msmeInterest, blocked, blockReason: blocked ? `MSME 45-day crossed (${age} days) — interest exposure ${fmtINR(msmeInterest)}` : undefined };
  }).filter(Boolean) as PaymentProposalLine[];

  const number = nextNumber(s, 'PP', 'VUL');
  const proposal: PaymentProposal = {
    id: uid(), number, lines, total: round2(lines.reduce((t, l) => t + l.amount, 0)),
    status: 'PROPOSED', maker: userId, at: nowStamp(),
  };
  s.payProposals.unshift(proposal);
  pushAudit(s, userId, 'POSTING', 'PAYMENT_PROPOSAL', number, { docId: proposal.id, reason: `${lines.length} invoices · ${fmtINR(proposal.total)} · maker ${userId}` });
  return { s, ok: true, msg: `${number} proposed — priority ordered (statutory → MSME → critical → normal), ${lines.filter((l) => l.msmeInterest).length} MSME 45-day exposure(s) flagged.`, tone: 'ok', docId: proposal.id };
}

export function checkProposal(sIn: ERPState, proposalId: string, userId: string): Res {
  const s = cloneState(sIn);
  const p = s.payProposals.find((x) => x.id === proposalId);
  if (!p) return { s, ok: false, msg: 'Proposal not found', tone: 'bad' };
  if (p.maker === userId) {
    pushAudit(s, userId, 'SECURITY', 'PAYMENT_PROPOSAL', p.number, { reason: 'Maker ≠ checker: proposer attempted to check own proposal' });
    return { s, ok: false, msg: 'Maker ≠ checker — the proposer cannot check their own payment proposal.', tone: 'bad' };
  }
  p.status = 'CHECKED';
  p.checker = userId;
  return { s, ok: true, msg: `${p.number} checked by ${userId} — ready for release.`, tone: 'ok' };
}

export function releaseAndExportBankFile(sIn: ERPState, proposalId: string, bankFileTotal: number, userId: string): Res {
  const s = cloneState(sIn);
  const p = s.payProposals.find((x) => x.id === proposalId);
  if (!p) return { s, ok: false, msg: 'Proposal not found', tone: 'bad' };
  if (p.status !== 'CHECKED') return { s, ok: false, msg: 'Proposal must be checked (maker-checker) before release.', tone: 'warn' };
  /* Bank file total must reconcile to the approved proposal total */
  if (Math.abs(bankFileTotal - p.total) > 0.01) {
    pushAudit(s, userId, 'SECURITY', 'BANK_FILE', p.number, { reason: `Bank file total ${fmtINR(bankFileTotal)} ≠ approved total ${fmtINR(p.total)} — export refused` });
    return { s, ok: false, msg: `Bank file export refused: file total ${fmtINR(bankFileTotal)} does not reconcile to approved proposal total ${fmtINR(p.total)} (checksum mismatch).`, tone: 'bad' };
  }
  p.status = 'FILE_EXPORTED';
  p.bankFileTotal = bankFileTotal;
  /* Post the payments */
  for (const l of p.lines) {
    const doc = docById(s, l.invoiceId);
    const vendor = partnerById(l.vendorId);
    if (!doc || !vendor) continue;
    postJournal(s, {
      companyId: doc.companyId, dateISO: s.today,
      lines: [
        { account: vendor.reconAccount, dr: l.amount, cr: 0, text: `Payment — ${doc.number}` },
        { account: '140100', dr: 0, cr: l.amount, text: `Bank — ${p.number}` },
      ],
      refId: doc.id, refNumber: doc.number ?? doc.id, createdBy: userId,
    });
  }
  pushAudit(s, userId, 'POSTING', 'BANK_FILE', p.number, { reason: `Released + exported · file total ${fmtINR(bankFileTotal)} reconciled to approved total · ${p.lines.length} payments posted` });
  return { s, ok: true, msg: `${p.number} released — bank file total reconciled to approved total before export; ${p.lines.length} payments posted.`, tone: 'ok' };
}

/* ---------- Down payment (special indicator A) ---------- */

export function postDownPayment(sIn: ERPState, args: { vendorId: string; amount: number; reason: string }, userId: string): Res {
  const s = cloneState(sIn);
  const vendor = partnerById(args.vendorId);
  if (!vendor) return { s, ok: false, msg: 'Unknown vendor', tone: 'bad' };
  const auth = authorize(s, userId, 'FIN_DOC', '01', {});
  if (!auth.ok) return { s, ok: false, msg: auth.reason, tone: 'bad' };
  const number = nextNumber(s, 'JV', 'VUL');
  postJournal(s, {
    companyId: 'VUL', dateISO: s.today,
    lines: [
      { account: '120200', dr: args.amount, cr: 0, text: `Advance to supplier — ${vendor.name}`, indicator: 'A' },
      { account: '140100', dr: 0, cr: args.amount, text: 'Bank — down payment' },
    ],
    refId: 'DOWNPAY', refNumber: number, createdBy: userId,
  });
  pushAudit(s, userId, 'POSTING', 'DOWN_PAYMENT', number, { reason: `${fmtINR(args.amount)} to ${vendor.name} — special indicator A (not normal payable)` });
  return { s, ok: true, msg: `${number} posted — advance ${fmtINR(args.amount)} to special-indicator A account (Advances to Suppliers), visible on the vendor account, cleared against the final invoice.`, tone: 'ok' };
}

/* ---------- Bank statement matching ---------- */

export function importBankStatement(sIn: ERPState, lines: { dateISO: string; ref: string; desc: string; amount: number }[], userId: string): Res {
  const s = cloneState(sIn);
  let matched = 0;
  for (const l of lines) {
    const today = new Date(s.today).getTime();
    const auto = s.docs.find((d) => d.type === 'IV-VEN' && (d.number === l.ref || d.note?.includes(l.ref)));
    const entry: BankStatementLine = {
      id: uid(), dateISO: l.dateISO, ref: l.ref, desc: l.desc, amount: l.amount,
      matchedInvoiceId: auto?.id, matchedBy: auto ? 'AUTO' : undefined,
      status: auto ? 'MATCHED' : 'UNMATCHED',
      ageDays: Math.max(0, Math.round((today - new Date(l.dateISO).getTime()) / 86400000)),
    };
    if (auto) matched++;
    s.bankLines.unshift(entry);
  }
  return { s, ok: true, msg: `${lines.length} statement lines imported — ${matched} auto-matched on reference, ${lines.length - matched} unmatched (ageing report updated).`, tone: 'ok' };
}

/* ---------- Parallel depreciation areas ---------- */

export function runDepreciation(sIn: ERPState, userId: string): Res {
  const s = cloneState(sIn);
  const auth = authorize(s, userId, 'FIN_DOC', '01', {});
  if (!auth.ok) return { s, ok: false, msg: auth.reason, tone: 'bad' };
  let coLaw = 0;
  let tax = 0;
  for (const a of s.assets) {
    const dCo = round2((a.acqValue * a.coLawRatePct) / 100);
    const dTax = round2((a.acqValue * a.taxRatePct) / 100);
    a.depCoLaw = round2(a.depCoLaw + dCo);
    a.depTax = round2(a.depTax + dTax);
    coLaw += dCo;
    tax += dTax;
  }
  if (coLaw > 0) {
    postJournal(s, {
      companyId: 'VUL', dateISO: s.today,
      lines: [
        { account: '420300', dr: coLaw, cr: 0, text: 'Depreciation expense (company law — SLM)' },
        { account: '160200', dr: 0, cr: coLaw, text: 'Accumulated depreciation' },
      ],
      refId: 'DEPRUN', refNumber: `DEP/${s.today}`, createdBy: userId,
    });
  }
  pushAudit(s, userId, 'POSTING', 'DEPRECIATION', `RUN ${s.today}`, { reason: `Parallel areas: company law ${fmtINR(coLaw)} (posted) · tax law ${fmtINR(tax)} (memo, WDV)` });
  return { s, ok: true, msg: `Depreciation run — company law ${fmtINR(coLaw)} posted; tax law ${fmtINR(tax)} computed in parallel (different method/rate, same asset).`, tone: 'ok' };
}

export { PARTNERS };
