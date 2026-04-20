// ============================================================
// crank.ts — unit tests
// Tests for crank job scheduling, countdown, tick simulation,
// and the rule that cranks never touch matching logic.
// ============================================================

import { describe, it, expect, vi } from 'vitest'
import {
  scheduleCrankClose,
  scheduleCrankSettle,
  isCrankDue,
  getCrankCountdown,
  buildDemoCrankState,
  simulateCrankTick,
  type CrankJob,
} from '../../lib/crank'
import { createDemoAuction } from '../../lib/auction'

const NOW_SEC = Math.floor(Date.now() / 1000)

function makeJob(overrides: Partial<CrankJob> = {}): CrankJob {
  return {
    id: 'CRANK-TEST-001',
    auctionId: 'AUCTION-001',
    type: 'close_auction',
    scheduledAt: NOW_SEC + 600,
    status: 'scheduled',
    ...overrides,
  }
}

// ─── scheduleCrankClose ───────────────────────────────────

describe('scheduleCrankClose()', () => {
  it('creates a job with type close_auction', () => {
    const auction = createDemoAuction()
    const job = scheduleCrankClose(auction)
    expect(job.type).toBe('close_auction')
  })
  it('scheduled time equals auction closeTime', () => {
    const auction = createDemoAuction()
    const job = scheduleCrankClose(auction)
    expect(job.scheduledAt).toBe(auction.closeTime)
  })
  it('starts with status = scheduled', () => {
    const auction = createDemoAuction()
    expect(scheduleCrankClose(auction).status).toBe('scheduled')
  })
  it('auctionId matches auction id', () => {
    const auction = createDemoAuction()
    expect(scheduleCrankClose(auction).auctionId).toBe(auction.id)
  })
})

// ─── scheduleCrankSettle ──────────────────────────────────

describe('scheduleCrankSettle()', () => {
  it('creates a job with type settle_auction', () => {
    const job = scheduleCrankSettle('AUCTION-001', NOW_SEC + 600)
    expect(job.type).toBe('settle_auction')
  })
  it('scheduled 5 seconds after close time', () => {
    const closeTime = NOW_SEC + 600
    const job = scheduleCrankSettle('AUCTION-001', closeTime)
    expect(job.scheduledAt).toBe(closeTime + 5)
  })
  it('settlement crank is always AFTER close crank', () => {
    const auction = createDemoAuction()
    const closeJob  = scheduleCrankClose(auction)
    const settleJob = scheduleCrankSettle(auction.id, auction.closeTime)
    expect(settleJob.scheduledAt).toBeGreaterThan(closeJob.scheduledAt)
  })
})

// ─── isCrankDue ───────────────────────────────────────────

describe('isCrankDue()', () => {
  it('returns false when scheduledAt is in the future', () => {
    const job = makeJob({ scheduledAt: NOW_SEC + 300 })
    expect(isCrankDue(job)).toBe(false)
  })
  it('returns true when scheduledAt is in the past', () => {
    const job = makeJob({ scheduledAt: NOW_SEC - 60 })
    expect(isCrankDue(job)).toBe(true)
  })
  it('returns true when scheduledAt equals now', () => {
    const job = makeJob({ scheduledAt: NOW_SEC })
    expect(isCrankDue(job)).toBe(true)
  })
})

// ─── getCrankCountdown ────────────────────────────────────

describe('getCrankCountdown()', () => {
  it('returns positive value for future jobs', () => {
    const job = makeJob({ scheduledAt: NOW_SEC + 300 })
    const cd = getCrankCountdown(job)
    expect(cd).toBeGreaterThan(0)
    expect(cd).toBeLessThanOrEqual(300)
  })
  it('returns 0 for past-due jobs', () => {
    const job = makeJob({ scheduledAt: NOW_SEC - 100 })
    expect(getCrankCountdown(job)).toBe(0)
  })
})

// ─── buildDemoCrankState ──────────────────────────────────

describe('buildDemoCrankState()', () => {
  it('contains exactly 2 jobs', () => {
    const auction = createDemoAuction()
    const state = buildDemoCrankState(auction)
    expect(state.jobs).toHaveLength(2)
  })
  it('first job is close_auction, second is settle_auction', () => {
    const auction = createDemoAuction()
    const state = buildDemoCrankState(auction)
    expect(state.jobs[0].type).toBe('close_auction')
    expect(state.jobs[1].type).toBe('settle_auction')
  })
  it('starts healthy', () => {
    const auction = createDemoAuction()
    const state = buildDemoCrankState(auction)
    expect(state.healthy).toBe(true)
  })
  it('lastHeartbeat is close to now', () => {
    const auction = createDemoAuction()
    const state = buildDemoCrankState(auction)
    expect(state.lastHeartbeat).toBeGreaterThan(Date.now() - 1000)
  })
  it('DOES NOT contain any matching logic — cranks are time-based only', () => {
    // Verify that the jobs list contains only scheduling types
    const auction = createDemoAuction()
    const state = buildDemoCrankState(auction)
    const allowedTypes = ['close_auction', 'settle_auction', 'expiry_check']
    state.jobs.forEach(job => {
      expect(allowedTypes).toContain(job.type)
    })
  })
})

// ─── simulateCrankTick ────────────────────────────────────

describe('simulateCrankTick()', () => {
  it('transitions scheduled → executing when due', () => {
    const auction = createDemoAuction()
    const state = buildDemoCrankState(auction)
    // Override both jobs to be past-due
    const pastDue = {
      ...state,
      jobs: state.jobs.map(j => ({ ...j, scheduledAt: NOW_SEC - 60 })),
    }
    const next = simulateCrankTick(pastDue)
    expect(next.jobs.some(j => j.status === 'executing' || j.status === 'done')).toBe(true)
  })
  it('does not change status of future jobs', () => {
    const auction = createDemoAuction()
    const state = buildDemoCrankState(auction)
    // All jobs are in the future by default
    const next = simulateCrankTick(state)
    next.jobs.forEach(job => {
      expect(job.status).toBe('scheduled')
    })
  })
  it('transitions executing → done after 3 seconds', () => {
    const auction = createDemoAuction()
    const state = buildDemoCrankState(auction)
    const executing = {
      ...state,
      jobs: state.jobs.map(j => ({ ...j, status: 'executing' as const, scheduledAt: NOW_SEC - 10 })),
    }
    const next = simulateCrankTick(executing)
    next.jobs.forEach(job => expect(job.status).toBe('done'))
  })
  it('updates lastHeartbeat on every tick', () => {
    vi.useFakeTimers()
    const auction = createDemoAuction()
    const state = buildDemoCrankState(auction)
    const before = state.lastHeartbeat
    vi.advanceTimersByTime(100)
    const next = simulateCrankTick(state)
    expect(next.lastHeartbeat).toBeGreaterThanOrEqual(before)
    vi.useRealTimers()
  })
})
