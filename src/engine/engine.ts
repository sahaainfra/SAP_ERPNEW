import type {
  ERPState, Res, Doc, DocItem, JournalLine, PriceResult, PriceStep, MovementType,
  ReleaseState, StockType, ItemCategory, AuditCategory, PartnerRole,
} from './types';
import {
  COMPANIES, SITES, PROJECTS, COST_CENTRES, GL_ACCOUNTS, MATERIALS, PARTNERS,
  INFO_RECORDS, CONDITION_RECORDS, TAX_CODES, DOC_TYPES, MOVEMENT_TYPES,
  ACCOUNT_DETERMINATION, RELEASE_GROUPS, ROLES, USERS, CLOSING_STEPS_SEED,
  SOD_RULES, STATE_NAMES,
  SOURCE_LIST_SEED, QUOTA_SEED, RATE_CONTRACT_SEED, EQUIPMENT_SEED,
  UOM_FACTORS_SEED, GEOFENCE_SEED,
  CONTRACTS_SEED, BOQ_SEED, RATE_LIBRARY_SEED, ASSET_SEED, GUARANTEE_SEED,
  INSURANCE_SEED, DISPUTE_SEED, COMPLIANCE_SEED, MINWAGE_SEED,
} from './config';

/* ============================== utils ============================== */

export const uid = (): string =>
  Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);

const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

/* Public deep-clone so Part 2 service modules can snapshot state immutably */
export const cloneState = (s: ERPState): ERPState => clone(s);

export const round2 = (n: number): number => Math.round(n * 100) / 100;

export const fmtINR = (n: number): string =>
  '₹' + new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

export const fmtNum = (n: number, d = 2): string =>
  new Intl.NumberFormat('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d }).format(n);

export const fmtInt = (n: number): string => new Intl.NumberFormat('en-IN').format(Math.round(n));

export const todayISO = (): string => new Date().toISOString().slice(0, 10);

export const daysAgoISO = (n: number): string =>
  new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

export const daysAheadISO = (n: number): string =>
  new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

export const nowStamp = (): string => new Date().toISOString().replace('T', ' ').slice(0, 19);

export const fyOf = (iso: string): string => {
  const y = +iso.slice(0, 4);
  const m = +iso.slice(5, 7);
  return m >= 4 ? `${y % 100}-${String((y + 1) % 100).padStart(2, '0')}` : `${(y - 1) % 100}-${String(y % 100).padStart(2, '0')}`;
};

export const periodOf = (iso: string): number => ((+iso.slice(5, 7) + 8) % 12) + 1;

export const periodLabel = (iso: string): string => `P${periodOf(iso)} · FY ${fyOf(iso)}`;

/* ============================== lookups ============================== */

export const userById = (id: string) => USERS.find((u) => u.id === id)!;
export const siteById = (id: string) => SITES.find((s) => s.code === id);
export const companyById = (id: string) => COMPANIES.find((c) => c.code === id);
export const materialByCode = (code: string) => MATERIALS.find((m) => m.code === code);
export const partnerById = (id: string) => PARTNERS.find((p) => p.id === id);
export const projectOfWbs = (wbs: string) => PROJECTS.find((p) => p.wbs.some((w) => w.code === wbs));
export const glAccount = (code: string) => GL_ACCOUNTS.find((a) => a.code === code);
export const docById = (s: ERPState, id: string) => s.docs.find((d) => d.id === id);
export const docByNumber = (s: ERPState, num: string) => s.docs.find((d) => d.number === num);

/* ============================== audit ============================== */

export function pushAudit(
  s: ERPState, user: string, category: AuditCategory, object: string, key: string,
  extra?: { field?: string; oldV?: string; newV?: string; reason?: string; docId?: string },
): void {
  s.audit.unshift({ id: uid(), at: nowStamp(), user, category, object, key, ...extra });
  if (s.audit.length > 600) s.audit.length = 600;
}

/* ============================== authorization ============================== */

export interface AuthCtx { company?: string; purchasingGroup?: string; value?: number; site?: string; }

export function authorize(s: ERPState, userId: string, obj: string, activity: string, ctx: AuthCtx = {}): { ok: boolean; reason: string } {
  const user = USERS.find((u) => u.id === userId);
  if (!user) return fail(s, userId, obj, activity, 'Unknown user');
  for (const roleId of user.roles) {
    const role = ROLES.find((r) => r.id === roleId);
    if (!role) continue;
    for (const g of role.objects) {
      if (g.obj !== obj && g.obj !== '*') continue;
      if (!g.activities.includes(activity) && !g.activities.includes('*')) continue;
      if (g.fields) {
        let fieldOk = true;
        for (const [k, allowed] of Object.entries(g.fields)) {
          const val = k === 'PURCHASING_GROUP' ? ctx.purchasingGroup : k === 'SITE' ? ctx.site : undefined;
          if (val !== undefined && !allowed.includes(val) && !allowed.includes('*')) fieldOk = false;
        }
        if (!fieldOk) continue;
      }
      if (g.valueLimit !== undefined && ctx.value !== undefined && ctx.value > g.valueLimit) continue;
      return { ok: true, reason: '' };
    }
  }
  return fail(s, userId, obj, activity, `${user.name} holds no grant for ${obj} · activity ${activity}`);
}

function fail(s: ERPState, userId: string, obj: string, activity: string, reason: string) {
  s.authFailCount += 1;
  pushAudit(s, userId, 'SECURITY', 'AUTH_FAILURE', `${obj}/${activity}`, { reason, field: 'HTTP 403 — access refused at API layer' });
  return { ok: false, reason: `403 · ${reason}` };
}

/* ============================== numbering ============================== */

export function nextNumber(s: ERPState, object: string, companyId: string): string {
  const fy = fyOf(s.today);
  const key = `${object}|${companyId}|${fy}`;
  s.seq[key] = (s.seq[key] ?? 0) + 1;
  return `${companyId}-${object}/${fy}/${String(s.seq[key]).padStart(5, '0')}`;
}

export function rangeCurrent(s: ERPState, object: string, companyId: string): number {
  return s.seq[`${object}|${companyId}|${fyOf(s.today)}`] ?? 0;
}

/* ============================== period control ============================== */

export function checkPeriod(s: ERPState, companyId: string, area: 'FIN' | 'LOG', dateISO: string, userId: string, reason?: string): { ok: boolean; msg: string; soft?: boolean } {
  const st = s.periods[companyId]?.[area];
  if (!st) return { ok: true, msg: '' };
  const p = periodOf(dateISO);
  if (st.status === 'HARD_CLOSED') {
    pushAudit(s, userId, 'SECURITY', 'PERIOD', `${companyId} ${area} P${p}`, { reason: 'Posting into hard-closed period refused — no override exists' });
    return { ok: false, msg: `Period P${p} is hard-closed for ${companyId}/${area}. No posting by any user — reopening requires an audited document.` };
  }
  if (st.status === 'SOFT_CLOSED') {
    const auth = authorize(s, userId, 'FIN_PERIOD', '11', { company: companyId });
    if (!auth.ok) return { ok: false, msg: `Period P${p} is soft-closed. Adjustments need FIN_PERIOD_ADJUST authority (${auth.reason}).` };
    if (!reason || reason.trim().length < 4) return { ok: false, msg: 'Soft-closed period: a mandatory adjustment reason is required.' };
    return { ok: true, msg: '', soft: true };
  }
  return { ok: true, msg: '' };
}

/* ============================== budget & availability control (PRJ) ============================== */

export interface AvailabilityCheck {
  wbs: string;
  budget: number;
  assigned: number;
  availability: number;
  usagePct: number;
  action: 'PASS' | 'WARN' | 'WARN_NOTIFY' | 'BLOCK';
  note: string;
}

const CONSUMPTION_ACCOUNTS = ['410100', '410200', '420100', '420200', '440200', '440300'];

/** Assigned value = open requisitions + open POs (commitment) + actuals + reserved stock value. */
export function assignedValue(s: ERPState, wbs: string): { openPR: number; openPO: number; actual: number; reserved: number; total: number } {
  const openPR = s.docs
    .filter((d) => d.type.startsWith('PR') && (d.status === 'PENDING_RELEASE' || d.status === 'PARTIALLY_RELEASED' || d.status === 'RELEASED'))
    .reduce((t, d) => t + d.items.filter((i) => i.wbs === wbs).reduce((x, i) => x + i.qty * i.rate, 0), 0);
  const openPO = s.docs
    .filter((d) => d.type.startsWith('PO') && !['REJECTED', 'CANCELLED', 'REVERSED'].includes(d.status))
    .reduce((t, d) => t + d.items.filter((i) => i.wbs === wbs).reduce((x, i) => x + Math.max(0, i.qty - i.received) * i.rate, 0), 0);
  const actual = s.journals
    .filter((j) => j.status === 'POSTED')
    .reduce((t, j) => t + j.lines.filter((l) => l.wbs === wbs && CONSUMPTION_ACCOUNTS.includes(l.account)).reduce((x, l) => x + l.dr, 0), 0);
  const reserved = s.reservations
    .filter((r) => r.wbs === wbs && r.status === 'OPEN')
    .reduce((t, r) => t + r.qty * (materialByCode(r.materialCode)?.price ?? 0), 0);
  return { openPR: round2(openPR), openPO: round2(openPO), actual: round2(actual), reserved: round2(reserved), total: round2(openPR + openPO + actual + reserved) };
}

export function currentBudget(s: ERPState, wbs: string): number {
  const b = s.budgets[wbs];
  return b ? round2(b.org + b.sup - b.ret) : 0;
}

export function checkAvailability(s: ERPState, wbs: string, addAmount: number): AvailabilityCheck {
  const budget = currentBudget(s, wbs);
  const assigned = assignedValue(s, wbs).total;
  const withNew = round2(assigned + addAmount);
  const availability = round2(budget - withNew);
  const usagePct = budget > 0 ? round2((withNew / budget) * 100) : 0;

  if (budget === 0) {
    return { wbs, budget, assigned, availability, usagePct, action: 'PASS', note: 'No budget element maintained — availability control not applicable.' };
  }
  if (usagePct > 105) {
    return { wbs, budget, assigned, availability, usagePct, action: 'BLOCK', note: `Usage ${usagePct}% exceeds 105% — blocked until an approved budget supplement (BUD-SUP) raises the budget.` };
  }
  if (usagePct > 100) {
    return { wbs, budget, assigned, availability, usagePct, action: 'WARN_NOTIFY', note: `Usage ${usagePct}% over 100% — warning + notification to Project Manager & Commercial.` };
  }
  if (usagePct > 90) {
    return { wbs, budget, assigned, availability, usagePct, action: 'WARN', note: `Usage ${usagePct}% crossed 90% — warning to initiator.` };
  }
  return { wbs, budget, assigned, availability, usagePct, action: 'PASS', note: `Usage ${usagePct}% within tolerance.` };
}

/* ============================== account determination ============================== */

export function resolveAccount(event: string, vcOrModifier: string): { account: string; name: string } {
  const row = ACCOUNT_DETERMINATION[event] ?? {};
  const code = row[vcOrModifier] ?? row['*'] ?? '910100';
  const a = GL_ACCOUNTS.find((g) => g.code === code)!;
  return { account: code, name: a.name };
}

/* ============================== pricing / condition technique ============================== */

export interface PricingArgs {
  materialCode: string;
  qty: number;
  partnerId?: string;
  siteId: string;
  docDate: string;
  rateOverride?: number;
}

export function taxCodeFor(hsn: string, dateISO: string): { ratePct: number; code: string; validFrom: string; validTo?: string } | null {
  const candidates = TAX_CODES.filter((t) => hsn.startsWith(t.hsnPrefix));
  const active = candidates.filter((t) => t.validFrom <= dateISO && (!t.validTo || dateISO < t.validTo));
  return active.length ? active[0] : candidates[candidates.length - 1] ?? null;
}

export function determineTaxKind(vendorState: string, siteState: string): 'CGST+SGST' | 'IGST' | 'UTGS' {
  const UT = ['DL', 'CH', 'PY', 'LD', 'AN', 'JK'];
  if (vendorState !== siteState) return 'IGST';
  return UT.includes(siteState) ? 'UTGS' : 'CGST+SGST';
}

export function computePricing(s: ERPState, args: PricingArgs): PriceResult {
  const mat = materialByCode(args.materialCode)!;
  const site = siteById(args.siteId)!;
  const partner = args.partnerId ? partnerById(args.partnerId) : undefined;
  const steps: PriceStep[] = [];
  const cond = (type: string, key: string) =>
    CONDITION_RECORDS.find((c) => c.condType === type && c.key === key && c.validFrom <= args.docDate && (!c.validTo || args.docDate < c.validTo));

  /* 10 BASE — access sequence: info record → material last price (flagged) */
  const ir = partner ? INFO_RECORDS.find((r) => r.vendorId === partner.id && r.materialCode === mat.code && r.validFrom <= args.docDate) : undefined;
  const baseRate = args.rateOverride ?? ir?.rate ?? mat.price;
  const baseSource = args.rateOverride
    ? 'Manual rate (amendment)'
    : ir
      ? `Access 2 · Purchasing info record ${partner!.id}/${mat.code}`
      : 'Access 5 · Material last price — flagged';
  const baseVal = round2(baseRate * args.qty);
  steps.push({ step: 10, code: 'BASE', desc: 'Basic value', kind: 'COND', rate: baseRate, per: `/${mat.baseUom}`, value: baseVal, source: baseSource, acctKey: 'BSX' });

  /* 20 DISC */
  let discVal = 0;
  if (partner) {
    const d = cond('DISC', `${partner.id}|${mat.group}`);
    if (d) {
      discVal = -round2((baseVal * d.rate) / 100);
      steps.push({ step: 20, code: 'DISC', desc: `Discount ${d.rate}%`, kind: 'COND', rate: d.rate, per: '%', value: discVal, source: `Condition record ${d.key}`, acctKey: 'BSX' });
    }
  }
  const net = round2(baseVal + discVal);
  steps.push({ step: 30, code: 'NET0', desc: 'Net value', kind: 'SUBTOTAL', value: net });

  /* 40–70 landed cost loads */
  let landed = net;
  const loadCond = (step: number, code: string, desc: string, keys: (string | null)[]) => {
    for (const k of keys) {
      if (!k) continue;
      const c = cond(code, k);
      if (c) {
        const v = round2(c.per === 'PCT' ? (net * c.rate) / 100 : c.rate * args.qty);
        steps.push({ step, code, desc: `${desc} @ ${c.rate}${c.per === 'PCT' ? '%' : '/' + mat.baseUom}`, kind: 'COND', rate: c.rate, per: c.per, value: v, source: `Condition record ${c.key}`, acctKey: 'BSX' });
        landed = round2(landed + v);
        return;
      }
    }
  };
  loadCond(40, 'FRGT', 'Freight', partner ? [`${partner.id}|${mat.code}`] : []);
  loadCond(50, 'LDLF', `Lead & lift — ${site.city} slab (${site.distanceKm} km)`, [`SLAB|${site.state}`]);
  if (mat.royalty) loadCond(60, 'ROYL', 'Royalty / mineral cess', [`ROYL|${mat.group}`]);
  loadCond(70, 'LOAD', 'Loading / unloading', partner ? [partner.id] : []);
  steps.push({ step: 80, code: 'LND0', desc: 'Landed value before tax', kind: 'SUBTOTAL', value: landed });

  /* 90–110 GST — derived, never manual. Place of supply = site of immovable property */
  const tc = taxCodeFor(mat.hsn, args.docDate);
  const ratePct = tc?.ratePct ?? 18;
  const taxKind = partner ? determineTaxKind(partner.state, site.state) : 'NONE';
  const taxVal = round2((landed * ratePct) / 100);
  const itcBlocked = mat.itc === 'BLOCKED_IMMOVABLE' || mat.itc === 'INELIGIBLE';
  const taxNote = tc ? `Tax code ${tc.code} · effective ${tc.validFrom}${tc.validTo ? ' – ' + tc.validTo : ' onwards'} (rate by document date)` : '';
  if (partner && taxKind === 'CGST+SGST') {
    const half = round2(taxVal / 2);
    steps.push({ step: 90, code: 'CGST', desc: `CGST ${ratePct / 2}%`, kind: 'COND', rate: ratePct / 2, per: '%', value: half, source: taxNote, acctKey: 'ITC·CGST', stat: itcBlocked });
    steps.push({ step: 100, code: 'SGST', desc: `SGST ${ratePct / 2}%`, kind: 'COND', rate: ratePct / 2, per: '%', value: round2(taxVal - half), source: taxNote, acctKey: 'ITC·SGST', stat: itcBlocked });
  } else if (partner) {
    steps.push({ step: 110, code: taxKind === 'UTGS' ? 'UTGS' : 'IGST', desc: `${taxKind} ${ratePct}%`, kind: 'COND', rate: ratePct, per: '%', value: taxVal, source: taxNote, acctKey: 'ITC·IGST', stat: itcBlocked });
  }
  if (itcBlocked && partner) {
    landed = round2(landed + taxVal);
    steps.push({ step: 115, code: 'ITCB', desc: 'Blocked ITC loaded into cost (§17(5) — immovable)', kind: 'INFO', value: taxVal, stat: true });
  }
  const gross = partner ? round2(landed + (itcBlocked ? 0 : taxVal)) : landed;
  steps.push({ step: 120, code: 'GRS0', desc: 'Gross invoice value', kind: 'SUBTOTAL', value: gross });

  /* 130 TDS */
  let tds = 0;
  if (partner && partner.tdsPct > 0) {
    tds = round2((net * partner.tdsPct) / 100);
    steps.push({ step: 130, code: 'TDSI', desc: `TDS ${partner.tdsSection} @ ${partner.tdsPct}%`, kind: 'COND', rate: partner.tdsPct, per: '%', value: -tds, source: 'Partner master — TDS section', acctKey: 'TDS' });
  }

  /* 140 ROND */
  const grossR = Math.round(gross);
  const rond = round2(grossR - gross);
  if (rond !== 0) steps.push({ step: 140, code: 'ROND', desc: 'Rounding to ₹1', kind: 'COND', value: rond, source: 'Half-up, residual to rounding account', acctKey: 'RND' });
  const payable = round2(grossR - tds);
  steps.push({ step: 150, code: 'PAY0', desc: 'Net payable to vendor', kind: 'SUBTOTAL', value: payable });

  return {
    steps, baseRate, net, landed, taxPct: ratePct, taxKind, taxValue: taxVal, gross, tds,
    rounding: rond, payable, itcBlocked,
  };
}

/* ============================== release strategy ============================== */

export function determineStrategy(groupId: string, value: number) {
  const group = RELEASE_GROUPS.find((g) => g.id === groupId)!;
  const strat = [...group.strategies].sort((a, b) => a.max - b.max).find((st) => value <= st.max) ?? group.strategies[group.strategies.length - 1];
  const release: ReleaseState = {
    groupId, strategyId: strat.id, strategyName: strat.name,
    /* SLA per step — breached steps auto-escalate (see platform.escalateOverdue) */
    steps: strat.steps.map((st) => ({ code: st.code, title: st.title, role: st.role, valueLimit: st.valueLimit, status: 'PENDING' as const, slaHours: 48, slaDueAt: daysAheadISO(2) })),
    indicator: 'BLOCKED', resets: 0,
  };
  return release;
}

/* ============================== stock ============================== */

function stockRow(s: ERPState, siteId: string, locId: string, matCode: string, stockType: StockType, vtype?: string) {
  let r = s.stock.find((x) => x.siteId === siteId && x.locId === locId && x.materialCode === matCode && x.stockType === stockType && (x.vtype ?? '') === (vtype ?? ''));
  if (!r) {
    r = { siteId, locId, materialCode: matCode, stockType, qty: 0, value: 0, vtype: vtype || undefined };
    s.stock.push(r);
  }
  return r;
}

export const availableQty = (s: ERPState, siteId: string, locId: string, matCode: string, stockType: StockType): number =>
  s.stock.find((x) => x.siteId === siteId && x.locId === locId && x.materialCode === matCode && x.stockType === stockType)?.qty ?? 0;

export const unitCost = (s: ERPState, siteId: string, locId: string, matCode: string, stockType: StockType): number => {
  const r = s.stock.find((x) => x.siteId === siteId && x.locId === locId && x.materialCode === matCode && x.stockType === stockType);
  return r && r.qty > 0 ? r.value / r.qty : materialByCode(matCode)?.price ?? 0;
};

/* ============================== movement posting ============================== */

const MVT_DOC_TYPE: Record<string, string> = {
  '100': 'GR-PO', '101': 'GR-PO', '102': 'ST-LOC', '103': 'ST-LOC', '105': 'GR-PO', '110': 'GR-RTN',
  '120': 'GR-PO', '130': 'GR-PO', '200': 'GI-PRJ', '205': 'GI-CC', '210': 'GI-EAM', '215': 'GI-CC',
  '220': 'GR-RTN', '225': 'GR-RTN', '230': 'GI-PRJ', '235': 'GR-RTN', '240': 'SC-WOF',
  '300': 'ST-PLT', '301': 'ST-PLT', '310': 'ST-LOC', '320': 'ST-LOC', '400': 'ST-LOC',
  '410': 'GI-PRJ', '420': 'ST-LOC', '500': 'PI-ADJ', '510': 'PI-ADJ', '520': 'SC-WOF',
  '530': 'PI-ADJ', '600': 'GI-CC', '610': 'GR-RTN',
};

export interface MovementArgs {
  movementCode: string;
  materialCode: string;
  qty: number;
  siteId: string;
  locId: string;
  siteToId?: string;
  locToId?: string;
  wbs?: string;
  cc?: string;
  reason?: string;
  rate?: number;
  refDocId?: string;
  partnerId?: string;
  dateISO?: string;
  softReason?: string;
}

export interface MovementCheck { label: string; ok: boolean; note: string; }
export interface MovementPreview {
  checks: MovementCheck[];
  journal: JournalLine[];
  deltas: { siteId: string; locId: string; stockType: StockType; dq: number; dvalue: number }[];
  value: number;
  blocked: boolean;
  reason?: string;
}

function legsFor(mvt: MovementType, a: MovementArgs): { fromSite: string; fromLoc: string; fromType: StockType | null; toSite: string; toLoc: string; toType: StockType | null } {
  const from = mvt.from;
  const to = mvt.to;
  let fromSite = a.siteId, fromLoc = a.locId, toSite = a.siteId, toLoc = a.locToId ?? a.locId;
  if (mvt.code === '300') { toSite = a.siteToId ?? a.siteId; toLoc = 'TRN'; }
  if (mvt.code === '301') { fromLoc = a.locId || 'TRN'; toLoc = a.locToId ?? 'UNR'; }
  if (mvt.code === '400') { toLoc = 'SUB'; }
  if (mvt.code === '420') { fromLoc = a.locId || 'SUB'; toLoc = a.locToId ?? 'UNR'; }
  if (mvt.code === '230') { toLoc = 'RET'; }
  if (mvt.code === '235') { fromLoc = a.locId || 'RET'; toLoc = a.locToId ?? 'UNR'; }
  if (mvt.code === '240') { fromLoc = a.locId || 'RET'; }
  if (mvt.code === '102') { fromLoc = a.locId || 'QH'; toLoc = a.locToId ?? 'UNR'; }
  if (mvt.code === '103') { fromLoc = a.locId || 'QH'; toLoc = a.locToId ?? 'BLK'; }
  if (mvt.code === '520') { fromLoc = a.locId || 'BLK'; }
  return { fromSite, fromLoc, fromType: from, toSite, toLoc, toType: mvt.code === '530' ? null : to };
}

export function previewMovement(sIn: ERPState, a: MovementArgs, userId: string): MovementPreview {
  const s = clone(sIn);
  const checks: MovementCheck[] = [];
  const add = (label: string, ok: boolean, note: string) => checks.push({ label, ok, note });
  const mvt = MOVEMENT_TYPES.find((m) => m.code === a.movementCode);
  if (!mvt) return { checks: [{ label: 'Movement type', ok: false, note: 'Unknown code' }], journal: [], deltas: [], value: 0, blocked: true, reason: 'Unknown movement type' };

  const mat = materialByCode(a.materialCode);
  const site = siteById(a.siteId);
  add('Movement type exists', true, `${mvt.code} · ${mvt.desc}`);
  add('Material master active', !!mat && mat.status === 'ACTIVE', mat ? (mat.status === 'ACTIVE' ? mat.desc : `${mat.code} is ${mat.status} — history visible, posting blocked`) : 'Material not found');

  const auth = authorize(s, userId, mvt.authObject, '01', { company: site?.companyId, site: a.siteId });
  add('Authorization object', auth.ok, auth.ok ? `${mvt.authObject} · activity 01 · granted` : auth.reason);

  const legs = legsFor(mvt, a);
  /* required fields — exactly one primary cost object where demanded */
  let reqOk = true;
  const reqNotes: string[] = [];
  for (const r of mvt.required) {
    if (r === 'WBS' && !a.wbs) { reqOk = false; reqNotes.push('WBS element mandatory'); }
    if (r === 'CC' && !a.cc) { reqOk = false; reqNotes.push('Cost centre mandatory'); }
    if (r === 'PO' && !a.refDocId) { reqOk = false; reqNotes.push('Purchase order reference mandatory'); }
    if (r === 'REASON' && !(a.reason && a.reason.trim().length >= 4)) { reqOk = false; reqNotes.push('Reason mandatory (min 4 chars)'); }
    if (r === 'RATE' && !(a.rate && a.rate > 0)) { reqOk = false; reqNotes.push('Rate / amount mandatory'); }
    if (r === 'SITE_TO' && !a.siteToId) { reqOk = false; reqNotes.push('Receiving site mandatory'); }
    if (r === 'PARTNER' && !a.partnerId) { reqOk = false; reqNotes.push('Business partner mandatory'); }
  }
  if (mvt.required.includes('WBS') && a.cc) { reqOk = false; reqNotes.push('Two primary cost objects (WBS + CC) — rejected'); }
  if (mvt.required.includes('CC') && a.wbs) { reqOk = false; reqNotes.push('Two primary cost objects (WBS + CC) — rejected'); }
  add('Required fields / cost object', reqOk, reqOk ? (a.wbs ? `Cost object: WBS ${a.wbs}` : a.cc ? `Cost object: CC ${a.cc}` : 'None required') : reqNotes.join('; '));

  let wbsOk = true;
  if (a.wbs && site) {
    const prj = projectOfWbs(a.wbs);
    const cross = prj ? prj.companyId !== site.companyId : true;
    add('Company code integrity', !cross, cross ? `WBS belongs to ${prj?.companyId ?? '—'}; site to ${site.companyId} — cross-company draw refused` : `WBS ${a.wbs} and site ${a.siteId} both in ${site.companyId}`);
    if (cross) wbsOk = false;
    /* Rule: only a cost-object leaf accepts cost; summary nodes aggregate, never post */
    const node = s.wbsElements.find((w) => w.code === a.wbs);
    if (node) {
      const isLeaf = node.nodeType === 'WORK' && node.costObject;
      const statusOk = node.status === 'RELEASED' || node.status === 'TECH_COMPLETE';
      add('WBS cost-object & status rule', isLeaf && statusOk,
        !isLeaf ? `${a.wbs} is a ${node.nodeType} node — summary nodes aggregate; only cost-object leaves accept cost`
          : !statusOk ? `${a.wbs} is ${node.status} — CREATED/CLOSED nodes accept no cost`
          : `${a.wbs} is a released cost-object leaf — accepts cost`);
      if (!isLeaf || !statusOk) wbsOk = false;
    }
  }

  const dateISO = a.dateISO ?? s.today;
  const per = site ? checkPeriod(s, site.companyId, 'LOG', dateISO, userId, a.softReason) : { ok: true, msg: '', soft: false };
  add(`Posting period (logistics)`, per.ok, per.ok ? (per.soft ? `Soft-closed — adjustment with reason: "${a.softReason}"` : `${periodLabel(dateISO)} · OPEN`) : per.msg);

  /* stock availability — negative stock unreachable */
  let value = 0;
  const deltas: MovementPreview['deltas'] = [];
  let blocked = !mat || mat.status !== 'ACTIVE' || !auth.ok || !reqOk || !per.ok || !wbsOk;
  if (site && mat) {
    const uc = unitCost(s, legs.fromSite, legs.fromLoc, a.materialCode, legs.fromType ?? 'UNR');
    if (mvt.code === '530') {
      value = a.rate ?? 0;
      deltas.push({ siteId: a.siteId, locId: a.locId, stockType: 'UNR', dq: 0, dvalue: value });
    } else if (legs.fromType) {
      const avail = availableQty(s, legs.fromSite, legs.fromLoc, a.materialCode, legs.fromType);
      const need = a.qty;
      const ok = avail >= need - 1e-9;
      add('Stock availability (negative stock guard)', ok, ok ? `${fmtNum(avail, 3)} ${mat.baseUom} available in ${legs.fromType}` : `Only ${fmtNum(avail, 3)} ${mat.baseUom} on hand — issue of ${fmtNum(need, 3)} refused`);
      if (!ok) blocked = true;
      value = round2(a.qty * (legs.toType && mvt.valRel ? uc : uc));
      if (!legs.toType) value = round2(a.qty * uc);
      deltas.push({ siteId: legs.fromSite, locId: legs.fromLoc, stockType: legs.fromType, dq: -a.qty, dvalue: legs.toType ? 0 : -value });
      if (legs.toType) deltas.push({ siteId: legs.toSite, locId: legs.toLoc, stockType: legs.toType, dq: a.qty, dvalue: mvt.code === '300' || mvt.valRel ? value : 0 });
      if (mvt.code === '300') deltas[deltas.length - 2].dvalue = -value;
    } else {
      value = round2(a.qty * (a.rate ?? uc));
      deltas.push({ siteId: legs.toSite, locId: legs.toLoc, stockType: legs.toType ?? 'UNR', dq: a.qty, dvalue: value });
    }
  }

  /* journal via account determination */
  const journal: JournalLine[] = [];
  if (mvt.valRel && mvt.drEvent && mvt.crEvent && site && mat && !blocked) {
    const vc = mat.valuationClass;
    const dr = resolveAccount(mvt.drEvent, mvt.drEvent === 'CON' ? mvt.modifier : vc);
    const cr = resolveAccount(mvt.crEvent, mvt.crEvent === 'CON' ? mvt.modifier : vc);
    const v = Math.abs(value);
    journal.push({ account: dr.account, dr: v, cr: 0, text: `${mvt.desc} — ${mat.desc}`, wbs: a.wbs, cc: a.cc });
    journal.push({ account: cr.account, dr: 0, cr: v, text: `${mvt.desc} — ${mat.desc}`, wbs: a.wbs, cc: a.cc });
  }

  return { checks, journal, deltas, value: Math.abs(value), blocked, reason: blocked ? checks.find((c) => !c.ok)?.note : undefined };
}

export function postMovement(sIn: ERPState, a: MovementArgs, userId: string, opts?: { injectFailure?: boolean }): Res {
  const preview = previewMovement(sIn, a, userId);
  if (preview.blocked) {
    const s = clone(sIn);
    pushAudit(s, userId, 'SECURITY', 'MOVEMENT', a.movementCode, { reason: preview.reason ?? 'Validation failed' });
    return { s, ok: false, msg: preview.reason ?? 'Movement refused', tone: 'bad' };
  }

  const s = clone(sIn);
  const mvt = MOVEMENT_TYPES.find((m) => m.code === a.movementCode)!;
  const mat = materialByCode(a.materialCode)!;
  const site = siteById(a.siteId)!;
  const legs = legsFor(mvt, a);
  const dateISO = a.dateISO ?? s.today;

  /* stock leg */
  let value = preview.value;
  if (legs.fromType) {
    const from = stockRow(s, legs.fromSite, legs.fromLoc, a.materialCode, legs.fromType);
    const uc = from.qty > 0 ? from.value / from.qty : mat.price;
    if (mvt.code === '530') {
      from.value = round2(from.value + (a.rate ?? 0));
      value = Math.abs(a.rate ?? 0);
    } else {
      from.qty = round2(from.qty - a.qty);
      if (legs.toType) {
        const to = stockRow(s, legs.toSite, legs.toLoc, a.materialCode, legs.toType);
        to.qty = round2(to.qty + a.qty);
        to.value = round2(to.value + a.qty * uc);
        from.value = round2(from.value - a.qty * uc);
        value = round2(a.qty * uc);
      } else {
        from.value = round2(from.value - a.qty * uc);
        value = round2(a.qty * uc);
      }
    }
  } else if (legs.toType) {
    /* split valuation: client-issued material (130) is kept in its own valuation type */
    const vtype = mvt.code === '130' ? 'CI' : undefined;
    const to = stockRow(s, legs.toSite, legs.toLoc, a.materialCode, legs.toType, vtype);
    to.qty = round2(to.qty + a.qty);
    to.value = round2(to.value + value);
  }

  if (opts?.injectFailure) {
    pushAudit(s, userId, 'SYSTEM', 'ATOMICITY', `${mvt.code} · ${mat.code}`, { reason: 'Injected failure between stock write and accounting write — database transaction rolled back; neither leg persisted' });
    return { s, ok: false, msg: 'Injected failure mid-post — full rollback. Stock ledger and GL unchanged (atomicity verified).', tone: 'warn' };
  }

  /* material document */
  const docType = MVT_DOC_TYPE[mvt.code] ?? 'PI-ADJ';
  const number = nextNumber(s, 'MD', site.companyId);
  const id = uid();
  const per = checkPeriod(s, site.companyId, 'LOG', dateISO, userId, a.softReason);
  const doc: Doc = {
    id, number, type: docType, module: 'INV', companyId: site.companyId, siteId: a.siteId,
    partnerId: a.partnerId, dateISO, status: 'POSTED', createdBy: userId,
    items: [{
      line: 1, category: 'STD', materialCode: mat.code, desc: mat.desc, qty: a.qty, uom: mat.baseUom,
      rate: value / (a.qty || 1), siteId: a.siteId, locId: a.locId, received: 0, invoiced: 0,
      taxCode: '—', itc: 'ELIGIBLE', wbs: a.wbs, cc: a.cc,
    }],
    total: value, refId: a.refDocId, refNumber: a.refDocId ? docById(s, a.refDocId)?.number ?? undefined : undefined,
    movementCode: mvt.code, mvtValue: value, stockType: legs.toType ?? legs.fromType ?? undefined,
    locId: a.locId, locToId: a.locToId, siteToId: a.siteToId, wbs: a.wbs, cc: a.cc,
    reason: a.reason, softCloseAdjust: per.soft || undefined,
  };
  s.docs.unshift(doc);

  /* accounting document — same transaction */
  if (mvt.valRel && mvt.drEvent && mvt.crEvent) {
    const dr = resolveAccount(mvt.drEvent, mvt.drEvent === 'CON' ? mvt.modifier : mat.valuationClass);
    const cr = resolveAccount(mvt.crEvent, mvt.crEvent === 'CON' ? mvt.modifier : mat.valuationClass);
    /* split valuation: client-issued material books to the CI stock account (110160) */
    if (mvt.code === '130') dr.account = '110160';
    postJournal(s, {
      companyId: site.companyId, dateISO, refId: id, refNumber: number, createdBy: userId,
      softCloseAdjust: per.soft || undefined, reason: a.softReason,
      lines: [
        { account: dr.account, dr: value, cr: 0, text: `${mvt.code} ${mvt.desc} · ${mat.desc}`, wbs: a.wbs, cc: a.cc },
        { account: cr.account, dr: 0, cr: value, text: `${mvt.code} ${mvt.desc} · ${mat.desc}` },
      ],
    });
  }

  /* PO open quantity update */
  if ((mvt.code === '100' || mvt.code === '101') && a.refDocId) {
    const po = docById(s, a.refDocId);
    if (po) {
      const it = po.items.find((i) => i.materialCode === a.materialCode) ?? po.items[0];
      if (it) it.received = round2(it.received + a.qty);
      s.flow.push({ from: po.id, to: id });
    }
  }
  if (a.refDocId && !(mvt.code === '100' || mvt.code === '101')) s.flow.push({ from: a.refDocId, to: id });

  pushAudit(s, userId, 'POSTING', 'MATERIAL_DOC', number, { docId: id, reason: `Movement ${mvt.code} · ${fmtNum(a.qty, 3)} ${mat.baseUom} · ${fmtINR(value)}` });
  return { s, ok: true, msg: `${number} posted — movement ${mvt.code}${mvt.valRel ? ' with accounting document' : ''} (₹${fmtNum(value, 0)})`, tone: 'ok', docId: id };
}

/* ============================== journal ============================== */

interface JournalArgs {
  companyId: string;
  dateISO: string;
  lines: JournalLine[];
  refId: string;
  refNumber: string;
  createdBy: string;
  type?: string;
  softCloseAdjust?: boolean;
  reason?: string;
}

export function postJournal(s: ERPState, args: JournalArgs): string {
  const dr = args.lines.reduce((t, l) => round2(t + l.dr), 0);
  const cr = args.lines.reduce((t, l) => round2(t + l.cr), 0);
  if (Math.abs(dr - cr) > 0.01) throw new Error('Unbalanced journal refused');
  const number = nextNumber(s, 'AC', args.companyId);
  s.journals.unshift({
    id: uid(), number, companyId: args.companyId, dateISO: args.dateISO,
    fy: fyOf(args.dateISO), period: periodOf(args.dateISO), lines: args.lines,
    refId: args.refId, refNumber: args.refNumber, status: 'POSTED', createdBy: args.createdBy,
    softCloseAdjust: args.softCloseAdjust, reason: args.reason,
  });
  return number;
}

export function postManualJournal(sIn: ERPState, args: { companyId: string; dateISO: string; lines: JournalLine[]; reason: string; softReason?: string }, userId: string): Res {
  const s = clone(sIn);
  const auth = authorize(s, userId, 'FIN_DOC', '01', { company: args.companyId });
  if (!auth.ok) return { s, ok: false, msg: auth.reason, tone: 'bad' };
  const dr = args.lines.reduce((t, l) => round2(t + l.dr), 0);
  const cr = args.lines.reduce((t, l) => round2(t + l.cr), 0);
  if (Math.abs(dr - cr) > 0.01) {
    pushAudit(s, userId, 'SECURITY', 'JOURNAL', 'UNBALANCED', { reason: `Dr ${dr} ≠ Cr ${cr} — posting refused, nothing written` });
    return { s, ok: false, msg: `Unbalanced entry (Dr ${fmtINR(dr)} vs Cr ${fmtINR(cr)}) refused — full rollback.`, tone: 'bad' };
  }
  for (const l of args.lines) {
    const acc = glAccount(l.account);
    if (acc?.control) {
      pushAudit(s, userId, 'SECURITY', 'JOURNAL', l.account, { reason: `Manual posting into reconciliation account ${l.account} ${acc.name} refused — control accounts move only via sub-ledger` });
      return { s, ok: false, msg: `${l.account} ${acc.name} is a reconciliation (control) account — manual journals refused. It moves only through its sub-ledger.`, tone: 'bad' };
    }
  }
  const per = checkPeriod(s, args.companyId, 'FIN', args.dateISO, userId, args.softReason);
  if (!per.ok) return { s, ok: false, msg: per.msg, tone: 'bad' };
  const number = postJournal(s, { companyId: args.companyId, dateISO: args.dateISO, lines: args.lines, refId: 'MANUAL', refNumber: '—', createdBy: userId, softCloseAdjust: per.soft || undefined, reason: args.softReason ?? args.reason });
  pushAudit(s, userId, 'POSTING', 'JOURNAL', number, { reason: args.reason });
  return { s, ok: true, msg: `Journal ${number} posted — balanced, period-checked, control-account screened.`, tone: 'ok' };
}

/* ============================== requisitions ============================== */

export interface PRItemArgs { materialCode: string; qty: number; wbs?: string; cc?: string; category: ItemCategory; }

export function createPR(sIn: ERPState, args: { siteId: string; items: PRItemArgs[]; neededBy: string; note?: string; docType?: string; submit: boolean }, userId: string): Res {
  const s = clone(sIn);
  const site = siteById(args.siteId);
  if (!site) return { s, ok: false, msg: 'Unknown operating site', tone: 'bad' };
  const auth = authorize(s, userId, 'PRC_PR', '01', { company: site.companyId });
  if (!auth.ok) return { s, ok: false, msg: auth.reason, tone: 'bad' };

  let total = 0;
  const items: DocItem[] = [];
  for (const [i, it] of args.items.entries()) {
    const mat = materialByCode(it.materialCode);
    if (!mat) return { s, ok: false, msg: `Line ${i + 1}: unknown material ${it.materialCode}`, tone: 'bad' };
    if (mat.status !== 'ACTIVE') return { s, ok: false, msg: `${mat.code} is ${mat.status} — cannot be requisitioned (history stays visible).`, tone: 'bad' };
    const purchasable = mat.views.includes('Purchasing') && mat.views.includes('Valuation');
    if (!purchasable) return { s, ok: false, msg: `${mat.code} has only [${mat.views.join(', ')}] view(s). Purchasing + Valuation views are mandatory before procurement.`, tone: 'bad' };
    const hasW = !!it.wbs, hasC = !!it.cc;
    if (hasW === hasC) return { s, ok: false, msg: `Line ${i + 1}: every cost-bearing line needs exactly one primary cost object (WBS or cost centre) — ${hasW && hasC ? 'two given' : 'none given'}.`, tone: 'bad' };
    if (hasW) {
      const prj = projectOfWbs(it.wbs!);
      if (!prj || prj.companyId !== site.companyId) return { s, ok: false, msg: `Line ${i + 1}: WBS ${it.wbs} belongs to company ${prj?.companyId ?? '—'}; site ${site.code} to ${site.companyId}. Cross-company draw is a sale, not a requisition.`, tone: 'bad' };
    } else {
      const ccObj = COST_CENTRES.find((c) => c.code === it.cc);
      if (!ccObj || ccObj.companyId !== site.companyId) return { s, ok: false, msg: `Line ${i + 1}: cost centre ${it.cc} is not in company ${site.companyId}.`, tone: 'bad' };
    }
    total = round2(total + mat.price * it.qty);
    items.push({ line: i + 1, category: it.category, materialCode: mat.code, desc: mat.desc, qty: it.qty, uom: mat.baseUom, rate: mat.price, siteId: site.code, locId: 'UNR', wbs: it.wbs, cc: it.cc, received: 0, invoiced: 0, taxCode: '—', itc: mat.itc });
  }

  /* Budget availability control (PRJ) — enforced at submission for WBS-assigned lines */
  if (args.submit) {
    for (const it of items) {
      if (!it.wbs) continue;
      const av = checkAvailability(s, it.wbs, it.qty * it.rate);
      if (av.action === 'BLOCK') {
        pushAudit(s, userId, 'SECURITY', 'BUDGET_CONTROL', it.wbs, { reason: av.note });
        return { s, ok: false, msg: `Budget control · ${it.wbs}: ${av.note}`, tone: 'bad' };
      }
    }
  }

  const id = uid();
  if (!args.submit) {
    s.docs.unshift({ id, number: null, type: args.docType ?? 'PR-STD', module: 'PRC', companyId: site.companyId, siteId: site.code, dateISO: s.today, status: 'DRAFT', createdBy: userId, items, total, note: args.note });
    pushAudit(s, userId, 'SYSTEM', 'REQUISITION', 'DRAFT', { docId: id, reason: 'Draft saved — consumes no number range interval' });
    return { s, ok: true, msg: 'Draft saved. No document number consumed — ranges are drawn only on post.', tone: 'info', docId: id };
  }

  const number = nextNumber(s, 'PR', site.companyId);
  const release = determineStrategy('REL-PR', total);
  const doc: Doc = {
    id, number, type: args.docType ?? 'PR-STD', module: 'PRC', companyId: site.companyId, siteId: site.code,
    dateISO: s.today, status: 'PENDING_RELEASE', createdBy: userId, items, total, note: args.note, release,
  };
  s.docs.unshift(doc);
  pushAudit(s, userId, 'POSTING', 'REQUISITION', number, { docId: id, reason: `Submitted · strategy ${release.strategyName} determined on value ${fmtINR(total)}` });
  return { s, ok: true, msg: `${number} submitted — release strategy ${release.strategyName} determined.`, tone: 'ok', docId: id };
}

/* ============================== release (approval) ============================== */

export function approveDoc(sIn: ERPState, docId: string, action: 'APPROVE' | 'REJECT', comment: string, userId: string): Res {
  const s = clone(sIn);
  const doc = docById(s, docId);
  if (!doc || !doc.release) return { s, ok: false, msg: 'Document has no release strategy', tone: 'bad' };
  if (doc.release.indicator === 'RELEASED') return { s, ok: false, msg: 'Already fully released.', tone: 'warn' };
  if (doc.release.indicator === 'REJECTED') return { s, ok: false, msg: 'Rejected — amend and resubmit.', tone: 'warn' };
  const idx = doc.release.steps.findIndex((st) => st.status === 'PENDING');
  if (idx < 0) return { s, ok: false, msg: 'No pending step.', tone: 'warn' };
  const step = doc.release.steps[idx];
  const user = userById(userId);

  if (doc.createdBy === userId) {
    pushAudit(s, userId, 'SECURITY', 'RELEASE', doc.number ?? doc.id, { reason: 'Maker ≠ checker: initiator attempted to approve own document' });
    return { s, ok: false, msg: `Maker ≠ checker is absolute — ${user.name} initiated this document and cannot release it at any step.`, tone: 'bad' };
  }
  if (!user.roles.includes(step.role) && !user.roles.includes('ROLE-ADM')) {
    pushAudit(s, userId, 'SECURITY', 'RELEASE', doc.number ?? doc.id, { reason: `Release step ${step.code} requires ${step.role}` });
    return { s, ok: false, msg: `403 · Step ${step.code} requires role ${step.role} (held by ${step.title}).`, tone: 'bad' };
  }
  if (doc.total > step.valueLimit) return { s, ok: false, msg: `Value ${fmtINR(doc.total)} exceeds ${step.title}'s limit ${fmtINR(step.valueLimit)}.`, tone: 'bad' };
  if (action === 'REJECT' && comment.trim().length < 4) return { s, ok: false, msg: 'Rejection requires a comment (min 4 characters).', tone: 'bad' };

  if (action === 'REJECT') {
    step.status = 'REJECTED';
    step.by = userId;
    step.at = nowStamp();
    step.comment = comment;
    doc.release.indicator = 'REJECTED';
    doc.status = 'REJECTED';
    pushAudit(s, userId, 'CHANGE', 'RELEASE', doc.number!, { docId: doc.id, field: `step ${step.code}`, newV: 'REJECTED', reason: comment });
    return { s, ok: true, msg: `${doc.number} rejected at ${step.code} — ${step.title}.`, tone: 'warn', docId: doc.id };
  }

  step.status = 'APPROVED';
  step.by = userId;
  step.at = nowStamp();
  step.comment = comment || undefined;
  step.snapshot = { total: doc.total, at: nowStamp(), by: userId };
  doc.snapshots = doc.snapshots ?? [];
  doc.snapshots.push({ at: nowStamp(), by: userId, total: doc.total, step: step.code });
  const remaining = doc.release.steps.filter((st) => st.status === 'PENDING').length;
  if (remaining === 0) {
    doc.release.indicator = 'RELEASED';
    doc.status = 'RELEASED';
    pushAudit(s, userId, 'POSTING', 'RELEASE', doc.number!, { docId: doc.id, reason: `Fully released — approved snapshot v${doc.snapshots.length} archived` });
    return { s, ok: true, msg: `${doc.number} fully released. Snapshot v${doc.snapshots.length} archived — "what was approved" is answerable.`, tone: 'ok', docId: doc.id };
  }
  doc.release.indicator = 'PARTIALLY_RELEASED';
  doc.status = 'PARTIALLY_RELEASED';
  pushAudit(s, userId, 'CHANGE', 'RELEASE', doc.number!, { docId: doc.id, field: `step ${step.code}`, newV: 'APPROVED', reason: `Snapshot v${doc.snapshots.length} of ${fmtINR(doc.total)} archived` });
  return { s, ok: true, msg: `${step.title} approved ${doc.number} (snapshot archived). Next: ${doc.release.steps[idx + 1]?.title}.`, tone: 'ok', docId: doc.id };
}

/* ============================== purchase order ============================== */

export function createPOFromPR(sIn: ERPState, prId: string, args: { partnerId: string; deliveryDate: string }, userId: string): Res {
  const s = clone(sIn);
  const pr = docById(s, prId);
  if (!pr) return { s, ok: false, msg: 'Requisition not found', tone: 'bad' };
  if (pr.status !== 'RELEASED') return { s, ok: false, msg: `PR is ${pr.status} — only fully released requisitions convert.`, tone: 'bad' };
  if (s.flow.some((f) => f.from === pr.id && docById(s, f.to)?.type.startsWith('PO'))) return { s, ok: false, msg: 'This PR is already converted — document flow prevents double ordering.', tone: 'bad' };
  const auth = authorize(s, userId, 'PRC_PO', '01', { company: pr.companyId });
  if (!auth.ok) return { s, ok: false, msg: auth.reason, tone: 'bad' };
  const vendor = partnerById(args.partnerId);
  if (!vendor || !vendor.roles.includes('VENDOR')) return { s, ok: false, msg: 'Selected partner has no VENDOR role.', tone: 'bad' };
  if (s.freeze[vendor.id]) return { s, ok: false, msg: `${vendor.name} is under payment freeze until ${s.freeze[vendor.id]} (bank-detail change control).`, tone: 'warn' };

  /* price the first item through the condition technique (single-item POs in this demo) */
  const it0 = pr.items[0];
  const price = computePricing(s, { materialCode: it0.materialCode, qty: pr.items.reduce((t, i) => t + i.qty, 0), partnerId: vendor.id, siteId: pr.siteId!, docDate: s.today });
  const totalQty = pr.items.reduce((t, i) => t + i.qty, 0);
  const items: DocItem[] = pr.items.map((i) => ({ ...clone(i), rate: price.baseRate, received: 0, invoiced: 0 }));

  const id = uid();
  const number = nextNumber(s, 'PO', pr.companyId);
  const release = determineStrategy('REL-PO', price.payable);
  const doc: Doc = {
    id, number, type: it0.category === 'SVC' ? 'PO-SVC' : 'PO-STD', module: 'PRC', companyId: pr.companyId,
    siteId: pr.siteId, partnerId: vendor.id, dateISO: s.today, status: 'PENDING_RELEASE', createdBy: userId,
    items, total: price.payable, refId: pr.id, refNumber: pr.number ?? undefined, release, price,
    note: `Delivery ${args.deliveryDate} · sourcing ${price.steps[0].source}`,
  };
  s.docs.unshift(doc);
  s.flow.push({ from: pr.id, to: id });
  pr.status = 'CONVERTED';
  pushAudit(s, userId, 'POSTING', 'PURCHASE_ORDER', number, { docId: id, reason: `Created with reference to ${pr.number} — copy rules applied; strategy ${release.strategyName}` });
  return { s, ok: true, msg: `${number} created from ${pr.number} — conditions re-derived, strategy ${release.strategyName}.`, tone: 'ok', docId: id };
}

export function amendItemRate(sIn: ERPState, poId: string, newRate: number, reason: string, userId: string): Res {
  const s = clone(sIn);
  const po = docById(s, poId);
  if (!po) return { s, ok: false, msg: 'PO not found', tone: 'bad' };
  const auth = authorize(s, userId, 'PRC_PO', '02', { company: po.companyId });
  if (!auth.ok) return { s, ok: false, msg: auth.reason, tone: 'bad' };
  if (reason.trim().length < 4) return { s, ok: false, msg: 'PO amendment requires a reason (min 4 chars) — it is a reason-mandatory event.', tone: 'bad' };
  if (po.items.some((i) => i.received > 0)) return { s, ok: false, msg: 'Goods already received against this PO — amend via a change order, not rate edit.', tone: 'bad' };
  const it = po.items[0];
  const oldRate = it.rate;
  const oldTotal = po.total;
  it.rate = newRate;
  const qty = po.items.reduce((t, i) => t + i.qty, 0);
  const price = computePricing(s, { materialCode: it.materialCode, qty, partnerId: po.partnerId, siteId: po.siteId!, docDate: s.today, rateOverride: newRate });
  po.price = price;
  po.total = price.payable;
  po.note = `Amended: rate ${fmtNum(oldRate, 2)} → ${fmtNum(newRate, 2)} · ${reason}`;

  let resetMsg = '';
  if (po.release && po.release.indicator !== 'REJECTED' && po.release.steps.some((st) => st.status !== 'PENDING')) {
    po.release = { ...determineStrategy('REL-PO', po.total), resets: po.release.resets + 1 };
    po.status = 'PENDING_RELEASE';
    resetMsg = ' Release strategy reset to step 1 (value-relevant change) — reset logged.';
  }
  pushAudit(s, userId, 'CHANGE', 'PURCHASE_ORDER', po.number!, { docId: po.id, field: 'items[1].rate', oldV: String(oldRate), newV: String(newRate), reason });
  pushAudit(s, userId, 'CHANGE', 'PURCHASE_ORDER', po.number!, { docId: po.id, field: 'total', oldV: String(oldTotal), newV: String(po.total), reason });
  return { s, ok: true, msg: `Rate amended with reason.${resetMsg}`, tone: 'ok', docId: po.id };
}

/* ============================== goods receipt vs PO ============================== */

export function postGR(sIn: ERPState, poId: string, args: { qty: number; locId?: string; toQuality?: boolean; dateISO?: string }, userId: string): Res {
  const s0 = clone(sIn);
  const po = docById(s0, poId);
  if (!po) return { s: s0, ok: false, msg: 'PO not found', tone: 'bad' };
  if (po.status !== 'RELEASED' && po.status !== 'POSTED') return { s: s0, ok: false, msg: `PO is ${po.status} — unreleased documents cannot receive goods.`, tone: 'bad' };
  const it = po.items[0];
  const already = it.received;
  const tol = 0.05;
  if (already + args.qty > it.qty * (1 + tol) + 1e-9) {
    pushAudit(s0, userId, 'SECURITY', 'GOODS_RECEIPT', po.number!, { reason: `GR beyond tolerance: received ${already} + ${args.qty} > ordered ${it.qty} +5%` });
    return { s: s0, ok: false, msg: `Goods receipt blocked: ${fmtNum(already + args.qty, 1)} would exceed ordered ${fmtNum(it.qty, 1)} + 5% over-delivery tolerance.`, tone: 'bad' };
  }
  return postMovement(sIn, {
    movementCode: args.toQuality ? '101' : '100',
    materialCode: it.materialCode, qty: args.qty, siteId: po.siteId!, locId: args.locId ?? 'UNR',
    rate: it.rate, refDocId: poId, dateISO: args.dateISO,
  }, userId);
}

/* ============================== invoice receipt ============================== */

export function postInvoice(sIn: ERPState, poId: string, args: { vendorInvoiceNo: string; qty?: number; dateISO?: string; softReason?: string }, userId: string): Res {
  const s = clone(sIn);
  const po = docById(s, poId);
  if (!po) return { s, ok: false, msg: 'PO not found', tone: 'bad' };
  const auth = authorize(s, userId, 'FIN_DOC', '01', { company: po.companyId });
  if (!auth.ok) return { s, ok: false, msg: auth.reason, tone: 'bad' };
  const it = po.items[0];
  const isSvc = it.category === 'SVC';
  const invQty = args.qty ?? (isSvc ? it.qty : it.received);
  if (!isSvc && invQty > it.received - it.invoiced + 1e-9) {
    pushAudit(s, userId, 'SECURITY', 'INVOICE', po.number!, { reason: `Invoice qty ${invQty} exceeds received ${it.received} (three-way match)` });
    return { s, ok: false, msg: `Invoice blocked: quantity ${fmtNum(invQty, 1)} exceeds received-not-invoiced ${fmtNum(it.received - it.invoiced, 1)} (three-way match).`, tone: 'bad' };
  }
  const dateISO = args.dateISO ?? s.today;
  const per = checkPeriod(s, po.companyId, 'FIN', dateISO, userId, args.softReason);
  if (!per.ok) return { s, ok: false, msg: per.msg, tone: 'bad' };

  const price = computePricing(s, { materialCode: it.materialCode, qty: invQty, partnerId: po.partnerId, siteId: po.siteId!, docDate: dateISO, rateOverride: it.rate });
  const id = uid();
  const number = nextNumber(s, 'IV', po.companyId);
  it.invoiced = round2(it.invoiced + invQty);

  const lines: JournalLine[] = [];
  const grirDr = round2(invQty * it.rate); // exactly what the goods receipt credited
  const taxDr = price.itcBlocked ? 0 : price.taxValue;
  if (isSvc || it.category === 'CNS') {
    const exp = resolveAccount('CON', it.wbs ? 'PRJ' : 'CC');
    lines.push({ account: exp.account, dr: round2(price.landed + price.rounding), cr: 0, text: `Expense — ${it.desc}`, wbs: it.wbs, cc: it.cc });
  } else {
    lines.push({ account: '110300', dr: grirDr, cr: 0, text: `GR/IR clearing — ${it.desc}` });
    /* discount and landed-cost loads settle as price difference vs the base-rate receipt */
    const pd = round2(price.landed - grirDr + (price.itcBlocked ? price.taxValue : 0) + price.rounding);
    if (pd !== 0) lines.push({ account: '440100', dr: pd > 0 ? pd : 0, cr: pd < 0 ? -pd : 0, text: 'Price difference — conditions vs receipt valuation' });
  }
  if (taxDr > 0 && po.partnerId) {
    if (price.taxKind === 'CGST+SGST') {
      const half = round2(taxDr / 2);
      lines.push({ account: '130100', dr: half, cr: 0, text: `Input CGST ${price.taxPct / 2}%` });
      lines.push({ account: '130200', dr: round2(taxDr - half), cr: 0, text: `Input SGST ${price.taxPct / 2}%` });
    } else {
      lines.push({ account: '130300', dr: taxDr, cr: 0, text: `Input ${price.taxKind} ${price.taxPct}%` });
    }
  }
  const vendor = partnerById(po.partnerId!)!;
  lines.push({ account: vendor.reconAccount, dr: 0, cr: round2(price.gross + price.rounding - price.tds), text: `Payable — ${vendor.name} · inv ${args.vendorInvoiceNo}` });
  if (price.tds > 0) lines.push({ account: '121000', dr: 0, cr: price.tds, text: `TDS ${vendor.tdsSection}` });

  postJournal(s, { companyId: po.companyId, dateISO, lines, refId: id, refNumber: number, createdBy: userId, softCloseAdjust: per.soft || undefined, reason: args.softReason });
  const doc: Doc = {
    id, number, type: 'IV-VEN', module: 'FIN', companyId: po.companyId, siteId: po.siteId, partnerId: po.partnerId,
    dateISO, status: 'POSTED', createdBy: userId,
    items: [{ ...clone(it), qty: invQty, received: it.received, invoiced: it.invoiced }],
    total: price.payable, refId: po.id, refNumber: po.number ?? undefined, price,
    note: `Vendor invoice ${args.vendorInvoiceNo}`,
  };
  s.docs.unshift(doc);
  s.flow.push({ from: po.id, to: id });
  po.status = 'POSTED';
  pushAudit(s, userId, 'POSTING', 'INVOICE', number, { docId: id, reason: `Three-way match OK · gross ${fmtINR(price.gross)} · payable ${fmtINR(price.payable)}` });
  return { s, ok: true, msg: `${number} posted — vendor payable ${fmtINR(price.payable)}, ${price.taxKind} derived automatically.`, tone: 'ok', docId: id };
}

export function postPayment(sIn: ERPState, invoiceId: string, userId: string): Res {
  const s = clone(sIn);
  const inv = docById(s, invoiceId);
  if (!inv || inv.type !== 'IV-VEN') return { s, ok: false, msg: 'Vendor invoice not found', tone: 'bad' };
  const auth = authorize(s, userId, 'FIN_DOC', '01', { company: inv.companyId });
  if (!auth.ok) return { s, ok: false, msg: auth.reason, tone: 'bad' };
  if (s.freeze[inv.partnerId!]) return { s, ok: false, msg: `Payment blocked — ${partnerById(inv.partnerId!)?.name} is under bank-change payment freeze until ${s.freeze[inv.partnerId!]}.`, tone: 'bad' };
  const vendor = partnerById(inv.partnerId!)!;
  const per = checkPeriod(s, inv.companyId, 'FIN', s.today, userId);
  if (!per.ok) return { s, ok: false, msg: per.msg, tone: 'bad' };
  const id = uid();
  const number = nextNumber(s, 'PV', inv.companyId);
  postJournal(s, {
    companyId: inv.companyId, dateISO: s.today, refId: id, refNumber: number, createdBy: userId,
    lines: [
      { account: vendor.reconAccount, dr: inv.total, cr: 0, text: `Payment vs ${inv.refNumber ?? ''} — ${vendor.name}` },
      { account: '140100', dr: 0, cr: inv.total, text: 'Bank — corporate account' },
    ],
  });
  s.docs.unshift({ id, number, type: 'PV-VEN', module: 'FIN', companyId: inv.companyId, partnerId: inv.partnerId, dateISO: s.today, status: 'POSTED', createdBy: userId, items: [], total: inv.total, refId: inv.id, refNumber: inv.number ?? undefined });
  s.flow.push({ from: inv.id, to: id });
  pushAudit(s, userId, 'POSTING', 'PAYMENT', number, { docId: id, reason: `Outgoing payment ${fmtINR(inv.total)} to ${vendor.name}` });
  return { s, ok: true, msg: `${number} paid ${fmtINR(inv.total)} to ${vendor.name}.`, tone: 'ok', docId: id };
}

/* ============================== reversal ============================== */

export function reverseMovement(sIn: ERPState, mdId: string, reason: string, userId: string): Res {
  const s = clone(sIn);
  const md = docById(s, mdId);
  if (!md || !md.movementCode) return { s, ok: false, msg: 'Material document not found', tone: 'bad' };
  if (md.status === 'REVERSED') return { s, ok: false, msg: 'Already reversed — documents are never deleted, only mirrored.', tone: 'warn' };
  const mvt = MOVEMENT_TYPES.find((m) => m.code === md.movementCode)!;
  if (['300', '301', '310', '320', '400', '420', '230', '235'].includes(mvt.code)) {
    return { s, ok: false, msg: `Movement ${mvt.code} is a transfer — it is closed by posting the paired counter-leg (e.g. ${mvt.reversal}), never by reversal.`, tone: 'warn' };
  }
  const revCode = mvt.reversal;
  const res = postMovement(s, {
    movementCode: revCode, materialCode: md.items[0].materialCode, qty: md.items[0].qty,
    siteId: md.siteId!, locId: md.locId ?? 'UNR', siteToId: md.siteToId, locToId: md.locToId,
    wbs: md.wbs, cc: md.cc, reason: `Reversal of ${md.number}: ${reason}`, rate: md.items[0].rate,
    refDocId: md.refId, partnerId: md.partnerId,
  }, userId);
  if (res.ok) {
    md.status = 'REVERSED';
    const revDoc = docById(res.s, res.docId!);
    if (revDoc) {
      revDoc.reversalOf = md.id;
      res.s.flow.push({ from: md.id, to: revDoc.id });
    }
    md.reversedBy = res.docId;
    pushAudit(res.s, userId, 'POSTING', 'REVERSAL', md.number!, { docId: md.id, reason: `Mirrored by ${revDoc?.number} via movement ${revCode}` });
  }
  return res;
}

/* ============================== master data ============================== */

function nameSimilar(a: string, b: string): boolean {
  const x = a.toLowerCase().replace(/[^a-z0-9]/g, '');
  const y = b.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (x === y) return true;
  const short = x.length < y.length ? x : y;
  const long = x.length < y.length ? y : x;
  return short.length > 5 && long.includes(short.slice(0, Math.floor(short.length * 0.7)));
}

export function createMaterial(sIn: ERPState, args: { code: string; desc: string; group: string; baseUom: string; hsn: string; valuationClass: string; priceControl: 'MAP' | 'STD'; price: number; withPurchasing: boolean; withValuation: boolean }, userId: string): Res {
  const s = clone(sIn);
  const auth = authorize(s, userId, 'ORG_MDM', '01');
  if (!auth.ok) return { s, ok: false, msg: auth.reason, tone: 'bad' };
  if (materialByCode(args.code)) return { s, ok: false, msg: `Material ${args.code} already exists.`, tone: 'bad' };
  const nearDup = MATERIALS.find((m) => m.group === args.group && nameSimilar(m.desc, args.desc));
  if (nearDup) {
    pushAudit(s, userId, 'SECURITY', 'MATERIAL', args.code, { reason: `Near-duplicate of ${nearDup.code} ${nearDup.desc} blocked — needs approved override` });
    return { s, ok: false, msg: `Fuzzy duplicate check: "${args.desc}" ≈ ${nearDup.code} "${nearDup.desc}" (same group). Blocked without an approved override.`, tone: 'bad' };
  }
  const views = ['Basic', ...(args.withPurchasing ? ['Purchasing'] : []), ...(args.withValuation ? ['Valuation'] : []), 'Inventory'];
  MATERIALS.push({ code: args.code, desc: args.desc, spec: '—', group: args.group, accountGroup: 'RAWM', baseUom: args.baseUom, hsn: args.hsn, valuationClass: args.valuationClass, priceControl: args.priceControl, price: args.price, views, status: 'PENDING', itc: 'ELIGIBLE', createdBy: userId });
  pushAudit(s, userId, 'CHANGE', 'MATERIAL', args.code, { field: 'status', newV: 'PENDING', reason: `Created with views [${views.join(', ')}] — governance: Create → Review → Approve → Active` });
  return { s, ok: true, msg: `${args.code} created in PENDING — activates after master-data approval. ${views.includes('Purchasing') && views.includes('Valuation') ? '' : 'Without Purchasing + Valuation views it cannot be bought.'}`, tone: 'ok' };
}

export function approveMaster(sIn: ERPState, code: string, kind: 'material' | 'partner', userId: string): Res {
  const s = clone(sIn);
  const auth = authorize(s, userId, 'ORG_MDM', '02');
  if (!auth.ok) return { s, ok: false, msg: auth.reason, tone: 'bad' };
  if (kind === 'material') {
    const m = MATERIALS.find((x) => x.code === code);
    if (!m) return { s, ok: false, msg: 'Material not found', tone: 'bad' };
    if (m.createdBy === userId) return { s, ok: false, msg: 'Maker ≠ checker: the creator cannot approve their own master record.', tone: 'bad' };
    m.status = 'ACTIVE';
    pushAudit(s, userId, 'CHANGE', 'MATERIAL', code, { field: 'status', oldV: 'PENDING', newV: 'ACTIVE', reason: 'Governance approval' });
    return { s, ok: true, msg: `${code} approved → ACTIVE.`, tone: 'ok' };
  }
  const p = PARTNERS.find((x) => x.id === code);
  if (!p) return { s, ok: false, msg: 'Partner not found', tone: 'bad' };
  if (p.createdBy === userId) return { s, ok: false, msg: 'Maker ≠ checker: the creator cannot approve their own master record.', tone: 'bad' };
  p.status = 'ACTIVE';
  pushAudit(s, userId, 'CHANGE', 'PARTNER', code, { field: 'status', oldV: 'PENDING', newV: 'ACTIVE', reason: 'Governance approval' });
  return { s, ok: true, msg: `${code} approved → ACTIVE.`, tone: 'ok' };
}

export function blockMaster(sIn: ERPState, code: string, kind: 'material' | 'partner', reason: string, userId: string): Res {
  const s = clone(sIn);
  const auth = authorize(s, userId, 'ORG_MDM', '02');
  if (!auth.ok) return { s, ok: false, msg: auth.reason, tone: 'bad' };
  const list = kind === 'material' ? MATERIALS : PARTNERS;
  const rec = list.find((x) => (kind === 'material' ? (x as unknown as { code: string }).code : (x as { id: string }).id) === code) as { status: string } | undefined;
  if (!rec) return { s, ok: false, msg: 'Record not found', tone: 'bad' };
  const old = rec.status;
  rec.status = rec.status === 'BLOCKED' ? 'ACTIVE' : 'BLOCKED';
  pushAudit(s, userId, 'CHANGE', kind.toUpperCase(), code, { field: 'status', oldV: old, newV: rec.status, reason });
  return { s, ok: true, msg: `${code} ${rec.status === 'BLOCKED' ? 'blocked — issues refused, history fully visible' : 'unblocked'}.`, tone: 'ok' };
}

export function createPartner(sIn: ERPState, args: { id: string; name: string; pan: string; gstin: string; state: string; roles: string[]; overrideReason?: string }, userId: string): Res {
  const s = clone(sIn);
  const auth = authorize(s, userId, 'ORG_MDM', '01');
  if (!auth.ok) return { s, ok: false, msg: auth.reason, tone: 'bad' };
  const samePan = PARTNERS.find((p) => p.pan === args.pan.toUpperCase());
  if (samePan) {
    if (!args.overrideReason || args.overrideReason.trim().length < 8) {
      pushAudit(s, userId, 'SECURITY', 'PARTNER', args.id, { reason: `Duplicate PAN ${args.pan} = ${samePan.id} — blocked without override` });
      return { s, ok: false, msg: `Duplicate prevention: PAN ${args.pan.toUpperCase()} already belongs to ${samePan.id} (${samePan.name}). An override with reason (min 8 chars) is required.`, tone: 'bad' };
    }
    pushAudit(s, userId, 'SECURITY', 'PARTNER', args.id, { reason: `Duplicate PAN override — ${args.overrideReason}` });
  }
  const nearDup = PARTNERS.find((p) => nameSimilar(p.name, args.name));
  if (nearDup && !samePan && !args.overrideReason) {
    return { s, ok: false, msg: `Fuzzy name match with ${nearDup.id} "${nearDup.name}". Provide an override reason to proceed.`, tone: 'bad' };
  }
  PARTNERS.push({
    id: args.id, name: args.name, legalName: args.name, roles: args.roles as PartnerRole[], accountGroup: 'VEND',
    pan: args.pan.toUpperCase(), gstin: [{ state: args.state, no: args.gstin }], regType: 'REGULAR',
    state: args.state, stateName: STATE_NAMES[args.state] ?? args.state, tdsSection: '194Q', tdsPct: 0.1,
    reconAccount: '120100', bank: { bankName: '—', acct: '—', ifsc: '—' }, msme: false, rating: 50,
    status: 'PENDING', createdBy: userId,
  });
  pushAudit(s, userId, 'CHANGE', 'PARTNER', args.id, { field: 'status', newV: 'PENDING', reason: `Created · duplicate check ${samePan ? 'override' : nearDup ? 'override' : 'clean'}` });
  return { s, ok: true, msg: `${args.id} created in PENDING (roles: ${args.roles.join(', ')}).`, tone: 'ok' };
}

/* dual-control change requests */
export function proposeChange(sIn: ERPState, args: { object: string; key: string; field: string; oldV: string; newV: string; reason: string; freezePartnerId?: string }, userId: string): Res {
  const s = clone(sIn);
  if (args.reason.trim().length < 8) return { s, ok: false, msg: 'Dual-control fields require a substantive reason (min 8 chars).', tone: 'bad' };
  const cr = {
    id: uid(), object: args.object, key: args.key, field: args.field, oldV: args.oldV, newV: args.newV,
    reason: args.reason, proposer: userId, approvals: [], needed: 2, status: 'PENDING' as const,
    freezePartnerId: args.freezePartnerId,
  };
  s.changes.unshift(cr);
  pushAudit(s, userId, 'CHANGE', args.object, args.key, { field: args.field, oldV: args.oldV, newV: args.newV, reason: `Dual-control request raised: ${args.reason}` });
  return { s, ok: true, msg: `Change request raised — needs Finance Manager + Internal Auditor (proposer excluded). ${args.freezePartnerId ? 'Payment freeze arms on approval.' : ''}`, tone: 'ok' };
}

export function approveChange(sIn: ERPState, changeId: string, userId: string): Res {
  const s = clone(sIn);
  const cr = s.changes.find((c) => c.id === changeId);
  if (!cr || cr.status !== 'PENDING') return { s, ok: false, msg: 'Change request not pending', tone: 'bad' };
  const user = userById(userId);
  if (cr.proposer === userId) return { s, ok: false, msg: 'Maker ≠ checker — the proposer cannot approve their own request.', tone: 'bad' };
  const eligible = user.roles.includes('ROLE-FIN') || user.roles.includes('ROLE-IA') || user.roles.includes('ROLE-ADM');
  if (!eligible) return { s, ok: false, msg: '403 · Dual-control approval needs ROLE-FIN or ROLE-IA.', tone: 'bad' };
  if (cr.approvals.some((a) => a.user === userId)) return { s, ok: false, msg: 'Already approved by you — two distinct approvers required.', tone: 'warn' };
  cr.approvals.push({ user: userId, at: nowStamp() });
  pushAudit(s, userId, 'CHANGE', cr.object, cr.key, { field: cr.field, reason: `Dual-control approval ${cr.approvals.length}/${cr.needed}` });
  if (cr.approvals.length < cr.needed) return { s, ok: true, msg: `Approval ${cr.approvals.length}/${cr.needed} recorded.`, tone: 'info' };

  cr.status = 'APPROVED';
  /* apply */
  if (cr.object === 'MATERIAL') {
    const m = MATERIALS.find((x) => x.code === cr.key);
    if (m) {
      (m as unknown as Record<string, unknown>)[cr.field] = cr.field === 'price' ? Number(cr.newV) : cr.newV;
      pushAudit(s, userId, 'CHANGE', 'MATERIAL', cr.key, { field: cr.field, oldV: cr.oldV, newV: cr.newV, reason: cr.reason });
    }
  }
  if (cr.object === 'PARTNER_BANK') {
    const p = PARTNERS.find((x) => x.id === cr.key);
    if (p) {
      const [bankName, acct, ifsc] = cr.newV.split('|');
      const old = `${p.bank.bankName}|${p.bank.acct}|${p.bank.ifsc}`;
      p.bank = { bankName, acct, ifsc };
      pushAudit(s, userId, 'CHANGE', 'PARTNER_BANK', cr.key, { field: 'bank', oldV: old, newV: cr.newV, reason: cr.reason });
    }
    if (cr.freezePartnerId) {
      s.freeze[cr.freezePartnerId] = daysAheadISO(2);
      pushAudit(s, userId, 'SYSTEM', 'PAYMENT_FREEZE', cr.freezePartnerId, { reason: `Automatic 48 h cooling period after bank-detail change — Finance & Internal Audit notified` });
    }
  }
  return { s, ok: true, msg: `Change applied after dual approval.${cr.freezePartnerId ? ' Payment freeze active 48 h — payments refused meanwhile.' : ''}`, tone: 'ok' };
}

/* ============================== period closing ============================== */

export function signOffClosing(sIn: ERPState, stepId: string, userId: string): Res {
  const s = clone(sIn);
  const step = s.closing.find((c) => c.id === stepId);
  if (!step) return { s, ok: false, msg: 'Step not found', tone: 'bad' };
  const user = userById(userId);
  if (!user.roles.includes(step.ownerRole) && !user.roles.includes('ROLE-FIN') && !user.roles.includes('ROLE-ADM')) {
    pushAudit(s, userId, 'SECURITY', 'CLOSING', stepId, { reason: `Sign-off requires ${step.ownerRole}` });
    return { s, ok: false, msg: `403 · "${step.title}" sign-off needs ${step.ownerRole}.`, tone: 'bad' };
  }
  step.done = true;
  step.by = userId;
  step.at = nowStamp();
  pushAudit(s, userId, 'CONFIG', 'CLOSING_COCKPIT', step.title, { newV: 'signed off' });
  return { s, ok: true, msg: `"${step.title}" signed off by ${user.name}.`, tone: 'ok' };
}

export function setPeriodStatus(sIn: ERPState, companyId: string, area: 'FIN' | 'LOG', status: 'OPEN' | 'SOFT_CLOSED' | 'HARD_CLOSED', reason: string, userId: string): Res {
  const s = clone(sIn);
  const auth = authorize(s, userId, 'FIN_PERIOD', '11', { company: companyId });
  if (!auth.ok) return { s, ok: false, msg: auth.reason, tone: 'bad' };
  const cur = s.periods[companyId][area];
  if (status === 'SOFT_CLOSED') {
    const pending = s.closing.filter((c) => !c.done);
    if (pending.length && area === 'FIN') return { s, ok: false, msg: `Soft close blocked — closing cockpit has ${pending.length} unsigned step(s): ${pending.map((p) => p.title).join('; ')}.`, tone: 'bad' };
  }
  if (status === 'HARD_CLOSED' && cur.status !== 'SOFT_CLOSED') return { s, ok: false, msg: 'Hard close requires a prior soft close — the sequence is OPEN → SOFT → HARD.', tone: 'bad' };
  cur.status = status;
  cur.by = userId;
  cur.reason = reason;
  pushAudit(s, userId, 'CONFIG', 'PERIOD', `${companyId} ${area}`, { oldV: cur.status === status ? '' : 'previous', newV: status, reason });
  return { s, ok: true, msg: `${companyId} ${area} → ${status.replace('_', ' ')}. ${status === 'HARD_CLOSED' ? 'No posting by any user from here on.' : ''}`, tone: 'ok' };
}

export function reopenPeriod(sIn: ERPState, companyId: string, area: 'FIN' | 'LOG', reason: string, userId: string): Res {
  const s = clone(sIn);
  const auth = authorize(s, userId, 'FIN_PERIOD', '11', { company: companyId });
  if (!auth.ok) return { s, ok: false, msg: auth.reason, tone: 'bad' };
  if (reason.trim().length < 12) return { s, ok: false, msg: 'Reopening a period is an audited document — a substantive reason (min 12 chars) is mandatory.', tone: 'bad' };
  const cur = s.periods[companyId][area];
  const old = cur.status;
  cur.status = 'OPEN';
  cur.by = userId;
  cur.reason = reason;
  const number = nextNumber(s, 'PRD', companyId);
  pushAudit(s, userId, 'CONFIG', 'PERIOD_REOPEN', number, { oldV: old, newV: 'OPEN', reason: `Audited reopen document: ${reason}` });
  return { s, ok: true, msg: `Period reopened via audited document ${number} — reason recorded for the auditor.`, tone: 'ok' };
}

/* ============================== role assignment + SoD ============================== */

export function assignRole(sIn: ERPState, targetUserId: string, roleId: string, byUserId: string): Res {
  const s = clone(sIn);
  const auth = authorize(s, byUserId, 'ORG_MDM', '02');
  const admin = userById(byUserId).roles.includes('ROLE-ADM');
  if (!auth.ok && !admin) return { s, ok: false, msg: auth.reason, tone: 'bad' };
  const target = USERS.find((u) => u.id === targetUserId);
  const role = ROLES.find((r) => r.id === roleId);
  if (!target || !role) return { s, ok: false, msg: 'Unknown user/role', tone: 'bad' };
  if (target.roles.includes(roleId)) return { s, ok: true, msg: 'Role already held.', tone: 'info' };
  const prospective = [...target.roles, roleId];
  const heldObjects: string[] = [];
  for (const rid of prospective) {
    const r = ROLES.find((x) => x.id === rid);
    r?.objects.forEach((o) => o.activities.forEach((a) => heldObjects.push(`${o.obj}:${a}`)));
  }
  for (const rule of SOD_RULES) {
    const aHit = heldObjects.some((h) => h.startsWith(rule.a.split(':')[0] + ':') && (!rule.a.includes(':') || h === rule.a || h.startsWith(rule.a.split(':')[0] + ':01') || ruleMatch(h, rule.a)));
    const bHit = heldObjects.some((h) => h.startsWith(rule.b.split(':')[0] + ':') && (!rule.b.includes(':') || ruleMatch(h, rule.b)));
    if (aHit && bHit) {
      pushAudit(s, byUserId, 'SECURITY', 'SOD', targetUserId, { field: roleId, reason: `Toxic combination blocked: ${rule.desc} — reported to Internal Auditor` });
      return { s, ok: false, msg: `Segregation of duties: "${rule.desc}" is a toxic combination for one user. Assignment blocked and reported to Internal Audit.`, tone: 'bad' };
    }
  }
  target.roles.push(roleId);
  pushAudit(s, byUserId, 'CONFIG', 'USER_ROLE', targetUserId, { field: 'roles', newV: roleId, reason: `Granted ${role.name}` });
  return { s, ok: true, msg: `${role.name} granted to ${target.name} — SoD matrix checked clean.`, tone: 'ok' };
}

function ruleMatch(held: string, rule: string): boolean {
  if (!rule.includes(':')) return held.startsWith(rule + ':');
  return held === rule;
}

/* ============================== queries ============================== */

export const stockValueTotal = (s: ERPState): number => round2(s.stock.reduce((t, r) => t + r.value, 0));

export const glBalance = (s: ERPState, account: string): number =>
  round2(s.journals.filter((j) => j.status === 'POSTED').reduce((t, j) => t + j.lines.filter((l) => l.account === account).reduce((x, l) => x + l.dr - l.cr, 0), 0));

export const flowChain = (s: ERPState, docId: string): string[] => {
  const back: string[] = [];
  let cur = docId;
  for (let i = 0; i < 20; i++) {
    const link = s.flow.find((f) => f.to === cur);
    if (!link) break;
    back.unshift(link.from);
    cur = link.from;
  }
  const fwd: string[] = [];
  const walk = (id: string) => {
    for (const l of s.flow.filter((f) => f.from === id)) {
      fwd.push(l.to);
      walk(l.to);
    }
  };
  walk(docId);
  return [...back, docId, ...fwd];
};

export const pendingReleaseDocs = (s: ERPState): Doc[] =>
  s.docs.filter((d) => d.release && (d.release.indicator === 'BLOCKED' || d.release.indicator === 'PARTIALLY_RELEASED'));

export const openCommitment = (s: ERPState): number =>
  round2(s.docs.filter((d) => d.type.startsWith('PO') && d.status !== 'REJECTED' && d.status !== 'CANCELLED')
    .reduce((t, d) => t + d.items.reduce((x, i) => x + Math.max(0, i.qty - i.received) * i.rate, 0), 0));

/* ============================== fresh state ============================== */

export function freshState(): ERPState {
  const today = todayISO();
  return {
    v: 6,
    today,
    userId: 'USR-ADM',
    companyFilter: 'ALL',
    seq: {},
    docs: [],
    journals: [],
    stock: [],
    flow: [],
    audit: [],
    changes: [],
    periods: {
      VUL: { FIN: { status: 'OPEN' }, LOG: { status: 'OPEN' } },
      VUR: { FIN: { status: 'OPEN' }, LOG: { status: 'OPEN' } },
    },
    closing: clone(CLOSING_STEPS_SEED),
    freeze: {},
    authFailCount: 0,
    conversations: [],
    idem: {},
    /* Part 2/10 MDM collections */
    uomFactors: clone(UOM_FACTORS_SEED),
    geofences: clone(GEOFENCE_SEED),
    importRuns: [],
    consumption: [],
    mdmOverrides: [],
    /* Part 2 domain collections */
    sources: clone(SOURCE_LIST_SEED),
    quotas: clone(QUOTA_SEED),
    rateContracts: clone(RATE_CONTRACT_SEED),
    rfqs: [],
    gateEntries: [],
    weighTickets: [],
    reservations: [],
    returnables: [],
    counts: [],
    equipment: clone(EQUIPMENT_SEED),
    eqLogs: [],
    maintOrders: [],
    inspLots: [],
    tests: [],
    ncrs: [],
    exceptions: [],
    /* Part 3 domain collections */
    budgets: {},
    contracts: clone(CONTRACTS_SEED),
    boq: clone(BOQ_SEED),
    measurements: [],
    raBills: [],
    suborders: [],
    rateLibrary: clone(RATE_LIBRARY_SEED),
    hindrances: [],
    claims: [],
    payProposals: [],
    bankLines: [],
    assets: clone(ASSET_SEED),
    profitForecasts: [],
    itc: [],
    cess: [],
    guarantees: clone(GUARANTEE_SEED),
    insurances: clone(INSURANCE_SEED),
    disputes: clone(DISPUTE_SEED),
    compliance: clone(COMPLIANCE_SEED),
    minWages: clone(MINWAGE_SEED),
    closeout: {},
    wbsVersions: {},
    physicalProgress: {},
    raRunHistory: [],
    /* Part 3/10 project system collections */
    wbsElements: [],
    psActivities: [],
    baselines: [],
    psBoq: [],
    psMeasurements: [],
    dprs: [],
    hindranceRegs: [],
    siteInstructions: [],
    rfis: [],
    costForecasts: [],
    raPostings: [],
  };
}

/* re-export for convenience */
export { DOC_TYPES, MOVEMENT_TYPES };
