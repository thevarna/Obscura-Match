// ============================================================
// Obscura Match — MagicBlock Private Payments API integration
// All config is environment-driven, never hardcoded.
// ============================================================

import { Connection, PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js'

// --- Config (from environment) ----------------------------
export const PAYMENTS_API   = import.meta.env.VITE_PAYMENTS_API   ?? 'https://payments.magicblock.app/v1/spl'
export const TEE_URL        = import.meta.env.VITE_TEE_URL        ?? 'https://devnet-tee.magicblock.app'
export const TEE_WS_URL     = import.meta.env.VITE_TEE_WS_URL     ?? 'wss://devnet-tee.magicblock.app'
export const TEE_VALIDATOR  = import.meta.env.VITE_TEE_VALIDATOR  ?? 'MTEWGuqxUpYZGFJQcp8tLN7x5v9BSeoFHYWQQ3n3xzo'
export const CLUSTER        = import.meta.env.VITE_CLUSTER        ?? 'devnet'
export const USDC_MINT      = import.meta.env.VITE_USDC_MINT      ?? '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'
export const SOL_MINT       = import.meta.env.VITE_SOL_MINT       ?? 'So11111111111111111111111111111111111111112'

// --- Response type from Private Payments API --------------
export interface PaymentsApiResponse {
  kind: string
  version?: string
  transactionBase64: string
  requiredSigners: string[]
  sendTo: string
  recentBlockhash: string
  lastValidBlockHeight: number
  instructionCount: number
  validator?: string
}

// --- TEE Auth token shape ---------------------------------
export interface AuthToken {
  token: string
  expiresAt?: number
}

// --- TEE Verification & Connection ------------------------
/**
 * Step 1: Verify TEE RPC integrity via Intel TDX attestation.
 * Step 2: Request auth token from TEE using wallet signature.
 * Step 3: Return authenticated connection to the PER.
 *
 * In production: uses verifyTeeRpcIntegrity + getAuthToken from SDK.
 * Demo mode: returns null and falls back to devnet connection.
 */
export async function verifyAndConnectTEE(
  userPublicKey: PublicKey,
  signMessage: (msg: Uint8Array) => Promise<Uint8Array>
): Promise<{ connection: Connection; authToken: AuthToken; verified: boolean } | null> {
  try {
    const { verifyTeeRpcIntegrity, getAuthToken } = await import('@magicblock-labs/ephemeral-rollups-sdk')

    // 1. Verify TEE runs on genuine Intel TDX hardware
    const isVerified = await verifyTeeRpcIntegrity(TEE_URL)

    // 2. Get auth token
    const authToken = await getAuthToken(
      TEE_URL,
      userPublicKey,
      (message: Uint8Array) => signMessage(message)
    )

    // 3. Create authenticated connection to PER
    const teeUserUrl   = `${TEE_URL}?token=${authToken.token}`
    const teeUserWsUrl = `${TEE_WS_URL}?token=${authToken.token}`
    const connection   = new Connection(teeUserUrl, { wsEndpoint: teeUserWsUrl })

    return { connection, authToken: { token: authToken.token }, verified: isVerified }
  } catch (err) {
    console.warn('[Obscura] TEE connection failed, using fallback so demo can continue:', err)
    // Fallback so the hackathon demo UI isn't hard-blocked if Devnet TEE RPC is unreachable
    const fallbackConn = new Connection(
      CLUSTER === 'devnet' ? 'https://api.devnet.solana.com' : 'http://127.0.0.1:8899'
    )
    return { 
      connection: fallbackConn, 
      authToken: { token: 'mock-tee-token-demo' }, 
      verified: false 
    }
  }
}

// --- Helper: deserialize & sign unsigned tx ---------------
export async function signAndSendApiTx(
  response: PaymentsApiResponse,
  connection: Connection,
  sendTransaction: (tx: Transaction | VersionedTransaction, conn: Connection) => Promise<string>
): Promise<string> {
  const bytes = Uint8Array.from(atob(response.transactionBase64), c => c.charCodeAt(0))
  const tx = response.version === 'legacy'
    ? Transaction.from(bytes)
    : VersionedTransaction.deserialize(bytes)
  const signature = await sendTransaction(tx, connection)
  return signature
}

// --- Private Payments API calls ---------------------------

/** GET: Base-chain SPL token balance */
export async function getPublicBalance(owner: string, mint: string): Promise<number> {
  const res = await fetch(`${PAYMENTS_API}/balance?owner=${owner}&mint=${mint}&cluster=${CLUSTER}`)
  if (!res.ok) throw new Error(`Balance fetch failed: ${res.statusText}`)
  const data = await res.json()
  return data.balance ?? 0
}

/** GET: Ephemeral-rollup (private) SPL token balance */
export async function getPrivateBalance(owner: string, mint: string): Promise<number> {
  const res = await fetch(
    `${PAYMENTS_API}/private-balance?owner=${owner}&mint=${mint}&cluster=${CLUSTER}&validator=${TEE_VALIDATOR}`
  )
  if (!res.ok) throw new Error(`Private balance fetch failed: ${res.statusText}`)
  const data = await res.json()
  return data.balance ?? 0
}

/** GET: Check whether mint has a validator-scoped transfer queue */
export async function checkMintInitialized(mint: string): Promise<boolean> {
  const res = await fetch(
    `${PAYMENTS_API}/is-mint-initialized?mint=${mint}&cluster=${CLUSTER}&validator=${TEE_VALIDATOR}`
  )
  if (!res.ok) return false
  const data = await res.json()
  return data.initialized ?? false
}

/** POST: Build unsigned deposit transaction (Solana → PER) */
export async function buildDepositTx(
  owner: string,
  amount: number,
  mint: string
): Promise<PaymentsApiResponse> {
  const res = await fetch(`${PAYMENTS_API}/deposit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      owner,
      amount,
      cluster: CLUSTER,
      mint,
      validator: TEE_VALIDATOR,
      initIfMissing: true,
      initVaultIfMissing: true,
    }),
  })
  if (!res.ok) throw new Error(`Deposit build failed: ${await res.text()}`)
  return res.json()
}

/** POST: Build unsigned withdrawal transaction (PER → Solana) */
export async function buildWithdrawTx(
  owner: string,
  amount: number,
  mint: string
): Promise<PaymentsApiResponse> {
  const res = await fetch(`${PAYMENTS_API}/withdraw`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      owner,
      amount,
      cluster: CLUSTER,
      mint,
      validator: TEE_VALIDATOR,
    }),
  })
  if (!res.ok) throw new Error(`Withdraw build failed: ${await res.text()}`)
  return res.json()
}

/** POST: Build unsigned SPL transfer */
export async function buildTransferTx(
  from: string,
  to: string,
  amount: number,
  mint: string,
  isPrivate: boolean
): Promise<PaymentsApiResponse> {
  const res = await fetch(`${PAYMENTS_API}/transfer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to,
      amount,
      cluster: CLUSTER,
      mint,
      validator: TEE_VALIDATOR,
      visibility: isPrivate ? 'private' : 'public',
      fromBalance: isPrivate ? 'ephemeral' : 'base',
      toBalance: isPrivate ? 'ephemeral' : 'base',
    }),
  })
  if (!res.ok) throw new Error(`Transfer build failed: ${await res.text()}`)
  return res.json()
}

/** POST: Initialize mint (validator-scoped transfer queue) */
export async function initializeMint(owner: string, mint: string): Promise<PaymentsApiResponse> {
  const res = await fetch(`${PAYMENTS_API}/initialize-mint`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      owner,
      cluster: CLUSTER,
      mint,
      validator: TEE_VALIDATOR,
    }),
  })
  if (!res.ok) throw new Error(`Initialize mint failed: ${await res.text()}`)
  return res.json()
}
