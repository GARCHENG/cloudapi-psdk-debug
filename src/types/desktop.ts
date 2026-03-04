export interface DesktopMqttConfig {
  brokerUrl: string
  mqttUsername: string
  mqttPassword: string
  gatewaySn: string
  deviceSn: string
}

export type DesktopConfigPayload = Partial<DesktopMqttConfig>

export type DesktopConfigSource = 'local' | 'env' | 'none'

export interface DesktopConfigReadResult {
  ok: boolean
  source: DesktopConfigSource
  config: DesktopMqttConfig
  missingRequired: RequiredDesktopConfigField[]
  message?: string
}

export interface DesktopConfigSaveResult {
  ok: boolean
  message?: string
}

export interface DesktopAppInfo {
  name: string
  version: string
  platform: string
}

export interface DesktopApi {
  getAppInfo: () => Promise<DesktopAppInfo>
  readConfig: () => Promise<DesktopConfigReadResult>
  saveConfig: (payload: DesktopConfigPayload) => Promise<DesktopConfigSaveResult>
}

export const DESKTOP_MQTT_CONFIG_KEYS = [
  'brokerUrl',
  'mqttUsername',
  'mqttPassword',
  'gatewaySn',
  'deviceSn',
] as const

export const REQUIRED_DESKTOP_CONFIG_FIELDS = [
  'brokerUrl',
  'gatewaySn',
  'deviceSn',
] as const

export type DesktopConfigKey = (typeof DESKTOP_MQTT_CONFIG_KEYS)[number]
export type RequiredDesktopConfigField =
  (typeof REQUIRED_DESKTOP_CONFIG_FIELDS)[number]

export const EMPTY_DESKTOP_MQTT_CONFIG: DesktopMqttConfig = {
  brokerUrl: '',
  mqttUsername: '',
  mqttPassword: '',
  gatewaySn: '',
  deviceSn: '',
}
