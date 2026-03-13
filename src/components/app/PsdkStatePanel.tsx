import { type ChangeEvent, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { SectionHeader } from './ui'
import { getText } from '../../lib/i18n'
import {
  getPlayModeLabel,
  getSystemStateLabel,
  getWorkModeLabel,
} from '../../lib/psdk'
import { formatTimestamp } from './view-helpers'
import {
  type NormalizedWidgetConfig,
  type NormalizedWidgetEntry,
  parseWidgetConfigJson,
} from '../../lib/widgetConfig'
import { resolvePublicAssetUrl } from '../../lib/publicAsset'
import type { PsdkStateEntry } from '../../types/psdk'
import type { AppLanguage } from '../../types/app'

interface PsdkStatePanelProps {
  language: AppLanguage
  activeEntry?: PsdkStateEntry
  linkedSourceType?: string
  stateReceivedAt?: number | null
}

type WidgetSourceType = string

interface WidgetConfigRegistry {
  devices: WidgetConfigRegistryEntry[]
  generatedAt?: string
}

interface WidgetConfigRegistryEntry {
  deviceType: string
  fileName: string
  url: string
}

const REGISTRY_URL = resolvePublicAssetUrl('/widget-configs/registry.json')
const CUSTOM_SOURCE_TYPE = 'custom'

const getFileReaderError = (
  error: DOMException | null,
  language: AppLanguage,
) => error?.message || (language === 'zh-CN' ? '读取文件失败' : 'Failed to read file')

const getWidgetTypeBadgeTone = (widgetType: string) => {
  if (widgetType === 'button') return 'border-signal-500/60 text-signal-400'
  if (widgetType === 'switch') return 'border-amber-500/60 text-amber-400'
  if (widgetType === 'list') return 'border-steel-400/60 text-steel-300'
  return 'border-sky-500/60 text-sky-300'
}

const getWidgetStateLabel = (
  widget: NormalizedWidgetEntry | undefined,
  rawValue: number,
  language: AppLanguage,
) => {
  if (!widget) {
    return language === 'zh-CN'
      ? `未映射数值 (${rawValue})`
      : `Unmapped value (${rawValue})`
  }

  if (widget.widgetType === 'button') {
    if (rawValue === 1) return language === 'zh-CN' ? '已触发' : 'Triggered'
    if (rawValue === 0) return language === 'zh-CN' ? '空闲' : 'Idle'
    return language === 'zh-CN' ? `按钮值 ${rawValue}` : `Button value ${rawValue}`
  }

  if (widget.widgetType === 'switch') {
    if (rawValue === 1) return language === 'zh-CN' ? '开启' : 'On'
    if (rawValue === 0) return language === 'zh-CN' ? '关闭' : 'Off'
    return language === 'zh-CN'
      ? `未知开关状态 (${rawValue})`
      : `Unknown switch state (${rawValue})`
  }

  if (widget.widgetType === 'list') {
    const optionLabel = widget.listItems[rawValue]
    if (optionLabel) {
      return `${optionLabel} (${rawValue})`
    }
    return language === 'zh-CN'
      ? `未知选项 (${rawValue})`
      : `Unknown option (${rawValue})`
  }

  return language === 'zh-CN' ? `刻度 ${rawValue}` : `Scale ${rawValue}`
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

export const PsdkStatePanel = ({
  language,
  activeEntry,
  linkedSourceType = '',
  stateReceivedAt = null,
}: PsdkStatePanelProps) => {
  const text = getText(language).psdkState
  const common = getText(language).common
  const [widgetStateOpen, setWidgetStateOpen] = useState(false)

  const [registry, setRegistry] = useState<WidgetConfigRegistry>(buildFallbackRegistry)
  const [registryLoading, setRegistryLoading] = useState(false)
  const [registryError, setRegistryError] = useState<string | null>(null)
  const [sourceType, setSourceType] = useState<WidgetSourceType>('')
  const [builtinConfigs, setBuiltinConfigs] = useState<
    Record<string, NormalizedWidgetConfig>
  >({})
  const [loadingBuiltinType, setLoadingBuiltinType] = useState<string | null>(null)
  const [builtinError, setBuiltinError] = useState<string | null>(null)
  const [customConfig, setCustomConfig] = useState<NormalizedWidgetConfig | null>(
    null,
  )
  const [customFileName, setCustomFileName] = useState('')
  const [customError, setCustomError] = useState<string | null>(null)

  const widgetValues = useMemo(
    () => [...(activeEntry?.values ?? [])].sort((left, right) => left.index - right.index),
    [activeEntry],
  )

  useEffect(() => {
    if (!widgetStateOpen) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setWidgetStateOpen(false)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [widgetStateOpen])

  useEffect(() => {
    if (!widgetStateOpen) {
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

          setSourceType((previous) => {
            if (linkedSourceType === CUSTOM_SOURCE_TYPE) {
              return CUSTOM_SOURCE_TYPE
            }

            if (
              linkedSourceType &&
              nextRegistry.devices.some(
                (entry) => entry.deviceType === linkedSourceType,
              )
            ) {
              return linkedSourceType
            }

            const hasPreviousBuiltin = nextRegistry.devices.some(
              (entry) => entry.deviceType === previous,
            )
            if (previous === CUSTOM_SOURCE_TYPE || hasPreviousBuiltin) {
              return previous
            }

            return ''
          })
        }
      } catch (error) {
        if (!cancelled) {
          setRegistry(buildFallbackRegistry())
          setRegistryError(
            error instanceof Error
              ? error.message
              : language === 'zh-CN'
                ? '加载 widget 配置索引失败'
                : 'Failed to load widget registry',
          )

          setSourceType((previous) => {
            if (linkedSourceType === CUSTOM_SOURCE_TYPE) {
              return CUSTOM_SOURCE_TYPE
            }

            if (linkedSourceType.trim().length > 0) {
              return linkedSourceType
            }

            return previous
          })
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
  }, [language, linkedSourceType, widgetStateOpen])

  useEffect(() => {
    if (!widgetStateOpen || !linkedSourceType) {
      return
    }

    if (linkedSourceType === CUSTOM_SOURCE_TYPE) {
      setSourceType(CUSTOM_SOURCE_TYPE)
      return
    }

    const hasLinkedBuiltin = registry.devices.some(
      (entry) => entry.deviceType === linkedSourceType,
    )
    if (hasLinkedBuiltin) {
      setSourceType(linkedSourceType)
    }
  }, [widgetStateOpen, linkedSourceType, registry.devices])

  const activeBuiltinEntry = useMemo(
    () => registry.devices.find((entry) => entry.deviceType === sourceType) ?? null,
    [registry.devices, sourceType],
  )

  useEffect(() => {
    if (!widgetStateOpen || sourceType === CUSTOM_SOURCE_TYPE || !activeBuiltinEntry) {
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
          setBuiltinConfigs((previous) => ({
            ...previous,
            [sourceType]: parsedResult.config,
          }))
        }
      } catch (error) {
        if (!cancelled) {
          setBuiltinError(
            error instanceof Error
              ? error.message
              : language === 'zh-CN'
                ? `加载 ${sourceType} 配置失败`
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
  }, [activeBuiltinEntry, builtinConfigs, language, sourceType, widgetStateOpen])

  const activeConfig = useMemo(() => {
    if (sourceType === CUSTOM_SOURCE_TYPE) {
      return customConfig
    }

    return builtinConfigs[sourceType] ?? null
  }, [builtinConfigs, customConfig, sourceType])

  const widgetMapByIndex = useMemo(() => {
    const mappedWidgets = new Map<number, NormalizedWidgetEntry>()

    activeConfig?.widgets.forEach((widget) => {
      mappedWidgets.set(widget.widgetIndex, widget)
    })

    return mappedWidgets
  }, [activeConfig])

  const missingConfigWidgets = useMemo(() => {
    if (!activeConfig) {
      return []
    }

    const valueIndexes = new Set(widgetValues.map((item) => item.index))
    return activeConfig.widgets
      .filter((widget) => !valueIndexes.has(widget.widgetIndex))
      .sort((left, right) => left.widgetIndex - right.widgetIndex)
  }, [activeConfig, widgetValues])

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
      setCustomError(getFileReaderError(reader.error, language))
    }

    reader.readAsText(selectedFile)
    event.target.value = ''
  }

  const isCustomSource = sourceType === CUSTOM_SOURCE_TYPE
  const isBuiltinLoading =
    !isCustomSource && loadingBuiltinType !== null && loadingBuiltinType === sourceType

  return (
    <>
      <section className='panel'>
        <div className='flex flex-wrap items-start justify-between gap-4'>
          <SectionHeader
            title={text.title}
            subtitle={text.subtitle}
            language={language}
          />
          <button
            className='btn disabled:cursor-not-allowed disabled:opacity-50'
            onClick={() => setWidgetStateOpen(true)}
            disabled={!activeEntry}
          >
            {text.widgetState}
          </button>
        </div>

        <div className='mt-6 space-y-4 text-sm'>
          {activeEntry ? (
            <>
              <div className='rounded-xl border border-steel-700/40 bg-coal-900/60 p-4'>
                <div className='flex items-center justify-between'>
                  <span className='text-xs uppercase tracking-[0.2em] text-steel-400'>
                    {text.activePayload}
                  </span>
                  <span className='chip'>{text.indexLabel(activeEntry.psdk_index)}</span>
                </div>
                <div className='mt-3 grid gap-2 text-xs text-steel-300'>
                  <span>{text.name}: {activeEntry.psdk_name ?? common.na}</span>
                  <span>{text.sn}: {activeEntry.psdk_sn ?? common.na}</span>
                  <span>{text.version}: {activeEntry.psdk_version ?? common.na}</span>
                  <span>{text.lib}: {activeEntry.psdk_lib_version ?? common.na}</span>
                  <span>{text.lastState}: {formatTimestamp(stateReceivedAt, language)}</span>
                </div>
              </div>
              <div className='rounded-xl border border-steel-700/40 bg-coal-900/60 p-4'>
                <p className='text-xs uppercase tracking-[0.2em] text-steel-400'>
                  {text.speakerState}
                </p>
                <div className='mt-3 grid gap-2 text-xs text-steel-300'>
                  <span>
                    {text.mode}: {getWorkModeLabel(activeEntry.speaker?.work_mode, language)}
                  </span>
                  <span>
                    {text.playMode}: {getPlayModeLabel(activeEntry.speaker?.play_mode, language)}
                  </span>
                  <span>
                    {text.system}: {getSystemStateLabel(activeEntry.speaker?.system_state, language)}
                  </span>
                  <span>{text.volume}: {activeEntry.speaker?.play_volume ?? common.na}</span>
                  <span>{text.file}: {activeEntry.speaker?.play_file_name ?? common.na}</span>
                </div>
              </div>
            </>
          ) : (
            <div className='rounded-xl border border-dashed border-steel-700/40 bg-coal-900/40 p-4 text-sm text-steel-400'>
              {text.noStatePayload}
            </div>
          )}
        </div>
      </section>

      {widgetStateOpen &&
        createPortal(
          <div
            className='fixed inset-0 z-50 flex items-center justify-center bg-coal-950/75 px-4 py-6'
            onClick={() => setWidgetStateOpen(false)}
          >
            <div
              className='panel w-full max-w-6xl'
              onClick={(event) => event.stopPropagation()}
            >
              <div className='flex flex-wrap items-start justify-between gap-4'>
                <SectionHeader
                  title={text.widgetModalTitle}
                  subtitle={text.widgetModalSubtitle}
                  language={language}
                />
                <button
                  className='btn btn-danger'
                  onClick={() => setWidgetStateOpen(false)}
                  type='button'
                >
                  {common.close}
                </button>
              </div>

              <div className='mt-5 rounded-xl border border-steel-700/40 bg-coal-900/60 p-4'>
                <div className='flex flex-wrap items-center gap-2'>
                  <p className='label m-0'>{text.deviceType}</p>
                  {linkedSourceType && (
                    <span className='chip border-signal-500/45 bg-signal-500/10 text-[11px] text-signal-400'>
                      {text.linked}: {linkedSourceType}
                    </span>
                  )}
                </div>
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
                    {common.custom}
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
                      {text.onlyJsonTip}
                    </p>
                    {customError && (
                      <p className='rounded-lg border border-warn-500/40 bg-warn-500/10 px-3 py-2 text-xs text-warn-500'>
                        {customError}
                      </p>
                    )}
                  </div>
                )}

                {registryLoading && (
                  <p className='mt-3 text-xs text-steel-400'>
                    {text.loadingRegistry}
                  </p>
                )}
                {registryError && (
                  <p className='mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-400'>
                    {registryError}
                  </p>
                )}
                {!isCustomSource && isBuiltinLoading && (
                  <p className='mt-3 text-xs text-steel-400'>
                    {text.loadingConfig(sourceType)}
                  </p>
                )}
                {!isCustomSource && builtinError && (
                  <p className='mt-3 rounded-lg border border-warn-500/40 bg-warn-500/10 px-3 py-2 text-xs text-warn-500'>
                    {builtinError}
                  </p>
                )}
              </div>

              <div className='mt-4 rounded-xl border border-steel-700/40 bg-coal-900/60 p-4'>
                <div className='flex flex-wrap items-center justify-between gap-3'>
                  <p className='label'>{text.widgetStatus}</p>
                  <span className='text-xs text-steel-400'>
                    {text.sourceValue(
                      isCustomSource
                        ? customFileName || common.custom
                        : sourceType || common.na,
                    )}
                  </span>
                </div>

                {widgetValues.length === 0 ? (
                  <div className='mt-4 rounded-lg border border-dashed border-steel-700/60 bg-coal-900/30 px-4 py-6 text-sm text-steel-400'>
                    {text.noWidgetValues}
                  </div>
                ) : (
                  <>
                    {!activeConfig && (
                      <div className='mt-4 rounded-lg border border-dashed border-steel-700/60 bg-coal-900/30 px-4 py-3 text-sm text-steel-400'>
                        {isCustomSource
                          ? text.waitingCustomUpload
                          : sourceType
                            ? text.waitingBuiltinConfig(sourceType)
                            : text.noDeviceTypeSelected}
                      </div>
                    )}

                    <div className='mt-4 overflow-hidden rounded-xl border border-steel-700/40'>
                      <div className='max-h-[52vh] overflow-auto'>
                        <table className='w-full text-left text-xs'>
                          <thead className='bg-coal-900/70 text-steel-400'>
                            <tr>
                              <th className='px-4 py-3'>{text.index}</th>
                              <th className='px-4 py-3'>{text.rawValue}</th>
                              {activeConfig && (
                                <>
                                  <th className='px-4 py-3'>{text.widget}</th>
                                  <th className='px-4 py-3'>{text.type}</th>
                                  <th className='px-4 py-3'>{text.state}</th>
                                </>
                              )}
                            </tr>
                          </thead>
                          <tbody className='divide-y divide-steel-700/30'>
                            {widgetValues.map((item) => {
                              const widget = widgetMapByIndex.get(item.index)
                              return (
                                <tr key={item.index}>
                                  <td className='px-4 py-3 text-steel-100'>
                                    {item.index}
                                  </td>
                                  <td className='px-4 py-3 text-steel-300'>
                                    {item.value}
                                  </td>
                                  {activeConfig && (
                                    <>
                                      <td className='px-4 py-3 text-steel-200'>
                                        {widget?.widgetName ?? text.unmappedWidget}
                                      </td>
                                      <td className='px-4 py-3'>
                                        {widget ? (
                                          <span
                                            className={`chip bg-transparent text-[11px] uppercase ${getWidgetTypeBadgeTone(
                                              widget.widgetType,
                                            )}`}
                                          >
                                            {widget.widgetType}
                                          </span>
                                        ) : (
                                          <span className='text-steel-500'>N/A</span>
                                        )}
                                      </td>
                                      <td className='px-4 py-3 text-steel-300'>
                                        {getWidgetStateLabel(widget, item.value, language)}
                                      </td>
                                    </>
                                  )}
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {activeConfig && missingConfigWidgets.length > 0 && (
                      <div className='mt-4 rounded-lg border border-dashed border-steel-700/50 bg-coal-900/35 px-4 py-3 text-xs text-steel-400'>
                        {text.configWithoutValuePrefix}:{' '}
                        {missingConfigWidgets
                          .map((widget) => `${widget.widgetName} (index ${widget.widgetIndex})`)
                          .join(' | ')}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
