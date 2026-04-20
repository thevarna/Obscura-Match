// ============================================================
// Obscura Match — Access Control / Permission lifecycle
// Uses exact SDK flag constants from @magicblock-labs/ephemeral-rollups-sdk
// ============================================================

import type { PublicKey } from '@solana/web3.js'

// --- Exact SDK flag constants (re-exported for convenience) --
// These are imported from the SDK in real CPI calls; exposed here for UI use.
export const AUTHORITY_FLAG          = 1 << 0  // 0x01
export const TX_LOGS_FLAG            = 1 << 1  // 0x02
export const TX_BALANCES_FLAG        = 1 << 2  // 0x04
export const TX_MESSAGE_FLAG         = 1 << 3  // 0x08
export const ACCOUNT_SIGNATURES_FLAG = 1 << 4  // 0x10

// --- Flag definition map (for UI rendering) ------------------
export const FLAG_DEFS_MAP: Record<string, { flag: number; cls: string; desc: string }> = {
  AUTHORITY:          { flag: AUTHORITY_FLAG,          cls: 'flag-chip--authority',   desc: 'Modify permissions, add/remove members' },
  TX_LOGS:            { flag: TX_LOGS_FLAG,            cls: 'flag-chip--tx-logs',     desc: 'View transaction execution logs' },
  TX_BALANCES:        { flag: TX_BALANCES_FLAG,        cls: 'flag-chip--tx-balances', desc: 'View account balance changes' },
  TX_MESSAGE:         { flag: TX_MESSAGE_FLAG,         cls: 'flag-chip--tx-message',  desc: 'View transaction message data' },
  ACCOUNT_SIGNATURES: { flag: ACCOUNT_SIGNATURES_FLAG, cls: 'flag-chip--signatures',  desc: 'View account signatures' },
}

// --- Role flag presets (account-level, not per-field) --------
export const TRADER_FLAGS   = TX_LOGS_FLAG | TX_BALANCES_FLAG
export const AUDITOR_FLAGS  = TX_LOGS_FLAG | TX_BALANCES_FLAG | TX_MESSAGE_FLAG | ACCOUNT_SIGNATURES_FLAG
export const ADMIN_FLAGS    = AUTHORITY_FLAG | TX_LOGS_FLAG | TX_BALANCES_FLAG | TX_MESSAGE_FLAG | ACCOUNT_SIGNATURES_FLAG

// --- Member type ---------------------------------------------
export interface PermissionMember {
  pubkey: PublicKey | string
  flags: number
  label?: string
  role?: 'trader' | 'auditor' | 'admin'
}

// --- Flag helpers --------------------------------------------
export function hasFlag(flags: number, flag: number): boolean {
  return (flags & flag) !== 0
}

export function flagsToLabels(flags: number): string[] {
  const labels: string[] = []
  if (hasFlag(flags, AUTHORITY_FLAG))          labels.push('AUTHORITY')
  if (hasFlag(flags, TX_LOGS_FLAG))            labels.push('TX_LOGS')
  if (hasFlag(flags, TX_BALANCES_FLAG))        labels.push('TX_BALANCES')
  if (hasFlag(flags, TX_MESSAGE_FLAG))         labels.push('TX_MESSAGE')
  if (hasFlag(flags, ACCOUNT_SIGNATURES_FLAG)) labels.push('ACCOUNT_SIGNATURES')
  return labels
}

export function roleFromFlags(flags: number): string {
  if (hasFlag(flags, AUTHORITY_FLAG)) return 'admin'
  if (hasFlag(flags, TX_MESSAGE_FLAG)) return 'auditor'
  return 'trader'
}

// --- Permission Lifecycle (client-side orchestration) --------
// Each function builds the right SDK instruction and returns
// a description of what it would do. In a live integration,
// these build instructions via CPI builders from the SDK.

export interface PermissionStep {
  step: string
  description: string
  accounts: string[]
  status: 'pending' | 'done' | 'error'
}

/**
 * Step 1: Create permission account for a permissioned PDA.
 * Sets initial members with role-appropriate flags.
 * Uses CreatePermissionCpiBuilder from the ACL program.
 */
export function createPermissionStep(
  permissionedAccount: string,
  members: PermissionMember[]
): PermissionStep {
  return {
    step: 'create_permission',
    description: `Create permission PDA for ${permissionedAccount.slice(0, 8)}… with ${members.length} member(s)`,
    accounts: ['permissioned_account', 'permission', 'payer', 'system_program', 'permission_program'],
    status: 'pending',
  }
}

/**
 * Step 2: Delegate BOTH the permission account AND the permissioned account
 * to the TEE validator. This enables PER-enforced access control.
 * Uses DelegatePermissionCpiBuilder.
 */
export function delegatePermissionStep(
  _permissionedAccount: string,
  validator: string
): PermissionStep {
  return {
    step: 'delegate_permission',
    description: `Delegate permission + permissioned account to TEE validator ${validator.slice(0, 8)}…`,
    accounts: [
      'payer', 'authority', 'permissioned_account', 'permission',
      'system_program', 'owner_program',
      'delegation_buffer', 'delegation_record', 'delegation_metadata',
      'delegation_program', 'validator',
    ],
    status: 'pending',
  }
}

/**
 * Step 3: Update permission (add/remove members, change flags).
 * Can be called in real-time on the PER without undelegating.
 * Uses UpdatePermissionCpiBuilder.
 */
export function updatePermissionStep(
  permissionedAccount: string,
  newMembers: PermissionMember[]
): PermissionStep {
  return {
    step: 'update_permission',
    description: `Update members on ${permissionedAccount.slice(0, 8)}… (${newMembers.length} member(s))`,
    accounts: ['authority', 'permissioned_account', 'permission'],
    status: 'pending',
  }
}

/**
 * Step 4: Commit & undelegate — called at settlement finalization.
 * Syncs final PER state back to Solana base chain.
 * Uses CommitAndUndelegatePermissionCpiBuilder.
 */
export function commitAndUndelegateStep(permissionedAccount: string): PermissionStep {
  return {
    step: 'commit_and_undelegate',
    description: `Commit state + undelegate ${permissionedAccount.slice(0, 8)}… back to Solana`,
    accounts: ['authority', 'permissioned_account', 'permission', 'magic_program', 'magic_context'],
    status: 'pending',
  }
}

/**
 * Reveal step (transitional only — ONE TIME per lifecycle, post-settlement).
 * Sets members: None → account becomes temporarily visible for result read-out.
 * Uses UpdatePermissionCpiBuilder with members: None.
 *
 * NOTE: This is a *transitional* state during cleanup, not a permanent public tier.
 * Per docs: "temporarily visible — useful for transitional states during undelegation"
 */
export function revealPermissionStep(permissionedAccount: string): PermissionStep {
  return {
    step: 'reveal_permission',
    description: `Transitional reveal: set members: None on ${permissionedAccount.slice(0, 8)}… to expose settlement result`,
    accounts: ['authority', 'permissioned_account', 'permission'],
    status: 'pending',
  }
}

/**
 * Step 6: Close permission account — reclaim lamports.
 * Must be called after commit_and_undelegate.
 * Uses ClosePermissionCpiBuilder.
 */
export function closePermissionStep(permissionedAccount: string): PermissionStep {
  return {
    step: 'close_permission',
    description: `Close permission PDA for ${permissionedAccount.slice(0, 8)}… and reclaim lamports`,
    accounts: ['payer', 'authority', 'permissioned_account', 'permission'],
    status: 'pending',
  }
}

/**
 * Full lifecycle steps for one OrderIntent.
 * Returns the ordered permission steps for the UI timeline.
 */
export function buildOrderPermissionLifecycle(
  orderIntentAddress: string,
  traderPubkey: string,
  validator: string
): PermissionStep[] {
  const trader: PermissionMember = {
    pubkey: traderPubkey,
    flags: TRADER_FLAGS,
    label: 'Trader',
    role: 'trader',
  }
  return [
    createPermissionStep(orderIntentAddress, [trader]),
    delegatePermissionStep(orderIntentAddress, validator),
    // (order lives in PER — matching executes here)
    commitAndUndelegateStep(orderIntentAddress),
    revealPermissionStep(orderIntentAddress),  // transitional
    closePermissionStep(orderIntentAddress),
  ]
}
