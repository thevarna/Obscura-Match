// ============================================================
// Obscura Match — Global Zustand store
// ============================================================

import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import type { Connection, PublicKey } from '@solana/web3.js'
import type { AuctionConfig, OrderIntent, MatchState, AuditEvent } from '../lib/auction'
import type { CrankSchedulerState } from '../lib/crank'
import type { AuthToken } from '../lib/magicblock'
import type { PermissionStep } from '../lib/permissions'

export type TeeStatus = 'pending' | 'verifying' | 'connected' | 'failed' | 'disconnected'
export type TxStep = { id: string; label: string; detail?: string; status: 'pending' | 'active' | 'done' | 'error' }

interface AppState {
  // Wallet
  walletConnected: boolean
  walletPublicKey: PublicKey | null
  setWallet: (key: PublicKey | null) => void

  // TEE Connection
  teeStatus: TeeStatus
  teeAuthToken: AuthToken | null
  teeConnection: Connection | null
  teeVerified: boolean
  setTeeStatus: (s: TeeStatus) => void
  setTeeConnection: (conn: Connection | null, token: AuthToken | null, verified: boolean) => void

  // Balances
  publicBalance: number
  privateBalance: number
  balanceLoading: boolean
  setBalances: (pub: number, priv: number) => void
  setBalanceLoading: (v: boolean) => void

  // Auction
  currentAuction: AuctionConfig | null
  auctionOrderCount: number
  setAuction: (a: AuctionConfig | null) => void
  incrementOrderCount: () => void
  resetAuctionState: () => void

  // Orders (only current user's own orders)
  myOrders: OrderIntent[]
  addOrder: (o: OrderIntent) => void
  updateOrderStatus: (id: string, status: OrderIntent['status']) => void

  // Match result (visible post-settle)
  matchResult: MatchState | null
  setMatchResult: (m: MatchState | null) => void

  // Audit log
  auditEvents: AuditEvent[]
  addAuditEvent: (e: AuditEvent) => void

  // Permissions UI
  permissionSteps: PermissionStep[]
  setPermissionSteps: (steps: PermissionStep[]) => void
  updatePermissionStep: (step: string, status: PermissionStep['status']) => void

  // Transaction timeline
  txSteps: TxStep[]
  setTxSteps: (steps: TxStep[]) => void
  updateTxStep: (id: string, status: TxStep['status'], detail?: string) => void
  clearTxSteps: () => void

  // Crank state
  crankState: CrankSchedulerState | null
  setCrankState: (s: CrankSchedulerState | null) => void

  // UI state
  activeView: 'landing' | 'terminal' | 'auction' | 'compliance' | 'admin'
  setActiveView: (v: AppState['activeView']) => void
  sidebarSection: string
  setSidebarSection: (s: string) => void
}

export const useAppStore = create<AppState>()(
  devtools(
    persist(
      (set) => ({
      // Wallet
      walletConnected: false,
      walletPublicKey: null,
      setWallet: (key) => set({ walletPublicKey: key, walletConnected: !!key }),

      // TEE
      teeStatus: 'disconnected',
      teeAuthToken: null,
      teeConnection: null,
      teeVerified: false,
      setTeeStatus: (teeStatus) => set({ teeStatus }),
      setTeeConnection: (teeConnection, teeAuthToken, teeVerified) =>
        set({ teeConnection, teeAuthToken, teeVerified, teeStatus: teeConnection ? 'connected' : 'disconnected' }),

      // Balances
      publicBalance: 0,
      privateBalance: 0,
      balanceLoading: false,
      setBalances: (publicBalance, privateBalance) => set({ publicBalance, privateBalance }),
      setBalanceLoading: (balanceLoading) => set({ balanceLoading }),

      // Auction
      currentAuction: null,
      auctionOrderCount: 0,
      setAuction: (currentAuction) => set({ currentAuction }),
      incrementOrderCount: () => set((s) => ({ auctionOrderCount: s.auctionOrderCount + 1 })),
      resetAuctionState: () => set({ currentAuction: null, auctionOrderCount: 0, crankState: null, myOrders: [], txSteps: [], matchResult: null }),

      // Orders
      myOrders: [],
      addOrder: (o) => set((s) => ({ myOrders: [o, ...s.myOrders] })),
      updateOrderStatus: (id, status) =>
        set((s) => ({ myOrders: s.myOrders.map(o => o.id === id ? { ...o, status } : o) })),

      // Match result
      matchResult: null,
      setMatchResult: (matchResult) => set({ matchResult }),

      // Audit
      auditEvents: [],
      addAuditEvent: (e) => set((s) => ({ auditEvents: [e, ...s.auditEvents].slice(0, 200) })),

      // Permissions
      permissionSteps: [],
      setPermissionSteps: (permissionSteps) => set({ permissionSteps }),
      updatePermissionStep: (step, status) =>
        set((s) => ({
          permissionSteps: s.permissionSteps.map(p => p.step === step ? { ...p, status } : p),
        })),

      // TX timeline
      txSteps: [],
      setTxSteps: (txSteps) => set({ txSteps }),
      updateTxStep: (id, status, detail) =>
        set((s) => ({
          txSteps: s.txSteps.map(t => t.id === id ? { ...t, status, ...(detail ? { detail } : {}) } : t),
        })),
      clearTxSteps: () => set({ txSteps: [] }),

      // Crank
      crankState: null,
      setCrankState: (crankState) => set({ crankState }),

      // UI
      activeView: 'landing',
      setActiveView: (activeView) => set({ activeView }),
      sidebarSection: 'order',
      setSidebarSection: (sidebarSection) => set({ sidebarSection }),
    }),
    { 
      name: 'ObscuraMatch',
      partialize: (state) => ({
        publicBalance: state.publicBalance,
        privateBalance: state.privateBalance,
        activeView: state.activeView,
        myOrders: state.myOrders,
        auditEvents: state.auditEvents,
        auctionOrderCount: state.auctionOrderCount,
        currentAuction: state.currentAuction,
      }),
    }
    )
  )
)
