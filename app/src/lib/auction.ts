// ============================================================
// Obscura Match — Auction + Order flow (client side)
// ============================================================

import { buildDepositTx, buildWithdrawTx, buildTransferTx, getPrivateBalance, checkMintInitialized, initializeMint, USDC_MINT, TEE_VALIDATOR } from './magicblock'
import { buildOrderPermissionLifecycle, type PermissionStep } from './permissions'
import type { PaymentsApiResponse } from './magicblock'

// --- Types --------------------------------------------------
export type OrderSide = 'buy' | 'sell'
export type OrderStatus = 'pending' | 'submitted' | 'matched' | 'settled' | 'cancelled' | 'expired'
export type AuctionStatus = 'open' | 'matching' | 'settled' | 'closed'

export interface AuctionConfig {
  id: string
  pair: string              // e.g. "USDC/SOL"
  baseMint: string
  quoteMint: string
  lotSize: number           // minimum order unit
  minIncrement: number      // price tick
  closeTime: number         // unix timestamp
  feeBps: number            // fee in basis points
  status: AuctionStatus
}

export interface OrderIntent {
  id: string
  auctionId: string
  side: OrderSide
  size: number
  limitPrice: number
  expiry: number            // unix timestamp
  nonce: string
  status: OrderStatus
  submittedAt: number
  trader: string
}

export interface MatchedOrder {
  id: string
  side: OrderSide
  size: number
  price: number
  isTotalMatch: boolean
}

export interface MatchState {
  auctionId: string
  matchedSize: number
  clearingPrice: number
  buyOrderId: string
  sellOrderId: string
  settlementStatus: 'pending' | 'committed' | 'failed'
  settledAt?: number
  matchedOrders?: MatchedOrder[]
}

export interface AuditEvent {
  id: string
  timestamp: number
  actor: string             // wallet address truncated
  action: string
  visibilityTier: 'public' | 'trader' | 'auditor' | 'admin'
}

// --- Default demo auction -----------------------------------
export function createDemoAuction(): AuctionConfig {
  return {
    id: 'AUCTION-001',
    pair: 'USDC/SOL',
    baseMint: USDC_MINT,
    quoteMint: 'So11111111111111111111111111111111111111112',
    lotSize: 100,
    minIncrement: 0.01,
    closeTime: Math.floor(Date.now() / 1000) + 15 * 60, // 15 min from now
    feeBps: 5,
    status: 'open',
  }
}

// --- Deposit flow -------------------------------------------
export interface DepositParams {
  owner: string
  amount: number
  mint?: string
}

export async function prepareDeposit(params: DepositParams): Promise<{
  response: PaymentsApiResponse
  mintInitialized: boolean
  initMintTx?: PaymentsApiResponse
}> {
  const mint = params.mint ?? USDC_MINT

  // Check mint initialization before deposit
  const mintInitialized = await checkMintInitialized(mint)
  let initMintTx: PaymentsApiResponse | undefined

  if (!mintInitialized) {
    initMintTx = await initializeMint(params.owner, mint)
  }

  const response = await buildDepositTx(params.owner, params.amount, mint)
  return { response, mintInitialized, initMintTx }
}

// --- Withdraw flow ------------------------------------------
export interface WithdrawParams {
  owner: string
  amount: number
  mint?: string
}

export async function prepareWithdraw(params: WithdrawParams): Promise<PaymentsApiResponse> {
  const mint = params.mint ?? USDC_MINT
  return buildWithdrawTx(params.owner, params.amount, mint)
}

// --- Order submit flow --------------------------------------
export interface SubmitOrderParams {
  auctionId: string
  trader: string
  side: OrderSide
  size: number
  limitPrice: number
  expiry: number
}

export interface SubmitOrderResult {
  order: OrderIntent
  permissionSteps: PermissionStep[]
  transferTx: PaymentsApiResponse
}

export async function prepareOrderSubmit(params: SubmitOrderParams): Promise<SubmitOrderResult> {
  const order: OrderIntent = {
    id: `ORDER-${Date.now()}`,
    auctionId: params.auctionId,
    side: params.side,
    size: params.size,
    limitPrice: params.limitPrice,
    expiry: params.expiry,
    nonce: Math.random().toString(36).slice(2),
    status: 'submitted',
    submittedAt: Date.now(),
    trader: params.trader,
  }

  // Build transfer tx (moves funds to private escrow in PER)
  const transferTx = await buildTransferTx(
    params.trader,
    TEE_VALIDATOR,  // replaced by actual vault PDA in prod
    params.size,
    USDC_MINT,
    true  // private transfer
  )

  // Build permission lifecycle steps for UI display
  const orderPda = `ORDER_PDA_${order.id}`  // derived in actual program
  const permissionSteps = buildOrderPermissionLifecycle(orderPda, params.trader, TEE_VALIDATOR)

  return { order, permissionSteps, transferTx }
}

// --- Private balance fetch ----------------------------------
export async function fetchPrivateBalance(owner: string): Promise<number> {
  return getPrivateBalance(owner, USDC_MINT)
}

// --- Settlement net transfer --------------------------------
export async function prepareSettlementTransfer(
  from: string,
  to: string,
  amount: number,
  mint: string = USDC_MINT
): Promise<PaymentsApiResponse> {
  return buildTransferTx(from, to, amount, mint, false) // public (base → base) after settlement
}

// --- Audit event helpers ------------------------------------
export function makeAuditEvent(
  actor: string,
  action: string,
  tier: AuditEvent['visibilityTier']
): AuditEvent {
  return {
    id: `AE-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    timestamp: Date.now(),
    actor: actor.slice(0, 8) + '…',
    action,
    visibilityTier: tier,
  }
}
