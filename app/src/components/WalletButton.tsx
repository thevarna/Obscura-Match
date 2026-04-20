import { useWallet } from '@solana/wallet-adapter-react'
import { useWalletModal } from '@solana/wallet-adapter-react-ui'
import { useEffect } from 'react'
import { useAppStore } from '../store/useAppStore'
import { StatusDot } from './GlassCard'

export function WalletButton() {
  const { publicKey, connected, disconnect } = useWallet()
  const { setVisible } = useWalletModal()
  const { setWallet, teeStatus } = useAppStore()

  useEffect(() => {
    setWallet(publicKey)
  }, [publicKey])

  const addr = publicKey ? `${publicKey.toBase58().slice(0,4)}…${publicKey.toBase58().slice(-4)}` : null

  if (connected && addr) {
    return (
      <div className="flex items-center gap-2">
        {/* TEE status indicator */}
        <div className="flex items-center gap-2 glass-card" style={{ padding: '6px 12px', borderRadius: 'var(--radius-full)' }}>
          <StatusDot status={teeStatus === 'connected' ? 'green' : teeStatus === 'verifying' ? 'amber' : 'red'} />
          <span className="mono" style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
            {teeStatus === 'connected' ? 'TEE Live' : teeStatus === 'verifying' ? 'Verifying…' : 'PER Offline'}
          </span>
        </div>
        <button
          id="wallet-disconnect-btn"
          className="btn btn--secondary btn--sm"
          onClick={disconnect}
          style={{ fontFamily: 'var(--font-mono)', gap: 6 }}
        >
          <StatusDot status="green" />
          {addr}
        </button>
      </div>
    )
  }

  return (
    <button
      id="wallet-connect-btn"
      className="btn btn--primary btn--md"
      onClick={() => setVisible(true)}
    >
      Connect Wallet
    </button>
  )
}
