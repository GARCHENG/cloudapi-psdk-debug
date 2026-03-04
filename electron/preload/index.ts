import { contextBridge, ipcRenderer } from 'electron'
import process from 'node:process'
import type {
  DesktopApi,
  DesktopConfigPayload,
  DesktopConfigReadResult,
} from '../../src/types/desktop'
import { EMPTY_DESKTOP_MQTT_CONFIG } from '../../src/types/desktop'
import {
  IPC_CHANNELS,
  isDesktopConfigPayload,
  sanitizeDesktopConfigPayload,
} from '../shared/ipc'

const toFailedReadResult = (message: string): DesktopConfigReadResult => ({
  ok: false,
  source: 'none',
  config: { ...EMPTY_DESKTOP_MQTT_CONFIG },
  missingRequired: ['brokerUrl', 'gatewaySn', 'deviceSn'],
  message,
})

const desktopApi: DesktopApi = {
  async getAppInfo() {
    return ipcRenderer.invoke(IPC_CHANNELS.GET_APP_INFO)
  },
  async readConfig() {
    try {
      return await ipcRenderer.invoke(IPC_CHANNELS.READ_CONFIG)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to read config.'
      return toFailedReadResult(message)
    }
  },
  async saveConfig(payload: DesktopConfigPayload) {
    if (!isDesktopConfigPayload(payload)) {
      return {
        ok: false,
        message: 'Invalid config payload.',
      }
    }

    try {
      return await ipcRenderer.invoke(
        IPC_CHANNELS.SAVE_CONFIG,
        sanitizeDesktopConfigPayload(payload)
      )
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to save config.'
      return {
        ok: false,
        message,
      }
    }
  },
}

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('desktop', desktopApi)
} else {
  ;(window as unknown as { desktop: DesktopApi }).desktop = desktopApi
}
