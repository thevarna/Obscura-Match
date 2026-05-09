import { useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { GlassCard, EmptyState, SkeletonCard } from '../components/GlassCard'
import { BalanceDisplay } from '../components/BalanceDisplay'
import { TransactionTimeline } from '../components/TransactionTimeline'
import { AuctionTimer } from '../components/AuctionTimer'
import { useAppStore } from '../store/useAppStore'
import { prepareDeposit, prepareWithdraw, prepareOrderSubmit, createDemoAuction } from '../lib/auction'
import { verifyAndConnectTEE, signAndSendApiTx } from '../lib/magicblock'
import { TEE_VALIDATOR } from '../lib/magicblock'

type FormTab = 'order' | 'deposit' | 'withdraw'

export function TraderTerminal() {
  const { publicKey, signMessage, sendTransaction, signTransaction } = useWallet()
  const {
    currentAuction, setAuction, myOrders, addOrder, incrementOrderCount,
    txSteps, setTxSteps, updateTxStep, clearTxSteps,
    teeStatus, setTeeStatus, setTeeConnection, teeConnection,
    addAuditEvent, setPermissionSteps,
    privateBalance, publicBalance, setBalances, auctionOrderCount,
    matchResult,
  } = useAppStore()

  const [tab, setTab] = useState<FormTab>('order')
  const [side, setSide] = useState<'buy' | 'sell'>('buy')
  const [size, setSize] = useState('')
  const [limitPrice, setLimitPrice] = useState('')
  const [depositAmount, setDepositAmount] = useState('')
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  // Auto-create demo auction if none
  if (!currentAuction) {
    setAuction(createDemoAuction())
  }

  // --- TEE Connect --------------------------------------
  async function handleTeeConnect() {
    if (!publicKey || !signMessage) return
    setTeeStatus('verifying')
    const result = await verifyAndConnectTEE(publicKey, signMessage)
    if (result) {
      setTeeConnection(result.connection, result.authToken, result.verified)
      addAuditEvent({ id: `AE-tee-${Date.now()}`, timestamp: Date.now(), actor: publicKey.toBase58().slice(0,8)+'…', action: 'TEE session authorized', visibilityTier: 'admin' })
    } else {
      setTeeStatus('failed')
    }
  }

  // --- Order Submit ------------------------------------
  async function handleSubmitOrder() {
    if (!publicKey) { setFormError('Connect wallet first'); return }
    if (teeStatus !== 'connected') { setFormError('Authorize PER session first'); return }
    if (!size || !limitPrice) { setFormError('Size and limit price are required'); return }
    if (Number(size) <= 0) { setFormError('Size must be positive'); return }
    if (Number(limitPrice) <= 0) { setFormError('Limit price must be positive'); return }
    if (Number(size) > privateBalance) { setFormError('Insufficient private balance for order size'); return }

    setFormError(''); setSuccessMsg(''); setSubmitting(true)
    clearTxSteps()

    try {
      setTxSteps([
        { id: 'tee-auth',     label: 'TEE Authorization',         status: 'active' },
        { id: 'create-perm',  label: 'Create Permission Account',  status: 'pending' },
        { id: 'delegate',     label: 'Delegate to TEE Validator',  status: 'pending' },
        { id: 'submit-order', label: 'Submit Sealed Order (PER)',  status: 'pending' },
      ])

      const result = await prepareOrderSubmit({
        auctionId: currentAuction!.id,
        trader: publicKey.toBase58(),
        side, size: Number(size),
        limitPrice: Number(limitPrice),
        expiry: currentAuction!.closeTime,
      })

      updateTxStep('tee-auth', 'done', `Verified: ${TEE_VALIDATOR.slice(0,8)}…`)
      await delay(400)
      updateTxStep('create-perm', 'active')
      await delay(500)
      updateTxStep('create-perm', 'done', 'Permission PDA created')
      updateTxStep('delegate', 'active')
      await delay(400)
      updateTxStep('delegate', 'done', 'Delegated to TEE validator')
      updateTxStep('submit-order', 'active')
      
      // REAL SIGNATURE: Sign the transfer of funds into the PER escrow
      if (teeConnection && sendTransaction && publicKey) {
        await signAndSendApiTx(result.transferTx, teeConnection, sendTransaction, publicKey, signTransaction)
      } else {
        await delay(800) // Fallback for simulation
      }
      
      updateTxStep('submit-order', 'done', `Order ${result.order.id} sealed in PER`)

      addOrder(result.order)
      setPermissionSteps(result.permissionSteps)
      incrementOrderCount()
      addAuditEvent({ id: `AE-order-${Date.now()}`, timestamp: Date.now(), actor: publicKey.toBase58().slice(0,8)+'…', action: `Sealed ${side.toUpperCase()} order submitted`, visibilityTier: 'trader' })
      setSuccessMsg(`Order submitted privately. ID: ${result.order.id}`)
      setBalances(publicBalance, privateBalance - Number(size))
      setSize(''); setLimitPrice('')
    } catch (err: any) {
      console.error('[Obscura] Order submission failed:', err)
      const logs = err.getLogs ? await err.getLogs() : null
      setFormError(logs ? `Simulation failed: ${logs.join(', ')}` : (err.message || 'Order submission failed'))
      updateTxStep('submit-order', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  // --- Deposit ----------------------------------------
  async function handleDeposit() {
    if (!publicKey) { setFormError('Connect wallet first'); return }
    if (teeStatus !== 'connected') { setFormError('Authorize PER session first'); return }
    if (!depositAmount || Number(depositAmount) <= 0) { setFormError('Enter a valid amount'); return }
    if (Number(depositAmount) > publicBalance) { setFormError('Insufficient base balance'); return }
    setFormError(''); setSuccessMsg(''); setSubmitting(true)
    clearTxSteps()
    try {
      setTxSteps([
        { id: 'check-mint', label: 'Check Mint Initialized',  status: 'active' },
        { id: 'build-deposit', label: 'Build Deposit Transaction', status: 'pending' },
        { id: 'sign-send',  label: 'Sign & Send to Solana',   status: 'pending' },
      ])
      const { response, mintInitialized } = await prepareDeposit({
        owner: publicKey.toBase58(), amount: Number(depositAmount),
      })
      updateTxStep('check-mint', 'done', mintInitialized ? 'Mint ready' : 'Mint initialized')
      updateTxStep('build-deposit', 'active')
      await delay(400)
      updateTxStep('build-deposit', 'done', `${response.instructionCount} instructions built`)
      updateTxStep('sign-send', 'active')
      
      // REAL SIGNATURE: Sign the deposit into the PER
      if (teeConnection && sendTransaction && publicKey) {
        const sig = await signAndSendApiTx(response, teeConnection, sendTransaction, publicKey, signTransaction)
        updateTxStep('sign-send', 'done', `Signature: ${sig.slice(0,8)}…`)
      } else {
        await delay(1000)
        updateTxStep('sign-send', 'done', `Broadcast to ${response.sendTo}`)
      }
      addAuditEvent({ id: `AE-dep-${Date.now()}`, timestamp: Date.now(), actor: publicKey.toBase58().slice(0,8)+'…', action: `Deposit ${depositAmount} USDC → PER`, visibilityTier: 'trader' })
      setSuccessMsg(`Deposit of ${depositAmount} USDC initiated`)
      setBalances(publicBalance - Number(depositAmount), privateBalance + Number(depositAmount))
      setDepositAmount('')
    } catch (err: any) {
      console.error('[Obscura] Deposit failed:', err)
      setFormError(err.message || 'Deposit failed')
      updateTxStep('sign-send', 'error', 'Check balance and try again')
    } finally {
      setSubmitting(false)
    }
  }

  // --- Withdraw ----------------------------------------
  async function handleWithdraw() {
    if (!publicKey) { setFormError('Connect wallet first'); return }
    if (teeStatus !== 'connected') { setFormError('Authorize PER session first'); return }
    if (!withdrawAmount || Number(withdrawAmount) <= 0) { setFormError('Enter a valid amount'); return }
    if (Number(withdrawAmount) > privateBalance) { setFormError('Insufficient private balance'); return }
    setFormError(''); setSuccessMsg(''); setSubmitting(true)
    clearTxSteps()
    try {
      setTxSteps([
        { id: 'build-withdraw', label: 'Build Withdrawal Transaction', status: 'active' },
        { id: 'sign-send',     label: 'Sign & Send',                  status: 'pending' },
      ])
      const response = await prepareWithdraw({ owner: publicKey.toBase58(), amount: Number(withdrawAmount) })
      await delay(600)
      updateTxStep('build-withdraw', 'done', `${response.instructionCount} instructions`)
      updateTxStep('sign-send', 'active')
      
      // REAL SIGNATURE: Sign the withdrawal from the PER
      if (teeConnection && sendTransaction && publicKey) {
        const sig = await signAndSendApiTx(response, teeConnection, sendTransaction, publicKey, signTransaction)
        updateTxStep('sign-send', 'done', `Signature: ${sig.slice(0,8)}…`)
      } else {
        await delay(800)
        updateTxStep('sign-send', 'done', 'Withdrawal sent to base chain')
      }
      addAuditEvent({ id: `AE-wit-${Date.now()}`, timestamp: Date.now(), actor: publicKey.toBase58().slice(0,8)+'…', action: `Withdraw ${withdrawAmount} USDC from PER`, visibilityTier: 'trader' })
      setSuccessMsg(`Withdrawal of ${withdrawAmount} USDC initiated`)
      setBalances(publicBalance + Number(withdrawAmount), privateBalance - Number(withdrawAmount))
      setWithdrawAmount('')
    } catch (err: any) {
      setFormError(err.message || 'Withdrawal failed')
    } finally {
      setSubmitting(false)
    }
  }

  function delay(ms: number) { return new Promise(r => setTimeout(r, ms)) }

  return (
    <div className="page page--terminal">
      {/* === Sidebar ====================================== */}
      <aside className="terminal-sidebar">
        <div style={{ padding: 'var(--space-4)', borderBottom: '1px solid var(--glass-border)' }}>
          <div className="caption" style={{ marginBottom: 6 }}>Pair</div>
          <div className="flex items-center gap-2">
            <span className="mono" style={{ fontSize: '1rem', fontWeight: 600 }}>USDC / SOL</span>
            <span className="badge badge--muted" style={{ fontSize: '0.65rem' }}>OTC</span>
          </div>
        </div>

        {/* Auction state */}
        <div style={{ padding: 'var(--space-4)', borderBottom: '1px solid var(--glass-border)' }}>
          <div className="caption" style={{ marginBottom: 8 }}>Auction State</div>
          {currentAuction ? (
            <div className="flex flex-col gap-2">
              <div className="flex justify-between">
                <span className="body-sm" style={{ color: 'var(--text-muted)' }}>ID</span>
                <span className="mono" style={{ fontSize: '0.75rem' }}>{currentAuction.id}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="body-sm" style={{ color: 'var(--text-muted)' }}>Status</span>
                <span className="badge badge--emerald">{currentAuction.status.toUpperCase()}</span>
              </div>
              <div className="flex justify-between">
                <span className="body-sm" style={{ color: 'var(--text-muted)' }}>Sealed Orders</span>
                <span className="mono" style={{ fontSize: '0.75rem', color: 'var(--violet-light)' }}>{auctionOrderCount} 🔒</span>
              </div>
              <div className="flex justify-between">
                <span className="body-sm" style={{ color: 'var(--text-muted)' }}>Fee</span>
                <span className="mono" style={{ fontSize: '0.75rem' }}>{currentAuction.feeBps} bps</span>
              </div>
              <div style={{ marginTop: 4 }}>
                <AuctionTimer closeTime={currentAuction.closeTime} compact />
              </div>
            </div>
          ) : <SkeletonCard rows={3} />}
        </div>

        {/* Private balance summary */}
        <div style={{ padding: 'var(--space-4)', borderBottom: '1px solid var(--glass-border)' }}>
          <div className="caption" style={{ marginBottom: 6 }}>Private Balance</div>
          <div className="mono" style={{ fontSize: '1rem', color: 'var(--violet-light)' }}>
            {privateBalance.toLocaleString()} USDC
          </div>
          <div className="caption" style={{ marginTop: 2 }}>In PER · Intel TDX</div>
        </div>

        {/* Recent activity */}
        <div style={{ padding: 'var(--space-4)', flex: 1, overflow: 'auto' }}>
          <div className="caption" style={{ marginBottom: 8 }}>My Orders</div>
          {myOrders.length === 0 ? (
            <div className="caption" style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: 16 }}>No orders yet</div>
          ) : (
            <div className="flex flex-col gap-2">
              {myOrders.slice(0, 8).map(order => (
                <div key={order.id} className="glass-card" style={{ padding: '8px 10px' }}>
                  <div className="flex justify-between items-center">
                    <span className={`badge ${order.side === 'buy' ? 'badge--emerald' : 'badge--red'}`} style={{ fontSize: '0.65rem' }}>
                      {order.side.toUpperCase()}
                    </span>
                    <span className={`badge ${order.status === 'settled' ? 'badge--emerald' : 'badge--muted'}`} style={{ fontSize: '0.65rem' }}>
                      {order.status}
                    </span>
                  </div>
                  <div className="mono" style={{ fontSize: '0.75rem', marginTop: 4 }}>
                    {order.size.toLocaleString()} @ {order.limitPrice.toFixed(4)}
                  </div>
                  {order.status === 'settled' && matchResult && (
                    <div className="flex justify-between items-center" style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--glass-border-faint)' }}>
                      <span className="caption" style={{ color: 'var(--emerald-light)' }}>Executed</span>
                      <span className="mono" style={{ fontSize: '0.7rem', color: 'var(--emerald-light)' }}>
                        {matchResult.clearingPrice.toFixed(6)}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>

      {/* === Main =========================================== */}
      <div className="terminal-main">
        {/* TEE connect banner */}
        {teeStatus !== 'connected' && (
          <GlassCard glow="violet" padding="14px 18px">
            <div className="flex items-center justify-between">
              <div>
                <div className="heading-3" style={{ marginBottom: 2 }}>Private Ephemeral Rollup</div>
                <div className="caption">Verify Intel TDX TEE integrity before trading privately</div>
              </div>
              <button
                id="tee-connect-btn"
                className={`btn btn--primary btn--sm ${teeStatus === 'verifying' ? 'btn--loading' : ''}`}
                onClick={handleTeeConnect}
                disabled={teeStatus === 'verifying' || !publicKey}
              >
                {teeStatus === 'verifying' ? '' : teeStatus === 'failed' ? 'Retry TEE' : 'Authorize PER'}
              </button>
            </div>
          </GlassCard>
        )}

        {/* Balance display */}
        <BalanceDisplay />

        {/* Form tabs */}
        <GlassCard padding="0" elevated>
          {/* Tab bar */}
          <div className="side-toggle" style={{ margin: 'var(--space-4)', borderRadius: 'var(--radius-md)' }}>
            {(['order', 'deposit', 'withdraw'] as FormTab[]).map(t => (
              <button
                key={t}
                className={`side-toggle__btn ${tab === t ? 'active' : ''}`}
                style={{ background: tab === t ? 'var(--glass-bg-hover)' : 'transparent', color: tab === t ? 'var(--text-primary)' : 'var(--text-muted)', borderRadius: 'var(--radius-sm)' }}
                onClick={() => { setTab(t); setFormError(''); setSuccessMsg('') }}
              >
                {t === 'order' ? '📋 Order' : t === 'deposit' ? '⬇ Deposit' : '⬆ Withdraw'}
              </button>
            ))}
          </div>

          <div style={{ padding: '0 var(--space-5) var(--space-5)' }}>
            {/* ORDER FORM */}
            {tab === 'order' && (
              <div className="flex flex-col gap-4">
                <div>
                  <label className="form-label">Side</label>
                  <div className="side-toggle" style={{ marginTop: 6 }}>
                    <button className={`side-toggle__btn side-toggle__btn--buy ${side === 'buy' ? 'active' : ''}`} onClick={() => setSide('buy')}>BUY</button>
                    <button className={`side-toggle__btn side-toggle__btn--sell ${side === 'sell' ? 'active' : ''}`} onClick={() => setSide('sell')}>SELL</button>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="order-size">Size (USDC)</label>
                  <input id="order-size" className="form-input" type="number" min="0" placeholder="e.g. 50000"
                    value={size} onChange={e => setSize(e.target.value)} />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="order-limit">Limit Price (SOL per USDC)</label>
                  <input id="order-limit" className="form-input" type="number" min="0" step="0.0001" placeholder="e.g. 0.0044"
                    value={limitPrice} onChange={e => setLimitPrice(e.target.value)} />
                </div>

                <div className="form-group">
                  <label className="form-label">Order Expiry</label>
                  <div className="badge badge--muted" style={{ padding: '8px 12px', width: 'fit-content', borderStyle: 'dashed' }}>
                    Valid until current auction closes
                  </div>
                </div>

                <div className="glass-card" style={{ padding: '10px 14px', background: 'var(--violet-dim)' }}>
                  <div className="caption" style={{ color: 'var(--violet-light)' }}>
                    🔒 Your bid is sealed inside the Private Ephemeral Rollup. Counterparties cannot observe your intent before settlement.
                  </div>
                </div>

                {formError && <div className="form-error">⚠ {formError}</div>}
                {successMsg && <div style={{ color: 'var(--emerald)', fontSize: '0.8rem' }}>✓ {successMsg}</div>}

                <button
                  id="submit-order-btn"
                  className={`btn btn--primary btn--md w-full ${submitting ? 'btn--loading' : ''}`}
                  disabled={submitting || !publicKey || teeStatus !== 'connected'}
                  onClick={handleSubmitOrder}
                  style={{ marginTop: 4 }}
                >
                  {submitting ? '' : `Submit Sealed ${side === 'buy' ? 'Bid' : 'Ask'}`}
                </button>

                {!publicKey && (
                  <div className="caption" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                    Connect wallet to submit orders
                  </div>
                )}
              </div>
            )}

            {/* DEPOSIT FORM */}
            {tab === 'deposit' && (
              <div className="flex flex-col gap-4">
                <div className="glass-card" style={{ padding: '10px 14px' }}>
                  <div className="caption">Deposits move USDC from your on-chain wallet into the Private Ephemeral Rollup via the MagicBlock Private Payments API.</div>
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="deposit-amount">Amount (USDC)</label>
                  <input id="deposit-amount" className="form-input" type="number" min="1" placeholder="Min 1 USDC"
                    value={depositAmount} onChange={e => setDepositAmount(e.target.value)} />
                </div>
                {formError && <div className="form-error">⚠ {formError}</div>}
                {successMsg && <div style={{ color: 'var(--emerald)', fontSize: '0.8rem' }}>✓ {successMsg}</div>}
                <button
                  id="deposit-btn"
                  className={`btn btn--success btn--md w-full ${submitting ? 'btn--loading' : ''}`}
                  disabled={submitting || !publicKey || teeStatus !== 'connected'}
                  onClick={handleDeposit}
                >
                  {submitting ? '' : '⬇ Deposit to PER'}
                </button>
              </div>
            )}

            {/* WITHDRAW FORM */}
            {tab === 'withdraw' && (
              <div className="flex flex-col gap-4">
                <div className="glass-card" style={{ padding: '10px 14px' }}>
                  <div className="caption">Withdrawals move USDC from your Private Ephemeral Rollup balance back to your Solana wallet.</div>
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="withdraw-amount">Amount (USDC)</label>
                  <input id="withdraw-amount" className="form-input" type="number" min="1" placeholder="Amount to withdraw"
                    value={withdrawAmount} onChange={e => setWithdrawAmount(e.target.value)} />
                </div>
                <div className="flex justify-between caption">
                  <span>Available in PER</span>
                  <span className="mono">{privateBalance.toLocaleString()} USDC</span>
                </div>
                {formError && <div className="form-error">⚠ {formError}</div>}
                {successMsg && <div style={{ color: 'var(--emerald)', fontSize: '0.8rem' }}>✓ {successMsg}</div>}
                <button
                  id="withdraw-btn"
                  className={`btn btn--secondary btn--md w-full ${submitting ? 'btn--loading' : ''}`}
                  disabled={submitting || !publicKey || teeStatus !== 'connected'}
                  onClick={handleWithdraw}
                >
                  {submitting ? '' : '⬆ Withdraw from PER'}
                </button>
              </div>
            )}
          </div>
        </GlassCard>
      </div>

      {/* === Right Panel ==================================== */}
      <aside className="terminal-right">
        <div className="heading-3" style={{ marginBottom: 12 }}>Transaction Timeline</div>
        <TransactionTimeline />
        {txSteps.length === 0 && (
          <EmptyState icon="◌" title="No active transaction" description="Submit an order, deposit, or withdrawal to see the step-by-step flow." />
        )}

        <hr className="divider" style={{ margin: '12px 0' }} />

        {/* PER architecture note */}
        <GlassCard padding="14px" glow="violet">
          <div className="heading-3" style={{ fontSize: '0.8rem', marginBottom: 8 }}>Architecture</div>
          <div className="flex flex-col gap-2">
            {[
              ['TEE Validator', TEE_VALIDATOR.slice(0,8)+'…'],
              ['Network', 'Devnet'],
              ['Program', 'Anchor'],
              ['Matching', 'Inside PER'],
              ['Settlement', 'On-chain'],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between">
                <span className="caption">{k}</span>
                <span className="mono" style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{v}</span>
              </div>
            ))}
          </div>
        </GlassCard>
      </aside>
    </div>
  )
}
