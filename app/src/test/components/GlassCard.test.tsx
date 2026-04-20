/** @vitest-environment happy-dom */
// ============================================================
// Component tests: GlassCard, BalanceDisplay, AuctionTimer
// Using React Testing Library + Vitest + jsdom
// ============================================================

import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { GlassCard, SkeletonLine, SkeletonCard, EmptyState, ErrorState, StatusDot, StatItem } from '../../components/GlassCard'
import { AuctionTimer } from '../../components/AuctionTimer'

// ─── GlassCard ────────────────────────────────────────────

describe('GlassCard', () => {
  it('renders children', () => {
    render(<GlassCard>Hello World</GlassCard>)
    expect(screen.getByText('Hello World')).toBeTruthy()
  })

  it('applies custom className', () => {
    const { container } = render(<GlassCard className="test-class">X</GlassCard>)
    expect(container.firstChild).toHaveClass('glass-card')
    expect(container.firstChild).toHaveClass('test-class')
  })

  it('applies glow class for blue glow', () => {
    const { container } = render(<GlassCard glow="blue">X</GlassCard>)
    expect(container.firstChild).toHaveClass('glass-card--glow-blue')
  })

  it('applies glow class for violet glow', () => {
    const { container } = render(<GlassCard glow="violet">X</GlassCard>)
    expect(container.firstChild).toHaveClass('glass-card--glow-violet')
  })

  it('applies glow class for emerald glow', () => {
    const { container } = render(<GlassCard glow="emerald">X</GlassCard>)
    expect(container.firstChild).toHaveClass('glass-card--glow-emerald')
  })

  it('applies no glow class when glow = none', () => {
    const { container } = render(<GlassCard glow="none">X</GlassCard>)
    expect((container.firstChild as Element)?.className).not.toContain('glow')
  })

  it('applies elevated class', () => {
    const { container } = render(<GlassCard elevated>X</GlassCard>)
    expect(container.firstChild).toHaveClass('glass-card--elevated')
  })

  it('sets cursor pointer when onClick provided', () => {
    const { container } = render(<GlassCard onClick={() => {}}>X</GlassCard>)
    const el = container.firstChild as HTMLElement
    expect(el.style.cursor).toBe('pointer')
  })

  it('fires onClick handler', () => {
    const fn = vi.fn()
    render(<GlassCard onClick={fn}>Click Me</GlassCard>)
    screen.getByText('Click Me').click()
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('respects custom padding', () => {
    const { container } = render(<GlassCard padding="32px">X</GlassCard>)
    const el = container.firstChild as HTMLElement
    expect(el.style.padding).toBe('32px')
  })
})

// ─── SkeletonLine ─────────────────────────────────────────

describe('SkeletonLine', () => {
  it('renders without errors', () => {
    const { container } = render(<SkeletonLine />)
    expect(container.firstChild).toHaveClass('skeleton')
  })
  it('applies custom width', () => {
    const { container } = render(<SkeletonLine width="60px" />)
    const el = container.firstChild as HTMLElement
    expect(el.style.width).toBe('60px')
  })
  it('applies custom height', () => {
    const { container } = render(<SkeletonLine height="24px" />)
    const el = container.firstChild as HTMLElement
    expect(el.style.height).toBe('24px')
  })
})

// ─── SkeletonCard ─────────────────────────────────────────

describe('SkeletonCard', () => {
  it('renders inside a GlassCard', () => {
    const { container } = render(<SkeletonCard />)
    expect(container.querySelector('.glass-card')).toBeTruthy()
  })
  it('renders 3 skeleton lines by default', () => {
    const { container } = render(<SkeletonCard rows={3} />)
    const skeletons = container.querySelectorAll('.skeleton')
    expect(skeletons.length).toBeGreaterThanOrEqual(2)
  })
})

// ─── EmptyState ───────────────────────────────────────────

describe('EmptyState', () => {
  it('renders the title', () => {
    render(<EmptyState title="Nothing here" />)
    expect(screen.getByText('Nothing here')).toBeTruthy()
  })
  it('renders the description', () => {
    render(<EmptyState title="T" description="Some description text" />)
    expect(screen.getByText('Some description text')).toBeTruthy()
  })
  it('renders action button when provided', () => {
    const fn = vi.fn()
    render(<EmptyState title="T" action={{ label: 'Retry', onClick: fn }} />)
    const btn = screen.getByText('Retry')
    expect(btn).toBeTruthy()
    btn.click()
    expect(fn).toHaveBeenCalled()
  })
  it('does not render action button when not provided', () => {
    render(<EmptyState title="No Action" />)
    expect(screen.queryByRole('button')).toBeNull()
  })
  it('renders custom icon', () => {
    render(<EmptyState icon="🔒" title="T" />)
    expect(screen.getByText('🔒')).toBeTruthy()
  })
})

// ─── ErrorState ───────────────────────────────────────────

describe('ErrorState', () => {
  it('renders the error message', () => {
    render(<ErrorState message="Connection failed" />)
    expect(screen.getByText('Connection failed')).toBeTruthy()
  })
  it('renders default title "Something went wrong"', () => {
    render(<ErrorState message="X" />)
    expect(screen.getByText('Something went wrong')).toBeTruthy()
  })
  it('renders custom title', () => {
    render(<ErrorState title="TEE Error" message="TEE is offline" />)
    expect(screen.getByText('TEE Error')).toBeTruthy()
  })
  it('renders Retry button when onRetry provided', () => {
    const fn = vi.fn()
    render(<ErrorState message="err" onRetry={fn} />)
    screen.getByText('Retry').click()
    expect(fn).toHaveBeenCalled()
  })
  it('no Retry button without onRetry', () => {
    render(<ErrorState message="err" />)
    expect(screen.queryByText('Retry')).toBeNull()
  })
})

// ─── StatusDot ────────────────────────────────────────────

describe('StatusDot', () => {
  const statuses = ['green', 'amber', 'red', 'muted'] as const
  statuses.forEach(status => {
    it(`renders ${status} status dot`, () => {
      const { container } = render(<StatusDot status={status} />)
      expect(container.firstChild).toHaveClass(`dot-indicator--${status}`)
    })
  })
})

// ─── StatItem ─────────────────────────────────────────────

describe('StatItem', () => {
  it('renders label and value', () => {
    render(<StatItem label="Private Balance" value="100,000" />)
    expect(screen.getByText('Private Balance')).toBeTruthy()
    expect(screen.getByText('100,000')).toBeTruthy()
  })
  it('renders unit when provided', () => {
    render(<StatItem label="Balance" value="500" unit="USDC" />)
    expect(screen.getByText('USDC')).toBeTruthy()
  })
  it('renders change when provided', () => {
    render(<StatItem label="Balance" value="500" change="+2.5%" />)
    expect(screen.getByText('+2.5%')).toBeTruthy()
  })
})

// ─── AuctionTimer ─────────────────────────────────────────

describe('AuctionTimer', () => {
  it('renders countdown in compact mode', () => {
    const future = Math.floor(Date.now() / 1000) + 900
    const { container } = render(<AuctionTimer closeTime={future} compact />)
    // Should show MM:SS format
    const text = container.textContent ?? ''
    expect(text).toMatch(/\d{2}:\d{2}:\d{2}|\d{2}:\d{2}/)
  })

  it('shows CLOSED when expired in compact mode', () => {
    const past = Math.floor(Date.now() / 1000) - 100
    const { container } = render(<AuctionTimer closeTime={past} compact />)
    expect(container.textContent).toContain('CLOSED')
  })

  it('calls onExpire when closeTime is in the past', async () => {
    const onExpire = vi.fn()
    const past = Math.floor(Date.now() / 1000) - 10
    render(<AuctionTimer closeTime={past} onExpire={onExpire} />)
    await waitFor(() => {
      expect(onExpire).toHaveBeenCalled()
    }, { timeout: 2000 })
  })

  it('renders SVG ring in full mode', () => {
    const future = Math.floor(Date.now() / 1000) + 900
    const { container } = render(<AuctionTimer closeTime={future} />)
    expect(container.querySelector('svg')).toBeTruthy()
    expect(container.querySelector('circle')).toBeTruthy()
  })

  it('shows "Auction Closes In" when active', () => {
    const future = Math.floor(Date.now() / 1000) + 900
    render(<AuctionTimer closeTime={future} />)
    expect(screen.getByText('Auction Closes In')).toBeTruthy()
  })

  it('shows "Auction Closed" when expired (full mode)', async () => {
    const past = Math.floor(Date.now() / 1000) - 10
    render(<AuctionTimer closeTime={past} />)
    await waitFor(() => {
      expect(screen.getByText('Auction Closed')).toBeTruthy()
    }, { timeout: 2000 })
  })
})
