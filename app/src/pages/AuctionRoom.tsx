import { useState, useEffect } from 'react'
import { GlassCard, EmptyState } from '../components/GlassCard'
import { AuctionTimer } from '../components/AuctionTimer'
import { useAppStore } from '../store/useAppStore'
import { createDemoAuction, type MatchState } from '../lib/auction'
import { buildDemoCrankState, simulateCrankTick } from '../lib/crank'

export function AuctionRoom() {
  const {
    currentAuction, setAuction, matchResult, setMatchResult,
    auctionOrderCount, setCrankState, crankState, addAuditEvent,
    walletPublicKey, myOrders, updateOrderStatus
  } = useAppStore()
  const [auctionClosed, setAuctionClosed] = useState(false)
  const [settling, setSettling] = useState(false)

  useEffect(() => {
    if (!currentAuction) setAuction(createDemoAuction())
  }, [])

  // Tick crank state
  useEffect(() => {
    if (!currentAuction || crankState) return
    setCrankState(buildDemoCrankState(currentAuction))
  }, [currentAuction])

  useEffect(() => {
    if (!crankState) return
    const id = setInterval(() => {
      setCrankState(simulateCrankTick(crankState!))
    }, 1000)
    return () => clearInterval(id)
  }, [crankState])

  // Handle auction close
  async function handleAuctionClose() {
    setAuctionClosed(true)
    setSettling(true)
    
    // Get latest state directly to avoid closure staleness
    const state = useAppStore.getState()
    const currentMyOrders = state.myOrders
    const currentWallet = state.walletPublicKey

    if (currentWallet) {
      addAuditEvent({ id: `AE-close-${Date.now()}`, timestamp: Date.now(), actor: currentWallet.toBase58().slice(0,8)+'…', action: 'Auction closed by crank scheduler', visibilityTier: 'admin' })
    }
    
    // Calculate dynamic match result based on user's involvement
    const userMatchedVolume = currentMyOrders.reduce((sum, o) => sum + o.size, 0)
    const baseVolume = 42000 + Math.floor(Math.random() * 10000)
    const simulatedClearingPrice = 0.004412 + (Math.random() * 0.0001)
    
    const demo: MatchState = {
      auctionId: currentAuction?.id ?? 'AUCTION-001',
      matchedSize: baseVolume + userMatchedVolume,
      clearingPrice: simulatedClearingPrice,
      buyOrderId: 'ORDER-MATCH-77', 
      sellOrderId: 'ORDER-MATCH-88',
      settlementStatus: 'committed',
      settledAt: Date.now(),
    }
    
    // Transition user's own orders to settled
    currentMyOrders.forEach(order => {
      updateOrderStatus(order.id, 'settled')
    })

    // Simulate a list of matched orders for the demo
    const simulatedMatchedOrders: MatchState['matchedOrders'] = [
      { id: 'ORDER-MATCH-77', side: 'buy', size: baseVolume * 0.6, price: simulatedClearingPrice, isTotalMatch: true },
      { id: 'ORDER-MATCH-88', side: 'sell', size: baseVolume * 0.4, price: simulatedClearingPrice, isTotalMatch: true },
      ...currentMyOrders.map(o => ({
        id: o.id.slice(0, 12),
        side: o.side,
        size: o.size,
        price: simulatedClearingPrice,
        isTotalMatch: true
      }))
    ]

    setMatchResult({ ...demo, matchedOrders: simulatedMatchedOrders })
    setSettling(false)
    if (walletPublicKey) {
      addAuditEvent({ id: `AE-settle-${Date.now()}`, timestamp: Date.now(), actor: 'system', action: `Matched ${demo.matchedSize.toLocaleString()} USDC @ ${demo.clearingPrice}`, visibilityTier: 'public' })
    }
  }

  return (
    <main className="page" style={{ maxWidth: 1000, margin: '0 auto' }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 'var(--space-6)' }}>
        <div>
          <h1 className="heading-1">Auction Room</h1>
          <div className="caption" style={{ marginTop: 4 }}>USDC / SOL · Sealed-Bid Crossing · Private Ephemeral Rollup</div>
        </div>
        {currentAuction && (
          <div className={`badge ${currentAuction.status === 'open' ? 'badge--emerald' : 'badge--amber'}`} style={{ padding: '6px 14px' }}>
            {currentAuction.status.toUpperCase()}
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 'var(--space-5)' }}>
        {/* Left col */}
        <div className="flex flex-col gap-4">
          {/* Timer */}
          <GlassCard padding="24px" glow={auctionClosed ? 'none' : 'blue'}>
            {currentAuction ? (
              <AuctionTimer
                closeTime={currentAuction.closeTime}
                onExpire={() => !auctionClosed && handleAuctionClose()}
              />
            ) : (
              <EmptyState icon="⏱" title="No active auction" />
            )}
          </GlassCard>

          {/* Crank info */}
          <GlassCard padding="16px">
            <div className="heading-3" style={{ marginBottom: 10 }}>Crank Scheduler</div>
            {crankState?.jobs.map(job => (
              <div key={job.id} className="flex justify-between items-center" style={{ marginBottom: 8 }}>
                <div>
                  <div className="body-sm" style={{ fontWeight: 500 }}>
                    {job.type === 'close_auction' ? 'Auction Close' : 'Settlement Trigger'}
                  </div>
                  <div className="caption" style={{ color: 'var(--text-muted)' }}>
                    Scheduled: {new Date(job.scheduledAt * 1000).toLocaleTimeString()}
                  </div>
                </div>
                <span className={`badge ${job.status === 'done' ? 'badge--emerald' : job.status === 'executing' ? 'badge--amber' : 'badge--muted'}`}>
                  {job.status}
                </span>
              </div>
            ))}
            <hr className="divider" style={{ margin: '10px 0' }} />
            <div className="caption" style={{ color: 'var(--text-muted)' }}>
              Cranks handle time-based close and settlement only. Matching runs inside PER.
            </div>
          </GlassCard>

          {/* Stats */}
          <GlassCard padding="0">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '1px solid var(--glass-border)' }}>
              <div style={{ padding: '14px 16px', borderRight: '1px solid var(--glass-border)' }}>
                <div className="caption">Sealed Orders</div>
                <div className="mono" style={{ fontSize: '1.2rem', color: 'var(--violet-light)' }}>{auctionOrderCount}</div>
                <div className="caption">🔒 Private</div>
              </div>
              <div style={{ padding: '14px 16px' }}>
                <div className="caption">Lot Size</div>
                <div className="mono" style={{ fontSize: '1.2rem' }}>{currentAuction?.lotSize ?? '—'}</div>
                <div className="caption">USDC min</div>
              </div>
            </div>
            <div style={{ padding: '14px 16px' }}>
              <div className="caption">Fee</div>
              <div className="mono">{currentAuction?.feeBps ?? '—'} bps</div>
            </div>
          </GlassCard>
        </div>

        {/* Right col */}
        <div className="flex flex-col gap-4">
          {/* No public order book notice */}
          <GlassCard padding="18px" glow="violet">
            <div className="flex items-center gap-3">
              <span style={{ fontSize: 24 }}>🔒</span>
              <div>
                <div className="heading-3">No Public Order Book</div>
                <div className="body-sm" style={{ color: 'var(--text-muted)', marginTop: 4 }}>
                  All bids and asks are sealed inside the Private Ephemeral Rollup until auction close. This structurally eliminates MEV, front-running, and pre-trade information leakage.
                </div>
              </div>
            </div>
          </GlassCard>

          {/* MEV explanation */}
          <GlassCard padding="18px">
            <div className="heading-3" style={{ marginBottom: 12 }}>Why This Eliminates MEV</div>
            <div className="flex flex-col gap-3">
              {[
                { icon: '🛡', title: 'Sealed Bids', desc: 'Orders submitted inside TEE — no mempool, no observable intent' },
                { icon: '⚡', title: 'Batch Settlement', desc: 'All orders clear at a single price at expiry — no race conditions' },
                { icon: '🔐', title: 'TEE Enforcement', desc: 'Intel TDX prevents even the validator operator from reading order state' },
                { icon: '📋', title: 'Permission Control', desc: 'Only authorized members can observe logs and balances during auction' },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span style={{ fontSize: 18 }}>{item.icon}</span>
                  <div>
                    <div className="body-sm" style={{ fontWeight: 500 }}>{item.title}</div>
                    <div className="caption" style={{ color: 'var(--text-muted)' }}>{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>

          {/* Match result — only visible post-settlement */}
          {settling && (
            <GlassCard padding="18px" style={{ borderColor: 'hsla(38,92%,60%,0.3)', boxShadow: '0 0 24px hsla(38,92%,60%,0.18)' }}>
              <div className="flex items-center gap-3">
                <div className="dot-indicator dot-indicator--amber" />
                <div>
                  <div className="heading-3">Matching in PER…</div>
                  <div className="caption" style={{ color: 'var(--text-muted)' }}>Confidential matching running inside Intel TDX TEE</div>
                </div>
              </div>
            </GlassCard>
          )}

          {matchResult && !settling && (
            <div className="flex flex-col gap-4 animate-fade-in">
              <GlassCard padding="20px" glow="emerald">
                <div className="flex items-center gap-2" style={{ marginBottom: 14 }}>
                  <span style={{ fontSize: 20 }}>✅</span>
                  <div className="heading-2" style={{ color: 'var(--emerald-light)' }}>Settlement Complete</div>
                </div>
                <div className="flex flex-col gap-3">
                  {[
                    ['Auction',         matchResult.auctionId],
                    ['Matched Size',    `${matchResult.matchedSize.toLocaleString()} USDC`],
                    ['Clearing Price',  matchResult.clearingPrice.toFixed(6)],
                    ['Status',          matchResult.settlementStatus.toUpperCase()],
                    ['Settled At',      new Date(matchResult.settledAt!).toLocaleTimeString()],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between">
                      <span className="caption">{k}</span>
                      <span className="mono" style={{ fontSize: '0.82rem', color: 'var(--emerald-light)' }}>{v}</span>
                    </div>
                  ))}
                </div>
                <hr className="divider" style={{ margin: '12px 0' }} />
                <div className="caption" style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                  Match result revealed via transitional: UpdatePermission (members: None) → commit_and_undelegate
                </div>
              </GlassCard>

              {/* Matched Bids & Asks Table */}
              <GlassCard padding="0">
                <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--glass-border)' }}>
                  <div className="heading-3">Matched Bids & Asks</div>
                  <div className="caption" style={{ marginTop: 2 }}>De-identified order results revealed post-settlement</div>
                </div>
                <div style={{ padding: '0 var(--space-2)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--glass-border)' }}>
                        <th style={{ padding: '12px 8px', textAlign: 'left', color: 'var(--text-muted)' }}>Order ID</th>
                        <th style={{ padding: '12px 8px', textAlign: 'left', color: 'var(--text-muted)' }}>Side</th>
                        <th style={{ padding: '12px 8px', textAlign: 'right', color: 'var(--text-muted)' }}>Size</th>
                        <th style={{ padding: '12px 8px', textAlign: 'right', color: 'var(--text-muted)' }}>Price</th>
                      </tr>
                    </thead>
                    <tbody>
                      {matchResult.matchedOrders?.map((order, idx) => (
                        <tr key={idx} style={{ borderBottom: idx === matchResult.matchedOrders!.length - 1 ? 'none' : '1px solid var(--glass-border-faint)' }}>
                          <td className="mono" style={{ padding: '10px 8px' }}>{order.id}…</td>
                          <td style={{ padding: '10px 8px' }}>
                            <span className={`badge ${order.side === 'buy' ? 'badge--emerald' : 'badge--red'}`} style={{ fontSize: '0.6rem' }}>
                              {order.side.toUpperCase()}
                            </span>
                          </td>
                          <td className="mono" style={{ padding: '10px 8px', textAlign: 'right' }}>{order.size.toLocaleString()}</td>
                          <td className="mono" style={{ padding: '10px 8px', textAlign: 'right' }}>{order.price.toFixed(4)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </GlassCard>
            </div>
          )}

          {!matchResult && !settling && (
            <EmptyState
              icon="◌"
              title="Awaiting Settlement"
              description="Match results will appear here after crank closes the auction and settlement commits back to Solana."
            />
          )}
        </div>
      </div>
    </main>
  )
}
