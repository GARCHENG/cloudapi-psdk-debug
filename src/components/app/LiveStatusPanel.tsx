import { HoverDetailRow, SectionHeader } from './ui'
import type { MqttStatus } from '../../hooks/useMqtt'
import { getMqttStatusLabel, getOnlineStateLabel, getText } from '../../lib/i18n'
import type { AppLanguage } from '../../types/app'
import { formatTimestamp, type OnlineState } from './view-helpers'

interface FloatingWindowSummary {
  text: string
  psdkIndex: number
  timestamp: number
}

interface LiveStatusPanelProps {
  language: AppLanguage
  status: MqttStatus
  onlineState: OnlineState
  lastFloatingAt: number | null
  floatingWindow: FloatingWindowSummary | null
  psdkStateAt: number | null
}

export const LiveStatusPanel = ({
  language,
  status,
  onlineState,
  lastFloatingAt,
  floatingWindow,
  psdkStateAt,
}: LiveStatusPanelProps) => {
  const text = getText(language)

  return (
    <section className='panel'>
      <div className='w-full'>
        <SectionHeader
          title={language === 'zh-CN' ? '实时状态' : 'Live Status'}
          subtitle={language === 'zh-CN' ? '心跳' : 'Heartbeat'}
          language={language}
        />
      </div>
      <div className='mt-6 space-y-4 text-sm'>
        <div className='flex items-center justify-between'>
          <span className='text-steel-400'>
            {language === 'zh-CN' ? 'MQTT 状态' : 'MQTT Status'}
          </span>
          <span className='text-steel-100'>{getMqttStatusLabel(language, status)}</span>
        </div>
        <div className='flex items-center justify-between'>
          <span className='text-steel-400'>
            {language === 'zh-CN' ? 'PSDK 在线状态' : 'PSDK Online'}
          </span>
          <span className='text-steel-100'>
            {getOnlineStateLabel(language, onlineState)}
          </span>
        </div>
        <HoverDetailRow
          language={language}
          label={language === 'zh-CN' ? '最近悬浮窗' : 'Last Floating'}
          available={Boolean(lastFloatingAt)}
          detail={
            floatingWindow ? (
              <div className='space-y-2'>
                <p>
                  {language === 'zh-CN' ? '更新时间' : 'Updated'}:{' '}
                  {formatTimestamp(lastFloatingAt, language)}
                </p>
                <p className='break-words text-steel-300'>
                  {language === 'zh-CN' ? '文本' : 'Text'}: {floatingWindow.text}
                </p>
              </div>
            ) : (
              getText(language).floatingWindow.empty
            )
          }
        />
        <HoverDetailRow
          language={language}
          label={language === 'zh-CN' ? '状态同步' : 'State Sync'}
          available={Boolean(psdkStateAt)}
          detail={
            psdkStateAt
              ? language === 'zh-CN'
                ? `最后同步：${formatTimestamp(psdkStateAt, language)}`
                : `Last synchronized: ${formatTimestamp(psdkStateAt, language)}`
              : text.psdkState.noStatePayload
          }
        />
      </div>
    </section>
  )
}
