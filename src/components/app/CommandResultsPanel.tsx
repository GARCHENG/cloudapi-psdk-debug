import {
  InlineSpinner,
  SectionHeader,
} from './ui'
import type { CommandLogEntry } from '../../types/psdk'
import {
  commandStatusTone,
  formatProgressLabel,
  formatTimestamp,
} from './view-helpers'

interface CommandResultsPanelProps {
  commandLogs: CommandLogEntry[]
  logModalOpen: boolean
  setLogModalOpen: (open: boolean) => void
}

export const CommandResultsPanel = ({
  commandLogs,
  logModalOpen,
  setLogModalOpen,
}: CommandResultsPanelProps) => {
  return (
    <>
      <section className='panel'>
        <div className='flex flex-wrap items-start justify-between gap-4'>
          <SectionHeader title='Command Results' subtitle='services_reply' />
          <button className='btn' onClick={() => setLogModalOpen(true)}>
            Log ({commandLogs.length})
          </button>
        </div>
        <p className='mt-6 text-sm text-steel-400'>
          Click Log to view command history in a modal.
        </p>
      </section>

      {logModalOpen && (
        <div
          className='fixed inset-0 z-50 flex items-center justify-center bg-coal-950/75 px-4 py-6'
          onClick={() => setLogModalOpen(false)}
        >
          <div
            className='panel w-full max-w-6xl'
            onClick={(event) => event.stopPropagation()}
          >
            <div className='flex flex-wrap items-start justify-between gap-4'>
              <SectionHeader title='Command Results' subtitle='services_reply' />
              <button
                className='btn btn-danger'
                onClick={() => setLogModalOpen(false)}
              >
                Close
              </button>
            </div>

            <div className='mt-6 overflow-hidden rounded-xl border border-steel-700/40'>
              <div className='max-h-[70vh] overflow-auto'>
                <table className='w-full text-left text-xs'>
                  <thead className='bg-coal-900/70 text-steel-400'>
                    <tr>
                      <th className='px-4 py-3'>Time</th>
                      <th className='px-4 py-3'>Method</th>
                      <th className='px-4 py-3'>Status</th>
                      <th className='px-4 py-3'>Play Progress</th>
                      <th className='px-4 py-3'>Result</th>
                      <th className='px-4 py-3'>TID</th>
                    </tr>
                  </thead>
                  <tbody className='divide-y divide-steel-700/30'>
                    {commandLogs.length === 0 ? (
                      <tr>
                        <td
                          className='px-4 py-6 text-center text-sm text-steel-400'
                          colSpan={6}
                        >
                          No commands sent yet.
                        </td>
                      </tr>
                    ) : (
                      commandLogs.map((entry) => (
                        <tr key={entry.tid}>
                          <td className='px-4 py-3 text-steel-300'>
                            {formatTimestamp(entry.sentAt)}
                          </td>
                          <td className='px-4 py-3 text-steel-100'>{entry.method}</td>
                          <td className='px-4 py-3'>
                            <span className={`chip ${commandStatusTone[entry.status]}`}>
                              {entry.status === 'pending' && (
                                <InlineSpinner className='h-3 w-3' />
                              )}
                              {entry.status === 'timeout'
                                ? 'timeout (10s)'
                                : entry.status}
                            </span>
                          </td>
                          <td className='px-4 py-3 text-steel-300'>
                            {formatProgressLabel(entry.playProgress)}
                          </td>
                          <td className='px-4 py-3 text-steel-300'>
                            {entry.result ?? 'N/A'}
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
        </div>
      )}
    </>
  )
}
