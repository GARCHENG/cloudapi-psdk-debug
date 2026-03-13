import { SectionHeader } from './ui'
import { getText } from '../../lib/i18n'
import type { AppLanguage } from '../../types/app'
import { formatTimestamp } from './view-helpers'

interface FloatingWindowSummary {
  text: string
  psdkIndex: number
  timestamp: number
}

interface FloatingWindowPanelProps {
  language: AppLanguage
  floatingWindow: FloatingWindowSummary | null
}

export const FloatingWindowPanel = ({
  language,
  floatingWindow,
}: FloatingWindowPanelProps) => {
  const text = getText(language).floatingWindow
  const common = getText(language).common

  return (
    <section className='panel'>
      <SectionHeader
        title={text.title}
        subtitle={text.subtitle}
        language={language}
      />
      <div className='mt-6 rounded-xl border border-steel-700/40 bg-coal-900/60 p-4'>
        <p className='text-xs uppercase tracking-[0.2em] text-steel-400'>
          {text.currentText}
        </p>
        <p className='mt-3 text-lg text-steel-100'>
          {floatingWindow?.text ?? text.empty}
        </p>
        <div className='mt-4 flex flex-wrap items-center gap-4 text-xs text-steel-400'>
          <span>{text.psdkIndex}: {floatingWindow?.psdkIndex ?? common.na}</span>
          <span>{text.updated}: {formatTimestamp(floatingWindow?.timestamp, language)}</span>
        </div>
      </div>
    </section>
  )
}
