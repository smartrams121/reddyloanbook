import { Role } from './constants'
import type { AuthUser } from './auth'
import { resolveAgentActions, type AgentPermissionGrid } from './agent-permissions'

export type Action =
  | 'manage_owners'
  | 'view_platform_summary'
  | 'create_business'
  | 'edit_business_settings'
  | 'deactivate_business'
  | 'create_business_admin'
  | 'create_agent'
  | 'assign_villages'
  | 'reset_user_password'
  | 'deactivate_user'
  | 'add_village'
  | 'edit_village'
  | 'view_village_list'
  | 'create_customer'
  | 'edit_customer'
  | 'delete_customer'
  | 'move_customer_village'
  | 'view_customer'
  | 'view_loan'
  | 'create_loan'
  | 'edit_loan'
  | 'settle_loan'
  | 'writeoff_loan'
  | 'view_payments'
  | 'view_record_payment'
  | 'view_bulk_payment'
  | 'post_payment'
  | 'edit_own_payment_today'
  | 'edit_any_payment'
  | 'delete_payment'
  | 'backdate_payment'
  | 'bulk_posting'
  | 'view_all_reports'
  | 'view_own_collection_report'
  | 'view_other_agent_reports'
  | 'view_business_comparison'
  | 'record_cash_handover'
  | 'manage_cash_book'
  | 'manage_expenses'
  | 'manage_holidays'
  | 'manage_expense_categories'
  | 'delete_loan'
  | 'manage_loan_status'
  | 'grant_support_access'
  | 'manage_platform_settings'
  | 'manage_registration_requests'
  | 'manage_password_resets'
  | 'manage_employee_password_resets'

const PERMISSION_MATRIX: Record<string, Action[]> = {
  [Role.PLATFORM_ADMIN]: [
    'manage_owners',
    'view_platform_summary',
    'manage_platform_settings',
    'manage_registration_requests',
    'manage_password_resets',
  ],
  [Role.OWNER]: [
    'create_business',
    'edit_business_settings',
    'deactivate_business',
    'create_business_admin',
    'create_agent',
    'assign_villages',
    'reset_user_password',
    'deactivate_user',
    'add_village',
    'edit_village',
    'view_village_list',
    'create_customer',
    'edit_customer',
    'delete_customer',
    'move_customer_village',
    'view_customer',
    'view_loan',
    'create_loan',
    'edit_loan',
    'settle_loan',
    'writeoff_loan',
    'view_payments',
    'view_record_payment',
    'view_bulk_payment',
    'post_payment',
    'edit_own_payment_today',
    'edit_any_payment',
    'delete_payment',
    'backdate_payment',
    'bulk_posting',
    'view_all_reports',
    'view_own_collection_report',
    'view_other_agent_reports',
    'view_business_comparison',
    'record_cash_handover',
    'manage_cash_book',
    'manage_expenses',
    'manage_holidays',
    'manage_expense_categories',
    'delete_loan',
    'manage_loan_status',
    'grant_support_access',
    'manage_employee_password_resets',
  ],
  [Role.BUSINESS_ADMIN]: [
    'create_business',
    'edit_business_settings',
    'deactivate_business',
    'create_agent',
    'assign_villages',
    'reset_user_password',
    'deactivate_user',
    'add_village',
    'edit_village',
    'view_village_list',
    'create_customer',
    'edit_customer',
    'delete_customer',
    'move_customer_village',
    'view_customer',
    'view_loan',
    'create_loan',
    'edit_loan',
    'settle_loan',
    'writeoff_loan',
    'view_payments',
    'view_record_payment',
    'view_bulk_payment',
    'post_payment',
    'edit_own_payment_today',
    'edit_any_payment',
    'delete_payment',
    'backdate_payment',
    'bulk_posting',
    'view_all_reports',
    'view_own_collection_report',
    'view_other_agent_reports',
    'record_cash_handover',
    'manage_cash_book',
    'manage_expenses',
    'manage_holidays',
    'delete_loan',
    'manage_loan_status',
    'manage_expense_categories',
    'manage_employee_password_resets',
    'view_business_comparison',
  ],
  [Role.AGENT]: [
    'view_village_list',
    'view_customer',
    'post_payment',
    'edit_own_payment_today',
    'bulk_posting',
    'view_own_collection_report',
  ],
}

export function hasPermission(user: AuthUser, action: Action, businessId?: string): boolean {
  if (user.role !== Role.AGENT) {
    return PERMISSION_MATRIX[user.role]?.includes(action) ?? false
  }
  const bid = businessId ?? user.activeBusinessId
  if (!bid) return false
  const grid = user.agentPermissions ? (user.agentPermissions[bid] ?? null) : null
  return resolveAgentActions(grid).has(action)
}

export function assertPermission(user: AuthUser, action: Action, businessId?: string): void {
  if (!hasPermission(user, action, businessId)) {
    throw new PermissionError(`You don't have permission to ${action.replace(/_/g, ' ')}`)
  }
}

export class PermissionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PermissionError'
  }
}
