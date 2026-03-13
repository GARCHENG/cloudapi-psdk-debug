import { SectionHeader, StatusBadge } from './ui'
import { getMqttStatusLabel, getText } from '../../lib/i18n'
import type { AppLanguage } from '../../types/app'
import type { MqttStatus } from '../../hooks/useMqtt'
import { mqttStatusTone } from './view-helpers'

interface ConnectionPanelProps {
  language: AppLanguage
  status: MqttStatus
  error: string | null
  desktopConfigHint: string | null
  connectionCollapsed: boolean
  mqttEnabled: boolean
  setMqttEnabled: (enabled: boolean) => void
  onConnect: () => void
  brokerUrl: string
  setBrokerUrl: (value: string) => void
  gatewaySn: string
  setGatewaySn: (value: string) => void
  mqttUsername: string
  setMqttUsername: (value: string) => void
  deviceSn: string
  setDeviceSn: (value: string) => void
  mqttPassword: string
  setMqttPassword: (value: string) => void
  psdkIndex: number
  setPsdkIndex: (value: number) => void
  clientId: string
  canConnect: boolean
}

export const ConnectionPanel = ({
  language,
  status,
  error,
  desktopConfigHint,
  connectionCollapsed,
  mqttEnabled,
  setMqttEnabled,
  onConnect,
  brokerUrl,
  setBrokerUrl,
  gatewaySn,
  setGatewaySn,
  mqttUsername,
  setMqttUsername,
  deviceSn,
  setDeviceSn,
  mqttPassword,
  setMqttPassword,
  psdkIndex,
  setPsdkIndex,
  clientId,
  canConnect,
}: ConnectionPanelProps) => {
  const text = getText(language)
  const panelText = text.connection

  return (
    <section className='panel'>
      <div className='w-full'>
        <SectionHeader
          title={panelText.title}
          subtitle={panelText.subtitle}
          language={language}
        />
      </div>

      {connectionCollapsed ? (
        <div className='mt-6 rounded-xl border border-steel-700/55 bg-coal-900/55 p-3'>
          <div className='flex flex-wrap items-center gap-2'>
            <StatusBadge
              label={`MQTT ${getMqttStatusLabel(language, status)}`}
              tone={mqttStatusTone[status]}
              language={language}
            />
            <span className='chip border-signal-500/40 text-signal-400'>
              {panelText.stable}
            </span>
            <button
              className='btn btn-danger ml-auto'
              onClick={() => setMqttEnabled(false)}
              disabled={!mqttEnabled}
            >
              {panelText.disconnect}
            </button>
          </div>

          <div className='mt-3 grid gap-2 sm:grid-cols-2'>
            <div className='rounded-lg border border-steel-700/60 bg-coal-950/40 px-3 py-2'>
              <p className='text-[11px] uppercase tracking-[0.2em] text-steel-500'>
                {panelText.broker}
              </p>
              <p className='mt-1 break-all text-sm text-steel-100' title={brokerUrl}>
                {brokerUrl}
              </p>
            </div>

            <div className='rounded-lg border border-steel-700/60 bg-coal-950/40 px-3 py-2'>
              <p className='text-[11px] uppercase tracking-[0.2em] text-steel-500'>
                {panelText.gatewaySn}
              </p>
              <p className='mt-1 break-all text-sm text-steel-100' title={gatewaySn}>
                {gatewaySn}
              </p>
            </div>

            <div className='rounded-lg border border-steel-700/60 bg-coal-950/40 px-3 py-2'>
              <p className='text-[11px] uppercase tracking-[0.2em] text-steel-500'>
                {panelText.clientId}
              </p>
              <p
                className='mt-1 break-all font-mono text-xs text-steel-200'
                title={clientId}
              >
                {clientId}
              </p>
            </div>

            <div className='rounded-lg border border-steel-700/60 bg-coal-950/40 px-3 py-2'>
              <p className='text-[11px] uppercase tracking-[0.2em] text-steel-500'>
                {panelText.deviceSn}
              </p>
              <p className='mt-1 break-all text-sm text-steel-100' title={deviceSn}>
                {deviceSn}
              </p>
            </div>
          </div>

          <p className='mt-3 text-xs text-steel-500'>
            {panelText.subscribedTopics}
          </p>
        </div>
      ) : (
        <>
          <div className='mt-6 grid gap-4 md:grid-cols-2'>
            <div>
              <label className='label'>{panelText.brokerUrlLabel}</label>
              <input
                className='input mt-2'
                value={brokerUrl}
                onChange={(event) => setBrokerUrl(event.target.value)}
                placeholder={panelText.brokerPlaceholder}
              />
            </div>
            <div>
              <label className='label'>{panelText.gatewaySnLabel}</label>
              <input
                className='input mt-2'
                value={gatewaySn}
                onChange={(event) => setGatewaySn(event.target.value)}
                placeholder={panelText.gatewayPlaceholder}
              />
            </div>
            <div>
              <label className='label'>{panelText.usernameLabel}</label>
              <input
                className='input mt-2'
                value={mqttUsername}
                onChange={(event) => setMqttUsername(event.target.value)}
                placeholder={panelText.usernamePlaceholder}
              />
            </div>
            <div>
              <label className='label'>{panelText.deviceSnLabel}</label>
              <input
                className='input mt-2'
                value={deviceSn}
                onChange={(event) => setDeviceSn(event.target.value)}
                placeholder={panelText.devicePlaceholder}
              />
            </div>
            <div>
              <label className='label'>{panelText.passwordLabel}</label>
              <input
                className='input mt-2'
                type='password'
                value={mqttPassword}
                onChange={(event) => setMqttPassword(event.target.value)}
                placeholder={panelText.passwordPlaceholder}
              />
            </div>
            <div>
              <label className='label'>{panelText.psdkIndexLabel}</label>
              <input
                className='input mt-2'
                type='number'
                min={0}
                max={3}
                step={1}
                value={psdkIndex}
                onChange={(event) => {
                  const nextValue = Number(event.target.value)
                  setPsdkIndex(Number.isFinite(nextValue) ? nextValue : 0)
                }}
              />
            </div>
            <div className='flex flex-col justify-between'>
              <span className='label'>{panelText.clientIdLabel}</span>
              <div className='mt-2 flex flex-wrap items-center gap-2'>
                <span className='chip font-mono text-[11px] text-steel-200'>
                  {clientId}
                </span>
                <span className='text-xs text-steel-500'>
                  {panelText.autoGenerated}
                </span>
              </div>
            </div>
          </div>
          <div className='mt-6 flex flex-wrap items-center gap-3'>
            <button
              className='btn btn-primary'
              onClick={onConnect}
              disabled={!canConnect || mqttEnabled}
            >
              {panelText.connect}
            </button>
            <button
              className='btn btn-danger'
              onClick={() => setMqttEnabled(false)}
              disabled={!mqttEnabled}
            >
              {panelText.disconnect}
            </button>
            <span className='text-xs text-steel-500'>
              {panelText.subscribedTopics}
            </span>
          </div>
        </>
      )}

      {status === 'error' && (
        <div className='mt-4 rounded-lg border border-warn-500/40 bg-warn-500/10 px-4 py-2 text-sm text-warn-500'>
          {panelText.mqttConnectionFailed(error)}
        </div>
      )}

      {desktopConfigHint && (
        <div className='mt-4 rounded-lg border border-signal-500/35 bg-signal-500/10 px-4 py-2 text-sm text-signal-300'>
          {desktopConfigHint}
        </div>
      )}
    </section>
  )
}
