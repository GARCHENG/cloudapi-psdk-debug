import { SectionHeader } from './ui'
import { formatTimestamp } from './view-helpers'

interface FloatingWindowSummary {
  text: string
  psdkIndex: number
  timestamp: number
}

interface FloatingWindowPanelProps {
  floatingWindow: FloatingWindowSummary | null
}

export const FloatingWindowPanel = ({ floatingWindow }: FloatingWindowPanelProps) => {
  return (
    <section className='panel'>
      <SectionHeader
        title='Floating Window'
        subtitle='Latest psdk_floating_window_text'
      />
      <div className='mt-6 rounded-xl border border-steel-700/40 bg-coal-900/60 p-4'>
        <p className='text-xs uppercase tracking-[0.2em] text-steel-400'>Current Text</p>
        <p className='mt-3 text-lg text-steel-100'>
          {floatingWindow?.text ?? 'No floating window message yet.'}
        </p>
        <div className='mt-4 flex flex-wrap items-center gap-4 text-xs text-steel-400'>
          <span>PSDK Index: {floatingWindow?.psdkIndex ?? 'N/A'}</span>
          <span>Updated: {formatTimestamp(floatingWindow?.timestamp)}</span>
        </div>
      </div>
    </section>
  )
}
