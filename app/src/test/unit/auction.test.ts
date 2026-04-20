// ============================================================
// auction.ts — unit tests
// Tests for auction creation, order flow, audit events,
// and settlement helpers.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest'
import {
  createDemoAuction,
  makeAuditEvent,
  type AuctionConfig,
  type OrderIntent,
  type AuditEvent,
} from '../../lib/auction'

// ─── createDemoAuction ────────────────────────────────────

describe('createDemoAuction()', () => {
  let auction: AuctionConfig

  beforeEach(() => { auction = createDemoAuction() })

  it('returns pair USDC/SOL', () => {
    expect(auction.pair).toBe('USDC/SOL')
  })
  it('status is open', () => {
    expect(auction.status).toBe('open')
  })
  it('closeTime is in the future', () => {
    expect(auction.closeTime).toBeGreaterThan(Math.floor(Date.now() / 1000))
  })
  it('closeTime is ~15 minutes from now', () => {
    const now = Math.floor(Date.now() / 1000)
    const diff = auction.closeTime - now
    expect(diff).toBeGreaterThan(800)   // at least 800 seconds
    expect(diff).toBeLessThan(1000)     // at most 1000 seconds
  })
  it('lotSize is positive', () => {
    expect(auction.lotSize).toBeGreaterThan(0)
  })
  it('feeBps is non-negative', () => {
    expect(auction.feeBps).toBeGreaterThanOrEqual(0)
  })
  it('id is defined', () => {
    expect(auction.id).toBeTruthy()
  })
  it('baseMint and quoteMint are set', () => {
    expect(auction.baseMint).toBeTruthy()
    expect(auction.quoteMint).toBeTruthy()
    expect(auction.baseMint).not.toBe(auction.quoteMint)
  })
})

// ─── makeAuditEvent ───────────────────────────────────────

describe('makeAuditEvent()', () => {
  it('generates a unique id each call', () => {
    const e1 = makeAuditEvent('ActorABC', 'some_action', 'trader')
    const e2 = makeAuditEvent('ActorABC', 'some_action', 'trader')
    expect(e1.id).not.toBe(e2.id)
  })

  it('truncates long actor addresses to 8 chars + ellipsis', () => {
    const longAddr = 'MTEWGuqxUpYZGFJQcp8tLN7x5v9BSeoFHYWQQ3n3xzo'
    const event = makeAuditEvent(longAddr, 'test', 'admin')
    expect(event.actor.length).toBeLessThan(15)
    expect(event.actor).toContain('…')
  })

  it('sets action exactly', () => {
    const event = makeAuditEvent('Actor', 'submit_order', 'trader')
    expect(event.action).toBe('submit_order')
  })

  it('sets visibilityTier exactly', () => {
    const tiers: AuditEvent['visibilityTier'][] = ['public', 'trader', 'auditor', 'admin']
    tiers.forEach(tier => {
      const event = makeAuditEvent('Actor', 'action', tier)
      expect(event.visibilityTier).toBe(tier)
    })
  })

  it('timestamp is close to now', () => {
    const event = makeAuditEvent('Actor', 'action', 'public')
    expect(event.timestamp).toBeGreaterThan(Date.now() - 500)
    expect(event.timestamp).toBeLessThanOrEqual(Date.now() + 100)
  })

  it('id contains the AE- prefix', () => {
    const event = makeAuditEvent('A', 'b', 'trader')
    expect(event.id).toMatch(/^AE-/)
  })
})

// ─── Order intent shape ───────────────────────────────────

describe('OrderIntent shape validation', () => {
  it('buy side order has correct properties', () => {
    const order: OrderIntent = {
      id: 'ORDER-001',
      auctionId: 'AUCTION-001',
      side: 'buy',
      size: 50000,
      limitPrice: 0.0044,
      expiry: Math.floor(Date.now() / 1000) + 900,
      nonce: 'abc123',
      status: 'submitted',
      submittedAt: Date.now(),
      trader: 'Abc123Pubkey',
    }
    expect(order.side).toBe('buy')
    expect(order.size).toBeGreaterThan(0)
    expect(order.limitPrice).toBeGreaterThan(0)
    expect(order.status).toBe('submitted')
  })

  it('sell side order has correct properties', () => {
    const order: OrderIntent = {
      id: 'ORDER-002',
      auctionId: 'AUCTION-001',
      side: 'sell',
      size: 25000,
      limitPrice: 0.0042,
      expiry: Math.floor(Date.now() / 1000) + 900,
      nonce: 'def456',
      status: 'submitted',
      submittedAt: Date.now(),
      trader: 'Xyz789Pubkey',
    }
    expect(order.side).toBe('sell')
    expect(order.limitPrice).toBeGreaterThan(0)
  })
})

// ─── Auction status transitions (logical) ─────────────────

describe('AuctionConfig status lifecycle', () => {
  it('open is the default status', () => {
    const auction = createDemoAuction()
    expect(auction.status).toBe('open')
  })

  it('valid statuses are open | matching | settled | closed', () => {
    const validStatuses = ['open', 'matching', 'settled', 'closed']
    const auction = createDemoAuction()
    expect(validStatuses).toContain(auction.status)
  })
})
