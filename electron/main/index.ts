import { app, BrowserWindow, ipcMain } from 'electron'
import { dirname, join } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import {
  IPC_CHANNELS,
  isDesktopConfigPayload,
  sanitizeDesktopConfigPayload,
} from '../shared/ipc'
import { readDesktopConfig, saveDesktopConfig } from './configStore'

const __dirname = dirname(fileURLToPath(import.meta.url))
let mainWindow: BrowserWindow | null = null

const createMainWindow = () => {
  const preloadPath = join(__dirname, '../preload/index.mjs')
  const win = new BrowserWindow({
    width: 1366,
    height: 900,
    minWidth: 1180,
    minHeight: 760,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  win.once('ready-to-show', () => {
    win.show()
    win.focus()
  })

  win.on('closed', () => {
    if (mainWindow === win) {
      mainWindow = null
    }
  })

  win.webContents.on('render-process-gone', () => {
    if (!win.isDestroyed()) {
      win.destroy()
    }
    app.quit()
  })

  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))

  if (process.env.ELECTRON_RENDERER_URL) {
    void win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

const focusMainWindow = () => {
  if (!mainWindow || mainWindow.isDestroyed()) return
  if (mainWindow.isMinimized()) {
    mainWindow.restore()
  }
  mainWindow.show()
  mainWindow.focus()
}

const registerIpcHandlers = () => {
  ipcMain.removeHandler(IPC_CHANNELS.GET_APP_INFO)
  ipcMain.removeHandler(IPC_CHANNELS.READ_CONFIG)
  ipcMain.removeHandler(IPC_CHANNELS.SAVE_CONFIG)

  ipcMain.handle(IPC_CHANNELS.GET_APP_INFO, () => ({
    name: app.getName(),
    version: app.getVersion(),
    platform: process.platform,
  }))

  ipcMain.handle(IPC_CHANNELS.READ_CONFIG, () => readDesktopConfig(app))

  ipcMain.handle(IPC_CHANNELS.SAVE_CONFIG, (_event, payload: unknown) => {
    if (!isDesktopConfigPayload(payload)) {
      return {
        ok: false,
        message: 'Invalid config payload.',
      }
    }

    return saveDesktopConfig(app, sanitizeDesktopConfigPayload(payload))
  })
}

const gotSingleInstanceLock = app.requestSingleInstanceLock()

if (!gotSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    focusMainWindow()
  })

  app.whenReady().then(() => {
    registerIpcHandlers()
    mainWindow = createMainWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        mainWindow = createMainWindow()
        return
      }
      focusMainWindow()
    })
  })

  app.on('before-quit', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.removeAllListeners('close')
      mainWindow.destroy()
    }
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })
}
