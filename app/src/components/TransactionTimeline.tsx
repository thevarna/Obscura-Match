import { useAppStore, type TxStep } from '../store/useAppStore'

const ICONS: Record<TxStep['status'], string> = {
  pending: '○',
  active:  '◎',
  done:    '✓',
  error:   '✕',
}

export function TransactionTimeline() {
  const { txSteps } = useAppStore()

  if (!txSteps.length) return null

  return (
    <div className="timeline">
      {txSteps.map((step) => (
        <div key={step.id} className={`timeline-item timeline-item--${step.status}`}>
          <div className="timeline-item__dot">{ICONS[step.status]}</div>
          <div className="timeline-item__content">
            <div className="timeline-item__title">{step.label}</div>
            {step.detail && <div className="timeline-item__detail">{step.detail}</div>}
          </div>
        </div>
      ))}
    </div>
  )
}
