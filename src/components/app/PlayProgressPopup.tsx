import type { ActivePlayProgress } from '../../types/psdk'
import {
  resolveCommandMethodLabel,
  formatProgressStatusLabel,
  formatProgressStepLabel,
  formatTimestamp,
} from './view-helpers'
import { getText } from '../../lib/i18n'
import type { AppLanguage } from '../../types/app'

interface PlayProgressPopupProps {
  language: AppLanguage
  progress: ActivePlayProgress | null
  onClose: () => void
}

export const PlayProgressPopup = ({
  language,
  progress,
  onClose,
}: PlayProgressPopupProps) => {
  if (!progress) return null

  const text = getText(language).playProgress
  const common = getText(language).common
  const methodLabel = resolveCommandMethodLabel(progress.commandMethod, language)
  const percentLabel =
    typeof progress.progress.percent === 'number'
      ? `${progress.progress.percent}%`
      : common.na
  const stepLabel =
    formatProgressStepLabel(progress.progress.stepKey, language) ?? common.na
  const statusLabel =
    formatProgressStatusLabel(progress.progress.status, language) ?? common.na

  return (
    <aside
      className='fixed bottom-4 right-4 z-40 w-[min(28rem,calc(100vw-2rem))] rounded-2xl border border-signal-500/45 bg-coal-900/95 p-4 shadow-panel backdrop-blur'
      role='status'
      aria-live='polite'
    >
      <div className='mb-3 flex items-start justify-between gap-3'>
        <div>
          <p className='panel-title'>{text.title}</p>
          <h3 className='mt-2 text-base text-steel-100'>{methodLabel}</h3>
        </div>
        <button className='btn btn-danger px-3 py-1.5 text-xs' onClick={onClose}>
          {getText(language).common.close}
        </button>
      </div>

      <dl className='grid grid-cols-2 gap-x-3 gap-y-2 text-sm'>
        <dt className='text-steel-400'>{text.percent}</dt>
        <dd className='font-semibold text-signal-400'>{percentLabel}</dd>
        <dt className='text-steel-400'>{text.step}</dt>
        <dd className='text-steel-100'>{stepLabel}</dd>
        <dt className='text-steel-400'>{text.status}</dt>
        <dd className='text-steel-100'>{statusLabel}</dd>
        <dt className='text-steel-400'>{text.tid}</dt>
        <dd className='font-mono text-[11px] text-steel-300'>{progress.shortTid}</dd>
        <dt className='text-steel-400'>{text.updated}</dt>
        <dd className='text-steel-300'>
          {formatTimestamp(progress.progress.updatedAt, language)}
        </dd>
      </dl>
    </aside>
  )
}

