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
  return (
    <section className='panel'>
      <SectionHeader title='PSDK State' subtitle='Device / Speaker' />
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
  )
}
