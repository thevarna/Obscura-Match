// ============================================================
// Obscura Match — Crank scheduler (scheduled tasks only)
// Cranks handle auction close + settlement trigger.
// They do NOT perform or contain matching logic.
// ============================================================

import type { AuctionConfig } from './auction'

export type CrankStatus = 'scheduled' | 'executing' | 'done' | 'failed' | 'idle'

export interface CrankJob {
  id: string
  auctionId: string
  type: 'close_auction' | 'settle_auction' | 'expiry_check'
  scheduledAt: number     // unix timestamp
  executedAt?: number
  status: CrankStatus
  error?: string
}

export interface CrankSchedulerState {
  jobs: CrankJob[]
  lastHeartbeat: number
  healthy: boolean
}

// --- Schedule an auction close crank -----------------------
export function scheduleCrankClose(auction: AuctionConfig): CrankJob {
  return {
    id: `CRANK-CLOSE-${auction.id}-${Date.now()}`,
    auctionId: auction.id,
    type: 'close_auction',
    scheduledAt: auction.closeTime,
    status: 'scheduled',
  }
}

// --- Schedule a settlement trigger crank -------------------
export function scheduleCrankSettle(auctionId: string, afterClose: number): CrankJob {
  return {
    id: `CRANK-SETTLE-${auctionId}-${Date.now()}`,
    auctionId,
    type: 'settle_auction',
    scheduledAt: afterClose + 5,  // 5s after close
    status: 'scheduled',
  }
}

// --- Poll crank status (in prod: polls on-chain or backend) ----
export function isCrankDue(job: CrankJob): boolean {
  return Math.floor(Date.now() / 1000) >= job.scheduledAt
}

export function getCrankCountdown(job: CrankJob): number {
  const now = Math.floor(Date.now() / 1000)
  return Math.max(0, job.scheduledAt - now)
}

// --- Demo crank scheduler state ----------------------------
export function buildDemoCrankState(auction: AuctionConfig): CrankSchedulerState {
  const closeJob   = scheduleCrankClose(auction)
  const settleJob  = scheduleCrankSettle(auction.id, auction.closeTime)

  return {
    jobs: [closeJob, settleJob],
    lastHeartbeat: Date.now(),
    healthy: true,
  }
}

// --- Simulate crank execution (demo only) ------------------
export function simulateCrankTick(state: CrankSchedulerState): CrankSchedulerState {
  const now = Math.floor(Date.now() / 1000)
  const updated = state.jobs.map(job => {
    if (job.status === 'scheduled' && now >= job.scheduledAt) {
      return { ...job, status: 'executing' as CrankStatus }
    }
    if (job.status === 'executing' && now > job.scheduledAt + 3) {
      return { ...job, status: 'done' as CrankStatus, executedAt: now }
    }
    return job
  })
  return { ...state, jobs: updated, lastHeartbeat: Date.now() }
}
