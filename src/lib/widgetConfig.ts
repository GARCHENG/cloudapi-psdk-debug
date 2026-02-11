export type WidgetType = 'scale' | 'button' | 'switch' | 'list'

export interface NormalizedWidgetEntry {
  widgetIndex: number
  widgetType: WidgetType
  widgetName: string
  listItems: string[]
}

export interface NormalizedWidgetConfig {
  widgets: NormalizedWidgetEntry[]
}

export interface WidgetAction {
  label: string
  value: number
}

type ParseWidgetConfigResult =
  | {
      ok: true
      config: NormalizedWidgetConfig
    }
  | {
      ok: false
      error: string
    }

const SUPPORTED_WIDGET_TYPES = new Set<WidgetType>([
  'scale',
  'button',
  'switch',
  'list',
])

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

export function extractConfigWidgets(config: unknown): unknown[] {
  if (!isRecord(config)) {
    throw new Error('JSON root must be an object')
  }

  const configInterface = config.config_interface
  if (!isRecord(configInterface)) {
    throw new Error('Missing config_interface object')
  }

  const widgetList = configInterface.widget_list
  if (!Array.isArray(widgetList)) {
    throw new Error('Missing config_interface.widget_list array')
  }

  return widgetList
}

const parseWidgetType = (value: unknown): WidgetType | null => {
  if (typeof value !== 'string') {
    return null
  }

  return SUPPORTED_WIDGET_TYPES.has(value as WidgetType)
    ? (value as WidgetType)
    : null
}

const clampScaleValue = (value: number) => {
  if (!Number.isFinite(value)) return 0
  if (value < 0) return 0
  if (value > 100) return 100
  return Math.trunc(value)
}

export function normalizeWidgetEntries(entries: unknown[]): NormalizedWidgetEntry[] {
  const normalizedEntries = entries.map((entry, index) => {
    if (!isRecord(entry)) {
      throw new Error(`Widget #${index + 1} must be an object`)
    }

    const widgetIndexValue = entry.widget_index
    if (
      typeof widgetIndexValue !== 'number' ||
      !Number.isInteger(widgetIndexValue) ||
      widgetIndexValue < 0
    ) {
      throw new Error(`Widget #${index + 1} has invalid widget_index`)
    }
    const widgetIndex: number = widgetIndexValue

    const widgetType = parseWidgetType(entry.widget_type)
    if (!widgetType) {
      throw new Error(`Widget #${index + 1} has invalid widget_type`)
    }

    const widgetNameValue = entry.widget_name
    const widgetName =
      typeof widgetNameValue === 'string' && widgetNameValue.trim().length > 0
        ? widgetNameValue.trim()
        : `Widget ${widgetIndex}`

    let listItems: string[] = []
    if (widgetType === 'list') {
      if (!Array.isArray(entry.list_item)) {
        throw new Error(`List widget #${index + 1} is missing list_item array`)
      }

      listItems = entry.list_item.map((item, itemIndex) => {
        if (!isRecord(item)) {
          return `Option ${itemIndex}`
        }

        const itemName = item.item_name
        if (typeof itemName === 'string' && itemName.trim().length > 0) {
          return itemName.trim()
        }

        return `Option ${itemIndex}`
      })
    }

    return {
      widgetIndex,
      widgetType,
      widgetName,
      listItems,
    }
  })

  const duplicatedWidget = findDuplicatedWidget(normalizedEntries)
  if (duplicatedWidget !== null) {
    throw new Error(`Duplicate widget_index found: ${duplicatedWidget}`)
  }

  return normalizedEntries
}

const findDuplicatedWidget = (
  entries: NormalizedWidgetEntry[],
): number | null => {
  const widgetIndexes = new Set<number>()

  for (const entry of entries) {
    if (widgetIndexes.has(entry.widgetIndex)) {
      return entry.widgetIndex
    }

    widgetIndexes.add(entry.widgetIndex)
  }

  return null
}

export function buildWidgetActions(widget: NormalizedWidgetEntry): WidgetAction[] {
  if (widget.widgetType === 'button') {
    return [{ label: 'Trigger', value: 1 }]
  }

  if (widget.widgetType === 'switch') {
    return [
      { label: 'Off', value: 0 },
      { label: 'On', value: 1 },
    ]
  }

  if (widget.widgetType === 'list') {
    return widget.listItems.map((itemName, index) => ({
      label: itemName,
      value: index,
    }))
  }

  return []
}

export function parseWidgetConfigJson(
  jsonText: string,
): ParseWidgetConfigResult {
  try {
    const parsedValue = JSON.parse(jsonText) as unknown
    const configWidgets = extractConfigWidgets(parsedValue)
    const widgets = normalizeWidgetEntries(configWidgets)

    return {
      ok: true,
      config: { widgets },
    }
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : 'Failed to parse widget config file',
    }
  }
}

export function normalizeScaleValue(rawValue: number) {
  return clampScaleValue(rawValue)
}
