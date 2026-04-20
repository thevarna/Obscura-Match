// ============================================================
// Integration: Full auction lifecycle flow
// Tests the complete deposit → order → settle flow
// using MSW to mock all API calls.
// ============================================================

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { setupServer } from 'msw/node'
import { handlers } from '../handlers'
import { prepareDeposit, prepareWithdraw, prepareOrderSubmit, prepareSettlementTransfer, createDemoAuction, fetchPrivateBalance, makeAuditEvent } from '../../lib/auction'
import { buildOrderPermissionLifecycle, TRADER_FLAGS, AUDITOR_FLAGS, ADMIN_FLAGS, TX_MESSAGE_FLAG } from '../../lib/permissions'

const server = setupServer(...handlers)
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const TRADER   = 'So11111111111111111111111111111111111111112'
const AUDITOR  = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'
const TEST_MINT = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'

// ─── Full deposit flow ────────────────────────────────────

describe('Auction lifecycle: Deposit', () => {
  it('prepareDeposit returns both mintInitialized and response', async () => {
    const result = await prepareDeposit({ owner: TRADER, amount: 50000 })
    expect(result).toHaveProperty('response')
    expect(result).toHaveProperty('mintInitialized')
    expect(result.response.transactionBase64).toBeTruthy()
  })

  it('when mint is initialized, no initMintTx is returned', async () => {
    const result = await prepareDeposit({ owner: TRADER, amount: 10000 })
    if (result.mintInitialized) {
      expect(result.initMintTx).toBeUndefined()
    }
  })

  it('deposit with uninitialized mint triggers initialize-mint call first', async () => {
    const result = await prepareDeposit({ owner: TRADER, amount: 1000, mint: '4zMMC9uninitXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX' })
    expect(result.mintInitialized).toBe(false)
    expect(result.initMintTx).toBeDefined()
    expect(result.response).toBeDefined()
  })

  it('different deposit amounts produce valid responses', async () => {
    for (const amount of [100, 1000, 50000, 1_000_000]) {
      const result = await prepareDeposit({ owner: TRADER, amount })
      expect(result.response.transactionBase64).toBeTruthy()
    }
  })
})

// ─── Full withdraw flow ───────────────────────────────────

describe('Auction lifecycle: Withdraw', () => {
  it('prepareWithdraw returns a PaymentsApiResponse', async () => {
    const res = await prepareWithdraw({ owner: TRADER, amount: 5000 })
    expect(res).toHaveProperty('transactionBase64')
    expect(res).toHaveProperty('sendTo')
  })

  it('withdraw response has instructionCount >= 1', async () => {
    const res = await prepareWithdraw({ owner: TRADER, amount: 1000 })
    expect(res.instructionCount).toBeGreaterThanOrEqual(1)
  })

  it('withdraw with custom mint works', async () => {
    const res = await prepareWithdraw({ owner: TRADER, amount: 1000, mint: TEST_MINT })
    expect(res.transactionBase64).toBeTruthy()
  })
})

// ─── Full order submission flow ───────────────────────────

describe('Auction lifecycle: Order submission', () => {
  const auction = createDemoAuction()

  it('prepareOrderSubmit returns order, permissionSteps, transferTx', async () => {
    const result = await prepareOrderSubmit({
      auctionId: auction.id,
      trader: TRADER,
      side: 'buy',
      size: 50000,
      limitPrice: 0.0044,
      expiry: Math.floor(Date.now() / 1000) + 900,
    })
    expect(result).toHaveProperty('order')
    expect(result).toHaveProperty('permissionSteps')
    expect(result).toHaveProperty('transferTx')
  })

  it('order has correct side', async () => {
    const { order } = await prepareOrderSubmit({
      auctionId: auction.id, trader: TRADER,
      side: 'sell', size: 25000, limitPrice: 0.0042,
      expiry: Math.floor(Date.now() / 1000) + 900,
    })
    expect(order.side).toBe('sell')
  })

  it('order id is unique across calls', async () => {
    const params = { auctionId: auction.id, trader: TRADER, side: 'buy' as const, size: 1000, limitPrice: 0.004, expiry: 9999999 }
    const r1 = await prepareOrderSubmit(params)
    const r2 = await prepareOrderSubmit(params)
    expect(r1.order.id).not.toBe(r2.order.id)
  })

  it('order status is "submitted" initially', async () => {
    const { order } = await prepareOrderSubmit({
      auctionId: auction.id, trader: TRADER,
      side: 'buy', size: 10000, limitPrice: 0.0044,
      expiry: Math.floor(Date.now() / 1000) + 900,
    })
    expect(order.status).toBe('submitted')
  })

  it('permissionSteps has 5 steps in correct sequence', async () => {
    const { permissionSteps } = await prepareOrderSubmit({
      auctionId: auction.id, trader: TRADER,
      side: 'buy', size: 1000, limitPrice: 0.004,
      expiry: Math.floor(Date.now() / 1000) + 900,
    })
    expect(permissionSteps).toHaveLength(5)
    expect(permissionSteps[0].step).toBe('create_permission')
    expect(permissionSteps[1].step).toBe('delegate_permission')
    expect(permissionSteps[2].step).toBe('commit_and_undelegate')
    expect(permissionSteps[3].step).toBe('reveal_permission')  // transitional
    expect(permissionSteps[4].step).toBe('close_permission')
  })

  it('reveal_permission appears AFTER commit_and_undelegate', async () => {
    const { permissionSteps } = await prepareOrderSubmit({
      auctionId: auction.id, trader: TRADER,
      side: 'buy', size: 1000, limitPrice: 0.004,
      expiry: Math.floor(Date.now() / 1000) + 900,
    })
    const commitIdx = permissionSteps.findIndex(s => s.step === 'commit_and_undelegate')
    const revealIdx = permissionSteps.findIndex(s => s.step === 'reveal_permission')
    expect(revealIdx).toBeGreaterThan(commitIdx)
  })

  it('transferTx has a transactionBase64', async () => {
    const { transferTx } = await prepareOrderSubmit({
      auctionId: auction.id, trader: TRADER,
      side: 'buy', size: 5000, limitPrice: 0.004,
      expiry: Math.floor(Date.now() / 1000) + 900,
    })
    expect(transferTx.transactionBase64).toBeTruthy()
  })
})

// ─── Settlement transfer flow ─────────────────────────────

describe('Auction lifecycle: Settlement transfer', () => {
  it('prepareSettlementTransfer returns response', async () => {
    const res = await prepareSettlementTransfer(TRADER, AUDITOR, 47500)
    expect(res).toHaveProperty('transactionBase64')
  })

  it('settlement transfer is public (instructionCount = 3)', async () => {
    const res = await prepareSettlementTransfer(TRADER, AUDITOR, 47500)
    expect(res.instructionCount).toBe(3)
  })
})

// ─── fetchPrivateBalance ──────────────────────────────────

describe('fetchPrivateBalance()', () => {
  it('returns a number', async () => {
    const balance = await fetchPrivateBalance(TRADER)
    expect(typeof balance).toBe('number')
  })
  it('returns 100000 for mocked trader', async () => {
    const balance = await fetchPrivateBalance(TRADER)
    expect(balance).toBe(100000)
  })
})

// ─── Audit event generation during flow ───────────────────

describe('Audit event generation', () => {
  it('generates trader-tier event for order submission', () => {
    const e = makeAuditEvent(TRADER, 'submit_order', 'trader')
    expect(e.visibilityTier).toBe('trader')
    expect(e.action).toBe('submit_order')
  })

  it('generates admin-tier event for auction close', () => {
    const e = makeAuditEvent('admin_authority', 'close_auction', 'admin')
    expect(e.visibilityTier).toBe('admin')
  })

  it('generates public-tier event for settlement', () => {
    const e = makeAuditEvent('system', 'settlement_committed', 'public')
    expect(e.visibilityTier).toBe('public')
  })

  it('all 4 visibility tiers are supported', () => {
    const tiers = ['public', 'trader', 'auditor', 'admin'] as const
    tiers.forEach(tier => {
      const e = makeAuditEvent('Actor', 'action', tier)
      expect(e.visibilityTier).toBe(tier)
    })
  })

  it('audit event ID is unique per invocation', () => {
    const ids = new Set(
      Array.from({ length: 100 }, () => makeAuditEvent('A', 'b', 'trader').id)
    )
    expect(ids.size).toBe(100)
  })
})

// ─── Permission + role matrix cross-check ─────────────────

describe('Role + permission coverage', () => {
  it('Auditor flags are a superset of Trader flags', () => {
    expect((AUDITOR_FLAGS & TRADER_FLAGS) === TRADER_FLAGS).toBe(true)
  })
  it('Admin flags are a superset of Auditor flags', () => {
    expect((ADMIN_FLAGS & AUDITOR_FLAGS) === AUDITOR_FLAGS).toBe(true)
  })
  it('Trader cannot read TX_MESSAGE', () => {
    expect(TRADER_FLAGS & TX_MESSAGE_FLAG).toBe(0)
  })
  it('lifecycle has no matching step — cranks only', () => {
    const steps = buildOrderPermissionLifecycle('PDA', TRADER, 'VALIDATOR')
    const stepNames = steps.map(s => s.step)
    expect(stepNames).not.toContain('match')
    expect(stepNames).not.toContain('matching')
  })
})
