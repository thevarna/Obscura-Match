import React from 'react'

interface GlassCardProps {
  children: React.ReactNode
  className?: string
  glow?: 'blue' | 'violet' | 'emerald' | 'none'
  elevated?: boolean
  padding?: string
  onClick?: () => void
  style?: React.CSSProperties
}

export function GlassCard({
  children, className = '', glow = 'none',
  elevated = false, padding = '20px', onClick, style,
}: GlassCardProps) {
  const glowClass = glow !== 'none' ? `glass-card--glow-${glow}` : ''
  const elevatedClass = elevated ? 'glass-card--elevated' : ''
  return (
    <div
      className={`glass-card ${glowClass} ${elevatedClass} ${className}`}
      style={{ padding, cursor: onClick ? 'pointer' : undefined, ...style }}
      onClick={onClick}
    >
      {children}
    </div>
  )
}

// --- Skeleton variants --------------------------------------
export function SkeletonLine({ width = '100%', height = '16px', className = '' }: { width?: string; height?: string; className?: string }) {
  return <div className={`skeleton ${className}`} style={{ width, height, borderRadius: 4 }} />
}

export function SkeletonCard({ rows = 3 }: { rows?: number }) {
  return (
    <GlassCard>
      <div className="flex flex-col gap-3">
        <SkeletonLine width="40%" height="12px" />
        <SkeletonLine height="28px" />
        {rows > 2 && <SkeletonLine width="70%" height="14px" />}
        {rows > 3 && <SkeletonLine width="50%" height="14px" />}
      </div>
    </GlassCard>
  )
}

// --- Error state --------------------------------------------
interface ErrorStateProps {
  title?: string
  message: string
  onRetry?: () => void
}
export function ErrorState({ title = 'Something went wrong', message, onRetry }: ErrorStateProps) {
  return (
    <div className="error-state">
      <div className="empty-state__icon" style={{ color: 'var(--red)' }}>⚠</div>
      <div>
        <div className="heading-3" style={{ color: 'var(--red)', marginBottom: 4 }}>{title}</div>
        <div className="body-sm" style={{ color: 'var(--text-muted)' }}>{message}</div>
      </div>
      {onRetry && (
        <button className="btn btn--secondary btn--sm" onClick={onRetry}>Retry</button>
      )}
    </div>
  )
}

// --- Empty state --------------------------------------------
interface EmptyStateProps {
  icon?: string
  title: string
  description?: string
  action?: { label: string; onClick: () => void }
}
export function EmptyState({ icon = '○', title, description, action }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <div className="empty-state__icon">{icon}</div>
      <div className="empty-state__title">{title}</div>
      {description && <div className="empty-state__desc">{description}</div>}
      {action && (
        <button className="btn btn--secondary btn--sm" onClick={action.onClick}>{action.label}</button>
      )}
    </div>
  )
}

// --- Dot indicator -----------------------------------------
export function StatusDot({ status }: { status: 'green' | 'amber' | 'red' | 'muted' }) {
  return <span className={`dot-indicator dot-indicator--${status}`} />
}

// --- Numeric stat ------------------------------------------
export function StatItem({ label, value, unit, change, mono = true }: {
  label: string; value: string | number; unit?: string; change?: string; mono?: boolean
}) {
  return (
    <div className="stat-card">
      <div className="stat-card__label">{label}</div>
      <div className="stat-card__value" style={{ fontFamily: mono ? 'var(--font-mono)' : undefined }}>
        {value}{unit && <span style={{ fontSize: '0.8em', opacity: 0.6, marginLeft: 4 }}>{unit}</span>}
      </div>
      {change && <div className="stat-card__change">{change}</div>}
    </div>
  )
}
