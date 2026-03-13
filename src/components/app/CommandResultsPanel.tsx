import { createPortal } from 'react-dom'
import {
  InlineSpinner,
  SectionHeader,
} from './ui'
import type { CommandLogEntry } from '../../types/psdk'
import { getCommandStatusLabel, getText } from '../../lib/i18n'
import type { AppLanguage } from '../../types/app'
import {
  commandStatusTone,
  formatProgressLabel,
  formatTimestamp,
  isPlayProgressCommandMethod,
  resolveCommandMethodLabel,
} from './view-helpers'

interface CommandResultsPanelProps {
  language: AppLanguage
  commandLogs: CommandLogEntry[]
  logModalOpen: boolean
  setLogModalOpen: (open: boolean) => void
}

export const CommandResultsPanel = ({
  language,
  commandLogs,
  logModalOpen,
  setLogModalOpen,
}: CommandResultsPanelProps) => {
  const text = getText(language).commandResults
  const common = getText(language).common

  return (
    <>
      <section className='panel'>
        <div className='flex flex-wrap items-start justify-between gap-4'>
          <SectionHeader
            title={text.title}
            subtitle={text.subtitle}
            language={language}
          />
          <button className='btn' onClick={() => setLogModalOpen(true)}>
            {text.logButton(commandLogs.length)}
          </button>
        </div>
        <p className='mt-6 text-sm text-steel-400'>
          {text.logHint}
        </p>
      </section>

      {logModalOpen &&
        createPortal(
          <div
            className='fixed inset-0 z-50 flex items-center justify-center bg-coal-950/75 px-4 py-6'
            onClick={() => setLogModalOpen(false)}
          >
            <div
              className='panel w-full max-w-6xl'
              onClick={(event) => event.stopPropagation()}
            >
              <div className='flex flex-wrap items-start justify-between gap-4'>
                <SectionHeader
                  title={text.title}
                  subtitle={text.subtitle}
                  language={language}
                />
                <button
                  className='btn btn-danger'
                  onClick={() => setLogModalOpen(false)}
                >
                  {common.close}
                </button>
              </div>

              <div className='mt-6 overflow-hidden rounded-xl border border-steel-700/40'>
                <div className='max-h-[70vh] overflow-auto'>
                  <table className='w-full text-left text-xs'>
                    <thead className='bg-coal-900/70 text-steel-400'>
                      <tr>
                        <th className='px-4 py-3'>{text.time}</th>
                        <th className='px-4 py-3'>{text.method}</th>
                        <th className='px-4 py-3'>{text.status}</th>
                        <th className='px-4 py-3'>{text.playProgress}</th>
                        <th className='px-4 py-3'>{text.result}</th>
                        <th className='px-4 py-3'>{text.tid}</th>
                      </tr>
                    </thead>
                    <tbody className='divide-y divide-steel-700/30'>
                      {commandLogs.length === 0 ? (
                        <tr>
                          <td
                            className='px-4 py-6 text-center text-sm text-steel-400'
                            colSpan={6}
                          >
                            {text.empty}
                          </td>
                        </tr>
                      ) : (
                        commandLogs.map((entry) => (
                          <tr key={entry.tid}>
                            <td className='px-4 py-3 text-steel-300'>
                              {formatTimestamp(entry.sentAt, language)}
                            </td>
                            <td className='px-4 py-3 text-steel-100'>
                              <div className='space-y-1'>
                                <p>{resolveCommandMethodLabel(entry.method, language)}</p>
                                <p className='text-[11px] text-steel-500'>{entry.method}</p>
                              </div>
                            </td>
                            <td className='px-4 py-3'>
                              <span className={`chip ${commandStatusTone[entry.status]}`}>
                                {entry.status === 'pending' && (
                                  <InlineSpinner className='h-3 w-3' />
                                )}
                                {getCommandStatusLabel(language, entry.status)}
                              </span>
                            </td>
                            <td className='px-4 py-3 text-steel-300'>
                              {isPlayProgressCommandMethod(entry.method)
                                ? formatProgressLabel(entry.playProgress, language)
                                : common.na}
                            </td>
                            <td className='px-4 py-3 text-steel-300'>
                              {entry.result ?? common.na}
                            </td>
                            <td className='px-4 py-3 font-mono text-[11px] text-steel-500'>
                              {entry.tid}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
