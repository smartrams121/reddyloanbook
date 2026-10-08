export interface AgentPermissionGrid {
  customers: { view: boolean; create: boolean; edit: boolean; delete: boolean }
  loans: { view: boolean; create: boolean; edit: boolean; delete: boolean }
  payments: { view: boolean }
  record_payment: { view: boolean; create: boolean; edit: boolean }
  bulk_payment: { view: boolean; create: boolean; edit: boolean }
  reports: { view: boolean }
}

export type PermissionObject = keyof AgentPermissionGrid
export type PermissionVerb = 'view' | 'create' | 'edit' | 'delete'

export const PRESETS: Record<string, AgentPermissionGrid> = {
  COLLECTOR_ONLY: {
    customers: { view: true, create: false, edit: false, delete: false },
    loans: { view: true, create: false, edit: false, delete: false },
    payments: { view: true },
    record_payment: { view: true, create: true, edit: true },
    bulk_payment: { view: true, create: true, edit: true },
    reports: { view: true },
  },
  FIELD_MANAGER: {
    customers: { view: true, create: true, edit: true, delete: false },
    loans: { view: true, create: true, edit: true, delete: false },
    payments: { view: true },
    record_payment: { view: true, create: true, edit: true },
    bulk_payment: { view: true, create: true, edit: true },
    reports: { view: true },
  },
  FULL_ACCESS: {
    customers: { view: true, create: true, edit: true, delete: true },
    loans: { view: true, create: true, edit: true, delete: true },
    payments: { view: true },
    record_payment: { view: true, create: true, edit: true },
    bulk_payment: { view: true, create: true, edit: true },
    reports: { view: true },
  },
}

export const DEFAULT_PRESET = 'COLLECTOR_ONLY'

export const TOGGLE_TO_ACTIONS: Record<string, string[]> = {
  'customers.view': ['view_customer'],
  'customers.create': ['create_customer'],
  'customers.edit': ['edit_customer'],
  'customers.delete': ['delete_customer'],
  'loans.view': ['view_loan'],
  'loans.create': ['create_loan'],
  'loans.edit': ['edit_loan'],
  'loans.delete': ['delete_loan'],
  'payments.view': ['view_payments'],
  'record_payment.view': ['view_record_payment'],
  'record_payment.create': ['post_payment'],
  'record_payment.edit': ['edit_own_payment_today'],
  'bulk_payment.view': ['view_bulk_payment'],
  'bulk_payment.create': ['bulk_posting'],
  'bulk_payment.edit': ['edit_own_payment_today'],
  'reports.view': ['view_own_collection_report'],
}

export function applyCascades(grid: AgentPermissionGrid): AgentPermissionGrid {
  const g = JSON.parse(JSON.stringify(grid)) as AgentPermissionGrid

  if (!g.payments.view) {
    g.record_payment = { view: false, create: false, edit: false }
    g.bulk_payment = { view: false, create: false, edit: false }
  }

  for (const key of ['customers', 'loans'] as const) {
    if (!g[key].view) {
      g[key] = { view: false, create: false, edit: false, delete: false }
    }
  }
  for (const key of ['record_payment', 'bulk_payment'] as const) {
    if (!g[key].view) {
      g[key] = { view: false, create: false, edit: false }
    }
  }

  return g
}

export function resolveAgentActions(grid: AgentPermissionGrid | null): Set<string> {
  const effective = applyCascades(grid ?? PRESETS.COLLECTOR_ONLY)
  const actions = new Set<string>()
  actions.add('view_village_list')

  for (const [toggleKey, actionList] of Object.entries(TOGGLE_TO_ACTIONS)) {
    const [obj, verb] = toggleKey.split('.')
    const objPerms = effective[obj as PermissionObject]
    if (objPerms && (objPerms as Record<string, boolean>)[verb]) {
      for (const a of actionList) actions.add(a)
    }
  }

  return actions
}

export function detectPreset(grid: AgentPermissionGrid): string {
  for (const [name, preset] of Object.entries(PRESETS)) {
    if (JSON.stringify(applyCascades(grid)) === JSON.stringify(applyCascades(preset))) {
      return name
    }
  }
  return 'CUSTOM'
}
