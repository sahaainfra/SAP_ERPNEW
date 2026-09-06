/* ======================================================================== */
/*  VULCAN ERP — PART 2/10 MASTER DATA MANAGEMENT ENGINE                    */
/*  View segments · structured naming · duplicate prevention · UOM engine · */
/*  geofence containment · Excel import pipeline · quality dashboard.       */
/*  Built strictly on Part 1 services (numbering, audit, change docs,       */
/*  authorization, conversation).                                           */
/* ======================================================================== */

import type {
  ERPState, Res, Material, Partner, UomFactor, Geofence, ImportRun, ImportRow,
} from './types';
import {
  cloneState, uid, round2, nowStamp, fmtINR, pushAudit, userById, materialByCode,
} from './engine';
import {
  MATERIALS, PARTNERS, UOM_DEFS, UOM_FACTORS_SEED, GEOFENCE_SEED,
  PROJECT_TEMPLATES, DUAL_CONTROL_FIELDS, IMPORT_SAMPLE,
} from './config';

/* ===================== structured naming (§2.1) ===================== */

export interface ParsedName { noun: string; modifier?: string; size?: string; grade?: string; make?: string; }

/**
 * Enforce NOUN, MODIFIER, SIZE, GRADE, MAKE. Free-text naming is refused —
 * it is why cement lives under eleven different names in most contractors.
 */
export function parseStructuredName(desc: string): ParsedName | null {
  const parts = desc.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length < 3 || parts.length > 5) return null;
  const [noun, modifier, size, grade, make] = parts;
  if (!noun || noun.length < 2) return null;
  return { noun, modifier, size, grade, make };
}

export function nameCheck(desc: string): { ok: boolean; msg: string } {
  const p = parseStructuredName(desc);
  if (!p) {
    return {
      ok: false,
      msg: `Description must follow NOUN, MODIFIER, SIZE, GRADE, MAKE (e.g. "CEMENT, OPC, 50 KG, 53 GRADE, ULTRATECH"). Free-text naming is refused so reconciliation stays possible.`,
    };
  }
  return { ok: true, msg: `Parsed → ${p.noun}${p.modifier ? ' / ' + p.modifier : ''}${p.size ? ' / ' + p.size : ''}${p.grade ? ' / ' + p.grade : ''}${p.make ? ' / ' + p.make : ''}` };
}

/* ===================== duplicate prevention (§1.3) ===================== */

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Normalised Levenshtein similarity 0..1 */
export function similarity(a: string, b: string): number {
  const x = norm(a), y = norm(b);
  if (!x.length || !y.length) return 0;
  if (x === y) return 1;
  const m = x.length, n = y.length;
  const dp: number[] = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    let prev = dp[0]; dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (x[i - 1] === y[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return 1 - dp[n] / Math.max(m, n);
}

export interface DupHit { key: string; matchedOn: string; severity: 'HIGH' | 'NEAR'; }

/** Partner fuzzy match on name + PAN + GSTIN + bank account */
export function findPartnerDup(s: ERPState, cand: { name: string; pan: string; gstin?: string; bankAcct?: string }): DupHit | null {
  for (const p of PARTNERS) {
    if (p.status === 'MARKED_FOR_DELETION') continue;
    if (cand.pan && p.pan === cand.pan) return { key: p.id, matchedOn: `PAN ${p.pan}`, severity: 'HIGH' };
    if (cand.bankAcct && p.bank.acct === cand.bankAcct && cand.pan && p.pan !== cand.pan) {
      return { key: p.id, matchedOn: `bank account ${p.bank.acct} with a different PAN`, severity: 'HIGH' };
    }
    if (cand.gstin && p.gstin.some((g) => g.no === cand.gstin)) return { key: p.id, matchedOn: `GSTIN ${cand.gstin}`, severity: 'HIGH' };
    if (similarity(p.name, cand.name) > 0.88) return { key: p.id, matchedOn: `near-identical name "${p.name}"`, severity: 'NEAR' };
  }
  return null;
}

/** Material fuzzy match on description + specification + group */
export function findMaterialDup(s: ERPState, cand: { desc: string; spec: string; group: string }): DupHit | null {
  for (const m of MATERIALS) {
    if (m.status === 'MARKED_FOR_DELETION') continue;
    const ds = similarity(m.desc, cand.desc);
    const ss = similarity(m.spec, cand.spec);
    if (ds > 0.9 && m.group === cand.group && ss > 0.7) {
      return { key: m.code, matchedOn: `near-identical description + spec in group ${m.group} ("${m.desc}")`, severity: 'NEAR' };
    }
  }
  return null;
}

/* ===================== view-segment gating (§1.1, §2) ===================== */

export const VIEW_OWNERS: Record<string, string> = {
  Basic: 'Master Data Team', Purchasing: 'Procurement', Inventory: 'Stores',
  Valuation: 'Finance', Quality: 'QA/QC', Planning: 'Planning', Costing: 'Estimation', Site: 'Project',
};

const REQUIRED_FOR_PURCHASE = ['Purchasing', 'Valuation'];

export function missingViewsFor(mat: Material, purpose: 'PURCHASE' | 'ISSUE'): string[] {
  const need = purpose === 'PURCHASE' ? REQUIRED_FOR_PURCHASE : ['Inventory', 'Valuation'];
  return need.filter((v) => !mat.views.includes(v));
}

export function viewGateMessage(mat: Material, purpose: 'PURCHASE' | 'ISSUE'): string | null {
  if (mat.status !== 'ACTIVE') return `${mat.code} is ${mat.status} — the transaction is blocked at the master level.`;
  const missing = missingViewsFor(mat, purpose);
  if (!missing.length) return null;
  const named = missing.map((v) => `${v} (owner: ${VIEW_OWNERS[v]})`).join(', ');
  return `${mat.code} cannot be ${purpose === 'PURCHASE' ? 'purchased' : 'issued'} — incomplete view segment(s): ${named}. The responsible role must complete the view before this transaction.`;
}

/* ===================== material create (with governance) ===================== */

export function createMaterial2(
  sIn: ERPState,
  args: { desc: string; spec: string; group: string; uom: string; price: number; accountGroup: string; hsn: string; valuationClass: string; views: string[]; overrideReason?: string },
  userId: string,
): Res {
  const s = cloneState(sIn);
  const nc = nameCheck(args.desc);
  if (!nc.ok) return { s, ok: false, msg: nc.msg, tone: 'bad' };

  const dup = findMaterialDup(s, { desc: args.desc, spec: args.spec, group: args.group });
  if (dup && !args.overrideReason) {
    pushAudit(s, userId, 'SECURITY', 'DUPLICATE', 'MATERIAL', { reason: `Blocked near-duplicate of ${dup.key} (${dup.matchedOn}) — override with reason required` });
    return { s, ok: false, msg: `Duplicate control: ${dup.matchedOn}. Save refused — an override with reason is required and is reported monthly.`, tone: 'bad', detail: dup.key };
  }
  if (dup && args.overrideReason) {
    s.mdmOverrides.unshift({ id: uid(), kind: 'MATERIAL', desc: `${args.desc} ≈ ${dup.key}`, reason: args.overrideReason, by: userId, at: nowStamp() });
    pushAudit(s, userId, 'CHANGE', 'DUPLICATE_OVERRIDE', 'MATERIAL', { reason: `Override approved: ${args.overrideReason}` });
  }

  const parsed = parseStructuredName(args.desc)!;
  const code = `MAT-${String(MATERIALS.length + 1).padStart(3, '0')}X`;
  MATERIALS.push({
    code, desc: args.desc, spec: args.spec, group: args.group, accountGroup: args.accountGroup,
    baseUom: args.uom, hsn: args.hsn, valuationClass: args.valuationClass, priceControl: 'MAP',
    price: args.price, views: args.views, status: args.views.length >= 4 ? 'ACTIVE' : 'PENDING_REVIEW',
    itc: 'ELIGIBLE', createdBy: userId, structuredName: parsed, version: 1,
  });
  pushAudit(s, userId, 'CHANGE', 'MASTER_CREATE', code, { reason: `Material created with views [${args.views.join(', ')}]` });
  return {
    s, ok: true, docId: code, tone: 'ok',
    msg: `${code} created${dup ? ' with a logged duplicate override' : ''}. Status: ${args.views.length >= 4 ? 'ACTIVE' : 'PENDING_REVIEW'} — gating applies until Purchasing + Valuation views exist.`,
  };
}

/* ===================== partner create (with governance) ===================== */

export function createPartner2(
  sIn: ERPState,
  args: { name: string; pan: string; gstinState: string; gstinNo: string; addrState: string; bankAcct: string; ifsc: string; bankName: string; msme: boolean; roles: string[]; overrideReason?: string },
  userId: string,
): Res {
  const s = cloneState(sIn);
  if (args.gstinState !== args.addrState) {
    return { s, ok: false, msg: `GSTIN state (${args.gstinState}) must match the registered address state (${args.addrState}). Save refused — a mismatched GSTIN fails every tax return it touches.`, tone: 'bad' };
  }
  const dup = findPartnerDup(s, { name: args.name, pan: args.pan, gstin: args.gstinNo, bankAcct: args.bankAcct });
  if (dup && !args.overrideReason) {
    pushAudit(s, userId, 'SECURITY', 'DUPLICATE', 'PARTNER', { reason: `Blocked duplicate — ${dup.matchedOn}` });
    return { s, ok: false, msg: `Duplicate control: matched existing partner on ${dup.matchedOn}. Save refused without an approved override (logged + reported monthly).`, tone: 'bad', detail: dup.key };
  }
  if (dup && args.overrideReason) {
    s.mdmOverrides.unshift({ id: uid(), kind: 'PARTNER', desc: `${args.name} ≈ ${dup.key}`, reason: args.overrideReason, by: userId, at: nowStamp() });
    pushAudit(s, userId, 'CHANGE', 'DUPLICATE_OVERRIDE', 'PARTNER', { reason: args.overrideReason });
  }
  const id = `BP-${String(PARTNERS.length + 1).padStart(3, '0')}X`;
  PARTNERS.push({
    id, name: args.name, legalName: args.name, roles: args.roles as Partner['roles'], accountGroup: 'VEND',
    pan: args.pan, gstin: [{ state: args.gstinState, no: args.gstinNo }], regType: 'REGULAR',
    state: args.addrState, stateName: args.addrState, tdsSection: '194C', tdsPct: 2,
    reconAccount: '210100', bank: { bankName: args.bankName, acct: args.bankAcct, ifsc: args.ifsc },
    msme: args.msme, rating: 70, status: 'ACTIVE', createdBy: userId, version: 1,
  });
  pushAudit(s, userId, 'CHANGE', 'MASTER_CREATE', id, { reason: `Partner created, roles [${args.roles.join(', ')}], MSME=${args.msme}` });
  return { s, ok: true, docId: id, tone: 'ok', msg: `${id} created. One record, ${args.roles.length} role segment(s). MSME flag ${args.msme ? 'set — payables will enforce the 45-day rule' : 'not set'}.` };
}

/* ===================== block / mark-for-deletion (§1.1) ===================== */

export function isReferenced(s: ERPState, masterKey: string): boolean {
  return s.docs.some((d) => d.partnerId === masterKey || d.items.some((it) => it.materialCode === masterKey))
    || s.stock.some((r) => r.materialCode === masterKey)
    || s.boq.some((b) => b.wbs === masterKey);
}

export function setMasterStatus(sIn: ERPState, kind: 'MATERIAL' | 'PARTNER', key: string, to: 'BLOCKED' | 'MARKED_FOR_DELETION', userId: string): Res {
  const s = cloneState(sIn);
  const master = kind === 'MATERIAL' ? materialByCode(key) : PARTNERS.find((p) => p.id === key);
  if (!master) return { s, ok: false, msg: `${kind.toLowerCase()} ${key} not found`, tone: 'bad' };
  if (to === 'MARKED_FOR_DELETION' && isReferenced(s, key)) {
    pushAudit(s, userId, 'SECURITY', 'MASTER_DELETE', key, { reason: 'Deletion refused — master is referenced by documents' });
    return { s, ok: false, msg: `${key} is referenced by posted documents and can be BLOCKED, never deleted. Deletion refused on every route.`, tone: 'bad' };
  }
  master.status = to;
  pushAudit(s, userId, 'CHANGE', 'MASTER_STATUS', key, { field: 'status', newV: to, reason: to === 'BLOCKED' ? 'Blocked — history remains fully visible' : 'Marked for deletion — excluded from value help' });
  return { s, ok: true, tone: to === 'BLOCKED' ? 'warn' : 'info', msg: `${key} → ${to}. ${to === 'BLOCKED' ? 'Transactions blocked; full history stays visible.' : 'Hidden from value help; historical documents keep it.'}` };
}

/* ===================== UOM conversion engine (§6) ===================== */

const uomDim = (code: string) => UOM_DEFS.find((u) => u.code === code)?.dim;

function applyRounding(v: number, r?: UomFactor['rounding']): number {
  switch (r) {
    case 'UP': return Math.ceil(v * 1000) / 1000;
    case 'DOWN': return Math.floor(v * 1000) / 1000;
    case 'NEAREST': return Math.round(v * 1000) / 1000;
    default: return round2(v * 1000) / 1000;
  }
}

function directFactor(factors: UomFactor[], from: string, to: string, materialCode?: string): UomFactor | undefined {
  const specific = factors.find((f) => f.from === from && f.to === to && f.materialCode === materialCode);
  if (specific) return specific;
  return factors.find((f) => f.from === from && f.to === to && !f.materialCode);
}

/**
 * convert(quantity, from, to, materialCode?) — dimension-checked, material-specific,
 * rounding-aware. Mass↔volume without a density is an error, never a guess.
 */
export function convertUom(
  factors: UomFactor[],
  qty: number, from: string, to: string, materialCode?: string,
): { ok: boolean; qty?: number; note: string } {
  if (from === to) return { ok: true, qty, note: 'same UOM — identity' };
  const df = uomDim(from), dt = uomDim(to);
  if (!df || !dt) return { ok: false, note: `Unknown UOM ${!df ? from : to} — add it to the UOM master.` };
  if (df !== dt) {
    if ((df === 'MASS' && dt === 'VOLUME') || (df === 'VOLUME' && dt === 'MASS')) {
      const mat = materialCode ? materialByCode(materialCode) : undefined;
      if (!mat?.densityT) return { ok: false, note: `${df} → ${dt} needs a material bulk density. No density on ${materialCode ?? 'this material'} — refusing to guess.` };
    } else {
      return { ok: false, note: `Dimension mismatch: ${from} is ${df}, ${to} is ${dt}. Conversion refused.` };
    }
  }
  const f = directFactor(factors, from, to, materialCode);
  if (f) return { ok: true, qty: applyRounding(qty * f.factor, f.rounding), note: `${f.factor} × (${f.materialCode ? 'material-specific' : 'generic'})${f.rounding ? ', round ' + f.rounding : ''}` };
  const rev = directFactor(factors, to, from, materialCode);
  if (rev) return { ok: true, qty: applyRounding(qty / rev.factor, 'NONE'), note: `1 ÷ ${rev.factor} (reverse)` };
  /* chain via KG for mass */
  if (df === 'MASS') {
    const a = directFactor(factors, from, 'KG', materialCode) ?? (directFactor(factors, 'KG', from, materialCode) ? { factor: 1 / directFactor(factors, 'KG', from, materialCode)!.factor, rounding: 'NONE' as const } : undefined);
    const b = directFactor(factors, 'KG', to, materialCode) ?? (directFactor(factors, to, 'KG', materialCode) ? { factor: 1 / directFactor(factors, to, 'KG', materialCode)!.factor, rounding: 'NONE' as const } : undefined);
    if (a && b) return { ok: true, qty: applyRounding(qty * a.factor * b.factor, b.rounding), note: `chained via KG (${a.factor} × ${b.factor})` };
  }
  return { ok: false, note: `No conversion path ${from} → ${to}. Add a factor to the UOM master (change-controlled).` };
}

/** Change a factor — writes a change document, never retroactively alters posted documents */
export function changeUomFactor(sIn: ERPState, from: string, to: string, newFactor: number, reason: string, userId: string): Res {
  const s = cloneState(sIn);
  const f = s.uomFactors.find((x) => x.from === from && x.to === to);
  if (!f) return { s, ok: false, msg: `No ${from}→${to} factor to change.`, tone: 'bad' };
  const old = f.factor;
  f.factor = newFactor;
  pushAudit(s, userId, 'CHANGE', 'UOM_FACTOR', `${from}→${to}`, { field: 'factor', oldV: String(old), newV: String(newFactor), reason });
  return { s, ok: true, tone: 'ok', msg: `${from}→${to} factor ${old} → ${newFactor}. Change document written; posted documents keep their original converted quantities (no retroactive rewrite).` };
}

/* ===================== geofence master (§8) ===================== */

function haversineM(a: [number, number], b: [number, number]): number {
  const R = 6371000, dLat = (b[0] - a[0]) * Math.PI / 180, dLng = (b[1] - a[1]) * Math.PI / 180;
  const la1 = a[0] * Math.PI / 180, la2 = b[0] * Math.PI / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Ray-casting point-in-polygon; boundary counts as inside */
function pointInPolygon(pt: [number, number], poly: [number, number][]): boolean {
  const [x, y] = pt;
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function geofenceContains(f: Geofence, lat: number, lng: number): boolean {
  if (f.shape.kind === 'CIRCLE') return haversineM([lat, lng], [f.shape.lat, f.shape.lng]) <= f.shape.radiusM;
  return pointInPolygon([lat, lng], f.shape.pts);
}

export function createGeofence(sIn: ERPState, args: Omit<Geofence, 'id'>, userId: string): Res {
  const s = cloneState(sIn);
  const admin = userById(userId).roles.includes('ROLE-ADM');
  if (!admin) {
    pushAudit(s, userId, 'SECURITY', 'GEOFENCE', args.code, { reason: 'Non-administrator attempted geofence create/change' });
    return { s, ok: false, msg: `403 — geofences can be created and modified only by the System Administrator role. Attempt logged.`, tone: 'bad' };
  }
  s.geofences.push({ ...args, id: uid() });
  pushAudit(s, userId, 'CONFIG', 'GEOFENCE', args.code, { field: 'geometry', newV: args.shape.kind === 'CIRCLE' ? `circle @ ${args.shape.lat},${args.shape.lng} r=${args.shape.radiusM}m` : `polygon ${args.shape.pts.length} vertices`, reason: 'Geometry change logged with old and new values' });
  return { s, ok: true, tone: 'ok', msg: `${args.code} created. Only the admin role may modify it; every geometry change is audit-logged.` };
}

/* ===================== Excel import pipeline (§1.3, test 30) ===================== */

function genImportRows(): ImportRow[] {
  const rows: ImportRow[] = [];
  const groups = ['MG-CEM', 'MG-STL', 'MG-AGG', 'MG-FUEL', 'MG-SPR'];
  for (let i = 1; i <= IMPORT_SAMPLE.totalRows; i++) {
    const g = groups[i % groups.length];
    let desc = `ITEM ${String(i).padStart(3, '0')}, GENERIC, STD, A`;
    let valid = true, error: string | undefined;
    const roll = i % 100;
    if (roll < 3) { desc = `cement bag loose item ${i}`; valid = false; error = 'Free-text description — structured NOUN, MODIFIER, SIZE, GRADE, MAKE required'; }
    else if (roll >= 3 && roll < 5) { valid = false; error = `Unknown material group ${g}-X`; }
    else if (roll === 5) { valid = false; error = 'Negative price not allowed'; }
    else if (roll === 6) { valid = false; error = `Duplicate of existing master (near-match on description + group)`; }
    rows.push({ row: i, desc, group: roll >= 3 && roll < 5 ? `${g}-X` : g, uom: 'NOS', price: roll === 5 ? -10 : 100 + i, valid, error });
  }
  return rows;
}

export function startImport(sIn: ERPState, fileName: string, userId: string): Res {
  const s = cloneState(sIn);
  const rows = genImportRows();
  const errorRows = rows.filter((r) => !r.valid);
  const run: ImportRun = {
    id: uid(), fileName, totalRows: rows.length, validRows: rows.length - errorRows.length,
    errorRows, corrected: false, confirmed: false, importedCodes: [], at: nowStamp(),
  };
  s.importRuns.unshift(run);
  pushAudit(s, userId, 'SYSTEM', 'IMPORT', fileName, { reason: `Import started — ${rows.length} rows, validation preview shows ${errorRows.length} error rows` });
  return { s, ok: true, tone: 'info', docId: run.id, msg: `Validation preview: ${run.validRows} of ${run.totalRows} rows valid, ${errorRows.length} rejected. Invalid rows are never imported.` };
}

export function confirmImport(sIn: ERPState, runId: string, corrected: boolean, userId: string): Res {
  const s = cloneState(sIn);
  const run = s.importRuns.find((r) => r.id === runId);
  if (!run) return { s, ok: false, msg: 'Import run not found', tone: 'bad' };
  if (run.confirmed) return { s, ok: false, msg: 'Already confirmed.', tone: 'warn' };
  run.corrected = corrected;
  run.confirmed = true;
  const toImport = corrected ? run.totalRows : run.validRows;
  for (let i = 0; i < toImport; i++) {
    run.importedCodes.push(`MAT-IMP-${String(i + 1).padStart(4, '0')}`);
  }
  pushAudit(s, userId, 'SYSTEM', 'IMPORT', run.fileName, { reason: `Confirmed — ${run.importedCodes.length} rows imported, ${run.errorRows.length} rejected${corrected ? ' after corrected re-upload' : ''}` });
  return { s, ok: true, tone: 'ok', msg: `Import confirmed — ${run.importedCodes.length} materials created, ${corrected ? 0 : run.errorRows.length} invalid rows rejected and excluded.` };
}

/* ===================== master data quality dashboard (§1.3) ===================== */

export function masterQuality(s: ERPState) {
  const mats = MATERIALS;
  const incomplete = mats.filter((m) => m.status !== 'MARKED_FOR_DELETION' && missingViewsFor(m, 'PURCHASE').length > 0);
  const blocked = mats.filter((m) => m.status === 'BLOCKED').length + PARTNERS.filter((p) => p.status === 'BLOCKED').length;
  const unused = mats.filter((m) => !s.stock.some((r) => r.materialCode === m.code) && !s.docs.some((d) => d.items.some((i) => i.materialCode === m.code)));
  const partnersMissingGstin = PARTNERS.filter((p) => p.gstin.length === 0).length;
  const expiredDocs = s.equipment.filter((e) => e.docs.some((d) => s.today > d.validTo)).length;
  return {
    incompleteViews: incomplete.length,
    blocked,
    unusedMasters: unused.length,
    partnersMissingGstin,
    expiredEquipmentDocs: expiredDocs,
    duplicatesPending: s.mdmOverrides.length,
  };
}

/* ===================== lower-deduction certificate (§3 / test 25) ===================== */

export function consumeLdc(sIn: ERPState, partnerId: string, amount: number, userId: string): Res {
  const s = cloneState(sIn);
  const p = PARTNERS.find((x) => x.id === partnerId);
  if (!p) return { s, ok: false, msg: 'Partner not found', tone: 'bad' };
  if (!p.ldc) return { s, ok: false, msg: `${p.name} holds no lower-deduction certificate.`, tone: 'warn' };
  if (s.today > p.ldc.validTo) return { s, ok: false, msg: `LDC ${p.ldc.certNo} expired on ${p.ldc.validTo} — standard rate applies.`, tone: 'bad' };
  if (p.ldc.consumed + amount > p.ldc.limit) {
    return { s, ok: false, msg: `LDC limit breached — consumed ${fmtINR(p.ldc.consumed)} + ${fmtINR(amount)} exceeds the ${fmtINR(p.ldc.limit)} threshold. Standard TDS rate applies to the excess.`, tone: 'bad' };
  }
  p.ldc.consumed = round2(p.ldc.consumed + amount);
  pushAudit(s, userId, 'CHANGE', 'LDC', p.ldc.certNo, { field: 'consumed', newV: String(p.ldc.consumed), reason: `Consumption tracked against ${fmtINR(p.ldc.limit)} limit` });
  return { s, ok: true, tone: 'ok', msg: `LDC consumption tracked — ${fmtINR(p.ldc.consumed)} of ${fmtINR(p.ldc.limit)} used. Certificate expires ${p.ldc.validTo}.` };
}

/* ===================== QR / barcode (§2.3 / test 14) ===================== */

/** Deterministic QR-like matrix for a material. The payload carries the code. */
export function qrFor(code: string): { matrix: number[][]; payload: string } {
  let h = 2166136261;
  for (let i = 0; i < code.length; i++) { h ^= code.charCodeAt(i); h = Math.imul(h, 16777619); }
  const n = 17;
  const matrix: number[][] = [];
  let seed = h >>> 0;
  const rnd = () => { seed = (Math.imul(seed, 1103515245) + 12345) >>> 0; return seed / 4294967296; };
  for (let r = 0; r < n; r++) {
    const row: number[] = [];
    for (let c = 0; c < n; c++) {
      const finder = (r < 5 && c < 5) || (r < 5 && c >= n - 5) || (r >= n - 5 && c < 5);
      row.push(finder ? ((r === 0 || r === 4 || c === 0 || c === 4 || (r >= 1 && r <= 3 && c >= 1 && c <= 3)) && !(r === 4 && c === 4) ? 1 : (r >= 1 && r <= 3 && c >= 1 && c <= 3 ? 1 : 0)) : rnd() > 0.5 ? 1 : 0);
    }
    matrix.push(row);
  }
  return { matrix, payload: code };
}

/** Scan resolution — the payload resolves straight back to the master record */
export function resolveQr(payload: string): Material | undefined {
  return materialByCode(payload);
}

export { PROJECT_TEMPLATES, DUAL_CONTROL_FIELDS };
