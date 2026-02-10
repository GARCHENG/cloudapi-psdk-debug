import { HoverDetailRow, SectionHeader } from './ui'
import type { MqttStatus } from '../../hooks/useMqtt'
import { formatTimestamp, type OnlineState } from './view-helpers'

interface FloatingWindowSummary {
  text: string
  psdkIndex: number
  timestamp: number
}

interface LiveStatusPanelProps {
  status: MqttStatus
  onlineState: OnlineState
  lastFloatingAt: number | null
  floatingWindow: FloatingWindowSummary | null
  psdkStateAt: number | null
}

export const LiveStatusPanel = ({
  status,
  onlineState,
  lastFloatingAt,
  floatingWindow,
  psdkStateAt,
}: LiveStatusPanelProps) => {
  return (
    <section className='panel'>
      <div className='w-full'>
        <SectionHeader title='Live Status' subtitle='Heartbeat' />
      </div>
      <div className='mt-6 space-y-4 text-sm'>
        <div className='flex items-center justify-between'>
          <span className='text-steel-400'>MQTT Status</span>
          <span className='text-steel-100'>{status}</span>
        </div>
        <div className='flex items-center justify-between'>
          <span className='text-steel-400'>PSDK Online</span>
          <span className='text-steel-100'>{onlineState}</span>
        </div>
        <HoverDetailRow
          label='Last Floating'
          available={Boolean(lastFloatingAt)}
          detail={
            floatingWindow ? (
              <div className='space-y-2'>
                <p>Updated: {formatTimestamp(lastFloatingAt)}</p>
                <p className='break-words text-steel-300'>Text: {floatingWindow.text}</p>
              </div>
            ) : (
              'No floating window message yet.'
            )
          }
        />
        <HoverDetailRow
          label='State Sync'
          available={Boolean(psdkStateAt)}
          detail={
            psdkStateAt
              ? `Last synchronized: ${formatTimestamp(psdkStateAt)}`
              : 'No state payload received yet.'
          }
        />
      </div>
    </section>
  )
}
