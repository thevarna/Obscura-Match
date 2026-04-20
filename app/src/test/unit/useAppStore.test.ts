// ============================================================
// useAppStore.ts — unit tests
// Tests for all store state slices, setters, and derived state.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest'
import { act } from 'react'
import { useAppStore } from '../../store/useAppStore'
import { createDemoAuction, makeAuditEvent } from '../../lib/auction'
import { createPermissionStep } from '../../lib/permissions'

// ─── Helpers ──────────────────────────────────────────────
function resetStore() {
  useAppStore.setState({
    walletConnected: false, walletPublicKey: null,
    teeStatus: 'disconnected', teeAuthToken: null, teeConnection: null, teeVerified: false,
    publicBalance: 0, privateBalance: 0, balanceLoading: false,
    currentAuction: null, auctionOrderCount: 0,
    myOrders: [], matchResult: null,
    auditEvents: [], permissionSteps: [], txSteps: [],
    crankState: null, activeView: 'landing', sidebarSection: 'order',
  })
}

// ─── Wallet slice ─────────────────────────────────────────

describe('Store: wallet slice', () => {
  beforeEach(() => resetStore())

  it('starts disconnected', () => {
    const { walletConnected, walletPublicKey } = useAppStore.getState()
    expect(walletConnected).toBe(false)
    expect(walletPublicKey).toBeNull()
  })

  it('setWallet(null) marks disconnected', () => {
    act(() => useAppStore.getState().setWallet(null))
    expect(useAppStore.getState().walletConnected).toBe(false)
    expect(useAppStore.getState().walletPublicKey).toBeNull()
  })
})

// ─── TEE slice ────────────────────────────────────────────

describe('Store: TEE slice', () => {
  beforeEach(() => resetStore())

  it('starts in disconnected state', () => {
    expect(useAppStore.getState().teeStatus).toBe('disconnected')
  })

  it('setTeeStatus changes status', () => {
    act(() => useAppStore.getState().setTeeStatus('verifying'))
    expect(useAppStore.getState().teeStatus).toBe('verifying')
  })

  it('setTeeStatus to failed', () => {
    act(() => useAppStore.getState().setTeeStatus('failed'))
    expect(useAppStore.getState().teeStatus).toBe('failed')
  })

  it('setTeeConnection(null, null, false) → disconnected', () => {
    act(() => useAppStore.getState().setTeeConnection(null, null, false))
    expect(useAppStore.getState().teeStatus).toBe('disconnected')
    expect(useAppStore.getState().teeVerified).toBe(false)
  })

  it('setTeeConnection(conn, token, true) → connected', () => {
    const fakeConn = {} as any
    const fakeToken = { token: 'abc123' }
    act(() => useAppStore.getState().setTeeConnection(fakeConn, fakeToken, true))
    expect(useAppStore.getState().teeStatus).toBe('connected')
    expect(useAppStore.getState().teeVerified).toBe(true)
    expect(useAppStore.getState().teeAuthToken?.token).toBe('abc123')
  })
})

// ─── Balance slice ────────────────────────────────────────

describe('Store: balance slice', () => {
  beforeEach(() => resetStore())

  it('starts at zero balances', () => {
    const { publicBalance, privateBalance } = useAppStore.getState()
    expect(publicBalance).toBe(0)
    expect(privateBalance).toBe(0)
  })

  it('setBalances updates both', () => {
    act(() => useAppStore.getState().setBalances(250000, 100000))
    const { publicBalance, privateBalance } = useAppStore.getState()
    expect(publicBalance).toBe(250000)
    expect(privateBalance).toBe(100000)
  })

  it('setBalanceLoading sets loading flag', () => {
    act(() => useAppStore.getState().setBalanceLoading(true))
    expect(useAppStore.getState().balanceLoading).toBe(true)
    act(() => useAppStore.getState().setBalanceLoading(false))
    expect(useAppStore.getState().balanceLoading).toBe(false)
  })
})

// ─── Auction slice ────────────────────────────────────────

describe('Store: auction slice', () => {
  beforeEach(() => resetStore())

  it('starts with no auction', () => {
    expect(useAppStore.getState().currentAuction).toBeNull()
  })

  it('setAuction stores the auction', () => {
    const auction = createDemoAuction()
    act(() => useAppStore.getState().setAuction(auction))
    expect(useAppStore.getState().currentAuction?.id).toBe(auction.id)
  })

  it('setAuction(null) clears the auction', () => {
    const auction = createDemoAuction()
    act(() => useAppStore.getState().setAuction(auction))
    act(() => useAppStore.getState().setAuction(null))
    expect(useAppStore.getState().currentAuction).toBeNull()
  })

  it('auctionOrderCount starts at 0', () => {
    expect(useAppStore.getState().auctionOrderCount).toBe(0)
  })

  it('incrementOrderCount increments by 1', () => {
    act(() => useAppStore.getState().incrementOrderCount())
    act(() => useAppStore.getState().incrementOrderCount())
    expect(useAppStore.getState().auctionOrderCount).toBe(2)
  })
})

// ─── Orders slice ─────────────────────────────────────────

describe('Store: orders slice', () => {
  beforeEach(() => resetStore())

  it('starts with empty orders', () => {
    expect(useAppStore.getState().myOrders).toHaveLength(0)
  })

  it('addOrder prepends to myOrders', () => {
    const order = {
      id: 'O1', auctionId: 'A1', side: 'buy' as const,
      size: 1000, limitPrice: 0.004, expiry: 9999999,
      nonce: 'n1', status: 'submitted' as const,
      submittedAt: Date.now(), trader: 'Trader1',
    }
    act(() => useAppStore.getState().addOrder(order))
    expect(useAppStore.getState().myOrders).toHaveLength(1)
    expect(useAppStore.getState().myOrders[0].id).toBe('O1')
  })

  it('addOrder most recent order is first', () => {
    const makeOrder = (id: string) => ({
      id, auctionId: 'A1', side: 'buy' as const,
      size: 1000, limitPrice: 0.004, expiry: 9999999,
      nonce: id, status: 'submitted' as const,
      submittedAt: Date.now(), trader: 'T1',
    })
    act(() => { useAppStore.getState().addOrder(makeOrder('O1')) })
    act(() => { useAppStore.getState().addOrder(makeOrder('O2')) })
    expect(useAppStore.getState().myOrders[0].id).toBe('O2') // newest first
  })

  it('updateOrderStatus changes specific order status', () => {
    const order = {
      id: 'O1', auctionId: 'A1', side: 'buy' as const,
      size: 1000, limitPrice: 0.004, expiry: 9999999,
      nonce: 'n1', status: 'submitted' as const,
      submittedAt: Date.now(), trader: 'T',
    }
    act(() => useAppStore.getState().addOrder(order))
    act(() => useAppStore.getState().updateOrderStatus('O1', 'matched'))
    const updated = useAppStore.getState().myOrders.find(o => o.id === 'O1')
    expect(updated?.status).toBe('matched')
  })
})

// ─── Audit events slice ───────────────────────────────────

describe('Store: audit events slice', () => {
  beforeEach(() => resetStore())

  it('starts empty', () => {
    expect(useAppStore.getState().auditEvents).toHaveLength(0)
  })

  it('addAuditEvent prepends events', () => {
    const e1 = makeAuditEvent('A', 'action1', 'trader')
    const e2 = makeAuditEvent('A', 'action2', 'admin')
    act(() => useAppStore.getState().addAuditEvent(e1))
    act(() => useAppStore.getState().addAuditEvent(e2))
    expect(useAppStore.getState().auditEvents[0].action).toBe('action2')
    expect(useAppStore.getState().auditEvents).toHaveLength(2)
  })

  it('caps audit events at 200', () => {
    for (let i = 0; i < 250; i++) {
      act(() => useAppStore.getState().addAuditEvent(makeAuditEvent('A', `action${i}`, 'public')))
    }
    expect(useAppStore.getState().auditEvents.length).toBeLessThanOrEqual(200)
  })
})

// ─── Permission steps slice ───────────────────────────────

describe('Store: permission steps slice', () => {
  beforeEach(() => resetStore())

  it('starts empty', () => {
    expect(useAppStore.getState().permissionSteps).toHaveLength(0)
  })

  it('setPermissionSteps replaces steps', () => {
    const steps = [createPermissionStep('ACCOUNT', [])]
    act(() => useAppStore.getState().setPermissionSteps(steps))
    expect(useAppStore.getState().permissionSteps).toHaveLength(1)
  })

  it('updatePermissionStep changes status', () => {
    const step = createPermissionStep('ACCOUNT', [])
    act(() => useAppStore.getState().setPermissionSteps([step]))
    act(() => useAppStore.getState().updatePermissionStep('create_permission', 'done'))
    expect(useAppStore.getState().permissionSteps[0].status).toBe('done')
  })

  it('updatePermissionStep does not affect other steps', () => {
    const steps = [
      createPermissionStep('ACCOUNT', []),
      { step: 'delegate_permission', description: '', accounts: [], status: 'pending' as const },
    ]
    act(() => useAppStore.getState().setPermissionSteps(steps))
    act(() => useAppStore.getState().updatePermissionStep('create_permission', 'done'))
    expect(useAppStore.getState().permissionSteps[1].status).toBe('pending')
  })
})

// ─── TX steps slice ───────────────────────────────────────

describe('Store: tx steps slice', () => {
  beforeEach(() => resetStore())

  it('setTxSteps replaces steps', () => {
    act(() => useAppStore.getState().setTxSteps([
      { id: 'step1', label: 'Step 1', status: 'active' },
    ]))
    expect(useAppStore.getState().txSteps).toHaveLength(1)
  })

  it('updateTxStep changes status', () => {
    act(() => useAppStore.getState().setTxSteps([
      { id: 's1', label: 'S1', status: 'active' },
      { id: 's2', label: 'S2', status: 'pending' },
    ]))
    act(() => useAppStore.getState().updateTxStep('s1', 'done', '0xABC…'))
    const step = useAppStore.getState().txSteps.find(t => t.id === 's1')
    expect(step?.status).toBe('done')
    expect(step?.detail).toBe('0xABC…')
  })

  it('clearTxSteps empties the list', () => {
    act(() => useAppStore.getState().setTxSteps([{ id: '1', label: 'A', status: 'done' }]))
    act(() => useAppStore.getState().clearTxSteps())
    expect(useAppStore.getState().txSteps).toHaveLength(0)
  })
})

// ─── View navigation slice ────────────────────────────────

describe('Store: UI navigation slice', () => {
  beforeEach(() => resetStore())

  it('starts on landing view', () => {
    expect(useAppStore.getState().activeView).toBe('landing')
  })

  it('setActiveView changes view', () => {
    act(() => useAppStore.getState().setActiveView('terminal'))
    expect(useAppStore.getState().activeView).toBe('terminal')
  })

  it('can navigate to all 5 views', () => {
    const views = ['landing', 'terminal', 'auction', 'compliance', 'admin'] as const
    views.forEach(view => {
      act(() => useAppStore.getState().setActiveView(view))
      expect(useAppStore.getState().activeView).toBe(view)
    })
  })
})
