import { promises as fs } from 'node:fs'
import path from 'node:path'

const WIDGET_CONFIG_PATTERN = /^([a-zA-Z0-9_-]+)_widget_config\.json$/

const projectRoot = process.cwd()
const widgetConfigDir = path.join(projectRoot, 'public', 'widget-configs')
const registryFilePath = path.join(widgetConfigDir, 'registry.json')

const ensureWidgetConfigDir = async () => {
  await fs.mkdir(widgetConfigDir, { recursive: true })
}

const discoverWidgetConfigs = async () => {
  const dirEntries = await fs.readdir(widgetConfigDir, { withFileTypes: true })

  return dirEntries
    .filter((entry) => entry.isFile())
    .map((entry) => {
      const matchResult = entry.name.match(WIDGET_CONFIG_PATTERN)
      if (!matchResult) {
        return null
      }

      const deviceType = matchResult[1]
      return {
        deviceType,
        fileName: entry.name,
        url: `/widget-configs/${entry.name}`,
      }
    })
    .filter((entry) => entry !== null)
    .sort((left, right) => left.deviceType.localeCompare(right.deviceType))
}

const writeRegistry = async () => {
  await ensureWidgetConfigDir()

  const devices = await discoverWidgetConfigs()
  const registry = {
    generatedAt: new Date().toISOString(),
    devices,
  }

  await fs.writeFile(
    registryFilePath,
    `${JSON.stringify(registry, null, 2)}\n`,
    'utf8',
  )

  console.log(
    `[widget-configs] registry updated with ${devices.length} device(s): ${registryFilePath}`,
  )
}

await writeRegistry()
