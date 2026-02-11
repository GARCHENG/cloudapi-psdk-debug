import { useEffect, useMemo, useState } from 'react'
import { SectionHeader } from './ui'
import {
  getPlayModeLabel,
  getSystemStateLabel,
  getWorkModeLabel,
} from '../../lib/psdk'
import type { PsdkStateEntry } from '../../types/psdk'

interface PsdkStatePanelProps {
  activeEntry?: PsdkStateEntry
}

export const PsdkStatePanel = ({ activeEntry }: PsdkStatePanelProps) => {
  const [widgetStateOpen, setWidgetStateOpen] = useState(false)

  const widgetValues = useMemo(
    () => [...(activeEntry?.values ?? [])].sort((left, right) => left.index - right.index),
    [activeEntry]
  )

  useEffect(() => {
    if (!widgetStateOpen) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setWidgetStateOpen(false)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [widgetStateOpen])

  return (
    <>
      <section className='panel'>
        <div className='flex flex-wrap items-start justify-between gap-4'>
          <SectionHeader title='PSDK State' subtitle='Device / Speaker' />
          <button
            className='btn disabled:cursor-not-allowed disabled:opacity-50'
            onClick={() => setWidgetStateOpen(true)}
            disabled={!activeEntry}
          >
            widget_state
          </button>
        </div>

        <div className='mt-6 space-y-4 text-sm'>
          {activeEntry ? (
            <>
              <div className='rounded-xl border border-steel-700/40 bg-coal-900/60 p-4'>
                <div className='flex items-center justify-between'>
                  <span className='text-xs uppercase tracking-[0.2em] text-steel-400'>
                    Active Payload
                  </span>
                  <span className='chip'>Index {activeEntry.psdk_index}</span>
                </div>
                <div className='mt-3 grid gap-2 text-xs text-steel-300'>
                  <span>Name: {activeEntry.psdk_name ?? 'N/A'}</span>
                  <span>SN: {activeEntry.psdk_sn ?? 'N/A'}</span>
                  <span>Version: {activeEntry.psdk_version ?? 'N/A'}</span>
                  <span>Lib: {activeEntry.psdk_lib_version ?? 'N/A'}</span>
                </div>
              </div>
              <div className='rounded-xl border border-steel-700/40 bg-coal-900/60 p-4'>
                <p className='text-xs uppercase tracking-[0.2em] text-steel-400'>
                  Speaker State
                </p>
                <div className='mt-3 grid gap-2 text-xs text-steel-300'>
                  <span>Mode: {getWorkModeLabel(activeEntry.speaker?.work_mode)}</span>
                  <span>
                    Play Mode: {getPlayModeLabel(activeEntry.speaker?.play_mode)}
                  </span>
                  <span>
                    System: {getSystemStateLabel(activeEntry.speaker?.system_state)}
                  </span>
                  <span>Volume: {activeEntry.speaker?.play_volume ?? 'N/A'}</span>
                  <span>File: {activeEntry.speaker?.play_file_name ?? 'N/A'}</span>
                </div>
              </div>
            </>
          ) : (
            <div className='rounded-xl border border-dashed border-steel-700/40 bg-coal-900/40 p-4 text-sm text-steel-400'>
              No /state payload received yet.
            </div>
          )}
        </div>
      </section>

      {widgetStateOpen && (
        <div
          className='fixed inset-0 z-50 flex items-center justify-center bg-coal-950/75 px-4 py-6'
          onClick={() => setWidgetStateOpen(false)}
        >
          <div
            className='panel w-full max-w-2xl'
            onClick={(event) => event.stopPropagation()}
          >
            <div className='flex flex-wrap items-start justify-between gap-4'>
              <SectionHeader title='Widget State' subtitle='index / value' />
              <button
                className='btn btn-danger'
                onClick={() => setWidgetStateOpen(false)}
              >
                Close
              </button>
            </div>

            <div className='mt-6 overflow-hidden rounded-xl border border-steel-700/40'>
              <div className='max-h-[65vh] overflow-auto'>
                <table className='w-full text-left text-xs'>
                  <thead className='bg-coal-900/70 text-steel-400'>
                    <tr>
                      <th className='px-4 py-3'>Index</th>
                      <th className='px-4 py-3'>Value</th>
                    </tr>
                  </thead>
                  <tbody className='divide-y divide-steel-700/30'>
                    {widgetValues.length === 0 ? (
                      <tr>
                        <td
                          className='px-4 py-6 text-center text-sm text-steel-400'
                          colSpan={2}
                        >
                          No widget values available.
                        </td>
                      </tr>
                    ) : (
                      widgetValues.map((item) => (
                        <tr key={item.index}>
                          <td className='px-4 py-3 text-steel-100'>{item.index}</td>
                          <td className='px-4 py-3 text-steel-300'>{item.value}</td>
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
