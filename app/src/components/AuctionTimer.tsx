import { useEffect, useState } from 'react'

interface AuctionTimerProps {
  closeTime: number  // unix seconds
  onExpire?: () => void
  compact?: boolean
}

export function AuctionTimer({ closeTime, onExpire, compact = false }: AuctionTimerProps) {
  const [remaining, setRemaining] = useState(0)
  const [expired, setExpired] = useState(false)

  useEffect(() => {
    function tick() {
      const r = closeTime - Math.floor(Date.now() / 1000)
      if (r <= 0) {
        setRemaining(0)
        setExpired(true)
        onExpire?.()
      } else {
        setRemaining(r)
      }
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [closeTime])

  const h = Math.floor(remaining / 3600)
  const m = Math.floor((remaining % 3600) / 60)
  const s = remaining % 60

  const pad = (n: number) => String(n).padStart(2, '0')

  // Colour based on urgency
  const urgency = remaining < 60 ? 'var(--red)'
    : remaining < 300 ? 'var(--amber)'
    : 'var(--emerald)'

  if (compact) {
    return (
      <span className="mono" style={{ color: expired ? 'var(--red)' : urgency, fontSize: '0.85rem' }}>
        {expired ? 'CLOSED' : `${pad(h)}:${pad(m)}:${pad(s)}`}
      </span>
    )
  }

  // Total initial duration (guess 15 min for ring)
  const totalSeconds = 15 * 60
  const fraction = Math.max(0, remaining / totalSeconds)
  const circumference = 2 * Math.PI * 44  // r=44
  const dashOffset = circumference * (1 - fraction)

  return (
    <div className="flex flex-col items-center gap-3">
      <div style={{ position: 'relative', width: 120, height: 120 }}>
        <svg width="120" height="120" style={{ transform: 'rotate(-90deg)' }}>
          {/* Background ring */}
          <circle cx="60" cy="60" r="44" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
          {/* Countdown ring */}
          <circle
            cx="60" cy="60" r="44" fill="none"
            stroke={expired ? 'var(--red)' : urgency}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.5s ease' }}
          />
        </svg>
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <div className="mono" style={{ fontSize: '1.1rem', color: expired ? 'var(--red)' : urgency, fontWeight: 600 }}>
            {expired ? '00:00' : `${pad(m)}:${pad(s)}`}
          </div>
          {h > 0 && !expired && (
            <div className="caption">{h}h</div>
          )}
        </div>
      </div>
      <div style={{ textAlign: 'center' }}>
        <div className="heading-3" style={{ color: expired ? 'var(--red)' : 'var(--text-primary)' }}>
          {expired ? 'Auction Closed' : 'Auction Closes In'}
        </div>
        {!expired && (
          <div className="caption" style={{ marginTop: 2 }}>Crank-triggered settlement after close</div>
        )}
      </div>
    </div>
  )
}
