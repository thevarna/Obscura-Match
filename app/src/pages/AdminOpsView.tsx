import { useEffect, useState } from 'react'
import { GlassCard, StatusDot } from '../components/GlassCard'
import { useAppStore } from '../store/useAppStore'
import { buildDemoCrankState, simulateCrankTick, getCrankCountdown } from '../lib/crank'
import { createDemoAuction } from '../lib/auction'
import { TEE_URL, TEE_VALIDATOR, PAYMENTS_API, CLUSTER } from '../lib/magicblock'

export function AdminOpsView() {
  const { currentAuction, setAuction, crankState, setCrankState, teeStatus, auctionOrderCount, resetAuctionState } = useAppStore()
  const [durationMinutes, setDurationMinutes] = useState<number>(5)
  
  const handleResetAuction = () => {
    resetAuctionState()
    const newAuction = createDemoAuction(durationMinutes)
    setAuction(newAuction)
    setCrankState(buildDemoCrankState(newAuction))
  }

  const handleForceCrank = () => {
    if (!currentAuction || !crankState) return
    const now = Math.floor(Date.now() / 1000)
    
    // Set auction close time to now
    setAuction({ ...currentAuction, closeTime: now })
    
    // Force crank jobs to execute immediately
    const newJobs = crankState.jobs.map(job => ({
      ...job,
      scheduledAt: now
    }))
    setCrankState({ ...crankState, jobs: newJobs })
  }

  useEffect(() => {
    if (!currentAuction) setAuction(createDemoAuction())
  }, [])

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

  const HEALTH_ITEMS: Array<{ label: string; status: 'green' | 'amber' | 'red'; value: string; detail: string }> = [
    {
      label: 'TEE RPC Connection',
      status: teeStatus === 'connected' ? 'green' : teeStatus === 'verifying' ? 'amber' : 'red',
      value: teeStatus === 'connected' ? 'Live' : teeStatus === 'verifying' ? 'Verifying…' : 'Offline',
      detail: TEE_URL,
    },
    {
      label: 'TEE Validator',
      status: 'green' as const,
      value: 'Registered',
      detail: `${TEE_VALIDATOR.slice(0, 8)}…${TEE_VALIDATOR.slice(-8)}`,
    },
    {
      label: 'Private Payments API',
      status: 'green' as const,
      value: 'Reachable',
      detail: PAYMENTS_API,
    },
    {
      label: 'Network',
      status: 'amber' as const,
      value: CLUSTER.charAt(0).toUpperCase() + CLUSTER.slice(1),
      detail: 'Not mainnet — devnet configuration',
    },
    {
      label: 'Settlement',
      status: 'green' as const,
      value: 'On-chain',
      detail: 'Solana base chain — no off-chain bridges',
    },
  ]

  return (
    <main className="page" style={{ maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <h1 className="heading-1">Admin / Ops</h1>
        <div className="caption" style={{ marginTop: 4 }}>
          Crank scheduler · System health · Configuration
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-5)' }}>
        {/* Crank Scheduler */}
        <GlassCard padding="0" elevated>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div className="heading-2">Crank Scheduler</div>
              <div className="caption" style={{ marginTop: 2 }}>Handles time-based auction close and settlement triggers only</div>
            </div>
            <button className="btn btn--secondary btn--sm" onClick={handleForceCrank} disabled={!crankState?.jobs.length}>
              Trigger Crank Now
            </button>
          </div>
          {crankState?.jobs.length ? (
            <div>
              {crankState.jobs.map(job => {
                const countdown = getCrankCountdown(job)
                return (
                  <div key={job.id} className="health-row">
                    <div>
                      <div className="body-sm" style={{ fontWeight: 600, marginBottom: 2 }}>
                        {job.type === 'close_auction' ? '⏱ Auction Close' : '⚡ Settlement Trigger'}
                      </div>
                      <div className="mono" style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        {new Date(job.scheduledAt * 1000).toLocaleTimeString()} · {countdown > 0 ? `T-${countdown}s` : 'Due'}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusDot status={job.status === 'done' ? 'green' : job.status === 'executing' ? 'amber' : 'muted'} />
                      <span className={`badge ${job.status === 'done' ? 'badge--emerald' : job.status === 'executing' ? 'badge--amber' : 'badge--muted'}`}>
                        {job.status}
                      </span>
                    </div>
                  </div>
                )
              })}
              <div style={{ padding: '10px 20px' }}>
                <div className="caption" style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                  ⚠ Cranks are purely time-based. Matching logic runs inside the PER — cranks only signal close and settlement boundaries.
                </div>
              </div>
            </div>
          ) : (
            <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              No active crank jobs. Navigate to Auction Room to initialize.
            </div>
          )}
        </GlassCard>

        {/* System Health */}
        <GlassCard padding="0" elevated>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--glass-border)' }}>
            <div className="heading-2">System Health</div>
            <div className="caption" style={{ marginTop: 2 }}>Real-time infrastructure status</div>
          </div>
          {HEALTH_ITEMS.map((item, i) => (
            <div key={i} className="health-row">
              <div>
                <div className="body-sm" style={{ fontWeight: 500, marginBottom: 2 }}>{item.label}</div>
                <div className="mono" style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{item.detail}</div>
              </div>
              <div className="flex items-center gap-2">
                <StatusDot status={item.status} />
                <span className={`badge ${item.status === 'green' ? 'badge--emerald' : item.status === 'amber' ? 'badge--amber' : 'badge--red'}`}>
                  {item.value}
                </span>
              </div>
            </div>
          ))}
        </GlassCard>

        {/* Auction Config */}
        <GlassCard padding="0" elevated>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="heading-2">Auction Configuration</div>
            <div className="flex items-center gap-3">
              <select 
                className="form-input" 
                style={{ padding: '4px 8px', fontSize: '0.8rem', height: 'auto', backgroundColor: 'var(--glass-bg-hover)' }}
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
              >
                <option value={1}>1 Minute</option>
                <option value={3}>3 Minutes</option>
                <option value={5}>5 Minutes</option>
                <option value={15}>15 Minutes</option>
                <option value={30}>30 Minutes</option>
              </select>
              <button className="btn btn--secondary btn--sm" onClick={handleResetAuction}>
                Reset
              </button>
            </div>
          </div>
          {currentAuction ? (
            <div>
              {[
                ['Auction ID',   currentAuction.id],
                ['Pair',         currentAuction.pair],
                ['Base Mint',    `${currentAuction.baseMint.slice(0, 8)}…`],
                ['Quote Mint',   `${currentAuction.quoteMint.slice(0, 8)}…`],
                ['Lot Size',     `${currentAuction.lotSize} USDC`],
                ['Min Tick',     currentAuction.minIncrement.toString()],
                ['Fee',          `${currentAuction.feeBps} bps`],
                ['Status',       currentAuction.status.toUpperCase()],
                ['Sealed Orders', `${auctionOrderCount} (confidential)`],
                ['Close Time',   new Date(currentAuction.closeTime * 1000).toLocaleString()],
              ].map(([k, v]) => (
                <div key={k} className="health-row">
                  <span className="caption">{k}</span>
                  <span className="mono" style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{v}</span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: 'var(--space-5)', color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center' }}>
              No active auction
            </div>
          )}
        </GlassCard>

        {/* Architecture reference */}
        <GlassCard padding="0" glow="blue">
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--glass-border)' }}>
            <div className="heading-2">Architecture Reference</div>
            <div className="caption" style={{ marginTop: 2 }}>Confirmed addresses and program IDs</div>
          </div>
          {[
            ['ACL Program',       'ACLseoPoyC3cBqoUtkbjZ4aDrkurZW86v19pXz2XQnp1', 'badge--violet'],
            ['Delegation Program','DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh', 'badge--violet'],
            ['TEE Validator',     TEE_VALIDATOR, 'badge--blue'],
            ['TEE Endpoint',      TEE_URL, 'badge--blue'],
            ['Payments API',      PAYMENTS_API, 'badge--emerald'],
          ].map(([k, v, cls]) => (
            <div key={k} className="health-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
              <div className="flex items-center gap-2">
                <span className="caption">{k}</span>
                <span className={`badge ${cls}`} style={{ fontSize: '0.6rem' }}>env-configurable</span>
              </div>
              <span className="mono" style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', wordBreak: 'break-all' }}>{v}</span>
            </div>
          ))}
          <div style={{ padding: '10px 20px' }}>
            <div className="caption" style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>
              All addresses are loaded from VITE_ environment variables. Devnet values ship as defaults; production values set in .env.production.
            </div>
          </div>
        </GlassCard>
      </div>
    </main>
  )
}
