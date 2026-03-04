import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import dotenv from 'dotenv'
import type { App } from 'electron'
import {
  EMPTY_DESKTOP_MQTT_CONFIG,
  REQUIRED_DESKTOP_CONFIG_FIELDS,
  type DesktopConfigPayload,
  type DesktopConfigReadResult,
  type DesktopConfigSource,
  type DesktopConfigKey,
  type DesktopMqttConfig,
} from '../../src/types/desktop'
import {
  isDesktopConfigPayload,
  sanitizeDesktopConfigPayload,
} from '../shared/ipc'

const CONFIG_FILE_NAME = 'desktop-config.json'

const ENV_TO_CONFIG_KEY_MAP: Record<DesktopConfigKey, string> = {
  brokerUrl: 'VITE_MQTT_URL',
  mqttUsername: 'VITE_MQTT_USERNAME',
  mqttPassword: 'VITE_MQTT_PASSWORD',
  gatewaySn: 'VITE_GATEWAY_SN',
  deviceSn: 'VITE_DEVICE_SN',
}

let envLoaded = false

const loadEnvDefaults = () => {
  if (envLoaded) return
  dotenv.config({ path: resolve(process.cwd(), '.env') })
  envLoaded = true
}

const getConfigPath = (app: App) =>
  join(app.getPath('userData'), CONFIG_FILE_NAME)

const toDesktopConfig = (payload: DesktopConfigPayload): DesktopMqttConfig => ({
  brokerUrl: payload.brokerUrl ?? '',
  mqttUsername: payload.mqttUsername ?? '',
  mqttPassword: payload.mqttPassword ?? '',
  gatewaySn: payload.gatewaySn ?? '',
  deviceSn: payload.deviceSn ?? '',
})

const readLocalConfig = (configPath: string): DesktopConfigPayload => {
  if (!existsSync(configPath)) return {}

  try {
    const fileContent = readFileSync(configPath, 'utf8')
    const parsed = JSON.parse(fileContent) as unknown
    if (!isDesktopConfigPayload(parsed)) return {}
    return sanitizeDesktopConfigPayload(parsed)
  } catch {
    return {}
  }
}

const readEnvConfig = (): DesktopConfigPayload => {
  loadEnvDefaults()

  const payload: DesktopConfigPayload = {}
  for (const [configKey, envKey] of Object.entries(
    ENV_TO_CONFIG_KEY_MAP
  ) as [DesktopConfigKey, string][]) {
    const envValue = process.env[envKey]
    if (typeof envValue !== 'string') continue
    payload[configKey] =
      configKey === 'mqttPassword' ? envValue : envValue.trim()
  }
  return payload
}

const getMissingRequiredFields = (config: DesktopMqttConfig) =>
  REQUIRED_DESKTOP_CONFIG_FIELDS.filter(
    (field) => config[field].trim().length === 0
  )

const resolveSource = (
  localConfig: DesktopConfigPayload,
  envConfig: DesktopConfigPayload
): DesktopConfigSource => {
  if (Object.keys(localConfig).length > 0) return 'local'
  if (Object.keys(envConfig).length > 0) return 'env'
  return 'none'
}

export const readDesktopConfig = (app: App): DesktopConfigReadResult => {
  const configPath = getConfigPath(app)
  const localConfig = readLocalConfig(configPath)
  const envConfig = readEnvConfig()
  const source = resolveSource(localConfig, envConfig)
  const mergedConfig = toDesktopConfig({
    ...EMPTY_DESKTOP_MQTT_CONFIG,
    ...envConfig,
    ...localConfig,
  })
  const missingRequired = getMissingRequiredFields(mergedConfig)

  if (missingRequired.length === 0) {
    return {
      ok: true,
      source,
      config: mergedConfig,
      missingRequired: [],
    }
  }

  return {
    ok: false,
    source,
    config: mergedConfig,
    missingRequired,
    message: `Missing required config fields: ${missingRequired.join(', ')}`,
  }
}

export const saveDesktopConfig = (
  app: App,
  payload: unknown
) => {
  if (!isDesktopConfigPayload(payload)) {
    return {
      ok: false,
      message: 'Invalid config payload.',
    }
  }

  const configPath = getConfigPath(app)
  const currentLocalConfig = readLocalConfig(configPath)
  const nextConfig = {
    ...currentLocalConfig,
    ...sanitizeDesktopConfigPayload(payload),
  }

  try {
    mkdirSync(dirname(configPath), { recursive: true })
    writeFileSync(configPath, JSON.stringify(nextConfig, null, 2), 'utf8')
    return {
      ok: true,
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to save config.'
    return {
      ok: false,
      message,
    }
  }
}
