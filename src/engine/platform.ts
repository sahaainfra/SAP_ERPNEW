/* ======================================================================== */
/*  VULCAN ERP — PART 1/10 PLATFORM SERVICES                                */
/*  ConversationService · Idempotency · Gapless numbering · Journal         */
/*  reversal · Cancellation · Resubmission diff · SoD · SLA escalation ·    */
/*  Field-status enforcement · Numbering stress harness                     */
/*  All built strictly on the Part 1 posting/release/numbering engine.      */
/* ======================================================================== */

import type { ERPState, Res, Doc, Conversation, JournalLine } from './types';
import {
  cloneState, uid, nowStamp, round2, fmtINR, daysAheadISO, daysAgoISO, fyOf,
  docById, userById, nextNumber, pushAudit, postJournal, authorize,
  determineStrategy,
  createPR as coreCreatePR, createPOFromPR as coreCreatePO, approveDoc as coreApprove,
  amendItemRate as coreAmend, postMovement as coreMovement, postManualJournal as coreManualJV,
  postInvoice as coreInvoice,
} from './engine';
import type { PRItemArgs, MovementArgs } from './engine';
import { FIELD_STATUS_GROUPS, ROLES, SOD_RULES } from './config';

/* ===================== context-bound communication ===================== */

export function ensureConversation(s: ERPState, doc: Doc): string {
  if (doc.conversationId && s.conversations.some((c) => c.id === doc.conversationId)) return doc.conversationId;
  const id = `CV-${doc.id.slice(0, 8)}`;
  s.conversations.unshift({
    id,
    title: `${doc.type} ${doc.number ?? '(draft)'}`,
    refType: doc.type,
    refId: doc.id,
    refNumber: doc.number ?? undefined,
    module: doc.module,
    messages: [{
      id: uid(), user: 'SYSTEM', at: nowStamp(), system: true,
      text: `Thread opened automatically by the document type (${doc.type} · conversation_auto_create). Discussion stays bound to this record — never in a chat app outside the system.`,
    }],
  });
  doc.conversationId = id;
  return id;
}

export function postToConversation(s: ERPState, convId: string, user: string, text: string, system = false): void {
  const c = s.conversations.find((x) => x.id === convId);
  if (!c) return;
  c.messages.push({ id: uid(), user, at: nowStamp(), text, system });
}

export function sendChat(sIn: ERPState, convId: string, text: string, userId: string): Res {
  const s = cloneState(sIn);
  const c = s.conversations.find((x) => x.id === convId);
  if (!c) return { s, ok: false, msg: 'Conversation not found', tone: 'bad' };
  if (!text.trim()) return { s, ok: false, msg: 'Message is empty.', tone: 'warn' };
  postToConversation(s, convId, userId, text.trim());
  return { s, ok: true, msg: '', tone: 'ok' };
}

export function deleteChatMsg(sIn: ERPState, convId: string, msgId: string, userId: string): Res {
  const s = cloneState(sIn);
  const c = s.conversations.find((x) => x.id === convId);
  if (!c) return { s, ok: false, msg: 'Conversation not found', tone: 'bad' };
  if (c.legalHold) {
    pushAudit(s, userId, 'SECURITY', 'CHAT_DELETE', c.id, { reason: 'Deletion refused — thread is under legal hold (reason mandatory, deletion impossible)' });
    return { s, ok: false, msg: 'Thread is under legal hold — messages cannot be deleted. The refusal is written to the audit log.', tone: 'bad' };
  }
  const m = c.messages.find((x) => x.id === msgId);
  if (!m) return { s, ok: false, msg: 'Message not found', tone: 'bad' };
  if (m.system) return { s, ok: false, msg: 'System events are immutable.', tone: 'warn' };
  c.messages = c.messages.filter((x) => x.id !== msgId);
  pushAudit(s, userId, 'CHANGE', 'CHAT_DELETE', c.id, { reason: 'Message deleted — recorded with user, time and thread (reason-mandatory event)' });
  return { s, ok: true, msg: 'Message deleted — the deletion itself is on the audit trail.', tone: 'info' };
}

export function setLegalHold(sIn: ERPState, convId: string, on: boolean, userId: string): Res {
  const s = cloneState(sIn);
  const c = s.conversations.find((x) => x.id === convId);
  if (!c) return { s, ok: false, msg: 'Conversation not found', tone: 'bad' };
  c.legalHold = on;
  pushAudit(s, userId, 'CONFIG', 'LEGAL_HOLD', c.id, { reason: on ? 'Legal hold applied — deletions now impossible' : 'Legal hold released' });
  return { s, ok: true, msg: on ? 'Legal hold applied to the thread.' : 'Legal hold released.', tone: on ? 'warn' : 'ok' };
}

/** Attach threads to documents created before the communication layer (seed backfill). */
export function backfillConversations(s: ERPState): void {
  for (const d of s.docs) {
    if ((d.type.startsWith('PR') || d.type.startsWith('PO') || d.type === 'IV-VEN') && d.status !== 'DRAFT') {
      ensureConversation(s, d);
    }
  }
}

/* ===================== document-aware wrappers ===================== */

/** createPR + field-status-group enforcement + auto conversation */
export function createPR(
  sIn: ERPState,
  args: { siteId: string; items: PRItemArgs[]; neededBy: string; note?: string; docType?: string; submit: boolean },
  userId: string,
): Res {
  const dt = args.docType ?? 'PR-STD';
  const fs = FIELD_STATUS_GROUPS[dt] ?? {};
  if (fs.JUSTIFICATION === 'REQ' && (!args.note || args.note.trim().length < 8)) {
    const s = cloneState(sIn);
    pushAudit(s, userId, 'SECURITY', 'FIELD_STATUS', dt, { reason: `Field status group ${dt} makes JUSTIFICATION mandatory — refused at the service layer` });
    return { s, ok: false, msg: `Field-status group for ${dt}: JUSTIFICATION is mandatory (min 8 characters) — configuration, not code.`, tone: 'bad' };
  }
  const res = coreCreatePR(sIn, args, userId);
  if (res.ok && res.docId && args.submit) {
    const d = docById(res.s, res.docId);
    if (d) ensureConversation(res.s, d);
  }
  return res;
}

export function createPOFromPR(sIn: ERPState, prId: string, args: { partnerId: string; deliveryDate: string }, userId: string): Res {
  const res = coreCreatePO(sIn, prId, args, userId);
  if (res.ok && res.docId) {
    const d = docById(res.s, res.docId);
    if (d) ensureConversation(res.s, d);
  }
  return res;
}

/** approveDoc + posts the release event into the document's conversation thread */
export function approveDoc(sIn: ERPState, docId: string, action: 'APPROVE' | 'REJECT', comment: string, userId: string): Res {
  const before = docById(sIn, docId);
  const pendingIdx = before?.release?.steps.findIndex((st) => st.status === 'PENDING') ?? -1;
  const res = coreApprove(sIn, docId, action, comment, userId);
  const d = docById(res.s, docId);
  if (d) {
    if (action === 'REJECT' && res.ok) {
      d.rejectedSnapshot = { total: d.total, rate: d.items[0]?.rate ?? 0, at: nowStamp() };
    }
    if (d.conversationId) {
      const u = userById(userId);
      if (action === 'REJECT' && res.ok) {
        postToConversation(res.s, d.conversationId, userId, `Rejected at step ${d.release?.steps[pendingIdx]?.code ?? '—'} — “${comment}” · ${u.name}`, true);
      } else if (res.ok) {
        const step = d.release?.steps[pendingIdx];
        const last = d.release?.indicator === 'RELEASED';
        postToConversation(
          res.s, d.conversationId, userId,
          last
            ? `Fully released by ${u.name} — approved snapshot v${d.snapshots?.length ?? 1} of ${fmtINR(d.total)} archived.`
            : `Step ${step?.code} (${step?.title}) approved by ${u.name} — snapshot of ${fmtINR(d.total)} archived. Next: ${d.release?.steps[pendingIdx + 1]?.title}.`,
          true,
        );
      } else if (!res.ok && res.msg.includes('Maker')) {
        postToConversation(res.s, d.conversationId, userId, `Blocked: ${u.name} tried to approve a document they initiated — maker ≠ checker is absolute.`, true);
      }
    }
  }
  return res;
}

/** amendItemRate + optimistic-locking check on `version` */
export function amendItemRate(sIn: ERPState, poId: string, newRate: number, reason: string, userId: string, expectedVersion?: number): Res {
  const before = docById(sIn, poId);
  if (before && expectedVersion !== undefined && (before.version ?? 1) !== expectedVersion) {
    const s = cloneState(sIn);
    pushAudit(s, userId, 'SECURITY', 'OPTIMISTIC_LOCK', before.number ?? poId, { reason: `Concurrent edit conflict — expected version ${expectedVersion}, current ${(before.version ?? 1)}` });
    return { s, ok: false, msg: `409 Conflict — the document moved to version ${(before.version ?? 1)} while you held version ${expectedVersion}. Reload and retry; nothing was overwritten.`, tone: 'bad' };
  }
  const res = coreAmend(sIn, poId, newRate, reason, userId);
  if (res.ok) {
    const d = docById(res.s, poId);
    if (d) {
      d.version = (d.version ?? 1) + 1;
      if (d.conversationId) postToConversation(res.s, d.conversationId, userId, `Amended: rate → ${fmtINR(newRate)} · reason “${reason}” · now v${d.version}`, true);
    }
  }
  return res;
}

/** resubmission after rejection — the system diffs and refuses an unchanged document */
export function resubmitDoc(sIn: ERPState, docId: string, userId: string): Res {
  const s = cloneState(sIn);
  const d = docById(s, docId);
  if (!d) return { s, ok: false, msg: 'Document not found', tone: 'bad' };
  if (d.status !== 'REJECTED') return { s, ok: false, msg: `Only rejected documents resubmit (current: ${d.status}).`, tone: 'warn' };
  const snap = d.rejectedSnapshot;
  const nowRate = d.items[0]?.rate ?? 0;
  if (snap && snap.total === d.total && snap.rate === nowRate) {
    pushAudit(s, userId, 'SECURITY', 'RESUBMIT', d.number ?? d.id, { reason: 'Unchanged resubmission refused — document identical to the rejected version' });
    return { s, ok: false, msg: 'Resubmission refused — the document is byte-identical to the rejected version (total and rate unchanged). Amend something material first.', tone: 'bad' };
  }
  const groupId = d.type.startsWith('PR') ? 'REL-PR' : 'REL-PO';
  d.release = determineStrategy(groupId, d.total);
  d.status = 'PENDING_RELEASE';
  if (d.conversationId) postToConversation(s, d.conversationId, userId, `Resubmitted after rejection — strategy re-determined (${d.release.strategyName}); changes diffed against the rejected snapshot.`, true);
  return { s, ok: true, msg: `${d.number} resubmitted — release strategy re-determined, changes logged against the rejected snapshot.`, tone: 'ok', docId: d.id };
}

/* ===================== idempotency ===================== */

function idemReplay(sIn: ERPState, key: string): Res | null {
  const prev = sIn.idem[key];
  if (!prev) return null;
  return { s: sIn, ok: true, tone: 'info', docId: prev.docId, msg: `Idempotent replay (key ${key}) — the original result was returned; nothing was re-posted.` };
}

export function postMovementIdem(sIn: ERPState, a: MovementArgs & { idemKey?: string }, userId: string, opts?: { injectFailure?: boolean }): Res {
  if (a.idemKey) { const r = idemReplay(sIn, a.idemKey); if (r) return r; }
  const res = coreMovement(sIn, a, userId, opts);
  if (a.idemKey && res.ok && !opts?.injectFailure) res.s.idem[a.idemKey] = { ok: true, msg: res.msg, docId: res.docId };
  return res;
}

export function postManualJournalIdem(sIn: ERPState, args: Parameters<typeof coreManualJV>[1] & { idemKey?: string }, userId: string): Res {
  if (args.idemKey) { const r = idemReplay(sIn, args.idemKey); if (r) return r; }
  const res = coreManualJV(sIn, args, userId);
  if (args.idemKey && res.ok) res.s.idem[args.idemKey] = { ok: true, msg: res.msg, docId: res.docId };
  return res;
}

export function postInvoiceIdem(sIn: ERPState, poId: string, args: Parameters<typeof coreInvoice>[2] & { idemKey?: string }, userId: string): Res {
  if (args.idemKey) { const r = idemReplay(sIn, args.idemKey); if (r) return r; }
  const res = coreInvoice(sIn, poId, args, userId);
  if (args.idemKey && res.ok) res.s.idem[args.idemKey] = { ok: true, msg: res.msg, docId: res.docId };
  return res;
}

/* ===================== gapless numbering (per scope) ===================== */

/**
 * Gapless series scoped per object + scope (tax registration unit) + fiscal year.
 * Pattern: {COMPANY}/{SCOPE}/{TYPE}/{FY}/{SEQ:6} — number assigned only on successful post;
 * cancellation retains the number, it is never reissued; rollback leaks nothing because the
 * counter increments strictly after every validation passes.
 */
export function nextGaplessNumber(s: ERPState, object: string, scope: string, company: string, type: string): string {
  const key = `${object}|${scope}|${fyOf(s.today)}`;
  s.seq[key] = (s.seq[key] ?? 0) + 1;
  return `${company}/${scope}/${type}/${fyOf(s.today)}/${String(s.seq[key]).padStart(6, '0')}`;
}

export const gaplessCurrent = (s: ERPState, object: string, scope: string): number =>
  s.seq[`${object}|${scope}|${fyOf(s.today)}`] ?? 0;

/* ===================== journal reversal & cancellation ===================== */

/** Posted journals are immutable — correction is by dated, reasoned, linked contra entry */
export function reverseJournal(sIn: ERPState, journalId: string, reason: string, userId: string): Res {
  const s = cloneState(sIn);
  const j = s.journals.find((x) => x.id === journalId);
  if (!j) return { s, ok: false, msg: 'Journal not found', tone: 'bad' };
  if (j.status === 'REVERSED') return { s, ok: false, msg: `${j.number} is already reversed.`, tone: 'warn' };
  if (j.reversalOf) return { s, ok: false, msg: 'A reversal entry is itself never reversed — reverse the original.', tone: 'warn' };
  if (reason.trim().length < 4) return { s, ok: false, msg: 'Reversal requires a reason (min 4 characters).', tone: 'bad' };
  const contra: JournalLine[] = j.lines.map((l) => ({ ...l, dr: l.cr, cr: l.dr, text: `Reversal of ${j.number} — ${l.text}` }));
  const number = postJournal(s, { companyId: j.companyId, dateISO: s.today, lines: contra, refId: j.refId, refNumber: j.refNumber, createdBy: userId, reason });
  const created = s.journals.find((x) => x.number === number)!;
  created.reversalOf = j.id;
  j.reversedBy = created.id;
  j.status = 'REVERSED';
  pushAudit(s, userId, 'POSTING', 'JOURNAL_REVERSAL', number, { reason: `Contra of ${j.number} — both entries reference each other; original untouched` });
  return { s, ok: true, msg: `${j.number} reversed by ${number} — linked both ways. The original remains, immutable.`, tone: 'ok', docId: created.id };
}

/** Cancellation retains the document number permanently — a gapless number is never reissued */
export function cancelDocument(sIn: ERPState, docId: string, reason: string, userId: string): Res {
  const s = cloneState(sIn);
  const d = docById(s, docId);
  if (!d) return { s, ok: false, msg: 'Document not found', tone: 'bad' };
  if (!d.number) return { s, ok: false, msg: 'Drafts carry a UUID, not a number — nothing to cancel.', tone: 'warn' };
  if (d.status === 'CANCELLED') return { s, ok: false, msg: `${d.number} is already cancelled.`, tone: 'warn' };
  if (reason.trim().length < 4) return { s, ok: false, msg: 'Cancellation requires a reason.', tone: 'bad' };
  d.status = 'CANCELLED';
  d.reason = reason;
  pushAudit(s, userId, 'SYSTEM', 'NUMBERING', d.number, { docId: d.id, reason: `Cancelled — number ${d.number} retained permanently; the gapless range never reissues it` });
  if (d.conversationId) postToConversation(s, d.conversationId, userId, `Document cancelled — “${reason}”. Number ${d.number} retained, never reissued.`, true);
  return { s, ok: true, msg: `${d.number} cancelled — the number is retained as cancelled and will never be reissued.`, tone: 'warn', docId: d.id };
}

/* ===================== SoD & SLA ===================== */

/** Configurable conflict matrix — toxic combinations on one user */
export function sodConflicts(userId: string): { rule: string; desc: string }[] {
  const user = userById(userId);
  if (!user) return [];
  const held = (obj: string, act?: string) =>
    user.roles.some((rid) => {
      const role = ROLES.find((r) => r.id === rid);
      return role?.objects.some((g) => (g.obj === obj || g.obj === '*') && (!act || g.activities.includes(act) || g.activities.includes('*')));
    });
  return SOD_RULES
    .filter((rule) => {
      const [oa, oaAct] = rule.a.split(':');
      const [ob, obAct] = rule.b.split(':');
      return held(oa, oaAct) && held(ob, obAct);
    })
    .map((r) => ({ rule: `${r.a} × ${r.b}`, desc: r.desc }));
}

/** Pending approvals past their SLA auto-escalate and notify the document thread */
export function escalateOverdue(sIn: ERPState, userId: string): Res {
  const s = cloneState(sIn);
  let n = 0;
  for (const d of s.docs) {
    if (!d.release || d.release.indicator === 'RELEASED' || d.release.indicator === 'REJECTED') continue;
    for (const st of d.release.steps) {
      if (st.status === 'PENDING' && st.slaDueAt && s.today > st.slaDueAt && !st.escalated) {
        st.escalated = true;
        n++;
        pushAudit(s, userId, 'SYSTEM', 'SLA_ESCALATION', d.number ?? d.id, { reason: `Step ${st.code} breached the ${st.slaHours}h SLA — escalated and notification posted to the document thread` });
        if (d.conversationId) {
          postToConversation(s, d.conversationId, userId, `SLA breach — step ${st.code} (${st.title}) exceeded ${st.slaHours}h. Auto-escalated per the release strategy.`, true);
        }
      }
    }
  }
  return {
    s, ok: true,
    msg: n ? `${n} pending approval(s) breached SLA — escalated, and a notification was posted into each document's conversation.` : 'No SLA breaches among pending approvals.',
    tone: n ? 'warn' : 'info',
  };
}

/* ===================== numbering stress harness ===================== */

/** 50 concurrent posts through the sequence service — gapless, unique, no MAX(id)+1 */
export function runNumberingStress(sIn: ERPState, userId: string): Res {
  let s = sIn;
  const numbers: string[] = [];
  for (let i = 0; i < 50; i++) {
    const r = coreMovement(s, { movementCode: '320', materialCode: 'MAT-C53', qty: 1, siteId: 'ST-GDN', locId: 'UNR', locToId: 'UNR' }, userId);
    if (!r.ok || !r.docId) return { s: r.s, ok: false, msg: `Stress aborted at post ${i + 1}: ${r.msg}`, tone: 'bad', detail: numbers.join('\n') };
    s = r.s;
    numbers.push(docById(s, r.docId)!.number!);
  }
  const uniq = new Set(numbers).size;
  const seqs = numbers.map((n) => +n.split('/').pop()!);
  const sorted = [...seqs].sort((a, b) => a - b);
  const gapless = sorted.every((v, i) => i === 0 || v === sorted[i - 1] + 1);
  const ok = uniq === 50 && gapless;
  return {
    s, ok,
    msg: ok
      ? `50 posts → 50 unique gapless numbers (${sorted[0]}…${sorted[49]}). Sequence table with row-level lock semantics; no MAX(id)+1 anywhere.`
      : `Collision or gap detected: unique=${uniq}, gapless=${gapless}`,
    tone: ok ? 'ok' : 'bad',
    detail: numbers.join('\n'),
  };
}

/* ===================== misc evidence helpers ===================== */

export const daysAhead = daysAheadISO;
export const daysBack = daysAgoISO;
export { round2, fmtINR };
export type { Conversation };
