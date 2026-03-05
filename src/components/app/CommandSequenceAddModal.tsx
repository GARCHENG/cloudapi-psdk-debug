import { useCallback, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { InlineSpinner, SectionHeader } from './ui'
import { COMMAND_METHOD_LABELS } from './view-helpers'
import type {
  CommandSequenceDefaults,
  PsdkCommandMethod,
} from '../../types/psdk'
import {
  createMd5RequiredSpeakerAudioValidation,
  createRequiredSpeakerAudioValidation,
  createRevalidationRequiredSpeakerAudioValidation,
  createValidatingSpeakerAudioValidation,
  type SpeakerAudioPlayStartValidationSnapshot,
  type SpeakerAudioPlayStartValidationResult,
  validateSpeakerAudioPlayStartManual,
} from '../../lib/speakerAudioPlayStartValidation'

interface CommandSequenceAddModalProps {
  locked: boolean
  defaults: CommandSequenceDefaults
  onDefaultsChange: (next: CommandSequenceDefaults) => void
  onAddStep: (
    method: PsdkCommandMethod,
    data: Record<string, unknown>,
    waitSeconds: number,
  ) => void
  onClose: () => void
}

const METHOD_LIST: PsdkCommandMethod[] = [
  'speaker_play_mode_set',
  'speaker_play_volume_set',
  'speaker_replay',
  'speaker_play_stop',
  'speaker_audio_play_start',
  'speaker_tts_play_start',
  'psdk_input_box_text_set',
  'psdk_widget_value_set',
]

export const CommandSequenceAddModal = ({
  locked,
  defaults,
  onDefaultsChange,
  onAddStep,
  onClose,
}: CommandSequenceAddModalProps) => {
  const [selectedMethod, setSelectedMethod] = useState<PsdkCommandMethod | null>(
    null,
  )
  const [draft, setDraft] = useState<CommandSequenceDefaults>(defaults)
  const [audioValidation, setAudioValidation] =
    useState<SpeakerAudioPlayStartValidationResult>(
      createRequiredSpeakerAudioValidation,
    )
  const [audioValidationSnapshot, setAudioValidationSnapshot] =
    useState<SpeakerAudioPlayStartValidationSnapshot | null>(null)
  const audioValidationRequestRef = useRef(0)

  const inputBoxTextBytes = useMemo(
    () => new TextEncoder().encode(draft.inputBoxText).length,
    [draft.inputBoxText],
  )

  const resetAudioValidationForDraftChange = useCallback(
    (nextUrl: string, nextMd5: string) => {
      audioValidationRequestRef.current += 1
      const normalizedUrl = nextUrl.trim()
      const normalizedMd5 = nextMd5.trim()

      if (!normalizedUrl) {
        setAudioValidation(createRequiredSpeakerAudioValidation())
      } else if (!normalizedMd5) {
        setAudioValidation(createMd5RequiredSpeakerAudioValidation(normalizedUrl))
      } else {
        setAudioValidation(
          createRevalidationRequiredSpeakerAudioValidation(
            normalizedUrl,
            normalizedMd5,
          ),
        )
      }

      setAudioValidationSnapshot(null)
    },
    [],
  )

  const handleAudioUrlDraftChange = useCallback(
    (value: string) => {
      setDraft((prev) => ({
        ...prev,
        audioUrl: value,
      }))
      resetAudioValidationForDraftChange(value, draft.audioMd5)
    },
    [draft.audioMd5, resetAudioValidationForDraftChange],
  )

  const handleAudioMd5DraftChange = useCallback(
    (value: string) => {
      setDraft((prev) => ({
        ...prev,
        audioMd5: value,
      }))
      resetAudioValidationForDraftChange(draft.audioUrl, value)
    },
    [draft.audioUrl, resetAudioValidationForDraftChange],
  )

  const handleValidateAudioDraft = useCallback(async () => {
    const normalizedUrl = draft.audioUrl.trim()
    const normalizedMd5 = draft.audioMd5.trim()
    const requestId = audioValidationRequestRef.current + 1
    audioValidationRequestRef.current = requestId

    if (!normalizedUrl) {
      const required = createRequiredSpeakerAudioValidation()
      if (audioValidationRequestRef.current === requestId) {
        setAudioValidation(required)
        setAudioValidationSnapshot(null)
      }
      return required
    }

    if (!normalizedMd5) {
      const md5Required = createMd5RequiredSpeakerAudioValidation(normalizedUrl)
      if (audioValidationRequestRef.current === requestId) {
        setAudioValidation(md5Required)
        setAudioValidationSnapshot(null)
      }
      return md5Required
    }

    setAudioValidation(
      createValidatingSpeakerAudioValidation(normalizedUrl, normalizedMd5),
    )

    const result = await validateSpeakerAudioPlayStartManual(
      normalizedUrl,
      normalizedMd5,
    )
    if (audioValidationRequestRef.current === requestId) {
      setAudioValidation(result)
      setAudioValidationSnapshot(
        result.status === 'valid' && result.snapshot ? result.snapshot : null,
      )
    }

    return result
  }, [draft.audioMd5, draft.audioUrl])

  const audioValidationMessage = (() => {
    switch (audioValidation.errorCode) {
      case 'URL_REQUIRED':
      case 'INVALID_URL':
      case 'INVALID_PROTOCOL':
        return `URL/protocol validation failed: ${audioValidation.message}`
      case 'INVALID_WAV_HEADER':
      case 'UNSUPPORTED_WAV_FORMAT':
      case 'CHANNELS_MISMATCH':
      case 'SAMPLE_RATE_MISMATCH':
      case 'BITS_PER_SAMPLE_MISMATCH':
        return `PCM format validation failed: ${audioValidation.message}`
      case 'MD5_REQUIRED':
      case 'MD5_MISMATCH':
        return `MD5 validation failed: ${audioValidation.message}`
      case 'NETWORK_ERROR':
      case 'HTTP_ERROR':
      case 'MD5_CALCULATION_FAILED':
        return `Network/CORS validation error: ${audioValidation.message}`
      default:
        return audioValidation.message
    }
  })()

  const buildDraftData = (method: PsdkCommandMethod) => {
    switch (method) {
      case 'speaker_audio_play_start':
        return {
          psdk_index: draft.psdkIndex,
          file: {
            format: 'pcm',
            md5: draft.audioMd5,
            name: draft.audioName,
            url: draft.audioUrl,
          },
        }
      case 'speaker_tts_play_start':
        return {
          psdk_index: draft.psdkIndex,
          tts: {
            md5: draft.ttsMd5,
            name: draft.ttsName,
            text: draft.ttsText,
          },
        }
      case 'speaker_replay':
        return { psdk_index: draft.psdkIndex }
      case 'speaker_play_stop':
        return { psdk_index: draft.psdkIndex }
      case 'speaker_play_mode_set':
        return {
          psdk_index: draft.psdkIndex,
          play_mode: draft.playMode,
        }
      case 'speaker_play_volume_set':
        return {
          psdk_index: draft.psdkIndex,
          play_volume: draft.playVolume,
        }
      case 'psdk_input_box_text_set':
        return {
          psdk_index: draft.psdkIndex,
          value: draft.inputBoxText,
        }
      case 'psdk_widget_value_set':
        return {
          psdk_index: draft.psdkIndex,
          index: draft.widgetIndex,
          value: draft.widgetValue,
        }
      default:
        return {}
    }
  }

  const validateDraft = (method: PsdkCommandMethod) => {
    if (!Number.isFinite(draft.psdkIndex) || draft.psdkIndex < 0) {
      return 'PSDK index is required.'
    }
    if (!Number.isFinite(draft.waitSeconds) || draft.waitSeconds < 0) {
      return 'Wait seconds must be 0 or greater.'
    }
    if (method === 'speaker_audio_play_start') {
      if (
        !draft.audioName.trim() ||
        !draft.audioUrl.trim() ||
        !draft.audioMd5.trim()
      ) {
        return 'Audio name, URL, and MD5 are required.'
      }
      if (audioValidation.status === 'validating') {
        return 'Validating URL, PCM metadata, and MD5...'
      }
      if (
        audioValidation.status !== 'valid' ||
        audioValidationSnapshot === null
      ) {
        return audioValidationMessage
      }
    }
    if (method === 'speaker_tts_play_start') {
      if (!draft.ttsName.trim() || !draft.ttsText.trim() || !draft.ttsMd5.trim()) {
        return 'TTS name, text, and MD5 are required.'
      }
    }
    if (method === 'psdk_input_box_text_set') {
      if (!draft.inputBoxText.trim()) {
        return 'Input box text is required.'
      }
      if (inputBoxTextBytes > 128) {
        return 'Input box text exceeds 128 bytes.'
      }
    }
    if (method === 'psdk_widget_value_set') {
      if (!Number.isInteger(draft.widgetIndex) || draft.widgetIndex < 0) {
        return 'Widget index must be a non-negative integer.'
      }
      if (!Number.isInteger(draft.widgetValue)) {
        return 'Widget value must be an integer.'
      }
    }
    if (method === 'speaker_play_volume_set') {
      if (!Number.isFinite(draft.playVolume)) {
        return 'Play volume is required.'
      }
    }
    return null
  }

  const handleDraftNumberChange = (
    value: string,
    updater: (next: number) => void,
  ) => {
    const next = value.trim() === '' ? Number.NaN : Number(value)
    updater(next)
  }

  const selectedError = selectedMethod ? validateDraft(selectedMethod) : null
  const canAddSelected =
    Boolean(selectedMethod) && !selectedError && !locked
  const canValidateAudio =
    draft.audioName.trim().length > 0 &&
    draft.audioUrl.trim().length > 0 &&
    draft.audioMd5.trim().length > 0
  const pendingAudioValidation = audioValidation.status === 'validating'
  const showAudioValidation =
    selectedMethod === 'speaker_audio_play_start' &&
    (draft.audioUrl.trim().length > 0 ||
      draft.audioMd5.trim().length > 0 ||
      audioValidation.status === 'validating')
  const audioValidationTone =
    audioValidation.status === 'valid'
      ? 'border-signal-500/45 bg-signal-500/10 text-signal-400'
      : audioValidation.status === 'validating'
        ? 'border-amber-500/50 bg-amber-500/10 text-amber-400'
        : 'border-warn-500/45 bg-warn-500/10 text-warn-500'

  const handleAddSelected = () => {
    if (!selectedMethod) return
    const error = validateDraft(selectedMethod)
    if (error) return

    onDefaultsChange(draft)
    onAddStep(
      selectedMethod,
      buildDraftData(selectedMethod),
      draft.waitSeconds,
    )
    onClose()
  }

  return createPortal(
    <div
      className='fixed inset-0 z-50 flex items-center justify-center bg-coal-950/75 px-4 py-6'
      onClick={onClose}
    >
      <div
        className='panel w-full max-w-4xl'
        onClick={(event) => event.stopPropagation()}
      >
        <div className='flex flex-wrap items-start justify-between gap-4'>
          <SectionHeader title='Add Sequence Step' subtitle='Sequence Builder' />
          <button className='btn btn-danger' onClick={onClose} type='button'>
            Close
          </button>
        </div>

        <div className='mt-6 grid gap-4 lg:grid-cols-[240px_1fr]'>
          <div className='rounded-xl border border-steel-700/45 bg-coal-900/60 p-4'>
            <p className='label'>Commands</p>
            <div className='mt-3 grid gap-2'>
              {METHOD_LIST.map((method) => (
                <button
                  className={`btn w-full justify-start ${
                    selectedMethod === method ? 'btn-primary' : ''
                  }`}
                  key={method}
                  onClick={() => {
                    setDraft(defaults)
                    if (method === 'speaker_audio_play_start') {
                      resetAudioValidationForDraftChange(
                        defaults.audioUrl,
                        defaults.audioMd5,
                      )
                    } else {
                      audioValidationRequestRef.current += 1
                      setAudioValidation(createRequiredSpeakerAudioValidation())
                      setAudioValidationSnapshot(null)
                    }
                    setSelectedMethod(method)
                  }}
                  type='button'
                >
                  {COMMAND_METHOD_LABELS[method]}
                </button>
              ))}
            </div>
          </div>

          <div className='rounded-xl border border-steel-700/45 bg-coal-900/60 p-4'>
            {!selectedMethod ? (
              <div className='rounded-lg border border-dashed border-steel-700/60 bg-coal-900/35 px-4 py-6 text-sm text-steel-400'>
                Select a command to configure its parameters and add a step card.
              </div>
            ) : (
              <div className='space-y-4'>
                <div className='flex flex-wrap items-center gap-2'>
                  <span className='text-sm text-steel-100'>
                    {COMMAND_METHOD_LABELS[selectedMethod]}
                  </span>
                  <span className='chip border-steel-600/70 bg-transparent text-[11px] text-steel-300'>
                    {selectedMethod}
                  </span>
                </div>

                <div className='grid gap-3'>
                  <div className='flex flex-wrap items-center gap-3'>
                    <label className='label m-0'>PSDK Index</label>
                    <input
                      className='input w-28'
                      min={0}
                      onChange={(event) =>
                        handleDraftNumberChange(event.target.value, (next) =>
                          setDraft((prev) => ({ ...prev, psdkIndex: next })),
                        )
                      }
                      step={1}
                      type='number'
                      value={Number.isFinite(draft.psdkIndex) ? draft.psdkIndex : ''}
                    />
                  </div>
                  <div className='flex flex-wrap items-center gap-3'>
                    <label className='label m-0'>Wait (sec)</label>
                    <input
                      className='input w-28'
                      min={0}
                      onChange={(event) =>
                        handleDraftNumberChange(event.target.value, (next) =>
                          setDraft((prev) => ({ ...prev, waitSeconds: next })),
                        )
                      }
                      step={0.5}
                      type='number'
                      value={
                        Number.isFinite(draft.waitSeconds) ? draft.waitSeconds : ''
                      }
                    />
                  </div>

                  {selectedMethod === 'speaker_play_mode_set' && (
                    <div className='flex flex-wrap items-center gap-4 text-sm'>
                      <label className='flex items-center gap-2'>
                        <input
                          type='radio'
                          checked={draft.playMode === 0}
                          onChange={() =>
                            setDraft((prev) => ({ ...prev, playMode: 0 }))
                          }
                        />
                        Single
                      </label>
                      <label className='flex items-center gap-2'>
                        <input
                          type='radio'
                          checked={draft.playMode === 1}
                          onChange={() =>
                            setDraft((prev) => ({ ...prev, playMode: 1 }))
                          }
                        />
                        Loop
                      </label>
                    </div>
                  )}

                  {selectedMethod === 'speaker_play_volume_set' && (
                    <div className='flex flex-wrap items-center gap-3'>
                      <input
                        type='range'
                        min={0}
                        max={100}
                        value={
                          Number.isFinite(draft.playVolume) ? draft.playVolume : 0
                        }
                        onChange={(event) =>
                          handleDraftNumberChange(event.target.value, (next) =>
                            setDraft((prev) => ({ ...prev, playVolume: next })),
                          )
                        }
                        className='flex-1'
                      />
                      <input
                        type='number'
                        min={0}
                        max={100}
                        value={
                          Number.isFinite(draft.playVolume) ? draft.playVolume : ''
                        }
                        onChange={(event) =>
                          handleDraftNumberChange(event.target.value, (next) =>
                            setDraft((prev) => ({ ...prev, playVolume: next })),
                          )
                        }
                        className='input w-24'
                      />
                    </div>
                  )}

                  {selectedMethod === 'speaker_audio_play_start' && (
                    <div className='grid gap-3'>
                      <input
                        className='input'
                        value={draft.audioName}
                        onChange={(event) =>
                          setDraft((prev) => ({
                            ...prev,
                            audioName: event.target.value,
                          }))
                        }
                        placeholder='File name'
                      />
                      <input
                        className='input'
                        value={draft.audioUrl}
                        onChange={(event) =>
                          handleAudioUrlDraftChange(event.target.value)
                        }
                        placeholder='File URL (PCM)'
                      />
                      <input
                        className='input'
                        value={draft.audioMd5}
                        onChange={(event) =>
                          handleAudioMd5DraftChange(event.target.value)
                        }
                        placeholder='File MD5'
                      />
                      {showAudioValidation && (
                        <p
                          className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${audioValidationTone}`}
                        >
                          {audioValidation.status === 'validating' && (
                            <InlineSpinner className='h-3 w-3' />
                          )}
                          {audioValidationMessage}
                        </p>
                      )}
                      <div className='flex flex-wrap gap-3'>
                        <button
                          className='btn'
                          onClick={() => {
                            void handleValidateAudioDraft()
                          }}
                          disabled={!canValidateAudio || pendingAudioValidation}
                          aria-busy={pendingAudioValidation}
                          type='button'
                        >
                          {pendingAudioValidation ? (
                            <>
                              <InlineSpinner />
                              Validating...
                            </>
                          ) : (
                            'Validate Audio'
                          )}
                        </button>
                      </div>
                    </div>
                  )}

                  {selectedMethod === 'speaker_tts_play_start' && (
                    <div className='grid gap-3'>
                      <input
                        className='input'
                        value={draft.ttsName}
                        onChange={(event) =>
                          setDraft((prev) => ({
                            ...prev,
                            ttsName: event.target.value,
                          }))
                        }
                        placeholder='TTS name'
                      />
                      <textarea
                        className='textarea h-24'
                        value={draft.ttsText}
                        onChange={(event) =>
                          setDraft((prev) => ({
                            ...prev,
                            ttsText: event.target.value,
                          }))
                        }
                        placeholder='TTS text'
                      />
                      <input
                        className='input'
                        value={draft.ttsMd5}
                        onChange={(event) =>
                          setDraft((prev) => ({
                            ...prev,
                            ttsMd5: event.target.value,
                          }))
                        }
                        placeholder='TTS MD5'
                      />
                    </div>
                  )}

                  {selectedMethod === 'psdk_input_box_text_set' && (
                    <div className='grid gap-3'>
                      <textarea
                        className='textarea h-24'
                        value={draft.inputBoxText}
                        maxLength={128}
                        onChange={(event) =>
                          setDraft((prev) => ({
                            ...prev,
                            inputBoxText: event.target.value,
                          }))
                        }
                        placeholder='Input box content (max 128 bytes/chars)'
                      />
                      <p className='text-xs text-steel-400'>
                        Bytes: {inputBoxTextBytes}/128
                      </p>
                    </div>
                  )}

                  {selectedMethod === 'psdk_widget_value_set' && (
                    <div className='grid gap-3'>
                      <div className='flex flex-wrap items-center gap-3'>
                        <label className='label m-0'>Widget Index</label>
                        <input
                          type='number'
                          min={0}
                          step={1}
                          value={
                            Number.isInteger(draft.widgetIndex)
                              ? draft.widgetIndex
                              : ''
                          }
                          onChange={(event) =>
                            handleDraftNumberChange(event.target.value, (next) =>
                              setDraft((prev) => ({
                                ...prev,
                                widgetIndex: next,
                              })),
                            )
                          }
                          className='input w-24'
                        />
                      </div>
                      <div className='flex flex-wrap items-center gap-3'>
                        <label className='label m-0'>Widget Value</label>
                        <input
                          type='number'
                          value={
                            Number.isInteger(draft.widgetValue)
                              ? draft.widgetValue
                              : ''
                          }
                          onChange={(event) =>
                            handleDraftNumberChange(event.target.value, (next) =>
                              setDraft((prev) => ({
                                ...prev,
                                widgetValue: next,
                              })),
                            )
                          }
                          className='input w-24'
                        />
                      </div>
                    </div>
                  )}

                  {(selectedMethod === 'speaker_replay' ||
                    selectedMethod === 'speaker_play_stop') && (
                    <p className='text-xs text-steel-400'>
                      No additional parameters required.
                    </p>
                  )}
                </div>

                {selectedError && (
                  <p className='rounded-lg border border-warn-500/40 bg-warn-500/10 px-3 py-2 text-xs text-warn-500'>
                    {selectedError}
                  </p>
                )}

                <div className='flex flex-wrap items-center gap-2'>
                  <button
                    className='btn btn-primary'
                    disabled={!canAddSelected}
                    onClick={() => {
                      void handleAddSelected()
                    }}
                    type='button'
                  >
                    {selectedMethod === 'speaker_audio_play_start' &&
                    pendingAudioValidation
                      ? 'Validating...'
                      : 'Add To Sequence'}
                  </button>
                  <button
                    className='btn'
                    onClick={() => setSelectedMethod(null)}
                    type='button'
                  >
                    Choose Another
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
