import { InlineSpinner, SectionHeader } from './ui'
import {
  commandStatusTone,
  COMMAND_METHOD_LABELS,
  formatShortTid,
} from './view-helpers'
import type {
  CommandSequenceStep,
  SequenceRunStatus,
  SequenceStepResult,
  SequenceStepStatus,
} from '../../types/psdk'

interface CommandSequencePanelProps {
  steps: CommandSequenceStep[]
  results: SequenceStepResult[]
  status: SequenceRunStatus
  activeIndex: number | null
  stopRequested: boolean
  errorMessage?: string
  canRun: boolean
  onRun: () => void
  onStop: () => void
  onClear: () => void
  onMoveStep: (index: number, direction: 'up' | 'down') => void
  onRemoveStep: (index: number) => void
}

const getStepTone = (status: SequenceStepStatus) => {
  if (status === 'idle') return 'border-steel-600/70 text-steel-400'
  if (status === 'skipped') return 'border-steel-700/50 text-steel-500'
  return commandStatusTone[status]
}

const getStepLabel = (status: SequenceStepStatus) => {
  if (status === 'timeout') return 'timeout (10s)'
  return status
}

export const CommandSequencePanel = ({
  steps,
  results,
  status,
  activeIndex,
  stopRequested,
  errorMessage,
  canRun,
  onRun,
  onStop,
  onClear,
  onMoveStep,
  onRemoveStep,
}: CommandSequencePanelProps) => {
  const sequenceLocked = status === 'running'

  const failureSummary = (() => {
    if (status !== 'failure') return null
    if (errorMessage) return errorMessage
    const failedIndex = results.findIndex(
      (item) => item && (item.status === 'failure' || item.status === 'timeout'),
    )
    if (failedIndex === -1) return 'Sequence failed.'
    const step = steps[failedIndex]
    if (!step) return 'Sequence failed.'
    const result = results[failedIndex]
    const reason =
      result?.status === 'timeout'
        ? 'timeout (10s)'
        : `result ${result?.result ?? 'N/A'}`
    return `Failed at step ${failedIndex + 1}/${steps.length}: ${COMMAND_METHOD_LABELS[step.method]} (${reason})`
  })()

  const statusLabel = (() => {
    if (status === 'running') {
      if (activeIndex !== null && steps.length > 0) {
        return `Running (step ${activeIndex + 1}/${steps.length})`
      }
      return 'Running'
    }
    if (status === 'success') return 'Completed successfully'
    if (status === 'failure') return failureSummary ?? 'Failed'
    if (status === 'stopped') return 'Stopped by user'
    return 'Idle'
  })()

  const statusTone = (() => {
    if (status === 'running') return 'border-amber-500/60 bg-amber-500/10 text-amber-400'
    if (status === 'success') return 'border-signal-500/60 bg-signal-500/10 text-signal-400'
    if (status === 'failure') return 'border-warn-500/60 bg-warn-500/10 text-warn-500'
    if (status === 'stopped') return 'border-steel-600/60 bg-coal-900/40 text-steel-300'
    return 'border-steel-600/60 bg-coal-900/40 text-steel-400'
  })()

  return (
    <section className='panel'>
      <div className='flex flex-wrap items-start justify-between gap-4'>
        <SectionHeader title='Command Sequence' subtitle='services_reply' />
        <div className='flex flex-wrap items-center gap-2'>
          <button className='btn btn-primary' onClick={onRun} disabled={!canRun}>
            Run Sequence
          </button>
          <button
            className='btn btn-danger'
            onClick={onStop}
            disabled={!sequenceLocked}
          >
            Stop
          </button>
          <button className='btn' onClick={onClear} disabled={sequenceLocked}>
            Clear Steps
          </button>
        </div>
      </div>

      <div className='mt-5 rounded-xl border border-steel-700/45 bg-coal-900/50 px-4 py-3 text-sm'>
        <div className='flex flex-wrap items-center gap-3'>
          <span className={`chip ${statusTone}`}>{statusLabel}</span>
          {stopRequested && status === 'running' && (
            <span className='chip border-amber-500/60 bg-amber-500/10 text-amber-400'>
              Stop requested
            </span>
          )}
          <span className='text-steel-400'>Steps: {steps.length}</span>
        </div>
      </div>

      <div className='mt-5 space-y-3'>
        {steps.length === 0 ? (
          <div className='rounded-lg border border-dashed border-steel-700/60 bg-coal-900/35 px-4 py-6 text-sm text-steel-400'>
            No sequence steps yet. Use "Add to Sequence" to build a run.
          </div>
        ) : (
          steps.map((step, index) => {
            const result = results[index] ?? { status: 'idle' }
            const isActive = status === 'running' && activeIndex === index

            return (
              <div
                key={step.id}
                className={`rounded-xl border px-4 py-3 text-sm shadow-panel transition ${
                  isActive
                    ? 'border-signal-500/40 bg-signal-500/5'
                    : 'border-steel-700/45 bg-coal-900/55'
                }`}
              >
                <div className='flex flex-wrap items-center gap-3'>
                  <span className='chip border-steel-600/70 bg-transparent text-[11px] text-steel-300'>
                    Step {index + 1}
                  </span>
                  <span className='text-steel-100'>
                    {COMMAND_METHOD_LABELS[step.method]}
                  </span>
                  <span className='text-xs text-steel-400'>{step.method}</span>
                  <span className={`chip ${getStepTone(result.status)}`}>
                    {result.status === 'pending' && (
                      <InlineSpinner className='h-3 w-3' />
                    )}
                    {getStepLabel(result.status)}
                  </span>
                  <div className='ml-auto flex flex-wrap items-center gap-2'>
                    <button
                      className='btn h-8 px-3 text-xs'
                      onClick={() => onMoveStep(index, 'up')}
                      disabled={sequenceLocked || index === 0}
                      type='button'
                    >
                      Up
                    </button>
                    <button
                      className='btn h-8 px-3 text-xs'
                      onClick={() => onMoveStep(index, 'down')}
                      disabled={sequenceLocked || index === steps.length - 1}
                      type='button'
                    >
                      Down
                    </button>
                    <button
                      className='btn btn-danger h-8 px-3 text-xs'
                      onClick={() => onRemoveStep(index)}
                      disabled={sequenceLocked}
                      type='button'
                    >
                      Remove
                    </button>
                  </div>
                </div>

                <div className='mt-3 flex flex-wrap items-center gap-3 text-xs text-steel-300'>
                  <span className='rounded-full border border-steel-700/70 px-3 py-1'>
                    {step.summary}
                  </span>
                  <span className='text-steel-400'>
                    result {result.result ?? 'N/A'}
                  </span>
                  <span className='font-mono text-[11px] text-steel-500'>
                    tid {result.tid ? formatShortTid(result.tid) : 'N/A'}
                  </span>
                </div>
              </div>
            )
          })
        )}
      </div>
    </section>
  )
}
