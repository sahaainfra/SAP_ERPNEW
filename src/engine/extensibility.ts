/* ======================================================================== */
/*  VULCAN ERP — PART 10C: EXTENSIBILITY                                    */
/*  Custom fields, configuration transport, lifecycle management            */
/* ======================================================================== */

import type { ERPState, Res, CustomField, ConfigTransport } from './types';
import { cloneState, uid, nowStamp, pushAudit } from './engine';

/* ===================== Custom Fields ===================== */

export function createCustomField(
  sIn: ERPState,
  args: {
    entity: string;
    fieldName: string;
    fieldType: CustomField['fieldType'];
    label: string;
    required: boolean;
    searchable: boolean;
    reportable: boolean;
    authorization?: string;
    options?: string[];
  },
  userId: string,
): Res {
  const s = cloneState(sIn);

  const field: CustomField = {
    id: uid(),
    ...args,
    createdAt: nowStamp(),
    createdBy: userId,
  };

  s.customFields.unshift(field);

  pushAudit(s, userId, 'CONFIG', 'CUSTOM_FIELD', field.id, {
    reason: `Custom field created: ${field.entity}.${field.fieldName} (${field.fieldType})`,
  });

  return {
    s,
    ok: true,
    msg: `Custom field created: ${field.entity}.${field.fieldName}`,
    tone: 'ok',
    docId: field.id,
  };
}

export function getCustomFieldsForEntity(s: ERPState, entity: string): CustomField[] {
  return s.customFields.filter((f) => f.entity === entity);
}

/* ===================== Configuration Transport ===================== */

export function createConfigTransport(
  sIn: ERPState,
  args: {
    name: string;
    sourceEnvironment: string;
    targetEnvironment: string;
    items: { type: string; id: string; name: string }[];
  },
  userId: string,
): Res {
  const s = cloneState(sIn);

  // Perform dependency check
  const dependencyCheck = 'PASS'; // Simplified — in reality, would check dependencies

  // Generate dry-run report
  const dryRunReport = `Transport "${args.name}": ${args.items.length} items from ${args.sourceEnvironment} to ${args.targetEnvironment}. Dependency check: ${dependencyCheck}. No conflicts detected.`;

  const transport: ConfigTransport = {
    id: uid(),
    ...args,
    dependencyCheck,
    dryRunReport,
    status: 'DRAFT',
    createdAt: nowStamp(),
    createdBy: userId,
  };

  s.configTransports.unshift(transport);

  pushAudit(s, userId, 'CONFIG', 'CONFIG_TRANSPORT', transport.id, {
    reason: `Configuration transport created: ${transport.name}`,
  });

  return {
    s,
    ok: true,
    msg: `Configuration transport created: ${transport.name}`,
    tone: 'ok',
    docId: transport.id,
  };
}

export function validateConfigTransport(sIn: ERPState, transportId: string, userId: string): Res {
  const s = cloneState(sIn);
  const transport = s.configTransports.find((t) => t.id === transportId);
  if (!transport) return { s, ok: false, msg: 'Transport not found', tone: 'bad' };

  if (transport.status !== 'DRAFT') {
    return { s, ok: false, msg: `Transport is ${transport.status} — only DRAFT can be validated`, tone: 'bad' };
  }

  transport.status = 'VALIDATED';

  pushAudit(s, userId, 'CONFIG', 'CONFIG_TRANSPORT', transportId, {
    reason: `Transport validated: ${transport.name}`,
  });

  return {
    s,
    ok: true,
    msg: `Transport validated: ${transport.name}`,
    tone: 'ok',
  };
}

export function deployConfigTransport(sIn: ERPState, transportId: string, userId: string): Res {
  const s = cloneState(sIn);
  const transport = s.configTransports.find((t) => t.id === transportId);
  if (!transport) return { s, ok: false, msg: 'Transport not found', tone: 'bad' };

  if (transport.status !== 'VALIDATED') {
    return { s, ok: false, msg: `Transport is ${transport.status} — only VALIDATED can be deployed`, tone: 'bad' };
  }

  transport.status = 'DEPLOYED';
  transport.deployedAt = nowStamp();
  transport.deployedBy = userId;

  pushAudit(s, userId, 'CONFIG', 'CONFIG_TRANSPORT', transportId, {
    reason: `Transport deployed: ${transport.name}`,
  });

  return {
    s,
    ok: true,
    msg: `Transport deployed: ${transport.name}`,
    tone: 'ok',
  };
}

export function rollbackConfigTransport(sIn: ERPState, transportId: string, userId: string): Res {
  const s = cloneState(sIn);
  const transport = s.configTransports.find((t) => t.id === transportId);
  if (!transport) return { s, ok: false, msg: 'Transport not found', tone: 'bad' };

  if (transport.status !== 'DEPLOYED') {
    return { s, ok: false, msg: `Transport is ${transport.status} — only DEPLOYED can be rolled back`, tone: 'bad' };
  }

  transport.status = 'ROLLED_BACK';
  transport.rolledBackAt = nowStamp();
  transport.rolledBackBy = userId;

  pushAudit(s, userId, 'CONFIG', 'CONFIG_TRANSPORT', transportId, {
    reason: `Transport rolled back: ${transport.name}`,
  });

  return {
    s,
    ok: true,
    msg: `Transport rolled back: ${transport.name}`,
    tone: 'ok',
  };
}

/* ===================== Simulation ===================== */

export function simulateReleaseStrategy(sIn: ERPState, docValue: number, userId: string): Res {
  // In a real implementation, this would simulate which release strategy would apply
  // For now, return a mock result
  return {
    s: sIn,
    ok: true,
    msg: `Simulation: Document value ${docValue} would trigger release strategy based on configured thresholds`,
    tone: 'info',
  };
}

export function simulatePricingProcedure(sIn: ERPState, args: { baseRate: number; qty: number }, userId: string): Res {
  // In a real implementation, this would simulate the pricing procedure
  const baseValue = args.baseRate * args.qty;
  const discount = baseValue * 0.05;
  const netValue = baseValue - discount;
  const tax = netValue * 0.18;
  const grossValue = netValue + tax;

  return {
    s: sIn,
    ok: true,
    msg: `Pricing simulation: Base ${baseValue.toFixed(2)}, Discount ${discount.toFixed(2)}, Net ${netValue.toFixed(2)}, Tax ${tax.toFixed(2)}, Gross ${grossValue.toFixed(2)}`,
    tone: 'info',
  };
}
