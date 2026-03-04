import {
  DESKTOP_MQTT_CONFIG_KEYS,
  type DesktopConfigPayload,
} from '../../src/types/desktop'

export const IPC_CHANNELS = {
  GET_APP_INFO: 'desktop:get-app-info',
  READ_CONFIG: 'desktop:read-config',
  SAVE_CONFIG: 'desktop:save-config',
} as const

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const DESKTOP_KEYS = new Set<string>(DESKTOP_MQTT_CONFIG_KEYS)

export const isDesktopConfigPayload = (
  value: unknown
): value is DesktopConfigPayload => {
  if (!isRecord(value)) return false

  for (const key of Object.keys(value)) {
    if (!DESKTOP_KEYS.has(key)) return false
  }

  for (const key of DESKTOP_MQTT_CONFIG_KEYS) {
    const rawValue = value[key]
    if (rawValue !== undefined && typeof rawValue !== 'string') {
      return false
    }
  }

  return true
}

export const sanitizeDesktopConfigPayload = (
  payload: DesktopConfigPayload
): DesktopConfigPayload => {
  const next: DesktopConfigPayload = {}
  for (const key of DESKTOP_MQTT_CONFIG_KEYS) {
    const rawValue = payload[key]
    if (typeof rawValue !== 'string') continue
    next[key] =
      key === 'mqttPassword' ? rawValue : rawValue.trim()
  }
  return next
}
