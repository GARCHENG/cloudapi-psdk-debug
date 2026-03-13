import { useCallback, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { InlineSpinner, SectionHeader } from './ui'
import { resolveCommandMethodLabel } from './view-helpers'
import { getText } from '../../lib/i18n'
import type { AppLanguage } from '../../types/app'
import {
  WidgetValueExampleModal,
  type WidgetExamplePick,
} from './WidgetValueExampleModal'
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

const DEFAULT_AUDIO_PLAY_NAME = import.meta.env.VITE_AUDIO_PLAY_DEFAULT_NAME ?? ''
const DEFAULT_AUDIO_PLAY_URL = import.meta.env.VITE_AUDIO_PLAY_DEFAULT_URL ?? ''
const DEFAULT_AUDIO_PLAY_MD5 = import.meta.env.VITE_AUDIO_PLAY_DEFAULT_MD5 ?? ''

interface CommandSequenceAddModalProps {
  language: AppLanguage
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
  language,
  locked,
  defaults,
  onDefaultsChange,
  onAddStep,
  onClose,
}: CommandSequenceAddModalProps) => {
  const text = getText(language)
  const sequenceText = text.sequence
  const speakerText = text.speaker
  const common = text.common
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
  const [widgetExampleModalOpen, setWidgetExampleModalOpen] = useState(false)
  const [widgetExampleDeviceType, setWidgetExampleDeviceType] = useState('')
  const [widgetExampleDescription, setWidgetExampleDescription] = useState('')

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

  const handleFillDefaultAudioDraft = useCallback(() => {
    setDraft((prev) => ({
      ...prev,
      audioName: DEFAULT_AUDIO_PLAY_NAME,
      audioUrl: DEFAULT_AUDIO_PLAY_URL,
      audioMd5: DEFAULT_AUDIO_PLAY_MD5,
    }))
    resetAudioValidationForDraftChange(DEFAULT_AUDIO_PLAY_URL, DEFAULT_AUDIO_PLAY_MD5)
  }, [resetAudioValidationForDraftChange])

  const handleWidgetExamplePick = ({
    index,
    value,
    deviceType,
    description,
  }: WidgetExamplePick) => {
    setDraft((prev) => ({
      ...prev,
      widgetIndex: index,
      widgetValue: value,
    }))
    setWidgetExampleDeviceType(deviceType)
    setWidgetExampleDescription(description)
  }

  const audioValidationMessage = (() => {
    switch (audioValidation.errorCode) {
      case 'URL_REQUIRED':
      case 'INVALID_URL':
      case 'INVALID_PROTOCOL':
        return `${speakerText.validationPrefixUrl}: ${audioValidation.message}`
      case 'INVALID_WAV_HEADER':
      case 'UNSUPPORTED_WAV_FORMAT':
      case 'CHANNELS_MISMATCH':
      case 'SAMPLE_RATE_MISMATCH':
      case 'BITS_PER_SAMPLE_MISMATCH':
        return `${speakerText.validationPrefixPcm}: ${audioValidation.message}`
      case 'MD5_REQUIRED':
      case 'MD5_MISMATCH':
        return `${speakerText.validationPrefixMd5}: ${audioValidation.message}`
      case 'NETWORK_ERROR':
      case 'HTTP_ERROR':
      case 'MD5_CALCULATION_FAILED':
        return `${speakerText.validationPrefixNetwork}: ${audioValidation.message}`
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
      return language === 'zh-CN' ? 'PSDK Index 为必填项。' : 'PSDK index is required.'
    }
    if (!Number.isFinite(draft.waitSeconds) || draft.waitSeconds < 0) {
      return language === 'zh-CN'
        ? '等待秒数必须大于或等于 0。'
        : 'Wait seconds must be 0 or greater.'
    }
    if (method === 'speaker_audio_play_start') {
      if (
        !draft.audioName.trim() ||
        !draft.audioUrl.trim() ||
        !draft.audioMd5.trim()
      ) {
        return language === 'zh-CN'
          ? '音频名称、URL 与 MD5 为必填项。'
          : 'Audio name, URL, and MD5 are required.'
      }
      if (audioValidation.status === 'validating') {
        return language === 'zh-CN'
          ? '正在校验 URL、PCM 元数据与 MD5...'
          : 'Validating URL, PCM metadata, and MD5...'
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
        return language === 'zh-CN'
          ? 'TTS 名称、文本与 MD5 为必填项。'
          : 'TTS name, text, and MD5 are required.'
      }
    }
    if (method === 'psdk_input_box_text_set') {
      if (!draft.inputBoxText.trim()) {
        return language === 'zh-CN'
          ? '输入框文本为必填项。'
          : 'Input box text is required.'
      }
      if (inputBoxTextBytes > 128) {
        return language === 'zh-CN'
          ? '输入框文本超过 128 字节。'
          : 'Input box text exceeds 128 bytes.'
      }
    }
    if (method === 'psdk_widget_value_set') {
      if (!Number.isInteger(draft.widgetIndex) || draft.widgetIndex < 0) {
        return language === 'zh-CN'
          ? 'Widget 索引必须是大于等于 0 的整数。'
          : 'Widget index must be a non-negative integer.'
      }
      if (!Number.isInteger(draft.widgetValue)) {
        return language === 'zh-CN'
          ? 'Widget 值必须是整数。'
          : 'Widget value must be an integer.'
      }
    }
    if (method === 'speaker_play_volume_set') {
      if (!Number.isFinite(draft.playVolume)) {
        return language === 'zh-CN' ? '播放音量为必填项。' : 'Play volume is required.'
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
    <>
      <div
        className='fixed inset-0 z-50 flex items-center justify-center bg-coal-950/75 px-4 py-6'
        onClick={onClose}
      >
        <div
          className='panel w-full max-w-4xl'
          onClick={(event) => event.stopPropagation()}
        >
        <div className='flex flex-wrap items-start justify-between gap-4'>
          <SectionHeader
            title={text.sequence.addStep}
            subtitle={language === 'zh-CN' ? '序列构建' : 'Sequence Builder'}
            language={language}
          />
          <button className='btn btn-danger' onClick={onClose} type='button'>
            {common.close}
          </button>
        </div>

        <div className='mt-6 grid gap-4 lg:grid-cols-[240px_1fr]'>
          <div className='rounded-xl border border-steel-700/45 bg-coal-900/60 p-4'>
            <p className='label'>{text.speaker.subtitle}</p>
            <div className='mt-3 grid gap-2'>
              {METHOD_LIST.map((method) => (
                <button
                  className={`btn w-full justify-start ${
                    selectedMethod === method ? 'btn-primary' : ''
                  }`}
                  key={method}
                  onClick={() => {
                    setDraft(defaults)
                    setWidgetExampleModalOpen(false)
                    setWidgetExampleDeviceType('')
                    setWidgetExampleDescription('')
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
                  {resolveCommandMethodLabel(method, language)}
                </button>
              ))}
            </div>
          </div>

          <div className='rounded-xl border border-steel-700/45 bg-coal-900/60 p-4'>
            {!selectedMethod ? (
              <div className='rounded-lg border border-dashed border-steel-700/60 bg-coal-900/35 px-4 py-6 text-sm text-steel-400'>
                {language === 'zh-CN'
                  ? '请选择命令并配置参数，然后添加步骤卡片。'
                  : 'Select a command to configure its parameters and add a step card.'}
              </div>
            ) : (
              <div className='space-y-4'>
                <div className='flex flex-wrap items-center gap-2'>
                  <span className='text-sm text-steel-100'>
                    {resolveCommandMethodLabel(selectedMethod, language)}
                  </span>
                  <span className='chip border-steel-600/70 bg-transparent text-[11px] text-steel-300'>
                    {selectedMethod}
                  </span>
                </div>

                <div className='grid gap-3'>
                  <div className='flex flex-wrap items-center gap-3'>
                    <label className='label m-0'>{text.connection.psdkIndexLabel}</label>
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
                    <label className='label m-0'>{sequenceText.defaultWaitSeconds}</label>
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
                        {speakerText.single}
                      </label>
                      <label className='flex items-center gap-2'>
                        <input
                          type='radio'
                          checked={draft.playMode === 1}
                          onChange={() =>
                            setDraft((prev) => ({ ...prev, playMode: 1 }))
                          }
                        />
                        {speakerText.loop}
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
                      <div className='flex flex-wrap items-center justify-between gap-3'>
                        <p className='label m-0'>{speakerText.audioPlayStart}</p>
                        <button
                          className='btn h-8 px-3 text-xs'
                          onClick={handleFillDefaultAudioDraft}
                          type='button'
                        >
                          {speakerText.example}
                        </button>
                      </div>
                      <input
                        className='input'
                        value={draft.audioName}
                        onChange={(event) =>
                          setDraft((prev) => ({
                            ...prev,
                            audioName: event.target.value,
                          }))
                        }
                        placeholder={speakerText.fileNamePlaceholder}
                      />
                      <input
                        className='input'
                        value={draft.audioUrl}
                        onChange={(event) =>
                          handleAudioUrlDraftChange(event.target.value)
                        }
                        placeholder={speakerText.fileUrlPlaceholder}
                      />
                      <input
                        className='input'
                        value={draft.audioMd5}
                        onChange={(event) =>
                          handleAudioMd5DraftChange(event.target.value)
                        }
                        placeholder={speakerText.fileMd5Placeholder}
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
                              {speakerText.validating}
                            </>
                          ) : (
                            speakerText.validateAudio
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
                        placeholder={speakerText.ttsNamePlaceholder}
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
                        placeholder={speakerText.ttsTextPlaceholder}
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
                        placeholder={speakerText.ttsMd5Placeholder}
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
                        placeholder={speakerText.inputBoxPlaceholder}
                      />
                      <p className='text-xs text-steel-400'>
                        {speakerText.bytesLabel(inputBoxTextBytes, 128)}
                      </p>
                    </div>
                  )}

                  {selectedMethod === 'psdk_widget_value_set' && (
                    <div className='grid gap-3'>
                      <div className='flex flex-wrap items-center justify-between gap-3'>
                        <p className='label m-0'>{speakerText.widgetValueSet}</p>
                        <button
                          className='btn h-8 px-3 text-xs'
                          onClick={() => setWidgetExampleModalOpen(true)}
                          type='button'
                        >
                          {speakerText.example}
                        </button>
                      </div>
                      <div className='flex flex-wrap items-center gap-3'>
                        <label className='label m-0'>{speakerText.widgetIndex}</label>
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
                            handleDraftNumberChange(event.target.value, (next) => {
                              setWidgetExampleDeviceType('')
                              setWidgetExampleDescription('')
                              setDraft((prev) => ({
                                ...prev,
                                widgetIndex: next,
                              }))
                            })
                          }
                          className='input w-24'
                        />
                      </div>
                      <div className='flex flex-wrap items-center gap-3'>
                        <label className='label m-0'>{speakerText.widgetValue}</label>
                        <input
                          type='number'
                          value={
                            Number.isInteger(draft.widgetValue)
                              ? draft.widgetValue
                              : ''
                          }
                          onChange={(event) =>
                            handleDraftNumberChange(event.target.value, (next) => {
                              setWidgetExampleDeviceType('')
                              setWidgetExampleDescription('')
                              setDraft((prev) => ({
                                ...prev,
                                widgetValue: next,
                              }))
                            })
                          }
                          className='input w-24'
                        />
                      </div>
                      {widgetExampleDescription && (
                        <p className='flex flex-wrap items-center gap-2 rounded-lg border border-signal-500/40 bg-signal-500/10 px-3 py-2 text-sm text-signal-400'>
                          {widgetExampleDeviceType && (
                            <span className='chip border-signal-500/45 bg-signal-500/15 text-[11px] uppercase text-signal-300'>
                              {widgetExampleDeviceType}
                            </span>
                          )}
                          {widgetExampleDescription}
                        </p>
                      )}
                    </div>
                  )}

                  {(selectedMethod === 'speaker_replay' ||
                    selectedMethod === 'speaker_play_stop') && (
                    <p className='text-xs text-steel-400'>
                      {sequenceText.noAdditionalParams}
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
                      ? speakerText.validating
                      : sequenceText.addToSequence}
                  </button>
                  <button
                    className='btn'
                    onClick={() => setSelectedMethod(null)}
                    type='button'
                  >
                    {sequenceText.chooseAnother}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
        </div>
      </div>
      <WidgetValueExampleModal
        language={language}
        open={widgetExampleModalOpen}
        onClose={() => setWidgetExampleModalOpen(false)}
        onPick={handleWidgetExamplePick}
      />
    </>,
    document.body,
  )
}
