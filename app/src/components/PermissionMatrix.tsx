import { useAppStore } from '../store/useAppStore'
import { GlassCard } from './GlassCard'
import { flagsToLabels, AUTHORITY_FLAG, TX_LOGS_FLAG, TX_BALANCES_FLAG, TX_MESSAGE_FLAG, ACCOUNT_SIGNATURES_FLAG, TRADER_FLAGS, AUDITOR_FLAGS, ADMIN_FLAGS } from '../lib/permissions'

const FLAG_DEFS = [
  { flag: AUTHORITY_FLAG,          key: 'AUTHORITY',          cls: 'flag-chip--authority',  desc: 'Modify permissions, add/remove members' },
  { flag: TX_LOGS_FLAG,            key: 'TX_LOGS',            cls: 'flag-chip--tx-logs',    desc: 'View transaction execution logs' },
  { flag: TX_BALANCES_FLAG,        key: 'TX_BALANCES',        cls: 'flag-chip--tx-balances',desc: 'View account balance changes' },
  { flag: TX_MESSAGE_FLAG,         key: 'TX_MESSAGE',         cls: 'flag-chip--tx-message', desc: 'View transaction message data' },
  { flag: ACCOUNT_SIGNATURES_FLAG, key: 'ACCOUNT_SIGNATURES', cls: 'flag-chip--signatures', desc: 'View account signatures' },
]

const ROLES = [
  { name: 'Trader',   flags: TRADER_FLAGS,  badge: 'badge--emerald', description: 'Own account state only' },
  { name: 'Auditor',  flags: AUDITOR_FLAGS,  badge: 'badge--violet',  description: 'Logs, balances, messages, signatures' },
  { name: 'Admin',    flags: ADMIN_FLAGS,   badge: 'badge--amber',   description: 'Full permission management' },
]

export function PermissionMatrix() {
  const { walletPublicKey } = useAppStore()
  const selfPubkey = walletPublicKey?.toBase58() ?? '—'

  return (
    <div className="flex flex-col gap-4">
      {/* Flag reference */}
      <GlassCard padding="16px">
        <div className="heading-3" style={{ marginBottom: 12 }}>Permission Flags</div>
        <div className="flex flex-col gap-2">
          {FLAG_DEFS.map(f => (
            <div key={f.key} className="flex items-center justify-between gap-3">
              <span className={`flag-chip ${f.cls}`}>{f.key}</span>
              <span className="body-sm" style={{ color: 'var(--text-muted)', flex: 1, textAlign: 'right', fontSize: '0.75rem' }}>{f.desc}</span>
            </div>
          ))}
        </div>
      </GlassCard>

      {/* Role matrix */}
      <GlassCard padding="16px">
        <div className="heading-3" style={{ marginBottom: 12 }}>Role Matrix</div>
        <div className="flex flex-col gap-3">
          {ROLES.map(role => (
            <div key={role.name}>
              <div className="flex items-center gap-2" style={{ marginBottom: 6 }}>
                <span className={`badge ${role.badge}`}>{role.name}</span>
                <span className="caption">{role.description}</span>
              </div>
              <div className="flex" style={{ gap: 4, flexWrap: 'wrap' }}>
                {FLAG_DEFS.map(f => {
                  const has = (role.flags & f.flag) !== 0
                  return (
                    <span key={f.key} className={`flag-chip ${has ? f.cls : 'flag-chip--locked'}`}>
                      {has ? f.key : '—'}
                    </span>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </GlassCard>

      {/* Your permission context */}
      <GlassCard padding="16px" glow="blue">
        <div className="heading-3" style={{ marginBottom: 10 }}>Your Permission Context</div>
        <div className="flex flex-col gap-2">
          <div className="flex justify-between">
            <span className="caption">Wallet</span>
            <span className="mono" style={{ fontSize: '0.75rem', color: 'var(--blue-light)' }}>
              {selfPubkey !== '—' ? `${selfPubkey.slice(0,8)}…${selfPubkey.slice(-4)}` : '—'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="caption">Role</span>
            <span className="badge badge--emerald">Trader</span>
          </div>
          <div className="flex justify-between items-start">
            <span className="caption">Active Flags</span>
            <div className="flex" style={{ gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {flagsToLabels(TRADER_FLAGS).map(l => (
                <span key={l} className={`flag-chip ${FLAG_DEFS.find(f => f.key === l)?.cls}`}>{l}</span>
              ))}
            </div>
          </div>
          <hr className="divider" style={{ margin: '6px 0' }} />
          <div className="caption" style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>
            Permissions enforced on PER at account level. Access to all delegated accounts is controlled by membership flags. There is no per-field reveal beyond what your flag grants.
          </div>
        </div>
      </GlassCard>
    </div>
  )
}
