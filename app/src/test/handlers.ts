// ============================================================
// MSW handlers — mock the MagicBlock Private Payments API
// for all unit and integration tests.
// ============================================================

import { http, HttpResponse } from 'msw'

const PAYMENTS_BASE = 'https://payments.magicblock.app/v1/spl'

const MOCK_TX_RESPONSE = {
  kind: 'transaction',
  version: 'legacy',
  transactionBase64: 'AQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABQAQID',
  requiredSigners: ['So11111111111111111111111111111111111111112'],
  sendTo: 'https://api.devnet.solana.com',
  recentBlockhash: 'FwRYtTPRk5N4wUeQnj2PZBxU94VTFrDMcQKUgMKkKMm',
  lastValidBlockHeight: 999999,
  instructionCount: 2,
  validator: 'MTEWGuqxUpYZGFJQcp8tLN7x5v9BSeoFHYWQQ3n3xzo',
}

export const handlers = [
  // --- Deposit -------------------------------------------
  http.post(`${PAYMENTS_BASE}/deposit`, () =>
    HttpResponse.json(MOCK_TX_RESPONSE)
  ),

  // --- Withdraw -----------------------------------------
  http.post(`${PAYMENTS_BASE}/withdraw`, () =>
    HttpResponse.json({ ...MOCK_TX_RESPONSE, instructionCount: 1 })
  ),

  // --- Transfer -----------------------------------------
  http.post(`${PAYMENTS_BASE}/transfer`, () =>
    HttpResponse.json({ ...MOCK_TX_RESPONSE, instructionCount: 3 })
  ),

  // --- Initialize Mint ----------------------------------
  http.post(`${PAYMENTS_BASE}/initialize-mint`, () =>
    HttpResponse.json({ ...MOCK_TX_RESPONSE, instructionCount: 1 })
  ),

  // --- Balance ------------------------------------------
  http.get(`${PAYMENTS_BASE}/balance`, ({ request }) => {
    const url = new URL(request.url)
    const owner = url.searchParams.get('owner') ?? ''
    return HttpResponse.json({ balance: owner.includes('empty') ? 0 : 250000 })
  }),

  // --- Private Balance ----------------------------------
  http.get(`${PAYMENTS_BASE}/private-balance`, ({ request }) => {
    const url = new URL(request.url)
    const owner = url.searchParams.get('owner') ?? ''
    return HttpResponse.json({ balance: owner.includes('empty') ? 0 : 100000 })
  }),

  // --- Is Mint Initialized ------------------------------
  http.get(`${PAYMENTS_BASE}/is-mint-initialized`, ({ request }) => {
    const url = new URL(request.url)
    const mint = url.searchParams.get('mint') ?? ''
    return HttpResponse.json({ initialized: !mint.includes('uninit') })
  }),
]

// --- Error variants for negative-path tests ---------------
export const errorHandlers = {
  depositFail: http.post(`${PAYMENTS_BASE}/deposit`, () =>
    HttpResponse.json({ error: 'Insufficient balance' }, { status: 400 })
  ),
  withdrawFail: http.post(`${PAYMENTS_BASE}/withdraw`, () =>
    HttpResponse.json({ error: 'Insufficient private balance' }, { status: 400 })
  ),
  balanceFail: http.get(`${PAYMENTS_BASE}/balance`, () =>
    HttpResponse.json({ error: 'RPC error' }, { status: 500 })
  ),
  privateBalanceFail: http.get(`${PAYMENTS_BASE}/private-balance`, () =>
    HttpResponse.json({ error: 'TEE unavailable' }, { status: 503 })
  ),
}
