import { type ChangeEvent, useEffect, useMemo, useState } from 'react'
import { SectionHeader } from './ui'
import {
  buildWidgetActions,
  type NormalizedWidgetConfig,
  normalizeScaleValue,
  parseWidgetConfigJson,
} from '../../lib/widgetConfig'

type WidgetSourceType = 't40s' | 'custom'

interface WidgetValueExampleModalProps {
  open: boolean
  onClose: () => void
  onPick: (pick: WidgetExamplePick) => void
}

export interface WidgetExamplePick {
  index: number
  value: number
  description: string
}

const BUILTIN_T40S_URL = '/widget-configs/t40s_widget_config.json'
const DEFAULT_SCALE_VALUE = 50

const getFileReaderError = (error: DOMException | null) =>
  error?.message || 'Failed to read file'

const getWidgetTypeBadgeTone = (widgetType: string) => {
  if (widgetType === 'button') return 'border-signal-500/60 text-signal-400'
  if (widgetType === 'switch') return 'border-amber-500/60 text-amber-400'
  if (widgetType === 'list') return 'border-steel-400/60 text-steel-300'
  return 'border-sky-500/60 text-sky-300'
}

export const WidgetValueExampleModal = ({
  open,
  onClose,
  onPick,
}: WidgetValueExampleModalProps) => {
  const [sourceType, setSourceType] = useState<WidgetSourceType>('t40s')
  const [builtinConfig, setBuiltinConfig] =
    useState<NormalizedWidgetConfig | null>(null)
  const [customConfig, setCustomConfig] =
    useState<NormalizedWidgetConfig | null>(null)
  const [customFileName, setCustomFileName] = useState('')
  const [loadingBuiltin, setLoadingBuiltin] = useState(false)
  const [builtinError, setBuiltinError] = useState<string | null>(null)
  const [customError, setCustomError] = useState<string | null>(null)
  const [scaleValues, setScaleValues] = useState<Record<number, number>>({})

  useEffect(() => {
    if (!open || sourceType !== 't40s' || builtinConfig) {
      return
    }

    let cancelled = false

    const loadBuiltinConfig = async () => {
      setLoadingBuiltin(true)
      setBuiltinError(null)

      try {
        const response = await fetch(BUILTIN_T40S_URL)
        if (!response.ok) {
          throw new Error(`Failed to load t40s config (HTTP ${response.status})`)
        }

        const jsonText = await response.text()
        const parsedResult = parseWidgetConfigJson(jsonText)

        if (!parsedResult.ok) {
          throw new Error(parsedResult.error)
        }

        if (!cancelled) {
          setBuiltinConfig(parsedResult.config)
        }
      } catch (error) {
        if (!cancelled) {
          setBuiltinError(
            error instanceof Error ? error.message : 'Failed to load t40s config',
          )
        }
      } finally {
        if (!cancelled) {
          setLoadingBuiltin(false)
        }
      }
    }

    void loadBuiltinConfig()

    return () => {
      cancelled = true
    }
  }, [builtinConfig, open, sourceType])

  useEffect(() => {
    if (!open) {
      return
    }

    setBuiltinError(null)
    setCustomError(null)
  }, [open])

  const activeConfig = useMemo(() => {
    if (sourceType === 't40s') {
      return builtinConfig
    }

    return customConfig
  }, [builtinConfig, customConfig, sourceType])

  const handleCustomFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0]
    if (!selectedFile) {
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      const fileText = typeof reader.result === 'string' ? reader.result : ''
      const parseResult = parseWidgetConfigJson(fileText)

      if (!parseResult.ok) {
        setCustomConfig(null)
        setCustomFileName('')
        setCustomError(parseResult.error)
        return
      }

      setCustomError(null)
      setCustomConfig(parseResult.config)
      setCustomFileName(selectedFile.name)
    }

    reader.onerror = () => {
      setCustomConfig(null)
      setCustomFileName('')
      setCustomError(getFileReaderError(reader.error))
    }

    reader.readAsText(selectedFile)
    event.target.value = ''
  }

  const applyWidgetValue = (
    widgetIndex: number,
    widgetValue: number,
    description: string,
  ) => {
    onPick({
      index: widgetIndex,
      value: widgetValue,
      description,
    })
    onClose()
  }

  const updateScaleValue = (widgetIndex: number, rawValue: number) => {
    const safeValue = normalizeScaleValue(rawValue)
    setScaleValues((prev) => ({
      ...prev,
      [widgetIndex]: safeValue,
    }))
  }

  if (!open) {
    return null
  }

  return (
    <div
      className='fixed inset-0 z-50 flex items-center justify-center bg-coal-950/75 px-4 py-6'
      onClick={onClose}
    >
      <div
        className='panel w-full max-w-5xl'
        onClick={(event) => event.stopPropagation()}
      >
        <div className='flex flex-wrap items-start justify-between gap-4'>
          <SectionHeader title='Widget Example Picker' subtitle='PSDK config_interface' />
          <button className='btn btn-danger' onClick={onClose} type='button'>
            Close
          </button>
        </div>

        <div className='mt-5 grid gap-4'>
          <div className='rounded-xl border border-steel-700/40 bg-coal-900/60 p-4'>
            <p className='label'>Device Type</p>
            <div className='mt-3 flex flex-wrap gap-2'>
              <button
                className={`btn ${sourceType === 't40s' ? 'btn-primary' : ''}`}
                onClick={() => setSourceType('t40s')}
                type='button'
              >
                t40s
              </button>
              <button
                className={`btn ${sourceType === 'custom' ? 'btn-primary' : ''}`}
                onClick={() => setSourceType('custom')}
                type='button'
              >
                custom
              </button>
            </div>

            {sourceType === 'custom' && (
              <div className='mt-4 space-y-3'>
                <div className='flex flex-wrap items-center gap-3'>
                  <input
                    accept='.json,application/json'
                    className='input max-w-md'
                    onChange={handleCustomFileChange}
                    type='file'
                  />
                  {customFileName && <span className='chip'>{customFileName}</span>}
                </div>
                <p className='text-xs text-steel-400'>
                  Only JSON files with config_interface.widget_list are supported.
                </p>
                {customError && (
                  <p className='rounded-lg border border-warn-500/40 bg-warn-500/10 px-3 py-2 text-xs text-warn-500'>
                    {customError}
                  </p>
                )}
              </div>
            )}

            {sourceType === 't40s' && loadingBuiltin && (
              <p className='mt-3 text-xs text-steel-400'>Loading t40s config...</p>
            )}
            {sourceType === 't40s' && builtinError && (
              <p className='mt-3 rounded-lg border border-warn-500/40 bg-warn-500/10 px-3 py-2 text-xs text-warn-500'>
                {builtinError}
              </p>
            )}
          </div>

          <div className='rounded-xl border border-steel-700/40 bg-coal-900/60 p-4'>
            <div className='flex items-center justify-between gap-3'>
              <p className='label'>Widget Actions</p>
              <span className='text-xs text-steel-400'>
                Source: {sourceType === 't40s' ? 't40s' : customFileName || 'custom'}
              </span>
            </div>

            {!activeConfig ? (
              <div className='mt-4 rounded-lg border border-dashed border-steel-700/60 bg-coal-900/30 px-4 py-6 text-sm text-steel-400'>
                {sourceType === 'custom'
                  ? 'Please upload a valid widget_config.json first.'
                  : 'Waiting for t40s config to load...'}
              </div>
            ) : activeConfig.widgets.length === 0 ? (
              <div className='mt-4 rounded-lg border border-dashed border-steel-700/60 bg-coal-900/30 px-4 py-6 text-sm text-steel-400'>
                No widgets available in current configuration.
              </div>
            ) : (
              <div className='mt-4 max-h-[52vh] space-y-3 overflow-auto pr-1'>
                {activeConfig.widgets.map((widget) => {
                  const actions = buildWidgetActions(widget)
                  const currentScaleValue =
                    scaleValues[widget.widgetIndex] ?? DEFAULT_SCALE_VALUE

                  return (
                    <div
                      className='rounded-xl border border-steel-700/45 bg-coal-900/55 p-3'
                      key={`${widget.widgetIndex}-${widget.widgetType}`}
                    >
                      <div className='flex flex-wrap items-center gap-2'>
                        <span className='text-sm text-steel-100'>{widget.widgetName}</span>
                        <span className='chip border-steel-600/70 bg-transparent text-[11px] text-steel-300'>
                          index {widget.widgetIndex}
                        </span>
                        <span
                          className={`chip bg-transparent text-[11px] uppercase ${getWidgetTypeBadgeTone(
                            widget.widgetType,
                          )}`}
                        >
                          {widget.widgetType}
                        </span>
                      </div>

                      {widget.widgetType === 'scale' ? (
                        <div className='mt-3 grid gap-3'>
                          <div className='flex flex-wrap items-center gap-3'>
                            <label className='label m-0'>Scale Value</label>
                            <input
                              className='input w-24'
                              max={100}
                              min={0}
                              onChange={(event) =>
                                updateScaleValue(
                                  widget.widgetIndex,
                                  Number(event.target.value),
                                )
                              }
                              step={1}
                              type='number'
                              value={currentScaleValue}
                            />
                            <button
                              className='btn btn-primary h-9 px-3'
                              onClick={() =>
                                applyWidgetValue(
                                  widget.widgetIndex,
                                  currentScaleValue,
                                  `${widget.widgetName}: ${currentScaleValue}`,
                                )
                              }
                              type='button'
                            >
                              Apply
                            </button>
                          </div>
                          <input
                            className='accent-signal-500'
                            max={100}
                            min={0}
                            onChange={(event) =>
                              updateScaleValue(
                                widget.widgetIndex,
                                Number(event.target.value),
                              )
                            }
                            step={1}
                            type='range'
                            value={currentScaleValue}
                          />
                        </div>
                      ) : actions.length === 0 ? (
                        <p className='mt-3 text-xs text-steel-400'>No actions available.</p>
                      ) : (
                        <div className='mt-3 flex flex-wrap gap-2'>
                          {actions.map((action) => (
                            <button
                              className='btn h-9 px-3'
                              key={`${widget.widgetIndex}-${action.value}-${action.label}`}
                              onClick={() =>
                                applyWidgetValue(
                                  widget.widgetIndex,
                                  action.value,
                                  `${widget.widgetName}: ${action.label}`,
                                )
                              }
                              type='button'
                            >
                              {action.label}
                              <span className='chip ml-1 border-steel-600/70 bg-transparent text-[11px] text-steel-400'>
                                value {action.value}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
