import { useAppStore } from '../store/useAppStore'
import { WalletButton } from './WalletButton'
import { StatusDot } from './GlassCard'

const NAV_ITEMS = [
  { key: 'landing',    label: 'Overview' },
  { key: 'terminal',  label: 'Terminal' },
  { key: 'auction',   label: 'Auction Room' },
  { key: 'compliance',label: 'Compliance' },
  { key: 'admin',     label: 'Admin' },
] as const

export function Nav() {
  const { activeView, setActiveView } = useAppStore()

  return (
    <nav className="nav" role="navigation" aria-label="Main navigation">
      {/* Logo */}
      <div
        className="flex items-center gap-2"
        style={{ cursor: 'pointer', marginRight: 'var(--space-8)' }}
        onClick={() => setActiveView('landing')}
      >
        <div style={{
          width: 28, height: 28, borderRadius: 8,
          background: 'linear-gradient(135deg, var(--blue), var(--violet))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, fontWeight: 800, color: '#fff',
        }}>
          ◈
        </div>
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1rem', letterSpacing: '-0.02em' }}>
          Obscura
          <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> Match</span>
        </span>
        <span className="badge badge--violet" style={{ fontSize: '0.6rem' }}>v2</span>
      </div>

      {/* Nav items */}
      <div className="flex items-center gap-1" style={{ flex: 1 }}>
        {NAV_ITEMS.map(item => (
          <button
            key={item.key}
            id={`nav-${item.key}`}
            className="btn btn--ghost btn--sm"
            onClick={() => setActiveView(item.key)}
            style={{
              color: activeView === item.key ? 'var(--text-primary)' : 'var(--text-muted)',
              background: activeView === item.key ? 'var(--glass-bg)' : 'transparent',
              borderColor: activeView === item.key ? 'var(--glass-border)' : 'transparent',
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Network badge + wallet */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 glass-card" style={{ padding: '5px 10px', borderRadius: 'var(--radius-full)' }}>
          <StatusDot status="amber" />
          <span className="mono" style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Devnet</span>
        </div>
        <WalletButton />
      </div>
    </nav>
  )
}
