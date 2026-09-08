/* ======================================================================== */
/*  VULCAN ERP — PART 10A: LAUNCHPAD & DESIGN SYSTEM                        */
/*  KPI computation, tile value resolution, launchpad configuration         */
/* ======================================================================== */

import type { ERPState, Res, KpiDefinition, TileConfig, TileValue, LaunchpadConfig } from './types';
import { cloneState, uid, nowStamp, round2, fmtINR, fmtNum, authorize } from './engine';

/* ===================== KPI Definition Management ===================== */

export function defineKpi(
  sIn: ERPState,
  args: Omit<KpiDefinition, 'code'>,
  userId: string,
): Res {
  const s = cloneState(sIn);
  
  // Validate drill path is present
  if (!args.drillPath || args.drillPath.length === 0) {
    return { s, ok: false, msg: 'KPI definition rejected: drillPath is mandatory', tone: 'bad' };
  }

  // Validate authorization object
  if (!args.authorizationObject) {
    return { s, ok: false, msg: 'KPI definition rejected: authorizationObject is mandatory', tone: 'bad' };
  }

  const code = `KPI-${uid().slice(0, 8).toUpperCase()}`;
  const kpi: KpiDefinition = { ...args, code };

  s.kpiDefinitions.push(kpi);
  s.toolLibrary.dashboardEngine.kpisDefined++;

  return { s, ok: true, msg: `KPI "${args.name}" defined with code ${code}`, tone: 'ok', docId: code };
}

/* ===================== Tile Configuration ===================== */

export function configureLaunchpad(
  sIn: ERPState,
  role: string,
  tiles: TileConfig[],
  userId: string,
): Res {
  const s = cloneState(sIn);

  // Validate all tiles have drill targets
  for (const tile of tiles) {
    if (!tile.drillTarget) {
      return { s, ok: false, msg: `Tile "${tile.title}" rejected: drillTarget is mandatory`, tone: 'bad' };
    }
  }

  const config: LaunchpadConfig = {
    role,
    tiles,
    tileOrder: tiles.map((t) => t.id),
  };

  // Remove existing config for this role
  s.launchpadConfigs = s.launchpadConfigs.filter((c) => c.role !== role);
  s.launchpadConfigs.push(config);

  return { s, ok: true, msg: `Launchpad configured for role "${role}" with ${tiles.length} tiles`, tone: 'ok' };
}

/* ===================== Tile Value Computation ===================== */

export function computeTileValue(s: ERPState, tile: TileConfig, userId: string): TileValue {
  const now = nowStamp();

  // Authorization check
  const auth = authorize(s, userId, tile.authorizationObject, '03', {});
  if (!auth.ok) {
    return {
      tileId: tile.id,
      value: 0,
      timestamp: now,
    };
  }

  // Compute value based on tile type
  let value: number | string = 0;
  let drillCount = 0;
  let trend: number | undefined;
  let status: 'RED' | 'AMBER' | 'GREEN' | 'GREY' | undefined;

  switch (tile.type) {
    case 'COUNT':
      // Count tiles show actionable work items
      if (tile.title.includes('Approvals')) {
        const pending = s.docs.filter((d) => 
          d.release && 
          (d.release.indicator === 'BLOCKED' || d.release.indicator === 'PARTIALLY_RELEASED')
        );
        value = pending.length;
        drillCount = pending.length;
      } else if (tile.title.includes('Tasks')) {
        const tasks = s.tasks.filter((t) => t.status !== 'COMPLETED' && t.status !== 'CANCELLED');
        value = tasks.length;
        drillCount = tasks.length;
      } else if (tile.title.includes('Exceptions')) {
        value = s.exceptions.length;
        drillCount = s.exceptions.length;
      } else {
        value = 0;
        drillCount = 0;
      }
      break;

    case 'KPI':
      // KPI tiles show financial/progress measures
      if (tile.title.includes('Budget')) {
        const totalBudget = Object.values(s.budgets).reduce((sum, b) => sum + b.org + b.sup - b.ret, 0);
        value = totalBudget;
      } else if (tile.title.includes('Stock')) {
        value = s.stock.reduce((sum, row) => sum + row.value, 0);
      } else {
        value = 0;
      }
      break;

    case 'MONITORING':
      // Monitoring tiles show traffic-light status
      if (tile.title.includes('Stock Ledger')) {
        // Check if stock ledger reconciles with GL
        const stockValue = s.stock.reduce((sum, row) => sum + row.value, 0);
        const glStockBalance = s.journals
          .filter((j) => j.status === 'POSTED')
          .flatMap((j) => j.lines)
          .filter((l) => l.account.startsWith('110')) // Stock accounts
          .reduce((sum, l) => sum + l.dr - l.cr, 0);
        
        const diff = Math.abs(stockValue - glStockBalance);
        status = diff < 1 ? 'GREEN' : diff < 10000 ? 'AMBER' : 'RED';
        value = diff < 1 ? 'Zero break' : `Break: ₹${fmtNum(diff, 0)}`;
      } else if (tile.title.includes('Compliance')) {
        const redCount = s.compliance.filter((c) => c.status === 'RED').length;
        value = redCount;
        status = redCount === 0 ? 'GREEN' : redCount < 3 ? 'AMBER' : 'RED';
      }
      break;

    case 'COMPARISON':
      // Comparison tiles show plan vs actual
      if (tile.title.includes('Progress')) {
        const physicalProgress = Object.values(s.physicalProgress).reduce((sum, p) => sum + p, 0) / 
          Math.max(1, Object.keys(s.physicalProgress).length);
        value = `${round2(physicalProgress)}%`;
      }
      break;

    default:
      value = 0;
  }

  return {
    tileId: tile.id,
    value,
    trend,
    status,
    timestamp: now,
    drillCount,
  };
}

export function refreshAllTiles(sIn: ERPState, userId: string): Res {
  const s = cloneState(sIn);
  const userConfig = s.launchpadConfigs.find((c) => c.role === userId);
  
  if (!userConfig) {
    return { s, ok: false, msg: 'No launchpad configuration found for user', tone: 'bad' };
  }

  const tileValues: Record<string, TileValue> = {};
  for (const tile of userConfig.tiles) {
    tileValues[tile.id] = computeTileValue(s, tile, userId);
  }

  s.tileValues = tileValues;

  return { s, ok: true, msg: `Refreshed ${userConfig.tiles.length} tiles`, tone: 'ok' };
}

/* ===================== Tile Drill-Down Validation ===================== */

export function validateTileDrillConsistency(s: ERPState, tileId: string): { consistent: boolean; tileValue: number; drillCount: number } {
  const tileValue = s.tileValues[tileId];
  if (!tileValue) {
    return { consistent: false, tileValue: 0, drillCount: 0 };
  }

  // For count tiles, tile value must equal drill count
  const tile = s.launchpadConfigs.flatMap((c) => c.tiles).find((t) => t.id === tileId);
  if (!tile || tile.type !== 'COUNT') {
    return { consistent: true, tileValue: 0, drillCount: 0 };
  }

  const tileNum = typeof tileValue.value === 'number' ? tileValue.value : 0;
  const drillNum = tileValue.drillCount ?? 0;

  return {
    consistent: tileNum === drillNum,
    tileValue: tileNum,
    drillCount: drillNum,
  };
}

/* ===================== Seed Data ===================== */

export function seedLaunchpadData(s: ERPState): void {
  // Define some sample KPIs
  const kpis: Omit<KpiDefinition, 'code'>[] = [
    {
      name: 'Approvals Pending',
      description: 'Count of documents awaiting approval',
      module: 'PLT',
      businessOwnerRole: 'ROLE-ADM',
      measureExpression: 'COUNT(docs WHERE release.indicator IN (BLOCKED, PARTIALLY_RELEASED))',
      dimensions: ['company', 'module'],
      timeBasis: 'AS_ON',
      unit: 'count',
      decimals: 0,
      scaling: 'ABSOLUTE',
      displayFormat: 'integer',
      targetSource: 'NONE',
      thresholdRules: [
        { boundary: 10, direction: 'LOWER_BETTER', status: 'GREEN' },
        { boundary: 20, direction: 'LOWER_BETTER', status: 'AMBER' },
      ],
      trendBasis: 'PERIOD_ON_PERIOD',
      trendPeriods: 6,
      drillPath: ['procurement', 'inventory'],
      refreshPolicy: 'REALTIME',
      authorizationObject: 'PLT_DOC',
    },
    {
      name: 'Stock Value',
      description: 'Total inventory value',
      module: 'INV',
      businessOwnerRole: 'ROLE-STR',
      measureExpression: 'SUM(stock.value)',
      dimensions: ['company', 'site', 'material_group'],
      timeBasis: 'AS_ON',
      unit: '₹',
      decimals: 0,
      scaling: 'LAKH',
      displayFormat: 'currency_inr',
      targetSource: 'BUDGET',
      thresholdRules: [],
      trendBasis: 'PERIOD_ON_PERIOD',
      trendPeriods: 6,
      drillPath: ['inventory'],
      refreshPolicy: 'CACHED',
      authorizationObject: 'INV_STOCK',
    },
  ];

  for (const kpi of kpis) {
    defineKpi(s, kpi, 'USR-ADM');
  }

  // Configure launchpad for different roles
  const managerTiles: TileConfig[] = [
    {
      id: 'TILE-APPROVALS',
      type: 'COUNT',
      title: 'Approvals pending',
      subtitle: 'oldest 4d',
      group: 'MY_WORK',
      refreshPolicy: 'REALTIME',
      drillTarget: 'approvals',
      authorizationObject: 'PLT_DOC',
    },
    {
      id: 'TILE-EXCEPTIONS',
      type: 'COUNT',
      title: 'Exceptions',
      subtitle: '▲ 2',
      group: 'MY_WORK',
      refreshPolicy: 'REALTIME',
      drillTarget: 'exceptions',
      authorizationObject: 'INV_EXC',
    },
    {
      id: 'TILE-TASKS',
      type: 'COUNT',
      title: 'Tasks due',
      group: 'MY_WORK',
      refreshPolicy: 'REALTIME',
      drillTarget: 'tasks',
      authorizationObject: 'PLT_TASK',
    },
    {
      id: 'TILE-BUDGET',
      type: 'KPI',
      title: 'Budget balance',
      subtitle: '31% left',
      group: 'PROJECT',
      refreshPolicy: 'CACHED',
      cacheIntervalMinutes: 15,
      drillTarget: 'budget',
      authorizationObject: 'PRJ_BUD',
    },
    {
      id: 'TILE-STOCK-GL',
      type: 'MONITORING',
      title: 'Stock Ledger vs GL',
      subtitle: 'must read zero',
      group: 'STORES',
      refreshPolicy: 'CACHED',
      cacheIntervalMinutes: 60,
      drillTarget: 'reconciliation',
      authorizationObject: 'INV_STOCK',
    },
  ];

  configureLaunchpad(s, 'USR-ADM', managerTiles, 'USR-ADM');
  configureLaunchpad(s, 'USR-STR', managerTiles, 'USR-STR');

  // Compute initial tile values
  refreshAllTiles(s, 'USR-ADM');
}
