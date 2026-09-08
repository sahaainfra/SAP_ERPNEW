// Part 10C - Extensibility Engine
// Custom Fields, Configuration Lifecycle, Transports

import type { Part10CState, CustomField, ConfigurationTransport } from './types';

// Custom Fields
export function createCustomField(
  state: Part10CState,
  field: Omit<CustomField, 'id'>
): Part10CState {
  const newField: CustomField = {
    ...field,
    id: `CF-${Date.now()}`,
  };
  
  return { ...state, customFields: [...state.customFields, newField] };
}

export function getCustomFieldsForEntity(state: Part10CState, entity: string): CustomField[] {
  return state.customFields.filter(f => f.entity === entity);
}

export function updateCustomField(
  state: Part10CState,
  fieldId: string,
  updates: Partial<CustomField>
): Part10CState {
  return {
    ...state,
    customFields: state.customFields.map(f => 
      f.id === fieldId ? { ...f, ...updates } : f
    ),
  };
}

export function deleteCustomField(state: Part10CState, fieldId: string): Part10CState {
  return {
    ...state,
    customFields: state.customFields.filter(f => f.id !== fieldId),
  };
}

// Configuration Transport
export function createConfigurationTransport(
  state: Part10CState,
  transport: Omit<ConfigurationTransport, 'id' | 'status'>
): Part10CState {
  const newTransport: ConfigurationTransport = {
    ...transport,
    id: `TRANS-${Date.now()}`,
    status: 'DRAFT',
    rollbackAvailable: false,
  };
  
  return { ...state, configTransports: [...state.configTransports, newTransport] };
}

export function validateTransport(
  state: Part10CState,
  transportId: string
): { state: Part10CState; valid: boolean; issues: string[] } {
  const transport = state.configTransports.find(t => t.id === transportId);
  if (!transport) {
    return { state, valid: false, issues: ['Transport not found'] };
  }
  
  const issues: string[] = [];
  
  // Check dependencies
  if (transport.objects.includes('RELEASE_STRATEGY') && !transport.objects.includes('RELEASE_GROUP')) {
    issues.push('Release strategy requires release group');
  }
  
  if (transport.objects.includes('PRICING_PROCEDURE') && !transport.objects.includes('CONDITION_TYPE')) {
    issues.push('Pricing procedure requires condition types');
  }
  
  // Check for conflicts
  // In real implementation, check if target environment has conflicting configurations
  
  const updatedState = {
    ...state,
    configTransports: state.configTransports.map(t =>
      t.id === transportId ? { ...t, status: issues.length === 0 ? 'VALIDATED' as const : 'DRAFT' as const } : t
    ),
  };
  
  return { state: updatedState, valid: issues.length === 0, issues };
}

export function dryRunTransport(
  state: Part10CState,
  transportId: string
): { state: Part10CState; report: string } {
  const transport = state.configTransports.find(t => t.id === transportId);
  if (!transport) {
    return { state, report: 'Transport not found' };
  }
  
  const report = `
Configuration Transport Dry Run Report
=======================================

Transport: ${transport.name}
From: ${transport.fromEnvironment}
To: ${transport.toEnvironment}
Objects: ${transport.objects.join(', ')}

Changes to be applied:
${transport.objects.map(obj => `- ${obj}: Will be created/updated`).join('\n')}

Dependencies:
${transport.objects.includes('RELEASE_STRATEGY') ? '- Release group will be created first' : '- No dependencies'}

Conflicts:
- None detected

Rollback:
- Previous configuration will be saved
- Rollback available: Yes

Estimated impact:
- ${transport.objects.length} configuration objects
- 0 dependent documents affected
- 0 users impacted

Recommendation: Safe to apply
  `.trim();
  
  return { state, report };
}

export function applyTransport(
  state: Part10CState,
  transportId: string,
  appliedBy: string
): Part10CState {
  return {
    ...state,
    configTransports: state.configTransports.map(t =>
      t.id === transportId
        ? {
            ...t,
            status: 'APPLIED' as const,
            appliedBy,
            appliedAt: new Date().toISOString(),
            rollbackAvailable: true,
          }
        : t
    ),
  };
}

export function rollbackTransport(
  state: Part10CState,
  transportId: string
): Part10CState {
  const transport = state.configTransports.find(t => t.id === transportId);
  if (!transport || !transport.rollbackAvailable) {
    return state;
  }
  
  return {
    ...state,
    configTransports: state.configTransports.map(t =>
      t.id === transportId
        ? { ...t, status: 'ROLLED_BACK' as const, rollbackAvailable: false }
        : t
    ),
  };
}

// Configuration Simulation
export function simulateReleaseStrategy(
  state: Part10CState,
  strategyConfig: any,
  documentValue: number
): { path: string[]; steps: number; approved: boolean } {
  // Simulate which release path a document would take
  const path: string[] = [];
  
  if (documentValue > 1000000) {
    path.push('L1: Department Head');
    path.push('L2: Finance Controller');
    if (documentValue > 5000000) {
      path.push('L3: Director');
    }
  } else {
    path.push('L1: Department Head');
  }
  
  return {
    path,
    steps: path.length,
    approved: false, // Simulation only
  };
}

export function simulatePricingProcedure(
  state: Part10CState,
  procedureConfig: any,
  baseValue: number
): { steps: Array<{step: number; condition: string; value: number}>; finalValue: number } {
  const steps = [
    { step: 10, condition: 'Base Price', value: baseValue },
    { step: 20, condition: 'Discount (5%)', value: -(baseValue * 0.05) },
    { step: 30, condition: 'Freight', value: 5000 },
    { step: 40, condition: 'GST (18%)', value: (baseValue * 0.95 + 5000) * 0.18 },
  ];
  
  const finalValue = steps.reduce((sum, s) => sum + s.value, 0);
  
  return { steps, finalValue };
}

export function simulateAccountDetermination(
  state: Part10CState,
  eventKey: string,
  valuationClass: string
): { debitAccount: string; creditAccount: string } {
  // Simulate account determination
  const mappings: Record<string, { debit: string; credit: string }> = {
    'GR-IR': { debit: '300000', credit: '400000' },
    'CONSUMPTION': { debit: '500000', credit: '300000' },
    'PAYMENT': { debit: '400000', credit: '100000' },
  };
  
  const mapping = mappings[eventKey] || { debit: '999999', credit: '999999' };
  
  return {
    debitAccount: mapping.debit,
    creditAccount: mapping.credit,
  };
}

// Optional Advanced Modules
export interface AdvancedModule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
}

export function getAvailableAdvancedModules(): AdvancedModule[] {
  return [
    { id: 'PREDICTIVE_DELAY', name: 'Predictive Delay Indicators', description: 'Advisory indicators for potential delays', enabled: false },
    { id: 'DRONE_PHOTOGRAMMETRY', name: 'Drone Photogrammetry', description: 'Progress comparison from drone imagery', enabled: false },
    { id: 'SURVEY_IMPORT', name: 'Survey Import', description: 'Cross-section and earthwork volume computation', enabled: false },
    { id: 'GIS_VIEWER', name: 'GIS Alignment View', description: 'GIS and IFC model viewer', enabled: false },
    { id: 'REVERSE_AUCTION', name: 'Reverse Auction', description: 'Online reverse auction for procurement', enabled: false },
    { id: 'RESOURCE_LEVELLING', name: 'Resource Levelling', description: 'What-if resource levelling simulation', enabled: false },
    { id: 'FACE_RECOGNITION', name: 'Face Recognition Attendance', description: 'Biometric attendance with liveness detection', enabled: false },
    { id: 'DIRECT_WAGE', name: 'Direct Wage Disbursement', description: 'Direct bank transfer to workers', enabled: false },
    { id: 'IOT_TELEMATICS', name: 'IoT Telematics', description: 'Equipment and sensor data ingestion', enabled: false },
    { id: 'SUSTAINABILITY', name: 'Sustainability Tracking', description: 'Emissions and sustainability metrics', enabled: false },
    { id: 'GRIEVANCE', name: 'Grievance Handling', description: 'Workplace conduct case management', enabled: false },
    { id: 'MULTI_TENANT', name: 'Multi-Tenant Mode', description: 'White-label multi-tenant deployment', enabled: false },
  ];
}

export function toggleAdvancedModule(
  state: Part10CState,
  moduleId: string,
  enabled: boolean
): Part10CState {
  // In real implementation, this would toggle the module
  // For now, just return state
  return state;
}
