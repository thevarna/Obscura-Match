import { useAppStore } from '../store/useAppStore'
import { GlassCard } from '../components/GlassCard'

const HOW_STEPS = [
  { num: '01', title: 'Connect & Verify TEE', desc: 'Your wallet authenticates against the Intel TDX TEE. Integrity verified via on-chain attestation before any data is exchanged.' },
  { num: '02', title: 'Deposit SPL Privately', desc: 'Funds move from your Solana wallet into the Private Ephemeral Rollup via the Private Payments API. Balance visible only to you.' },
  { num: '03', title: 'Submit Sealed Bid', desc: 'Your order intent is submitted inside the PER session. Size, price, and counterparty are invisible to the public — zero pre-trade signaling.' },
  { num: '04', title: 'Confidential Matching', desc: 'Orders match inside the TEE-backed rollup. No external party can observe the matching state. MEV extraction is structurally impossible.' },
  { num: '05', title: 'Settle & Withdraw', desc: 'Net result commits back to Solana. You receive exactly what matched. Remaining funds withdraw privately via the Private Payments API.' },
]

const COMPLIANCE_POINTS = [
  { icon: '🔒', title: 'TEE Attestation', desc: 'Every session is bound to verified Intel TDX hardware. No simulator or software substitute accepted.' },
  { icon: '⚖️', title: 'Access Control', desc: 'Fine-grained permission flags govern who can read tx logs, balances, messages, and signatures. Role-based, not anonymity-based.' },
  { icon: '📋', title: 'Audit Ready', desc: 'Compliance roles get full visibility — logs, balances, messages, signatures — on demand. Nothing is hidden from authorized auditors.' },
  { icon: '🌐', title: 'Solana Settlement', desc: 'All net transfers settle on-chain. Full custody integrity. No off-chain bridges, no custodians, no trust assumptions.' },
]

export function LandingPage() {
  const { setActiveView, currentAuction, privateBalance, auctionOrderCount } = useAppStore()

  return (
    <main className="page" style={{ padding: 0, overflow: 'auto' }}>
      {/* === Hero ============================================ */}
      <section style={{
        minHeight: '88vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-16) var(--space-8)',
        textAlign: 'center',
        position: 'relative',
      }}>
        {/* Badge */}
        <div className="animate-fade-in" style={{ marginBottom: 'var(--space-6)' }}>
          <span className="badge badge--violet" style={{ fontSize: '0.75rem', padding: '5px 14px' }}>
            🔐 MagicBlock Private Ephemeral Rollup · Intel TDX
          </span>
        </div>

        {/* Headline */}
        <h1 className="display-1 animate-slide-up" style={{ maxWidth: 780, marginBottom: 'var(--space-6)' }}>
          Institutional Block Execution,{' '}
          <span className="gradient-text">Completely Private</span>
        </h1>

        {/* Sub */}
        <p className="body-lg animate-slide-up" style={{
          color: 'var(--text-secondary)', maxWidth: 600,
          marginBottom: 'var(--space-10)', animationDelay: '80ms',
        }}>
          Obscura Match is a confidential sealed-bid OTC crossing engine for whale wallets, DAO treasuries, and institutional desks. Zero pre-trade signaling. Zero MEV exposure. On Solana.
        </p>

        {/* CTAs */}
        <div className="flex items-center gap-3 animate-slide-up" style={{ animationDelay: '150ms', marginBottom: 'var(--space-12)', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button id="cta-launch-terminal" className="btn btn--primary btn--lg" onClick={() => setActiveView('terminal')}>
            Launch Terminal →
          </button>
          <button id="cta-view-auction" className="btn btn--secondary btn--lg" onClick={() => setActiveView('auction')}>
            View Auction Room
          </button>
        </div>

        {/* Live Stats Strip */}
        <div className="animate-slide-up" style={{ animationDelay: '220ms', width: '100%', maxWidth: 860 }}>
          <GlassCard elevated padding="0">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)' }}>
              {[
                { label: 'Private Balance', value: privateBalance ? `${privateBalance.toLocaleString()} USDC` : '—', badge: 'PER', badgeCls: 'badge--violet' },
                { label: 'Active Auction', value: currentAuction ? currentAuction.pair : 'USDC / SOL', badge: 'OPEN', badgeCls: 'badge--emerald' },
                { label: 'Sealed Orders', value: auctionOrderCount > 0 ? `${auctionOrderCount} orders` : 'Confidential', badge: 'PRIVATE', badgeCls: 'badge--muted' },
                { label: 'Settlement', value: 'On-chain', badge: 'Solana', badgeCls: 'badge--blue' },
              ].map((stat, i) => (
                <div key={i} style={{
                  padding: 'var(--space-4) var(--space-5)',
                  borderRight: i < 3 ? '1px solid var(--glass-border)' : 'none',
                  textAlign: 'left',
                }}>
                  <div className="caption" style={{ marginBottom: 6 }}>{stat.label}</div>
                  <div className="flex items-center gap-2">
                    <span className="mono" style={{ fontSize: '0.95rem' }}>{stat.value}</span>
                    <span className={`badge ${stat.badgeCls}`} style={{ fontSize: '0.65rem' }}>{stat.badge}</span>
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>
      </section>

      {/* === How It Works ==================================== */}
      <section style={{ padding: 'var(--space-16) var(--space-8)', maxWidth: 1100, margin: '0 auto', width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-12)' }}>
          <h2 className="display-2">How Obscura Match Works</h2>
          <p className="body-lg" style={{ color: 'var(--text-secondary)', marginTop: 'var(--space-3)' }}>
            Five steps from wallet connect to private settlement
          </p>
        </div>

        <GlassCard padding="0" elevated>
          {HOW_STEPS.map((step, i) => (
            <div key={i} className="how-step" style={{ borderBottom: i < 4 ? '1px solid var(--glass-border)' : 'none' }}>
              <div className="how-step__num">{step.num}</div>
              <div className="how-step__content">
                <div className="how-step__title">{step.title}</div>
                <div className="how-step__desc">{step.desc}</div>
              </div>
              <div style={{ alignSelf: 'center', opacity: 0.3, fontSize: 20 }}>›</div>
            </div>
          ))}
        </GlassCard>
      </section>

      {/* === Compliance / Trust ============================== */}
      <section style={{ padding: 'var(--space-12) var(--space-8) var(--space-16)', maxWidth: 1100, margin: '0 auto', width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-10)' }}>
          <div className="badge badge--amber" style={{ marginBottom: 'var(--space-4)', padding: '5px 14px' }}>
            Compliance Framework
          </div>
          <h2 className="display-2">Private, Not Anonymous</h2>
          <p className="body-lg" style={{ color: 'var(--text-secondary)', marginTop: 'var(--space-3)', maxWidth: 560, margin: 'var(--space-3) auto 0' }}>
            Obscura Match is designed for regulated institutions. Authorized auditors see everything; unauthorized parties see nothing.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--space-4)' }}>
          {COMPLIANCE_POINTS.map((p, i) => (
            <GlassCard key={i} padding="20px" className="animate-fade-in" style={{ animationDelay: `${i * 60}ms` }}>
              <div style={{ fontSize: 28, marginBottom: 'var(--space-3)' }}>{p.icon}</div>
              <div className="heading-3" style={{ marginBottom: 'var(--space-2)' }}>{p.title}</div>
              <div className="body-sm" style={{ color: 'var(--text-muted)' }}>{p.desc}</div>
            </GlassCard>
          ))}
        </div>

        {/* Architecture badge strip */}
        <div className="flex items-center justify-center gap-3" style={{ marginTop: 'var(--space-10)', flexWrap: 'wrap' }}>
          {['MagicBlock PER', 'Intel TDX TEE', 'Private Payments API', 'Solana Settlement', 'Anchor Program', 'Crank Automation'].map(t => (
            <span key={t} className="badge badge--muted" style={{ padding: '6px 12px' }}>{t}</span>
          ))}
        </div>
      </section>
    </main>
  )
}
