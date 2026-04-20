// ============================================================
// permissions.ts — unit tests
// Tests for flag constants, helpers, role presets,
// and permission lifecycle step builders.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest'
import {
  AUTHORITY_FLAG,
  TX_LOGS_FLAG,
  TX_BALANCES_FLAG,
  TX_MESSAGE_FLAG,
  ACCOUNT_SIGNATURES_FLAG,
  TRADER_FLAGS,
  AUDITOR_FLAGS,
  ADMIN_FLAGS,
  FLAG_DEFS_MAP,
  hasFlag,
  flagsToLabels,
  roleFromFlags,
  createPermissionStep,
  delegatePermissionStep,
  updatePermissionStep as _updatePermissionStep,
  commitAndUndelegateStep,
  revealPermissionStep,
  closePermissionStep,
  buildOrderPermissionLifecycle,
  type PermissionMember,
} from '../../lib/permissions'

// ─── Flag constant values ─────────────────────────────────

describe('Permission flag constants', () => {
  it('AUTHORITY_FLAG is 0x01', () => expect(AUTHORITY_FLAG).toBe(0x01))
  it('TX_LOGS_FLAG is 0x02',   () => expect(TX_LOGS_FLAG).toBe(0x02))
  it('TX_BALANCES_FLAG is 0x04', () => expect(TX_BALANCES_FLAG).toBe(0x04))
  it('TX_MESSAGE_FLAG is 0x08',  () => expect(TX_MESSAGE_FLAG).toBe(0x08))
  it('ACCOUNT_SIGNATURES_FLAG is 0x10', () => expect(ACCOUNT_SIGNATURES_FLAG).toBe(0x10))

  it('flags are distinct powers of 2', () => {
    const flags = [AUTHORITY_FLAG, TX_LOGS_FLAG, TX_BALANCES_FLAG, TX_MESSAGE_FLAG, ACCOUNT_SIGNATURES_FLAG]
    const set = new Set(flags)
    expect(set.size).toBe(5)
    flags.forEach(f => expect(f & (f - 1)).toBe(0)) // power of 2 check
  })
})

// ─── Role presets ─────────────────────────────────────────

describe('Role flag presets', () => {
  it('TRADER_FLAGS includes TX_LOGS and TX_BALANCES', () => {
    expect(TRADER_FLAGS & TX_LOGS_FLAG).toBeTruthy()
    expect(TRADER_FLAGS & TX_BALANCES_FLAG).toBeTruthy()
  })
  it('TRADER_FLAGS excludes AUTHORITY, TX_MESSAGE, ACCOUNT_SIGNATURES', () => {
    expect(TRADER_FLAGS & AUTHORITY_FLAG).toBe(0)
    expect(TRADER_FLAGS & TX_MESSAGE_FLAG).toBe(0)
    expect(TRADER_FLAGS & ACCOUNT_SIGNATURES_FLAG).toBe(0)
  })

  it('AUDITOR_FLAGS includes TX_LOGS, TX_BALANCES, TX_MESSAGE, ACCOUNT_SIGNATURES', () => {
    expect(AUDITOR_FLAGS & TX_LOGS_FLAG).toBeTruthy()
    expect(AUDITOR_FLAGS & TX_BALANCES_FLAG).toBeTruthy()
    expect(AUDITOR_FLAGS & TX_MESSAGE_FLAG).toBeTruthy()
    expect(AUDITOR_FLAGS & ACCOUNT_SIGNATURES_FLAG).toBeTruthy()
  })
  it('AUDITOR_FLAGS excludes AUTHORITY', () => {
    expect(AUDITOR_FLAGS & AUTHORITY_FLAG).toBe(0)
  })

  it('ADMIN_FLAGS includes all 5 flags', () => {
    expect(ADMIN_FLAGS & AUTHORITY_FLAG).toBeTruthy()
    expect(ADMIN_FLAGS & TX_LOGS_FLAG).toBeTruthy()
    expect(ADMIN_FLAGS & TX_BALANCES_FLAG).toBeTruthy()
    expect(ADMIN_FLAGS & TX_MESSAGE_FLAG).toBeTruthy()
    expect(ADMIN_FLAGS & ACCOUNT_SIGNATURES_FLAG).toBeTruthy()
  })

  it('ADMIN_FLAGS is superset of AUDITOR_FLAGS', () => {
    expect((ADMIN_FLAGS & AUDITOR_FLAGS) === AUDITOR_FLAGS).toBe(true)
  })
  it('ADMIN_FLAGS is superset of TRADER_FLAGS', () => {
    expect((ADMIN_FLAGS & TRADER_FLAGS) === TRADER_FLAGS).toBe(true)
  })
})

// ─── FLAG_DEFS_MAP ────────────────────────────────────────

describe('FLAG_DEFS_MAP', () => {
  const keys = ['AUTHORITY', 'TX_LOGS', 'TX_BALANCES', 'TX_MESSAGE', 'ACCOUNT_SIGNATURES']
  it('contains all 5 keys', () => {
    keys.forEach(k => expect(FLAG_DEFS_MAP).toHaveProperty(k))
  })
  it('each entry has flag, cls, and desc fields', () => {
    keys.forEach(k => {
      expect(FLAG_DEFS_MAP[k]).toHaveProperty('flag')
      expect(FLAG_DEFS_MAP[k]).toHaveProperty('cls')
      expect(FLAG_DEFS_MAP[k]).toHaveProperty('desc')
      expect(typeof FLAG_DEFS_MAP[k].flag).toBe('number')
      expect(typeof FLAG_DEFS_MAP[k].cls).toBe('string')
    })
  })
})

// ─── hasFlag ──────────────────────────────────────────────

describe('hasFlag()', () => {
  it('returns true when flag is set', () => {
    expect(hasFlag(TRADER_FLAGS, TX_LOGS_FLAG)).toBe(true)
    expect(hasFlag(ADMIN_FLAGS, AUTHORITY_FLAG)).toBe(true)
  })
  it('returns false when flag is not set', () => {
    expect(hasFlag(TRADER_FLAGS, AUTHORITY_FLAG)).toBe(false)
    expect(hasFlag(TRADER_FLAGS, TX_MESSAGE_FLAG)).toBe(false)
  })
  it('returns false for 0 flags', () => {
    expect(hasFlag(0, TX_LOGS_FLAG)).toBe(false)
  })
  it('bitwise AND is correct for combined flags', () => {
    const custom = TX_LOGS_FLAG | TX_MESSAGE_FLAG
    expect(hasFlag(custom, TX_LOGS_FLAG)).toBe(true)
    expect(hasFlag(custom, TX_MESSAGE_FLAG)).toBe(true)
    expect(hasFlag(custom, TX_BALANCES_FLAG)).toBe(false)
  })
})

// ─── flagsToLabels ────────────────────────────────────────

describe('flagsToLabels()', () => {
  it('returns empty array for 0 flags', () => {
    expect(flagsToLabels(0)).toEqual([])
  })
  it('returns correct labels for TRADER_FLAGS', () => {
    const labels = flagsToLabels(TRADER_FLAGS)
    expect(labels).toContain('TX_LOGS')
    expect(labels).toContain('TX_BALANCES')
    expect(labels).not.toContain('AUTHORITY')
    expect(labels).not.toContain('TX_MESSAGE')
  })
  it('returns all 5 labels for ADMIN_FLAGS', () => {
    const labels = flagsToLabels(ADMIN_FLAGS)
    expect(labels).toHaveLength(5)
    expect(labels).toContain('AUTHORITY')
    expect(labels).toContain('TX_LOGS')
    expect(labels).toContain('TX_BALANCES')
    expect(labels).toContain('TX_MESSAGE')
    expect(labels).toContain('ACCOUNT_SIGNATURES')
  })
  it('labels are ordered: AUTHORITY, TX_LOGS, TX_BALANCES, TX_MESSAGE, ACCOUNT_SIGNATURES', () => {
    const labels = flagsToLabels(ADMIN_FLAGS)
    expect(labels[0]).toBe('AUTHORITY')
    expect(labels[1]).toBe('TX_LOGS')
    expect(labels[4]).toBe('ACCOUNT_SIGNATURES')
  })
})

// ─── roleFromFlags ────────────────────────────────────────

describe('roleFromFlags()', () => {
  it('returns "admin" when AUTHORITY_FLAG is set', () => {
    expect(roleFromFlags(ADMIN_FLAGS)).toBe('admin')
  })
  it('returns "auditor" when TX_MESSAGE is set but not AUTHORITY', () => {
    expect(roleFromFlags(AUDITOR_FLAGS)).toBe('auditor')
  })
  it('returns "trader" for TRADER_FLAGS', () => {
    expect(roleFromFlags(TRADER_FLAGS)).toBe('trader')
  })
  it('classifies 0 flags as trader', () => {
    expect(roleFromFlags(0)).toBe('trader')
  })
})

// ─── Permission lifecycle steps ───────────────────────────

describe('createPermissionStep()', () => {
  it('returns correct step name', () => {
    const member: PermissionMember = { pubkey: 'Abc123', flags: TRADER_FLAGS }
    const step = createPermissionStep('TEST_ACCOUNT', [member])
    expect(step.step).toBe('create_permission')
    expect(step.status).toBe('pending')
  })
  it('description includes member count', () => {
    const members: PermissionMember[] = [
      { pubkey: 'A', flags: TRADER_FLAGS },
      { pubkey: 'B', flags: AUDITOR_FLAGS },
    ]
    const step = createPermissionStep('ACCOUNT', members)
    expect(step.description).toContain('2 member(s)')
  })
  it('includes required accounts', () => {
    const step = createPermissionStep('X', [])
    expect(step.accounts).toContain('permission_program')
    expect(step.accounts).toContain('payer')
  })
})

describe('delegatePermissionStep()', () => {
  it('returns correct step name', () => {
    const step = delegatePermissionStep('ACCOUNT', 'VALIDATOR123')
    expect(step.step).toBe('delegate_permission')
  })
  it('description references validator', () => {
    const step = delegatePermissionStep('ACCOUNT', 'MTEWGuqxUpYZGFJQcp8tLN7x5v9BSeoFHYWQQ3n3xzo')
    expect(step.description).toContain('MTEWGuqx')
  })
  it('accounts includes delegation_buffer, delegation_record, delegation_metadata', () => {
    const step = delegatePermissionStep('ACCOUNT', 'VALIDATOR')
    expect(step.accounts).toContain('delegation_buffer')
    expect(step.accounts).toContain('delegation_record')
    expect(step.accounts).toContain('delegation_metadata')
    expect(step.accounts).toContain('delegation_program')
  })
})

describe('revealPermissionStep()', () => {
  it('is named reveal_permission', () => {
    expect(revealPermissionStep('X').step).toBe('reveal_permission')
  })
  it('description mentions members: None as transitional', () => {
    const step = revealPermissionStep('ACCOUNT')
    const desc = step.description.toLowerCase()
    expect(desc).toMatch(/transitional|reveal|members/)
  })
  it('starts as pending status', () => {
    expect(revealPermissionStep('X').status).toBe('pending')
  })
})

describe('commitAndUndelegateStep()', () => {
  it('step name is commit_and_undelegate', () => {
    expect(commitAndUndelegateStep('X').step).toBe('commit_and_undelegate')
  })
  it('accounts includes magic_program and magic_context', () => {
    const step = commitAndUndelegateStep('X')
    expect(step.accounts).toContain('magic_program')
    expect(step.accounts).toContain('magic_context')
  })
})

describe('closePermissionStep()', () => {
  it('step name is close_permission', () => {
    expect(closePermissionStep('X').step).toBe('close_permission')
  })
})

// ─── buildOrderPermissionLifecycle ────────────────────────

describe('buildOrderPermissionLifecycle()', () => {
  const address = 'ORDER_PDA_TEST'
  const trader = 'TraderPubkeyABC123'
  const validator = 'MTEWGuqxUpYZGFJQcp8tLN7x5v9BSeoFHYWQQ3n3xzo'

  let steps: ReturnType<typeof buildOrderPermissionLifecycle>
  beforeEach(() => {
    steps = buildOrderPermissionLifecycle(address, trader, validator)
  })

  it('returns exactly 5 steps', () => {
    expect(steps).toHaveLength(5)
  })
  it('step order: create → delegate → commit → reveal → close', () => {
    expect(steps[0].step).toBe('create_permission')
    expect(steps[1].step).toBe('delegate_permission')
    expect(steps[2].step).toBe('commit_and_undelegate')
    expect(steps[3].step).toBe('reveal_permission')  // transitional — appears AFTER commit
    expect(steps[4].step).toBe('close_permission')
  })
  it('reveal_permission comes after commit_and_undelegate (correct ordering)', () => {
    const commitIdx = steps.findIndex(s => s.step === 'commit_and_undelegate')
    const revealIdx = steps.findIndex(s => s.step === 'reveal_permission')
    expect(revealIdx).toBeGreaterThan(commitIdx)
  })
  it('all steps start as pending', () => {
    steps.forEach(s => expect(s.status).toBe('pending'))
  })
})
