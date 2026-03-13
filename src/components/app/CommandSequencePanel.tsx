import { useMemo, useState } from 'react'
import { InlineSpinner, SectionHeader } from './ui'
import {
  commandStatusTone,
  formatShortTid,
  resolveCommandMethodLabel,
} from './view-helpers'
import { CommandSequenceAddModal } from './CommandSequenceAddModal'
import { getText } from '../../lib/i18n'
import type { AppLanguage } from '../../types/app'
import type {
  CommandSequenceDefaults,
  CommandSequenceStep,
  PsdkCommandMethod,
  SequenceRunStatus,
  SequenceStepResult,
  SequenceStepStatus,
} from '../../types/psdk'

type SequenceWaitState = {
  index: number
  remainingMs: number
  totalMs: number
}

interface CommandSequencePanelProps {
  language: AppLanguage
  steps: CommandSequenceStep[]
  results: SequenceStepResult[]
  status: SequenceRunStatus
  activeIndex: number | null
  stopRequested: boolean
  errorMessage?: string
  defaults: CommandSequenceDefaults
  onDefaultsChange: (next: CommandSequenceDefaults) => void
  defaultWaitSeconds: number
  onDefaultWaitSecondsChange: (next: number) => void
  waitState: SequenceWaitState | null
  canRun: boolean
  onRun: () => void
  onStop: () => void
  onClear: () => void
  onMoveStep: (index: number, direction: 'up' | 'down') => void
  onRemoveStep: (index: number) => void
  onAddStep: (
    method: PsdkCommandMethod,
    data: Record<string, unknown>,
    waitSeconds: number,
  ) => void
}

const getStepTone = (status: SequenceStepStatus) => {
  if (status === 'idle') return 'border-steel-600/70 text-steel-400'
  if (status === 'skipped') return 'border-steel-700/50 text-steel-500'
  return commandStatusTone[status]
}

const getStepLabel = (status: SequenceStepStatus, language: AppLanguage) => {
  if (status === 'timeout') {
    return language === 'zh-CN' ? '超时（10 秒）' : 'timeout (10s)'
  }
  if (language === 'zh-CN') {
    if (status === 'pending') return '等待中'
    if (status === 'success') return '成功'
    if (status === 'failure') return '失败'
    if (status === 'skipped') return '已跳过'
    return '空闲'
  }
  return status
}

const DEFAULT_SEQUENCE_WAIT_MS = 3000

const formatWaitLabel = (waitMs: number) => {
  const normalizedWaitMs = Number.isFinite(waitMs)
    ? Math.max(0, waitMs)
    : DEFAULT_SEQUENCE_WAIT_MS
  if (normalizedWaitMs <= 0) return '0s'
  const seconds = normalizedWaitMs / 1000
  return Number.isInteger(seconds) ? `${seconds}s` : `${seconds.toFixed(1)}s`
}

const getRunStatusTone = (status: SequenceRunStatus) => {
  if (status === 'running') return 'border-amber-500/60 bg-amber-500/10 text-amber-400'
  if (status === 'success') return 'border-signal-500/60 bg-signal-500/10 text-signal-400'
  if (status === 'failure') return 'border-warn-500/60 bg-warn-500/10 text-warn-500'
  if (status === 'stopped') return 'border-steel-600/60 bg-coal-900/40 text-steel-300'
  return 'border-steel-600/60 bg-coal-900/40 text-steel-400'
}

const getRunStatusLabel = (
  language: AppLanguage,
  status: SequenceRunStatus,
  activeIndex: number | null,
  totalSteps: number,
  failureSummary: string | null,
) => {
  if (status === 'running') {
    if (activeIndex !== null && totalSteps > 0) {
      return language === 'zh-CN'
        ? `正在执行步骤 ${activeIndex + 1}/${totalSteps}`
        : `Running step ${activeIndex + 1}/${totalSteps}`
    }
    return language === 'zh-CN' ? '运行中' : 'Running'
  }
  if (status === 'success') {
    return language === 'zh-CN' ? '执行成功' : 'Completed successfully'
  }
  if (status === 'failure') {
    return failureSummary ?? (language === 'zh-CN' ? '执行失败' : 'Failed')
  }
  if (status === 'stopped') {
    return language === 'zh-CN' ? '已手动停止' : 'Stopped by user'
  }
  return language === 'zh-CN' ? '空闲' : 'Idle'
}

const getStepCardTone = (status: SequenceStepStatus) => {
  if (status === 'idle') {
    return 'border-steel-700/45 bg-coal-900/55'
  }
  if (status === 'pending') {
    return 'border-amber-500/55 bg-amber-500/10'
  }
  if (status === 'success') {
    return 'border-signal-500/45 bg-signal-500/10'
  }
  if (status === 'skipped') {
    return 'border-steel-700/50 bg-coal-900/45'
  }
  return 'border-warn-500/45 bg-warn-500/10'
}

interface DerivedStepViewModel {
  step: CommandSequenceStep
  index: number
  result: SequenceStepResult
  status: SequenceStepStatus
  isActive: boolean
  isWaiting: boolean
  isFailure: boolean
  usesDefaultWait: boolean
  effectiveWaitMs: number
}

interface StepSummaryEntry {
  key: string
  value: string
  mono: boolean
}

const SUMMARY_MONO_KEYS = new Set(['md5', 'tid', 'url'])

const parseStepSummaryEntries = (
  summary: string,
  naText: string,
): StepSummaryEntry[] => {
  const normalized = summary.trim()
  if (!normalized || normalized === 'N/A' || normalized === naText) return []

  return normalized
    .split('|')
    .map((segment) => segment.trim())
    .filter(Boolean)
    .map((segment, index) => {
      const separatorIndex = segment.indexOf('=')
      if (separatorIndex < 0) {
        return {
          key: `arg${index + 1}`,
          value: segment,
          mono: false,
        }
      }

      const key = segment.slice(0, separatorIndex).trim() || `arg${index + 1}`
      const value = segment.slice(separatorIndex + 1).trim() || naText

      return {
        key,
        value,
        mono: SUMMARY_MONO_KEYS.has(key),
      }
    })
}

export const CommandSequencePanel = ({
  language,
  steps,
  results,
  status,
  activeIndex,
  stopRequested,
  errorMessage,
  defaults,
  onDefaultsChange,
  defaultWaitSeconds,
  onDefaultWaitSecondsChange,
  waitState,
  canRun,
  onRun,
  onStop,
  onClear,
  onMoveStep,
  onRemoveStep,
  onAddStep,
}: CommandSequencePanelProps) => {
  const text = getText(language).sequence
  const common = getText(language).common
  const sequenceLocked = status === 'running'
  const [addOpen, setAddOpen] = useState(false)
  const [expandedStepId, setExpandedStepId] = useState<string | null>(null)
  const addModalOpen = addOpen && !sequenceLocked

  // UI mapping: overview (run summary), steps (state cards), feedback (failure diagnostics/live badges).
  const derived = useMemo(() => {
    const defaultWaitMs = Number.isFinite(defaultWaitSeconds)
      ? Math.max(0, defaultWaitSeconds) * 1000
      : DEFAULT_SEQUENCE_WAIT_MS
    const stepCards: DerivedStepViewModel[] = steps.map((step, index) => {
      const result = results[index] ?? { status: 'idle' }
      const resultStatus = result.status
      const usesDefaultWait = !Number.isFinite(step.waitMs)
      const effectiveWaitMs = usesDefaultWait ? defaultWaitMs : Math.max(0, step.waitMs)

      return {
        step,
        index,
        result,
        status: resultStatus,
        isActive: status === 'running' && activeIndex === index,
        isWaiting: Boolean(waitState && status === 'running' && waitState.index === index),
        isFailure: resultStatus === 'failure' || resultStatus === 'timeout',
        usesDefaultWait,
        effectiveWaitMs,
      }
    })

    const failedStep = stepCards.find((item) => item.isFailure)
      const failureSummary = (() => {
        if (status !== 'failure') return null
        if (errorMessage) return errorMessage
        if (!failedStep) return language === 'zh-CN' ? '序列执行失败。' : 'Sequence failed.'
        const reason =
          failedStep.status === 'timeout'
            ? language === 'zh-CN'
              ? '超时（10 秒）'
              : 'timeout (10s)'
            : `result ${failedStep.result.result ?? common.na}`
        const label = resolveCommandMethodLabel(failedStep.step.method, language)
        return language === 'zh-CN'
          ? `在步骤 ${failedStep.index + 1}/${steps.length} 失败：${label}（${reason}）`
          : `Failed at step ${failedStep.index + 1}/${steps.length}: ${label} (${reason})`
      })()

    const waitCountdownLabel =
      waitState && status === 'running'
        ? language === 'zh-CN'
          ? `下一个步骤将在 ${formatWaitLabel(waitState.remainingMs)} 后执行`
          : `Next step in ${formatWaitLabel(waitState.remainingMs)}`
        : null

    const currentStepLabel =
      activeIndex !== null && activeIndex >= 0 && activeIndex < steps.length
        ? `${activeIndex + 1}/${steps.length}`
        : common.na

    const completedCount = stepCards.filter((item) =>
      ['success', 'failure', 'timeout', 'skipped'].includes(item.status),
    ).length

    return {
      stepCards,
      failedStep,
      failureSummary,
      waitCountdownLabel,
      currentStepLabel,
      completedCount,
      statusLabel: getRunStatusLabel(
        language,
        status,
        activeIndex,
        steps.length,
        failureSummary,
      ),
      statusTone: getRunStatusTone(status),
    }
  }, [activeIndex, common.na, defaultWaitSeconds, errorMessage, language, results, status, steps, waitState])

  const failureDetails = (() => {
    if (status !== 'failure' || !derived.failedStep) return null
    const reason =
      derived.failedStep.status === 'timeout'
        ? language === 'zh-CN'
          ? '10 秒内未收到 services_reply。'
          : 'No `services_reply` was received within 10 seconds.'
        : language === 'zh-CN'
          ? `收到非 0 result：${derived.failedStep.result.result ?? common.na}。`
          : `Received non-zero result: ${derived.failedStep.result.result ?? common.na}.`
    return {
      stepNumber: derived.failedStep.index + 1,
      methodLabel: resolveCommandMethodLabel(derived.failedStep.step.method, language),
      method: derived.failedStep.step.method,
      reason,
    }
  })()

  const handleDefaultWaitChange = (value: string) => {
    const parsed = value.trim() === '' ? Number.NaN : Number(value)
    const next = Number.isFinite(parsed) ? Math.max(0, parsed) : parsed
    onDefaultWaitSecondsChange(next)
  }

  const progressPercent =
    steps.length > 0 ? Math.round((derived.completedCount / steps.length) * 100) : 0

  return (
    <section className='panel'>
      <div className='flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between'>
        <SectionHeader
          title={text.title}
          subtitle={text.subtitle}
          language={language}
        />
        <div className='grid w-full gap-2 sm:grid-cols-2 xl:w-auto xl:grid-cols-4'>
          <button
            className='btn w-full'
            onClick={() => setAddOpen(true)}
            disabled={sequenceLocked}
            type='button'
          >
            {text.addStep}
          </button>
          <button
            className='btn btn-primary w-full'
            onClick={() => {
              setAddOpen(false)
              onRun()
            }}
            disabled={!canRun}
            type='button'
          >
            {text.runSequence}
          </button>
          <button
            className='btn btn-danger w-full'
            onClick={onStop}
            disabled={!sequenceLocked}
            type='button'
          >
            {text.stop}
          </button>
          <button
            className='btn w-full'
            onClick={onClear}
            disabled={sequenceLocked}
            type='button'
          >
            {text.clear}
          </button>
        </div>
      </div>

      <div className='mt-5 rounded-xl border border-steel-700/45 bg-coal-900/50 p-4'>
        <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-5'>
          <div className='rounded-lg border border-steel-700/55 bg-coal-900/55 p-3'>
            <p className='label m-0'>{text.totalSteps}</p>
            <p className='mt-2 text-lg text-steel-100'>{steps.length}</p>
          </div>
          <div className='rounded-lg border border-steel-700/55 bg-coal-900/55 p-3'>
            <p className='label m-0'>{text.currentStep}</p>
            <p className='mt-2 text-lg text-steel-100'>{derived.currentStepLabel}</p>
          </div>
          <div className='rounded-lg border border-steel-700/55 bg-coal-900/55 p-3'>
            <p className='label m-0'>{text.progress}</p>
            <p className='mt-2 text-lg text-steel-100'>{progressPercent}%</p>
          </div>
          <div className='rounded-lg border border-steel-700/55 bg-coal-900/55 p-3'>
            <p className='label m-0'>{text.countdown}</p>
            <p className='mt-2 text-sm text-steel-200'>
              {derived.waitCountdownLabel ?? common.noWait}
            </p>
          </div>
          <div className='rounded-lg border border-steel-700/55 bg-coal-900/55 p-3'>
            <p className='label m-0'>{text.stopRequest}</p>
            <p className='mt-2 text-sm text-steel-200'>
              {status === 'running'
                ? stopRequested
                  ? common.requested
                  : common.ready
                : common.na}
            </p>
          </div>
        </div>

        <div className='mt-4 flex flex-wrap items-center gap-2'>
          <span className={`chip ${derived.statusTone}`}>{derived.statusLabel}</span>
          {stopRequested && status === 'running' && (
            <span className='chip border-amber-500/60 bg-amber-500/10 text-amber-400'>
              {text.stopRequested}
            </span>
          )}
          {derived.waitCountdownLabel && (
            <span className='chip border-steel-600/60 bg-coal-900/40 text-steel-300'>
              {derived.waitCountdownLabel}
            </span>
          )}
          <div className='ml-auto flex items-center gap-2'>
            <span className='text-xs text-steel-400'>{text.defaultWaitSeconds}</span>
            <input
              className='input h-8 w-24 text-xs'
              min={0}
              step={0.5}
              type='number'
              value={Number.isFinite(defaultWaitSeconds) ? defaultWaitSeconds : ''}
              onChange={(event) => handleDefaultWaitChange(event.target.value)}
              disabled={sequenceLocked}
            />
          </div>
        </div>
      </div>

      {failureDetails && (
        <div className='mt-5 rounded-xl border border-warn-500/45 bg-warn-500/10 p-4 text-sm'>
          <div className='flex flex-wrap items-center gap-2'>
            <span className='chip border-warn-500/50 bg-warn-500/10 text-warn-500'>
              {text.failureDiagnosis}
            </span>
            <span className='text-steel-200'>
              {text.step} {failureDetails.stepNumber}: {failureDetails.methodLabel}
            </span>
            <span className='font-mono text-xs text-steel-300'>
              {failureDetails.method}
            </span>
          </div>
          <p className='mt-3 text-steel-200'>{failureDetails.reason}</p>
          {errorMessage && (
            <p className='mt-2 text-xs text-warn-500'>
              {text.detail}: {errorMessage}
            </p>
          )}
        </div>
      )}

      <div className='mt-5 space-y-3'>
        {steps.length === 0 ? (
          <div className='rounded-xl border border-dashed border-steel-700/60 bg-coal-900/35 px-4 py-8 text-center'>
            <p className='text-sm text-steel-300'>{text.emptyTitle}</p>
            <p className='mt-1 text-xs text-steel-500'>
              {text.emptyDescription}
            </p>
            <button
              className='btn btn-primary mt-4'
              onClick={() => setAddOpen(true)}
              disabled={sequenceLocked}
              type='button'
            >
              {text.addFirstStep}
            </button>
          </div>
        ) : (
          derived.stepCards.map((item) => {
            const isFailedAndFocused =
              failureDetails && failureDetails.stepNumber === item.index + 1
            const cardTone = getStepCardTone(item.status)
            const summaryEntries = parseStepSummaryEntries(item.step.summary, common.na)
            const isExpanded = expandedStepId === item.step.id

            return (
              <div
                key={item.step.id}
                className={`rounded-xl border px-4 py-3 text-sm shadow-panel transition ${cardTone} ${
                  item.isActive ? 'ring-1 ring-signal-500/60' : ''
                } ${isFailedAndFocused ? 'ring-1 ring-warn-500/70' : ''}`}
              >
                <div className='flex flex-wrap items-start gap-3'>
                  <div className='flex flex-wrap items-center gap-2'>
                    <span className='chip border-steel-600/70 bg-transparent text-[11px] text-steel-300'>
                      {text.step} {item.index + 1}
                    </span>
                    <span className='text-steel-100'>
                      {resolveCommandMethodLabel(item.step.method, language)}
                    </span>
                    <span className='text-xs text-steel-400'>{item.step.method}</span>
                    <span className={`chip ${getStepTone(item.status)}`}>
                      {item.status === 'pending' && (
                        <InlineSpinner className='h-3 w-3' />
                      )}
                      {item.isWaiting && item.status === 'success'
                        ? common.waiting
                        : getStepLabel(item.status, language)}
                    </span>
                    {item.isActive && (
                      <span className='chip border-signal-500/60 bg-signal-500/10 text-signal-400'>
                        {common.active}
                      </span>
                    )}
                  </div>

                  <div className='ml-auto grid w-full gap-2 sm:w-auto sm:grid-cols-4'>
                    <button
                      className='btn h-8 px-3 text-xs'
                      onClick={() =>
                        setExpandedStepId((prev) =>
                          prev === item.step.id ? null : item.step.id,
                        )
                      }
                      type='button'
                      aria-expanded={isExpanded}
                      aria-controls={`sequence-step-details-${item.step.id}`}
                    >
                      {isExpanded ? text.collapseDetails : text.expandDetails}
                    </button>
                    <button
                      className='btn h-8 px-3 text-xs'
                      onClick={() => onMoveStep(item.index, 'up')}
                      disabled={sequenceLocked || item.index === 0}
                      type='button'
                    >
                      {text.up}
                    </button>
                    <button
                      className='btn h-8 px-3 text-xs'
                      onClick={() => onMoveStep(item.index, 'down')}
                      disabled={sequenceLocked || item.index === steps.length - 1}
                      type='button'
                    >
                      {text.down}
                    </button>
                    <button
                      className='btn btn-danger h-8 px-3 text-xs'
                      onClick={() => onRemoveStep(item.index)}
                      disabled={sequenceLocked}
                      type='button'
                    >
                      {text.remove}
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div
                    id={`sequence-step-details-${item.step.id}`}
                    className='mt-3 space-y-2 text-xs text-steel-300'
                  >
                    <div className='rounded-lg border border-steel-700/65 bg-coal-900/35 p-3'>
                      <p className='text-[10px] uppercase tracking-[0.18em] text-steel-500'>
                        {text.commandDetail}
                      </p>
                      {summaryEntries.length > 0 ? (
                        <div className='mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-4'>
                          {summaryEntries.map((entry) => (
                            <div
                              key={`${item.step.id}-${entry.key}-${entry.value}`}
                              className='min-w-0 rounded-md border border-steel-700/55 bg-coal-950/35 px-2 py-1.5'
                            >
                              <p className='text-[10px] uppercase tracking-[0.14em] text-steel-500'>
                                {entry.key}
                              </p>
                              <p
                                className={`mt-1 break-all leading-5 text-steel-200 ${
                                  entry.mono ? 'font-mono text-[11px]' : 'text-xs'
                                }`}
                                title={entry.value}
                              >
                                {entry.value}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className='mt-2 text-xs text-steel-400'>{common.na}</p>
                      )}
                    </div>

                    <div className='grid gap-2 sm:grid-cols-2 xl:grid-cols-3'>
                      <div className='rounded-lg border border-steel-700/70 px-3 py-2'>
                        <p className='text-[10px] uppercase tracking-[0.14em] text-steel-500'>
                          {text.wait}
                        </p>
                        <p className='mt-1 text-xs text-steel-200'>
                          {formatWaitLabel(item.effectiveWaitMs)}
                          {item.usesDefaultWait ? ` ${text.defaultWaitSuffix}` : ''}
                        </p>
                      </div>
                      <div className='rounded-lg border border-steel-700/70 px-3 py-2'>
                        <p className='text-[10px] uppercase tracking-[0.14em] text-steel-500'>
                          {text.result}
                        </p>
                        <p className='mt-1 text-xs text-steel-300'>
                          {item.result.result ?? common.na}
                        </p>
                      </div>
                      <div className='rounded-lg border border-steel-700/70 px-3 py-2'>
                        <p className='text-[10px] uppercase tracking-[0.14em] text-steel-500'>
                          {text.tid}
                        </p>
                        <p className='mt-1 font-mono text-[11px] text-steel-400'>
                          {item.result.tid
                            ? formatShortTid(item.result.tid)
                            : common.na}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {addModalOpen && (
        <CommandSequenceAddModal
          language={language}
          locked={sequenceLocked}
          defaults={defaults}
          onDefaultsChange={onDefaultsChange}
          onAddStep={onAddStep}
          onClose={() => setAddOpen(false)}
        />
      )}
    </section>
  )
}
