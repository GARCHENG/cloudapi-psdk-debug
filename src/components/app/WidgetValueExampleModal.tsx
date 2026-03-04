import { type ChangeEvent, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { SectionHeader } from './ui'
import {
  buildWidgetActions,
  type NormalizedWidgetConfig,
  normalizeScaleValue,
  parseWidgetConfigJson,
} from '../../lib/widgetConfig'
import { resolvePublicAssetUrl } from '../../lib/publicAsset'

type WidgetSourceType = 'custom' | string

interface WidgetConfigRegistry {
  devices: WidgetConfigRegistryEntry[]
  generatedAt?: string
}

interface WidgetConfigRegistryEntry {
  deviceType: string
  fileName: string
  url: string
}

interface WidgetValueExampleModalProps {
  open: boolean
  onClose: () => void
  onPick: (pick: WidgetExamplePick) => void
}

export interface WidgetExamplePick {
  index: number
  value: number
  deviceType: string
  description: string
}

const REGISTRY_URL = resolvePublicAssetUrl('/widget-configs/registry.json')
const CUSTOM_SOURCE_TYPE = 'custom'
const DEFAULT_SCALE_VALUE = 50

const getFileReaderError = (error: DOMException | null) =>
  error?.message || 'Failed to read file'

const getWidgetTypeBadgeTone = (widgetType: string) => {
  if (widgetType === 'button') return 'border-signal-500/60 text-signal-400'
  if (widgetType === 'switch') return 'border-amber-500/60 text-amber-400'
  if (widgetType === 'list') return 'border-steel-400/60 text-steel-300'
  return 'border-sky-500/60 text-sky-300'
}

const buildFallbackRegistry = (): WidgetConfigRegistry => ({
  devices: [
    {
      deviceType: 't40s',
      fileName: 't40s_widget_config.json',
      url: resolvePublicAssetUrl('/widget-configs/t40s_widget_config.json'),
    },
  ],
})

const ensureUniqueDevices = (
  entries: WidgetConfigRegistryEntry[],
): WidgetConfigRegistryEntry[] => {
  const mappedEntries = new Map<string, WidgetConfigRegistryEntry>()

  for (const entry of entries) {
    if (!entry.deviceType || !entry.url) {
      continue
    }

    mappedEntries.set(entry.deviceType, entry)
  }

  return [...mappedEntries.values()].sort((left, right) =>
    left.deviceType.localeCompare(right.deviceType),
  )
}

const parseRegistry = (payload: unknown): WidgetConfigRegistry => {
  if (!payload || typeof payload !== 'object') {
    return buildFallbackRegistry()
  }

  const maybeRegistry = payload as {
    devices?: unknown
    generatedAt?: unknown
  }

  if (!Array.isArray(maybeRegistry.devices)) {
    return buildFallbackRegistry()
  }

  const parsedEntries = maybeRegistry.devices
    .map((entry): WidgetConfigRegistryEntry | null => {
      if (!entry || typeof entry !== 'object') {
        return null
      }

      const mappedEntry = entry as {
        deviceType?: unknown
        fileName?: unknown
        url?: unknown
      }

      if (
        typeof mappedEntry.deviceType !== 'string' ||
        typeof mappedEntry.fileName !== 'string' ||
        typeof mappedEntry.url !== 'string'
      ) {
        return null
      }

      return {
        deviceType: mappedEntry.deviceType,
        fileName: mappedEntry.fileName,
        url: resolvePublicAssetUrl(mappedEntry.url),
      }
    })
    .filter((entry): entry is WidgetConfigRegistryEntry => entry !== null)

  const devices = ensureUniqueDevices(parsedEntries)
  if (devices.length === 0) {
    return buildFallbackRegistry()
  }

  return {
    devices,
    generatedAt:
      typeof maybeRegistry.generatedAt === 'string'
        ? maybeRegistry.generatedAt
        : undefined,
  }
}

export const WidgetValueExampleModal = ({
  open,
  onClose,
  onPick,
}: WidgetValueExampleModalProps) => {
  const [registry, setRegistry] = useState<WidgetConfigRegistry>(buildFallbackRegistry)
  const [registryLoading, setRegistryLoading] = useState(false)
  const [registryError, setRegistryError] = useState<string | null>(null)
  const [sourceType, setSourceType] = useState<WidgetSourceType>('')
  const [builtinConfigs, setBuiltinConfigs] = useState<
    Record<string, NormalizedWidgetConfig>
  >({})
  const [loadingBuiltinType, setLoadingBuiltinType] = useState<string | null>(null)
  const [builtinError, setBuiltinError] = useState<string | null>(null)
  const [customConfig, setCustomConfig] =
    useState<NormalizedWidgetConfig | null>(null)
  const [customFileName, setCustomFileName] = useState('')
  const [customError, setCustomError] = useState<string | null>(null)
  const [scaleValues, setScaleValues] = useState<Record<number, number>>({})
  const [expandedWidgetIndex, setExpandedWidgetIndex] = useState<number | null>(
    null,
  )

  useEffect(() => {
    if (!open) {
      return
    }

    let cancelled = false

    const loadRegistry = async () => {
      setRegistryLoading(true)
      setRegistryError(null)

      try {
        const response = await fetch(REGISTRY_URL)
        if (!response.ok) {
          throw new Error(`Failed to load widget registry (HTTP ${response.status})`)
        }

        const payload = (await response.json()) as unknown
        const nextRegistry = parseRegistry(payload)

        if (!cancelled) {
          setRegistry(nextRegistry)
          setSourceType((prev) => {
            const hasPrevBuiltin = nextRegistry.devices.some(
              (entry) => entry.deviceType === prev,
            )
            if (prev === CUSTOM_SOURCE_TYPE || hasPrevBuiltin) {
              return prev
            }

            return ''
          })
        }
      } catch (error) {
        if (!cancelled) {
          setRegistry(buildFallbackRegistry())
          setRegistryError(
            error instanceof Error ? error.message : 'Failed to load widget registry',
          )
        }
      } finally {
        if (!cancelled) {
          setRegistryLoading(false)
        }
      }
    }

    void loadRegistry()

    return () => {
      cancelled = true
    }
  }, [open])

  useEffect(() => {
    if (!open) {
      return
    }

    setBuiltinError(null)
    setCustomError(null)
  }, [open])

  const activeBuiltinEntry = useMemo(
    () => registry.devices.find((entry) => entry.deviceType === sourceType) ?? null,
    [registry.devices, sourceType],
  )

  useEffect(() => {
    if (!open || sourceType === CUSTOM_SOURCE_TYPE || !activeBuiltinEntry) {
      return
    }

    const cachedConfig = builtinConfigs[sourceType]
    if (cachedConfig) {
      return
    }

    let cancelled = false

    const loadBuiltinConfig = async () => {
      setLoadingBuiltinType(sourceType)
      setBuiltinError(null)

      try {
        const response = await fetch(activeBuiltinEntry.url)
        if (!response.ok) {
          throw new Error(
            `Failed to load ${sourceType} config (HTTP ${response.status})`,
          )
        }

        const jsonText = await response.text()
        const parsedResult = parseWidgetConfigJson(jsonText)

        if (!parsedResult.ok) {
          throw new Error(parsedResult.error)
        }

        if (!cancelled) {
          setBuiltinConfigs((prev) => ({
            ...prev,
            [sourceType]: parsedResult.config,
          }))
        }
      } catch (error) {
        if (!cancelled) {
          setBuiltinError(
            error instanceof Error
              ? error.message
              : `Failed to load ${sourceType} config`,
          )
        }
      } finally {
        if (!cancelled) {
          setLoadingBuiltinType(null)
        }
      }
    }

    void loadBuiltinConfig()

    return () => {
      cancelled = true
    }
  }, [activeBuiltinEntry, builtinConfigs, open, sourceType])

  const activeConfig = useMemo(() => {
    if (sourceType === CUSTOM_SOURCE_TYPE) {
      return customConfig
    }

    return builtinConfigs[sourceType] ?? null
  }, [builtinConfigs, customConfig, sourceType])

  useEffect(() => {
    setExpandedWidgetIndex(null)
  }, [open, sourceType])

  useEffect(() => {
    if (expandedWidgetIndex === null || !activeConfig) {
      return
    }

    const hasExpandedWidget = activeConfig.widgets.some(
      (widget) => widget.widgetIndex === expandedWidgetIndex,
    )

    if (!hasExpandedWidget) {
      setExpandedWidgetIndex(null)
    }
  }, [activeConfig, expandedWidgetIndex])

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
    const pickedDeviceType =
      sourceType === CUSTOM_SOURCE_TYPE
        ? CUSTOM_SOURCE_TYPE
        : sourceType

    onPick({
      index: widgetIndex,
      value: widgetValue,
      deviceType: pickedDeviceType,
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

  const isCustomSource = sourceType === CUSTOM_SOURCE_TYPE
  const hasSelectedSource = sourceType.trim().length > 0
  const isBuiltinLoading =
    !isCustomSource && loadingBuiltinType !== null && loadingBuiltinType === sourceType

  return createPortal(
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
              {registry.devices.map((entry) => (
                <button
                  className={`btn ${sourceType === entry.deviceType ? 'btn-primary' : ''}`}
                  key={entry.deviceType}
                  onClick={() => setSourceType(entry.deviceType)}
                  type='button'
                >
                  {entry.deviceType}
                </button>
              ))}
              <button
                className={`btn ${isCustomSource ? 'btn-primary' : ''}`}
                onClick={() => setSourceType(CUSTOM_SOURCE_TYPE)}
                type='button'
              >
                custom
              </button>
            </div>

            {isCustomSource && (
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

            {registryLoading && (
              <p className='mt-3 text-xs text-steel-400'>Loading widget config registry...</p>
            )}
            {registryError && (
              <p className='mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-400'>
                {registryError}
              </p>
            )}

            {!isCustomSource && isBuiltinLoading && (
              <p className='mt-3 text-xs text-steel-400'>
                Loading {sourceType} config...
              </p>
            )}
            {!isCustomSource && builtinError && (
              <p className='mt-3 rounded-lg border border-warn-500/40 bg-warn-500/10 px-3 py-2 text-xs text-warn-500'>
                {builtinError}
              </p>
            )}
          </div>

          <div className='rounded-xl border border-steel-700/40 bg-coal-900/60 p-4'>
            <div className='flex items-center justify-between gap-3'>
              <p className='label'>Widget Actions</p>
              <span className='text-xs text-steel-400'>
                Source: {isCustomSource ? customFileName || 'custom' : sourceType || 'N/A'}
              </span>
            </div>

            {!hasSelectedSource ? (
              <div className='mt-4 rounded-lg border border-dashed border-steel-700/60 bg-coal-900/30 px-4 py-6 text-sm text-steel-400'>
                No device type selected. Please choose one to view widget actions.
              </div>
            ) : !activeConfig ? (
              <div className='mt-4 rounded-lg border border-dashed border-steel-700/60 bg-coal-900/30 px-4 py-6 text-sm text-steel-400'>
                {isCustomSource
                  ? 'Please upload a valid widget_config.json first.'
                  : `Waiting for ${sourceType} config to load...`}
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
                  const isExpanded = expandedWidgetIndex === widget.widgetIndex

                  return (
                    <div
                      className='rounded-xl border border-steel-700/45 bg-coal-900/55 p-3'
                      key={`${widget.widgetIndex}-${widget.widgetType}`}
                    >
                      <button
                        className={`w-full text-left transition ${
                          isExpanded ? 'opacity-100' : 'opacity-90 hover:opacity-100'
                        }`}
                        onClick={() =>
                          setExpandedWidgetIndex(isExpanded ? null : widget.widgetIndex)
                        }
                        type='button'
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
                          <span className='ml-auto text-xs text-steel-400'>
                            {isExpanded ? 'Collapse' : 'Expand'}
                          </span>
                        </div>
                      </button>

                      {isExpanded && (
                        <>
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
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
