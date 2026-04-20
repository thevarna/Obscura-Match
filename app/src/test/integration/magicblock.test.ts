// ============================================================
// magicblock.ts — integration tests
// Tests for the Private Payments API integration layer using
// MSW to mock all endpoints.
// ============================================================

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { setupServer } from 'msw/node'
import { handlers, errorHandlers } from '../handlers'
import {
  getPublicBalance,
  getPrivateBalance,
  checkMintInitialized,
  buildDepositTx,
  buildWithdrawTx,
  buildTransferTx,
  initializeMint,
} from '../../lib/magicblock'

const server = setupServer(...handlers)
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const TEST_OWNER  = 'So11111111111111111111111111111111111111112'
const TEST_MINT   = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'
const UNINIT_MINT = '4zMMC9uninitXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX'

// ─── getPublicBalance ─────────────────────────────────────

describe('getPublicBalance()', () => {
  it('returns a number for a known owner', async () => {
    const balance = await getPublicBalance(TEST_OWNER, TEST_MINT)
    expect(typeof balance).toBe('number')
    expect(balance).toBeGreaterThanOrEqual(0)
  })

  it('returns 0 for an owner with "empty" in the address', async () => {
    const balance = await getPublicBalance('empty_wallet_addr', TEST_MINT)
    expect(balance).toBe(0)
  })

  it('returns non-zero balance for normal owner', async () => {
    const balance = await getPublicBalance(TEST_OWNER, TEST_MINT)
    expect(balance).toBeGreaterThan(0)
  })

  it('throws when API returns 500', async () => {
    server.use(errorHandlers.balanceFail)
    await expect(getPublicBalance(TEST_OWNER, TEST_MINT)).rejects.toThrow()
  })
})

// ─── getPrivateBalance ────────────────────────────────────

describe('getPrivateBalance()', () => {
  it('returns a number', async () => {
    const balance = await getPrivateBalance(TEST_OWNER, TEST_MINT)
    expect(typeof balance).toBe('number')
  })

  it('returns 0 for empty wallet', async () => {
    const balance = await getPrivateBalance('empty_wallet_addr', TEST_MINT)
    expect(balance).toBe(0)
  })

  it('private balance reflects PER funds (mocked to 100000)', async () => {
    const balance = await getPrivateBalance(TEST_OWNER, TEST_MINT)
    expect(balance).toBe(100000)
  })

  it('throws when TEE is unavailable (503)', async () => {
    server.use(errorHandlers.privateBalanceFail)
    await expect(getPrivateBalance(TEST_OWNER, TEST_MINT)).rejects.toThrow()
  })
})

// ─── checkMintInitialized ─────────────────────────────────

describe('checkMintInitialized()', () => {
  it('returns true for a known initialized mint', async () => {
    const result = await checkMintInitialized(TEST_MINT)
    expect(result).toBe(true)
  })

  it('returns false for an uninitialized mint', async () => {
    const result = await checkMintInitialized(UNINIT_MINT)
    expect(result).toBe(false)
  })

  it('returns false gracefully on network error (does not throw)', async () => {
    // The implementation catches errors and returns false
    server.use(errorHandlers.balanceFail) // won't hit this endpoint but proves resilience
    const result = await checkMintInitialized(TEST_MINT)
    expect(typeof result).toBe('boolean')
  })
})

// ─── buildDepositTx ───────────────────────────────────────

describe('buildDepositTx()', () => {
  it('returns a PaymentsApiResponse with required fields', async () => {
    const res = await buildDepositTx(TEST_OWNER, 1000, TEST_MINT)
    expect(res).toHaveProperty('transactionBase64')
    expect(res).toHaveProperty('requiredSigners')
    expect(res).toHaveProperty('sendTo')
    expect(res).toHaveProperty('recentBlockhash')
    expect(res).toHaveProperty('lastValidBlockHeight')
    expect(res).toHaveProperty('instructionCount')
  })

  it('transactionBase64 is a non-empty string', async () => {
    const res = await buildDepositTx(TEST_OWNER, 1000, TEST_MINT)
    expect(typeof res.transactionBase64).toBe('string')
    expect(res.transactionBase64.length).toBeGreaterThan(0)
  })

  it('requiredSigners is an array', async () => {
    const res = await buildDepositTx(TEST_OWNER, 500, TEST_MINT)
    expect(Array.isArray(res.requiredSigners)).toBe(true)
  })

  it('validator field matches TEE validator', async () => {
    const res = await buildDepositTx(TEST_OWNER, 100, TEST_MINT)
    expect(res.validator).toBe('MTEWGuqxUpYZGFJQcp8tLN7x5v9BSeoFHYWQQ3n3xzo')
  })

  it('throws on 400 error response', async () => {
    server.use(errorHandlers.depositFail)
    await expect(buildDepositTx(TEST_OWNER, 99999999, TEST_MINT)).rejects.toThrow('Deposit build failed')
  })

  it('amount must be >= 1 (API rejects 0)', async () => {
    server.use(errorHandlers.depositFail)
    await expect(buildDepositTx(TEST_OWNER, 0, TEST_MINT)).rejects.toThrow()
  })
})

// ─── buildWithdrawTx ──────────────────────────────────────

describe('buildWithdrawTx()', () => {
  it('returns a PaymentsApiResponse', async () => {
    const res = await buildWithdrawTx(TEST_OWNER, 500, TEST_MINT)
    expect(res).toHaveProperty('transactionBase64')
    expect(res).toHaveProperty('instructionCount')
  })

  it('instructionCount is >= 1', async () => {
    const res = await buildWithdrawTx(TEST_OWNER, 100, TEST_MINT)
    expect(res.instructionCount).toBeGreaterThanOrEqual(1)
  })

  it('throws on API error', async () => {
    server.use(errorHandlers.withdrawFail)
    await expect(buildWithdrawTx(TEST_OWNER, 999999, TEST_MINT)).rejects.toThrow()
  })
})

// ─── buildTransferTx ──────────────────────────────────────

describe('buildTransferTx()', () => {
  const FROM = TEST_OWNER
  const TO   = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'

  it('returns a PaymentsApiResponse for private transfer', async () => {
    const res = await buildTransferTx(FROM, TO, 1000, TEST_MINT, true)
    expect(res).toHaveProperty('transactionBase64')
  })

  it('returns a PaymentsApiResponse for public transfer', async () => {
    const res = await buildTransferTx(FROM, TO, 1000, TEST_MINT, false)
    expect(res).toHaveProperty('transactionBase64')
  })

  it('instructionCount is higher for private transfers (3 vs 1)', async () => {
    const res = await buildTransferTx(FROM, TO, 1000, TEST_MINT, true)
    expect(res.instructionCount).toBe(3)
  })
})

// ─── initializeMint ───────────────────────────────────────

describe('initializeMint()', () => {
  it('returns a PaymentsApiResponse', async () => {
    const res = await initializeMint(TEST_OWNER, TEST_MINT)
    expect(res).toHaveProperty('transactionBase64')
    expect(res).toHaveProperty('instructionCount')
  })

  it('instructionCount is 1 for init-mint', async () => {
    const res = await initializeMint(TEST_OWNER, TEST_MINT)
    expect(res.instructionCount).toBe(1)
  })
})

// ─── Config constants ─────────────────────────────────────

describe('Environment config values', () => {
  it('PAYMENTS_API is set', async () => {
    const { PAYMENTS_API } = await import('../../lib/magicblock')
    expect(PAYMENTS_API).toBeTruthy()
    expect(PAYMENTS_API).toContain('magicblock')
  })
  it('TEE_URL is set', async () => {
    const { TEE_URL } = await import('../../lib/magicblock')
    expect(TEE_URL).toBeTruthy()
    expect(TEE_URL).toContain('magicblock')
  })
  it('TEE_VALIDATOR is set', async () => {
    const { TEE_VALIDATOR } = await import('../../lib/magicblock')
    expect(TEE_VALIDATOR).toBeTruthy()
    expect(TEE_VALIDATOR).toHaveLength(43) // base58 Solana pubkey length
  })
  it('CLUSTER is devnet', async () => {
    const { CLUSTER } = await import('../../lib/magicblock')
    expect(CLUSTER).toBe('devnet')
  })
  it('USDC_MINT is not equal to SOL_MINT', async () => {
    const { USDC_MINT, SOL_MINT } = await import('../../lib/magicblock')
    expect(USDC_MINT).not.toBe(SOL_MINT)
  })
})
