import type { ActivePlayProgress } from '../../types/psdk'
import {
  COMMAND_METHOD_LABELS,
  formatProgressStatusLabel,
  formatProgressStepLabel,
  formatTimestamp,
} from './view-helpers'

interface PlayProgressPopupProps {
  progress: ActivePlayProgress | null
  onClose: () => void
}

export const PlayProgressPopup = ({
  progress,
  onClose,
}: PlayProgressPopupProps) => {
  if (!progress) return null

  const methodLabel =
    COMMAND_METHOD_LABELS[progress.commandMethod] ?? progress.commandMethod
  const percentLabel =
    typeof progress.progress.percent === 'number'
      ? `${progress.progress.percent}%`
      : 'N/A'
  const stepLabel = formatProgressStepLabel(progress.progress.stepKey) ?? 'N/A'
  const statusLabel =
    formatProgressStatusLabel(progress.progress.status) ?? 'N/A'

  return (
    <aside
      className='fixed bottom-4 right-4 z-40 w-[min(28rem,calc(100vw-2rem))] rounded-2xl border border-signal-500/45 bg-coal-900/95 p-4 shadow-panel backdrop-blur'
      role='status'
      aria-live='polite'
    >
      <div className='mb-3 flex items-start justify-between gap-3'>
        <div>
          <p className='panel-title'>play progress</p>
          <h3 className='mt-2 text-base text-steel-100'>{methodLabel}</h3>
        </div>
        <button className='btn btn-danger px-3 py-1.5 text-xs' onClick={onClose}>
          Close
        </button>
      </div>

      <dl className='grid grid-cols-2 gap-x-3 gap-y-2 text-sm'>
        <dt className='text-steel-400'>Percent</dt>
        <dd className='font-semibold text-signal-400'>{percentLabel}</dd>
        <dt className='text-steel-400'>Step</dt>
        <dd className='text-steel-100'>{stepLabel}</dd>
        <dt className='text-steel-400'>Status</dt>
        <dd className='text-steel-100'>{statusLabel}</dd>
        <dt className='text-steel-400'>TID</dt>
        <dd className='font-mono text-[11px] text-steel-300'>{progress.shortTid}</dd>
        <dt className='text-steel-400'>Updated</dt>
        <dd className='text-steel-300'>
          {formatTimestamp(progress.progress.updatedAt)}
        </dd>
      </dl>
    </aside>
  )
}

