import type { ReactNode } from 'react'
import type { AppLanguage } from '../../types/app'

export const StatusBadge = ({
  label,
  tone,
  language = 'en',
}: {
  label: string
  tone: string
  language?: AppLanguage
}) => (
  <span className={`badge ${tone} ${language === 'zh-CN' ? 'badge-zh' : ''}`}>
    <span className='h-2 w-2 rounded-full bg-current' />
    {label}
  </span>
)

export const SectionHeader = ({
  title,
  subtitle,
  language = 'en',
}: {
  title: string
  subtitle: string
  language?: AppLanguage
}) => (
  <div className={language === 'zh-CN' ? 'section-header-zh' : ''}>
    <p className='panel-title'>{subtitle}</p>
    <h2 className='panel-heading'>{title}</h2>
  </div>
)

export const HoverDetailRow = ({
  label,
  available,
  detail,
  language = 'en',
}: {
  label: string
  available: boolean
  detail: ReactNode
  language?: AppLanguage
}) => (
  <div className='group relative flex cursor-help items-center justify-between gap-3 rounded-lg border border-steel-700/60 bg-coal-900/55 px-3 py-2'>
    <span className='text-steel-400'>{label}</span>
    <span
      className={`chip shrink-0 ${
        available
          ? 'border-signal-500/70 text-signal-400'
          : 'border-steel-700/80 text-steel-400'
      }`}
    >
      {available
        ? language === 'zh-CN'
          ? '可用'
          : 'Available'
        : language === 'zh-CN'
          ? '无数据'
          : 'No Data'}
    </span>
    <div className='pointer-events-none absolute -top-2 right-0 z-20 w-72 -translate-y-full rounded-lg border border-steel-700/80 bg-coal-950/95 p-3 text-xs text-steel-200 opacity-0 shadow-panel transition duration-150 group-hover:opacity-100'>
      {detail}
    </div>
  </div>
)

export const InlineSpinner = ({ className = 'h-3 w-3' }: { className?: string }) => (
  <span
    aria-hidden
    className={`inline-block ${className} animate-spin rounded-full border-2 border-current border-r-transparent`}
  />
)
