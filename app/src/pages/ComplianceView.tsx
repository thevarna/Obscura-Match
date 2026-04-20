import { GlassCard } from '../components/GlassCard'
import { PermissionMatrix } from '../components/PermissionMatrix'
import { useAppStore } from '../store/useAppStore'


export function ComplianceView() {
  const { auditEvents, myOrders, permissionSteps, matchResult } = useAppStore()

  return (
    <main className="page" style={{ maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <h1 className="heading-1">Compliance & Audit</h1>
        <div className="caption" style={{ marginTop: 4 }}>
          Permission-governed visibility · Account-level access only · MagicBlock ACL Program
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 'var(--space-5)' }}>
        {/* Left: permission matrix */}
        <div className="flex flex-col gap-4">
          <PermissionMatrix />

          {/* Permission lifecycle steps */}
          {permissionSteps.length > 0 && (
            <GlassCard padding="16px">
              <div className="heading-3" style={{ marginBottom: 10 }}>Order Permission Lifecycle</div>
              <div className="flex flex-col gap-2">
                {permissionSteps.map((step, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className={`dot-indicator ${step.status === 'done' ? 'dot-indicator--green' : step.status === 'error' ? 'dot-indicator--red' : 'dot-indicator--muted'}`}
                      style={{ marginTop: 6 }} />
                    <div>
                      <div className="mono" style={{ fontSize: '0.75rem', fontWeight: 500 }}>{step.step}</div>
                      <div className="caption">{step.description}</div>
                    </div>
                  </div>
                ))}
              </div>
              <hr className="divider" style={{ margin: '12px 0' }} />
              <div className="caption" style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>
                reveal_permission (members: None) is a transitional step — used once post-settlement during cleanup, not a permanent access tier.
              </div>
            </GlassCard>
          )}

          {/* Compliance narrative */}
          <GlassCard padding="16px" glow="blue">
            <div className="heading-3" style={{ marginBottom: 8 }}>Lawful-Private Positioning</div>
            <div className="flex flex-col gap-2">
              {[
                'Privacy is enforced by TEE attestation, not obscurity.',
                'Authorized auditors retain full visibility at account level.',
                'Empty member list fully restricts an account — only the owner can modify permissions.',
                'No per-field reveal: flags control read access to tx logs, balances, messages, and signatures at account granularity.',
                'All net settlements clear on Solana — full custody integrity.',
              ].map((pt, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span style={{ color: 'var(--blue)', marginTop: 2 }}>▸</span>
                  <span className="body-sm" style={{ color: 'var(--text-secondary)' }}>{pt}</span>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>

        {/* Right: audit log + settlement trace */}
        <div className="flex flex-col gap-4">
          {/* Settlement trace */}
          {matchResult && (
            <GlassCard padding="16px" glow="emerald" className="animate-fade-in">
              <div className="heading-3" style={{ marginBottom: 10 }}>Settlement Trace</div>
              <div className="timeline">
                {[
                  { label: 'Order sealed in PER', detail: 'SetPermission + DelegatePDA', status: 'done' },
                  { label: 'Auction closed by crank', detail: 'Scheduled close trigger', status: 'done' },
                  { label: 'Matching inside TEE', detail: 'Confidential matching — not observable', status: 'done' },
                  { label: 'Commit & Undelegate', detail: 'MatchState synced to Solana', status: 'done' },
                  { label: 'Reveal step (transitional)', detail: 'UpdatePermission { members: None } — temporary', status: 'done' },
                  { label: 'Settlement committed', detail: `${matchResult.matchedSize.toLocaleString()} USDC @ ${matchResult.clearingPrice}`, status: 'done' },
                  { label: 'Permission closed', detail: 'Lamports reclaimed', status: 'done' },
                ].map((step, i) => (
                  <div key={i} className={`timeline-item timeline-item--${step.status}`}>
                    <div className="timeline-item__dot">✓</div>
                    <div className="timeline-item__content">
                      <div className="timeline-item__title">{step.label}</div>
                      <div className="timeline-item__detail">{step.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            </GlassCard>
          )}

          {/* Audit log */}
          <GlassCard padding="0">
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--glass-border)' }}>
              <div className="heading-3">Audit Log</div>
              <div className="caption" style={{ marginTop: 2 }}>Visibility tier indicates required permission flag to read each event</div>
            </div>
            {auditEvents.length === 0 ? (
              <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                No audit events yet. Interact with the terminal to generate events.
              </div>
            ) : (
              <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                {auditEvents.map(event => (
                  <div key={event.id} className="audit-entry">
                    <span className="audit-entry__time">
                      {new Date(event.timestamp).toLocaleTimeString()}
                    </span>
                    <span className="audit-entry__actor">{event.actor}</span>
                    <span className="audit-entry__action">{event.action}</span>
                    <span className={`badge ${
                      event.visibilityTier === 'public'  ? 'badge--muted'   :
                      event.visibilityTier === 'trader'  ? 'badge--emerald' :
                      event.visibilityTier === 'auditor' ? 'badge--violet'  :
                      'badge--amber'
                    }`} style={{ fontSize: '0.65rem', flexShrink: 0 }}>
                      {event.visibilityTier}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>

          {/* My orders audit view */}
          {myOrders.length > 0 && (
            <GlassCard padding="0">
              <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--glass-border)' }}>
                <div className="heading-3">My Order History</div>
                <div className="caption" style={{ marginTop: 2 }}>Only visible with TX_LOGS + TX_BALANCES flags on your permission account</div>
              </div>
              <div style={{ maxHeight: 280, overflowY: 'auto' }}>
                {myOrders.map(order => (
                  <div key={order.id} className="audit-entry">
                    <span className="audit-entry__time">{new Date(order.submittedAt).toLocaleTimeString()}</span>
                    <span className="audit-entry__actor">{order.trader}</span>
                    <span className="audit-entry__action">
                      {order.side.toUpperCase()} {order.size.toLocaleString()} @ {order.limitPrice.toFixed(4)}
                    </span>
                    <span className={`badge ${order.status === 'settled' ? 'badge--emerald' : 'badge--violet'}`} style={{ fontSize: '0.65rem', flexShrink: 0 }}>
                      {order.status}
                    </span>
                  </div>
                ))}
              </div>
            </GlassCard>
          )}
        </div>
      </div>
    </main>
  )
}
